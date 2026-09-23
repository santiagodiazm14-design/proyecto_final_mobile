// Orquesta la sincronización offline-first: decide si hay conexión, sube la cola
// pendiente de sqliteService contra la API y trae datos frescos del servidor para
// reconciliar el SQLite local. Lo consume SyncContext (botón manual + auto-sync
// al reconectar) y cada pantalla a través de `syncOrQueue`.
import { sqliteService, SyncQueueItem } from '../database/sqliteService';
import { apiService } from './apiService';

export interface SyncStatusResult {
  success: boolean;
  pushedCount: number;
  pulledClassesCount: number;
  pulledBookingsCount: number;
  message: string;
  syncedAt: string;
}

class SyncService {
  private isSimulatedOffline: boolean = false;
  private isSyncing: boolean = false;

  setSimulatedOffline(value: boolean) {
    this.isSimulatedOffline = value;
  }

  getSimulatedOffline(): boolean {
    return this.isSimulatedOffline;
  }

  // true si hay conexión real a la API, salvo que el usuario haya activado el
  // "Modo Offline" simulado desde el Header/Perfil (siempre gana el modo simulado).
  async isOnline(): Promise<boolean> {
    if (this.isSimulatedOffline) return false;
    return await apiService.checkHealth();
  }

  // Ejecuta una acción contra la API si hay conexión; si falla o está offline,
  // la encola en SQLite para reintentarla en la próxima sincronización.
  // Centraliza el patrón "online -> intentar API, si no -> encolar" usado en
  // reservas, cancelaciones, check-in, gestión de clases y bloqueo de usuarios.
  // Devuelve true si se aplicó de inmediato contra la API, false si quedó encolada.
  async syncOrQueue(
    isOnline: boolean,
    action: SyncQueueItem['action'],
    entity: string,
    payload: any,
    onlineCall: () => Promise<any>
  ): Promise<boolean> {
    if (isOnline) {
      try {
        await onlineCall();
        return true;
      } catch {
        // Sigue al encolado para reintentar cuando vuelva la conexión
      }
    }
    await sqliteService.enqueueAction(action, entity, payload);
    return false;
  }

  // Realizar sincronización bidireccional completa
  async syncBidirectional(userId?: string): Promise<SyncStatusResult> {
    if (this.isSyncing) {
      return {
        success: false,
        pushedCount: 0,
        pulledClassesCount: 0,
        pulledBookingsCount: 0,
        message: 'Sincronización ya en curso',
        syncedAt: new Date().toISOString()
      };
    }

    const online = await this.isOnline();
    if (!online) {
      return {
        success: false,
        pushedCount: 0,
        pulledClassesCount: 0,
        pulledBookingsCount: 0,
        message: 'Modo Offline: Operando con SQLite local sin conexión',
        syncedAt: new Date().toISOString()
      };
    }

    this.isSyncing = true;
    try {
      // 1. PUSH: Obtener transacciones encoladas en SQLite
      const pendingQueue = await sqliteService.getPendingQueue();
      let pushedCount = 0;

      if (pendingQueue.length > 0) {
        console.log(`Enviando ${pendingQueue.length} mutaciones locales a la API...`);
        const pushResult = await apiService.pushSync(pendingQueue);

        // Solo marcar como sincronizadas las mutaciones que el servidor aplicó con éxito.
        // Las que fallaron (ERROR/IGNORED) quedan en la cola para reintentarse en el próximo sync.
        const resultByQueueId = new Map<string, string>(
          (pushResult?.results || []).map((r: any) => [r.queueId, r.status])
        );

        for (const item of pendingQueue) {
          if (resultByQueueId.get(item.id) === 'SUCCESS') {
            await sqliteService.markQueueItemSynced(item.id);
            pushedCount++;
          } else {
            console.warn(`Mutación ${item.id} (${item.action}) no se sincronizó, se reintentará: ${resultByQueueId.get(item.id) || 'sin respuesta'}`);
          }
        }
      }

      // 2. PULL: Traer datos frescos del servidor
      const pullResult = await apiService.pullSync(userId);
      if (pullResult && pullResult.classes) {
        await sqliteService.applyRemoteSync(pullResult.classes, pullResult.bookings || [], pullResult.users || []);
      }

      const result: SyncStatusResult = {
        success: true,
        pushedCount,
        pulledClassesCount: pullResult?.classes?.length || 0,
        pulledBookingsCount: pullResult?.bookings?.length || 0,
        message: `Sincronización completada (${pushedCount} subidos, ${pullResult?.classes?.length || 0} clases actualizadas)`,
        syncedAt: new Date().toISOString()
      };

      return result;
    } catch (error: any) {
      console.error('Error durante la sincronización:', error);
      return {
        success: false,
        pushedCount: 0,
        pulledClassesCount: 0,
        pulledBookingsCount: 0,
        message: `Error al sincronizar: ${error.message || 'Fallo de red'}`,
        syncedAt: new Date().toISOString()
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncService = new SyncService();
