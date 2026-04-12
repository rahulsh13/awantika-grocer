import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../src/constants/theme';
import { apiGet, apiPost, apiDelete } from '../src/utils/api';

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', is_default: false });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const fetchAddresses = async () => {
    try { const d = await apiGet('/addresses'); setAddresses(d.addresses || []); } catch {}
  };

  useEffect(() => { fetchAddresses(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode) {
      Alert.alert('Error', 'Please fill all required fields'); return;
    }
    setLoading(true);
    try {
      await apiPost('/addresses', form);
      await fetchAddresses();
      setShowForm(false);
      setForm({ name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', is_default: false });
    } catch (e: any) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await apiDelete(`/addresses/${id}`); fetchAddresses(); } },
    ]);
  };

  const FormInput = ({ placeholder, value, onChangeText, ...props }: any) => (
    <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={COLORS.textSecondary} value={value} onChangeText={onChangeText} {...props} />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Addresses</Text>
        <TouchableOpacity testID="add-address-btn" onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={item => item.address_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No addresses saved</Text>}
        renderItem={({ item }) => (
          <View testID={`addr-${item.address_id}`} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.addrName}>{item.name} {item.is_default && <Text style={styles.defaultTag}>(Default)</Text>}</Text>
              <Text style={styles.addrPhone}>{item.phone}</Text>
              <Text style={styles.addrLine}>{item.line1}{item.line2 ? `, ${item.line2}` : ''}</Text>
              <Text style={styles.addrLine}>{item.city}, {item.state} {item.pincode}</Text>
            </View>
            <TouchableOpacity testID={`delete-addr-${item.address_id}`} onPress={() => handleDelete(item.address_id)}>
              <Ionicons name="trash-outline" size={20} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Address</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>
            <FormInput placeholder="Full Name *" value={form.name} onChangeText={(t: string) => setForm({ ...form, name: t })} />
            <FormInput placeholder="Phone Number *" value={form.phone} onChangeText={(t: string) => setForm({ ...form, phone: t })} keyboardType="phone-pad" />
            <FormInput placeholder="Address Line 1 *" value={form.line1} onChangeText={(t: string) => setForm({ ...form, line1: t })} />
            <FormInput placeholder="Address Line 2" value={form.line2} onChangeText={(t: string) => setForm({ ...form, line2: t })} />
            <View style={styles.row}>
              <FormInput placeholder="City *" value={form.city} onChangeText={(t: string) => setForm({ ...form, city: t })} />
              <FormInput placeholder="State *" value={form.state} onChangeText={(t: string) => setForm({ ...form, state: t })} />
            </View>
            <FormInput placeholder="Pincode *" value={form.pincode} onChangeText={(t: string) => setForm({ ...form, pincode: t })} keyboardType="number-pad" />
            <TouchableOpacity testID="save-address-btn" style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
              <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save Address'}</Text>
            </TouchableOpacity>
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
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 60 },
  card: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, alignItems: 'flex-start' },
  addrName: { fontWeight: '700', fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  defaultTag: { color: COLORS.primary, fontWeight: '600', fontSize: FONT_SIZES.xs },
  addrPhone: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  addrLine: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  input: { backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, height: 48, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, marginBottom: SPACING.md, flex: 1 },
  row: { flexDirection: 'row', gap: SPACING.md },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
});
