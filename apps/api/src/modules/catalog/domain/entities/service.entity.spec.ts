import { Service } from './service.entity';

const BASE_PROPS = {
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: 'Corte simples',
  priceInCents: 3500,
  durationMinutes: 30,
};

describe('Service entity', () => {
  describe('create()', () => {
    it('creates an active service with generated id and timestamps', () => {
      const svc = Service.create(BASE_PROPS);
      expect(svc.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(svc.tenantId).toBe('tenant-1');
      expect(svc.name).toBe('Corte Masculino');
      expect(svc.description).toBe('Corte simples');
      expect(svc.priceInCents).toBe(3500);
      expect(svc.durationMinutes).toBe(30);
      expect(svc.isActive).toBe(true);
      expect(svc.createdAt).toBeInstanceOf(Date);
      expect(svc.updatedAt).toBeInstanceOf(Date);
    });

    it('defaults description to null when omitted', () => {
      const svc = Service.create({ ...BASE_PROPS, description: undefined });
      expect(svc.description).toBeNull();
    });
  });

  describe('reconstitute()', () => {
    it('restores all fields exactly', () => {
      const now = new Date('2024-01-01T00:00:00Z');
      const svc = Service.reconstitute({
        id: 'fixed-id',
        tenantId: 'tenant-2',
        name: 'Barba',
        description: null,
        priceInCents: 2000,
        durationMinutes: 20,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
      expect(svc.id).toBe('fixed-id');
      expect(svc.isActive).toBe(false);
      expect(svc.description).toBeNull();
    });
  });

  describe('update()', () => {
    it('mutates mutable fields and bumps updatedAt', () => {
      const svc = Service.create(BASE_PROPS);
      const before = svc.updatedAt;
      svc.update('Corte + Barba', null, 5000, 45);
      expect(svc.name).toBe('Corte + Barba');
      expect(svc.description).toBeNull();
      expect(svc.priceInCents).toBe(5000);
      expect(svc.durationMinutes).toBe(45);
      expect(svc.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('deactivate()', () => {
    it('sets isActive to false and bumps updatedAt', () => {
      const svc = Service.create(BASE_PROPS);
      expect(svc.isActive).toBe(true);
      svc.deactivate();
      expect(svc.isActive).toBe(false);
    });
  });
});
