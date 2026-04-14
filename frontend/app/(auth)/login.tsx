import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password) { Alert.alert('Error', 'Please fill in all fields'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    try {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = Linking.createURL('auth-callback');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const sessionId = result.url.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          setLoading(true);
          await loginWithGoogle(sessionId);
          router.replace('/(tabs)');
        }
      }
    } catch (e: any) {
      Alert.alert('Google Login Failed', e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Image source={{ uri: 'https://customer-assets.emergentagent.com/job_freshmart-mobile-1/artifacts/5ry3wzoh_Screenshot%202026-03-26%20093246.png' }} style={styles.logoImg} resizeMode="contain" />
            </View>
            <Text style={styles.title}>Awantika Grocers</Text>
            <Text style={styles.subtitle}>Fresh groceries delivered to your door</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
              <TextInput testID="login-email-input" style={styles.input} placeholder="Enter your email" placeholderTextColor={COLORS.textSecondary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
              <TextInput testID="login-password-input" style={styles.input} placeholder="Enter your password" placeholderTextColor={COLORS.textSecondary} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity testID="forgot-password-link" onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity testID="login-submit-btn" style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} /><Text style={styles.orText}>OR</Text><View style={styles.line} />
            </View>

            <TouchableOpacity testID="google-login-btn" style={styles.googleBtn} onPress={handleGoogleLogin}>
              <Ionicons name="logo-google" size={20} color={COLORS.textPrimary} />
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity testID="register-link" onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.linkText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: SPACING.xl },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  logoWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.muted, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, overflow: 'hidden' },
  logoImg: { width: 72, height: 72 },
  title: { fontSize: FONT_SIZES.title, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginTop: SPACING.xs },
  form: {},
  label: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.lg },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, height: 52, gap: SPACING.sm },
  input: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  forgotText: { color: COLORS.accent, fontSize: FONT_SIZES.sm, fontWeight: '600', textAlign: 'right', marginTop: SPACING.sm },
  btn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.xl },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { marginHorizontal: SPACING.lg, color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  googleText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  footerText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  linkText: { color: COLORS.primary, fontSize: FONT_SIZES.md, fontWeight: '700' },
});
