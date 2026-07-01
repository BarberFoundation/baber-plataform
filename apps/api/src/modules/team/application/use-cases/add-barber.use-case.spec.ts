import { AddBarberUseCase, AddBarberInput } from './add-barber.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';

function makeRepo(overrides?: Partial<ITeamRepository>): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
    ...overrides,
  };
}

const INPUT: AddBarberInput = {
  tenantId: 'tenant-1',
  name: 'João Barber',
  phone: '+5511999999999',
};

describe('AddBarberUseCase', () => {
  it('creates and saves a new active barber', async () => {
    const repo = makeRepo();
    const uc = new AddBarberUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.name).toBe('João Barber');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.phone).toBe('+5511999999999');
    expect(result.isActive).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(expect.any(Barber));
  });

  it('defaults phone to null when omitted', async () => {
    const repo = makeRepo();
    const uc = new AddBarberUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', name: 'Ana' });
    expect(result.phone).toBeNull();
  });

  it('assigns default work schedule when none provided', async () => {
    const repo = makeRepo();
    const uc = new AddBarberUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.workSchedule.mon.isWorking).toBe(true);
    expect(result.workSchedule.sun.isWorking).toBe(false);
  });
});
