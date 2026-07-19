import { StampCardConfig } from './stamp-card-config.entity';
import { InvalidStampCardConfigError } from '../errors/loyalty.errors';

describe('StampCardConfig', () => {
  const validProps = {
    tenantId: 't1',
    eligibleServiceIds: ['svc-1', 'svc-2'],
    stampsRequired: 10,
    creditValueInCents: 5000,
    isActive: true,
  };

  it('creates a config with valid props', () => {
    const config = StampCardConfig.create(validProps);
    expect(config.tenantId).toBe('t1');
    expect(config.eligibleServiceIds).toEqual(['svc-1', 'svc-2']);
    expect(config.stampsRequired).toBe(10);
    expect(config.creditValueInCents).toBe(5000);
    expect(config.isActive).toBe(true);
    expect(config.id).toBeDefined();
  });

  it('rejects stampsRequired less than 1', () => {
    expect(() => StampCardConfig.create({ ...validProps, stampsRequired: 0 })).toThrow(InvalidStampCardConfigError);
  });

  it('rejects creditValueInCents less than 1', () => {
    expect(() => StampCardConfig.create({ ...validProps, creditValueInCents: 0 })).toThrow(InvalidStampCardConfigError);
  });

  it('rejects an empty eligibleServiceIds list', () => {
    expect(() => StampCardConfig.create({ ...validProps, eligibleServiceIds: [] })).toThrow(InvalidStampCardConfigError);
  });

  describe('isServiceEligible', () => {
    it('returns true for an eligible service when active', () => {
      const config = StampCardConfig.create(validProps);
      expect(config.isServiceEligible('svc-1')).toBe(true);
    });

    it('returns false for a service not in the list', () => {
      const config = StampCardConfig.create(validProps);
      expect(config.isServiceEligible('svc-99')).toBe(false);
    });

    it('returns false when the config is inactive, even for an eligible service', () => {
      const config = StampCardConfig.create({ ...validProps, isActive: false });
      expect(config.isServiceEligible('svc-1')).toBe(false);
    });
  });
});
