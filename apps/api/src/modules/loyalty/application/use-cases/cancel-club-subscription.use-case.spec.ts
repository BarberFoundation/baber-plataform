import { CancelClubSubscriptionUseCase } from './cancel-club-subscription.use-case';
import { ClubSubscriptionNotFoundError } from '../../domain/errors/loyalty.errors';

describe('CancelClubSubscriptionUseCase', () => {
  it('cancels at the gateway, marks canceled, saves, and emits', async () => {
    const sub = { status: 'ACTIVE', asaasSubscriptionId: 'asaas_sub_1', cancel: jest.fn() };
    const repo = { findByClientId: jest.fn().mockResolvedValue(sub), save: jest.fn((s) => s) };
    const paymentGateway = { cancelSubscription: jest.fn() };
    const emitter = { emit: jest.fn() };
    const useCase = new CancelClubSubscriptionUseCase(repo as never, paymentGateway as never, emitter as never);

    await useCase.execute({ tenantId: 't1', clientId: 'c1' });

    expect(paymentGateway.cancelSubscription).toHaveBeenCalledWith('asaas_sub_1');
    expect(sub.cancel).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(sub);
    expect(emitter.emit).toHaveBeenCalledWith('loyalty.club_subscription.canceled', expect.objectContaining({ tenantId: 't1', clientId: 'c1' }));
  });

  it('throws ClubSubscriptionNotFoundError when none exists', async () => {
    const repo = { findByClientId: jest.fn().mockResolvedValue(null) };
    const useCase = new CancelClubSubscriptionUseCase(repo as never, {} as never, {} as never);
    await expect(useCase.execute({ tenantId: 't1', clientId: 'c1' })).rejects.toThrow(ClubSubscriptionNotFoundError);
  });

  it('is idempotent: does not call the gateway again when already CANCELED', async () => {
    const sub = { status: 'CANCELED', asaasSubscriptionId: 'sub_stub_1', cancel: jest.fn() };
    const repo = { findByClientId: jest.fn().mockResolvedValue(sub), save: jest.fn() };
    const paymentGateway = { cancelSubscription: jest.fn() };
    const emitter = { emit: jest.fn() };
    const useCase = new CancelClubSubscriptionUseCase(repo as never, paymentGateway as never, emitter as never);

    await useCase.execute({ tenantId: 't1', clientId: 'c1' });

    expect(paymentGateway.cancelSubscription).not.toHaveBeenCalled();
    expect(sub.cancel).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
