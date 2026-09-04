import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as db from '@/lib/db';
import type { StoreSettings } from '@/types';

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store_name: 'All In One',
  tagline: 'Grocery Mart',
  logo_url: '',
  phone: '+91 8340461426',
  email: 'hello@allinone.shop',
  address: 'Kagalnagar, Sonari, Jamshedpur, Jharkhand 831011',
  gstin: '',
  return_policy: '',
  grievance_officer: '',
  delivery_areas: '',
};

type StoreContextValue = {
  storeSettings: StoreSettings;
  loading: boolean;
  refreshStoreSettings: () => Promise<void>;
  updateStoreSettings: (patch: Partial<StoreSettings>) => Promise<StoreSettings>;
};

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchStoreSettings = async () => {
    try {
      const data = await db.getPublicStoreSettings();
      if (data && typeof data === 'object') {
        setStoreSettings({
          store_name: typeof data.store_name === 'string' && data.store_name.trim() !== '' ? data.store_name.trim() : DEFAULT_STORE_SETTINGS.store_name,
          tagline: typeof data.tagline === 'string' ? data.tagline : DEFAULT_STORE_SETTINGS.tagline,
          logo_url: data.logo_url ?? DEFAULT_STORE_SETTINGS.logo_url,
          phone: typeof data.phone === 'string' && data.phone.trim() !== '' ? data.phone.trim() : DEFAULT_STORE_SETTINGS.phone,
          email: typeof data.email === 'string' && data.email.trim() !== '' ? data.email.trim() : DEFAULT_STORE_SETTINGS.email,
          address: typeof data.address === 'string' && data.address.trim() !== '' ? data.address.trim() : DEFAULT_STORE_SETTINGS.address,
          gstin: data.gstin ?? DEFAULT_STORE_SETTINGS.gstin,
          return_policy: data.return_policy ?? DEFAULT_STORE_SETTINGS.return_policy,
          grievance_officer: data.grievance_officer ?? DEFAULT_STORE_SETTINGS.grievance_officer,
          delivery_areas: data.delivery_areas ?? DEFAULT_STORE_SETTINGS.delivery_areas,
        });
      }
    } catch (err) {
      console.error('Failed to load store settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreSettings();
  }, []);

  // Update browser document title dynamically
  useEffect(() => {
    if (storeSettings.store_name) {
      document.title = `${storeSettings.store_name} - ${storeSettings.tagline || 'Grocery Mart'}`;
    }
  }, [storeSettings.store_name, storeSettings.tagline]);

  const updateSettings = async (patch: Partial<StoreSettings>): Promise<StoreSettings> => {
    const updated = await db.updateStoreSettings(patch);
    setStoreSettings((prev) => ({
      ...prev,
      ...updated,
    }));
    return updated;
  };

  return (
    <StoreContext.Provider
      value={{
        storeSettings,
        loading,
        refreshStoreSettings: fetchStoreSettings,
        updateStoreSettings: updateSettings,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStoreSettings() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStoreSettings must be used within StoreProvider');
  return ctx;
}
