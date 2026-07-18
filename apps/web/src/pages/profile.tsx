import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { AdminProfile, Session } from '@/lib/types';

function formatDateTime(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function SessionsCard() {
  const qc = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiFetch<Session[]>('/auth/sessions'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Sessão encerrada.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeOthersMutation = useMutation({
    mutationFn: () => apiFetch<void>('/auth/sessions', { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Outras sessões encerradas.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sessões ativas</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sessions.length <= 1 || revokeOthersMutation.isPending}
          onClick={() => revokeOthersMutation.mutate()}
        >
          Encerrar todas as outras
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criada em</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(s.expiresAt)}</TableCell>
                  <TableCell>
                    {s.isCurrent && <Badge variant="success">Sessão atual</Badge>}
                  </TableCell>
                  <TableCell>
                    {!s.isCurrent && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(s.id)}
                      >
                        Encerrar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  'auth/wrong-password': 'Senha atual incorreta.',
  'auth/invalid-credential': 'Senha atual incorreta.',
  'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
};

function passwordErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && PASSWORD_ERROR_MESSAGES[code]) return PASSWORD_ERROR_MESSAGES[code];
  if (code?.startsWith('auth/')) return 'Erro ao trocar senha. Tente novamente.';
  return err instanceof Error ? err.message : 'Erro ao trocar senha. Tente novamente.';
}

function ChangePasswordCard() {
  const qc = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const user = firebaseAuth.currentUser;
  const hasPasswordProvider = user?.providerData.some((p) => p.providerId === 'password') ?? false;
  if (!hasPasswordProvider) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(user!.email!, currentPassword);
      await reauthenticateWithCredential(user!, credential);
      await updatePassword(user!, newPassword);
      await apiFetch<void>('/auth/sessions', { method: 'DELETE' });
      void qc.invalidateQueries({ queryKey: ['sessions'] });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha alterada. Outras sessões foram encerradas.');
    } catch (err) {
      toast.error(passwordErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Segurança da conta</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="p-current-password">Senha atual</Label>
            <Input
              id="p-current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-new-password">Nova senha</Label>
            <Input
              id="p-new-password"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-confirm-password">Confirmar nova senha</Label>
            <Input
              id="p-confirm-password"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Trocando...' : 'Trocar senha'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<AdminProfile>('/me'),
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (profile && !hasLoaded) {
      setName(profile.name ?? '');
      setPhone(profile.phone ?? '');
      setHasLoaded(true);
    }
  }, [profile, hasLoaded]);

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; phone: string }) =>
      apiFetch<AdminProfile>('/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: data.name, phone: data.phone }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('Perfil atualizado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfil</h1>
        <p className="text-muted-foreground text-sm">Seus dados de acesso</p>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({ name: name.trim(), phone: phone.trim() });
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label htmlFor="p-name">Nome *</Label>
              <Input id="p-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-phone">Telefone</Label>
              <Input
                id="p-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11999999999"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <p className="text-sm text-muted-foreground">{profile?.email ?? '—'}</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <SessionsCard />
      <ChangePasswordCard />
    </div>
  );
}
