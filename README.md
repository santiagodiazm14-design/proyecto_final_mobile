# FitSync Gym - Proyecto Final (SENA)
**Sistema Móvil de Gestión de Gimnasio & Citas de Entrenamiento con Arquitectura Offline-First (SQLite), API Backend REST y Entregable APK**

---

## 📋 Resumen del Proyecto

Este proyecto cumple de forma integral con todos los requerimientos establecidos para el **Proyecto Final**:
- **Dominio Seleccionado**: Gimnasio (**FitSync Gym**).
- **Módulos Desarrollados**: Exactamente los **5 módulos principales** solicitados (Login, Registro, Agendar Citas/Clases, Gestión y Asistencia/Cancelación desde perfil Administrador, y Cancelación de citas desde perfil Usuario) más integración de Red y Sincronización en el encabezado.
- **Backend API REST**: Servidor en Node.js + Express con base de datos SQLite relacional y endpoints de sincronización (`/api/sync/push` y `/api/sync/pull`).
- **Persistencia Local Offline con SQLite**: Implementado con **`expo-sqlite`**, garantizando que el usuario puede registrarse, agendar citas y cancelarlas **sin internet**. Las acciones se encolan en la tabla local `sync_queue`.
- **Sincronización Bidireccional**: Al recuperar o activar la conexión a internet, el motor de sincronización sube las operaciones locales pendientes a la API y reconcilia el estado de la base de datos local con la del servidor.
- **Entregable APK**: Compilado nativamente para Android (`dist-apk/FitSync-Gimnasio.apk`) con soporte para arquitecturas `arm64-v8a`, `armeabi-v7a`, `x86` y `x86_64`.
- **Compatibilidad con Expo Go**: El proyecto puede ser ejecutado también mediante `npx expo start` escaneando el código QR en la aplicación **Expo Go** o en el emulador de Android.

---

## 📱 Las 5 Pantallas del Proyecto

| # | Módulo / Pantalla | Perfil de Usuario | Funcionalidades Principales |
|---|-------------------|-------------------|-----------------------------|
| **1** | **Login y Autenticación** | Todos | • Inicio de sesión con credenciales y validación.<br>• Botones de acceso rápido de 1-toque: **"Entrar como Admin"** y **"Entrar como Cliente"** para pruebas ágiles.<br>• Funciona online (validación con API) y offline (con SQLite local). |
| **2** | **Registro de Aprendiz / Cliente** | Cliente / Staff | • Registro con Nombre, Correo, Contraseña, Rol y Objetivo de Entrenamiento (Fuerza, Definición, Resistencia).<br>• Si no hay internet, guarda en SQLite local y encola en `sync_queue`. |
| **3** | **Agendar Citas / Clases** | Aprendiz / Cliente | • Catálogo de disciplinas: *CrossFit WOD Pro, Spinning Revolution, Boxeo, Yoga Flow, Hiit Extremo*.<br>• Visualización de cupos disponibles en tiempo real con barra de capacidad progresiva.<br>• Botón **"Agendar Esta Clase"**: descuenta cupo en SQLite local de inmediato sin bloquear al usuario. |
| **4** | **Gestión de Clases y Asistencia (Admin)** | Administrador | • **Pestaña 1 (Control de Clases)**: Botón para **Cancelar Clase** o **Reactivar Clase** como administrador.<br>• **Pestaña 2 (Asistencia y Check-In)**: Listado de aprendices inscritos con botón para confirmar asistencia (Check-In). |
| **5** | **Mis Citas y Cancelación de Cita** | Aprendiz / Cliente | • Historial de citas agendadas con badges de estado (*Confirmada, Cancelada por mí, Cancelada por Gimnasio, Asistida*).<br>• Botón **"Cancelar Esta Cita"**: despliega modal para registrar motivo (*Compromiso SENA, imprevisto laboral, molestia física*), liberando el cupo en SQLite local. |

---

## 🔄 Arquitectura Offline-First con SQLite & Sync

