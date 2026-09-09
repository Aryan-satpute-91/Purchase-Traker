import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';

const AuthPage = lazy(() => import('@/pages/auth/AuthPage').then((m) => ({ default: m.AuthPage })));
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AddPurchasePage = lazy(() => import('@/pages/purchases/AddPurchasePage').then((m) => ({ default: m.AddPurchasePage })));
const PurchaseDetailPage = lazy(() => import('@/pages/purchases/PurchaseDetailPage').then((m) => ({ default: m.PurchaseDetailPage })));
const AllPurchasesPage = lazy(() => import('@/pages/purchases/AllPurchasesPage').then((m) => ({ default: m.AllPurchasesPage })));
const ProjectsListPage = lazy(() => import('@/pages/projects/ProjectsListPage').then((m) => ({ default: m.ProjectsListPage })));
const ProjectDetailPage = lazy(() => import('@/pages/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const InventoryPage = lazy(() => import('@/pages/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const TimeTrackingPage = lazy(() => import('@/pages/time-tracking/TimeTrackingPage').then((m) => ({ default: m.TimeTrackingPage })));
const DocumentsVaultPage = lazy(() => import('@/pages/documents/DocumentsVaultPage').then((m) => ({ default: m.DocumentsVaultPage })));
const SellersPage = lazy(() => import('@/pages/sellers/SellersPage').then((m) => ({ default: m.SellersPage })));
const PriceComparisonsPage = lazy(() => import('@/pages/pricing/PriceComparisonsPage').then((m) => ({ default: m.PriceComparisonsPage })));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const WarrantyPage = lazy(() => import('@/pages/warranty/WarrantyPage').then((m) => ({ default: m.WarrantyPage })));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-6 h-6 border-2 border-accent-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const ALLOWED_EMAILS = [
  'aryansatpute97@gmail.com',
  'nishantpawade77@gmail.com',
];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const hasAuthParams =
    typeof window !== 'undefined' &&
    (window.location.search.includes('code=') ||
      window.location.hash.includes('access_token='));

  if (loading || (!user && hasAuthParams)) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent-600 flex items-center justify-center animate-pulse">
            <span className="text-white text-sm font-bold">PT</span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const userEmail = user.email?.toLowerCase();
  const isAllowed = userEmail && ALLOWED_EMAILS.includes(userEmail);

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-accent-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-card-lg border border-surface-200 p-8 max-w-md w-full text-center animate-scale-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4 text-2xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            This purchase tracker is private and configured for team members:
            <br />
            <strong className="text-slate-800">aryansatpute97@gmail.com</strong> and <strong className="text-slate-800">nishantpawade77@gmail.com</strong>.
          </p>
          <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs text-slate-500 mb-6">
            Signed in as: <span className="font-semibold text-slate-800">{user.email}</span>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            Sign out & Switch Account
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const hasAuthParams =
    typeof window !== 'undefined' &&
    (window.location.search.includes('code=') ||
      window.location.hash.includes('access_token='));

  if (loading || hasAuthParams) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent-600 flex items-center justify-center animate-pulse">
            <span className="text-white text-sm font-bold">PT</span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  // Initialize auth listener
  useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Protected */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Purchases */}
        <Route path="/purchases" element={<AllPurchasesPage />} />
        <Route path="/purchases/new" element={<AddPurchasePage />} />
        <Route path="/purchases/:id" element={<PurchaseDetailPage />} />
        <Route path="/purchases/:id/edit" element={<AddPurchasePage />} />

        {/* Projects */}
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />

        {/* Other pages */}
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/time-tracking" element={<TimeTrackingPage />} />
        <Route path="/documents" element={<DocumentsVaultPage />} />
        <Route path="/sellers" element={<SellersPage />} />
        <Route path="/price-comparisons" element={<PriceComparisonsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/warranty" element={<WarrantyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <AppRoutes />
        </Suspense>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#1e293b',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '14px',
              boxShadow: '0 4px 12px 0 rgba(0,0,0,0.10)',
              padding: '12px 16px',
            },
            success: {
              iconTheme: { primary: '#4f46e5', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
