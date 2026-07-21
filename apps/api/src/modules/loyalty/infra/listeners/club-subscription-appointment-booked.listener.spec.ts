import { ClubSubscriptionAppointmentBookedListener } from './club-subscription-appointment-booked.listener';
import { SubscriptionQuotaExhaustedError } from '../../domain/errors/loyalty.errors';

describe('ClubSubscriptionAppointmentBookedListener', () => {
  const payload = {
    appointmentId: 'appt-1', tenantId: 't1', customerId: 'client-1', clientName: 'x', clientPhone: 'y',
    barberId: 'b1', serviceId: 'svc-1', date: '2026-07-25', startTime: '14:00', endTime: '14:30',
  };

  it('skips guest bookings (customerId null)', async () => {
    const clubSubRepo = { findByClientId: jest.fn(), save: jest.fn() };
    const listener = new ClubSubscriptionAppointmentBookedListener(clubSubRepo as never);
    await listener.handle({ ...payload, customerId: null });
    expect(clubSubRepo.findByClientId).not.toHaveBeenCalled();
  });

  it('does nothing if the client has no ACTIVE subscription', async () => {
    const clubSubRepo = { findByClientId: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const listener = new ClubSubscriptionAppointmentBookedListener(clubSubRepo as never);
    await listener.handle(payload);
    expect(clubSubRepo.save).not.toHaveBeenCalled();
  });

  it('consumes the quota and saves when subscription is ACTIVE', async () => {
    const sub = { status: 'ACTIVE', consumeQuota: jest.fn() };
    const clubSubRepo = { findByClientId: jest.fn().mockResolvedValue(sub), save: jest.fn() };
    const listener = new ClubSubscriptionAppointmentBookedListener(clubSubRepo as never);
    await listener.handle(payload);
    expect(sub.consumeQuota).toHaveBeenCalledWith('svc-1');
    expect(clubSubRepo.save).toHaveBeenCalledWith(sub);
  });

  it('does nothing when subscription exists but is not ACTIVE', async () => {
    const sub = { status: 'PAST_DUE', consumeQuota: jest.fn() };
    const clubSubRepo = { findByClientId: jest.fn().mockResolvedValue(sub), save: jest.fn() };
    const listener = new ClubSubscriptionAppointmentBookedListener(clubSubRepo as never);
    await listener.handle(payload);
    expect(sub.consumeQuota).not.toHaveBeenCalled();
  });

  it('swallows a quota-exhausted error instead of letting it reject handle() (appointment.booked is fire-and-forget)', async () => {
    const sub = {
      status: 'ACTIVE',
      consumeQuota: jest.fn(() => {
        throw new SubscriptionQuotaExhaustedError();
      }),
    };
    const clubSubRepo = { findByClientId: jest.fn().mockResolvedValue(sub), save: jest.fn() };
    const listener = new ClubSubscriptionAppointmentBookedListener(clubSubRepo as never);
    await expect(listener.handle(payload)).resolves.toBeUndefined();
    expect(clubSubRepo.save).not.toHaveBeenCalled();
  });
});
