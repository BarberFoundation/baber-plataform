import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientsPage from '../clients';
import { apiFetch } from '@/lib/api';
import type { NewReturningCounts, InactiveClient } from '@/lib/types';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

const newReturningFixture: NewReturningCounts = {
  newCount: 12,
  returningCount: 34,
  byDay: [{ date: '2026-07-01', newCount: 2, returningCount: 5 }],
};

const inactiveFixture: InactiveClient[] = [
  { customerId: 'c1', name: 'Maria', phone: '+5511999999999', lastVisitDate: '2026-04-01', daysSinceLastVisit: 105 },
];

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn((path: string) =>
    path.startsWith('/reports/clients/new-returning')
      ? Promise.resolve(newReturningFixture)
      : Promise.resolve(inactiveFixture),
  ),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/clients']}>
        <ClientsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ClientsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders new/returning stat cards', async () => {
    renderPage();
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
  });

  it('renders inactive clients table', async () => {
    renderPage();
    expect(await screen.findByText('Maria')).toBeInTheDocument();
    expect(screen.getByText('105')).toBeInTheDocument();
  });

  it('shows empty state when no inactive clients', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) =>
      path.startsWith('/reports/clients/new-returning')
        ? Promise.resolve(newReturningFixture)
        : Promise.resolve([]),
    );
    renderPage();
    expect(await screen.findByText('Nenhum cliente inativo.')).toBeInTheDocument();
  });
});
