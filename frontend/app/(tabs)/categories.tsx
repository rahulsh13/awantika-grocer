import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES } from '../../src/constants/theme';
import { apiGet } from '../../src/utils/api';
import CategoryCard from '../../src/components/CategoryCard';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    apiGet('/categories').then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>All Categories</Text>
      <FlatList
        data={categories}
        keyExtractor={item => item.category_id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <CategoryCard category={item} size="medium" onPress={() => router.push({ pathname: '/search', params: { category: item.category_id, title: item.name } })} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md },
  grid: { paddingHorizontal: SPACING.xl },
  row: { justifyContent: 'space-between' },
});
