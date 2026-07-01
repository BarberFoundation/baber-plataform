import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, Users, Scissors, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/appointments', label: 'Agendamentos', icon: CalendarDays, end: false },
  { to: '/barbers', label: 'Barbeiros', icon: Users, end: false },
  { to: '/services', label: 'Serviços', icon: Scissors, end: false },
];

export default function AppShell() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  function handleLogout() {
    clearAuth();
    void navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 flex-col border-r bg-card">
        <div className="flex h-14 items-center px-4 font-bold text-lg">✂ Baber Admin</div>
        <Separator />
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <Separator />
        <div className="p-2">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
