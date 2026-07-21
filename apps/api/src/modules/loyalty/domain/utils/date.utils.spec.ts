import { nextRenewalCycle, toLocalDateString } from './date.utils';

describe('nextRenewalCycle', () => {
  it('advances to the next day and the end of that day\'s month', () => {
    expect(nextRenewalCycle('2026-07-21')).toEqual({ cycleStart: '2026-07-22', cycleEnd: '2026-07-31' });
  });

  it('regression: an end-of-month cycleEnd must not collapse start/end into the same day', () => {
    // Found via manual Asaas sandbox webhook testing: new Date('2026-08-31') is UTC
    // midnight, which is 2026-08-30T21:00 in America/Sao_Paulo (UTC-3) — mixing that
    // with local getDate()/setDate() silently produced cycleStart === cycleEnd === '2026-08-31'.
    expect(nextRenewalCycle('2026-08-31')).toEqual({ cycleStart: '2026-09-01', cycleEnd: '2026-09-30' });
  });

  it('handles a December cycleEnd rolling into January of the next year', () => {
    expect(nextRenewalCycle('2026-12-31')).toEqual({ cycleStart: '2027-01-01', cycleEnd: '2027-01-31' });
  });

  it('handles February in a leap year', () => {
    expect(nextRenewalCycle('2028-01-31')).toEqual({ cycleStart: '2028-02-01', cycleEnd: '2028-02-29' });
  });
});

describe('toLocalDateString', () => {
  it('formats using local calendar components', () => {
    expect(toLocalDateString(new Date(2026, 6, 5))).toBe('2026-07-05');
  });
});
