// Capa de persistencia offline-first del celular: envuelve expo-sqlite (con
// fallback a localStorage cuando corre en navegador web) y expone el CRUD de
// clases/reservas/usuarios más la cola `sync_queue` que usa syncService para
// subir al backend lo que se hizo sin conexión.
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

// Espejo local de la tabla `gym_classes` del servidor.
export interface LocalClass {
  id: string;
  title: string;
  instructor: string;
  schedule_time: string;
  day_of_week: string;
  room: string;
  capacity: number;
  booked_count: number;
  status: string;
  updated_at: string;
}

// Espejo local de la tabla `bookings` del servidor.
export interface LocalBooking {
  id: string;
  user_id: string;
  class_id: string;
  user_name: string;
  user_email: string;
  class_title: string;
  schedule_time: string;
  status: string;
  notes: string;
  is_attended: number;
  updated_at: string;
}

// Una mutación hecha offline, pendiente de aplicarse contra la API cuando vuelva la conexión.
export interface SyncQueueItem {
  id: string;
  action: 'BOOK_CLASS' | 'CANCEL_BOOKING' | 'ADMIN_UPDATE_CLASS' | 'ADMIN_CHECKIN' | 'REGISTER_USER' | 'ADMIN_BLOCK_USER';
  entity: string;
  payload: any;
  created_at: string;
  status: 'PENDING' | 'SYNCED' | 'ERROR';
}

// Espejo local de la tabla `users` del servidor (sin exponer la contraseña salvo cache propia).
export interface LocalUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'cliente';
  fitness_goal: string;
  membership_status: string;
  is_blocked?: number;
}

