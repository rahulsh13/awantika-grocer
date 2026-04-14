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
}

interface CartItem {
  product_id: string;
  quantity: number;
  product: CartProduct;
  subtotal: number;
}

interface CartContextType {
  items: CartItem[];
  total: number;
  loading: boolean;
  itemCount: number;
  refreshCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  getItemQuantity: (productId: string) => number;
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

  const addItem = async (productId: string, quantity = 1) => {
    await apiPost('/cart/add', { product_id: productId, quantity });
    await refreshCart();
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    await apiPut('/cart/update', { product_id: productId, quantity });
    await refreshCart();
  };

  const removeItem = async (productId: string) => {
    await apiDelete(`/cart/remove/${productId}`);
    await refreshCart();
  };

  const clearCart = async () => {
    await apiDelete('/cart/clear');
    setItems([]); setTotal(0);
  };

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const getItemQuantity = useCallback((productId: string) => {
    const item = items.find(i => i.product_id === productId);
    return item ? item.quantity : 0;
  }, [items]);

  return (
    <CartContext.Provider value={{ items, total, loading, itemCount, refreshCart, addItem, updateQuantity, removeItem, clearCart, getItemQuantity }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
