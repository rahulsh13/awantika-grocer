import React, { createContext, useContext, useState, useCallback } from 'react';
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

  const refreshCart = useCallback(async () => {
    if (!user) { setItems([]); setTotal(0); return; }
    try {
      setLoading(true);
      const data = await apiGet('/cart');
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Optimistic add — update UI instantly, sync with server in background
  const addItem = async (productId: string, quantity = 1, variantLabel = '') => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === productId && (i.variant_label || '') === variantLabel);
      if (existing) {
        return prev.map(i =>
          i.product_id === productId && (i.variant_label || '') === variantLabel
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      // Add placeholder item — will be replaced by refreshCart
      return [...prev, {
        product_id: productId,
        quantity,
        variant_label: variantLabel,
        product: { product_id: productId, name: '', price: 0, discount: 0, images: [], unit: '' },
        subtotal: 0,
      }];
    });
    // Sync with server, then refresh to get correct product details & subtotals
    apiPost('/cart/add', { product_id: productId, quantity, variant_label: variantLabel })
      .then(() => refreshCart())
      .catch(() => refreshCart()); // revert on error
  };

  // Optimistic update — change quantity instantly
  const updateQuantity = async (productId: string, quantity: number, variantLabel = '') => {
    if (quantity <= 0) {
      return removeItem(productId, variantLabel);
    }
    setItems(prev =>
      prev.map(i =>
        i.product_id === productId && (i.variant_label || '') === variantLabel
          ? { ...i, quantity }
          : i
      )
    );
    apiPut('/cart/update', { product_id: productId, quantity, variant_label: variantLabel })
      .then(() => refreshCart())
      .catch(() => refreshCart());
  };

  // Optimistic remove — remove instantly from UI
  const removeItem = async (productId: string, variantLabel = '') => {
    setItems(prev =>
      prev.filter(i => !(i.product_id === productId && (i.variant_label || '') === variantLabel))
    );
    apiDelete(`/cart/remove/${productId}?variant_label=${encodeURIComponent(variantLabel)}`)
      .then(() => refreshCart())
      .catch(() => refreshCart());
  };

  const clearCart = async () => {
    setItems([]); setTotal(0);
    await apiDelete('/cart/clear');
  };

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const getItemQuantity = useCallback((productId: string, variantLabel = '') => {
    const item = items.find(i => i.product_id === productId && (i.variant_label || '') === variantLabel);
    return item ? item.quantity : 0;
  }, [items]);

  return (
    <CartContext.Provider value={{ items, total, loading, itemCount, refreshCart, addItem, updateQuantity, removeItem, clearCart, getItemQuantity }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
