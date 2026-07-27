import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientAuthController, ClientRefreshDto } from './client-auth.controller';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { ExchangeFirebaseClientTokenUseCase } from '../application/use-cases/exchange-firebase-client-token.use-case';

describe('ClientAuthController.refresh (POST /auth/client/refresh)', () => {
  function makeController(execute: jest.Mock) {
    const refreshUseCase = { execute } as unknown as RefreshTokenUseCase;
    const exchangeUseCase = {} as ExchangeFirebaseClientTokenUseCase;
    return new ClientAuthController(exchangeUseCase, refreshUseCase);
  }

  it('passes the body refreshToken to the use case with no tenant guard', async () => {
    const execute = jest.fn().mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 900,
      user: { id: 'u1' },
    });
    const controller = makeController(execute);

    await controller.refresh({ refreshToken: 'old-refresh' });

    expect(execute).toHaveBeenCalledWith({ rawRefreshToken: 'old-refresh' });
  });

  it('returns the new refresh token in the response body (mobile has no cookie jar)', async () => {
    const execute = jest.fn().mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 900,
      user: { id: 'u1' },
    });
    const controller = makeController(execute);

    const result = await controller.refresh({ refreshToken: 'old-refresh' });

    expect(result).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 900,
      user: { id: 'u1' },
    });
  });
});

describe('ClientRefreshDto validation', () => {
  it('rejects a missing refreshToken', async () => {
    const dto = plainToInstance(ClientRefreshDto, {});
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('refreshToken');
  });

  it('accepts a valid refreshToken', async () => {
    const dto = plainToInstance(ClientRefreshDto, { refreshToken: 'abc123' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
