import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestOtpDto, VerifyOtpDto } from './otp-auth.controller';

describe('RequestOtpDto / VerifyOtpDto (POST /auth/otp validation)', () => {
  it('normalizes a formatted phone and a bare-digits phone to the identical canonical value', async () => {
    const formatted = plainToInstance(RequestOtpDto, {
      phone: '+55 11 99999-9999',
      tenantId: 'tenant-1',
    });
    const bare = plainToInstance(RequestOtpDto, {
      phone: '5511999999999',
      tenantId: 'tenant-1',
    });

    const formattedErrors = await validate(formatted);
    const bareErrors = await validate(bare);

    expect(formattedErrors).toHaveLength(0);
    expect(bareErrors).toHaveLength(0);
    expect(formatted.phone).toBe(bare.phone);
    expect(formatted.phone).toBe('+5511999999999');
  });

  it('normalizes phone formats on VerifyOtpDto the same way', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      phone: '(11) 99999-9999',
      code: '123456',
      tenantId: 'tenant-1',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+11999999999');
  });

  it('rejects garbage phone input on RequestOtpDto', async () => {
    const dto = plainToInstance(RequestOtpDto, { phone: 'abc', tenantId: 'tenant-1' });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects too-short phone input on VerifyOtpDto', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      phone: '123',
      code: '123456',
      tenantId: 'tenant-1',
    });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });
});
