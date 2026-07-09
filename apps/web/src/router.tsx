import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ProtectedRoute from '@/components/layout/protected-route';
import AppShell from '@/components/layout/app-shell';
import LoginPage from '@/pages/login';
import DashboardPage from '@/pages/dashboard';
import AppointmentsPage from '@/pages/appointments';
import BarbersPage from '@/pages/barbers';
import ServicesPage from '@/pages/services';
import LandingPage from '@/pages/landing';

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'appointments', element: <AppointmentsPage /> },
      { path: 'barbers', element: <BarbersPage /> },
      { path: 'services', element: <ServicesPage /> },
    ],
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
