import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PeriodSelector from '@/components/reports/period-selector';
import RevenueTab from '@/components/reports/revenue-tab';
import OccupancyTab from '@/components/reports/occupancy-tab';
import { useReportRange } from '@/lib/report-range';

export default function ReportsPage() {
  const { from, to, setRange } = useReportRange();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Faturamento e ocupação da agenda</p>
      </div>
      <PeriodSelector from={from} to={to} onChange={setRange} />
      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Faturamento</TabsTrigger>
          <TabsTrigger value="occupancy">Ocupação</TabsTrigger>
        </TabsList>
        <TabsContent value="revenue">
          <RevenueTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="occupancy">
          <OccupancyTab from={from} to={to} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
