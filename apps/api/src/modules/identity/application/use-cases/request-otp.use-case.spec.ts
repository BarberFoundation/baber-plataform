import { RequestOtpUseCase } from './request-otp.use-case';
import { IOtpCodeRepository, OtpCodeRecord } from '../../domain/repositories/otp-code.repository';
import { IWhatsAppGateway } from '../../../notifications/domain/ports/whatsapp-gateway.port';
import { OtpRateLimitedError } from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-1';
const PHONE = '+5511999999999';

function makeOtpRepo(): IOtpCodeRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findActiveByPhone: jest.fn().mockResolvedValue(null),
    incrementAttempts: jest.fn().mockResolvedValue(undefined),
    markUsed: jest.fn().mockResolvedValue(undefined),
  };
}

function makeGateway(): IWhatsAppGateway {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function makeRedis(overrides?: { setResult?: string | null; incrResult?: number }) {
  const setResult = overrides && 'setResult' in overrides ? overrides.setResult : 'OK';
  return {
    set: jest.fn().mockResolvedValue(setResult),
    incr: jest.fn().mockResolvedValue(overrides?.incrResult ?? 1),
    expire: jest.fn().mockResolvedValue(1),
  };
}

describe('RequestOtpUseCase', () => {
  it('generates a code, saves it hashed, and sends it via WhatsApp', async () => {
    const otpRepo = makeOtpRepo();
    const gateway = makeGateway();
    const redis = makeRedis();
    const uc = new RequestOtpUseCase(otpRepo, gateway, redis as never);

    await uc.execute({ phone: PHONE, tenantId: TENANT_ID });

    expect(otpRepo.save).toHaveBeenCalledTimes(1);
    const saved = (otpRepo.save as jest.Mock).mock.calls[0][0] as OtpCodeRecord;
    expect(saved.tenantId).toBe(TENANT_ID);
    expect(saved.phone).toBe(PHONE);
    expect(saved.attempts).toBe(0);
    expect(saved.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(gateway.send).toHaveBeenCalledTimes(1);
    expect((gateway.send as jest.Mock).mock.calls[0][0]).toBe(PHONE);
  });

  it('throws OtpRateLimitedError when cooldown key already exists', async () => {
    const redis = makeRedis({ setResult: null }); // NX failed = key already set
    const uc = new RequestOtpUseCase(makeOtpRepo(), makeGateway(), redis as never);

    await expect(uc.execute({ phone: PHONE, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      OtpRateLimitedError,
    );
  });

  it('throws OtpRateLimitedError when hourly limit exceeded', async () => {
    const redis = makeRedis({ incrResult: 6 });
    const uc = new RequestOtpUseCase(makeOtpRepo(), makeGateway(), redis as never);

    await expect(uc.execute({ phone: PHONE, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      OtpRateLimitedError,
    );
  });
});
