// Contexto de conectividad/sincronización: expone si hay red (real o "modo
// offline" simulado desde el Header), cuántas mutaciones quedan pendientes, y
// dispara la sincronización manual o automáticamente cuando se recupera la conexión.
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { sqliteService } from '../database/sqliteService';
import { syncService, SyncStatusResult } from '../services/syncService';
import { apiService } from '../services/apiService';
import { useAuth } from './AuthContext';

interface SyncContextType {
  isOfflineMode: boolean;
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncStatusResult | null;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  toggleOfflineMode: () => void;
  triggerSync: (userId?: string) => Promise<SyncStatusResult>;
  refreshPendingCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({} as SyncContextType);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncStatusResult | null>(null);
  const [apiUrl, setApiUrlState] = useState<string>(apiService.getBaseUrl());

  // Relee cuántas mutaciones siguen en sync_queue, para el badge "N en SQLite".
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await sqliteService.getPendingSyncCount();
      setPendingCount(count);
    } catch (e) {
      console.error('Error al consultar cola de sync:', e);
    }
  }, []);

  // Si el usuario activó "Modo Offline" a mano, siempre reporta desconectado;
  // si no, hace un ping real al backend (`/api/health`).
  const checkConnectivity = useCallback(async () => {
    if (isOfflineMode) {
      setIsOnline(false);
      return;
    }
    const online = await apiService.checkHealth();
    setIsOnline(online);
  }, [isOfflineMode]);

  // Al montar, y cada 5s mientras la app esté abierta, refresca conectividad y
  // el contador de pendientes (así el header/perfil quedan siempre al día).
  useEffect(() => {
    refreshPendingCount();
    checkConnectivity();

    const interval = setInterval(() => {
      checkConnectivity();
      refreshPendingCount();
    }, 5000);

    return () => clearInterval(interval);
  }, [checkConnectivity, refreshPendingCount]);

  // Botón "MODO OFFLINE / ONLINE" del Header: fuerza el estado desconectado
  // aunque haya red real, para poder demostrar el flujo offline-first.
  const toggleOfflineMode = () => {
    const nextMode = !isOfflineMode;
    setIsOfflineMode(nextMode);
    syncService.setSimulatedOffline(nextMode);
    if (nextMode) {
      setIsOnline(false);
    } else {
      checkConnectivity();
    }
  };

  // Permite apuntar manualmente a otra IP/puerto de backend (modal de configuración del Header).
  const setApiUrl = (url: string) => {
    apiService.setBaseUrl(url);
    setApiUrlState(url);
    checkConnectivity();
  };

  // Dispara un ciclo push+pull completo (botón "Sincronizar" del Header/Perfil,
  // y también el auto-sync al reconectar más abajo).
  const triggerSync = async (userId?: string): Promise<SyncStatusResult> => {
    setIsSyncing(true);
    try {
      const result = await syncService.syncBidirectional(userId);
      setLastSyncResult(result);
      await refreshPendingCount();
      await checkConnectivity();
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  // Sincronización automática al recuperar la conexión: guarda el valor anterior
  // de isOnline en un ref (no dispara re-render) y, solo cuando pasa de false a
  // true, lanza triggerSync — así no sincroniza en el primer render ni cada vez
  // que el polling de arriba confirma que sigue online.
  const wasOnlineRef = useRef<boolean | null>(null);
  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (wasOnline === false && isOnline === true && user && !isSyncing) {
      triggerSync(user.id);
    }
  }, [isOnline, user]);

  return (
    <SyncContext.Provider
      value={{
        isOfflineMode,
        isOnline,
        pendingCount,
        isSyncing,
        lastSyncResult,
        apiUrl,
        setApiUrl,
        toggleOfflineMode,
        triggerSync,
        refreshPendingCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
