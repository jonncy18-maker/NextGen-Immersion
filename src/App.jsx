import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Watch from './pages/Watch.jsx';
import Progress from './pages/Progress.jsx';
import Browse from './pages/Browse.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import AdminProgress from './pages/AdminProgress.jsx';
import AdminVideos from './pages/AdminVideos.jsx';
import AdminGoals from './pages/AdminGoals.jsx';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/watch" replace />} />
          <Route path="/watch" element={<Watch />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/progress" element={<AdminProgress />} />
          <Route path="/admin/videos" element={<AdminVideos />} />
          <Route path="/admin/goals" element={<AdminGoals />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
