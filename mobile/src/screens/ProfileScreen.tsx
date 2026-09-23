import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

// Perfil del usuario: datos de la cuenta, panel de estado SQLite/sincronización
// (mismo estado que expone el Header) y cierre de sesión.
export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, isOfflineMode, toggleOfflineMode, triggerSync, isSyncing, apiUrl } = useSync();

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Tarjeta Perfil */}
      <View style={styles.profileCard}>
        <View style={styles.avatarBox}>
          <MaterialCommunityIcons
            name={user.role === 'admin' ? 'shield-account' : 'account'}
            size={36}
            color={colors.white}
          />
        </View>

        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.roleBadge, user.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeClient]}>
            <Text style={[styles.roleBadgeText, { color: user.role === 'admin' ? colors.secondary : colors.primary }]}>
              {user.role === 'admin' ? 'STAFF / ENTRENADOR' : 'APRENDIZ / CLIENTE'}
            </Text>
          </View>
          <View style={styles.membershipBadge}>
            <Text style={styles.membershipBadgeText}>{user.membership_status || 'ACTIVA'}</Text>
          </View>
        </View>
      </View>

      {/* Meta Fitness */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Objetivo de Entrenamiento</Text>
        <View style={styles.goalRow}>
          <MaterialCommunityIcons name="target" size={20} color={colors.primary} />
          <Text style={styles.goalText}>{user.fitness_goal || 'Acondicionamiento Físico General'}</Text>
        </View>
      </View>

      {/* Estado del Sistema Offline & SQLite */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Almacenamiento Local & SQLite</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Motor Offline:</Text>
          <Text style={styles.infoValue}>expo-sqlite (Nativo)</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estado de Conexión:</Text>
          <Text style={[styles.infoValue, { color: isOnline ? colors.success : colors.accent }]}>
            {isOnline ? 'Conectado a la API' : 'Modo Offline (SQLite)'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Transacciones en cola SQLite:</Text>
          <Text style={[styles.infoValue, { color: pendingCount > 0 ? colors.accent : colors.success }]}>
            {pendingCount} pendientes
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>URL del Servidor:</Text>
          <Text style={[styles.infoValue, { fontSize: 11 }]}>{apiUrl}</Text>
        </View>

        <TouchableOpacity
          style={[styles.syncBtn, (!isOnline || isSyncing) && styles.syncBtnDisabled]}
          onPress={() => triggerSync(user.id)}
          disabled={!isOnline || isSyncing}
        >
          <MaterialCommunityIcons name="sync" size={16} color={colors.white} />
          <Text style={styles.syncBtnText}>
            {isSyncing ? 'Sincronizando...' : 'Sincronizar con Servidor'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.offlineToggleBtn, isOfflineMode ? styles.btnReactivateNet : styles.btnForceOffline]}
          onPress={toggleOfflineMode}
        >
          <MaterialCommunityIcons
            name={isOfflineMode ? 'wifi' : 'wifi-off'}
            size={16}
            color={colors.white}
          />
          <Text style={styles.offlineToggleText}>
            {isOfflineMode ? 'Desactivar Modo Offline' : 'Simular Pérdida de Internet'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Cerrar Sesión */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <MaterialCommunityIcons name="logout" size={18} color={colors.danger} />
        <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  roleBadgeAdmin: {
    backgroundColor: colors.secondaryLight,
  },
  roleBadgeClient: {
    backgroundColor: colors.primaryLight,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  membershipBadge: {
    backgroundColor: colors.successLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  membershipBadgeText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
  },
  goalText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  infoValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  syncBtnDisabled: {
    opacity: 0.5,
  },
  syncBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  offlineToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  btnForceOffline: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  btnReactivateNet: {
    backgroundColor: colors.success,
  },
  offlineToggleText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerLight,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: 6,
  },
  logoutBtnText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
