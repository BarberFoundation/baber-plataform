import { GetBarberUseCase } from './get-barber.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';
import { defaultWorkSchedule } from '../../domain/value-objects/work-schedule';

const EXISTING = Barber.reconstitute({
  id: 'barber-1',
  tenantId: 'tenant-1',
  name: 'João Barber',
  phone: null,
  isActive: true,
  workSchedule: defaultWorkSchedule(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(existing: Barber | null = EXISTING): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

describe('GetBarberUseCase', () => {
  it('returns the barber when it exists', async () => {
    const repo = makeRepo();
    const uc = new GetBarberUseCase(repo);
    const result = await uc.execute({ id: 'barber-1', tenantId: 'tenant-1' });
    expect(result.id).toBe('barber-1');
    expect(result.name).toBe('João Barber');
    expect(repo.findById).toHaveBeenCalledWith('barber-1', 'tenant-1');
  });

  it('throws BarberNotFoundError when barber does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new GetBarberUseCase(repo);
    await expect(
      uc.execute({ id: 'missing', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(BarberNotFoundError);
  });
});
