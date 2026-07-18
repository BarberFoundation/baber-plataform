import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TeamPage from '../team';
import { apiFetch } from '@/lib/api';
import type { TeamMember } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const membersFixture: TeamMember[] = [
  { id: 'm1', name: 'Ana Admin', phone: '+5511911111111', role: 'ADMIN', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'm2', name: 'Bia Recepção', phone: '+5511922222222', role: 'RECEPTIONIST', isActive: false, createdAt: '2026-01-02T00:00:00Z' },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/team']}>
        <TeamPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TeamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === '/team-members') return Promise.resolve(membersFixture);
      return Promise.resolve(undefined);
    });
  });

  it('renders team members with role and status badges', async () => {
    renderPage();
    expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
    expect(screen.getByText('Bia Recepção')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Recepcionista')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });

  it('shows active/inactive summary counts', async () => {
    renderPage();
    await screen.findByText('Ana Admin');
    // Fixture has 1 active + 1 inactive member, so both summary cards render "1".
    expect(screen.getAllByText('1')).toHaveLength(2);
  });

  it('only shows the deactivate button for active members', async () => {
    renderPage();
    await screen.findByText('Ana Admin');
    const deactivateButtons = screen.getAllByRole('button', { name: 'Desativar' });
    expect(deactivateButtons).toHaveLength(1);
  });

  it('submits the invite form and refetches the list', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === '/team-members') return Promise.resolve(membersFixture);
      if (path === '/team-members/invite') return Promise.resolve(membersFixture[0]);
      return Promise.resolve(undefined);
    });
    renderPage();
    await screen.findByText('Ana Admin');

    fireEvent.click(screen.getByRole('button', { name: /convidar/i }));
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Nova Pessoa' } });
    fireEvent.change(screen.getByLabelText('Telefone *'), { target: { value: '+5511933333333' } });
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/team-members/invite',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows an access-denied message instead of an empty table when the request is forbidden', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === '/team-members') return Promise.reject(new Error('Forbidden'));
      return Promise.resolve(undefined);
    });
    renderPage();
    expect(await screen.findByText('Você não tem permissão para acessar esta página.')).toBeInTheDocument();
    expect(screen.queryByText('0 membro(s)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /convidar/i })).not.toBeInTheDocument();
  });
});
