import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) { Alert.alert('Error', 'Please fill in all fields'); return; }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Awantika Grocers for fresh grocery delivery</Text>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
            <TextInput testID="register-name-input" style={styles.input} placeholder="Enter your name" placeholderTextColor={COLORS.textSecondary} value={name} onChangeText={setName} />
          </View>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
            <TextInput testID="register-email-input" style={styles.input} placeholder="Enter your email" placeholderTextColor={COLORS.textSecondary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
            <TextInput testID="register-password-input" style={styles.input} placeholder="Min 6 characters" placeholderTextColor={COLORS.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <TouchableOpacity testID="register-submit-btn" style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleRegister} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Creating...' : 'Create Account'}</Text>
          </TouchableOpacity>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, padding: SPACING.xl },
  backBtn: { marginBottom: SPACING.xl },
  title: { fontSize: FONT_SIZES.xxxl, fontWeight: '800', color: COLORS.primary, marginBottom: SPACING.xs },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.xl },
  label: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.lg },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, height: 52, gap: SPACING.sm },
  input: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  btn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xxxl },
  btnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  footerText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  linkText: { color: COLORS.primary, fontSize: FONT_SIZES.md, fontWeight: '700' },
});
