import { Barber } from './barber.entity';
import { defaultWorkSchedule } from '../value-objects/work-schedule';

const BASE = {
  tenantId: 'tenant-1',
  name: 'João Barber',
  phone: '+5511999999999',
};

describe('Barber entity', () => {
  describe('create()', () => {
    it('creates an active barber with generated id, default schedule, and timestamps', () => {
      const b = Barber.create(BASE);
      expect(b.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(b.tenantId).toBe('tenant-1');
      expect(b.name).toBe('João Barber');
      expect(b.phone).toBe('+5511999999999');
      expect(b.isActive).toBe(true);
      expect(b.workSchedule).toEqual(defaultWorkSchedule());
      expect(b.createdAt).toBeInstanceOf(Date);
      expect(b.updatedAt).toBeInstanceOf(Date);
    });

    it('defaults phone to null when omitted', () => {
      const b = Barber.create({ tenantId: 'tenant-1', name: 'Ana' });
      expect(b.phone).toBeNull();
    });

    it('uses provided workSchedule when given', () => {
      const schedule = defaultWorkSchedule();
      schedule.sun = { isWorking: true, startTime: '10:00', endTime: '14:00' };
      const b = Barber.create({ ...BASE, workSchedule: schedule });
      expect(b.workSchedule.sun.isWorking).toBe(true);
    });
  });

  describe('reconstitute()', () => {
    it('restores all fields exactly', () => {
      const now = new Date('2024-01-01T00:00:00Z');
      const b = Barber.reconstitute({
        id: 'fixed-id',
        tenantId: 'tenant-2',
        name: 'Pedro',
        phone: null,
        isActive: false,
        workSchedule: defaultWorkSchedule(),
        createdAt: now,
        updatedAt: now,
      });
      expect(b.id).toBe('fixed-id');
      expect(b.isActive).toBe(false);
      expect(b.phone).toBeNull();
    });
  });

  describe('update()', () => {
    it('mutates name and phone, bumps updatedAt', () => {
      const b = Barber.create(BASE);
      const before = b.updatedAt;
      b.update('João Silva', null);
      expect(b.name).toBe('João Silva');
      expect(b.phone).toBeNull();
      expect(b.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('setWorkSchedule()', () => {
    it('replaces work schedule and bumps updatedAt', () => {
      const b = Barber.create(BASE);
      const newSchedule = defaultWorkSchedule();
      newSchedule.mon = { isWorking: false, startTime: null, endTime: null };
      b.setWorkSchedule(newSchedule);
      expect(b.workSchedule.mon.isWorking).toBe(false);
    });
  });

  describe('deactivate()', () => {
    it('sets isActive to false and bumps updatedAt', () => {
      const b = Barber.create(BASE);
      b.deactivate();
      expect(b.isActive).toBe(false);
    });
  });
});
