import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

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

export interface SyncQueueItem {
  id: string;
  action: 'BOOK_CLASS' | 'CANCEL_BOOKING' | 'ADMIN_UPDATE_CLASS' | 'ADMIN_CHECKIN' | 'REGISTER_USER';
  entity: string;
  payload: any;
  created_at: string;
  status: 'PENDING' | 'SYNCED' | 'ERROR';
}

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'cliente';
  fitness_goal: string;
  membership_status: string;
}

class SQLiteDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;

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
            membership_status TEXT DEFAULT 'ACTIVA'
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
      { id: 'usr-admin-01', name: 'Coach Carlos - Admin', email: 'admin@fitsync.com', password: 'admin123', role: 'admin', fitness_goal: 'Supervisión y Gestión', membership_status: 'VIP STAFF' },
      { id: 'usr-client-01', name: 'Juan Pérez - Aprendiz SENA', email: 'cliente@fitsync.com', password: 'cliente123', role: 'cliente', fitness_goal: 'Ganancia Muscular y Fuerza', membership_status: 'ACTIVA' },
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
  async getClasses(): Promise<LocalClass[]> {
    await this.init();
    if (this.db) {
      return await this.db.getAllAsync<LocalClass>('SELECT * FROM local_classes ORDER BY id ASC');
    }
    return this.webStorage.classes;
  }

  async updateClassStatus(classId: string, status: 'CONFIRMADA' | 'CANCELADA'): Promise<void> {
    await this.init();
    const now = new Date().toISOString();

    if (this.db) {
      await this.db.runAsync('UPDATE local_classes SET status = ?, updated_at = ? WHERE id = ?', [status, now, classId]);
      if (status === 'CANCELADA') {
        await this.db.runAsync('UPDATE local_bookings SET status = "CANCELADA_POR_GIMNASIO", updated_at = ? WHERE class_id = ? AND status = "CONFIRMADA"', [now, classId]);
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
  }

  // ===================== CRUD DE RESERVAS =====================
  async getBookings(userId?: string): Promise<LocalBooking[]> {
    await this.init();
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
  }

  async createBooking(booking: Omit<LocalBooking, 'updated_at'>): Promise<LocalBooking> {
    await this.init();
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
  }

  async cancelBooking(bookingId: string, reason: string = 'Cancelada por el aprendiz'): Promise<void> {
    await this.init();
    const now = new Date().toISOString();

    if (this.db) {
      const b = await this.db.getFirstAsync<LocalBooking>('SELECT * FROM local_bookings WHERE id = ?', [bookingId]);
      if (b) {
        await this.db.runAsync(
          'UPDATE local_bookings SET status = "CANCELADA", notes = ?, updated_at = ? WHERE id = ?',
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
  }

  async checkinBooking(bookingId: string, attended: boolean = true): Promise<void> {
    await this.init();
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
  }

  // ===================== COLA DE SINCRONIZACIÓN (SYNC_QUEUE) =====================
  async enqueueAction(action: SyncQueueItem['action'], entity: string, payload: any): Promise<SyncQueueItem> {
    await this.init();
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
  }

  async getPendingSyncCount(): Promise<number> {
    await this.init();
    if (this.db) {
      const row = await this.db.getFirstAsync<any>('SELECT COUNT(*) as count FROM sync_queue WHERE status = "PENDING"');
      return row ? row.count : 0;
    }
    return this.webStorage.queue.filter(q => q.status === 'PENDING').length;
  }

  async getPendingQueue(): Promise<SyncQueueItem[]> {
    await this.init();
    if (this.db) {
      const rows = await this.db.getAllAsync<any>('SELECT * FROM sync_queue WHERE status = "PENDING" ORDER BY created_at ASC');
      return rows.map(r => ({
        ...r,
        payload: JSON.parse(r.payload)
      }));
    }
    return this.webStorage.queue.filter(q => q.status === 'PENDING');
  }

  async markQueueItemSynced(queueId: string): Promise<void> {
    await this.init();
    if (this.db) {
      await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [queueId]);
    } else {
      this.webStorage.queue = this.webStorage.queue.filter(q => q.id !== queueId);
      this.persistWebStorage();
    }
  }

  // ===================== RECONCILIACIÓN DESDE API (PULL SYNC) =====================
  async applyRemoteSync(classes: LocalClass[], bookings: LocalBooking[]): Promise<void> {
    await this.init();

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
    } else {
      this.webStorage.classes = classes;
      this.webStorage.bookings = bookings;
      this.persistWebStorage();
    }
  }

  // ===================== USUARIOS LOCALES =====================
  async saveUser(user: LocalUser): Promise<void> {
    await this.init();
    if (this.db) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO local_users (id, name, email, password, role, fitness_goal, membership_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.id, user.name, user.email, user.password || '', user.role, user.fitness_goal, user.membership_status]
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
  }

  async getUser(email: string): Promise<LocalUser | null> {
    await this.init();
    if (this.db) {
      const row = await this.db.getFirstAsync<LocalUser>('SELECT * FROM local_users WHERE LOWER(email) = LOWER(?)', [email]);
      return row || null;
    }
    return this.webStorage.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }
}

export const sqliteService = new SQLiteDatabaseService();
