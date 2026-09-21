import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { sqliteService, LocalBooking } from '../database/sqliteService';
import { apiService } from '../services/apiService';

interface MyBookingsScreenProps {
  onGoToClasses: () => void;
}

export const MyBookingsScreen: React.FC<MyBookingsScreenProps> = ({ onGoToClasses }) => {
  const { user } = useAuth();
  const { isOnline, refreshPendingCount } = useSync();

  const [bookings, setBookings] = useState<LocalBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState<LocalBooking | null>(null);
  const [selectedReason, setSelectedReason] = useState('Compromiso académico / SENA');
  const [customReason, setCustomReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState('');

  const cancellationReasons = [
    'Compromiso académico / SENA',
    'Imprevisto laboral o personal',
    'Molestia física o descanso muscular',
    'Otro motivo'
  ];

  const loadMyBookings = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Cargar desde SQLite local
      const localList = await sqliteService.getBookings(user.id);
      setBookings(localList);

      // 2. Si está online, consultar datos frescos
      if (isOnline) {
        try {
          const remoteList = await apiService.pullSync(user.id);
          if (remoteList?.bookings) {
            setBookings(remoteList.bookings);
          }
        } catch (_) {}
      }
    } catch (err) {
      console.error('Error cargando reservas del usuario:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isOnline]);

  useEffect(() => {
    loadMyBookings();
  }, [loadMyBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMyBookings();
  };

  // Confirmar y procesar cancelación
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setIsProcessing(true);
    const finalReason = selectedReason === 'Otro motivo' && customReason.trim() ? customReason.trim() : selectedReason;

    try {
      // 1. Actualizar estado local en SQLite de inmediato
      await sqliteService.cancelBooking(cancellingBooking.id, finalReason);

      // 2. Enviar a la API o encolar en sync_queue según conexión
      if (isOnline) {
        try {
          await apiService.cancelBooking(cancellingBooking.id, finalReason);
          setNotice(`Cita de "${cancellingBooking.class_title}" cancelada exitosamente.`);
        } catch {
          await sqliteService.enqueueAction('CANCEL_BOOKING', 'booking', {
            bookingId: cancellingBooking.id,
            reason: finalReason
          });
          setNotice(`Cancelación registrada en SQLite local (se sincronizará al conectar).`);
        }
      } else {
        // Modo offline
        await sqliteService.enqueueAction('CANCEL_BOOKING', 'booking', {
          bookingId: cancellingBooking.id,
          reason: finalReason
        });
        setNotice(`Cancelación realizada en MODO OFFLINE. Guardada en SQLite.`);
      }

      await refreshPendingCount();
      await loadMyBookings();
      setCancellingBooking(null);
      setCustomReason('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo cancelar la cita.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string, isAttended: number) => {
    if (isAttended === 1) {
      return {
        text: 'ASISTENCIA COMPLETADA',
        bg: colors.secondaryLight,
        color: colors.secondary,
        icon: 'check-all'
      };
    }
    if (status === 'CONFIRMADA') {
      return {
        text: 'CITA CONFIRMADA',
        bg: colors.successLight,
        color: colors.success,
        icon: 'calendar-check'
      };
    }
    if (status === 'CANCELADA') {
      return {
        text: 'CANCELADA POR MÍ',
        bg: colors.accentLight,
        color: colors.accent,
        icon: 'cancel'
      };
    }
    return {
      text: 'CANCELADA POR GIMNASIO',
      bg: colors.dangerLight,
      color: colors.danger,
      icon: 'alert-octagon'
    };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.screenTitle}>Mis Citas & Reservas</Text>
          <Text style={styles.screenSubtitle}>Historial de clases agendadas y cancelaciones</Text>
        </View>

        <TouchableOpacity style={styles.newBookingBtn} onPress={onGoToClasses}>
          <MaterialCommunityIcons name="plus" size={16} color={colors.white} />
          <Text style={styles.newBookingBtnText}>Nueva Cita</Text>
        </TouchableOpacity>
      </View>

      {/* Banner de Aviso */}
      {notice ? (
        <View style={styles.noticeBox}>
          <MaterialCommunityIcons name="information" size={16} color={colors.secondary} />
          <Text style={styles.noticeText}>{notice}</Text>
          <TouchableOpacity onPress={() => setNotice('')}>
            <MaterialCommunityIcons name="close" size={16} color={colors.textSubtle} />
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Consultando citas en SQLite...</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status, item.is_attended);
            const canCancel = item.status === 'CONFIRMADA' && item.is_attended === 0;

            return (
              <View style={[styles.bookingCard, !canCancel && styles.bookingCardInactive]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.classTitle}>{item.class_title}</Text>
                    <Text style={styles.scheduleText}>{item.schedule_time}</Text>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                    <MaterialCommunityIcons name={badge.icon as any} size={12} color={badge.color} />
                    <Text style={[styles.statusPillText, { color: badge.color }]}>{badge.text}</Text>
                  </View>
                </View>

                {item.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                ) : null}

                {/* Botón de Cancelación de Cita (Módulo 5) */}
                {canCancel ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setCancellingBooking(item)}
                    >
                      <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.danger} />
                      <Text style={styles.cancelBtnText}>Cancelar Esta Cita</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="calendar-remove-outline" size={48} color={colors.textSubtle} />
              <Text style={styles.emptyTitle}>No tienes citas agendadas aún</Text>
              <Text style={styles.emptySubtitle}>Explora el catálogo de clases y agenda tu primera sesión.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={onGoToClasses}>
                <Text style={styles.emptyBtnText}>Ver Catálogo de Clases</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal de Cancelación de Cita con Motivo */}
      <Modal visible={!!cancellingBooking} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={24} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Cancelar Cita</Text>
                <Text style={styles.modalSubtitle}>¿Estás seguro de cancelar tu reserva en {cancellingBooking?.class_title}?</Text>
              </View>
            </View>

            <Text style={styles.reasonLabel}>Selecciona el motivo de cancelación:</Text>
            <View style={styles.reasonsList}>
              {cancellationReasons.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonOption, selectedReason === r && styles.reasonOptionSelected]}
                  onPress={() => setSelectedReason(r)}
                >
                  <MaterialCommunityIcons
                    name={selectedReason === r ? 'radiobox-marked' : 'radiobox-blank'}
                    size={16}
                    color={selectedReason === r ? colors.primary : colors.textSubtle}
                  />
                  <Text style={[styles.reasonText, selectedReason === r && styles.reasonTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedReason === 'Otro motivo' ? (
              <TextInput
                style={styles.customInput}
                placeholder="Escribe el motivo..."
                placeholderTextColor={colors.textSubtle}
                value={customReason}
                onChangeText={setCustomReason}
              />
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setCancellingBooking(null)}
                disabled={isProcessing}
              >
                <Text style={styles.modalBtnCancelText}>Volver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleConfirmCancel}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Confirmar Cancelación</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerRow: {
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
  newBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  newBookingBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  noticeText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
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
  bookingCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  bookingCardInactive: {
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  scheduleText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  notesBox: {
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
  },
  notesText: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerLight,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cancelBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  emptyBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  reasonLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  reasonsList: {
    gap: 6,
    marginBottom: 12,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  reasonOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  reasonText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reasonTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  customInput: {
    backgroundColor: colors.background,
    color: colors.text,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    fontSize: 12,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
  },
  modalBtnCancelText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  modalBtnConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
  modalBtnConfirmText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
