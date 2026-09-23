import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { sqliteService, LocalClass } from '../database/sqliteService';
import { apiService } from '../services/apiService';
import { syncService } from '../services/syncService';

interface ClassesScreenProps {
  onGoToMyBookings: () => void;
}

// Catálogo de clases y agendamiento (Módulo 3): lista las clases con su cupo
// disponible y permite reservar al instante, online u offline.
export const ClassesScreen: React.FC<ClassesScreenProps> = ({ onGoToMyBookings }) => {
  const { user } = useAuth();
  const { isOnline, refreshPendingCount } = useSync();

  const [classes, setClasses] = useState<LocalClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingClassId, setBookingClassId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string>('');

  // Muestra primero lo que ya hay en SQLite (instantáneo) y, si hay red, lo
  // refresca en segundo plano con lo último del servidor.
  const loadClasses = useCallback(async () => {
    try {
      // Siempre cargar primero desde la base de datos local SQLite
      const localData = await sqliteService.getClasses();
      setClasses(localData);

      // Si está online, consultar si hay cambios frescos en background
      if (isOnline) {
        try {
          const remoteData = await apiService.getClasses();
          if (remoteData && remoteData.length > 0) {
            setClasses(remoteData);
            await sqliteService.applyRemoteSync(remoteData, []);
          }
        } catch (_) {}
      }
    } catch (err) {
      console.error('Error cargando clases:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const onRefresh = () => {
    setRefreshing(true);
    loadClasses();
  };

  // Valida cupo/duplicados contra los datos locales, crea la reserva en SQLite
  // de inmediato y la sincroniza (o encola) según haya conexión.
  const handleBookClass = async (gymClass: LocalClass) => {
    if (!user) return;
    setBookingClassId(gymClass.id);
    setActionNotice('');

    try {
      // 1. Validar si la clase está cancelada
      if (gymClass.status === 'CANCELADA') {
        Alert.alert('Clase Cancelada', 'Esta clase fue cancelada por la administración del gimnasio.');
        setBookingClassId(null);
        return;
      }

      // 2. Validar cupos disponibles
      const available = gymClass.capacity - gymClass.booked_count;
      if (available <= 0) {
        Alert.alert('Sin Cupos', 'Lo sentimos, todos los cupos de esta sesión ya están reservados.');
        setBookingClassId(null);
        return;
      }

      // 3. Validar si ya tiene reserva previa en SQLite
      const currentBookings = await sqliteService.getBookings(user.id);
      const alreadyBooked = currentBookings.find(b => b.class_id === gymClass.id && b.status === 'CONFIRMADA');
      if (alreadyBooked) {
        Alert.alert('Ya estás inscrito', 'Ya tienes una reserva confirmada para esta clase.');
        setBookingClassId(null);
        return;
      }

      // 4. Crear reserva local en SQLite
      const bookingId = `bk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newBooking = {
        id: bookingId,
        user_id: user.id,
        class_id: gymClass.id,
        user_name: user.name,
        user_email: user.email,
        class_title: gymClass.title,
        schedule_time: gymClass.schedule_time,
        status: 'CONFIRMADA',
        notes: 'Reserva agendada por aprendiz',
        is_attended: 0
      };

      await sqliteService.createBooking(newBooking);

      // 5. Sincronizar o encolar según conectividad
      const synced = await syncService.syncOrQueue(isOnline, 'BOOK_CLASS', 'booking', newBooking, () => apiService.createBooking(newBooking));
      setActionNotice(
        synced
          ? `¡Reserva confirmada en ${gymClass.title}! (Sincronizada con el servidor)`
          : isOnline
            ? `¡Reserva guardada en SQLite local! (Se sincronizará al reconectar)`
            : `¡Reserva agendada OFFLINE! Guardada en SQLite local.`
      );

      await refreshPendingCount();
      await loadClasses();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo completar la reserva.');
    } finally {
      setBookingClassId(null);
    }
  };

  const filteredClasses = classes.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.instructor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.room.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getClassIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('crossfit') || t.includes('wod')) return 'weight-lifter';
    if (t.includes('spinning') || t.includes('ciclo')) return 'bike';
    if (t.includes('box')) return 'boxing-glove';
    if (t.includes('yoga') || t.includes('zen')) return 'meditation';
    return 'fire';
  };

  return (
    <View style={styles.container}>
      {/* Barra de Búsqueda y Título */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.screenTitle}>Agendar Clases & Sesiones</Text>
          <Text style={styles.screenSubtitle}>Reserva tu cupo de entrenamiento semanal</Text>
        </View>

        <TouchableOpacity style={styles.viewMyBookingsBtn} onPress={onGoToMyBookings}>
          <MaterialCommunityIcons name="calendar-clock" size={16} color={colors.primary} />
          <Text style={styles.viewMyBookingsText}>Mis Citas</Text>
        </TouchableOpacity>
      </View>

      {/* Notificación de Acción */}
      {actionNotice ? (
        <View style={styles.noticeBox}>
          <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
          <Text style={styles.noticeText}>{actionNotice}</Text>
          <TouchableOpacity onPress={() => setActionNotice('')}>
            <MaterialCommunityIcons name="close" size={16} color={colors.textSubtle} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Buscador */}
      <View style={styles.searchBarContainer}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.textSubtle} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar clase, instructor o sala..."
          placeholderTextColor={colors.textSubtle}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={16} color={colors.textSubtle} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando catálogo desde SQLite...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClasses}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const availableSlots = Math.max(0, item.capacity - item.booked_count);
            const isFull = availableSlots <= 0;
            const isCancelled = item.status === 'CANCELADA';
            const progressPercent = Math.min(100, Math.round((item.booked_count / item.capacity) * 100));

            return (
              <View style={[styles.classCard, isCancelled && styles.classCardCancelled]}>
                {/* Header de la Tarjeta */}
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <View style={styles.iconBadge}>
                      <MaterialCommunityIcons name={getClassIcon(item.title) as any} size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.classTitle}>{item.title}</Text>
                      <Text style={styles.instructorText}>Instructor: <Text style={styles.boldText}>{item.instructor}</Text></Text>
                    </View>
                  </View>

                  <View style={[styles.statusBadge, isCancelled ? styles.statusBadgeCancelled : styles.statusBadgeActive]}>
                    <Text style={[styles.statusBadgeText, { color: isCancelled ? colors.danger : colors.success }]}>
                      {isCancelled ? 'CANCELADA' : 'DISPONIBLE'}
                    </Text>
                  </View>
                </View>

                {/* Detalles: Horario y Sala */}
                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.detailText}>{item.schedule_time}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.detailText}>{item.room}</Text>
                  </View>
                </View>

                <View style={styles.daysBadge}>
                  <MaterialCommunityIcons name="calendar-sync" size={13} color={colors.secondary} />
                  <Text style={styles.daysText}>{item.day_of_week}</Text>
                </View>

                {/* Barra de Cupos Disponibles */}
                <View style={styles.slotsSection}>
                  <View style={styles.slotsHeader}>
                    <Text style={styles.slotsLabel}>Cupos Disponibles:</Text>
                    <Text style={[styles.slotsCount, isFull && styles.slotsFull]}>
                      {isFull ? '¡AGOTADO!' : `${availableSlots} de ${item.capacity} cupos libres`}
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: isFull ? colors.danger : progressPercent > 75 ? colors.accent : colors.primary
                        }
                      ]}
                    />
                  </View>
                </View>

                {/* Botón de Agendar */}
                <TouchableOpacity
                  style={[
                    styles.bookButton,
                    (isFull || isCancelled || bookingClassId === item.id) && styles.bookButtonDisabled
                  ]}
                  disabled={isFull || isCancelled || bookingClassId === item.id}
                  onPress={() => handleBookClass(item)}
                >
                  {bookingClassId === item.id ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={isCancelled ? 'cancel' : isFull ? 'account-lock' : 'calendar-check'}
                        size={17}
                        color={colors.white}
                      />
                      <Text style={styles.bookButtonText}>
                        {isCancelled ? 'Sesión Cancelada' : isFull ? 'Cupos Llenos' : 'Agendar Esta Clase'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clipboard-text-off-outline" size={40} color={colors.textSubtle} />
              <Text style={styles.emptyText}>No se encontraron clases con ese filtro.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  screenSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  viewMyBookingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  viewMyBookingsText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.successLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.success,
  },
  noticeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 24,
  },
  classCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  classCardCancelled: {
    opacity: 0.7,
    borderColor: colors.danger,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  instructorText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  boldText: {
    color: colors.text,
    fontWeight: '700',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: colors.successLight,
  },
  statusBadgeCancelled: {
    backgroundColor: colors.dangerLight,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondaryLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  daysText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  slotsSection: {
    marginBottom: 14,
  },
  slotsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  slotsLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  slotsCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  slotsFull: {
    color: colors.danger,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  bookButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bookButtonDisabled: {
    backgroundColor: colors.surfaceLight,
    opacity: 0.6,
  },
  bookButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
