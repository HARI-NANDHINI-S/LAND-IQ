import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          <main className="flex-1 flex">
            <div className="flex-1 p-6">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPlaceholder />} />
                <Route path="*" element={<div className="text-2xl font-semibold text-muted-foreground">404 — Page not found</div>} />
              </Routes>
            </div>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function DashboardPlaceholder() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-3 h-8 bg-primary rounded-sm" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">BhoomiAI</h1>
          <p className="text-sm text-muted-foreground">Intelligent Land Record Digitization Platform</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground">Phase 2 — Supabase Foundation is active.</p>
        <p className="text-sm text-muted-foreground mt-2">Authentication, database schema, and service layer are configured. Full UI coming in Phase 3.</p>
      </div>
    </div>
  );
}
