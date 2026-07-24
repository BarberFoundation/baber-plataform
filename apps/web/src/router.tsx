import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ProtectedRoute from '@/components/layout/protected-route';
import AppShell from '@/components/layout/app-shell';
import LoginPage from '@/pages/login';
import DashboardPage from '@/pages/dashboard';
import AppointmentsPage from '@/pages/appointments';
import BarbersPage from '@/pages/barbers';
import ServicesPage from '@/pages/services';
import PlansPage from '@/pages/plans';
import ReportsPage from '@/pages/reports';
import ClientsPage from '@/pages/clients';
import TeamPage from '@/pages/team';
import ProfilePage from '@/pages/profile';
import SettingsPage from '@/pages/settings';
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
      { path: 'plans', element: <PlansPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
