import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BusinessHoursEditor } from '@/components/schedule/business-hours-editor';
import type { TenantSettings, DayOfWeek, DaySchedule } from '@/lib/types';

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiFetch<TenantSettings>('/tenants/me'),
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [businessHours, setBusinessHours] = useState<Record<DayOfWeek, DaySchedule> | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (tenant && !hasLoaded) {
      setName(tenant.name);
      setPhone(tenant.phone ?? '');
      setAddress(tenant.address ?? '');
      setLogoUrl(tenant.logoUrl ?? '');
      setBusinessHours(tenant.businessHours);
      setHasLoaded(true);
    }
  }, [tenant, hasLoaded]);

  const updateMutation = useMutation({
    mutationFn: (data: {
      name: string;
      phone: string;
      address: string;
      logoUrl: string;
      businessHours: Record<DayOfWeek, DaySchedule>;
    }) =>
      apiFetch<TenantSettings>('/tenants/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast.success('Configurações atualizadas.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !businessHours) {
    return <p className="text-muted-foreground text-sm">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações da barbearia</h1>
        <p className="text-muted-foreground text-sm">Dados públicos e horário de funcionamento</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate({
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            logoUrl: logoUrl.trim(),
            businessHours,
          });
        }}
        className="space-y-6"
      >
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Dados da barbearia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="t-name">Nome *</Label>
              <Input id="t-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-phone">Telefone</Label>
              <Input id="t-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-address">Endereço</Label>
              <Input id="t-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-logo">Logo (URL)</Label>
              <Input
                id="t-logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horário de funcionamento</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessHoursEditor value={businessHours} onChange={setBusinessHours} />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
