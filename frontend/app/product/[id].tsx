import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { apiGet } from '../../src/utils/api';
import { useCart } from '../../src/context/CartContext';
import LoadingScreen from '../../src/components/LoadingScreen';
import { formatINR } from '../../src/utils/currency';

interface Variant {
  label: string;
  price: number;
  discount: number;
  stock: number;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const { addItem } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      apiGet(`/products/${id}`)
        .then(p => {
          setProduct(p);
          // Auto-select first variant if variants exist
          if (p.variants && p.variants.length > 0) {
            setSelectedVariant(p.variants[0]);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (!product) return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.errorText}>Product not found</Text>
    </SafeAreaView>
  );

  const hasVariants = product.variants && product.variants.length > 0;

  // Resolve active price/discount/stock from selected variant or base product
  const activePrice = selectedVariant ? selectedVariant.price : product.price;
  const activeDiscount = selectedVariant ? (selectedVariant.discount || 0) : (product.discount || 0);
  const activeStock = selectedVariant ? selectedVariant.stock : product.stock;
  const effectivePrice = activePrice * (1 - activeDiscount / 100);

  const handleAddToCart = async () => {
    try {
      await addItem(product.product_id, quantity, selectedVariant?.label || '');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: product.images?.[0] || 'https://via.placeholder.com/400' }}
            style={styles.image}
            resizeMode="cover"
          />
          <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          {activeDiscount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeDiscount}% OFF</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.category}>{product.category_name}</Text>
          <Text style={styles.name}>{product.name}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatINR(effectivePrice)}</Text>
            {activeDiscount > 0 && (
              <Text style={styles.oldPrice}>{formatINR(activePrice)}</Text>
            )}
            {!hasVariants && (
              <Text style={styles.unit}>per {product.unit}</Text>
            )}
          </View>

          <Text style={[styles.stock, activeStock === 0 && { color: COLORS.error }]}>
            {activeStock > 0 ? `In Stock (${activeStock} available)` : 'Out of Stock'}
          </Text>

          {/* Variant selector */}
          {hasVariants && (
            <View style={styles.variantSection}>
              <Text style={styles.variantTitle}>Select Size</Text>
              <View style={styles.variantRow}>
                {product.variants.map((v: Variant) => {
                  const isSelected = selectedVariant?.label === v.label;
                  const vEffectivePrice = v.price * (1 - (v.discount || 0) / 100);
                  const outOfStock = v.stock === 0;
                  return (
                    <TouchableOpacity
                      key={v.label}
                      testID={`variant-${v.label}`}
                      style={[
                        styles.variantBox,
                        isSelected && styles.variantBoxSelected,
                        outOfStock && styles.variantBoxDisabled,
                      ]}
                      onPress={() => !outOfStock && setSelectedVariant(v)}
                      disabled={outOfStock}
                    >
                      <Text style={[styles.variantLabel, isSelected && styles.variantLabelSelected, outOfStock && styles.variantLabelDisabled]}>
                        {v.label}
                      </Text>
                      <Text style={[styles.variantPrice, isSelected && styles.variantPriceSelected, outOfStock && styles.variantLabelDisabled]}>
                        {formatINR(vEffectivePrice)}
                      </Text>
                      {outOfStock && (
                        <Text style={styles.outOfStockTag}>Out</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.divider} />
          <Text style={styles.descTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>
      </ScrollView>

      {activeStock > 0 && (
        <View style={styles.footer}>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              testID="qty-minus"
              style={styles.qtyBtn}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Ionicons name="remove" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{quantity}</Text>
            <TouchableOpacity
              testID="qty-plus"
              style={styles.qtyBtn}
              onPress={() => setQuantity(Math.min(activeStock, quantity + 1))}
            >
              <Ionicons name="add" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity testID="add-to-cart-btn" style={styles.addBtn} onPress={handleAddToCart}>
            <Ionicons name="cart" size={20} color={COLORS.white} />
            <Text style={styles.addBtnText}>
              Add to Cart — {formatINR(effectivePrice * quantity)}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  errorText: { padding: SPACING.xl, fontSize: FONT_SIZES.lg, color: COLORS.textSecondary, textAlign: 'center' },
  imageContainer: { height: 300, backgroundColor: COLORS.muted },
  image: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: SPACING.md, left: SPACING.md, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: SPACING.md, right: SPACING.md, backgroundColor: COLORS.accent, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  content: { padding: SPACING.xl, paddingBottom: 120 },
  category: { fontSize: FONT_SIZES.sm, color: COLORS.accent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.xs },
  name: { fontSize: FONT_SIZES.xxxl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.md },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm, marginBottom: SPACING.sm },
  price: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary },
  oldPrice: { fontSize: FONT_SIZES.lg, color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  unit: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  stock: { fontSize: FONT_SIZES.sm, color: COLORS.success, fontWeight: '600', marginBottom: SPACING.md },
  // Variants
  variantSection: { marginTop: SPACING.md },
  variantTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  variantBox: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    minWidth: 72,
    backgroundColor: COLORS.surface,
  },
  variantBoxSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#1E3F2010',
  },
  variantBoxDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.muted,
    opacity: 0.6,
  },
  variantLabel: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.textPrimary },
  variantLabelSelected: { color: COLORS.primary },
  variantLabelDisabled: { color: COLORS.textSecondary },
  variantPrice: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  variantPriceSelected: { color: COLORS.primary },
  outOfStockTag: { fontSize: 9, color: COLORS.error, fontWeight: '700', marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xl },
  descTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  description: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, lineHeight: 22 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, paddingBottom: 30, gap: SPACING.md },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: FONT_SIZES.lg, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  addBtn: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  addBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
});
