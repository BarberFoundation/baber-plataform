import { StampCard } from './stamp-card.entity';
import { InsufficientCreditError, InvalidRedemptionAmountError } from '../errors/loyalty.errors';

describe('StampCard', () => {
  it('creates a new card with zero stamps and zero balance', () => {
    const card = StampCard.createNew('t1', 'client-1');
    expect(card.tenantId).toBe('t1');
    expect(card.clientId).toBe('client-1');
    expect(card.currentStamps).toBe(0);
    expect(card.creditBalanceInCents).toBe(0);
  });

  describe('addStamp', () => {
    it('increments currentStamps and reports not completed while under the threshold', () => {
      const card = StampCard.createNew('t1', 'client-1');
      const result = card.addStamp(3, 5000);
      expect(card.currentStamps).toBe(1);
      expect(card.creditBalanceInCents).toBe(0);
      expect(result).toEqual({ completed: false, creditEarnedInCents: 0 });
    });

    it('resets currentStamps to 0 and credits the balance when the threshold is reached', () => {
      const card = StampCard.createNew('t1', 'client-1');
      card.addStamp(2, 5000);
      const result = card.addStamp(2, 5000);
      expect(card.currentStamps).toBe(0);
      expect(card.creditBalanceInCents).toBe(5000);
      expect(result).toEqual({ completed: true, creditEarnedInCents: 5000 });
    });

    it('accumulates credit balance across multiple completions', () => {
      const card = StampCard.createNew('t1', 'client-1');
      card.addStamp(1, 5000); // completes immediately, threshold=1
      card.addStamp(1, 5000); // completes again
      expect(card.creditBalanceInCents).toBe(10000);
    });
  });

  describe('redeemCredit', () => {
    it('subtracts the amount from the balance', () => {
      const card = StampCard.createNew('t1', 'client-1');
      card.addStamp(1, 5000);
      card.redeemCredit(2000);
      expect(card.creditBalanceInCents).toBe(3000);
    });

    it('throws InvalidRedemptionAmountError for a zero or negative amount', () => {
      const card = StampCard.createNew('t1', 'client-1');
      card.addStamp(1, 5000);
      expect(() => card.redeemCredit(0)).toThrow(InvalidRedemptionAmountError);
      expect(() => card.redeemCredit(-100)).toThrow(InvalidRedemptionAmountError);
    });

    it('throws InsufficientCreditError when amount exceeds balance', () => {
      const card = StampCard.createNew('t1', 'client-1');
      card.addStamp(1, 5000);
      expect(() => card.redeemCredit(5001)).toThrow(InsufficientCreditError);
    });
  });
});
