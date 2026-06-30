import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { InvitePage } from './pages/InvitePage';
import { NotificationBell } from './components/notifications/NotificationBell';
import { ToastContainer } from './components/notifications/ToastContainer';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAuthStore } from './stores/authStore';
import { useSocket } from './hooks/useSocket';
import { useToastStore } from './stores/toastStore';
import { useEffect } from 'react';

const WorkspaceListPage = lazy(() => import('./pages/WorkspaceListPage').then(m => ({ default: m.WorkspaceListPage })));
const DocumentListPage = lazy(() => import('./pages/DocumentListPage').then(m => ({ default: m.DocumentListPage })));
const DocumentPage = lazy(() => import('./pages/DocumentPage').then(m => ({ default: m.DocumentPage })));

const queryClient = new QueryClient();

const LoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-sm text-gray-500">Loading...</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { subscribe } = useSocket();
  const pushToast = useToastStore((s) => s.pushToast);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = subscribe('notification', (data: any) => {
      pushToast({ message: data.message, type: data.type, targetId: data.targetId });
    });
    return () => unsub();
  }, [isAuthenticated]);

  return (
    <ErrorBoundary>
      {isAuthenticated && (
        <div className="fixed top-3 right-4 z-30">
          <NotificationBell />
        </div>
      )}
      {children}
      <ToastContainer />
    </ErrorBoundary>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/workspaces"
                element={
                  <ProtectedRoute>
                    <WorkspaceListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workspaces/:workspaceId"
                element={
                  <ProtectedRoute>
                    <DocumentListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/:documentId"
                element={
                  <ProtectedRoute>
                    <DocumentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/join"
                element={
                  <ProtectedRoute>
                    <InvitePage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/workspaces" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
