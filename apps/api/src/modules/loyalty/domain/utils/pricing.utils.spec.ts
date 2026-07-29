import { proratedChargeInCents } from './pricing.utils';

describe('proratedChargeInCents', () => {
  it('charges the full price when activating on the 1st', () => {
    expect(proratedChargeInCents(10000, '2026-08-01')).toBe(10000);
  });

  it('charges roughly half the price when activating mid-month', () => {
    // 2026-08 has 31 days; activating on the 16th leaves 16 remaining (16th through 31st).
    expect(proratedChargeInCents(3100, '2026-08-16')).toBe(1600);
  });

  it('charges a single day worth of price when activating on the last day', () => {
    expect(proratedChargeInCents(3100, '2026-08-31')).toBe(100);
  });
});
