import { UpdateTenantSettingsUseCase } from './update-tenant-settings.use-case';
import { TenantNotFoundError } from '../../domain/errors/identity.errors';

function makeDb(row: Record<string, unknown> | undefined) {
  return {
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(row ? [row] : []),
        }),
      }),
    }),
  };
}

const ROW = {
  id: 't1',
  name: 'Novo Nome',
  slug: 'barbearia-do-amigo',
  phone: '11988887777',
  address: 'Rua Y, 456',
  timezone: 'America/Sao_Paulo',
  logoUrl: 'https://example.com/logo.png',
  businessHours: {},
  createdAt: new Date(),
};

describe('UpdateTenantSettingsUseCase', () => {
  it('updates provided fields and returns the updated tenant', async () => {
    const db = makeDb(ROW);
    const uc = new UpdateTenantSettingsUseCase(db as never);

    const result = await uc.execute({ tenantId: 't1', name: 'Novo Nome' });

    expect(result).toEqual(ROW);
  });

  it('throws TenantNotFoundError when tenant does not exist', async () => {
    const db = makeDb(undefined);
    const uc = new UpdateTenantSettingsUseCase(db as never);

    await expect(uc.execute({ tenantId: 'missing', name: 'X' })).rejects.toBeInstanceOf(TenantNotFoundError);
  });
});
