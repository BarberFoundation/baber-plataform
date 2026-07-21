import { ClubSubscriptionAppointmentCancelledListener } from './club-subscription-appointment-cancelled.listener';

describe('ClubSubscriptionAppointmentCancelledListener', () => {
  function payloadAt(hoursFromNow: number) {
    const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    // Built from local wall-clock fields (not toISOString/UTC), matching how the
    // listener parses `${date}T${startTime}:00` as local time — same convention
    // used by cancel-appointment.use-case.ts and reminder-window.ts.
    const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    return {
      appointmentId: 'appt-1', tenantId: 't1', customerId: 'client-1', clientName: 'x', clientPhone: 'y',
      barberId: 'b1', serviceId: 'svc-1', date, startTime, endTime: startTime,
    };
  }

  it('refunds the quota when cancelled 2h+ before the appointment', async () => {
    const sub = { status: 'ACTIVE', refundQuota: jest.fn() };
    const clubSubRepo = { findByClientId: jest.fn().mockResolvedValue(sub), save: jest.fn() };
    const listener = new ClubSubscriptionAppointmentCancelledListener(clubSubRepo as never);
    await listener.handle(payloadAt(3));
    expect(sub.refundQuota).toHaveBeenCalledWith('svc-1');
    expect(clubSubRepo.save).toHaveBeenCalledWith(sub);
  });

  it('does not refund when cancelled less than 2h before (no-show window)', async () => {
    const sub = { status: 'ACTIVE', refundQuota: jest.fn() };
    const clubSubRepo = { findByClientId: jest.fn().mockResolvedValue(sub), save: jest.fn() };
    const listener = new ClubSubscriptionAppointmentCancelledListener(clubSubRepo as never);
    await listener.handle(payloadAt(1));
    expect(sub.refundQuota).not.toHaveBeenCalled();
    expect(clubSubRepo.save).not.toHaveBeenCalled();
  });

  it('skips guest bookings', async () => {
    const clubSubRepo = { findByClientId: jest.fn(), save: jest.fn() };
    const listener = new ClubSubscriptionAppointmentCancelledListener(clubSubRepo as never);
    await listener.handle({ ...payloadAt(3), customerId: null });
    expect(clubSubRepo.findByClientId).not.toHaveBeenCalled();
  });
});
