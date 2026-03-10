import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Analytics } from '@vercel/analytics/react';
import BottomNav from './components/layout/BottomNav';
import { useAuthStore } from './stores/authStore';
import { useWorkoutStore } from './stores/workoutStore';

export default function App() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const initialize = useAuthStore(s => s.initialize);
  const activeSession = useWorkoutStore(s => s.activeSession);
  const location = useLocation();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const hideNav =
    !isAuthenticated ||
    location.pathname === '/setup' ||
    location.pathname.startsWith('/workout/');

  return (
    <>
      <Outlet />
      {!hideNav && !activeSession && <BottomNav />}
      <Analytics />
    </>
  );
}
