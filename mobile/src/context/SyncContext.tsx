import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sqliteService } from '../database/sqliteService';
import { syncService, SyncStatusResult } from '../services/syncService';
import { apiService } from '../services/apiService';

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
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncStatusResult | null>(null);
  const [apiUrl, setApiUrlState] = useState<string>(apiService.getBaseUrl());

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await sqliteService.getPendingSyncCount();
      setPendingCount(count);
    } catch (e) {
      console.error('Error al consultar cola de sync:', e);
    }
  }, []);

  const checkConnectivity = useCallback(async () => {
    if (isOfflineMode) {
      setIsOnline(false);
      return;
    }
    const online = await apiService.checkHealth();
    setIsOnline(online);
  }, [isOfflineMode]);

  useEffect(() => {
    refreshPendingCount();
    checkConnectivity();

    const interval = setInterval(() => {
      checkConnectivity();
      refreshPendingCount();
    }, 5000);

    return () => clearInterval(interval);
  }, [checkConnectivity, refreshPendingCount]);

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

  const setApiUrl = (url: string) => {
    apiService.setBaseUrl(url);
    setApiUrlState(url);
    checkConnectivity();
  };

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
