import { RedeemCreditUseCase } from './redeem-credit.use-case';
import { StampCard } from '../../domain/entities/stamp-card.entity';
import { StampCardNotFoundError } from '../../domain/errors/loyalty.errors';
import { InsufficientCreditError } from '../../domain/errors/loyalty.errors';

describe('RedeemCreditUseCase', () => {
  it('throws StampCardNotFoundError when the client has no card', async () => {
    const cardRepo = { findByClientId: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const useCase = new RedeemCreditUseCase(cardRepo as never, { emit: jest.fn() } as never);

    await expect(useCase.execute({ tenantId: 't1', clientId: 'client-1', amountInCents: 1000 }))
      .rejects.toThrow(StampCardNotFoundError);
  });

  it('deducts the balance, saves the card and emits CREDIT_REDEEMED', async () => {
    const card = StampCard.createNew('t1', 'client-1');
    card.addStamp(1, 5000);
    const cardRepo = { findByClientId: jest.fn().mockResolvedValue(card), save: jest.fn((c) => Promise.resolve(c)) };
    const emit = jest.fn();
    const useCase = new RedeemCreditUseCase(cardRepo as never, { emit } as never);

    await useCase.execute({ tenantId: 't1', clientId: 'client-1', amountInCents: 2000 });

    expect(card.creditBalanceInCents).toBe(3000);
    expect(cardRepo.save).toHaveBeenCalledWith(card);
    expect(emit).toHaveBeenCalledWith(
      'loyalty.stamp_card.credit_redeemed',
      expect.objectContaining({ tenantId: 't1', clientId: 'client-1', amountInCents: 2000, remainingBalanceInCents: 3000 }),
    );
  });

  it('propagates InsufficientCreditError without saving', async () => {
    const card = StampCard.createNew('t1', 'client-1');
    card.addStamp(1, 1000);
    const cardRepo = { findByClientId: jest.fn().mockResolvedValue(card), save: jest.fn() };
    const useCase = new RedeemCreditUseCase(cardRepo as never, { emit: jest.fn() } as never);

    await expect(useCase.execute({ tenantId: 't1', clientId: 'client-1', amountInCents: 5000 }))
      .rejects.toThrow(InsufficientCreditError);
    expect(cardRepo.save).not.toHaveBeenCalled();
  });
});
