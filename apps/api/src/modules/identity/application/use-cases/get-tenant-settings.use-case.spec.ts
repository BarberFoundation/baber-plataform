import { GetTenantSettingsUseCase } from './get-tenant-settings.use-case';
import { TenantNotFoundError } from '../../domain/errors/identity.errors';

function makeDb(row: Record<string, unknown> | undefined) {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(row ? [row] : []),
        }),
      }),
    }),
  };
}

const ROW = {
  id: 't1',
  name: 'Barbearia do Amigo',
  slug: 'barbearia-do-amigo',
  phone: '11999999999',
  address: 'Rua X, 123',
  timezone: 'America/Sao_Paulo',
  logoUrl: null,
  businessHours: {},
  createdAt: new Date(),
};

describe('GetTenantSettingsUseCase', () => {
  it('returns the tenant row for the given id', async () => {
    const db = makeDb(ROW);
    const uc = new GetTenantSettingsUseCase(db as never);

    const result = await uc.execute({ tenantId: 't1' });

    expect(result).toEqual(ROW);
  });

  it('throws TenantNotFoundError when tenant does not exist', async () => {
    const db = makeDb(undefined);
    const uc = new GetTenantSettingsUseCase(db as never);

    await expect(uc.execute({ tenantId: 'missing' })).rejects.toBeInstanceOf(TenantNotFoundError);
  });
});
