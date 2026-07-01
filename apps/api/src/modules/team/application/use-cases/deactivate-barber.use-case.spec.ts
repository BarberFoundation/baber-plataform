import { DeactivateBarberUseCase } from './deactivate-barber.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';
import { defaultWorkSchedule } from '../../domain/value-objects/work-schedule';

function makeActiveBarber() {
  return Barber.reconstitute({
    id: 'barber-1',
    tenantId: 'tenant-1',
    name: 'João Barber',
    phone: null,
    isActive: true,
    workSchedule: defaultWorkSchedule(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRepo(existing: Barber | null = makeActiveBarber()): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

describe('DeactivateBarberUseCase', () => {
  it('deactivates barber and saves', async () => {
    const repo = makeRepo();
    const uc = new DeactivateBarberUseCase(repo);
    await uc.execute({ id: 'barber-1', tenantId: 'tenant-1' });
    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Barber;
    expect(saved.isActive).toBe(false);
  });

  it('throws BarberNotFoundError when barber does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new DeactivateBarberUseCase(repo);
    await expect(
      uc.execute({ id: 'missing', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(BarberNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
