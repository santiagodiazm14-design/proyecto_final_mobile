const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Manejador seguro para JSON malformado
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON malformado recibido en la petición' });
  }
  next();
});

// Inicializar base de datos SQLite
initDatabase();

// Ruta absoluta al archivo APK compilado
const APK_PATH = path.resolve(__dirname, '../../dist-apk/FitSync-Gimnasio.apk');

// Servir la carpeta dist-apk estáticamente
app.use('/dist-apk', express.static(path.resolve(__dirname, '../../dist-apk')));
app.use('/apk', express.static(path.resolve(__dirname, '../../dist-apk')));

// Función para obtener la IP local de la máquina en la red
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('172.')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// 1. Health Check / Ping para verificar conectividad
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'FitSync Gym API',
    timestamp: new Date().toISOString()
  });
});

// Endpoint de Descarga Directa del APK
app.get('/download/apk', (req, res) => {
  if (fs.existsSync(APK_PATH)) {
    res.download(APK_PATH, 'FitSync-Gimnasio.apk', (err) => {
      if (err) {
        console.error('Error al transferir APK:', err);
        if (!res.headersSent) {
          res.status(500).send('Error al transferir el archivo APK');
        }
      }
    });
  } else {
    res.status(404).send('Archivo APK no encontrado en el servidor. Verifique la carpeta dist-apk.');
  }
});

