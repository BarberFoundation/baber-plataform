import { nextRenewalCycle, toLocalDateString, todayInSaoPaulo, firstDayOfNextMonth, endOfMonth } from './date.utils';

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

describe('todayInSaoPaulo', () => {
  it('resolves to the São Paulo calendar date even for a UTC instant already past midnight there', () => {
    // 2026-07-16T02:30:00Z is 2026-07-15T23:30:00-03:00 in São Paulo.
    expect(todayInSaoPaulo(new Date('2026-07-16T02:30:00Z'))).toBe('2026-07-15');
  });

  it('resolves to the next São Paulo calendar day just after local midnight', () => {
    // 2026-07-16T03:00:00Z is 2026-07-16T00:00:00-03:00 in São Paulo.
    expect(todayInSaoPaulo(new Date('2026-07-16T03:00:00Z'))).toBe('2026-07-16');
  });
});

describe('firstDayOfNextMonth', () => {
  it('returns the 1st of the following month', () => {
    expect(firstDayOfNextMonth('2026-07-15')).toBe('2026-08-01');
  });

  it('rolls over into January of the next year', () => {
    expect(firstDayOfNextMonth('2026-12-05')).toBe('2027-01-01');
  });
});

describe('endOfMonth', () => {
  it('returns the last day of the given date\'s month', () => {
    expect(endOfMonth('2026-08-01')).toBe('2026-08-31');
  });

  it('handles February in a leap year', () => {
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
  });
});
