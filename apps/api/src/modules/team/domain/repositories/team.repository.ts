import { Barber } from '../entities/barber.entity';

export const TEAM_REPOSITORY = Symbol('ITeamRepository');

export interface ITeamRepository {
  findById(id: string, tenantId: string): Promise<Barber | null>;
  findAll(tenantId: string, includeInactive: boolean): Promise<Barber[]>;
  save(barber: Barber): Promise<Barber>;
}
