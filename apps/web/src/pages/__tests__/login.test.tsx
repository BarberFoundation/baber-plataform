import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../login';

const mockSignInWithPhoneNumber = vi.fn();
const mockConfirm = vi.fn();
const mockRecaptchaClear = vi.fn();
const mockRecaptchaVerifier = vi.fn().mockImplementation(() => ({ clear: mockRecaptchaClear }));

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth');
  return {
    ...actual,
    signInWithEmailAndPassword: vi.fn(),
    signInWithPhoneNumber: (...args: unknown[]) => mockSignInWithPhoneNumber(...args),
    RecaptchaVerifier: function (...args: unknown[]) {
      return mockRecaptchaVerifier(...args);
    },
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
  mockRecaptchaVerifier.mockClear();
  mockRecaptchaClear.mockClear();
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

    const codeInput = await screen.findByLabelText(/c(o|ó)digo/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('123456'));
  });

  it('recreates the recaptcha verifier after switching tabs (no stale DOM binding)', async () => {
    mockSignInWithPhoneNumber.mockResolvedValue({ confirm: mockConfirm });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /telefone/i }));
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '+5511999999999' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar c(o|ó)digo/i }));
    await waitFor(() => expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(1));

    // troca de aba destrói o container do recaptcha
    fireEvent.click(screen.getByRole('button', { name: /e-mail/i }));
    expect(mockRecaptchaClear).toHaveBeenCalled();

    // volta e reenvia: verifier novo, não o órfão
    fireEvent.click(screen.getByRole('button', { name: /telefone/i }));
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '+5511888888888' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar c(o|ó)digo/i }));
    await waitFor(() => expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(2));
    expect(mockRecaptchaVerifier).toHaveBeenCalledTimes(2);
  });

  it('lets the user go back to change the number / resend the code', async () => {
    mockSignInWithPhoneNumber.mockResolvedValue({ confirm: mockConfirm });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /telefone/i }));
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '+5511999999999' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar c(o|ó)digo/i }));
    await waitFor(() => expect(screen.getByLabelText(/c(o|ó)digo/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /trocar número/i }));
    expect(screen.queryByLabelText(/c(o|ó)digo/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/telefone/i)).not.toBeDisabled();
  });
});
