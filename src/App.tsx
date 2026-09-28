import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ModulePlaceholderPage from './pages/ModulePlaceholderPage';
import AppShell from './components/layout/AppShell';
import { useAuth } from './hooks/auth/useAuth';

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading application...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            
            {/* Land Records Module */}
            <Route path="land-records">
              <Route index element={<LandRecordsPage />} />
              <Route path="new" element={<CreateLandRecordPage />} />
              <Route path=":id" element={<LandRecordDetailsPage />} />
              <Route path=":id/edit" element={<EditLandRecordPage />} />
            </Route>

            <Route path="documents">
              <Route index element={<DocumentsPage />} />
              <Route path=":id" element={<DocumentDetailsPage />} />
            </Route>
            <Route path="verification">
              <Route index element={<VerificationPage />} />
              <Route path=":id" element={<VerificationDetailsPage />} />
            </Route>
            <Route path="duplicates">
              <Route index element={<DuplicatesPage />} />
              <Route path=":id" element={<DuplicateDetailsPage />} />
            </Route>
            <Route path="risk">
              <Route index element={<RiskIntelligencePage />} />
              <Route path=":id" element={<RiskDetailsPage />} />
            </Route>
            <Route path="risk-intelligence" element={<Navigate to="/risk" replace />} />
            <Route path="risk-intelligence/:id" element={<Navigate to="/risk/:id" replace />} />
            <Route path="monitoring">
              <Route index element={<MonitoringPage />} />
              <Route path="alerts/:id" element={<AlertDetailsPage />} />
              <Route path="watchlists" element={<WatchlistsPage />} />
              <Route path="watchlists/:id" element={<WatchlistDetailsPage />} />
            </Route>
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="gis" element={<ModulePlaceholderPage moduleName="GIS Mapping" />} />
            <Route path="analytics" element={<ModulePlaceholderPage moduleName="Analytics" />} />
            <Route path="audit-logs" element={<ModulePlaceholderPage moduleName="Audit Logs" />} />
            <Route path="users" element={<ModulePlaceholderPage moduleName="User Administration" />} />
            <Route path="assistant" element={<ModulePlaceholderPage moduleName="BhoomiVoice Assistant" />} />
            <Route path="settings" element={<ModulePlaceholderPage moduleName="Settings" />} />
            
            <Route path="*" element={
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <h1 className="text-4xl font-bold">404</h1>
                <p className="text-muted-foreground">Page not found</p>
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
