import { useSearchParams } from 'react-router-dom';
import { format, subDays } from 'date-fns';

const FMT = 'yyyy-MM-dd';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function useReportRange() {
  const [params, setParams] = useSearchParams();

  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const from = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : format(subDays(new Date(), 29), FMT);
  const to = rawTo && DATE_RE.test(rawTo) ? rawTo : format(new Date(), FMT);

  function setRange(nextFrom: string, nextTo: string) {
    setParams({ from: nextFrom, to: nextTo });
  }

  return { from, to, setRange };
}
