const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'gym_server.db');
const db = new DatabaseSync(dbPath);

function initDatabase() {
  // Activar modo WAL para concurrencia
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Tabla Usuarios
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cliente',
      fitness_goal TEXT DEFAULT 'Acondicionamiento Físico',
      membership_status TEXT DEFAULT 'ACTIVA',
      created_at TEXT NOT NULL
    );
  `);

  // Tabla Clases del Gimnasio
  db.exec(`
    CREATE TABLE IF NOT EXISTS gym_classes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      instructor TEXT NOT NULL,
      schedule_time TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      room TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 15,
      booked_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'CONFIRMADA',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Tabla Reservas / Citas
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      class_title TEXT NOT NULL,
      schedule_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMADA',
      notes TEXT DEFAULT '',
      is_attended INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES gym_classes(id)
    );
  `);

  // Tabla Log de Sincronización
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  seedData();
}

function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    console.log('Sembrando datos iniciales en backend SQLite...');
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password, role, fitness_goal, membership_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    // Admin
    insertUser.run('usr-admin-01', 'Coach Carlos - Admin', 'admin@fitsync.com', 'admin123', 'admin', 'Supervisión y Gestión', 'VIP STAFF', now);
    // Cliente
    insertUser.run('usr-client-01', 'Juan Pérez - Aprendiz SENA', 'cliente@fitsync.com', 'cliente123', 'cliente', 'Ganancia Muscular y Fuerza', 'ACTIVA', now);
    insertUser.run('usr-client-02', 'Laura Gómez', 'laura@fitsync.com', 'laura123', 'cliente', 'Resistencia Cardiovascular', 'ACTIVA', now);

    // Clases
    const insertClass = db.prepare(`
      INSERT INTO gym_classes (id, title, instructor, schedule_time, day_of_week, room, capacity, booked_count, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertClass.run('cls-01', 'CrossFit WOD Pro', 'Coach Carlos', '07:00 AM - 08:00 AM', 'Lunes, Miércoles, Viernes', 'Zona Funcional Box', 15, 3, 'CONFIRMADA', now, now);
    insertClass.run('cls-02', 'Spinning Revolution', 'Instructora Mariana', '08:30 AM - 09:30 AM', 'Lunes a Viernes', 'Sala de Ciclo Indoor', 20, 5, 'CONFIRMADA', now, now);
    insertClass.run('cls-03', 'Boxeo & Acondicionamiento', 'Entrenador Miguel', '05:00 PM - 06:00 PM', 'Martes y Jueves', 'Ring & Sacos', 12, 2, 'CONFIRMADA', now, now);
    insertClass.run('cls-04', 'Yoga Flow & Movilidad', 'Maestra Sofía', '06:30 PM - 07:30 PM', 'Lunes y Miércoles', 'Sala Zen Studio', 18, 1, 'CONFIRMADA', now, now);
    insertClass.run('cls-05', 'Hiit Extremo & Quema Grasa', 'Coach Carlos', '07:30 PM - 08:30 PM', 'Martes, Jueves, Sábado', 'Zona Funcional Box', 16, 4, 'CONFIRMADA', now, now);

    // Reservas iniciales demo
    const insertBooking = db.prepare(`
      INSERT INTO bookings (id, user_id, class_id, user_name, user_email, class_title, schedule_time, status, notes, is_attended, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertBooking.run('bk-01', 'usr-client-01', 'cls-01', 'Juan Pérez - Aprendiz SENA', 'cliente@fitsync.com', 'CrossFit WOD Pro', '07:00 AM - 08:00 AM', 'CONFIRMADA', 'Primera sesión de la semana', 0, now, now);
    insertBooking.run('bk-02', 'usr-client-01', 'cls-04', 'Juan Pérez - Aprendiz SENA', 'cliente@fitsync.com', 'Yoga Flow & Movilidad', '06:30 PM - 07:30 PM', 'CONFIRMADA', 'Recuperación muscular', 0, now, now);
    insertBooking.run('bk-03', 'usr-client-02', 'cls-02', 'Laura Gómez', 'laura@fitsync.com', 'Spinning Revolution', '08:30 AM - 09:30 AM', 'CONFIRMADA', 'Cardio matutino', 1, now, now);

    console.log('Datos iniciales cargados con éxito.');
  }
}

module.exports = {
  db,
  initDatabase
};