```
+-------------------------------------------------------------+
|                      APLICACIÓN MÓVIL                       |
|  [ Pantallas React Native / Expo Go / Android APK ]         |
+-------------------------------------------------------------+
                              |
               Lecturas y Escrituras Inmediatas
                              v
+-------------------------------------------------------------+
|               BASE DE DATOS SQLITE LOCAL                    |
|                      (expo-sqlite)                          |
|  • local_users     • local_classes     • local_bookings     |
|  • sync_queue (id, action, entity, payload, status)         |
+-------------------------------------------------------------+
                              |
         ¿Hay conexión a internet / Modo Online Activo?
               /                               \
        [ SÍ: ONLINE ]                   [ NO: OFFLINE ]
              |                                 |
    Motor de Sincronización            Acción se encola en
  envía transacciones pendientes      'sync_queue' en SQLite
    a POST /api/sync/push               con estado PENDING
              |
              v
+-------------------------------------------------------------+
|                     BACKEND API REST                        |
|                  (Node.js + Express)                        |
|  • /api/auth    • /api/classes    • /api/bookings           |
|  • /api/sync/push (aplica mutaciones con resolución)        |
|  • /api/sync/pull (entrega cambios frescos del servidor)   |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                 BASE DE DATOS SQLITE SERVIDOR               |
|                       (gym_server.db)                       |
+-------------------------------------------------------------+
```

---

## 🚀 Instrucciones de Ejecución

### 1. Iniciar el Backend API
Abre una terminal en `backend/`:
```bash
cd backend
npm install
npm start
```
El servidor quedará escuchando en `http://localhost:3000` (o la IP local del equipo).

### 2. Ejecutar la App Móvil con Expo Go
Abre una terminal en `mobile/`:
```bash
cd mobile
npx expo start
```
- **En tu teléfono celular**: Abre la app **Expo Go** (Android o iOS) y escanea el código QR mostrado en pantalla.
- **En Emulador Android**: Presiona la tecla `a`.
- **En Navegador Web**: Presiona la tecla `w` o ejecuta `npx expo start --web`.

---

## 📦 Entregable APK Compilado

El archivo APK ejecutable se encuentra listo para instalar en:
```
dist-apk/FitSync-Gimnasio.apk
```
- **Tamaño**: ~143 MB
- **Nombre de Paquete**: `com.fitsync.gym`
- **Etiqueta**: `FitSync Gym`
- **Instalación directa en teléfono o emulador Android**:
  ```bash
  adb install dist-apk/FitSync-Gimnasio.apk
  ```

---

## 🧪 Guía de Prueba para la Sustentación del Aprendiz

1. **Prueba de Autenticación (Módulo 1)**:
   - Inicia sesión presionando **"Entrar como Cliente"** o **"Entrar como Admin"**.
2. **Prueba de Agendar Cita (Módulo 3)**:
   - Entra como Cliente.
   - En la pantalla principal, presiona **"Agendar Esta Clase"** en cualquier clase (ej. *CrossFit WOD Pro*).
   - Observa cómo se reduce el cupo y aparece el aviso de confirmación.
3. **Prueba de Cancelación de Cita por el Usuario (Módulo 5)**:
   - Ve a la pestaña **"Mis Citas"**.
   - Presiona el botón rojo **"Cancelar Esta Cita"**.
   - Selecciona el motivo (ej. *Compromiso académico / SENA*) y confirma.
   - El estado cambia a *CANCELADA POR MÍ* y el cupo se libera.
4. **Prueba de Modo Offline (Requerimiento Clave)**:
   - En el encabezado superior, toca el botón **"ONLINE (tocar para alternar)"**.
   - Cambiará a **"MODO OFFLINE"** en color ámbar.
   - Agenda una clase o cancela una cita mientras estás en modo offline.
   - Observa que la app responde al instante en 0ms y el contador de SQLite muestra: **"1 en SQLite"**.
   - Toca nuevamente el botón para volver a **"ONLINE"** y presiona **"Sincronizar"**.
   - Verás cómo se envían las transacciones a la API y el contador vuelve a 0.
5. **Prueba de Gestión y Cancelación de Clases por el Administrador (Módulo 4)**:
   - Cierra sesión y entra presionando **"Entrar como Admin"**.
   - En la pestaña **"Gestión Admin"**, presiona **"Cancelar Clase (Admin)"** en alguna clase.
   - Cambia a la pestaña de **"Asistencia / Citas"** y presiona **"Marcar Asistencia"** (Check-In) en los alumnos inscritos.
