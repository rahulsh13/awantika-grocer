import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../src/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View testID="not-found-screen" style={styles.container}>
      <Ionicons name="alert-circle-outline" size={64} color={COLORS.border} />
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.subtitle}>The page you're looking for doesn't exist</Text>
      <TouchableOpacity testID="go-home-btn" style={styles.btn} onPress={() => router.replace('/')}>
        <Text style={styles.btnText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  btn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, marginTop: SPACING.lg },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.md },
});
