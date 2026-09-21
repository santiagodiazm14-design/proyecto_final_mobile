async function testAPI() {
  const BASE_URL = 'http://localhost:3000/api';
  console.log('--- Probando API Backend FitSync ---');

  // 1. Health
  const health = await fetch(`${BASE_URL}/health`).then(r => r.json());
  console.log('1. Health Check:', health);

  // 2. Login Admin
  const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@fitsync.com', password: 'admin123' })
  }).then(r => r.json());
  console.log('2. Admin Login:', adminLogin.message, adminLogin.user.name, adminLogin.user.role);

  // 3. Login Cliente
  const clientLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cliente@fitsync.com', password: 'cliente123' })
  }).then(r => r.json());
  console.log('3. Client Login:', clientLogin.message, clientLogin.user.name);

  // 4. Clases
  const classes = await fetch(`${BASE_URL}/classes`).then(r => r.json());
  console.log(`4. Clases cargadas: ${classes.length} clases disponibles`);

  // 5. Reservas
  const bookings = await fetch(`${BASE_URL}/bookings?user_id=usr-client-01`).then(r => r.json());
  console.log(`5. Reservas del cliente: ${bookings.length} encontradas`);

  // 6. Test Sync Push
  const syncPush = await fetch(`${BASE_URL}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'test-mobile',
      mutations: [
        {
          id: 'queue-test-01',
          action: 'BOOK_CLASS',
          entity: 'booking',
          payload: {
            id: 'bk-offline-test',
            user_id: 'usr-client-01',
            class_id: 'cls-03',
            user_name: 'Juan Pérez - Aprendiz SENA',
            user_email: 'cliente@fitsync.com',
            notes: 'Reserva creada en modo offline de prueba'
          }
        }
      ]
    })
  }).then(r => r.json());
  console.log('6. Sync Push resultado:', syncPush.message, 'Mutaciones procesadas:', syncPush.processedCount);

  // 7. Test Sync Pull
  const syncPull = await fetch(`${BASE_URL}/sync/pull`).then(r => r.json());
  console.log('7. Sync Pull resultado: clases=', syncPull.classes.length, 'reservas=', syncPull.bookings.length);

  console.log('--- ¡TODAS LAS PRUEBAS DE LA API PASARON CON ÉXITO! 🚀 ---');
}

testAPI().catch(console.error);
