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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { Barber } from '@/lib/types';

interface BarberFormData {
  name: string;
  phone: string;
}

function BarberForm({
  initial,
  onSubmit,
  loading,
}: {
  initial?: BarberFormData;
  onSubmit: (data: BarberFormData) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), phone: phone.trim() });
      }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <Label htmlFor="b-name">Nome *</Label>
        <Input
          id="b-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="João Silva"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="b-phone">Telefone</Label>
        <Input
          id="b-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="11999999999"
        />
      </div>
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}

export default function BarbersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editBarber, setEditBarber] = useState<Barber | null>(null);

  const { data: barbers = [], isLoading } = useQuery({
    queryKey: ['barbers-admin'],
    queryFn: () => apiFetch<Barber[]>('/barbers/admin?includeInactive=true'),
  });

  const activeCount = barbers.filter((b) => b.isActive).length;
  const inactiveCount = barbers.length - activeCount;

  const createMutation = useMutation({
    mutationFn: (data: BarberFormData) =>
      apiFetch<Barber>('/barbers', {
        method: 'POST',
        body: JSON.stringify({ name: data.name, phone: data.phone || null }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['barbers-admin'] });
      setCreateOpen(false);
      toast.success('Barbeiro criado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BarberFormData }) =>
      apiFetch<Barber>(`/barbers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: data.name, phone: data.phone || null }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['barbers-admin'] });
      setEditBarber(null);
      toast.success('Barbeiro atualizado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/barbers/${id}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['barbers-admin'] });
      toast.success('Barbeiro desativado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Barbeiros</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Novo barbeiro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo barbeiro</DialogTitle>
            </DialogHeader>
            <BarberForm
              onSubmit={(data) => createMutation.mutate(data)}
              loading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          icon={UserCheck}
          variant="success"
          label="Ativos"
          count={activeCount}
        />
        <SummaryCard
          icon={UserX}
          variant="destructive"
          label="Inativos"
          count={inactiveCount}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{barbers.length} barbeiro(s)</CardTitle>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {barbers.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={b.isActive ? 'success' : 'secondary'}>
                        {b.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog
                          open={editBarber?.id === b.id}
                          onOpenChange={(open) => setEditBarber(open ? b : null)}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              Editar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar barbeiro</DialogTitle>
                            </DialogHeader>
                            <BarberForm
                              initial={{ name: b.name, phone: b.phone ?? '' }}
                              onSubmit={(data) => updateMutation.mutate({ id: b.id, data })}
                              loading={updateMutation.isPending}
                            />
                          </DialogContent>
                        </Dialog>
                        {b.isActive && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deactivateMutation.isPending}
                            onClick={() => deactivateMutation.mutate(b.id)}
                          >
                            Desativar
                          </Button>
                        )}
                      </div>
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
