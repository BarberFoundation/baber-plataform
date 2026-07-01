import { ListBarbersUseCase } from './list-barbers.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { defaultWorkSchedule } from '../../domain/value-objects/work-schedule';

const makeBarber = (id: string, isActive: boolean) =>
  Barber.reconstitute({
    id,
    tenantId: 'tenant-1',
    name: `Barber ${id}`,
    phone: null,
    isActive,
    workSchedule: defaultWorkSchedule(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const ACTIVE   = makeBarber('b1', true);
const INACTIVE = makeBarber('b2', false);

function makeRepo(barbers: Barber[] = [ACTIVE, INACTIVE]): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockImplementation(
      async (_tenantId: string, includeInactive: boolean) =>
        includeInactive ? barbers : barbers.filter((b) => b.isActive),
    ),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

describe('ListBarbersUseCase', () => {
  it('returns only active barbers when includeInactive is false', async () => {
    const repo = makeRepo();
    const uc = new ListBarbersUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b1');
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', false);
  });

  it('returns all barbers including inactive when includeInactive is true', async () => {
    const repo = makeRepo();
    const uc = new ListBarbersUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: true });
    expect(result).toHaveLength(2);
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', true);
  });

  it('returns empty array when tenant has no barbers', async () => {
    const repo = makeRepo([]);
    const uc = new ListBarbersUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: false });
    expect(result).toEqual([]);
  });
});
