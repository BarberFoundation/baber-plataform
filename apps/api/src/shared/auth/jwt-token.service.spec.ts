import { JwtTokenService, JwtPayload } from './jwt-token.service';

describe('JwtTokenService', () => {
  const service = new JwtTokenService('access-secret', 'refresh-secret', '15m', '30d');

  const payload: JwtPayload = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'ADMIN',
  };

  it('signs and verifies access token', () => {
    const token = service.signAccess(payload);
    const decoded = service.verifyAccess(token);
    expect(decoded.userId).toBe('user-1');
    expect(decoded.tenantId).toBe('tenant-1');
    expect(decoded.role).toBe('ADMIN');
  });

  it('signs refresh token without throwing', () => {
    const token = service.signRefresh(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('throws on invalid access token', () => {
    expect(() => service.verifyAccess('not.a.token')).toThrow();
  });

  it('returns expiresIn as positive number', () => {
    expect(service.accessExpiresInSeconds).toBeGreaterThan(0);
  });
});
