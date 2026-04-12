import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../src/constants/theme';
import { apiGet, apiPut, apiPost } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';

export default function AdminScreen() {
  const [dashboard, setDashboard] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [view, setView] = useState<'dashboard' | 'orders'>('dashboard');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role !== 'admin') { Alert.alert('Access Denied'); router.back(); return; }
    apiGet('/admin/dashboard').then(setDashboard).catch(() => {});
    apiGet('/admin/orders').then(d => setOrders(d.orders || [])).catch(() => {});
  }, [user, router]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await apiPut(`/admin/orders/${orderId}/status`, { status });
      apiGet('/admin/orders').then(d => setOrders(d.orders || []));
      Alert.alert('Updated', `Order status changed to ${status}`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const StatCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Panel</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity testID="tab-dashboard" style={[styles.tab, view === 'dashboard' && styles.tabActive]} onPress={() => setView('dashboard')}>
          <Text style={[styles.tabText, view === 'dashboard' && styles.tabTextActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-orders" style={[styles.tab, view === 'orders' && styles.tabActive]} onPress={() => setView('orders')}>
          <Text style={[styles.tabText, view === 'orders' && styles.tabTextActive]}>Orders</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {view === 'dashboard' ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard label="Total Orders" value={dashboard.total_orders || 0} icon="receipt" color="#3B82F6" />
              <StatCard label="Revenue" value={`$${(dashboard.total_revenue || 0).toFixed(0)}`} icon="cash" color="#22C55E" />
              <StatCard label="Products" value={dashboard.total_products || 0} icon="cube" color="#8B5CF6" />
              <StatCard label="Customers" value={dashboard.total_users || 0} icon="people" color="#F59E0B" />
            </View>

            <TouchableOpacity testID="manage-products-btn" style={styles.actionCard} onPress={() => router.push('/admin-products')}>
              <View style={[styles.actionIcon, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="cube-outline" size={24} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Manage Products</Text>
                <Text style={styles.actionDesc}>Add, edit, delete products with image upload</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity testID="broadcast-notif-btn" style={styles.actionCard} onPress={() => {
              Alert.prompt ? Alert.prompt('Broadcast', 'Enter message', (msg: string) => {
                if (msg) apiPost('/admin/notifications/broadcast', { title: 'FreshMart Update', body: msg }).then(() => Alert.alert('Sent!'));
              }) : Alert.alert('Broadcast', 'Use the API to send broadcast notifications');
            }}>
              <View style={[styles.actionIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="megaphone-outline" size={24} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Send Notification</Text>
                <Text style={styles.actionDesc}>Broadcast promo to all users</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pending Orders: {dashboard.pending_orders || 0}</Text>
            </View>
          </>
        ) : (
          orders.map(order => (
            <View key={order.order_id} testID={`admin-order-${order.order_id}`} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>#{order.order_id.slice(-8)}</Text>
                <Text style={styles.orderStatus}>{order.status?.toUpperCase()}</Text>
              </View>
              <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleString()}</Text>
              <Text style={styles.orderTotal}>${order.total?.toFixed(2)} - {order.items?.length || 0} items</Text>
              <View style={styles.actionRow}>
                {order.status === 'pending' && (
                  <TouchableOpacity testID={`confirm-${order.order_id}`} style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => updateOrderStatus(order.order_id, 'confirmed')}>
                    <Text style={styles.actionText}>Confirm</Text>
                  </TouchableOpacity>
                )}
                {(order.status === 'confirmed' || order.status === 'pending') && (
                  <TouchableOpacity testID={`deliver-${order.order_id}`} style={[styles.actionBtn, { backgroundColor: '#22C55E' }]} onPress={() => updateOrderStatus(order.order_id, 'delivered')}>
                    <Text style={styles.actionText}>Deliver</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary },
  tabs: { flexDirection: 'row', marginHorizontal: SPACING.xl, backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, padding: 4, marginBottom: SPACING.md },
  tab: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.sm },
  tabActive: { backgroundColor: COLORS.white },
  tabText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },
  scroll: { padding: SPACING.xl },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xl },
  statCard: { width: '47%', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4 },
  statValue: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.textPrimary, marginTop: SPACING.sm },
  statLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, gap: SPACING.md },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  actionDesc: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  orderCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  orderId: { fontWeight: '700', color: COLORS.textPrimary },
  orderStatus: { fontWeight: '600', color: COLORS.accent, fontSize: FONT_SIZES.sm },
  orderDate: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  orderTotal: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.primary, marginTop: SPACING.xs },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.sm },
  actionText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.sm },
});
