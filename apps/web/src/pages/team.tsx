import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, UserCheck, UserX } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SummaryCard } from '@/components/ui/summary-card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { TeamMember } from '@/lib/types';

interface InviteFormData {
  name: string;
  phone: string;
  role: 'ADMIN' | 'RECEPTIONIST';
}

function InviteForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: InviteFormData) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'RECEPTIONIST'>('RECEPTIONIST');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), phone: phone.trim(), role });
      }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <Label htmlFor="t-name">Nome *</Label>
        <Input
          id="t-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Maria Recepção"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="t-phone">Telefone *</Label>
        <Input
          id="t-phone"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="11999999999"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="t-role">Função</Label>
        <Select value={role} onValueChange={(v) => setRole(v as 'ADMIN' | 'RECEPTIONIST')}>
          <SelectTrigger id="t-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="RECEPTIONIST">Recepcionista</SelectItem>
            <SelectItem value="ADMIN">Administrador</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={loading}>
          {loading ? 'Convidando...' : 'Convidar'}
        </Button>
      </div>
    </form>
  );
}

export default function TeamPage() {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => apiFetch<TeamMember[]>('/team-members'),
  });

  const activeCount = members.filter((m) => m.isActive).length;
  const inactiveCount = members.length - activeCount;

  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) =>
      apiFetch<TeamMember>('/team-members/invite', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team-members'] });
      setInviteOpen(false);
      toast.success('Convite criado. A pessoa já pode entrar com o telefone informado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/team-members/${id}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Membro desativado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Equipe</h1>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Convidar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar membro da equipe</DialogTitle>
            </DialogHeader>
            <InviteForm
              onSubmit={(data) => inviteMutation.mutate(data)}
              loading={inviteMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard icon={UserCheck} variant="success" label="Ativos" count={activeCount} />
        <SummaryCard icon={UserX} variant="destructive" label="Inativos" count={inactiveCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{members.length} membro(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{m.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.role === 'ADMIN' ? 'Administrador' : 'Recepcionista'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? 'success' : 'secondary'}>
                        {m.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.isActive && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deactivateMutation.isPending}
                          onClick={() => deactivateMutation.mutate(m.id)}
                        >
                          Desativar
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
    </div>
  );
}