// Página Web de Descarga con botón directo y Código QR para escanear desde el móvil
app.get(['/', '/descargar'], async (req, res) => {
  try {
    const localIp = getLocalIP();
    const portStr = PORT === 80 ? '' : `:${PORT}`;
    const directDownloadUrl = `http://${localIp}${portStr}/download/apk`;
    const qrDataUrl = await QRCode.toDataURL(directDownloadUrl, {
      width: 220,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FitSync Gym - Instalar APK</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(circle at top, #1e2640 0%, #0a0e1a 100%);
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      background: rgba(26, 34, 56, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(16px);
      border-radius: 24px;
      padding: 36px 28px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
    }
    .badge {
      display: inline-block;
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.4);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .icon {
      font-size: 52px;
      margin-bottom: 10px;
      display: inline-block;
      animation: pulse 2.2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.06); }
    }
    h1 {
      font-size: 1.85rem;
      font-weight: 800;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.desc {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .btn-download {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff;
      padding: 16px 24px;
      border-radius: 14px;
      font-size: 1.05rem;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.45);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-download:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(99, 102, 241, 0.65);
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
    }
    .meta {
      display: flex;
      justify-content: space-around;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      font-size: 0.82rem;
    }
    .meta strong { color: #f1f5f9; }
    .qr-section {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .qr-label {
      color: #cbd5e1;
      font-size: 0.88rem;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .qr-container {
      background: #ffffff;
      padding: 14px;
      border-radius: 16px;
      display: inline-block;
      box-shadow: 0 6px 18px rgba(0,0,0,0.35);
    }
    .qr-container img {
      width: 190px;
      height: 190px;
      display: block;
    }
    .qr-sub {
      color: #64748b;
      font-size: 0.78rem;
      margin-top: 8px;
    }
    .steps {
      text-align: left;
      margin-top: 22px;
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 16px 18px;
      font-size: 0.82rem;
      color: #cbd5e1;
    }
    .steps h3 {
      font-size: 0.88rem;
      color: #e2e8f0;
      margin-bottom: 8px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .steps ol {
      padding-left: 20px;
      line-height: 1.65;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">SENA - Proyecto Final</span>
    <div class="icon">🏋️</div>
    <h1>FitSync Gym</h1>
    <p class="desc">App Móvil de Gestión & Citas con Persistencia Offline en SQLite y Sincronización REST.</p>
    
    <a href="/download/apk" class="btn-download">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Descargar APK Android (136 MB)
    </a>

    <div class="meta">
      <div><span>Versión:</span> <strong>1.0.0</strong></div>
      <div><span>Paquete:</span> <strong>com.fitsync.gym</strong></div>
      <div><span>Tamaño:</span> <strong>136.4 MB</strong></div>
    </div>

    <div class="qr-section">
      <div class="qr-label">📱 O escanea con la cámara de tu teléfono:</div>
      <div class="qr-container">
        <img src="${qrDataUrl}" alt="Código QR para descargar APK" />
      </div>
      <div class="qr-sub">Conéctate a la misma red Wi-Fi para descargar directamente</div>
    </div>

    <div class="steps">
      <h3>📲 Pasos de Instalación en Android:</h3>
      <ol>
        <li>Descarga el archivo APK en tu teléfono celular.</li>
        <li>Abre la notificación de descarga o busca el archivo en <strong>Descargas</strong>.</li>
        <li>Si aparece la advertencia de seguridad, selecciona <strong>"Configuración"</strong> y activa <strong>"Permitir desde esta fuente"</strong>.</li>
        <li>Toca en <strong>"Instalar"</strong> y abre <strong>FitSync Gym</strong>.</li>
      </ol>
    </div>
  </div>
</body>
</html>`;
    res.send(html);
  } catch (err) {
    console.error('Error generando página de descarga:', err);
    res.status(500).send('Error generando la página de descarga');
  }
});

// 2. Módulo 1: Autenticación - Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const user = db.prepare('SELECT id, name, email, password, role, fitness_goal, membership_status FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // No retornar password
    const { password: _, ...userData } = user;
    res.json({
      message: 'Inicio de sesión exitoso',
      user: userData,
      token: `fitsync-token-${user.id}-${Date.now()}`
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error en el servidor al iniciar sesión' });
  }
});

// 3. Módulo 2: Registro de Usuario
app.post('/api/auth/register', (req, res) => {
  try {
    const { id, name, email, password, role = 'cliente', fitness_goal = 'Acondicionamiento General' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existing) {
      return res.status(409).json({ error: 'El correo ya se encuentra registrado' });
    }

    const userId = id || `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, password, role, fitness_goal, membership_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVA', ?)
    `).run(userId, name, email, password, role, fitness_goal, now);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: userId,
        name,
        email,
        role,
        fitness_goal,
        membership_status: 'ACTIVA'
      }
    });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno al registrar usuario' });
  }
});

// 4. Módulo 3: Clases del Gimnasio - Listar
app.get('/api/classes', (req, res) => {
  try {
    const classes = db.prepare(`
      SELECT 
        c.*, 
        (c.capacity - c.booked_count) as available_slots 
      FROM gym_classes c
      ORDER BY c.created_at ASC
    `).all();

    res.json(classes);
  } catch (err) {
    console.error('Error al listar clases:', err);
    res.status(500).json({ error: 'Error al consultar clases' });
  }
});

// Módulo 4: Crear Clase (Admin)
app.post('/api/classes', (req, res) => {
  try {
    const { id, title, instructor, schedule_time, day_of_week, room, capacity = 15 } = req.body;
    if (!title || !instructor || !schedule_time || !room) {
      return res.status(400).json({ error: 'Campos requeridos: título, instructor, horario y sala' });
    }

    const classId = id || `cls-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO gym_classes (id, title, instructor, schedule_time, day_of_week, room, capacity, booked_count, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'CONFIRMADA', ?, ?)
    `).run(classId, title, instructor, schedule_time, day_of_week || 'Lunes a Viernes', room, Number(capacity), now, now);

    const created = db.prepare('SELECT * FROM gym_classes WHERE id = ?').get(classId);
    res.status(201).json({ message: 'Clase creada exitosamente', class: created });
  } catch (err) {
    console.error('Error al crear clase:', err);
    res.status(500).json({ error: 'Error al crear la clase' });
  }
});

// Módulo 4: Cambiar estado de clase (Admin: CANCELAR o CONFIRMAR clase)
app.put('/api/classes/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'CANCELADA' o 'CONFIRMADA'
    if (!status) {
      return res.status(400).json({ error: 'El estado es requerido' });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE gym_classes 
      SET status = ?, updated_at = ? 
      WHERE id = ?
    `).run(status, now, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Si la clase fue cancelada por el gimnasio, actualizar reservas asociadas
    if (status === 'CANCELADA') {
      db.prepare(`
        UPDATE bookings 
        SET status = 'CANCELADA_POR_GIMNASIO', updated_at = ?
        WHERE class_id = ? AND status = 'CONFIRMADA'
      `).run(now, id);
    }

    res.json({ message: `Clase ${status.toLowerCase()} exitosamente`, id, status });
  } catch (err) {
    console.error('Error al cambiar estado de clase:', err);
    res.status(500).json({ error: 'Error al modificar estado de la clase' });
  }
});

// 5. Módulo 3 & 5: Reservas - Listar
app.get('/api/bookings', (req, res) => {
  try {
    const { user_id, class_id } = req.query;
    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }
    if (class_id) {
      query += ' AND class_id = ?';
      params.push(class_id);
    }

    query += ' ORDER BY created_at DESC';
    const bookings = db.prepare(query).all(...params);
    res.json(bookings);
  } catch (err) {
    console.error('Error al obtener reservas:', err);
    res.status(500).json({ error: 'Error al consultar reservas' });
  }
});

// Módulo 3: Agendar Cita / Reservar Clase (Cliente)
app.post('/api/bookings', (req, res) => {
  try {
    const { id, user_id, class_id, user_name, user_email, notes = '' } = req.body;
    if (!user_id || !class_id) {
      return res.status(400).json({ error: 'ID de usuario y de clase requeridos' });
    }

    // Verificar si la clase existe y tiene cupo
    const gymClass = db.prepare('SELECT * FROM gym_classes WHERE id = ?').get(class_id);
    if (!gymClass) {
      return res.status(404).json({ error: 'La clase no existe' });
    }
    if (gymClass.status === 'CANCELADA') {
      return res.status(400).json({ error: 'Esta clase fue cancelada por el gimnasio' });
    }
    if (gymClass.booked_count >= gymClass.capacity) {
      return res.status(400).json({ error: 'No hay cupos disponibles para esta clase' });
    }

    // Verificar reserva duplicada activa
    const existing = db.prepare(`
      SELECT id FROM bookings 
      WHERE user_id = ? AND class_id = ? AND status = 'CONFIRMADA'
    `).get(user_id, class_id);

    if (existing) {
      return res.status(409).json({ error: 'Ya tienes una reserva activa en esta clase' });
    }

    const bookingId = id || `bk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    // Insertar reserva
    db.prepare(`
      INSERT INTO bookings (id, user_id, class_id, user_name, user_email, class_title, schedule_time, status, notes, is_attended, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA', ?, 0, ?, ?)
    `).run(
      bookingId,
      user_id,
      class_id,
      user_name || 'Aprendiz FitSync',
      user_email || 'cliente@fitsync.com',
      gymClass.title,
      gymClass.schedule_time,
      notes,
      now,
      now
    );

    // Incrementar cupos ocupados
    db.prepare(`
      UPDATE gym_classes 
      SET booked_count = booked_count + 1, updated_at = ?
      WHERE id = ?
    `).run(now, class_id);

    const createdBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    res.status(201).json({
      message: '¡Reserva confirmada con éxito!',
      booking: createdBooking
    });
  } catch (err) {
    console.error('Error al agendar reserva:', err);
    res.status(500).json({ error: 'Error al procesar la reserva' });
  }
});

// Módulo 5: Cancelación de Cita / Reserva (Perfil Usuario)
app.put('/api/bookings/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelada por el usuario' } = req.body;

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (booking.status === 'CANCELADA') {
      return res.status(400).json({ error: 'La reserva ya se encontraba cancelada' });
    }

    const now = new Date().toISOString();

    // Actualizar estado de reserva
    db.prepare(`
      UPDATE bookings 
      SET status = 'CANCELADA', notes = ?, updated_at = ? 
      WHERE id = ?
    `).run(`Motivo: ${reason}`, now, id);

    // Decrementar conteo en clase
    db.prepare(`
      UPDATE gym_classes 
      SET booked_count = MAX(0, booked_count - 1), updated_at = ?
      WHERE id = ?
    `).run(now, booking.class_id);

    res.json({
      message: 'Reserva cancelada exitosamente',
      id,
      status: 'CANCELADA'
    });
  } catch (err) {
    console.error('Error al cancelar reserva:', err);
    res.status(500).json({ error: 'Error al cancelar la reserva' });
  }
});

// Módulo 4: Gestión de Asistencia / Check-In (Perfil Administrador)
app.put('/api/bookings/:id/checkin', (req, res) => {
  try {
    const { id } = req.params;
    const { attended = 1 } = req.body;

    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE bookings 
      SET is_attended = ?, updated_at = ? 
      WHERE id = ?
    `).run(attended ? 1 : 0, now, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    res.json({ message: 'Asistencia actualizada exitosamente', id, is_attended: attended });
  } catch (err) {
    console.error('Error al registrar asistencia:', err);
    res.status(500).json({ error: 'Error al actualizar asistencia' });
  }
});

// 6. MOTOR DE SINCRONIZACIÓN OFFLINE-FIRST: PUSH & PULL

// POST /api/sync/push: Procesa operaciones generadas en el dispositivo móvil mientras estaba offline
app.post('/api/sync/push', (req, res) => {
  try {
    const { mutations, clientId = 'mobile-app' } = req.body;
    if (!Array.isArray(mutations)) {
      return res.status(400).json({ error: 'Mutaciones debe ser un array' });
    }

    const results = [];
    const now = new Date().toISOString();

    for (const item of mutations) {
      const { id: queueId, action, entity, payload } = item;
      try {
        switch (action) {
          case 'BOOK_CLASS': {
            const { id, user_id, class_id, user_name, user_email, notes } = payload;
            const gymClass = db.prepare('SELECT * FROM gym_classes WHERE id = ?').get(class_id);
            if (gymClass) {
              // Si no existe ya la reserva
              const exists = db.prepare('SELECT id FROM bookings WHERE id = ?').get(id);
              if (!exists) {
                db.prepare(`
                  INSERT INTO bookings (id, user_id, class_id, user_name, user_email, class_title, schedule_time, status, notes, is_attended, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA', ?, 0, ?, ?)
                `).run(id, user_id, class_id, user_name || 'Aprendiz', user_email || '', gymClass.title, gymClass.schedule_time, notes || '', now, now);

                db.prepare('UPDATE gym_classes SET booked_count = booked_count + 1, updated_at = ? WHERE id = ?').run(now, class_id);
              }
            }
            results.push({ queueId, status: 'SUCCESS' });
            break;
          }

          case 'CANCEL_BOOKING': {
            const { bookingId, reason } = payload;
            const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
            if (booking && booking.status !== 'CANCELADA') {
              db.prepare('UPDATE bookings SET status = "CANCELADA", notes = ?, updated_at = ? WHERE id = ?')
                .run(`Motivo: ${reason || 'Cancelación offline'}`, now, bookingId);
              db.prepare('UPDATE gym_classes SET booked_count = MAX(0, booked_count - 1), updated_at = ? WHERE id = ?')
                .run(now, booking.class_id);
            }
            results.push({ queueId, status: 'SUCCESS' });
            break;
          }

          case 'ADMIN_UPDATE_CLASS': {
            const { classId, status } = payload;
            db.prepare('UPDATE gym_classes SET status = ?, updated_at = ? WHERE id = ?').run(status, now, classId);
            if (status === 'CANCELADA') {
              db.prepare('UPDATE bookings SET status = "CANCELADA_POR_GIMNASIO", updated_at = ? WHERE class_id = ? AND status = "CONFIRMADA"')
                .run(now, classId);
            }
            results.push({ queueId, status: 'SUCCESS' });
            break;
          }

          case 'ADMIN_CHECKIN': {
            const { bookingId, attended } = payload;
            db.prepare('UPDATE bookings SET is_attended = ?, updated_at = ? WHERE id = ?').run(attended ? 1 : 0, now, bookingId);
            results.push({ queueId, status: 'SUCCESS' });
            break;
          }

          case 'REGISTER_USER': {
            const { id, name, email, password, role, fitness_goal } = payload;
            const exists = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
            if (!exists) {
              db.prepare(`
                INSERT INTO users (id, name, email, password, role, fitness_goal, membership_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVA', ?)
              `).run(id, name, email, password, role || 'cliente', fitness_goal || '', now);
            }
            results.push({ queueId, status: 'SUCCESS' });
            break;
          }

          default:
            results.push({ queueId, status: 'IGNORED', message: `Acción desconocida: ${action}` });
        }

        // Registrar en log de sincronización
        db.prepare(`
          INSERT INTO sync_log (id, client_id, action, entity, entity_id, payload, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'APPLIED', ?)
        `).run(`log-${Date.now()}-${Math.floor(Math.random() * 1000)}`, clientId, action, entity || 'unknown', queueId, JSON.stringify(payload), now);

      } catch (mutationErr) {
        console.error(`Error procesando mutación ${action}:`, mutationErr);
        results.push({ queueId, status: 'ERROR', error: mutationErr.message });
      }
    }

    res.json({
      message: 'Sincronización push procesada',
      processedCount: results.length,
      results,
      syncedAt: now
    });
  } catch (err) {
    console.error('Error en sync push:', err);
    res.status(500).json({ error: 'Fallo al procesar la sincronización de subida' });
  }
});

// GET /api/sync/pull: Devuelve el estado actual de los datos del servidor para que el cliente actualice su SQLite local
app.get('/api/sync/pull', (req, res) => {
  try {
    const { user_id } = req.query;

    const classes = db.prepare(`
      SELECT c.*, (c.capacity - c.booked_count) as available_slots 
      FROM gym_classes c 
      ORDER BY c.created_at ASC
    `).all();

    let bookingsQuery = 'SELECT * FROM bookings';
    const params = [];
    if (user_id) {
      bookingsQuery += ' WHERE user_id = ?';
      params.push(user_id);
    }
    bookingsQuery += ' ORDER BY created_at DESC';

    const bookings = db.prepare(bookingsQuery).all(...params);

    res.json({
      timestamp: new Date().toISOString(),
      classes,
      bookings
    });
  } catch (err) {
    console.error('Error en sync pull:', err);
    res.status(500).json({ error: 'Fallo al sincronizar datos remotos' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`  FitSync Gym Backend API Activa 🏋️`);
  console.log(`  Puerto: ${PORT}`);
  console.log(`  Endpoints listos en http://localhost:${PORT}`);
  console.log(`=========================================`);
});
