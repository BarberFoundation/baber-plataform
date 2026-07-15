import PeriodSelector from '@/components/reports/period-selector';
import NewReturningSection from '@/components/clients/new-returning-section';
import InactiveClientsSection from '@/components/clients/inactive-clients-section';
import { useReportRange } from '@/lib/report-range';

export default function ClientsPage() {
  const { from, to, setRange } = useReportRange();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-muted-foreground text-sm">Novos, recorrentes e clientes inativos</p>
      </div>
      <PeriodSelector from={from} to={to} onChange={setRange} />
      <NewReturningSection from={from} to={to} />
      <InactiveClientsSection />
    </div>
  );
}
