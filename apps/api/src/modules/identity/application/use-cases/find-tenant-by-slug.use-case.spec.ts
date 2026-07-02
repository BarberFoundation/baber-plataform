import { FindTenantBySlugUseCase } from './find-tenant-by-slug.use-case';

function makeDb(row: { id: string; slug: string; name: string } | undefined) {
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

describe('FindTenantBySlugUseCase', () => {
  it('returns the tenant when the slug exists', async () => {
    const db = makeDb({ id: 't1', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo' });
    const uc = new FindTenantBySlugUseCase(db as never);

    const result = await uc.execute('barbearia-do-amigo');

    expect(result).toEqual({ id: 't1', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo' });
  });

  it('returns null when the slug does not exist', async () => {
    const db = makeDb(undefined);
    const uc = new FindTenantBySlugUseCase(db as never);

    const result = await uc.execute('unknown-slug');

    expect(result).toBeNull();
  });
});
