import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { WorkspaceListPage } from './pages/WorkspaceListPage';
import { DocumentListPage } from './pages/DocumentListPage';
import { DocumentPage } from './pages/DocumentPage';
import { InvitePage } from './pages/InvitePage';
import { useAuthStore } from './stores/authStore';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
