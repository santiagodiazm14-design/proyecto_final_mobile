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

  async isOnline(): Promise<boolean> {
    if (this.isSimulatedOffline) return false;
    return await apiService.checkHealth();
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

        // Si fue exitoso, limpiar o marcar como sincronizadas
        for (const item of pendingQueue) {
          await sqliteService.markQueueItemSynced(item.id);
          pushedCount++;
        }
      }

      // 2. PULL: Traer datos frescos del servidor
      const pullResult = await apiService.pullSync(userId);
      if (pullResult && pullResult.classes) {
        await sqliteService.applyRemoteSync(pullResult.classes, pullResult.bookings || []);
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
