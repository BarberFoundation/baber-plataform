import { Appointment } from './appointment.entity';

const BASE: Parameters<typeof Appointment.create>[0] = {
  tenantId: 'tenant-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  clientName: 'João Cliente',
  clientPhone: '+5511999999999',
  date: '2025-03-10',
  startTime: '09:00',
  endTime: '09:30',
  durationMinutes: 30,
  priceInCents: 3000,
};

describe('Appointment entity', () => {
  describe('create()', () => {
    it('creates appointment with PENDING status and generated id', () => {
      const a = Appointment.create(BASE);
      expect(a.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(a.status).toBe('PENDING');
      expect(a.tenantId).toBe('tenant-1');
      expect(a.date).toBe('2025-03-10');
      expect(a.startTime).toBe('09:00');
      expect(a.endTime).toBe('09:30');
      expect(a.notes).toBeNull();
    });

    it('stores notes when provided', () => {
      const a = Appointment.create({ ...BASE, notes: 'corte degradê' });
      expect(a.notes).toBe('corte degradê');
    });

    it('create() defaults customerId to null when not provided, and stores it when provided', () => {
      const withoutCustomer = Appointment.create({
        tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
        clientName: 'Ana', clientPhone: '+55', date: '2025-03-10',
        startTime: '09:00', endTime: '09:30', durationMinutes: 30, priceInCents: 3000,
      });
      expect(withoutCustomer.customerId).toBeNull();

      const withCustomer = Appointment.create({
        tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
        clientName: 'Ana', clientPhone: '+55', date: '2025-03-10',
        startTime: '09:00', endTime: '09:30', durationMinutes: 30, priceInCents: 3000,
        customerId: 'user-1',
      });
      expect(withCustomer.customerId).toBe('user-1');
    });
  });

  describe('confirm()', () => {
    it('transitions PENDING to CONFIRMED', () => {
      const a = Appointment.create(BASE);
      a.confirm();
      expect(a.status).toBe('CONFIRMED');
    });

    it('throws when confirming non-PENDING appointment', () => {
      const a = Appointment.reconstitute({ ...BASE, id: '1', customerId: null, status: 'CANCELLED', notes: null, createdAt: new Date(), updatedAt: new Date() });
      expect(() => a.confirm()).toThrow();
    });
  });

  describe('cancel()', () => {
    it('transitions PENDING to CANCELLED', () => {
      const a = Appointment.create(BASE);
      a.cancel();
      expect(a.status).toBe('CANCELLED');
    });

    it('transitions CONFIRMED to CANCELLED', () => {
      const a = Appointment.reconstitute({ ...BASE, id: '1', customerId: null, status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date() });
      a.cancel();
      expect(a.status).toBe('CANCELLED');
    });

    it('throws when cancelling COMPLETED appointment', () => {
      const a = Appointment.reconstitute({ ...BASE, id: '1', customerId: null, status: 'COMPLETED', notes: null, createdAt: new Date(), updatedAt: new Date() });
      expect(() => a.cancel()).toThrow();
    });
  });

  describe('complete()', () => {
    it('transitions CONFIRMED to COMPLETED', () => {
      const a = Appointment.reconstitute({ ...BASE, id: '1', customerId: null, status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date() });
      a.complete();
      expect(a.status).toBe('COMPLETED');
    });

    it('throws when completing non-CONFIRMED appointment', () => {
      const a = Appointment.create(BASE);
      expect(() => a.complete()).toThrow();
    });
  });
});