// Singleton exportado al final del archivo como `sqliteService`; toda la app
// comparte esta única instancia para no abrir varias conexiones a la misma DB.
class SQLiteDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private queue: Promise<any> = Promise.resolve();

  // Fallback en memoria / almacenamiento web si se ejecuta en browser
  private webStorage: {
    classes: LocalClass[];
    bookings: LocalBooking[];
    queue: SyncQueueItem[];
    users: LocalUser[];
  } = {
    classes: [],
    bookings: [],
    queue: [],
    users: []
  };

  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Evita que llamadas concurrentes (AuthContext, SyncContext, cada pantalla al montar)
    // abran/creen el esquema de la base de datos en paralelo, lo que en Android puede
    // provocar "NativeDatabase.prepareAsync ... NullPointerException" por doble apertura
    // de la misma conexión SQLite. Todas comparten la misma promesa de inicialización.
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  // Serializa TODO el acceso a la base de datos nativa: expo-sqlite en Android puede
  // corromper el puente nativo (NativeDatabase.prepareAsync -> NullPointerException) si
  // dos consultas quedan "en vuelo" al mismo tiempo sobre la misma conexión, algo que
  // pasa fácil acá porque varias pantallas/contexts consultan SQLite en paralelo.
  // Referencia: https://github.com/expo/expo/issues/28176
  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn, fn);
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async doInit(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        this.db = await SQLite.openDatabaseAsync('fitsync_local.db');

        await this.db.execAsync(`
          PRAGMA journal_mode = WAL;

          CREATE TABLE IF NOT EXISTS local_users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT,
            role TEXT NOT NULL DEFAULT 'cliente',
            fitness_goal TEXT,
            membership_status TEXT DEFAULT 'ACTIVA',
            is_blocked INTEGER NOT NULL DEFAULT 0
          );

          CREATE TABLE IF NOT EXISTS local_classes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            instructor TEXT NOT NULL,
            schedule_time TEXT NOT NULL,
            day_of_week TEXT NOT NULL,
            room TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            booked_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'CONFIRMADA',
            updated_at TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS local_bookings (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            class_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            user_email TEXT NOT NULL,
            class_title TEXT NOT NULL,
            schedule_time TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'CONFIRMADA',
            notes TEXT,
            is_attended INTEGER DEFAULT 0,
            updated_at TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            entity TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING'
          );
        `);

        // Migración: agregar columna is_blocked si la instalación ya existía sin ella
        try {
          await this.db.execAsync('ALTER TABLE local_users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0;');
        } catch (_) {
          // La columna ya existe, no hacer nada
        }

        // Sembrar datos iniciales si está vacío
        const classRows = await this.db.getAllAsync<any>('SELECT COUNT(*) as count FROM local_classes');
        if (classRows && classRows[0]?.count === 0) {
          await this.seedInitialData();
        }
      } else {
        // En Web: inicializar desde localStorage o datos por defecto
        this.loadWebStorage();
        if (this.webStorage.classes.length === 0) {
          this.seedWebData();
        }
      }

      this.isInitialized = true;
      console.log('Base de datos SQLite local inicializada con éxito.');
    } catch (error) {
      console.error('Error inicializando SQLite local:', error);
      // Fallback a webStorage si falló sqlite nativo
      this.loadWebStorage();
      if (this.webStorage.classes.length === 0) {
        this.seedWebData();
      }
      this.isInitialized = true;
    }
  }

  // --- Seed Data ---
  private async seedInitialData() {
    if (!this.db) return;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT OR REPLACE INTO local_users (id, name, email, password, role, fitness_goal, membership_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['usr-admin-01', 'Coach Carlos - Admin', 'admin@fitsync.com', 'admin123', 'admin', 'Supervisión y Gestión', 'VIP STAFF']
    );

    await this.db.runAsync(
      `INSERT OR REPLACE INTO local_users (id, name, email, password, role, fitness_goal, membership_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['usr-client-01', 'Juan Pérez - Aprendiz SENA', 'cliente@fitsync.com', 'cliente123', 'cliente', 'Ganancia Muscular y Fuerza', 'ACTIVA']
    );

    const initialClasses = [
      ['cls-01', 'CrossFit WOD Pro', 'Coach Carlos', '07:00 AM - 08:00 AM', 'Lunes, Miércoles, Viernes', 'Zona Funcional Box', 15, 3, 'CONFIRMADA', now],
      ['cls-02', 'Spinning Revolution', 'Instructora Mariana', '08:30 AM - 09:30 AM', 'Lunes a Viernes', 'Sala de Ciclo Indoor', 20, 5, 'CONFIRMADA', now],
      ['cls-03', 'Boxeo & Acondicionamiento', 'Entrenador Miguel', '05:00 PM - 06:00 PM', 'Martes y Jueves', 'Ring & Sacos', 12, 2, 'CONFIRMADA', now],
      ['cls-04', 'Yoga Flow & Movilidad', 'Maestra Sofía', '06:30 PM - 07:30 PM', 'Lunes y Miércoles', 'Sala Zen Studio', 18, 1, 'CONFIRMADA', now],
      ['cls-05', 'Hiit Extremo & Quema Grasa', 'Coach Carlos', '07:30 PM - 08:30 PM', 'Martes, Jueves, Sábado', 'Zona Funcional Box', 16, 4, 'CONFIRMADA', now],
    ];

    for (const c of initialClasses) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO local_classes (id, title, instructor, schedule_time, day_of_week, room, capacity, booked_count, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c as any
      );
    }

    const initialBookings = [
      ['bk-01', 'usr-client-01', 'cls-01', 'Juan Pérez - Aprendiz SENA', 'cliente@fitsync.com', 'CrossFit WOD Pro', '07:00 AM - 08:00 AM', 'CONFIRMADA', 'Primera sesión de la semana', 0, now],
      ['bk-02', 'usr-client-01', 'cls-04', 'Juan Pérez - Aprendiz SENA', 'cliente@fitsync.com', 'Yoga Flow & Movilidad', '06:30 PM - 07:30 PM', 'CONFIRMADA', 'Recuperación muscular', 0, now],
    ];

    for (const b of initialBookings) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO local_bookings (id, user_id, class_id, user_name, user_email, class_title, schedule_time, status, notes, is_attended, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        b as any
      );
    }
  }

  // --- Web / LocalStorage Fallback Helper ---
  private loadWebStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem('fitsync_gym_db');
        if (data) {
          this.webStorage = JSON.parse(data);
        }
      }
    } catch (_) {}
  }

  private persistWebStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('fitsync_gym_db', JSON.stringify(this.webStorage));
      }
    } catch (_) {}
  }

  private seedWebData() {
    const now = new Date().toISOString();
    this.webStorage.users = [
      { id: 'usr-admin-01', name: 'Coach Carlos - Admin', email: 'admin@fitsync.com', password: 'admin123', role: 'admin', fitness_goal: 'Supervisión y Gestión', membership_status: 'VIP STAFF', is_blocked: 0 },
      { id: 'usr-client-01', name: 'Juan Pérez - Aprendiz SENA', email: 'cliente@fitsync.com', password: 'cliente123', role: 'cliente', fitness_goal: 'Ganancia Muscular y Fuerza', membership_status: 'ACTIVA', is_blocked: 0 },
    ];
    this.webStorage.classes = [
      { id: 'cls-01', title: 'CrossFit WOD Pro', instructor: 'Coach Carlos', schedule_time: '07:00 AM - 08:00 AM', day_of_week: 'Lunes, Miércoles, Viernes', room: 'Zona Funcional Box', capacity: 15, booked_count: 3, status: 'CONFIRMADA', updated_at: now },
      { id: 'cls-02', title: 'Spinning Revolution', instructor: 'Instructora Mariana', schedule_time: '08:30 AM - 09:30 AM', day_of_week: 'Lunes a Viernes', room: 'Sala de Ciclo Indoor', capacity: 20, booked_count: 5, status: 'CONFIRMADA', updated_at: now },
      { id: 'cls-03', title: 'Boxeo & Acondicionamiento', instructor: 'Entrenador Miguel', schedule_time: '05:00 PM - 06:00 PM', day_of_week: 'Martes y Jueves', room: 'Ring & Sacos', capacity: 12, booked_count: 2, status: 'CONFIRMADA', updated_at: now },
      { id: 'cls-04', title: 'Yoga Flow & Movilidad', instructor: 'Maestra Sofía', schedule_time: '06:30 PM - 07:30 PM', day_of_week: 'Lunes y Miércoles', room: 'Sala Zen Studio', capacity: 18, booked_count: 1, status: 'CONFIRMADA', updated_at: now },
      { id: 'cls-05', title: 'Hiit Extremo & Quema Grasa', instructor: 'Coach Carlos', schedule_time: '07:30 PM - 08:30 PM', day_of_week: 'Martes, Jueves, Sábado', room: 'Zona Funcional Box', capacity: 16, booked_count: 4, status: 'CONFIRMADA', updated_at: now },
    ];
    this.webStorage.bookings = [
      { id: 'bk-01', user_id: 'usr-client-01', class_id: 'cls-01', user_name: 'Juan Pérez - Aprendiz SENA', user_email: 'cliente@fitsync.com', class_title: 'CrossFit WOD Pro', schedule_time: '07:00 AM - 08:00 AM', status: 'CONFIRMADA', notes: 'Primera sesión de la semana', is_attended: 0, updated_at: now },
      { id: 'bk-02', user_id: 'usr-client-01', class_id: 'cls-04', user_name: 'Juan Pérez - Aprendiz SENA', user_email: 'cliente@fitsync.com', class_title: 'Yoga Flow & Movilidad', schedule_time: '06:30 PM - 07:30 PM', status: 'CONFIRMADA', notes: 'Recuperación muscular', is_attended: 0, updated_at: now },
    ];
    this.persistWebStorage();
  }

  // ===================== CRUD DE CLASES =====================
  // Todas las clases guardadas localmente (lectura offline-first para ClassesScreen/AdminManageScreen).
  async getClasses(): Promise<LocalClass[]> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        return await this.db.getAllAsync<LocalClass>('SELECT * FROM local_classes ORDER BY id ASC');
      }
      return this.webStorage.classes;
    });
  }

  // Cancela/reactiva una clase (acción de Admin); si se cancela, arrastra la
  // cancelación a las reservas activas de esa clase (queda como CANCELADA_POR_GIMNASIO).
  async updateClassStatus(classId: string, status: 'CONFIRMADA' | 'CANCELADA'): Promise<void> {
    await this.init();
    return this.runExclusive(async () => {
      const now = new Date().toISOString();

      if (this.db) {
        await this.db.runAsync('UPDATE local_classes SET status = ?, updated_at = ? WHERE id = ?', [status, now, classId]);
        if (status === 'CANCELADA') {
          await this.db.runAsync("UPDATE local_bookings SET status = 'CANCELADA_POR_GIMNASIO', updated_at = ? WHERE class_id = ? AND status = 'CONFIRMADA'", [now, classId]);
        }
      } else {
        const cls = this.webStorage.classes.find(c => c.id === classId);
        if (cls) {
          cls.status = status;
          cls.updated_at = now;
        }
        if (status === 'CANCELADA') {
          this.webStorage.bookings.forEach(b => {
            if (b.class_id === classId && b.status === 'CONFIRMADA') {
              b.status = 'CANCELADA_POR_GIMNASIO';
              b.updated_at = now;
            }
          });
        }
        this.persistWebStorage();
      }
    });
  }

  // ===================== CRUD DE RESERVAS =====================
  // Reservas locales; si se pasa userId, solo las de ese usuario (Mis Citas), si no, todas (Admin).
  async getBookings(userId?: string): Promise<LocalBooking[]> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        if (userId) {
          return await this.db.getAllAsync<LocalBooking>('SELECT * FROM local_bookings WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
        }
        return await this.db.getAllAsync<LocalBooking>('SELECT * FROM local_bookings ORDER BY updated_at DESC');
      }

      if (userId) {
        return this.webStorage.bookings.filter(b => b.user_id === userId);
      }
      return this.webStorage.bookings;
    });
  }

  // Crea la reserva localmente y descuenta el cupo de la clase, al instante y sin esperar red.
  async createBooking(booking: Omit<LocalBooking, 'updated_at'>): Promise<LocalBooking> {
    await this.init();
    return this.runExclusive(async () => {
      const now = new Date().toISOString();
      const newBooking: LocalBooking = {
        ...booking,
        updated_at: now,
      };

      if (this.db) {
        await this.db.runAsync(
          `INSERT INTO local_bookings (id, user_id, class_id, user_name, user_email, class_title, schedule_time, status, notes, is_attended, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newBooking.id, newBooking.user_id, newBooking.class_id, newBooking.user_name, newBooking.user_email, newBooking.class_title, newBooking.schedule_time, newBooking.status, newBooking.notes, newBooking.is_attended, now]
        );
        await this.db.runAsync(
          'UPDATE local_classes SET booked_count = booked_count + 1, updated_at = ? WHERE id = ?',
          [now, newBooking.class_id]
        );
      } else {
        this.webStorage.bookings.unshift(newBooking);
        const cls = this.webStorage.classes.find(c => c.id === newBooking.class_id);
        if (cls) {
          cls.booked_count += 1;
          cls.updated_at = now;
        }
        this.persistWebStorage();
      }

      return newBooking;
    });
  }

  // Cancela la reserva localmente y libera el cupo de la clase (usado tanto por el cliente como por el admin).
  async cancelBooking(bookingId: string, reason: string = 'Cancelada por el aprendiz'): Promise<void> {
    await this.init();
    return this.runExclusive(async () => {
      const now = new Date().toISOString();

      if (this.db) {
        const b = await this.db.getFirstAsync<LocalBooking>('SELECT * FROM local_bookings WHERE id = ?', [bookingId]);
        if (b) {
          await this.db.runAsync(
            "UPDATE local_bookings SET status = 'CANCELADA', notes = ?, updated_at = ? WHERE id = ?",
            [`Motivo: ${reason}`, now, bookingId]
          );
          await this.db.runAsync(
            'UPDATE local_classes SET booked_count = MAX(0, booked_count - 1), updated_at = ? WHERE id = ?',
            [now, b.class_id]
          );
        }
      } else {
        const b = this.webStorage.bookings.find(item => item.id === bookingId);
        if (b) {
          b.status = 'CANCELADA';
          b.notes = `Motivo: ${reason}`;
          b.updated_at = now;

          const cls = this.webStorage.classes.find(c => c.id === b.class_id);
          if (cls) {
            cls.booked_count = Math.max(0, cls.booked_count - 1);
            cls.updated_at = now;
          }
          this.persistWebStorage();
        }
      }
    });
  }

  // Marca (o desmarca) la asistencia de un aprendiz a su clase (Admin, pestaña de check-in).
  async checkinBooking(bookingId: string, attended: boolean = true): Promise<void> {
    await this.init();
    return this.runExclusive(async () => {
      const now = new Date().toISOString();
      const flag = attended ? 1 : 0;

      if (this.db) {
        await this.db.runAsync('UPDATE local_bookings SET is_attended = ?, updated_at = ? WHERE id = ?', [flag, now, bookingId]);
      } else {
        const b = this.webStorage.bookings.find(item => item.id === bookingId);
        if (b) {
          b.is_attended = flag;
          b.updated_at = now;
          this.persistWebStorage();
        }
      }
    });
  }

  // ===================== COLA DE SINCRONIZACIÓN (SYNC_QUEUE) =====================
  // Encola una mutación (offline, o que falló contra la API) para reintentarla en el próximo sync.
  async enqueueAction(action: SyncQueueItem['action'], entity: string, payload: any): Promise<SyncQueueItem> {
    await this.init();
    return this.runExclusive(async () => {
      const item: SyncQueueItem = {
        id: `sync-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        action,
        entity,
        payload,
        created_at: new Date().toISOString(),
        status: 'PENDING'
      };

      if (this.db) {
        await this.db.runAsync(
          'INSERT INTO sync_queue (id, action, entity, payload, created_at, status) VALUES (?, ?, ?, ?, ?, ?)',
          [item.id, item.action, item.entity, JSON.stringify(item.payload), item.created_at, item.status]
        );
      } else {
        this.webStorage.queue.push(item);
        this.persistWebStorage();
      }

      return item;
    });
  }

  // Cuántas mutaciones siguen pendientes de subir (el contador "N en SQLite" del header).
  async getPendingSyncCount(): Promise<number> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        const row = await this.db.getFirstAsync<any>("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'PENDING'");
        return row ? row.count : 0;
      }
      return this.webStorage.queue.filter(q => q.status === 'PENDING').length;
    });
  }

  // Trae las mutaciones pendientes en orden de creación, para que syncService las envíe al backend.
  async getPendingQueue(): Promise<SyncQueueItem[]> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        const rows = await this.db.getAllAsync<any>("SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY created_at ASC");
        return rows.map(r => ({
          ...r,
          payload: JSON.parse(r.payload)
        }));
      }
      return this.webStorage.queue.filter(q => q.status === 'PENDING');
    });
  }

  // Saca una mutación de la cola una vez que el backend confirmó que la aplicó con éxito.
  async markQueueItemSynced(queueId: string): Promise<void> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [queueId]);
      } else {
        this.webStorage.queue = this.webStorage.queue.filter(q => q.id !== queueId);
        this.persistWebStorage();
      }
    });
  }

  // ===================== RECONCILIACIÓN DESDE API (PULL SYNC) =====================
  // Sobrescribe/inserta en SQLite local lo último que trajo el `pull` del servidor
  // (clases, reservas y usuarios), para que el dispositivo quede al día tras sincronizar.
  async applyRemoteSync(classes: LocalClass[], bookings: LocalBooking[], users: LocalUser[] = []): Promise<void> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        // Reconciliar clases
        for (const cls of classes) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO local_classes (id, title, instructor, schedule_time, day_of_week, room, capacity, booked_count, status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [cls.id, cls.title, cls.instructor, cls.schedule_time, cls.day_of_week, cls.room, cls.capacity, cls.booked_count, cls.status, cls.updated_at]
          );
        }

        // Reconciliar reservas
        for (const bk of bookings) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO local_bookings (id, user_id, class_id, user_name, user_email, class_title, schedule_time, status, notes, is_attended, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bk.id, bk.user_id, bk.class_id, bk.user_name, bk.user_email, bk.class_title, bk.schedule_time, bk.status, bk.notes || '', bk.is_attended ? 1 : 0, bk.updated_at]
          );
        }

        // Reconciliar directorio de usuarios (sin tocar la contraseña cacheada localmente)
        for (const u of users) {
          await this.upsertUserDirectory(u);
        }
      } else {
        this.webStorage.classes = classes;
        this.webStorage.bookings = bookings;
        if (users.length > 0) {
          for (const u of users) {
            const idx = this.webStorage.users.findIndex(existing => existing.id === u.id);
            if (idx >= 0) {
              this.webStorage.users[idx] = { ...this.webStorage.users[idx], ...u, password: this.webStorage.users[idx].password };
            } else {
              this.webStorage.users.push(u);
            }
          }
        }
        this.persistWebStorage();
      }
    });
  }

  // ===================== USUARIOS LOCALES =====================
  // Guarda/actualiza la cuenta con la que se hizo login (incluye password, para poder
  // validar credenciales sin conexión la próxima vez).
  async saveUser(user: LocalUser): Promise<void> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO local_users (id, name, email, password, role, fitness_goal, membership_status, is_blocked)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [user.id, user.name, user.email, user.password || '', user.role, user.fitness_goal, user.membership_status, user.is_blocked ? 1 : 0]
        );
      } else {
        const idx = this.webStorage.users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
        if (idx >= 0) {
          this.webStorage.users[idx] = user;
        } else {
          this.webStorage.users.push(user);
        }
        this.persistWebStorage();
      }
    });
  }

  // Busca un usuario por correo en la cache local; es la base del login offline.
  async getUser(email: string): Promise<LocalUser | null> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        const row = await this.db.getFirstAsync<LocalUser>('SELECT * FROM local_users WHERE LOWER(email) = LOWER(?)', [email]);
        return row || null;
      }
      return this.webStorage.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    });
  }

  // Lista de usuarios para el panel de administración (offline-first)
  async getAllUsers(role?: string): Promise<LocalUser[]> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        if (role) {
          return await this.db.getAllAsync<LocalUser>('SELECT * FROM local_users WHERE role = ? ORDER BY name ASC', [role]);
        }
        return await this.db.getAllAsync<LocalUser>('SELECT * FROM local_users ORDER BY name ASC');
      }
      if (role) {
        return this.webStorage.users.filter(u => u.role === role);
      }
      return this.webStorage.users;
    });
  }

  // Bloquear / Desbloquear un usuario (acción de Admin)
  async setUserBlocked(userId: string, blocked: boolean): Promise<void> {
    await this.init();
    return this.runExclusive(async () => {
      if (this.db) {
        await this.db.runAsync('UPDATE local_users SET is_blocked = ? WHERE id = ?', [blocked ? 1 : 0, userId]);
      } else {
        const u = this.webStorage.users.find(item => item.id === userId);
        if (u) {
          u.is_blocked = blocked ? 1 : 0;
          this.persistWebStorage();
        }
      }
    });
  }

  // Reconciliar datos de usuario venidos del servidor sin sobreescribir la contraseña cacheada localmente
  private async upsertUserDirectory(user: LocalUser): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT INTO local_users (id, name, email, password, role, fitness_goal, membership_status, is_blocked)
       VALUES (?, ?, ?, '', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         email = excluded.email,
         role = excluded.role,
         fitness_goal = excluded.fitness_goal,
         membership_status = excluded.membership_status,
         is_blocked = excluded.is_blocked`,
      [user.id, user.name, user.email, user.role, user.fitness_goal, user.membership_status, user.is_blocked ? 1 : 0]
    );
  }
}

export const sqliteService = new SQLiteDatabaseService();
