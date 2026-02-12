import { Outlet, useLocation } from 'react-router';
import BottomNav from './components/layout/BottomNav';
import { useAuthStore } from './stores/authStore';
import { useWorkoutStore } from './stores/workoutStore';

export default function App() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const activeSession = useWorkoutStore(s => s.activeSession);
  const location = useLocation();

  // Hide bottom nav on auth pages, setup, and during active workout
  const hideNav =
    !isAuthenticated ||
    location.pathname === '/setup' ||
    location.pathname.startsWith('/workout/');

  return (
    <>
      <Outlet />
      {!hideNav && !activeSession && <BottomNav />}
    </>
  );
}
