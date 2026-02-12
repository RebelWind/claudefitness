import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const user = useUserStore(s => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !user.hasCompletedSetup && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
