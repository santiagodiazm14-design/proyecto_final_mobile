import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

export type ScreenType = 'CLASSES' | 'MY_BOOKINGS' | 'ADMIN_MANAGE' | 'PROFILE';

interface BottomNavProps {
  currentScreen: ScreenType;
  onSelectScreen: (screen: ScreenType) => void;
}

// Barra de navegación inferior: los ítems dependen del rol (Admin ve Gestión +
// Clases; Cliente ve Agendar + Mis Citas), y siempre está Mi Perfil.
export const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onSelectScreen }) => {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <View style={styles.navContainer}>
      {isAdmin ? (
        <>
          <TouchableOpacity
            style={[styles.navItem, currentScreen === 'ADMIN_MANAGE' && styles.navItemActive]}
            onPress={() => onSelectScreen('ADMIN_MANAGE')}
          >
            <MaterialCommunityIcons
              name="clipboard-check-outline"
              size={22}
              color={currentScreen === 'ADMIN_MANAGE' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.navLabel, currentScreen === 'ADMIN_MANAGE' && styles.navLabelActive]}>
              Gestión Admin
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, currentScreen === 'CLASSES' && styles.navItemActive]}
            onPress={() => onSelectScreen('CLASSES')}
          >
            <MaterialCommunityIcons
              name="dumbbell"
              size={22}
              color={currentScreen === 'CLASSES' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.navLabel, currentScreen === 'CLASSES' && styles.navLabelActive]}>
              Clases Gym
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.navItem, currentScreen === 'CLASSES' && styles.navItemActive]}
            onPress={() => onSelectScreen('CLASSES')}
          >
            <MaterialCommunityIcons
              name="calendar-plus"
              size={22}
              color={currentScreen === 'CLASSES' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.navLabel, currentScreen === 'CLASSES' && styles.navLabelActive]}>
              Agendar Clases
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, currentScreen === 'MY_BOOKINGS' && styles.navItemActive]}
            onPress={() => onSelectScreen('MY_BOOKINGS')}
          >
            <MaterialCommunityIcons
              name="calendar-clock"
              size={22}
              color={currentScreen === 'MY_BOOKINGS' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.navLabel, currentScreen === 'MY_BOOKINGS' && styles.navLabelActive]}>
              Mis Citas
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={[styles.navItem, currentScreen === 'PROFILE' && styles.navItemActive]}
        onPress={() => onSelectScreen('PROFILE')}
      >
        <MaterialCommunityIcons
          name="account-circle-outline"
          size={22}
          color={currentScreen === 'PROFILE' ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.navLabel, currentScreen === 'PROFILE' && styles.navLabelActive]}>
          Mi Perfil
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingVertical: 8,
    paddingBottom: 22,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: colors.primaryLight,
  },
  navLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
    fontWeight: '600',
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
