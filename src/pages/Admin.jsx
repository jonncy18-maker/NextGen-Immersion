import { Navigate } from 'react-router-dom';

// /admin is the admin shell entry — send it straight to the dashboard.
export default function Admin() {
  return <Navigate to="/admin/progress" replace />;
}
