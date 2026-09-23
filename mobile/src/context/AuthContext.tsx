// Contexto de sesión: guarda el usuario logueado en memoria (React state, no
// persistido entre reinicios de la app a propósito, para que el login sea
// siempre obligatorio) y resuelve login/registro tanto online como offline.
import React, { createContext, useContext, useState, useEffect } from 'react';
import { sqliteService, LocalUser } from '../database/sqliteService';
import { apiService } from '../services/apiService';
import { syncService } from '../services/syncService';

interface AuthContextType {
  user: LocalUser | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: { name: string; email: string; pass: string; role: 'admin' | 'cliente'; fitness_goal?: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  quickLogin: (role: 'admin' | 'cliente') => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      // Solo precalienta la base local; el login siempre debe ser explícito.
      await sqliteService.init();
    } catch (e) {
      console.error('Error inicializando auth:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Intenta login contra la API; si no hay conexión (o falla la petición), cae al
  // SQLite local. En ambos casos rechaza a los usuarios marcados como bloqueados.
  const login = async (email: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    const isOnline = await syncService.isOnline();

    try {
      if (isOnline) {
        // Intento login con la API
        const apiRes = await apiService.login(email, pass);
        const loggedUser: LocalUser = {
          id: apiRes.user.id,
          name: apiRes.user.name,
          email: apiRes.user.email,
          role: apiRes.user.role,
          fitness_goal: apiRes.user.fitness_goal,
          membership_status: apiRes.user.membership_status
        };
        // Persistir en SQLite local
        await sqliteService.saveUser(loggedUser);
        setUser(loggedUser);
        return { success: true };
      } else {
        // Modo offline: validar contra SQLite local
        const localUser = await sqliteService.getUser(email);
        if (localUser && localUser.is_blocked) {
          return { success: false, message: 'Tu cuenta fue bloqueada por el administrador.' };
        }
        if (localUser && localUser.password === pass) {
          setUser(localUser);
          return { success: true };
        } else if (localUser) {
          return { success: false, message: 'Contraseña incorrecta (modo offline)' };
        } else {
          return { success: false, message: 'Usuario no encontrado en SQLite local en modo offline' };
        }
      }
    } catch (err: any) {
      // Fallback a SQLite local si falló conexión
      const localUser = await sqliteService.getUser(email);
      if (localUser && localUser.is_blocked) {
        return { success: false, message: 'Tu cuenta fue bloqueada por el administrador.' };
      }
      if (localUser && localUser.password === pass) {
        setUser(localUser);
        return { success: true };
      }
      return { success: false, message: err.message || 'Error al iniciar sesión' };
    } finally {
      setIsLoading(false);
    }
  };

  // Crea la cuenta siempre en SQLite local primero (para poder loguearse ya mismo,
  // incluso offline), y la manda a la API o la encola según haya conexión.
  const register = async (data: { name: string; email: string; pass: string; role: 'admin' | 'cliente'; fitness_goal?: string }): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    const userId = `usr-${Date.now()}`;
    const newUser: LocalUser = {
      id: userId,
      name: data.name,
      email: data.email,
      password: data.pass,
      role: data.role,
      fitness_goal: data.fitness_goal || 'Acondicionamiento General',
      membership_status: 'ACTIVA'
    };

    const isOnline = await syncService.isOnline();

    try {
      // Guardar siempre en SQLite local
      await sqliteService.saveUser(newUser);

      // Enviar a la API si hay conexión; si no, encolar en sync_queue
      await syncService.syncOrQueue(isOnline, 'REGISTER_USER', 'user', newUser, () =>
        apiService.register({ ...newUser, password: data.pass })
      );

      setUser(newUser);
      return { success: true };
    } catch (err: any) {
      // Encolar si falló el envío online
      await sqliteService.enqueueAction('REGISTER_USER', 'user', newUser);
      setUser(newUser);
      return { success: true, message: 'Registrado localmente (sincronización pendiente)' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  // Botones de "acceso rápido" del Login: hacen un login real con las cuentas demo.
  const quickLogin = async (role: 'admin' | 'cliente') => {
    if (role === 'admin') {
      await login('admin@fitsync.com', 'admin123');
    } else {
      await login('cliente@fitsync.com', 'cliente123');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, quickLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
