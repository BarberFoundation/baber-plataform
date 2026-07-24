import { GetMyClubSubscriptionUseCase } from './get-my-club-subscription.use-case';
import { ClubSubscriptionNotFoundError } from '../../domain/errors/loyalty.errors';

describe('GetMyClubSubscriptionUseCase', () => {
  it('returns the subscription when found', async () => {
    const repo = { findByClientId: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) };
    const useCase = new GetMyClubSubscriptionUseCase(repo as never);
    const result = await useCase.execute({ tenantId: 't1', clientId: 'c1' });
    expect(result.status).toBe('ACTIVE');
  });

  it('throws ClubSubscriptionNotFoundError when none exists', async () => {
    const repo = { findByClientId: jest.fn().mockResolvedValue(null) };
    const useCase = new GetMyClubSubscriptionUseCase(repo as never);
    await expect(useCase.execute({ tenantId: 't1', clientId: 'c1' })).rejects.toThrow(ClubSubscriptionNotFoundError);
  });

  it('throws ClubSubscriptionNotFoundError when the row exists but was canceled', async () => {
    // Row is reused across cycles (unique tenant+client), so a canceled row still
    // exists — must read as "no subscription", not resurface as an active plan.
    const repo = { findByClientId: jest.fn().mockResolvedValue({ status: 'CANCELED' }) };
    const useCase = new GetMyClubSubscriptionUseCase(repo as never);
    await expect(useCase.execute({ tenantId: 't1', clientId: 'c1' })).rejects.toThrow(ClubSubscriptionNotFoundError);
  });
});
