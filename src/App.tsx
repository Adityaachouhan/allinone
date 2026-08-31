import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { useRoute, navigate } from '@/lib/router';
import { fetchCategories } from '@/lib/queries';
import type { Category } from '@/types';

import { CustomerLayout } from '@/components/CustomerLayout';
import { HomePage } from '@/pages/HomePage';
import { ProductListingPage } from '@/pages/ProductListingPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { OrderConfirmationPage } from '@/pages/OrderConfirmationPage';
import { AuthPage } from '@/pages/AuthPage';
import { AccountPage } from '@/pages/AccountPage';

import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminProductsPage } from '@/pages/admin/AdminProductsPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage';
import { AdminCustomersPage } from '@/pages/admin/AdminCustomersPage';
import { AdminBannersPage } from '@/pages/admin/AdminBannersPage';
import { AdminDeliveryPage } from '@/pages/admin/AdminDeliveryPage';
import { AdminStoreSettingsPage } from '@/pages/admin/AdminStoreSettingsPage';
import { PageSpinner } from '@/components/Feedback';

export default function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </StoreProvider>
  );
}

function AppRoutes() {
  const route = useRoute();
  const { role, loading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);

  // Load categories once for storefront layout
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const isAdminRoute = route.path.startsWith('/admin');
  const isAdminLogin = route.path === '/admin' || route.path === '/admin/';

  // --- Admin routes ---
  if (isAdminRoute && !isAdminLogin) {
    // Protect admin routes — require admin role
    if (loading) return <PageSpinner />;
    if (role !== 'admin') {
      navigate('/admin');
      return <PageSpinner />;
    }
    const page = renderAdminPage(route.path);
    return <AdminLayout>{page}</AdminLayout>;
  }

  if (isAdminLogin) {
    if (loading) return <PageSpinner />;
    if (role === 'admin') {
      navigate('/admin/dashboard');
      return <PageSpinner />;
    }
    return <AdminLoginPage />;
  }

  // --- Customer routes ---
  const page = renderCustomerPage(route.path, categories);
  return <CustomerLayout categories={categories}>{page}</CustomerLayout>;
}

function renderAdminPage(path: string) {
  switch (path) {
    case '/admin/dashboard':
      return <AdminDashboardPage />;
    case '/admin/products':
      return <AdminProductsPage />;
    case '/admin/categories':
      return <AdminCategoriesPage />;
    case '/admin/orders':
      return <AdminOrdersPage />;
    case '/admin/customers':
      return <AdminCustomersPage />;
    case '/admin/banners':
      return <AdminBannersPage />;
    case '/admin/delivery':
      return <AdminDeliveryPage />;
    case '/admin/store-settings':
      return <AdminStoreSettingsPage />;
    default:
      return <AdminDashboardPage />;
  }
}

function renderCustomerPage(path: string, categories: Category[]) {
  // Product detail: /product/:slug
  if (path.startsWith('/product/')) return <ProductDetailPage />;
  // Order confirmation: /order-confirmation/:orderNumber
  if (path.startsWith('/order-confirmation/')) return <OrderConfirmationPage />;
  // Category: /category/:slug
  if (path.startsWith('/category/')) return <ProductListingPage categories={categories} />;

  switch (path) {
    case '/':
      return <HomePage />;
    case '/search':
      return <ProductListingPage categories={categories} />;
    case '/cart':
      return <CartPage />;
    case '/checkout':
      return <CheckoutPage />;
    case '/login':
      return <AuthPage />;
    case '/account':
      return <AccountPage />;
    default:
      return <HomePage />;
  }
}
