import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { sqliteService, LocalClass, LocalBooking, LocalUser } from '../database/sqliteService';
import { apiService } from '../services/apiService';
import { syncService } from '../services/syncService';

// Panel de Administrador (Módulo 4): tres pestañas — control de clases
// (cancelar/reactivar), asistencia/citas (check-in + cancelación puntual de una
// reserva) y usuarios (bloquear/desbloquear clientes).
export const AdminManageScreen: React.FC = () => {
  const { user } = useAuth();
  const { isOnline, refreshPendingCount } = useSync();

  const [activeTab, setActiveTab] = useState<'CLASSES' | 'BOOKINGS' | 'USERS'>('CLASSES');
  const [classes, setClasses] = useState<LocalClass[]>([]);
  const [bookings, setBookings] = useState<LocalBooking[]>([]);
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Carga las 3 listas desde SQLite (offline-first); si hay red, las refresca con
  // el servidor y reconcilia el directorio de usuarios en la cache local.
  const loadData = useCallback(async () => {
    try {
      const localClasses = await sqliteService.getClasses();
      const localBookings = await sqliteService.getBookings(); // all bookings for admin
      const localUsers = await sqliteService.getAllUsers('cliente');
      setClasses(localClasses);
      setBookings(localBookings);
      setUsers(localUsers);

      if (isOnline) {
        try {
          const remoteClasses = await apiService.getClasses();
          const remoteSync = await apiService.pullSync();
          if (remoteClasses) setClasses(remoteClasses);
          if (remoteSync?.bookings) setBookings(remoteSync.bookings);
          if (remoteSync?.users) {
            await sqliteService.applyRemoteSync(remoteSync.classes || remoteClasses || [], remoteSync.bookings || [], remoteSync.users);
            const refreshedUsers = await sqliteService.getAllUsers('cliente');
            setUsers(refreshedUsers);
          }
        } catch (_) {}
      }
    } catch (err) {
      console.error('Error cargando datos admin:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Pide confirmación con un modal de 2 botones y ejecuta la acción admin (con estado de procesando + refresco de datos)
  const confirmAndRun = (
    id: string,
    title: string,
    message: string,
    confirmText: string,
    destructive: boolean,
    run: () => Promise<void>
  ) => {
    Alert.alert(title, message, [
      { text: 'Volver', style: 'cancel' },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: async () => {
          setProcessingId(id);
          try {
            await run();
            await refreshPendingCount();
            await loadData();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setProcessingId(null);
          }
        }
      }
    ]);
  };

  // Administrador: Cancelar o Confirmar Clase del Gimnasio
  const handleToggleClassStatus = (gymClass: LocalClass) => {
    const nextStatus = gymClass.status === 'CONFIRMADA' ? 'CANCELADA' : 'CONFIRMADA';
    const actionText = nextStatus === 'CANCELADA' ? 'cancelar' : 'confirmar y reactivar';

    confirmAndRun(
      gymClass.id,
      'Confirmar acción',
      `¿Deseas ${actionText} la sesión "${gymClass.title}"?`,
      'Sí, aplicar',
      nextStatus === 'CANCELADA',
      async () => {
        await sqliteService.updateClassStatus(gymClass.id, nextStatus);
        await syncService.syncOrQueue(isOnline, 'ADMIN_UPDATE_CLASS', 'class', { classId: gymClass.id, status: nextStatus }, () =>
          apiService.updateClassStatus(gymClass.id, nextStatus)
        );
        Alert.alert('Éxito', `La clase ha sido ${nextStatus.toLowerCase()} exitosamente.`);
      }
    );
  };

  // Administrador: Marcar Asistencia / Check-In del Aprendiz
  const handleToggleCheckin = async (booking: LocalBooking) => {
    const nextAttended = booking.is_attended ? 0 : 1;
    setProcessingId(booking.id);
    try {
      await sqliteService.checkinBooking(booking.id, nextAttended === 1);
      await syncService.syncOrQueue(
        isOnline,
        'ADMIN_CHECKIN',
        'booking',
        { bookingId: booking.id, attended: nextAttended === 1 },
        () => apiService.checkinBooking(booking.id, nextAttended === 1)
      );
      await refreshPendingCount();
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Administrador: Cancelar una Cita puntual (sin cancelar toda la clase)
  const handleAdminCancelBooking = (booking: LocalBooking) => {
    confirmAndRun(
      booking.id,
      'Cancelar Cita',
      `¿Deseas cancelar la reserva de ${booking.user_name} en "${booking.class_title}"?`,
      'Sí, cancelar',
      true,
      async () => {
        const reason = 'Cancelada por administración';
        await sqliteService.cancelBooking(booking.id, reason);
        await syncService.syncOrQueue(isOnline, 'CANCEL_BOOKING', 'booking', { bookingId: booking.id, reason }, () =>
          apiService.cancelBooking(booking.id, reason)
        );
        Alert.alert('Éxito', 'La cita ha sido cancelada exitosamente.');
      }
    );
  };

  // Administrador: Bloquear / Desbloquear Usuario Cliente
  const handleToggleUserBlock = (targetUser: LocalUser) => {
    const nextBlocked = !targetUser.is_blocked;
    const actionText = nextBlocked ? 'bloquear' : 'desbloquear';

    confirmAndRun(
      targetUser.id,
      'Confirmar acción',
      `¿Deseas ${actionText} a ${targetUser.name}?`,
      'Sí, aplicar',
      nextBlocked,
      async () => {
        await sqliteService.setUserBlocked(targetUser.id, nextBlocked);
        await syncService.syncOrQueue(isOnline, 'ADMIN_BLOCK_USER', 'user', { userId: targetUser.id, blocked: nextBlocked }, () =>
          apiService.updateUserBlock(targetUser.id, nextBlocked)
        );
        Alert.alert('Éxito', `Usuario ${nextBlocked ? 'bloqueado' : 'desbloqueado'} exitosamente.`);
      }
    );
  };

  return (
    <View style={styles.container}>
      {/* Header del Panel Admin */}
      <View style={styles.adminHeader}>
        <View>
          <Text style={styles.screenTitle}>Gestión Administrativa</Text>
          <Text style={styles.screenSubtitle}>Control de clases, cancelaciones y asistencia</Text>
        </View>
        <View style={styles.adminBadge}>
          <MaterialCommunityIcons name="shield-crown" size={14} color={colors.secondary} />
          <Text style={styles.adminBadgeText}>MODO STAFF</Text>
        </View>
      </View>

      {/* Selector de Pestañas */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'CLASSES' && styles.tabButtonActive]}
          onPress={() => setActiveTab('CLASSES')}
        >
          <MaterialCommunityIcons
            name="calendar-edit"
            size={16}
            color={activeTab === 'CLASSES' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'CLASSES' && styles.tabTextActive]}>
            Clases del Gym ({classes.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'BOOKINGS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('BOOKINGS')}
        >
          <MaterialCommunityIcons
            name="account-check"
            size={16}
            color={activeTab === 'BOOKINGS' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'BOOKINGS' && styles.tabTextActive]}>
            Asistencia / Citas ({bookings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'USERS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('USERS')}
        >
          <MaterialCommunityIcons
            name="account-lock"
            size={16}
            color={activeTab === 'USERS' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'USERS' && styles.tabTextActive]}>
            Usuarios ({users.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando registros desde SQLite...</Text>
        </View>
      ) : activeTab === 'CLASSES' ? (
        /* Pestaña 1: Control de Clases */
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isCancelled = item.status === 'CANCELADA';
            const isProcessing = processingId === item.id;

            return (
              <View style={[styles.adminCard, isCancelled && styles.adminCardCancelled]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardInstructor}>Instructor: {item.instructor} • {item.room}</Text>
                  </View>
                  <View style={[styles.statusPill, isCancelled ? styles.statusPillDanger : styles.statusPillSuccess]}>
                    <Text style={[styles.statusPillText, { color: isCancelled ? colors.danger : colors.success }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>Horario: {item.schedule_time}</Text>
                  <Text style={styles.metaText}>Inscritos: {item.booked_count} / {item.capacity}</Text>
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      isCancelled ? styles.btnReactivate : styles.btnCancelClass
                    ]}
                    onPress={() => handleToggleClassStatus(item)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name={isCancelled ? 'check-decagram' : 'close-octagon-outline'}
                          size={16}
                          color={colors.white}
                        />
                        <Text style={styles.actionBtnText}>
                          {isCancelled ? 'Reactivar Clase' : 'Cancelar Clase (Admin)'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      ) : activeTab === 'BOOKINGS' ? (
        /* Pestaña 2: Control de Citas y Asistencia */
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isAttended = item.is_attended === 1;
            const isCancelled = item.status === 'CANCELADA' || item.status === 'CANCELADA_POR_GIMNASIO';
            const isProcessing = processingId === item.id;

            return (
              <View style={styles.bookingAdminCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userNameText}>{item.user_name}</Text>
                    <Text style={styles.userEmailText}>{item.user_email}</Text>
                    <Text style={styles.bookedClassText}>{item.class_title} • {item.schedule_time}</Text>
                  </View>
                  <View style={[styles.statusPill, isCancelled ? styles.statusPillDanger : styles.statusPillSuccess]}>
                    <Text style={[styles.statusPillText, { color: isCancelled ? colors.danger : colors.success }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                {!isCancelled && (
                  <View style={styles.attendanceRow}>
                    <View style={styles.attendanceStatus}>
                      <MaterialCommunityIcons
                        name={isAttended ? 'checkbox-marked-circle' : 'clock-alert-outline'}
                        size={16}
                        color={isAttended ? colors.success : colors.accent}
                      />
                      <Text style={[styles.attendanceText, { color: isAttended ? colors.success : colors.accent }]}>
                        {isAttended ? 'Asistencia Confirmada' : 'Pendiente de Asistir'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.checkinBtn,
                        isAttended ? styles.checkinBtnActive : styles.checkinBtnPending
                      ]}
                      onPress={() => handleToggleCheckin(item)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name={isAttended ? 'account-check' : 'account-clock'}
                            size={14}
                            color={colors.white}
                          />
                          <Text style={styles.checkinBtnText}>
                            {isAttended ? 'Quitar Check-In' : 'Marcar Asistencia'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {!isCancelled && (
                  <View style={styles.cancelBookingRow}>
                    <TouchableOpacity
                      style={styles.cancelBookingBtn}
                      onPress={() => handleAdminCancelBooking(item)}
                      disabled={isProcessing}
                    >
                      <MaterialCommunityIcons name="close-circle-outline" size={14} color={colors.danger} />
                      <Text style={styles.cancelBookingBtnText}>Cancelar Cita (Admin)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="calendar-blank" size={36} color={colors.textSubtle} />
              <Text style={styles.emptyText}>No hay reservas registradas en el sistema.</Text>
            </View>
          }
        />
      ) : (
        /* Pestaña 3: Bloqueo de Usuarios */
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isBlocked = !!item.is_blocked;
            const isProcessing = processingId === item.id;

            return (
              <View style={[styles.bookingAdminCard, isBlocked && styles.adminCardCancelled]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userNameText}>{item.name}</Text>
                    <Text style={styles.userEmailText}>{item.email}</Text>
                    <Text style={styles.bookedClassText}>{item.fitness_goal || 'Sin objetivo definido'}</Text>
                  </View>
                  <View style={[styles.statusPill, isBlocked ? styles.statusPillDanger : styles.statusPillSuccess]}>
                    <Text style={[styles.statusPillText, { color: isBlocked ? colors.danger : colors.success }]}>
                      {isBlocked ? 'BLOQUEADO' : 'ACTIVO'}
                    </Text>
                  </View>
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      isBlocked ? styles.btnReactivate : styles.btnCancelClass
                    ]}
                    onPress={() => handleToggleUserBlock(item)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name={isBlocked ? 'lock-open-variant' : 'lock'}
                          size={16}
                          color={colors.white}
                        />
                        <Text style={styles.actionBtnText}>
                          {isBlocked ? 'Desbloquear Usuario' : 'Bloquear Usuario'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-group-outline" size={36} color={colors.textSubtle} />
              <Text style={styles.emptyText}>No hay usuarios cliente registrados en el sistema.</Text>
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
  adminHeader: {
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
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondaryLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  adminBadgeText: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '800',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 24,
  },
  adminCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  adminCardCancelled: {
    borderColor: colors.danger,
    opacity: 0.85,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  cardInstructor: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPillSuccess: {
    backgroundColor: colors.successLight,
  },
  statusPillDanger: {
    backgroundColor: colors.dangerLight,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnCancelClass: {
    backgroundColor: colors.danger,
  },
  btnReactivate: {
    backgroundColor: colors.success,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  bookingAdminCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  userNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  userEmailText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  bookedClassText: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '600',
    marginTop: 4,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  attendanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attendanceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  checkinBtnPending: {
    backgroundColor: colors.primary,
  },
  checkinBtnActive: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  checkinBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  cancelBookingRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  cancelBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cancelBookingBtnText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
