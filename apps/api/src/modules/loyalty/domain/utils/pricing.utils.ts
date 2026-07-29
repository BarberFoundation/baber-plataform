import { daysInMonthUTC } from './date.utils';

/** Pro-rata charge for a monthly price, counting the calendar day itself as already owed. */
export function proratedChargeInCents(monthlyPriceInCents: number, todayDateOnly: string): number {
  const totalDays = daysInMonthUTC(todayDateOnly);
  const today = Number(todayDateOnly.split('-')[2]);
  const daysRemaining = totalDays - today + 1;
  return Math.round((monthlyPriceInCents * daysRemaining) / totalDays);
}
