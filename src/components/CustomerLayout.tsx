import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import type { Category } from '@/types';

export function CustomerLayout({
  children,
  categories,
}: {
  children: ReactNode;
  categories: Category[];
}) {
  return (
    // min-h-dvh: iOS Safari fix — 100dvh excludes the floating address bar
    // pb-[calc(64px+env(safe-area-inset-bottom))]: room for bottom nav + iPhone home indicator
    <div className="min-h-dvh flex flex-col w-full max-w-full overflow-x-hidden pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
      <Header categories={categories} />
      <main className="flex-1 w-full max-w-full min-w-0">{children}</main>
      <Footer categories={categories} />
      <MobileBottomNav />
    </div>
  );
}

