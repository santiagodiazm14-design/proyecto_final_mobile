import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

interface LoginScreenProps {
  onGoToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onGoToRegister }) => {
  const { login, quickLogin, isLoading } = useAuth();
  const { isOnline } = useSync();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor ingresa tu correo y contraseña');
      return;
    }

    setErrorMessage('');
    const res = await login(email.trim(), password.trim());
    if (!res.success) {
      setErrorMessage(res.message || 'Credenciales inválidas');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Banner Logo */}
        <View style={styles.headerBox}>
          <View style={styles.logoIcon}>
            <MaterialCommunityIcons name="lightning-bolt" size={36} color={colors.white} />
          </View>
          <Text style={styles.appTitle}>FitSync <Text style={styles.accentText}>Gym</Text></Text>
          <Text style={styles.appSubtitle}>Control de Gimnasio & Citas de Entrenamiento</Text>
          
          <View style={[styles.networkPill, isOnline ? styles.pillOnline : styles.pillOffline]}>
            <MaterialCommunityIcons name={isOnline ? 'cloud-check' : 'cloud-off-outline'} size={14} color={isOnline ? colors.success : colors.accent} />
            <Text style={[styles.networkPillText, { color: isOnline ? colors.success : colors.accent }]}>
              {isOnline ? 'Sincronizado con API Server' : 'Modo Offline: SQLite Local Activo'}
            </Text>
          </View>
        </View>

        {/* Tarjeta de Formulario */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar Sesión</Text>
          <Text style={styles.cardSubtitle}>Ingresa con tu cuenta de aprendiz o entrenador</Text>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="email-outline" size={18} color={colors.textSubtle} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="ejemplo@fitsync.com"
                placeholderTextColor={colors.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="lock-outline" size={18} color={colors.textSubtle} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textSubtle}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, isLoading && styles.btnDisabled]} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Entrar a la App</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color={colors.white} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerLink} onPress={onGoToRegister}>
            <Text style={styles.registerLinkText}>
              ¿No tienes cuenta? <Text style={styles.linkHighlight}>Regístrate aquí</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botones de Acceso Rápido para Calificación / Demostración */}
        <View style={styles.quickAccessSection}>
          <Text style={styles.quickAccessTitle}>ACCESO RÁPIDO DE EVALUACIÓN (1-CLIC)</Text>
          <View style={styles.quickButtonsRow}>
            <TouchableOpacity 
              style={[styles.quickBtn, styles.quickBtnAdmin]} 
              onPress={() => quickLogin('admin')}
              disabled={isLoading}
            >
              <MaterialCommunityIcons name="shield-account" size={18} color={colors.secondary} />
              <Text style={styles.quickBtnTextAdmin}>Entrar como Admin</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.quickBtn, styles.quickBtnClient]} 
              onPress={() => quickLogin('cliente')}
              disabled={isLoading}
            >
              <MaterialCommunityIcons name="arm-flex" size={18} color={colors.primary} />
              <Text style={styles.quickBtnTextClient}>Entrar como Cliente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 50,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.5,
  },
  accentText: {
    color: colors.primary,
  },
  appSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 10,
  },
  pillOnline: {
    backgroundColor: colors.successLight,
  },
  pillOffline: {
    backgroundColor: colors.accentLight,
  },
  networkPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  registerLinkText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  linkHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
  quickAccessSection: {
    alignItems: 'center',
  },
  quickAccessTitle: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  quickButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  quickBtnAdmin: {
    borderColor: colors.secondary,
  },
  quickBtnClient: {
    borderColor: colors.primary,
  },
  quickBtnTextAdmin: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  quickBtnTextClient: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
