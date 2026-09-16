import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import type { CartItem, Product } from '@/types';
import * as db from '@/lib/db';
import { isProductAvailable } from '@/lib/utils';
import { AlertTriangle, X } from 'lucide-react';

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: Product, quantity?: number) => Promise<boolean>;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => Promise<boolean>;
  clear: () => void;
  getQuantity: (productId: string) => number;
  stockNotice: string | null;
  setStockNotice: (msg: string | null) => void;
  recheckAllCartItems: () => Promise<boolean>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = 'aio_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  const [stockNotice, setStockNoticeState] = useState<string | null>(null);
  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const setStockNotice = (msg: string | null) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setStockNoticeState(msg);
    if (msg) {
      noticeTimerRef.current = setTimeout(() => {
        setStockNoticeState(null);
      }, 4500);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items]);

  useEffect(() => {
    const handleSignOut = () => {
      setItems([]);
    };
    window.addEventListener('aio_signout', handleSignOut);
    return () => window.removeEventListener('aio_signout', handleSignOut);
  }, []);

  const checkStockAndValidate = async (
    productId: string,
    requestedQty: number,
    fallbackProduct: Product,
    currentInCartQty = 0,
  ) => {
    let liveProduct = await db.getProductById(productId);
    if (!liveProduct) {
      liveProduct = fallbackProduct;
    }

    const available = isProductAvailable(liveProduct);
    if (!available || liveProduct.stock_quantity <= 0) {
      setStockNotice(`Sorry! "${liveProduct.name}" is currently out of stock.`);
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
      return { ok: false, liveProduct, allowedQty: 0 };
    }

    if (requestedQty > liveProduct.stock_quantity) {
      if (currentInCartQty >= liveProduct.stock_quantity) {
        setStockNotice(
          `Maximum Stock Reached: You already have all ${liveProduct.stock_quantity} available unit(s) of "${liveProduct.name}" in your cart.`,
        );
      } else {
        setStockNotice(
          `Limited Stock: Only ${liveProduct.stock_quantity} unit(s) of "${liveProduct.name}" available.`,
        );
      }
      return { ok: false, liveProduct, allowedQty: liveProduct.stock_quantity };
    }

    return { ok: true, liveProduct, allowedQty: requestedQty };
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const addItem = async (product: Product, quantity = 1): Promise<boolean> => {
    const existing = items.find((i) => i.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const targetQty = currentQty + quantity;

    const result = await checkStockAndValidate(product.id, targetQty, product, currentQty);

    if (result.allowedQty <= 0) {
      return false;
    }

    setItems((prev) => {
      const ex = prev.find((i) => i.product.id === product.id);
      if (ex) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, product: { ...i.product, ...result.liveProduct }, quantity: result.allowedQty }
            : i,
        );
      }
      return [...prev, { product: result.liveProduct, quantity: result.allowedQty }];
    });

    return result.ok;
  };

  const updateQuantity = async (productId: string, quantity: number): Promise<boolean> => {
    if (quantity <= 0) {
      removeItem(productId);
      return true;
    }

    const existing = items.find((i) => i.product.id === productId);
    if (!existing) return false;
    const currentQty = existing.quantity;

    const result = await checkStockAndValidate(productId, quantity, existing.product, currentQty);

    if (result.allowedQty <= 0) {
      return false;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, product: { ...i.product, ...result.liveProduct }, quantity: result.allowedQty }
          : i,
      ),
    );

    return result.ok;
  };

  const recheckAllCartItems = async (): Promise<boolean> => {
    if (items.length === 0) return true;
    try {
      // Fetch only the products actually in the cart — not all 6k products
      const liveProducts = await Promise.all(
        items.map((item) => db.getProductById(item.product.id))
      );
      let allValid = true;
      let noticeMsg: string | null = null;

      setItems((prev) => {
        const next: CartItem[] = [];
        for (let i = 0; i < prev.length; i++) {
          const item = prev[i];
          const live = liveProducts[i];
          if (!live || !isProductAvailable(live) || live.stock_quantity <= 0) {
            allValid = false;
            noticeMsg = `Notice: "${item.product.name}" in your cart is out of stock and was removed.`;
          } else if (item.quantity > live.stock_quantity) {
            allValid = false;
            noticeMsg = `Notice: Only ${live.stock_quantity} unit(s) of "${item.product.name}" remain in stock.`;
            next.push({ product: live, quantity: live.stock_quantity });
          } else {
            next.push({ product: live, quantity: item.quantity });
          }
        }
        return next;
      });

      if (noticeMsg) {
        setStockNotice(noticeMsg);
      }

      return allValid;
    } catch {
      return true;
    }
  };

  const clear = () => setItems([]);

  const getQuantity = (productId: string) =>
    items.find((i) => i.product.id === productId)?.quantity ?? 0;

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount,
      subtotal,
      addItem,
      removeItem,
      updateQuantity,
      clear,
      getQuantity,
      stockNotice,
      setStockNotice,
      recheckAllCartItems,
    }),
    [items, itemCount, subtotal, stockNotice],
  );

  return (
    <CartContext.Provider value={value}>
      {children}

      {/* Real-time Out-of-Stock Alert Toast */}
      {stockNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-red-600 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-red-500 animate-slide-down max-w-md w-[90vw] text-sm font-medium">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
          <span className="flex-1">{stockNotice}</span>
          <button
            onClick={() => setStockNotice(null)}
            className="p-1 hover:bg-red-700 rounded-lg transition-colors"
            aria-label="Close notice"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
