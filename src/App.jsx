import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Navbar from './components/layout/Navbar.jsx';
import Watch from './pages/Watch.jsx';
import Progress from './pages/Progress.jsx';
import Browse from './pages/Browse.jsx';
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
    <>
      <Navbar />
      {children}
    </>
  );
}

function AdminLayout({ children }) {
  return (
    <RequireAdmin>
      <AuthLayout>{children}</AuthLayout>
    </RequireAdmin>
  );
}

export default function App() {
  return (
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
            element={
              <RequireAuth>
                <AuthLayout>
                  <Browse />
                </AuthLayout>
              </RequireAuth>
            }
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
  );
}
