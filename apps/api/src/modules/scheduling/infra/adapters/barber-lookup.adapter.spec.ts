import { BarberLookupAdapter } from './barber-lookup.adapter';

function makeDb(rows: any[]) {
  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(rows),
  } as any;
}

describe('BarberLookupAdapter.listActiveByTenant', () => {
  it('returns id, isActive and workSchedule for each row', async () => {
    const rows = [
      { id: 'b1', isActive: true, workSchedule: {} },
      { id: 'b2', isActive: true, workSchedule: {} },
    ];
    const adapter = new BarberLookupAdapter(makeDb(rows));
    const result = await adapter.listActiveByTenant('tenant-1');
    expect(result).toEqual([
      { id: 'b1', isActive: true, workSchedule: {} },
      { id: 'b2', isActive: true, workSchedule: {} },
    ]);
  });
});
