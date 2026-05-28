import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { useCart } from '../../src/context/CartContext';
import { formatINR } from '../../src/utils/currency';

export default function CartScreen() {
  const { items, total, refreshCart, updateQuantity, removeItem } = useCart();
  const router = useRouter();

  useEffect(() => { refreshCart(); }, [refreshCart]);

  const renderItem = ({ item }: { item: any }) => {
    const ep = item.product.price * (1 - (item.product.discount || 0) / 100);
    return (
      <View testID={`cart-item-${item.product_id}`} style={styles.item}>
        <Image source={{ uri: item.product.images?.[0] || 'https://via.placeholder.com/80' }} style={styles.itemImg} resizeMode="cover" />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
          <Text style={styles.itemUnit}>per {item.product.unit}</Text>
          <Text style={styles.itemPrice}>{formatINR(ep)}</Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity testID={`remove-item-${item.product_id}`} onPress={() => removeItem(item.product_id)} style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={16} color={COLORS.accent} />
          </TouchableOpacity>
          <View style={styles.qtyRow}>
            <TouchableOpacity testID={`qty-minus-${item.product_id}`} style={styles.qtyBtn} onPress={() => updateQuantity(item.product_id, item.quantity - 1)}>
              <Ionicons name="remove" size={16} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity testID={`qty-plus-${item.product_id}`} style={styles.qtyBtn} onPress={() => updateQuantity(item.product_id, item.quantity + 1)}>
              <Ionicons name="add" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtotal}>{formatINR(item.subtotal)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>My Cart</Text>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={64} color={COLORS.border} />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <TouchableOpacity testID="start-shopping-btn" style={styles.shopBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList data={items} keyExtractor={item => item.product_id} renderItem={renderItem} contentContainerStyle={styles.list} />
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalPrice}>{formatINR(total)}</Text>
            </View>
            <TouchableOpacity testID="checkout-btn" style={styles.checkoutBtn} onPress={() => router.push('/checkout')}>
              <Text style={styles.checkoutText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.lg },
  emptyText: { fontSize: FONT_SIZES.lg, color: COLORS.textSecondary },
  shopBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md },
  shopBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.md },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: 180 },
  item: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  itemImg: { width: 70, height: 70, borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.muted },
  itemInfo: { flex: 1, marginLeft: SPACING.md, justifyContent: 'center' },
  itemName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  itemUnit: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  itemPrice: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  itemActions: { alignItems: 'flex-end', justifyContent: 'space-between' },
  removeBtn: { padding: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: FONT_SIZES.md, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  subtotal: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textSecondary },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.xl, paddingBottom: 30 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  totalLabel: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textSecondary },
  totalPrice: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary },
  checkoutBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  checkoutText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
});
