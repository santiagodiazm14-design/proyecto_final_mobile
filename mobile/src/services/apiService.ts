import { Platform } from 'react-native';

class ApiService {
  private baseUrl: string = '';

  constructor() {
    // Configuración automática de la IP del backend según la plataforma
    if (Platform.OS === 'web') {
      this.baseUrl = 'http://localhost:3000/api';
    } else if (Platform.OS === 'android') {
      // 10.0.2.2 para emulador Android, o IP local 10.15.10.39 para dispositivo físico Expo Go
      this.baseUrl = 'http://10.0.2.2:3000/api';
    } else {
      this.baseUrl = 'http://10.15.10.39:3000/api';
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  // Ping / Health Check
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  // Auth: Login
  async login(email: string, password: string) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    return data;
  }

  // Auth: Register
  async register(userData: { id?: string; name: string; email: string; password: string; role?: string; fitness_goal?: string }) {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar usuario');
    return data;
  }

  // Classes: Get All
  async getClasses() {
    const res = await fetch(`${this.baseUrl}/classes`);
    const data = await res.json();
    if (!res.ok) throw new Error('Error al cargar clases remotas');
    return data;
  }

  // Classes: Update Status (Admin)
  async updateClassStatus(classId: string, status: 'CONFIRMADA' | 'CANCELADA') {
    const res = await fetch(`${this.baseUrl}/classes/${classId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar clase');
    return data;
  }

  // Bookings: Create
  async createBooking(bookingData: { id: string; user_id: string; class_id: string; user_name: string; user_email: string; notes?: string }) {
    const res = await fetch(`${this.baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear reserva');
    return data;
  }

  // Bookings: Cancel
  async cancelBooking(bookingId: string, reason: string) {
    const res = await fetch(`${this.baseUrl}/bookings/${bookingId}/cancel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cancelar reserva');
    return data;
  }

  // Bookings: Checkin (Admin)
  async checkinBooking(bookingId: string, attended: boolean) {
    const res = await fetch(`${this.baseUrl}/bookings/${bookingId}/checkin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attended: attended ? 1 : 0 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar asistencia');
    return data;
  }

  // Sync: Push Mutations
  async pushSync(mutations: any[]) {
    const res = await fetch(`${this.baseUrl}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mutations, clientId: 'fitsync-mobile-client' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en sync push');
    return data;
  }

  // Sync: Pull Fresh Data
  async pullSync(userId?: string) {
    const url = userId ? `${this.baseUrl}/sync/pull?user_id=${userId}` : `${this.baseUrl}/sync/pull`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en sync pull');
    return data;
  }
}

export const apiService = new ApiService();
