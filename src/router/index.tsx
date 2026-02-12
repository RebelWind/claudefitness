import { createBrowserRouter, Navigate } from 'react-router';
import App from '../App';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import DashboardPage from '../pages/DashboardPage';
import InitialSetupPage from '../pages/InitialSetupPage';
import WorkoutSessionPage from '../pages/WorkoutSessionPage';
import ProgressPage from '../pages/ProgressPage';
import ProfilePage from '../pages/ProfilePage';
import NotFoundPage from '../pages/NotFoundPage';
import ProtectedRoute from '../components/layout/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: <ProtectedRoute><DashboardPage /></ProtectedRoute>,
      },
      {
        path: 'setup',
        element: <ProtectedRoute><InitialSetupPage /></ProtectedRoute>,
      },
      {
        path: 'workout/:workoutType',
        element: <ProtectedRoute><WorkoutSessionPage /></ProtectedRoute>,
      },
      {
        path: 'workout',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'progress',
        element: <ProtectedRoute><ProgressPage /></ProtectedRoute>,
      },
      {
        path: 'profile',
        element: <ProtectedRoute><ProfilePage /></ProtectedRoute>,
      },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
