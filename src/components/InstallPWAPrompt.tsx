/**
 * src/components/InstallPWAPrompt.tsx
 *
 * A beautiful bottom-slide-up banner that prompts users to install the store's PWA.
 *
 * Behaviour:
 * - Only shows on the customer storefront (not on /admin/* routes)
 * - On Android/Chrome/Edge: shows native "Install" button via beforeinstallprompt
 * - On iOS Safari: shows a manual instruction tooltip ("Tap Share → Add to Home Screen")
 * - Remembers dismissal in localStorage for 7 days — doesn't nag repeatedly
 * - Disappears automatically if app is already installed (standalone mode)
 * - Pulls the real store name + logo from the context so it's branded per tenant
 */

import { useState, useEffect } from 'react';
import { X, Download, Share, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useStoreSettings } from '@/context/StoreContext';
import { useRoute } from '@/lib/router';

const DISMISSED_KEY = 'pwa_prompt_dismissed_until';
const DISMISS_DAYS  = 7;

export function InstallPWAPrompt() {
  const { isInstallable, isIOS, isStandalone, triggerInstall } = usePWAInstall();
  const { storeSettings } = useStoreSettings();
  const route = useRoute();

  const [visible, setVisible]         = useState(false);
  const [showIOSTip, setShowIOSTip]   = useState(false);
  const [installing, setInstalling]   = useState(false);

  // Never show on admin routes or when already installed
  const isAdminRoute = route.path.startsWith('/admin');

  useEffect(() => {
    if (isAdminRoute || isStandalone) return;

    // Check if user dismissed recently
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    // Show immediately whenever the user opens the store (no delay)
    if (isInstallable || isIOS) {
      setVisible(true);
    }
  }, [isInstallable, isIOS, isAdminRoute, isStandalone]);

  const handleDismiss = () => {
    setVisible(false);
    setShowIOSTip(false);
    // Remember for 7 days
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
  };

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSTip((v) => !v);
      return;
    }
    setInstalling(true);
    await triggerInstall();
    setInstalling(false);
    setVisible(false);
  };

  if (!visible || isAdminRoute || isStandalone) return null;

  const storeName   = storeSettings.store_name || 'Grocery Mart';
  const themeColor  = storeSettings.theme_color || '#16a34a';
  const logoUrl     = storeSettings.logo_url || '';
  // Initials fallback
  const initials    = storeName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'G';

  return (
    <>
      {/* Backdrop blur on iOS tip */}
      {showIOSTip && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          onClick={() => setShowIOSTip(false)}
        />
      )}

      {/* iOS manual instruction tooltip */}
      {showIOSTip && (
        <div
          className="fixed bottom-28 left-4 right-4 z-[70] rounded-2xl bg-gray-900 p-5 text-white shadow-2xl"
          style={{ maxWidth: 380, margin: '0 auto' }}
        >
          <p className="mb-3 font-semibold text-sm">Install on iOS:</p>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold">1</span>
              Tap the <Share size={16} className="inline mx-1 text-blue-400" /> <strong className="text-white">Share</strong> button at the bottom of Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold">2</span>
              Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold">3</span>
              Tap <strong className="text-white">Add</strong> — done! 🎉
            </li>
          </ol>
          <button
            onClick={() => setShowIOSTip(false)}
            className="mt-4 w-full rounded-xl bg-white/10 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            Got it
          </button>
          {/* Downward pointing arrow */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
        </div>
      )}

      {/* Main install banner */}
      <div
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+64px)] left-3 right-3 z-50 lg:bottom-6 lg:left-auto lg:right-6 lg:w-80"
        style={{ animation: 'slideUpBanner 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <style>{`
          @keyframes slideUpBanner {
            from { opacity: 0; transform: translateY(24px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0)    scale(1); }
          }
        `}</style>

        <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)' }}
        >
          {/* Top color accent bar */}
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }} />

          <div className="flex items-center gap-3 p-4">
            {/* Store icon */}
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl p-1.5 text-white shadow-lg border border-black/5"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
            >
              {logoUrl ? (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-white p-1 shadow-inner overflow-hidden">
                  <img
                    src={logoUrl}
                    alt={storeName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <span className="text-xl font-bold">{initials}</span>
              )}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">
                Install <span style={{ color: themeColor }}>{storeName}</span>
              </p>
              <p className="mt-0.5 text-xs text-gray-500 leading-tight">
                {isIOS
                  ? 'Add to your home screen for a faster experience'
                  : 'Add to home screen — works offline too'}
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="ml-1 shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X size={16} />
            </button>
          </div>

          {/* Action button */}
          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
            >
              {isIOS ? (
                <>
                  <Share size={16} />
                  How to Install on iOS
                </>
              ) : installing ? (
                <>
                  <Smartphone size={16} className="animate-pulse" />
                  Installing…
                </>
              ) : (
                <>
                  <Download size={16} />
                  Install App — It's Free
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
