/** Formats a Date as 'YYYY-MM-DD' using local time components (avoids the UTC-rollover bug that toISOString().slice(0, 10) has near midnight). */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Given a date-only 'YYYY-MM-DD' cycle end, returns the day after it (new cycle
 * start) and the last day of the following month (new cycle end).
 *
 * Does all arithmetic with Date.UTC + UTC getters exclusively — never mixes a
 * UTC-parsed date-only Date (`new Date('2026-08-31')` is midnight UTC) with
 * local getDate()/setDate()/getMonth() reads, which silently roll the calendar
 * day backwards in negative-UTC-offset timezones like America/Sao_Paulo (found
 * via manual Asaas sandbox webhook testing: a 2026-08-31 cycle end renewed into
 * a 2026-08-31/2026-08-31 cycle instead of 2026-09-01/2026-09-30).
 */
export function nextRenewalCycle(cycleEndDateOnly: string): { cycleStart: string; cycleEnd: string } {
  const [year, month, day] = cycleEndDateOnly.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day + 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { cycleStart: fmt(start), cycleEnd: fmt(end) };
}
