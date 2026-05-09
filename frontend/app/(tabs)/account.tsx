import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const MenuItem = ({ icon, label, onPress, testId }: { icon: string; label: string; onPress: () => void; testId: string }) => (
    <TouchableOpacity testID={testId} style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Ionicons name={icon as any} size={22} color={COLORS.primary} />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.role === 'admin' && <View style={styles.adminBadge}><Text style={styles.adminText}>ADMIN</Text></View>}
        </View>

        <View style={styles.menuSection}>
          <MenuItem icon="receipt-outline" label="My Orders" onPress={() => router.push('/orders')} testId="orders-menu-btn" />
          <MenuItem icon="location-outline" label="Saved Addresses" onPress={() => router.push('/addresses')} testId="addresses-menu-btn" />
          <MenuItem icon="heart-outline" label="Wishlist" onPress={() => Alert.alert('Coming Soon', 'Wishlist feature coming soon!')} testId="wishlist-menu-btn" />
          {user?.role === 'admin' && <MenuItem icon="settings-outline" label="Admin Panel" onPress={() => router.push('/admin')} testId="admin-menu-btn" />}
        </View>

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.accent} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  profileCard: { alignItems: 'center', padding: SPACING.xxl, paddingTop: SPACING.xxxl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  avatarText: { fontSize: 32, fontWeight: '800', color: COLORS.white },
  name: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.textPrimary },
  email: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginTop: 2 },
  adminBadge: { backgroundColor: COLORS.accent, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: 10, paddingVertical: 2, marginTop: SPACING.sm },
  adminText: { color: COLORS.white, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  menuSection: { marginHorizontal: SPACING.xl, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  menuLabel: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.xxl, marginHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderWidth: 1, borderColor: COLORS.accent, borderRadius: BORDER_RADIUS.md },
  logoutText: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.accent },
});
