import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../src/constants/theme';
import { apiGet, apiPost, apiPut, apiDelete } from '../src/utils/api';

const EMPTY_FORM = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', is_default: false, label: 'Home' };
const LABELS = [
  { key: 'Home', icon: 'home-outline' },
  { key: 'Work', icon: 'briefcase-outline' },
  { key: 'Other', icon: 'location-outline' },
];

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const router = useRouter();

  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to auto-detect your address.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const results = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (results && results.length > 0) {
        const r = results[0];
        // Build address line from available fields
        const line1Parts = [r.streetNumber, r.street].filter(Boolean);
        const line1 = line1Parts.join(' ') || r.name || '';
        const line2Parts = [r.district, r.subregion].filter(Boolean);
        const line2 = line2Parts.join(', ');
        setForm(prev => ({
          ...prev,
          line1: line1 || prev.line1,
          line2: line2 || prev.line2,
          city: r.city || r.subregion || prev.city,
          state: r.region || prev.state,
          pincode: r.postalCode || prev.pincode,
        }));
        Alert.alert('Location Detected', 'Address fields have been filled. Please verify and complete any missing details.');
      } else {
        Alert.alert('Not Found', 'Could not determine address from your location. Please enter manually.');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to detect location. Please enter address manually.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const fetchAddresses = async () => {
    try { const d = await apiGet('/addresses'); setAddresses(d.addresses || []); } catch {}
  };

  useEffect(() => { fetchAddresses(); }, []);

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, is_default: addresses.length === 0 });
    setShowForm(true);
  };

  const openEditForm = (addr: any) => {
    setEditingId(addr.address_id);
    setForm({
      name: addr.name || '',
      phone: addr.phone || '',
      line1: addr.line1 || '',
      line2: addr.line2 || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      is_default: addr.is_default || false,
      label: addr.label || 'Home',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode) {
      Alert.alert('Error', 'Please fill all required fields'); return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await apiPut(`/addresses/${editingId}`, form);
      } else {
        await apiPost('/addresses', form);
      }
      await fetchAddresses();
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (e: any) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  const handleSetDefault = async (addr: any) => {
    if (addr.is_default) return;
    try {
      await apiPut(`/addresses/${addr.address_id}`, { ...addr, is_default: true });
      await fetchAddresses();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Address', 'Are you sure you want to remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await apiDelete(`/addresses/${id}`); fetchAddresses(); } },
    ]);
  };

  const getLabelIcon = (label: string) => LABELS.find(l => l.key === label)?.icon || 'location-outline';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>My Addresses</Text>
        <TouchableOpacity testID="add-address-btn" style={styles.addHeaderBtn} onPress={openAddForm}>
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={styles.addHeaderText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>{addresses.length} address{addresses.length !== 1 ? 'es' : ''} saved</Text>

      <FlatList
        data={addresses}
        keyExtractor={item => item.address_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="location-outline" size={56} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No addresses yet</Text>
            <Text style={styles.emptyText}>Add your first delivery address to get started</Text>
            <TouchableOpacity testID="add-first-address-btn" style={styles.emptyBtn} onPress={openAddForm}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
              <Text style={styles.emptyBtnText}>Add Address</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View testID={`addr-${item.address_id}`} style={[styles.card, item.is_default && styles.cardDefault]}>
            <View style={styles.cardTop}>
              <View style={styles.labelRow}>
                <View style={[styles.labelBadge, item.is_default && styles.labelBadgeDefault]}>
                  <Ionicons name={getLabelIcon(item.label) as any} size={14} color={item.is_default ? COLORS.white : COLORS.primary} />
                  <Text style={[styles.labelText, item.is_default && styles.labelTextDefault]}>{item.label || 'Home'}</Text>
                </View>
                {item.is_default && (
                  <View style={styles.defaultBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                    <Text style={styles.defaultText}>Default</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity testID={`edit-addr-${item.address_id}`} onPress={() => openEditForm(item)} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity testID={`delete-addr-${item.address_id}`} onPress={() => handleDelete(item.address_id)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.accent} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.addrName}>{item.name}</Text>
            <Text style={styles.addrPhone}>{item.phone}</Text>
            <Text style={styles.addrLine}>{item.line1}{item.line2 ? `, ${item.line2}` : ''}</Text>
            <Text style={styles.addrLine}>{item.city}, {item.state} - {item.pincode}</Text>
            {!item.is_default && (
              <TouchableOpacity testID={`set-default-${item.address_id}`} style={styles.setDefaultBtn} onPress={() => handleSetDefault(item)}>
                <Ionicons name="pin-outline" size={14} color={COLORS.primary} />
                <Text style={styles.setDefaultText}>Set as Default</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Add / Edit Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Address' : 'New Address'}</Text>
                <TouchableOpacity onPress={() => { setShowForm(false); setEditingId(null); }}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Detect Location Button */}
              <TouchableOpacity
                testID="detect-location-btn"
                style={styles.detectBtn}
                onPress={detectLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="locate" size={18} color={COLORS.white} />
                )}
                <Text style={styles.detectBtnText}>
                  {detectingLocation ? 'Detecting...' : 'Auto-detect My Location'}
                </Text>
              </TouchableOpacity>

              {/* Address Label */}
              <Text style={styles.formLabel}>Address Type</Text>
              <View style={styles.labelsRow}>
                {LABELS.map(l => (
                  <TouchableOpacity key={l.key} testID={`label-${l.key}`} style={[styles.labelChip, form.label === l.key && styles.labelChipActive]} onPress={() => setForm(p => ({ ...p, label: l.key }))}>
                    <Ionicons name={l.icon as any} size={16} color={form.label === l.key ? COLORS.white : COLORS.primary} />
                    <Text style={[styles.labelChipText, form.label === l.key && styles.labelChipTextActive]}>{l.key}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Contact Details</Text>
              <TextInput testID="addr-name-input" style={styles.input} placeholder="Full Name *" placeholderTextColor={COLORS.textSecondary} value={form.name} onChangeText={t => setForm(p => ({ ...p, name: t }))} />
              <TextInput testID="addr-phone-input" style={styles.input} placeholder="Phone Number *" placeholderTextColor={COLORS.textSecondary} value={form.phone} onChangeText={t => setForm(p => ({ ...p, phone: t }))} keyboardType="phone-pad" />

              <Text style={styles.formLabel}>Address</Text>
              <TextInput testID="addr-line1-input" style={styles.input} placeholder="Address Line 1 *" placeholderTextColor={COLORS.textSecondary} value={form.line1} onChangeText={t => setForm(p => ({ ...p, line1: t }))} />
              <TextInput testID="addr-line2-input" style={styles.input} placeholder="Address Line 2 (Optional)" placeholderTextColor={COLORS.textSecondary} value={form.line2} onChangeText={t => setForm(p => ({ ...p, line2: t }))} />
              <View style={styles.row}>
                <TextInput testID="addr-city-input" style={styles.input} placeholder="City *" placeholderTextColor={COLORS.textSecondary} value={form.city} onChangeText={t => setForm(p => ({ ...p, city: t }))} />
                <TextInput testID="addr-state-input" style={styles.input} placeholder="State *" placeholderTextColor={COLORS.textSecondary} value={form.state} onChangeText={t => setForm(p => ({ ...p, state: t }))} />
              </View>
              <TextInput testID="addr-pincode-input" style={styles.input} placeholder="Pincode *" placeholderTextColor={COLORS.textSecondary} value={form.pincode} onChangeText={t => setForm(p => ({ ...p, pincode: t }))} keyboardType="number-pad" />

              {/* Default Toggle */}
              <TouchableOpacity testID="default-toggle" style={styles.defaultToggle} onPress={() => setForm(p => ({ ...p, is_default: !p.is_default }))}>
                <Ionicons name={form.is_default ? 'checkbox' : 'square-outline'} size={22} color={form.is_default ? COLORS.primary : COLORS.textSecondary} />
                <Text style={styles.defaultToggleText}>Set as default delivery address</Text>
              </TouchableOpacity>

              <TouchableOpacity testID="save-address-btn" style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
                <Text style={styles.saveBtnText}>{loading ? 'Saving...' : editingId ? 'Update Address' : 'Save Address'}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.xs },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary, flex: 1, marginLeft: SPACING.md },
  addHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  addHeaderText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.sm },
  subtitle: { paddingHorizontal: SPACING.xl, color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginBottom: SPACING.sm },
  list: { padding: SPACING.xl, paddingTop: SPACING.sm },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: SPACING.sm },
  emptyTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, marginTop: SPACING.md },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.md },
  card: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  cardDefault: { borderColor: COLORS.primary, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  labelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary + '15', borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  labelBadgeDefault: { backgroundColor: COLORS.primary },
  labelText: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.primary },
  labelTextDefault: { color: COLORS.white },
  defaultBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  defaultText: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.success },
  cardActions: { flexDirection: 'row', gap: SPACING.sm },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.muted, alignItems: 'center', justifyContent: 'center' },
  addrName: { fontWeight: '700', fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  addrPhone: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: 1 },
  addrLine: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: 2 },
  setDefaultBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  setDefaultText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.primary },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  formLabel: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.md },
  labelsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  labelChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.primary },
  labelChipActive: { backgroundColor: COLORS.primary },
  labelChipText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.primary },
  labelChipTextActive: { color: COLORS.white },
  input: { backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, height: 48, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, marginBottom: SPACING.md, flex: 1 },
  row: { flexDirection: 'row', gap: SPACING.md },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md },
  defaultToggleText: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, fontWeight: '500' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xxl },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  detectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.accent, borderRadius: BORDER_RADIUS.md, height: 48, marginBottom: SPACING.md },
  detectBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
});
