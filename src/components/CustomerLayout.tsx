import { useEffect, type ReactNode } from 'react';
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
  // Ensure the page renders with hash route
  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '/';
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col pb-20 lg:pb-0">
      <Header categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer categories={categories} />
      <MobileBottomNav />
    </div>
  );
}
