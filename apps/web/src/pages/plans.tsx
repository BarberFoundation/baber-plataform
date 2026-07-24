import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { Service, SubscriptionTier, SubscriptionTierServiceItem } from '@/lib/types';

interface TierFormData {
  name: string;
  services: SubscriptionTierServiceItem[];
  discountPercentage: number;
}

function TierForm({
  services,
  initial,
  onSubmit,
  loading,
}: {
  services: Service[];
  initial?: TierFormData;
  onSubmit: (data: TierFormData) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [items, setItems] = useState<SubscriptionTierServiceItem[]>(initial?.services ?? []);
  const [discount, setDiscount] = useState(initial ? String(initial.discountPercentage) : '0');
  const [pickerServiceId, setPickerServiceId] = useState('');

  const availableServices = services.filter((s) => !items.some((i) => i.serviceId === s.id));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (items.length === 0) {
          toast.error('Selecione ao menos 1 serviço.');
          return;
        }
        const discountPercentage = parseInt(discount, 10);
        if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
          toast.error('Desconto deve estar entre 0 e 100.');
          return;
        }
        onSubmit({ name: name.trim(), services: items, discountPercentage });
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
          placeholder="Plano Ouro"
        />
      </div>

      <div className="space-y-2">
        <Label>Serviços inclusos *</Label>
        {items.map((item) => {
          const service = services.find((s) => s.id === item.serviceId);
          return (
            <div key={item.serviceId} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{service?.name ?? item.serviceId}</span>
              <Input
                type="number"
                min="1"
                className="w-20"
                value={item.quantity}
                onChange={(e) => {
                  const quantity = parseInt(e.target.value, 10);
                  setItems((prev) =>
                    prev.map((i) => (i.serviceId === item.serviceId ? { ...i, quantity: isNaN(quantity) ? 1 : quantity } : i)),
                  );
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setItems((prev) => prev.filter((i) => i.serviceId !== item.serviceId))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
        {availableServices.length > 0 && (
          <div className="flex gap-2">
            <Select value={pickerServiceId} onValueChange={setPickerServiceId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Adicionar serviço..." />
              </SelectTrigger>
              <SelectContent>
                {availableServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={!pickerServiceId}
              onClick={() => {
                setItems((prev) => [...prev, { serviceId: pickerServiceId, quantity: 1 }]);
                setPickerServiceId('');
              }}
            >
              Adicionar
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="t-discount">Desconto (%) *</Label>
        <Input
          id="t-discount"
          type="number"
          min="0"
          max="100"
          required
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
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

export default function PlansPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTier, setEditTier] = useState<SubscriptionTier | null>(null);

  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ['subscription-tiers-admin'],
    queryFn: () => apiFetch<SubscriptionTier[]>('/loyalty/club-subscription/tiers'),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services-admin'],
    queryFn: () => apiFetch<Service[]>('/services/admin'),
  });

  const activeCount = tiers.filter((t) => t.isActive).length;
  const inactiveCount = tiers.length - activeCount;

  const createMutation = useMutation({
    mutationFn: (data: TierFormData) =>
      apiFetch<SubscriptionTier>('/loyalty/club-subscription/tiers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription-tiers-admin'] });
      setCreateOpen(false);
      toast.success('Plano criado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TierFormData }) =>
      apiFetch<SubscriptionTier>(`/loyalty/club-subscription/tiers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription-tiers-admin'] });
      setEditTier(null);
      toast.success('Plano atualizado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/loyalty/club-subscription/tiers/${id}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription-tiers-admin'] });
      toast.success('Plano desativado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Planos do clube</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Novo plano
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo plano</DialogTitle>
            </DialogHeader>
            <TierForm
              services={services}
              onSubmit={(data) => createMutation.mutate(data)}
              loading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard icon={CheckCircle2} variant="success" label="Ativos" count={activeCount} />
        <SummaryCard icon={XCircle} variant="destructive" label="Inativos" count={inactiveCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tiers.length} plano(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      {t.services
                        .map((item) => {
                          const service = services.find((s) => s.id === item.serviceId);
                          return `${item.quantity}x ${service?.name ?? item.serviceId}`;
                        })
                        .join(', ')}
                    </TableCell>
                    <TableCell>{t.discountPercentage}%</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? 'success' : 'secondary'}>
                        {t.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog open={editTier?.id === t.id} onOpenChange={(open) => setEditTier(open ? t : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              Editar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar plano</DialogTitle>
                            </DialogHeader>
                            <TierForm
                              services={services}
                              initial={{ name: t.name, services: t.services, discountPercentage: t.discountPercentage }}
                              onSubmit={(data) => updateMutation.mutate({ id: t.id, data })}
                              loading={updateMutation.isPending}
                            />
                          </DialogContent>
                        </Dialog>
                        {t.isActive && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deactivateMutation.isPending}
                            onClick={() => deactivateMutation.mutate(t.id)}
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
