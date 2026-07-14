import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportsPage from '../reports';
import { formatBRL } from '@/lib/utils';
import type { RevenueReport, OccupancyReport } from '@/lib/types';

// ResponsiveContainer mede o DOM real; em happy-dom a largura é 0 e o chart não
// renderiza — substitui por um wrapper de tamanho fixo.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

const revenueFixture: RevenueReport = {
  totalInCents: 125000,
  appointmentCount: 42,
  averageTicketInCents: 2976,
  byDay: [{ date: '2026-07-01', totalInCents: 5000, count: 2 }],
  byService: [{ serviceId: 's1', serviceName: 'Corte', totalInCents: 80000, count: 30 }],
  byBarber: [{ barberId: 'b1', barberName: 'João', totalInCents: 70000, count: 25 }],
};

const occupancyFixture: OccupancyReport = {
  overallRate: 0.62,
  scheduledMinutes: 3720,
  availableMinutes: 6000,
  byBarber: [{ barberId: 'b1', barberName: 'João', rate: 0.71, scheduledMinutes: 2130, availableMinutes: 3000 }],
  heatmap: [{ weekday: 6, hour: 10, count: 14 }],
  cancellation: { cancelled: 8, total: 50, rate: 0.16 },
};

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn((path: string) =>
    path.startsWith('/reports/revenue')
      ? Promise.resolve(revenueFixture)
      : Promise.resolve(occupancyFixture),
  ),
}));

// Intl usa NBSP entre "R$" e o número; o normalizer do testing-library
// converte NBSP do DOM em espaço comum, então normaliza o matcher também.
const brl = (cents: number) => formatBRL(cents).replace(/ /g, ' ');

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/reports']}>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders revenue summary cards', async () => {
    renderPage();
    expect(await screen.findByText(brl(125000))).toBeInTheDocument(); // receita total
    expect(screen.getByText(brl(2976))).toBeInTheDocument();          // ticket médio
    expect(screen.getByText('42')).toBeInTheDocument();                     // atendimentos
  });

  it('has Faturamento and Ocupação tabs', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: /faturamento/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ocupa/i })).toBeInTheDocument();
  });

  it('shows occupancy rate and cancellation after switching tab', async () => {
    renderPage();
    // Radix Tabs ativa no mousedown, não no click
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /ocupa/i }), { button: 0 });
    expect(await screen.findByText('62%')).toBeInTheDocument();        // ocupação geral
    expect(screen.getByText('16%')).toBeInTheDocument();               // cancelamento
    expect(screen.getByText(/3720 de 6000/)).toBeInTheDocument();      // minutos agendados/disponíveis
    expect(screen.getByText(/8 de 50 agendamentos/)).toBeInTheDocument(); // contagem de cancelados
  });
});
