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

  it('allows renaming via domain method', () => {
    const user = User.reconstitute(base);
    user.rename('Novo Nome');
    expect(user.name).toBe('Novo Nome');
  });

  describe('User.createClient', () => {
    it('creates a CLIENT user with phone and no name', () => {
      const user = User.createClient({ tenantId: 'tenant-1', phone: '+5511999999999' });

      expect(user.role).toBe('CLIENT');
      expect(user.phone).toBe('+5511999999999');
      expect(user.tenantId).toBe('tenant-1');
      expect(user.name).toBeNull();
      expect(user.email).toBeNull();
      expect(user.firebaseUid).toBeNull();
      expect(user.id).toBeTruthy();
    });
  });
});
