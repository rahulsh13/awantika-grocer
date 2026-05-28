import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../src/constants/theme';
import { apiGet } from '../src/utils/api';
import { formatINR } from '../src/utils/currency';

const STATUS_COLORS: Record<string, string> = { pending: '#F59E0B', confirmed: '#3B82F6', delivered: '#22C55E', cancelled: '#EF4444' };

export default function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchOrders = async () => {
    try { const d = await apiGet('/orders'); setOrders(d.orders || []); } catch {}
  };

  useEffect(() => { fetchOrders(); }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>My Orders</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={item => item.order_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); }} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity testID={`order-${item.order_id}`} style={styles.card} onPress={() => router.push(`/order/${item.order_id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>#{item.order_id.slice(-8)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || COLORS.textSecondary }]}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
            <Text style={styles.itemCount}>{item.items?.length || 0} items</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.total}>{formatINR(item.total)}</Text>
              <Text style={styles.payMethod}>{item.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary },
  list: { padding: SPACING.xl },
  empty: { textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT_SIZES.lg, marginTop: 60 },
  card: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  orderId: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { borderRadius: BORDER_RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { color: COLORS.white, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  date: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  itemCount: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  total: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.primary },
  payMethod: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
});
