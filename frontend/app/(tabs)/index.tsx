import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { apiGet } from '../../src/utils/api';
import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import ProductCard from '../../src/components/ProductCard';
import CategoryCard from '../../src/components/CategoryCard';

const LOGO_URL = require('../../assets/images/logo.png');

const BANNERS = [
  { id: '1', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600', title: 'Fresh Organic Vegetables', subtitle: 'Up to 20% off' },
  { id: '2', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600', title: 'Daily Essentials', subtitle: 'Free delivery on $25+' },
];

export default function HomeScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const router = useRouter();
  const { addItem, refreshCart, getItemQuantity, updateQuantity, removeItem } = useCart();
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    try {
      const [catData, prodData] = await Promise.all([
        apiGet('/categories'),
        apiGet('/products?featured=true&limit=10'),
      ]);
      setCategories(catData.categories || []);
      setFeatured(prodData.products || []);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); refreshCart(); }, [fetchData, refreshCart]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); await refreshCart(); setRefreshing(false); };

  const handleAddToCart = async (productId: string) => {
    try {
      await addItem(productId);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={LOGO_URL} style={styles.headerLogo} resizeMode="contain" />
            <View>
              <Text style={styles.greeting}>Hello, {user?.name || 'Guest'}</Text>
              <Text style={styles.headerTitle}>Awantika Grocers</Text>
            </View>
          </View>
          <TouchableOpacity testID="notification-btn" style={styles.iconBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity testID="search-bar" style={styles.searchBar} onPress={() => router.push('/search')}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <Text style={styles.searchPlaceholder}>Search groceries, recipes...</Text>
          <View style={styles.aiTag}><Text style={styles.aiText}>AI</Text></View>
        </TouchableOpacity>

        {/* Banner Carousel */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.bannerScroll}>
          {BANNERS.map((b, i) => (
            <View key={b.id} style={styles.bannerCard}>
              <Image source={{ uri: b.image }} style={styles.bannerImage} resizeMode="cover" />
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerTitle}>{b.title}</Text>
                <Text style={styles.bannerSubtitle}>{b.subtitle}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
          <TouchableOpacity testID="view-all-categories" onPress={() => router.push('/(tabs)/categories')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
          {categories.slice(0, 8).map((cat) => (
            <CategoryCard key={cat.category_id} category={cat} onPress={() => router.push({ pathname: '/search', params: { category: cat.category_id, title: cat.name } })} />
          ))}
        </ScrollView>

        {/* Featured Products */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
          <TouchableOpacity testID="view-all-products" onPress={() => router.push('/search')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.productGrid}>
          {featured.map((prod) => (
            <View key={prod.product_id} style={styles.productCol}>
              <ProductCard
                product={prod}
                onPress={() => router.push(`/product/${prod.product_id}`)}
                cartQuantity={getItemQuantity(prod.product_id)}
                onAddToCart={() => handleAddToCart(prod.product_id)}
                onIncrement={async () => { try { await updateQuantity(prod.product_id, getItemQuantity(prod.product_id) + 1); } catch {} }}
                onDecrement={async () => {
                  const qty = getItemQuantity(prod.product_id);
                  try { if (qty <= 1) { await removeItem(prod.product_id); } else { await updateQuantity(prod.product_id, qty - 1); } } catch {}
                }}
              />
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerLogo: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#000' },
  greeting: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  headerTitle: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.muted, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.full, marginHorizontal: SPACING.xl, paddingHorizontal: SPACING.lg, height: 48, gap: SPACING.sm, marginBottom: SPACING.lg },
  searchPlaceholder: { flex: 1, color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  aiTag: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2 },
  aiText: { color: COLORS.white, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  bannerScroll: { paddingLeft: SPACING.xl, marginBottom: SPACING.lg },
  bannerCard: { width: 300, height: 150, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', marginRight: SPACING.md },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.md, backgroundColor: 'rgba(0,0,0,0.4)' },
  bannerTitle: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  bannerSubtitle: { color: COLORS.white, fontSize: FONT_SIZES.sm, opacity: 0.9 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  viewAll: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.accent },
  catScroll: { paddingLeft: SPACING.xl, paddingBottom: SPACING.lg },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  productCol: { width: '48%' },
});
