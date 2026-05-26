import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../src/constants/theme';
import { apiGet, apiPost, apiPut, apiDelete } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';

const EMPTY_FORM = { name: '', description: '', price: '', discount: '0', category_id: '', unit: 'piece', stock: '100', featured: false, images: [] as string[], variants: [] as {label: string; price: string; discount: string; stock: string}[] };

export default function AdminProductsScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role !== 'admin') { router.back(); return; }
    fetchData();
  }, [user, router]);

  const fetchData = async () => {
    const [p, c] = await Promise.all([apiGet('/products?limit=200'), apiGet('/categories')]);
    setProducts(p.products || []);
    setCategories(c.categories || []);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Gallery access required to upload images'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const base64Data = `data:image/jpeg;base64,${asset.base64}`;
      try {
        setLoading(true);
        const resp = await apiPost('/upload/image', { image_data: base64Data, filename: `product_${Date.now()}.jpg` });
        const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
        const imageUrl = `${API_BASE}${resp.url}`;
        setForm(prev => ({ ...prev, images: [...prev.images, imageUrl] }));
      } catch (e: any) {
        Alert.alert('Upload Failed', e.message);
      } finally { setLoading(false); }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required'); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const base64Data = `data:image/jpeg;base64,${asset.base64}`;
      try {
        setLoading(true);
        const resp = await apiPost('/upload/image', { image_data: base64Data, filename: `product_${Date.now()}.jpg` });
        const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
        const imageUrl = `${API_BASE}${resp.url}`;
        setForm(prev => ({ ...prev, images: [...prev.images, imageUrl] }));
      } catch (e: any) { Alert.alert('Upload Failed', e.message); }
      finally { setLoading(false); }
    }
  };

  const removeImage = (idx: number) => {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.category_id) {
      Alert.alert('Error', 'Name, price, and category are required'); return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        discount: parseFloat(form.discount) || 0,
        category_id: form.category_id,
        category_name: categories.find(c => c.category_id === form.category_id)?.name || '',
        unit: form.unit,
        stock: parseInt(form.stock) || 0,
        featured: form.featured,
        images: form.images.length > 0 ? form.images : ['https://via.placeholder.com/400'],
        variants: form.variants
          .filter(v => v.label.trim())
          .map(v => ({
            label: v.label.trim(),
            price: parseFloat(v.price) || 0,
            discount: parseFloat(v.discount) || 0,
            stock: parseInt(v.stock) || 0,
          })),
      };
      if (editing) {
        await apiPut(`/admin/products/${editing}`, payload);
        Alert.alert('Success', 'Product updated');
      } else {
        await apiPost('/admin/products', payload);
        Alert.alert('Success', 'Product created');
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      fetchData();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  const handleEdit = (product: any) => {
    setEditing(product.product_id);
    setForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      discount: String(product.discount || 0),
      category_id: product.category_id,
      unit: product.unit || 'piece',
      stock: String(product.stock || 0),
      featured: product.featured || false,
      images: product.images || [],
      variants: (product.variants || []).map((v: any) => ({
        label: v.label,
        price: String(v.price),
        discount: String(v.discount || 0),
        stock: String(v.stock || 0),
      })),
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await apiDelete(`/admin/products/${id}`);
        fetchData();
      }},
    ]);
  };

  const UNITS = ['kg', 'liter', 'piece', 'dozen', 'pack'];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Products</Text>
        <TouchableOpacity testID="add-product-btn" onPress={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={item => item.product_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View testID={`product-item-${item.product_id}`} style={styles.prodCard}>
            <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/60' }} style={styles.prodImg} resizeMode="cover" />
            <View style={styles.prodInfo}>
              <Text style={styles.prodName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.prodMeta}>${item.price} | Stock: {item.stock} | {item.category_name}</Text>
              {item.featured && <Text style={styles.featuredTag}>FEATURED</Text>}
            </View>
            <View style={styles.prodActions}>
              <TouchableOpacity testID={`edit-${item.product_id}`} onPress={() => handleEdit(item)}>
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity testID={`delete-${item.product_id}`} onPress={() => handleDelete(item.product_id)}>
                <Ionicons name="trash-outline" size={20} color={COLORS.accent} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Product Form Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? 'Edit Product' : 'New Product'}</Text>
                <TouchableOpacity onPress={() => { setShowForm(false); setEditing(null); }}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Image Upload Section */}
              <Text style={styles.label}>Product Images</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
                {form.images.map((uri, idx) => (
                  <View key={idx} style={styles.imageThumb}>
                    <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(idx)}>
                      <Ionicons name="close-circle" size={20} color={COLORS.accent} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addImgBtns}>
                  <TouchableOpacity testID="pick-gallery-btn" style={styles.addImgBtn} onPress={pickImage}>
                    <Ionicons name="images-outline" size={24} color={COLORS.primary} />
                    <Text style={styles.addImgText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="take-photo-btn" style={styles.addImgBtn} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                    <Text style={styles.addImgText}>Camera</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <Text style={styles.label}>Product Name *</Text>
              <TextInput testID="prod-name-input" style={styles.input} value={form.name} onChangeText={t => setForm(p => ({ ...p, name: t }))} placeholder="Product name" placeholderTextColor={COLORS.textSecondary} />

              <Text style={styles.label}>Description</Text>
              <TextInput testID="prod-desc-input" style={[styles.input, { height: 80 }]} value={form.description} onChangeText={t => setForm(p => ({ ...p, description: t }))} placeholder="Product description" placeholderTextColor={COLORS.textSecondary} multiline />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Price ($) *</Text>
                  <TextInput testID="prod-price-input" style={styles.input} value={form.price} onChangeText={t => setForm(p => ({ ...p, price: t }))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Discount (%)</Text>
                  <TextInput testID="prod-discount-input" style={styles.input} value={form.discount} onChangeText={t => setForm(p => ({ ...p, discount: t }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textSecondary} />
                </View>
              </View>

              <Text style={styles.label}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                {categories.map(c => (
                  <TouchableOpacity key={c.category_id} testID={`cat-select-${c.category_id}`} style={[styles.catChip, form.category_id === c.category_id && styles.catChipActive]} onPress={() => setForm(p => ({ ...p, category_id: c.category_id }))}>
                    <Text style={[styles.catChipText, form.category_id === c.category_id && styles.catChipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unit</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {UNITS.map(u => (
                      <TouchableOpacity key={u} style={[styles.unitChip, form.unit === u && styles.unitChipActive]} onPress={() => setForm(p => ({ ...p, unit: u }))}>
                        <Text style={[styles.unitChipText, form.unit === u && styles.unitChipTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Stock</Text>
                  <TextInput style={styles.input} value={form.stock} onChangeText={t => setForm(p => ({ ...p, stock: t }))} keyboardType="number-pad" />
                </View>
              </View>

              {/* Variants Section */}
              <View style={styles.variantSection}>
                <View style={styles.variantHeader}>
                  <Text style={styles.label}>Variants (e.g. 500g, 1kg)</Text>
                  <TouchableOpacity
                    testID="add-variant-btn"
                    style={styles.addVariantBtn}
                    onPress={() => setForm(p => ({
                      ...p,
                      variants: [...p.variants, { label: '', price: '', discount: '0', stock: '100' }]
                    }))}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.addVariantText}>Add Variant</Text>
                  </TouchableOpacity>
                </View>
                {form.variants.map((v, idx) => (
                  <View key={idx} style={styles.variantRow}>
                    <TextInput
                      style={[styles.input, { flex: 1.2 }]}
                      value={v.label}
                      onChangeText={t => setForm(p => {
                        const variants = [...p.variants];
                        variants[idx] = { ...variants[idx], label: t };
                        return { ...p, variants };
                      })}
                      placeholder="500g"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={v.price}
                      onChangeText={t => setForm(p => {
                        const variants = [...p.variants];
                        variants[idx] = { ...variants[idx], price: t };
                        return { ...p, variants };
                      })}
                      placeholder="Price"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[styles.input, { flex: 0.8 }]}
                      value={v.stock}
                      onChangeText={t => setForm(p => {
                        const variants = [...p.variants];
                        variants[idx] = { ...variants[idx], stock: t };
                        return { ...p, variants };
                      })}
                      placeholder="Stock"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity
                      onPress={() => setForm(p => ({ ...p, variants: p.variants.filter((_, i) => i !== idx) }))}
                      style={{ paddingHorizontal: SPACING.xs }}
                    >
                      <Ionicons name="close-circle" size={22} color={COLORS.accent} />
                    </TouchableOpacity>
                  </View>
                ))}
                {form.variants.length === 0 && (
                  <Text style={styles.variantHint}>No variants — product uses base price & stock above.</Text>
                )}
              </View>

              <TouchableOpacity style={styles.featuredToggle} onPress={() => setForm(p => ({ ...p, featured: !p.featured }))}>
                <Ionicons name={form.featured ? 'star' : 'star-outline'} size={22} color={form.featured ? COLORS.warning : COLORS.textSecondary} />
                <Text style={styles.featuredLabel}>Featured Product</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="save-product-btn" style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
                <Text style={styles.saveBtnText}>{loading ? 'Saving...' : editing ? 'Update Product' : 'Create Product'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary, flex: 1, marginLeft: SPACING.md },
  list: { padding: SPACING.xl },
  prodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, gap: SPACING.md },
  prodImg: { width: 56, height: 56, borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.muted },
  prodInfo: { flex: 1 },
  prodName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  prodMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  featuredTag: { fontSize: 9, fontWeight: '700', color: COLORS.warning, marginTop: 2 },
  prodActions: { flexDirection: 'row', gap: SPACING.md },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  label: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.xs, marginTop: SPACING.md },
  input: { backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, height: 44, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.md },
  imageRow: { marginBottom: SPACING.md },
  imageThumb: { width: 80, height: 80, borderRadius: BORDER_RADIUS.md, marginRight: SPACING.sm, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  removeImgBtn: { position: 'absolute', top: 2, right: 2 },
  addImgBtns: { flexDirection: 'row', gap: SPACING.sm },
  addImgBtn: { width: 80, height: 80, borderRadius: BORDER_RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addImgText: { fontSize: FONT_SIZES.xs, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  catChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, fontWeight: '600' },
  catChipTextActive: { color: COLORS.white },
  unitChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.xs },
  unitChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  unitChipText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  unitChipTextActive: { color: COLORS.white },
  featuredToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md },
  featuredLabel: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, fontWeight: '600' },
  variantSection: { marginTop: SPACING.md },
  variantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  addVariantBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addVariantText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '600' },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.xs },
  variantHint: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: SPACING.xs },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg, marginBottom: SPACING.xxl },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
});
