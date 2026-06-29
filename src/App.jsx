import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ErrorBoundary from './components/layout/ErrorBoundary.jsx';
import Navbar from './components/layout/Navbar.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import BottomNav from './components/layout/BottomNav.jsx';
import Watch from './pages/Watch.jsx';
import Progress from './pages/Progress.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import AdminProgress from './pages/AdminProgress.jsx';
import AdminVideos from './pages/AdminVideos.jsx';
import AdminGoals from './pages/AdminGoals.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.notProvisioned) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        Account not set up yet. Contact your program coordinator.
      </div>
    );
  }
  return children;
}

function RequireAdmin({ children }) {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== 'admin') return <Navigate to="/watch" replace />;
  return children;
}

function AuthLayout({ children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <div style={shellStyles.body}>
        <Sidebar />
        <main className="ngsi-main-content" style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

const shellStyles = {
  body: {
    flex: 1,
    display: 'flex',
  },
};

function AdminLayout({ children }) {
  return (
    <RequireAdmin>
      <AuthLayout>{children}</AuthLayout>
    </RequireAdmin>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Navigate to="/watch" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/watch"
            element={
              <RequireAuth>
                <AuthLayout>
                  <Watch />
                </AuthLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/progress"
            element={
              <RequireAuth>
                <AuthLayout>
                  <Progress />
                </AuthLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/browse"
            element={<Navigate to="/watch" replace />}
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout>
                  <Admin />
                </AdminLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/progress"
            element={
              <RequireAuth>
                <AdminLayout>
                  <AdminProgress />
                </AdminLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/videos"
            element={
              <RequireAuth>
                <AdminLayout>
                  <AdminVideos />
                </AdminLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/goals"
            element={
              <RequireAuth>
                <AdminLayout>
                  <AdminGoals />
                </AdminLayout>
              </RequireAuth>
            }
          />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
