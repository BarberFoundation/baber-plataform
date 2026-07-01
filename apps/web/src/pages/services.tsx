import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { Service } from '@/lib/types';

interface ServiceFormData {
  name: string;
  description: string;
  priceInCents: number;
  durationMinutes: number;
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function ServiceForm({
  initial,
  onSubmit,
  loading,
}: {
  initial?: ServiceFormData;
  onSubmit: (data: ServiceFormData) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial ? String(initial.priceInCents / 100) : '');
  const [duration, setDuration] = useState(initial ? String(initial.durationMinutes) : '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const priceInCents = Math.round(parseFloat(price) * 100);
        const durationMinutes = parseInt(duration, 10);
        if (isNaN(priceInCents) || priceInCents <= 0) {
          toast.error('Preço inválido.');
          return;
        }
        if (isNaN(durationMinutes) || durationMinutes <= 0) {
          toast.error('Duração inválida.');
          return;
        }
        onSubmit({
          name: name.trim(),
          description: description.trim(),
          priceInCents,
          durationMinutes,
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <Label htmlFor="s-name">Nome *</Label>
        <Input
          id="s-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Corte de cabelo"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="s-desc">Descrição</Label>
        <Input
          id="s-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição opcional"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="s-price">Preço (R$) *</Label>
          <Input
            id="s-price"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="35.00"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="s-duration">Duração (min) *</Label>
          <Input
            id="s-duration"
            type="number"
            min="1"
            required
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
          />
        </div>
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

export default function ServicesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services-admin'],
    queryFn: () => apiFetch<Service[]>('/services/admin?includeInactive=true'),
  });

  const createMutation = useMutation({
    mutationFn: (data: ServiceFormData) =>
      apiFetch<Service>('/services', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['services-admin'] });
      setCreateOpen(false);
      toast.success('Serviço criado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceFormData }) =>
      apiFetch<Service>(`/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['services-admin'] });
      setEditService(null);
      toast.success('Serviço atualizado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/services/${id}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['services-admin'] });
      toast.success('Serviço desativado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Serviços</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Novo serviço
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo serviço</DialogTitle>
            </DialogHeader>
            <ServiceForm
              onSubmit={(data) => createMutation.mutate(data)}
              loading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{services.length} serviço(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <div>{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground">{s.description}</div>
                      )}
                    </TableCell>
                    <TableCell>{s.durationMinutes} min</TableCell>
                    <TableCell>{formatBRL(s.priceInCents)}</TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? 'success' : 'secondary'}>
                        {s.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog
                          open={editService?.id === s.id}
                          onOpenChange={(open) => setEditService(open ? s : null)}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              Editar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar serviço</DialogTitle>
                            </DialogHeader>
                            <ServiceForm
                              initial={{
                                name: s.name,
                                description: s.description ?? '',
                                priceInCents: s.priceInCents,
                                durationMinutes: s.durationMinutes,
                              }}
                              onSubmit={(data) => updateMutation.mutate({ id: s.id, data })}
                              loading={updateMutation.isPending}
                            />
                          </DialogContent>
                        </Dialog>
                        {s.isActive && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deactivateMutation.isPending}
                            onClick={() => deactivateMutation.mutate(s.id)}
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
