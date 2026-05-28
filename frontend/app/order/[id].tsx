import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { apiGet } from '../../src/utils/api';
import LoadingScreen from '../../src/components/LoadingScreen';
import { formatINR } from '../../src/utils/currency';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (id) apiGet(`/orders/${id}`).then(setOrder).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (!order) return <SafeAreaView style={styles.safe}><Text style={{ padding: 20 }}>Order not found</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Order Details</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statusCard}>
          <Text style={styles.orderId}>#{order.order_id.slice(-8)}</Text>
          <Text style={styles.status}>{order.status?.toUpperCase()}</Text>
          <Text style={styles.date}>{new Date(order.created_at).toLocaleString()}</Text>
        </View>
        <Text style={styles.sectionTitle}>Items</Text>
        {order.items?.map((item: any, idx: number) => (
          <View key={idx} style={styles.itemRow}>
            <Image source={{ uri: item.image || 'https://via.placeholder.com/50' }} style={styles.itemImg} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.quantity} x {formatINR(item.effective_price)}</Text>
            </View>
            <Text style={styles.itemTotal}>{formatINR(item.subtotal)}</Text>
          </View>
        ))}
        <View style={styles.summaryCard}>
          <View style={styles.sRow}><Text style={styles.sLabel}>Subtotal</Text><Text style={styles.sVal}>{formatINR(order.subtotal)}</Text></View>
          {order.discount > 0 && <View style={styles.sRow}><Text style={[styles.sLabel, { color: COLORS.success }]}>Discount</Text><Text style={[styles.sVal, { color: COLORS.success }]}>-{formatINR(order.discount)}</Text></View>}
          <View style={[styles.sRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm }]}>
            <Text style={styles.totalLabel}>Total</Text><Text style={styles.totalVal}>{formatINR(order.total)}</Text>
          </View>
        </View>
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <View style={styles.addrCard}>
          <Text style={styles.addrName}>{order.address?.name}</Text>
          <Text style={styles.addrLine}>{order.address?.line1}{order.address?.line2 ? `, ${order.address.line2}` : ''}</Text>
          <Text style={styles.addrLine}>{order.address?.city}, {order.address?.state} {order.address?.pincode}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary },
  scroll: { padding: SPACING.xl },
  statusCard: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.xl },
  orderId: { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZES.sm },
  status: { color: COLORS.white, fontSize: FONT_SIZES.xxl, fontWeight: '800', marginVertical: SPACING.xs },
  date: { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZES.sm },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemImg: { width: 50, height: 50, borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.muted },
  itemName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  itemMeta: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  itemTotal: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.primary },
  summaryCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginVertical: SPACING.xl },
  sRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  sLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  sVal: { fontWeight: '600', fontSize: FONT_SIZES.md },
  totalLabel: { fontWeight: '700', fontSize: FONT_SIZES.lg },
  totalVal: { fontWeight: '800', fontSize: FONT_SIZES.lg, color: COLORS.primary },
  addrCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  addrName: { fontWeight: '600', marginBottom: 2 },
  addrLine: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
});
