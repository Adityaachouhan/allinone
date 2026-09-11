/**
 * src/hooks/usePWAInstall.ts
 *
 * Custom hook that manages the PWA installation lifecycle:
 * - Captures the `beforeinstallprompt` event (Chrome/Edge/Android)
 * - Exposes `triggerInstall()` to show the native install dialog
 * - Detects if app is already installed (standalone mode)
 * - Detects iOS Safari (which doesn't support beforeinstallprompt)
 */

import { useEffect, useState, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAInstallState {
  /** True when Chrome/Edge/Android deferred prompt is ready */
  isInstallable: boolean;
  /** True when running on iOS Safari (manual instruction required) */
  isIOS: boolean;
  /** True when already running in standalone (installed) mode */
  isStandalone: boolean;
  /** Call this to trigger the native install prompt */
  triggerInstall: () => Promise<void>;
}

export function usePWAInstall(): PWAInstallState {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Detect iOS
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(navigator as Navigator & { standalone?: boolean }).standalone;

  // Detect standalone mode (already installed)
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  useEffect(() => {
    if (isStandalone) return; // Already installed — don't intercept

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const installedHandler = () => {
      setIsInstallable(false);
      deferredPrompt.current = null;
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isStandalone]);

  const triggerInstall = async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      deferredPrompt.current = null;
    }
  };

  return { isInstallable, isIOS, isStandalone, triggerInstall };
}
