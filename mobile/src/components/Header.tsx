import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

// Encabezado fijo de toda la app: marca + usuario logueado, y la barra de estado
// de red/sincronización (toggle online/offline, contador de pendientes, botón
// de sync manual y modal para configurar la URL del backend).
export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { isOfflineMode, isOnline, pendingCount, isSyncing, toggleOfflineMode, triggerSync, apiUrl, setApiUrl } = useSync();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [tempUrl, setTempUrl] = useState(apiUrl);

  const handleSyncPress = async () => {
    await triggerSync(user?.id);
  };

  return (
    <View style={styles.headerContainer}>
      {/* Fila Superior: Marca y Perfil */}
      <View style={styles.topRow}>
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <MaterialCommunityIcons name="dumbbell" size={22} color={colors.white} />
          </View>
          <View>
            <Text style={styles.brandTitle}>FitSync <Text style={styles.brandHighlight}>Gym</Text></Text>
            {user && (
              <Text style={styles.userRole}>
                {user.role === 'admin' ? '⚡ ADMINISTRADOR' : '🏋️ APRENDIZ'} • {user.name}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => { setTempUrl(apiUrl); setShowConfigModal(true); }}
          >
            <MaterialCommunityIcons name="cog-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          {user && (
            <TouchableOpacity style={styles.iconButton} onPress={logout}>
              <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Fila Inferior: Barra de Estado Offline & Sync */}
      <View style={styles.syncBar}>
        {/* Toggle de Modo Offline */}
        <TouchableOpacity
          style={[
            styles.statusBadge,
            isOnline ? styles.badgeOnline : styles.badgeOffline,
          ]}
          onPress={toggleOfflineMode}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={isOnline ? 'wifi' : 'wifi-off'}
            size={14}
            color={isOnline ? colors.success : colors.accent}
          />
          <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.accent }]}>
            {isOnline ? 'ONLINE' : 'MODO OFFLINE'}
          </Text>
          <Text style={styles.tapToToggle}>(tocar para alternar)</Text>
        </TouchableOpacity>

        {/* Contador de Transacciones pendientes en SQLite */}
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <MaterialCommunityIcons name="database-sync" size={13} color={colors.accent} />
            <Text style={styles.pendingText}>
              {pendingCount} en SQLite
            </Text>
          </View>
        )}

        {/* Botón de Sincronización Manual */}
        <TouchableOpacity
          style={[styles.syncButton, (!isOnline || isSyncing) && styles.syncButtonDisabled]}
          onPress={handleSyncPress}
          disabled={!isOnline || isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="sync" size={15} color={colors.white} />
              <Text style={styles.syncButtonText}>Sincronizar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal de Configuración de IP API */}
      <Modal visible={showConfigModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar URL de la API</Text>
            <Text style={styles.modalSubtitle}>
              Útil si pruebas desde un celular físico en la misma red Wi-Fi o en emulador:
            </Text>
            <TextInput
              style={styles.input}
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="http://10.15.10.39:3000/api"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.btnCancel]}
                onPress={() => setShowConfigModal(false)}
              >
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.btnSave]}
                onPress={() => {
                  setApiUrl(tempUrl);
                  setShowConfigModal(false);
                }}
              >
                <Text style={styles.btnTextSave}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: colors.surface,
    paddingTop: 45,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    backgroundColor: colors.primary,
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandHighlight: {
    color: colors.primary,
  },
  userRole: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
  },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeOnline: {
    backgroundColor: colors.successLight,
  },
  badgeOffline: {
    backgroundColor: colors.accentLight,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tapToToggle: {
    fontSize: 9,
    color: colors.textSubtle,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accentLight,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  pendingText: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    width: '100%',
    maxWidth: 380,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 18,
  },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    fontSize: 13,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnCancel: {
    backgroundColor: colors.surfaceLight,
  },
  btnSave: {
    backgroundColor: colors.primary,
  },
  btnText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  btnTextSave: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
