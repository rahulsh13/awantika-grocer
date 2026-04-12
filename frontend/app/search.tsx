import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../src/constants/theme';
import { apiGet, apiPost } from '../src/utils/api';
import { useCart } from '../src/context/CartContext';
import ProductCard from '../src/components/ProductCard';

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category?: string; title?: string }>();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('');
  const { addItem } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (params.category) {
      setLoading(true);
      apiGet(`/products?category=${params.category}`).then(d => setProducts(d.products || [])).catch(() => {}).finally(() => setLoading(false));
    }
  }, [params.category]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await apiPost('/ai/search', { query: query.trim() });
      setProducts(data.products || []);
    } catch {
      const data = await apiGet(`/products?search=${encodeURIComponent(query.trim())}`);
      setProducts(data.products || []);
    }
    setLoading(false);
  };

  const handleSort = (sort: string) => {
    setSortBy(sort);
    const sorted = [...products];
    if (sort === 'price_low') sorted.sort((a, b) => a.price - b.price);
    else if (sort === 'price_high') sorted.sort((a, b) => b.price - a.price);
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    setProducts(sorted);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{params.title || 'Search'}</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput testID="search-input" style={styles.searchInput} placeholder="Search groceries, recipes..." placeholderTextColor={COLORS.textSecondary} value={query} onChangeText={setQuery} onSubmitEditing={handleSearch} returnKeyType="search" />
        </View>
        <TouchableOpacity testID="search-btn" style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>AI Search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sortRow}>
        {['price_low', 'price_high', 'name'].map(s => (
          <TouchableOpacity key={s} testID={`sort-${s}`} style={[styles.sortChip, sortBy === s && styles.sortActive]} onPress={() => handleSort(s)}>
            <Text style={[styles.sortText, sortBy === s && styles.sortActiveText]}>
              {s === 'price_low' ? 'Price: Low' : s === 'price_high' ? 'Price: High' : 'A-Z'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.product_id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={<Text style={styles.emptyText}>{query || params.category ? 'No products found' : 'Try searching for something'}</Text>}
          renderItem={({ item }) => (
            <View style={styles.col}>
              <ProductCard product={item} onPress={() => router.push(`/product/${item.product_id}`)} onAddToCart={async () => { try { await addItem(item.product_id); Alert.alert('Added', 'Item added to cart'); } catch (e: any) { Alert.alert('Error', e.message); } }} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  searchRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.md },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.lg, height: 44, gap: SPACING.sm },
  searchInput: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  searchBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.lg, height: 44, justifyContent: 'center' },
  searchBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.sm },
  sortRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.md },
  sortChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  sortActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sortText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, fontWeight: '600' },
  sortActiveText: { color: COLORS.white },
  grid: { paddingHorizontal: SPACING.lg },
  row: { justifyContent: 'space-between' },
  col: { width: '48%' },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT_SIZES.md, marginTop: 40 },
});
