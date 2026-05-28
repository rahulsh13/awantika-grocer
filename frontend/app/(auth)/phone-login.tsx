import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { apiPost } from '../../src/utils/api';
import { useAuth } from '../../src/context/AuthContext';

type Step = 'phone' | 'otp' | 'name';

export default function PhoneLoginScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const { loginWithPhone } = useAuth();
  const router = useRouter();

  // Format phone to E.164 — prepend +91 if no country code
  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+')) return raw.replace(/\s/g, '');
    if (digits.length === 10) return `+91${digits}`;
    return `+${digits}`;
  };

  const handleSendOTP = async () => {
    const formatted = formatPhone(phone);
    if (formatted.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const resp = await apiPost('/auth/phone/send-otp', { phone: formatted });
      // Dev mode — auto-fill OTP if returned
      if (resp.dev_otp) {
        const digits = resp.dev_otp.toString().split('');
        setOtp(digits);
        Alert.alert('Dev Mode', `OTP: ${resp.dev_otp}\n(Auto-filled for testing)`);
      }
      setStep('otp');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await loginWithPhone(formatPhone(phone), code, name || undefined);
    } catch (e: any) {
      // If new user needs a name, prompt for it
      if (e.message?.includes('name') || isNewUser) {
        setIsNewUser(true);
        setStep('name');
      } else {
        Alert.alert('Verification Failed', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWithName = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name to continue.');
      return;
    }
    setLoading(true);
    try {
      await loginWithPhone(formatPhone(phone), otp.join(''), name.trim());
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // only last char
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => step === 'phone' ? router.back() : setStep('phone')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.logoWrap}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logoImg} resizeMode="contain" />
            </View>
            <Text style={styles.title}>
              {step === 'phone' ? 'Login with Phone' : step === 'otp' ? 'Enter OTP' : 'Your Name'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'phone'
                ? 'We\'ll send a 6-digit code to your number'
                : step === 'otp'
                ? `Code sent to ${formatPhone(phone)}`
                : 'Just one more step to complete your profile'}
            </Text>
          </View>

          {/* Step: Phone */}
          {step === 'phone' && (
            <View style={styles.form}>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  testID="phone-input"
                  style={styles.phoneInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={COLORS.textSecondary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                testID="send-otp-btn"
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleSendOTP}
                disabled={loading}
              >
                <Text style={styles.btnText}>{loading ? 'Sending...' : 'Send OTP'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step: OTP */}
          {step === 'otp' && (
            <View style={styles.form}>
              <Text style={styles.label}>Enter 6-digit OTP</Text>
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={ref => { otpRefs.current[i] = ref; }}
                    testID={`otp-input-${i}`}
                    style={[styles.otpBox, digit && styles.otpBoxFilled]}
                    value={digit}
                    onChangeText={v => handleOtpChange(v, i)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity
                testID="verify-otp-btn"
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading}
              >
                <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify OTP'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="resend-otp-btn"
                style={styles.resendBtn}
                onPress={() => { setOtp(['', '', '', '', '', '']); handleSendOTP(); }}
              >
                <Text style={styles.resendText}>Didn't receive? Resend OTP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step: Name (new user) */}
          {step === 'name' && (
            <View style={styles.form}>
              <Text style={styles.label}>Your Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
                <TextInput
                  testID="name-input"
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                testID="submit-name-btn"
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleSubmitWithName}
                disabled={loading}
              >
                <Text style={styles.btnText}>{loading ? 'Creating account...' : 'Continue'}</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: SPACING.xl },
  header: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: SPACING.lg },
  logoWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.muted, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, overflow: 'hidden' },
  logoImg: { width: 64, height: 64 },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
  form: {},
  label: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.lg },
  phoneRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  countryCode: { backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, height: 52, justifyContent: 'center' },
  countryCodeText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  phoneInput: { flex: 1, backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, height: 52, fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, letterSpacing: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.muted, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, height: 52, gap: SPACING.sm },
  input: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xl },
  otpBox: { width: 48, height: 56, borderRadius: BORDER_RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.muted, textAlign: 'center', fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: '#1E3F2010' },
  btn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  resendBtn: { alignItems: 'center', marginTop: SPACING.xl },
  resendText: { color: COLORS.accent, fontSize: FONT_SIZES.md, fontWeight: '600' },
});
