import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  type ConfirmationResult,
} from 'firebase/auth';
import { toast } from 'sonner';
import { Scissors } from 'lucide-react';
import { animate, stagger } from 'animejs';
import { firebaseAuth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';
import { resolveTenantId } from '@/lib/tenant';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { User } from '@/lib/types';

type Method = 'email' | 'phone';

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'Número de telefone inválido.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
  'auth/invalid-verification-code': 'Código de verificação inválido.',
  'auth/code-expired': 'Código expirado. Solicite um novo.',
};

function firebaseErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && FIREBASE_ERROR_MESSAGES[code]) return FIREBASE_ERROR_MESSAGES[code];
  // Erros do Firebase não mapeados vêm em inglês — não expor ao usuário.
  if (code?.startsWith('auth/')) return 'Erro ao fazer login. Tente novamente.';
  return err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.';
}

async function exchangeIdToken(idToken: string): Promise<{ accessToken: string; expiresIn: number; user: User }> {
  const tenantId = await resolveTenantId();
  return apiFetch<{ accessToken: string; expiresIn: number; user: User }>('/auth/admin/exchange', {
    method: 'POST',
    body: JSON.stringify({ idToken, tenantId }),
  });
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [method, setMethod] = useState<Method>('email');
  const [googleLoading, setGoogleLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const blobRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // O verifier fica amarrado ao <div> do form de telefone; trocar de aba
  // desmonta esse div, então verifier e fluxo de confirmação morrem juntos.
  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      setConfirmation(null);
      setCode('');
    };
  }, [method]);

  useEffect(() => {
    if (!blobRef.current) return;
    const animation = animate(blobRef.current, {
      translateX: ['-5%', '5%'],
      translateY: ['-3%', '4%'],
      scale: [1, 1.15],
      duration: 6000,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
    });
    return () => {
      animation.pause();
    };
  }, []);

  useEffect(() => {
    if (!formRef.current) return;
    const animation = animate(formRef.current.children, {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(80),
      duration: 500,
      easing: 'easeOutQuad',
    });
    return () => {
      animation.pause();
    };
  }, [method]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const idToken = await credential.user.getIdToken();
      const result = await exchangeIdToken(idToken);
      setAuth(result.accessToken, result.expiresIn, result.user);
      void navigate('/app');
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      const idToken = await credential.user.getIdToken();
      const result = await exchangeIdToken(idToken);
      setAuth(result.accessToken, result.expiresIn, result.user);
      void navigate('/app');
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!recaptchaContainerRef.current) return;
    setPhoneLoading(true);
    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current, {
          size: 'invisible',
        });
      }
      const result = await signInWithPhoneNumber(firebaseAuth, phone, recaptchaVerifierRef.current);
      setConfirmation(result);
      toast.success('Código enviado por SMS.');
    } catch (err) {
      // Verifier invisível consumido/errado não pode ser reusado.
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      toast.error(firebaseErrorMessage(err));
    } finally {
      setPhoneLoading(false);
    }
  }

  function resetPhoneFlow() {
    setConfirmation(null);
    setCode('');
  }

  async function handleConfirmCode(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmation) return;
    setPhoneLoading(true);
    try {
      const credential = await confirmation.confirm(code);
      const idToken = await credential.user.getIdToken();
      const result = await exchangeIdToken(idToken);
      setAuth(result.accessToken, result.expiresIn, result.user);
      void navigate('/app');
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setPhoneLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-neutral-950 lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12">
        <div
          ref={blobRef}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-gradient-to-br from-orange-600 via-red-700 to-neutral-950 opacity-40 blur-3xl"
        />
        <div className="relative flex items-center gap-2 text-2xl font-bold text-white">
          <Scissors className="h-7 w-7 text-orange-500" />
          Baber Admin
        </div>
        <p className="relative mt-4 max-w-sm text-center text-neutral-300">
          Sua barbearia, sob controle.
        </p>
      </div>

      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse o painel administrativo.</p>

          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full gap-2"
            disabled={googleLoading}
            onClick={() => void handleGoogleSignIn()}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.28A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.56.4-2.28V6.63H1.29A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.29 5.37z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
              />
            </svg>
            {googleLoading ? 'Entrando...' : 'Continuar com Google'}
          </Button>
          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">ou</span>
            <Separator className="flex-1" />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={method === 'email' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMethod('email')}
            >
              E-mail
            </Button>
            <Button
              type="button"
              variant={method === 'phone' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMethod('phone')}
            >
              Telefone
            </Button>
          </div>

          {method === 'email' ? (
            <form ref={formRef} onSubmit={(e) => void handleEmailSubmit(e)} className="mt-6 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={emailLoading}>
                {emailLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          ) : (
            <form
              ref={formRef}
              onSubmit={(e) => void (confirmation ? handleConfirmCode(e) : handleSendCode(e))}
              className="mt-6 space-y-4"
            >
              <div className="space-y-1">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+5511999999999"
                  required
                  disabled={!!confirmation}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {confirmation && (
                <div className="space-y-1">
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
              )}
              <div ref={recaptchaContainerRef} />
              <Button type="submit" className="w-full" disabled={phoneLoading}>
                {phoneLoading ? 'Aguarde...' : confirmation ? 'Confirmar' : 'Enviar código'}
              </Button>
              {confirmation && (
                <Button type="button" variant="ghost" className="w-full" onClick={resetPhoneFlow}>
                  Trocar número ou reenviar código
                </Button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
