import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../src/constants/theme';
import { apiGet, apiPut } from '../src/utils/api';

const ICON_MAP: Record<string, string> = {
  order: 'receipt-outline',
  promo: 'megaphone-outline',
  admin: 'shield-outline',
  general: 'notifications-outline',
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const d = await apiGet('/notifications');
      setNotifications(d.notifications || []);
      await apiPut('/notifications/read-all');
    } catch {}
  };

  useEffect(() => { fetchNotifications(); }, []);

  const onRefresh = async () => { setRefreshing(true); await fetchNotifications(); setRefreshing(false); };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item, i) => item.notification_id || String(i)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={56} color={COLORS.border} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`notif-${item.notification_id}`}
            style={[styles.card, !item.read && styles.unread]}
            onPress={() => {
              if (item.data?.order_id) router.push(`/order/${item.data.order_id}`);
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.read ? COLORS.muted : COLORS.primary + '15' }]}>
              <Ionicons name={(ICON_MAP[item.type] || 'notifications-outline') as any} size={22} color={item.read ? COLORS.textSecondary : COLORS.primary} />
            </View>
            <View style={styles.content}>
              <Text style={[styles.notifTitle, !item.read && styles.bold]}>{item.title}</Text>
              <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.primary },
  list: { padding: SPACING.xl },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: SPACING.md },
  emptyText: { fontSize: FONT_SIZES.lg, color: COLORS.textSecondary },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, gap: SPACING.md },
  unread: { borderColor: COLORS.primary + '40', backgroundColor: COLORS.primary + '05' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  notifTitle: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, marginBottom: 2 },
  bold: { fontWeight: '700' },
  notifBody: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 18 },
  time: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent, marginTop: 4 },
});
