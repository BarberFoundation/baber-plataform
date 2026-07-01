import { SetWorkScheduleUseCase, SetWorkScheduleInput } from './set-work-schedule.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';
import { defaultWorkSchedule, WorkSchedule } from '../../domain/value-objects/work-schedule';

function makeExisting() {
  return Barber.reconstitute({
    id: 'barber-1',
    tenantId: 'tenant-1',
    name: 'João Barber',
    phone: null,
    isActive: true,
    workSchedule: defaultWorkSchedule(),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  });
}

const NEW_SCHEDULE: WorkSchedule = {
  mon: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  tue: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  wed: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  thu: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  fri: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  sat: { isWorking: false, startTime: null,     endTime: null     },
  sun: { isWorking: false, startTime: null,     endTime: null     },
};

function makeRepo(existing: Barber | null = makeExisting()): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

const INPUT: SetWorkScheduleInput = {
  id: 'barber-1',
  tenantId: 'tenant-1',
  workSchedule: NEW_SCHEDULE,
};

describe('SetWorkScheduleUseCase', () => {
  it('replaces work schedule and saves', async () => {
    const repo = makeRepo();
    const uc = new SetWorkScheduleUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.workSchedule.sat.isWorking).toBe(false);
    expect(result.workSchedule.mon.startTime).toBe('08:00');
    expect(repo.save).toHaveBeenCalled();
  });

  it('throws BarberNotFoundError when barber does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new SetWorkScheduleUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(BarberNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('passes tenantId to findById for isolation', async () => {
    const repo = makeRepo();
    const uc = new SetWorkScheduleUseCase(repo);
    await uc.execute(INPUT);
    expect(repo.findById).toHaveBeenCalledWith('barber-1', 'tenant-1');
  });
});
