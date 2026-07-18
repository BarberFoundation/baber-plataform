import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfilePage from '../profile';
import { apiFetch } from '@/lib/api';
import type { AdminProfile, Session } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/firebase', () => ({
  firebaseAuth: { currentUser: { providerData: [{ providerId: 'password' }], email: 'admin@example.com' } },
}));

const profileFixture: AdminProfile = {
  id: 'u1',
  name: 'Ana Admin',
  role: 'ADMIN',
  phone: '+5511911111111',
  email: 'admin@example.com',
};

const sessionsFixture: Session[] = [
  { id: 's1', createdAt: '2026-07-01T10:00:00Z', expiresAt: '2026-07-31T10:00:00Z', isCurrent: true },
  { id: 's2', createdAt: '2026-06-15T10:00:00Z', expiresAt: '2026-07-15T10:00:00Z', isCurrent: false },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

describe('ProfilePage — sessions card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === '/me') return Promise.resolve(profileFixture);
      if (path === '/auth/sessions') return Promise.resolve(sessionsFixture);
      return Promise.resolve(undefined);
    });
  });

  it('lists sessions and marks the current one', async () => {
    renderPage();
    await screen.findByText(/sessão atual/i);
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 sessions
  });

  it('does not show an "Encerrar" button for the current session', async () => {
    renderPage();
    await screen.findByText(/sessão atual/i);
    expect(screen.getAllByRole('button', { name: 'Encerrar' })).toHaveLength(1);
  });

  it('revokes an individual session and refetches the list', async () => {
    renderPage();
    await screen.findByText(/sessão atual/i);

    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/auth/sessions/s2', expect.objectContaining({ method: 'DELETE' }));
    });
  });

  it('revokes all other sessions via the bulk button', async () => {
    renderPage();
    await screen.findByText(/sessão atual/i);

    fireEvent.click(screen.getByRole('button', { name: /encerrar todas as outras/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/auth/sessions', expect.objectContaining({ method: 'DELETE' }));
    });
  });

  it('disables the bulk revoke button when there is only the current session', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === '/me') return Promise.resolve(profileFixture);
      if (path === '/auth/sessions') return Promise.resolve([sessionsFixture[0]]);
      return Promise.resolve(undefined);
    });
    renderPage();
    await screen.findByText(/sessão atual/i);

    expect(screen.getByRole('button', { name: /encerrar todas as outras/i })).toBeDisabled();
  });
});
