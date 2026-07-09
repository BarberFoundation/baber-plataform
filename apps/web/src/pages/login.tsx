import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'sonner';
import { Scissors } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';
import { resolveTenantId } from '@/lib/tenant';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { User } from '@/lib/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const idToken = await credential.user.getIdToken();
      const tenantId = await resolveTenantId();

      const result = await apiFetch<{ accessToken: string; expiresIn: number; user: User }>(
        '/auth/admin/exchange',
        {
          method: 'POST',
          body: JSON.stringify({ idToken, tenantId }),
        },
      );

      setAuth(result.accessToken, result.expiresIn, result.user);
      void navigate('/app');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-neutral-950 lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12">
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
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
