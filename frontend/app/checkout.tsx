import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../src/constants/theme';
import { apiGet, apiPost } from '../src/utils/api';
import { useCart } from '../src/context/CartContext';
import { formatINR } from '../src/utils/currency';

export default function CheckoutScreen() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddr, setSelectedAddr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { items, total, refreshCart } = useCart();
  const router = useRouter();

  useEffect(() => {
    refreshCart();
    apiGet('/addresses').then(d => {
      setAddresses(d.addresses || []);
      const def = d.addresses?.find((a: any) => a.is_default);
      if (def) setSelectedAddr(def.address_id);
      else if (d.addresses?.length) setSelectedAddr(d.addresses[0].address_id);
    }).catch(() => {});
  }, [refreshCart]);

  const handleApplyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const data = await apiPost('/coupons/validate', { code: coupon.trim(), subtotal: total });
      setDiscount(data.discount);
      Alert.alert('Coupon Applied', `You saved ${formatINR(data.discount)}!`);
    } catch (e: any) { Alert.alert('Invalid Coupon', e.message); setDiscount(0); }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddr) { Alert.alert('Error', 'Please select a delivery address'); return; }
    if (items.length === 0) { Alert.alert('Error', 'Cart is empty'); return; }
    setLoading(true);
    try {
      const order = await apiPost('/orders', { address_id: selectedAddr, payment_method: paymentMethod, coupon_code: coupon.trim() });
      await refreshCart();
      Alert.alert('Order Placed!', `Order #${order.order_id} placed successfully`, [
        { text: 'View Orders', onPress: () => router.replace('/orders') },
      ]);
    } catch (e: any) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  const finalTotal = Math.max(0, total - discount);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Address Section */}
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        {addresses.length === 0 ? (
          <TouchableOpacity testID="add-address-btn" style={styles.addAddrBtn} onPress={() => router.push('/addresses')}>
            <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
            <Text style={styles.addAddrText}>Add Address</Text>
          </TouchableOpacity>
        ) : (
          addresses.map(addr => (
            <TouchableOpacity key={addr.address_id} testID={`addr-${addr.address_id}`} style={[styles.addrCard, selectedAddr === addr.address_id && styles.addrSelected]} onPress={() => setSelectedAddr(addr.address_id)}>
              <View style={styles.radioOuter}>{selectedAddr === addr.address_id && <View style={styles.radioInner} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addrName}>{addr.name} - {addr.phone}</Text>
                <Text style={styles.addrLine}>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</Text>
                <Text style={styles.addrLine}>{addr.city}, {addr.state} {addr.pincode}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Payment Method */}
        <Text style={styles.sectionTitle}>Payment Method</Text>
        {[{ id: 'cod', label: 'Cash on Delivery', icon: 'cash-outline' }, { id: 'stripe', label: 'Pay Online (Stripe)', icon: 'card-outline' }].map(pm => (
          <TouchableOpacity key={pm.id} testID={`pay-${pm.id}`} style={[styles.payCard, paymentMethod === pm.id && styles.paySelected]} onPress={() => setPaymentMethod(pm.id)}>
            <View style={styles.radioOuter}>{paymentMethod === pm.id && <View style={styles.radioInner} />}</View>
            <Ionicons name={pm.icon as any} size={22} color={COLORS.primary} />
            <Text style={styles.payLabel}>{pm.label}</Text>
          </TouchableOpacity>
        ))}

        {/* Coupon */}
        <Text style={styles.sectionTitle}>Coupon Code</Text>
        <View style={styles.couponRow}>
          <TextInput testID="coupon-input" style={styles.couponInput} placeholder="Enter coupon code" placeholderTextColor={COLORS.textSecondary} value={coupon} onChangeText={setCoupon} autoCapitalize="characters" />
          <TouchableOpacity testID="apply-coupon-btn" style={styles.applyBtn} onPress={handleApplyCoupon}>
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Items ({items.length})</Text><Text style={styles.summaryVal}>{formatINR(total)}</Text></View>
          {discount > 0 && <View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: COLORS.success }]}>Discount</Text><Text style={[styles.summaryVal, { color: COLORS.success }]}>-{formatINR(discount)}</Text></View>}
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery</Text><Text style={[styles.summaryVal, { color: COLORS.success }]}>FREE</Text></View>
          <View style={[styles.summaryRow, styles.totalRow]}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalVal}>{formatINR(finalTotal)}</Text></View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity testID="place-order-btn" style={[styles.placeBtn, loading && { opacity: 0.6 }]} onPress={handlePlaceOrder} disabled={loading}>
          <Text style={styles.placeBtnText}>{loading ? 'Placing Order...' : `Place Order - ${formatINR(finalTotal)}`}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary },
  scroll: { padding: SPACING.xl, paddingBottom: 120 },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md, marginTop: SPACING.lg },
  addAddrBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed', borderRadius: BORDER_RADIUS.md },
  addAddrText: { color: COLORS.primary, fontWeight: '600' },
  addrCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
  addrSelected: { borderColor: COLORS.primary, backgroundColor: '#f0f7f0' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  addrName: { fontWeight: '600', color: COLORS.textPrimary, fontSize: FONT_SIZES.md },
  addrLine: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  payCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
  paySelected: { borderColor: COLORS.primary, backgroundColor: '#f0f7f0' },
  payLabel: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  couponRow: { flexDirection: 'row', gap: SPACING.sm },
  couponInput: { flex: 1, backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, height: 44, fontSize: FONT_SIZES.md },
  applyBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.xl, height: 44, justifyContent: 'center' },
  applyText: { color: COLORS.white, fontWeight: '700' },
  summaryCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  summaryLabel: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  summaryVal: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.md, marginTop: SPACING.sm, marginBottom: 0 },
  totalLabel: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  totalVal: { fontSize: FONT_SIZES.xl, fontWeight: '800', color: COLORS.primary },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.xl, paddingBottom: 30 },
  placeBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center' },
  placeBtnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
});
