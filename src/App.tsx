import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AppShell from './components/layout/AppShell';
import { useAuth } from './hooks/auth/useAuth';
import AuthProvider from './providers/AuthProvider';

// Land Records Module Pages
import LandRecordsPage from './pages/land-records/LandRecordsPage';
import LandRecordDetailsPage from './pages/land-records/LandRecordDetailsPage';
import CreateLandRecordPage from './pages/land-records/CreateLandRecordPage';
import EditLandRecordPage from './pages/land-records/EditLandRecordPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import DocumentDetailsPage from './pages/documents/DocumentDetailsPage';
import VerificationPage from './pages/verification/VerificationPage';
import VerificationDetailsPage from './pages/verification/VerificationDetailsPage';
import DuplicatesPage from './pages/duplicates/DuplicatesPage';
import DuplicateDetailsPage from './pages/duplicates/DuplicateDetailsPage';
import RiskIntelligencePage from './pages/risk/RiskIntelligencePage';
import RiskDetailsPage from './pages/risk/RiskDetailsPage';
import MonitoringPage from './pages/monitoring/MonitoringPage';
import AlertDetailsPage from './pages/monitoring/AlertDetailsPage';
import NotificationsPage from './pages/monitoring/NotificationsPage';
import WatchlistsPage from './pages/monitoring/WatchlistsPage';
import WatchlistDetailsPage from './pages/monitoring/WatchlistDetailsPage';
import GISMappingPage from './pages/gis/GISMappingPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import BhoomiVoicePage from './pages/assistant/BhoomiVoicePage';
import UsersPage from './pages/users/UsersPage';

import AuditLogsPage from './pages/audit/AuditLogsPage';
import SettingsPage from './pages/settings/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, error, phase } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {phase === 'loading_profile' && 'Loading your account profile...'}
            {phase === 'loading_role' && 'Loading your assigned role...'}
            {phase === 'loading_permissions' && 'Loading your access permissions...'}
            {phase === 'authenticating' && 'Checking your session...'}
          </p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={error ? { authError: error } : undefined} />;
  return <>{children}</>;
}

function RiskIntelligenceDetailsRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/risk/${id}` : '/risk'} replace />;
}

function PermissionRoute({
  permission,
  role,
  children,
}: {
  permission: string;
  role?: string;
  children: React.ReactNode;
}) {
  const { hasPermission, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!hasPermission(permission) || (role && user?.role.code !== role)) {
    return (
      <div role="alert" className="flex h-full min-h-[40vh] items-center justify-center p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h1 className="font-semibold text-destructive">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            
            {/* Land Records Module */}
            <Route path="land-records">
              <Route index element={<PermissionRoute permission="land_record:read"><LandRecordsPage /></PermissionRoute>} />
              <Route path="new" element={<PermissionRoute permission="land_record:create"><CreateLandRecordPage /></PermissionRoute>} />
              <Route path=":id" element={<PermissionRoute permission="land_record:read"><LandRecordDetailsPage /></PermissionRoute>} />
              <Route path=":id/edit" element={<PermissionRoute permission="land_record:update"><EditLandRecordPage /></PermissionRoute>} />
            </Route>

            <Route path="documents">
              <Route index element={<PermissionRoute permission="document:read"><DocumentsPage /></PermissionRoute>} />
              <Route path=":id" element={<PermissionRoute permission="document:read"><DocumentDetailsPage /></PermissionRoute>} />
            </Route>
            <Route path="verification">
              <Route index element={<PermissionRoute permission="verification:read"><VerificationPage /></PermissionRoute>} />
              <Route path=":id" element={<PermissionRoute permission="verification:read"><VerificationDetailsPage /></PermissionRoute>} />
            </Route>
            <Route path="duplicates">
              <Route index element={<PermissionRoute permission="duplicate:read"><DuplicatesPage /></PermissionRoute>} />
              <Route path=":id" element={<PermissionRoute permission="duplicate:read"><DuplicateDetailsPage /></PermissionRoute>} />
            </Route>
            <Route path="risk">
              <Route index element={<PermissionRoute permission="risk:read"><RiskIntelligencePage /></PermissionRoute>} />
              <Route path=":id" element={<PermissionRoute permission="risk:read"><RiskDetailsPage /></PermissionRoute>} />
            </Route>
            <Route path="risk-intelligence" element={<Navigate to="/risk" replace />} />
            <Route path="risk-intelligence/:id" element={<RiskIntelligenceDetailsRedirect />} />
            <Route path="monitoring">
              <Route index element={<PermissionRoute permission="monitoring:read"><MonitoringPage /></PermissionRoute>} />
              <Route path="alerts/:id" element={<PermissionRoute permission="monitoring:read"><AlertDetailsPage /></PermissionRoute>} />
              <Route path="watchlists" element={<PermissionRoute permission="watchlist:read"><WatchlistsPage /></PermissionRoute>} />
              <Route path="watchlists/:id" element={<PermissionRoute permission="watchlist:read"><WatchlistDetailsPage /></PermissionRoute>} />
            </Route>
            <Route path="notifications" element={<PermissionRoute permission="monitoring:read"><NotificationsPage /></PermissionRoute>} />
            <Route path="gis" element={<PermissionRoute permission="land_record:read"><GISMappingPage /></PermissionRoute>} />
            <Route path="analytics" element={<PermissionRoute permission="analytics:read"><AnalyticsPage /></PermissionRoute>} />
            <Route path="audit-logs" element={<PermissionRoute permission="audit:read"><AuditLogsPage /></PermissionRoute>} />
            <Route path="users" element={<PermissionRoute permission="user:read" role="SUPER_ADMIN"><UsersPage /></PermissionRoute>} />
            <Route path="assistant" element={<PermissionRoute permission="assistant:use"><BhoomiVoicePage /></PermissionRoute>} />
            <Route path="bhoomi-voice" element={<PermissionRoute permission="assistant:use"><BhoomiVoicePage /></PermissionRoute>} />
            <Route path="settings" element={<PermissionRoute permission="settings:manage"><SettingsPage /></PermissionRoute>} />
            
            <Route path="*" element={
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <h1 className="text-4xl font-bold">404</h1>
                <p className="text-muted-foreground">Page not found</p>
              </div>
            } />
          </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
