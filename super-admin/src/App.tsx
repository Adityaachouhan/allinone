import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TenantsListPage } from './pages/TenantsListPage';
import { TenantDetailPage } from './pages/TenantDetailPage';
import { OnboardTenantPage } from './pages/OnboardTenantPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SuperAdminLayout } from './components/SuperAdminLayout';

type Page = 'dashboard' | 'tenants' | 'tenant-detail' | 'onboard' | 'audit';

function AppRoutes() {
  const { admin, loading } = useAuth();
  const [page, setPage]           = useState<Page>('dashboard');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!admin) return <LoginPage />;

  const navigate = (p: Page, tenantId?: string) => {
    setPage(p);
    if (tenantId) setSelectedTenantId(tenantId);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage onNavigate={navigate} />;
      case 'tenants':   return <TenantsListPage onNavigate={navigate} />;
      case 'tenant-detail':
        return selectedTenantId
          ? <TenantDetailPage tenantId={selectedTenantId} onBack={() => navigate('tenants')} />
          : <TenantsListPage onNavigate={navigate} />;
      case 'onboard':   return <OnboardTenantPage onBack={() => navigate('tenants')} onSuccess={(id) => navigate('tenant-detail', id)} />;
      case 'audit':     return <AuditLogPage />;
      default:          return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <SuperAdminLayout page={page} onNavigate={navigate}>
      {renderPage()}
    </SuperAdminLayout>
  );
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
