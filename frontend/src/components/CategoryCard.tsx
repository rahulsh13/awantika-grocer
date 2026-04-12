import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';

interface Props {
  category: { category_id: string; name: string; image: string };
  onPress: () => void;
  size?: 'small' | 'medium';
}

export default function CategoryCard({ category, onPress, size = 'small' }: Props) {
  return (
    <TouchableOpacity testID={`category-${category.category_id}`} style={[styles.card, size === 'medium' && styles.medium]} onPress={onPress} activeOpacity={0.7}>
      <Image source={{ uri: category.image || 'https://via.placeholder.com/100' }} style={[styles.image, size === 'medium' && styles.mediumImage]} resizeMode="cover" />
      <Text style={[styles.name, size === 'medium' && styles.mediumName]} numberOfLines={2}>{category.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', width: 80, marginRight: SPACING.md },
  medium: { width: '48%', marginRight: 0, marginBottom: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, overflow: 'hidden' },
  image: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.muted, marginBottom: SPACING.sm },
  mediumImage: { width: 80, height: 80, borderRadius: 40, marginBottom: SPACING.md },
  name: { fontSize: FONT_SIZES.xs, color: COLORS.textPrimary, textAlign: 'center', fontWeight: '500' },
  mediumName: { fontSize: FONT_SIZES.md, fontWeight: '600' },
});
