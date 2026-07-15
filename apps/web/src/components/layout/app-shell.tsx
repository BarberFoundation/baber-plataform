import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Users,
  Scissors,
  LayoutDashboard,
  LogOut,
  BarChart3,
  User as UserIcon,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/lib/api';
import type { AdminProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/appointments', label: 'Agendamentos', icon: CalendarDays, end: false },
  { to: '/app/barbers', label: 'Barbeiros', icon: Users, end: false },
  { to: '/app/services', label: 'Serviços', icon: Scissors, end: false },
  { to: '/app/reports', label: 'Relatórios', icon: BarChart3, end: false },
];

export default function AppShell() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<AdminProfile>('/me'),
  });

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
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
              <UserIcon className="h-4 w-4" />
              <span className="flex-1 truncate text-left">{profile?.name ?? 'Conta'}</span>
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/app/profile')}>
                <UserIcon className="h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/settings')}>
                <Settings className="h-4 w-4" />
                Config. Barbearia
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
