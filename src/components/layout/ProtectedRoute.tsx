import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useProgramStore } from '../../stores/programStore';

const SETUP_PATHS = ['/welcome', '/setup'];
const ALWAYS_ALLOWED_PATHS = ['/profile'];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading = useAuthStore(s => s.isLoading);
  const user = useUserStore(s => s.user);
  const completeSetup = useUserStore(s => s.completeSetup);
  const program = useProgramStore(s => s.program);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary-light border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Recovery: if hasCompletedSetup is false but program data exists,
  // the user clearly completed setup before — fix the flag
  if (user && !user.hasCompletedSetup && program) {
    completeSetup();
    return <>{children}</>;
  }

  if (user && !user.hasCompletedSetup && !program && !SETUP_PATHS.includes(location.pathname) && !ALWAYS_ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}
