import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { registerForPushNotifications, addNotificationReceivedListener, addNotificationResponseListener } from '../src/utils/notifications';
import { useRouter } from 'expo-router';

export default function RootLayout() {
  const notifListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    // Register for push notifications (only on native devices)
    if (Platform.OS !== 'web') {
      registerForPushNotifications();
    }

    // Listen for incoming notifications
    notifListener.current = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content.title);
    });

    // Listen for notification taps
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.order_id) {
        // Navigation handled by notification tap
        console.log('Navigate to order:', data.order_id);
      }
    });

    return () => {
      if (notifListener.current) notifListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="search" options={{ presentation: 'card' }} />
          <Stack.Screen name="checkout" options={{ presentation: 'card' }} />
          <Stack.Screen name="orders" options={{ presentation: 'card' }} />
          <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="addresses" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin" options={{ presentation: 'card' }} />
          <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin-products" options={{ presentation: 'card' }} />
        </Stack>
      </CartProvider>
    </AuthProvider>
  );
}
