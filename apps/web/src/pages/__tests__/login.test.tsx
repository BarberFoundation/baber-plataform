import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../login';

const mockSignInWithPhoneNumber = vi.fn();
const mockConfirm = vi.fn();

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth');
  return {
    ...actual,
    signInWithEmailAndPassword: vi.fn(),
    signInWithPhoneNumber: (...args: unknown[]) => mockSignInWithPhoneNumber(...args),
    RecaptchaVerifier: vi.fn().mockImplementation(() => ({ clear: vi.fn() })),
  };
});

vi.mock('animejs', () => ({
  animate: vi.fn(() => ({ pause: vi.fn() })),
  stagger: vi.fn(() => 0),
}));

vi.mock('@/lib/firebase', () => ({ firebaseAuth: {} }));
vi.mock('@/lib/tenant', () => ({ resolveTenantId: vi.fn().mockResolvedValue('tenant-1') }));
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    accessToken: 'tok',
    expiresIn: 900,
    user: { id: '1', name: null, role: 'ADMIN', email: null, phone: '+5511999999999' },
  }),
}));

beforeEach(() => {
  mockSignInWithPhoneNumber.mockReset();
  mockConfirm.mockReset();
});

describe('LoginPage — telefone tab', () => {
  it('sends the SMS code then confirms it and exchanges the resulting idToken', async () => {
    mockSignInWithPhoneNumber.mockResolvedValue({ confirm: mockConfirm });
    mockConfirm.mockResolvedValue({ user: { getIdToken: vi.fn().mockResolvedValue('id-token-abc') } });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /telefone/i }));
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '+5511999999999' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar c(o|ó)digo/i }));

    await waitFor(() => expect(mockSignInWithPhoneNumber).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/c(o|ó)digo/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('123456'));
  });
});
