import { ListTenantsUseCase } from './list-tenants.use-case';

function makeDb(rows: Array<{ id: string; slug: string; name: string }>) {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockResolvedValue(rows),
    }),
  };
}

describe('ListTenantsUseCase', () => {
  it('returns id/slug/name for all tenants', async () => {
    const db = makeDb([{ id: 't1', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo' }]);
    const uc = new ListTenantsUseCase(db as never);

    const result = await uc.execute();

    expect(result).toEqual([{ id: 't1', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo' }]);
  });
});
