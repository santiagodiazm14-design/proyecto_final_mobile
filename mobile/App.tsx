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

const MainNavigator: React.FC = () => {
  const { user } = useAuth();
  const [authView, setAuthView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('CLASSES');

  // Si no está autenticado, mostrar Login o Registro
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

const RegisterScreenPropsWrapper: React.FC<{ onGoToRegister: () => void }> = ({ onGoToRegister }) => {
  return <LoginScreen onGoToRegister={onGoToRegister} />;
};

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
