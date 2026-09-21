import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

interface RegisterScreenProps {
  onGoToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onGoToLogin }) => {
  const { register, isLoading } = useAuth();
  const { isOnline } = useSync();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'cliente' | 'admin'>('cliente');
  const [fitnessGoal, setFitnessGoal] = useState('Ganancia Muscular y Fuerza');
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  const goals = [
    'Ganancia Muscular y Fuerza',
    'Pérdida de Grasa y Definición',
    'Acondicionamiento y Resistencia',
    'Salud y Flexibilidad'
  ];

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Todos los campos son obligatorios');
      return;
    }

    setErrorMessage('');
    const res = await register({
      name: name.trim(),
      email: email.trim(),
      pass: password.trim(),
      role,
      fitness_goal: fitnessGoal
    });

    if (res.success) {
      if (res.message) {
        setSuccessInfo(res.message);
      }
    } else {
      setErrorMessage(res.message || 'Error al registrar usuario');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.headerBox}>
          <TouchableOpacity style={styles.backBtn} onPress={onGoToLogin}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={colors.text} />
            <Text style={styles.backBtnText}>Volver al Login</Text>
          </TouchableOpacity>

          <Text style={styles.appTitle}>Nuevo <Text style={styles.accentText}>Registro</Text></Text>
          <Text style={styles.appSubtitle}>Únete a la comunidad FitSync Gym</Text>
        </View>

        {/* Formulario */}
        <View style={styles.card}>
          {errorMessage ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {successInfo ? (
            <View style={styles.infoBox}>
              <MaterialCommunityIcons name="check-circle" size={16} color={colors.accent} />
              <Text style={styles.infoText}>{successInfo}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre Completo</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="account-outline" size={18} color={colors.textSubtle} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ej. Sebastián Morales"
                placeholderTextColor={colors.textSubtle}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="email-outline" size={18} color={colors.textSubtle} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
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
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.textSubtle}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          {/* Selector de Rol */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Rol en el Gimnasio</Text>
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[styles.roleOption, role === 'cliente' && styles.roleOptionSelected]}
                onPress={() => setRole('cliente')}
              >
                <MaterialCommunityIcons
                  name="dumbbell"
                  size={16}
                  color={role === 'cliente' ? colors.white : colors.textMuted}
                />
                <Text style={[styles.roleText, role === 'cliente' && styles.roleTextSelected]}>
                  Aprendiz / Cliente
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleOption, role === 'admin' && styles.roleOptionSelectedAdmin]}
                onPress={() => setRole('admin')}
              >
                <MaterialCommunityIcons
                  name="shield-account"
                  size={16}
                  color={role === 'admin' ? colors.white : colors.textMuted}
                />
                <Text style={[styles.roleText, role === 'admin' && styles.roleTextSelected]}>
                  Administrador
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Objetivo Fitness */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Objetivo de Entrenamiento</Text>
            <View style={styles.goalsContainer}>
              {goals.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.goalPill, fitnessGoal === g && styles.goalPillActive]}
                  onPress={() => setFitnessGoal(g)}
                >
                  <Text style={[styles.goalPillText, fitnessGoal === g && styles.goalPillTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Botón de Enviar */}
          <TouchableOpacity 
            style={[styles.primaryButton, isLoading && styles.btnDisabled]} 
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Completar Registro</Text>
                <MaterialCommunityIcons name="check-bold" size={18} color={colors.white} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.offlineNote}>
            <MaterialCommunityIcons name="information-outline" size={14} color={colors.textSubtle} />
            <Text style={styles.offlineNoteText}>
              {isOnline
                ? 'Se guardará en el servidor y en la base de datos local SQLite.'
                : 'Sin conexión: Se guardará en SQLite local y se sincronizará al conectar.'}
            </Text>
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
    padding: 20,
    paddingTop: 45,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  backBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
  },
  accentText: {
    color: colors.primary,
  },
  appSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  infoText: {
    color: colors.accent,
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
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.background,
  },
  roleOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleOptionSelectedAdmin: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  roleText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  roleTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  goalsContainer: {
    gap: 6,
  },
  goalPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  goalPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  goalPillText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  goalPillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  offlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    justifyContent: 'center',
  },
  offlineNoteText: {
    color: colors.textSubtle,
    fontSize: 11,
  },
});
