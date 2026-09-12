import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as db from '@/lib/db';
import type { StoreSettings } from '@/types';
import { applyThemeColor, getCachedThemeColor } from '@/lib/theme';

export const STORE_SETTINGS_CACHE_KEY = 'aio_store_settings';

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store_name: '',
  tagline: '',
  logo_url: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  return_policy: '',
  grievance_officer: '',
  delivery_areas: '',
  theme_color: '#16a34a',
};

function getInitialStoreSettings(): StoreSettings {
  if (typeof window === 'undefined') return DEFAULT_STORE_SETTINGS;
  try {
    const raw = localStorage.getItem(STORE_SETTINGS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_STORE_SETTINGS,
          ...parsed,
          theme_color: parsed.theme_color || getCachedThemeColor() || DEFAULT_STORE_SETTINGS.theme_color,
        };
      }
    }
    const cachedColor = getCachedThemeColor();
    if (cachedColor) {
      return { ...DEFAULT_STORE_SETTINGS, theme_color: cachedColor };
    }
  } catch {
    // Fall back to default
  }
  return DEFAULT_STORE_SETTINGS;
}

type StoreContextValue = {
  storeSettings: StoreSettings;
  loading: boolean;
  refreshStoreSettings: () => Promise<void>;
  updateStoreSettings: (patch: Partial<StoreSettings>) => Promise<StoreSettings>;
};

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => getInitialStoreSettings());
  const [loading, setLoading] = useState(true);

  const fetchStoreSettings = async () => {
    try {
      const data = await db.getPublicStoreSettings();
      if (data && typeof data === 'object') {
        const sanitized: StoreSettings = {
          store_name: typeof data.store_name === 'string' ? data.store_name.trim() : '',
          tagline: typeof data.tagline === 'string' ? data.tagline : 'Grocery Mart',
          logo_url: data.logo_url ?? '',
          phone: typeof data.phone === 'string' ? data.phone.trim() : '',
          email: typeof data.email === 'string' ? data.email.trim() : '',
          address: typeof data.address === 'string' ? data.address.trim() : '',
          gstin: data.gstin ?? '',
          return_policy: data.return_policy ?? '',
          grievance_officer: data.grievance_officer ?? '',
          delivery_areas: data.delivery_areas ?? '',
          theme_color: typeof data.theme_color === 'string' && data.theme_color ? data.theme_color : '#16a34a',
        };
        setStoreSettings(sanitized);
        try {
          localStorage.setItem(STORE_SETTINGS_CACHE_KEY, JSON.stringify(sanitized));
        } catch {
          // Ignore storage quota error
        }
      }
    } catch (err) {
      console.warn('Could not fetch latest store settings (offline), using cached settings:', err);
      try {
        const raw = localStorage.getItem(STORE_SETTINGS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            setStoreSettings((prev) => ({
              ...prev,
              ...parsed,
            }));
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreSettings();

    const handleOnline = () => {
      fetchStoreSettings();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Update browser document title dynamically
  useEffect(() => {
    if (storeSettings.store_name) {
      document.title = `${storeSettings.store_name}${storeSettings.tagline ? ' - ' + storeSettings.tagline : ''}`;
    }
  }, [storeSettings.store_name, storeSettings.tagline]);

  // Apply dynamic theme color CSS variables across entire app
  useEffect(() => {
    applyThemeColor(storeSettings.theme_color || '#16a34a');
  }, [storeSettings.theme_color]);

  const updateSettings = async (patch: Partial<StoreSettings>): Promise<StoreSettings> => {
    const updated = await db.updateStoreSettings(patch);
    setStoreSettings((prev) => {
      const merged = {
        ...prev,
        ...updated,
      };
      try {
        localStorage.setItem(STORE_SETTINGS_CACHE_KEY, JSON.stringify(merged));
      } catch {
        // Ignore storage quota error
      }
      return merged;
    });
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
