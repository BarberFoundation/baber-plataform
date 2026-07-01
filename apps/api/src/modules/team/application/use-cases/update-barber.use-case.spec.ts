import { UpdateBarberUseCase, UpdateBarberInput } from './update-barber.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';

function makeExisting() {
  return Barber.reconstitute({
    id: 'barber-1',
    tenantId: 'tenant-1',
    name: 'João Barber',
    phone: '+5511999999999',
    isActive: true,
    workSchedule: {
      mon: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
      tue: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
      wed: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
      thu: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
      fri: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
      sat: { isWorking: true,  startTime: '09:00', endTime: '13:00' },
      sun: { isWorking: false, startTime: null,     endTime: null     },
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  });
}

function makeRepo(existing: Barber | null = makeExisting()): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

const INPUT: UpdateBarberInput = {
  id: 'barber-1',
  tenantId: 'tenant-1',
  name: 'João Silva',
  phone: null,
};

describe('UpdateBarberUseCase', () => {
  it('updates name and phone then saves', async () => {
    const repo = makeRepo();
    const uc = new UpdateBarberUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.name).toBe('João Silva');
    expect(result.phone).toBeNull();
    expect(repo.save).toHaveBeenCalled();
  });

  it('throws BarberNotFoundError when barber does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new UpdateBarberUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(BarberNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('passes tenantId to findById for isolation', async () => {
    const repo = makeRepo();
    const uc = new UpdateBarberUseCase(repo);
    await uc.execute(INPUT);
    expect(repo.findById).toHaveBeenCalledWith('barber-1', 'tenant-1');
  });
});
