import { useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays, format, subDays } from 'date-fns';

const FMT = 'yyyy-MM-dd';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Report charts fill one data point per day in the range (see fillDays in
// revenue-tab.tsx / new-returning-section.tsx) — an inverted or multi-year
// range would loop that many times and hang the tab.
const MAX_RANGE_DAYS = 366;

export function useReportRange() {
  const [params, setParams] = useSearchParams();

  const defaultFrom = format(subDays(new Date(), 29), FMT);
  const defaultTo = format(new Date(), FMT);

  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const candidateFrom = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : defaultFrom;
  const candidateTo = rawTo && DATE_RE.test(rawTo) ? rawTo : defaultTo;

  const spanDays = differenceInCalendarDays(
    new Date(`${candidateTo}T00:00:00`),
    new Date(`${candidateFrom}T00:00:00`),
  );
  const isValidRange = spanDays >= 0 && spanDays <= MAX_RANGE_DAYS;

  const from = isValidRange ? candidateFrom : defaultFrom;
  const to = isValidRange ? candidateTo : defaultTo;

  function setRange(nextFrom: string, nextTo: string) {
    setParams({ from: nextFrom, to: nextTo });
  }

  return { from, to, setRange };
}
