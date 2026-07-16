import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Users,
  Scissors,
  LayoutDashboard,
  LogOut,
  BarChart3,
  UserCheck,
  UsersRound,
  User as UserIcon,
  Settings,
  ChevronDown,
  Menu,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/components/ui/sheet';
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

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/appointments', label: 'Agendamentos', icon: CalendarDays, end: false },
  { to: '/app/barbers', label: 'Barbeiros', icon: Users, end: false },
  { to: '/app/services', label: 'Serviços', icon: Scissors, end: false },
  { to: '/app/reports', label: 'Relatórios', icon: BarChart3, end: false },
  { to: '/app/clients', label: 'Clientes', icon: UserCheck, end: false },
  { to: '/app/team', label: 'Equipe', icon: UsersRound, end: false, adminOnly: true },
];

function SidebarNav({ profile, onNavigate }: { profile?: AdminProfile; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 p-2">
      {NAV.filter((item) => !item.adminOnly || profile?.role === 'ADMIN').map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
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
  );
}

function AccountMenu({
  profile,
  onNavigate,
  onLogout,
}: {
  profile?: AdminProfile;
  onNavigate: (to: string) => void;
  onLogout: () => void;
}) {
  return (
    <div className="p-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
          <UserIcon className="h-4 w-4" />
          <span className="flex-1 truncate text-left">{profile?.name ?? 'Conta'}</span>
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => onNavigate('/app/profile')}>
            <UserIcon className="h-4 w-4" />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onNavigate('/app/settings')}>
            <Settings className="h-4 w-4" />
            Config. Barbearia
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<AdminProfile>('/me'),
  });

  function handleLogout() {
    clearAuth();
    void navigate('/login');
  }

  function navigateAndCloseMobile(to: string) {
    setMobileNavOpen(false);
    navigate(to);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4 md:hidden">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col p-0">
            <SheetTitle>Menu de navegação</SheetTitle>
            <div className="flex h-14 items-center px-4 font-bold text-lg">✂ Baber Admin</div>
            <Separator />
            <SidebarNav profile={profile} onNavigate={() => setMobileNavOpen(false)} />
            <Separator />
            <AccountMenu profile={profile} onNavigate={navigateAndCloseMobile} onLogout={handleLogout} />
          </SheetContent>
        </Sheet>
        <span className="font-bold text-lg">✂ Baber Admin</span>
      </header>

      <aside className="hidden w-56 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center px-4 font-bold text-lg">✂ Baber Admin</div>
        <Separator />
        <SidebarNav profile={profile} />
        <Separator />
        <AccountMenu profile={profile} onNavigate={navigate} onLogout={handleLogout} />
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
