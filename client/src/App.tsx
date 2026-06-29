import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { WorkspaceListPage } from './pages/WorkspaceListPage';
import { DocumentListPage } from './pages/DocumentListPage';
import { DocumentPage } from './pages/DocumentPage';
import { InvitePage } from './pages/InvitePage';
import { NotificationBell } from './components/notifications/NotificationBell';
import { ToastContainer } from './components/notifications/ToastContainer';
import { useAuthStore } from './stores/authStore';
import { useSocket } from './hooks/useSocket';
import { useToastStore } from './stores/toastStore';
import { useEffect } from 'react';

const queryClient = new QueryClient();

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
    <>
      {isAuthenticated && (
        <div className="fixed top-3 right-4 z-30">
          <NotificationBell />
        </div>
      )}
      {children}
      <ToastContainer />
    </>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell>
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
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
