import { AppointmentCompletedListener } from './appointment-completed.listener';
import { AppointmentEventPayload } from '@shared/events/appointment-events';

function makePayload(overrides: Partial<AppointmentEventPayload> = {}): AppointmentEventPayload {
  return {
    appointmentId: 'appt-1',
    tenantId: 't1',
    customerId: 'client-1',
    clientName: 'João',
    clientPhone: '+5511999999999',
    barberId: 'barber-1',
    serviceId: 'svc-1',
    date: '2026-07-20',
    startTime: '10:00',
    endTime: '10:30',
    ...overrides,
  };
}

describe('AppointmentCompletedListener', () => {
  it('grants a stamp using the tenant, customerId and serviceId from the payload', async () => {
    const grantStamp = { execute: jest.fn() };
    const listener = new AppointmentCompletedListener(grantStamp as never);

    await listener.handle(makePayload());

    expect(grantStamp.execute).toHaveBeenCalledWith({ tenantId: 't1', clientId: 'client-1', serviceId: 'svc-1' });
  });

  it('does nothing for a guest appointment with no customerId', async () => {
    const grantStamp = { execute: jest.fn() };
    const listener = new AppointmentCompletedListener(grantStamp as never);

    await listener.handle(makePayload({ customerId: null }));

    expect(grantStamp.execute).not.toHaveBeenCalled();
  });
});
