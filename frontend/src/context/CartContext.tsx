import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { useAuth } from './AuthContext';

interface CartProduct {
  product_id: string;
  name: string;
  price: number;
  discount: number;
  images: string[];
  unit: string;
  variants?: { label: string; price: number; discount: number; stock: number }[];
}

interface CartItem {
  product_id: string;
  quantity: number;
  variant_label: string;
  product: CartProduct;
  subtotal: number;
}

interface CartContextType {
  items: CartItem[];
  total: number;
  loading: boolean;
  itemCount: number;
  refreshCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number, variantLabel?: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, variantLabel?: string) => Promise<void>;
  removeItem: (productId: string, variantLabel?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  getItemQuantity: (productId: string, variantLabel?: string) => number;
}

const CartContext = createContext<CartContextType>({
  items: [], total: 0, loading: false, itemCount: 0,
  refreshCart: async () => {}, addItem: async () => {},
  updateQuantity: async () => {}, removeItem: async () => {},
  clearCart: async () => {}, getItemQuantity: () => 0,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // pendingOps counts how many optimistic mutations are still in-flight.
  // refreshCart will NOT overwrite local state while this is > 0.
  const pendingOps = useRef(0);
  // debounce timer — reset on every new mutation, fires sync after quiet period
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // keep a stable ref to the latest user so refreshCart closure is never stale
  const userRef = useRef(user);
  userRef.current = user;

  const refreshCart = useCallback(async () => {
    if (!userRef.current) { setItems([]); setTotal(0); return; }
    // If there are still pending ops, skip — the timer will fire again after
    // the next op completes
    if (pendingOps.current > 0) return;
    try {
      setLoading(true);
      const data = await apiGet('/cart');
      // Double-check after the async gap — a new tap may have arrived
      if (pendingOps.current === 0) {
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      // Don't wipe local state on network error
    } finally {
      setLoading(false);
    }
  }, []); // stable — uses userRef, no deps needed

  // Schedule a server sync 1s after the last mutation completes.
  // Each completed op decrements pendingOps; sync only runs when it hits 0.
  const onOpComplete = useCallback(() => {
    pendingOps.current = Math.max(0, pendingOps.current - 1);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      // Only sync if all ops have settled
      if (pendingOps.current === 0) {
        refreshCart();
      }
    }, 1000);
  }, [refreshCart]);

  // Optimistic add — update UI instantly, sync after quiet period
  const addItem = async (productId: string, quantity = 1, variantLabel = '') => {
    pendingOps.current += 1;
    setItems(prev => {
      const existing = prev.find(
        i => i.product_id === productId && (i.variant_label || '') === variantLabel
      );
      if (existing) {
        return prev.map(i =>
          i.product_id === productId && (i.variant_label || '') === variantLabel
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, {
        product_id: productId,
        quantity,
        variant_label: variantLabel,
        product: { product_id: productId, name: '', price: 0, discount: 0, images: [], unit: '' },
        subtotal: 0,
      }];
    });
    apiPost('/cart/add', { product_id: productId, quantity, variant_label: variantLabel })
      .catch(() => {})
      .finally(onOpComplete);
  };

  // Optimistic update — set quantity instantly, sync after quiet period
  const updateQuantity = async (productId: string, quantity: number, variantLabel = '') => {
    if (quantity <= 0) {
      return removeItem(productId, variantLabel);
    }
    pendingOps.current += 1;
    setItems(prev =>
      prev.map(i =>
        i.product_id === productId && (i.variant_label || '') === variantLabel
          ? { ...i, quantity }
          : i
      )
    );
    apiPut('/cart/update', { product_id: productId, quantity, variant_label: variantLabel })
      .catch(() => {})
      .finally(onOpComplete);
  };

  // Optimistic remove
  const removeItem = async (productId: string, variantLabel = '') => {
    pendingOps.current += 1;
    setItems(prev =>
      prev.filter(
        i => !(i.product_id === productId && (i.variant_label || '') === variantLabel)
      )
    );
    apiDelete(`/cart/remove/${productId}?variant_label=${encodeURIComponent(variantLabel)}`)
      .catch(() => {})
      .finally(onOpComplete);
  };

  const clearCart = async () => {
    setItems([]); setTotal(0);
    await apiDelete('/cart/clear');
  };

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const getItemQuantity = useCallback((productId: string, variantLabel = '') => {
    const item = items.find(
      i => i.product_id === productId && (i.variant_label || '') === variantLabel
    );
    return item ? item.quantity : 0;
  }, [items]);

  return (
    <CartContext.Provider value={{
      items, total, loading, itemCount,
      refreshCart, addItem, updateQuantity, removeItem, clearCart, getItemQuantity,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
