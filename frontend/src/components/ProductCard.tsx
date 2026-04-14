import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';

interface Props {
  product: {
    product_id: string;
    name: string;
    price: number;
    discount: number;
    images: string[];
    unit: string;
    stock: number;
  };
  onPress: () => void;
  onAddToCart?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  cartQuantity?: number;
}

export default function ProductCard({ product, onPress, onAddToCart, onIncrement, onDecrement, cartQuantity = 0 }: Props) {
  const effectivePrice = product.price * (1 - (product.discount || 0) / 100);

  return (
    <TouchableOpacity testID={`product-card-${product.product_id}`} style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.images?.[0] || 'https://via.placeholder.com/200' }} style={styles.image} resizeMode="cover" />
        {product.discount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.discount}% OFF</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.unit}>per {product.unit}</Text>
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.price}>${effectivePrice.toFixed(2)}</Text>
            {product.discount > 0 && (
              <Text style={styles.oldPrice}>${product.price.toFixed(2)}</Text>
            )}
          </View>
          {product.stock > 0 && (
            cartQuantity > 0 ? (
              <View style={styles.stepper}>
                <TouchableOpacity
                  testID={`decrement-${product.product_id}`}
                  style={styles.stepBtn}
                  onPress={(e) => { e.stopPropagation(); onDecrement?.(); }}
                >
                  <Ionicons name={cartQuantity === 1 ? "trash-outline" : "remove"} size={14} color={cartQuantity === 1 ? COLORS.accent : COLORS.primary} />
                </TouchableOpacity>
                <Text testID={`qty-${product.product_id}`} style={styles.qtyText}>{cartQuantity}</Text>
                <TouchableOpacity
                  testID={`increment-${product.product_id}`}
                  style={styles.stepBtnPlus}
                  onPress={(e) => { e.stopPropagation(); onIncrement?.(); }}
                >
                  <Ionicons name="add" size={14} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            ) : (
              onAddToCart && (
                <TouchableOpacity testID={`add-cart-${product.product_id}`} style={styles.addBtn} onPress={(e) => { e.stopPropagation(); onAddToCart(); }}>
                  <Ionicons name="add" size={18} color={COLORS.white} />
                </TouchableOpacity>
              )
            )
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: SPACING.md },
  imageWrap: { height: 130, backgroundColor: COLORS.muted },
  image: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.accent, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: COLORS.white, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  content: { padding: SPACING.md },
  name: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  unit: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  price: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.primary },
  oldPrice: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.full, height: 32, overflow: 'hidden' },
  stepBtn: { width: 30, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepBtnPlus: { width: 30, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full },
  qtyText: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.textPrimary, minWidth: 22, textAlign: 'center' },
});
