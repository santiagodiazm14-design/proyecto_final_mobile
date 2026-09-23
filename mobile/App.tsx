import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme/colors';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import { Header } from './src/components/Header';
import { BottomNav, ScreenType } from './src/components/BottomNav';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ClassesScreen } from './src/screens/ClassesScreen';
import { AdminManageScreen } from './src/screens/AdminManageScreen';
import { MyBookingsScreen } from './src/screens/MyBookingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

// Navegación raíz de la app (sin librería de routing): decide entre pantallas
// de autenticación y las pantallas internas según haya o no un usuario logueado,
// y cuál pestaña del BottomNav está activa.
const MainNavigator: React.FC = () => {
  const { user } = useAuth();
  const [authView, setAuthView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('CLASSES');

  // Login obligatorio: sin sesión (AuthContext nunca autologuea) solo se puede
  // ver Login o Registro, sin importar el rol que se vaya a usar después.
  if (!user) {
    if (authView === 'REGISTER') {
      return <RegisterScreen onGoToLogin={() => setAuthView('LOGIN')} />;
    }
    return <RegisterScreenPropsWrapper onGoToRegister={() => setAuthView('REGISTER')} />;
  }

  // Si el usuario es administrador y estaba en Mis Reservas, redirigir a Gestión Admin
  const activeScreen = user.role === 'admin' && currentScreen === 'MY_BOOKINGS' ? 'ADMIN_MANAGE' : currentScreen;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <View style={styles.screenContainer}>
        {activeScreen === 'CLASSES' && (
          <ClassesScreen onGoToMyBookings={() => setCurrentScreen('MY_BOOKINGS')} />
        )}
        {activeScreen === 'MY_BOOKINGS' && (
          <MyBookingsScreen onGoToClasses={() => setCurrentScreen('CLASSES')} />
        )}
        {activeScreen === 'ADMIN_MANAGE' && (
          <AdminManageScreen />
        )}
        {activeScreen === 'PROFILE' && (
          <ProfileScreen />
        )}
      </View>
      <BottomNav currentScreen={activeScreen} onSelectScreen={setCurrentScreen} />
    </SafeAreaView>
  );
};

// Adapta la firma de LoginScreen (espera onGoToRegister) a como se usa arriba.
const RegisterScreenPropsWrapper: React.FC<{ onGoToRegister: () => void }> = ({ onGoToRegister }) => {
  return <LoginScreen onGoToRegister={onGoToRegister} />;
};

// Punto de entrada: AuthProvider va afuera porque SyncProvider necesita leer el
// usuario logueado (para el auto-sync al reconectar).
export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <StatusBar style="light" />
        <MainNavigator />
      </SyncProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
