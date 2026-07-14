import { User } from './user.entity';

describe('User entity', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    name: 'João Admin',
    role: 'ADMIN' as const,
    phone: null,
    email: 'joao@barbearia.com',
    firebaseUid: 'firebase-uid-abc',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  it('reconstitutes from DB row', () => {
    const user = User.reconstitute(base);
    expect(user.id).toBe(base.id);
    expect(user.role).toBe('ADMIN');
    expect(user.firebaseUid).toBe('firebase-uid-abc');
  });

  it('creates new admin user with correct props', () => {
    const user = User.createAdmin({
      tenantId: base.tenantId,
      email: 'new@barbearia.com',
      phone: null,
      firebaseUid: 'firebase-uid-xyz',
      name: null,
    });
    expect(user.role).toBe('ADMIN');
    expect(user.id).toBeDefined();
    expect(user.phone).toBeNull();
    expect(user.tenantId).toBe(base.tenantId);
    expect(user.email).toBe('new@barbearia.com');
    expect(user.firebaseUid).toBe('firebase-uid-xyz');
    expect(user.name).toBeNull();
  });

  it('creates an admin logging in by phone (no email)', () => {
    const user = User.createAdmin({
      tenantId: base.tenantId,
      email: null,
      phone: '+5511999999999',
      firebaseUid: 'firebase-uid-phone',
      name: null,
    });
    expect(user.role).toBe('ADMIN');
    expect(user.email).toBeNull();
    expect(user.phone).toBe('+5511999999999');
  });

  it('allows renaming via domain method', () => {
    const user = User.reconstitute(base);
    user.rename('Novo Nome');
    expect(user.name).toBe('Novo Nome');
  });

  it('allows updating phone via domain method', () => {
    const user = User.reconstitute(base);
    user.updatePhone('+5511988887777');
    expect(user.phone).toBe('+5511988887777');
  });

  describe('User.createClient', () => {
    it('creates a CLIENT user with phone, firebaseUid, and no name', () => {
      const user = User.createClient({
        tenantId: 'tenant-1',
        phone: '+5511999999999',
        firebaseUid: 'firebase-uid-client',
      });

      expect(user.role).toBe('CLIENT');
      expect(user.phone).toBe('+5511999999999');
      expect(user.tenantId).toBe('tenant-1');
      expect(user.name).toBeNull();
      expect(user.email).toBeNull();
      expect(user.firebaseUid).toBe('firebase-uid-client');
      expect(user.id).toBeTruthy();
    });
  });
  describe('linkFirebaseUid', () => {
    it('links a firebase uid to a user that has none', () => {
      const user = User.reconstitute({
        id: 'u1',
        tenantId: 't1',
        name: 'Legado',
        role: 'CLIENT',
        phone: '+5511999999999',
        email: null,
        firebaseUid: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      user.linkFirebaseUid('fb-123');
      expect(user.firebaseUid).toBe('fb-123');
    });

    it('refuses to overwrite an existing firebase uid', () => {
      const user = User.reconstitute({
        id: 'u1',
        tenantId: 't1',
        name: null,
        role: 'CLIENT',
        phone: '+5511999999999',
        email: null,
        firebaseUid: 'fb-original',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(() => user.linkFirebaseUid('fb-other')).toThrow();
    });
  });
});
