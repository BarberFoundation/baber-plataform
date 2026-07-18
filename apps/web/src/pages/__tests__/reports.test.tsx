import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportsPage from '../reports';
import { formatBRL } from '@/lib/utils';
import type { RevenueReport, OccupancyReport, BarberRankingEntry } from '@/lib/types';

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

const rankingFixture: BarberRankingEntry[] = [
  { barberId: 'b1', barberName: 'João', totalInCents: 70000, appointmentCount: 25, averageTicketInCents: 2800, occupancyRate: 0.5 },
  { barberId: 'b2', barberName: 'Maria', totalInCents: 90000, appointmentCount: 10, averageTicketInCents: 9000, occupancyRate: 0.8 },
];

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn((path: string) => {
    if (path.startsWith('/reports/revenue')) return Promise.resolve(revenueFixture);
    if (path.startsWith('/reports/barbers/ranking')) return Promise.resolve(rankingFixture);
    return Promise.resolve(occupancyFixture);
  }),
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

  it('has a Ranking tab', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: /ranking/i })).toBeInTheDocument();
  });

  it('shows the ranking table sorted by revenue by default', async () => {
    renderPage();
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /ranking/i }), { button: 0 });
    const rows = await screen.findAllByRole('row');
    // rows[0] é o cabeçalho; maior faturamento (Maria, 90000) vem primeiro
    expect(within(rows[1]).getByText('Maria')).toBeInTheDocument();
    expect(within(rows[2]).getByText('João')).toBeInTheDocument();
  });

  it('re-sorts when a different column header is clicked', async () => {
    renderPage();
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /ranking/i }), { button: 0 });
    await screen.findAllByRole('row');
    fireEvent.click(screen.getByRole('button', { name: /atendimentos/i }));
    const rows = await screen.findAllByRole('row');
    // João tem mais atendimentos (25 vs 10)
    expect(within(rows[1]).getByText('João')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Maria')).toBeInTheDocument();
  });

  it('toggles sort direction on a second click of the same header', async () => {
    renderPage();
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /ranking/i }), { button: 0 });
    await screen.findAllByRole('row');
    fireEvent.click(screen.getByRole('button', { name: /faturamento/i })); // já ativo em desc → alterna pra asc
    const rows = await screen.findAllByRole('row');
    expect(within(rows[1]).getByText('João')).toBeInTheDocument(); // 70000 < 90000, ascendente
    expect(within(rows[2]).getByText('Maria')).toBeInTheDocument();
  });
});
