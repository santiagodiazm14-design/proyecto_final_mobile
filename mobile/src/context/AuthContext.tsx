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
      await sqliteService.init();
      // Por defecto sesión demo de aprendiz para agilidad
      const defaultUser = await sqliteService.getUser('cliente@fitsync.com');
      if (defaultUser) {
        setUser(defaultUser);
      }
    } catch (e) {
      console.error('Error inicializando auth:', e);
    } finally {
      setIsLoading(false);
    }
  };

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
      if (localUser && localUser.password === pass) {
        setUser(localUser);
        return { success: true };
      }
      return { success: false, message: err.message || 'Error al iniciar sesión' };
    } finally {
      setIsLoading(false);
    }
  };

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

      if (isOnline) {
        // Si está online, enviar directo a la API
        await apiService.register({
          id: userId,
          name: data.name,
          email: data.email,
          password: data.pass,
          role: data.role,
          fitness_goal: data.fitness_goal
        });
      } else {
        // Si está offline, encolar en SQLite sync_queue
        await sqliteService.enqueueAction('REGISTER_USER', 'user', {
          id: userId,
          name: data.name,
          email: data.email,
          password: data.pass,
          role: data.role,
          fitness_goal: data.fitness_goal
        });
      }

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
