import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfilePage from '../profile';
import { apiFetch } from '@/lib/api';
import { reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
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

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: vi.fn(() => 'mock-credential') },
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
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

describe('ProfilePage — change password card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === '/me') return Promise.resolve(profileFixture);
      if (path === '/auth/sessions') return Promise.resolve(sessionsFixture);
      return Promise.resolve(undefined);
    });
  });

  it('renders the password card when the user has a password provider', async () => {
    renderPage();
    expect(await screen.findByText('Trocar senha')).toBeInTheDocument();
  });

  it('submits reauth + updatePassword and revokes other sessions on success', async () => {
    vi.mocked(reauthenticateWithCredential).mockResolvedValue(undefined as never);
    vi.mocked(updatePassword).mockResolvedValue(undefined as never);
    renderPage();
    await screen.findByText('Trocar senha');

    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'old-pass' } });
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'new-pass-123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'new-pass-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledWith(expect.anything(), 'new-pass-123');
    });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/auth/sessions', expect.objectContaining({ method: 'DELETE' }));
    });
  });

  it('shows an error when the new password and confirmation do not match', async () => {
    renderPage();
    await screen.findByText('Trocar senha');

    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'old-pass' } });
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'new-pass-123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));

    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  });

  it('maps auth/wrong-password to a friendly message', async () => {
    vi.mocked(reauthenticateWithCredential).mockRejectedValue({ code: 'auth/wrong-password' });
    const { toast } = await import('sonner');
    renderPage();
    await screen.findByText('Trocar senha');

    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'new-pass-123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'new-pass-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Senha atual incorreta.');
    });
  });

  it('hides the password card when the user has no password provider', async () => {
    const original = firebaseAuth.currentUser;
    // @ts-expect-error -- mocked object in tests, not a real Firebase User
    firebaseAuth.currentUser = { providerData: [{ providerId: 'google.com' }], email: 'admin@example.com' };

    renderPage();
    await screen.findByText('Sessões ativas');
    expect(screen.queryByText('Trocar senha')).not.toBeInTheDocument();

    // @ts-expect-error -- restore for subsequent tests
    firebaseAuth.currentUser = original;
  });
});
