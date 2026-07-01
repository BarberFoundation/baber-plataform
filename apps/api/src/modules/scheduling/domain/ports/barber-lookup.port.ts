import { WorkSchedule } from '../../../team/domain/value-objects/work-schedule';

export const BARBER_LOOKUP = Symbol('IBarberLookup');

export interface BarberLookupResult {
  isActive: boolean;
  workSchedule: WorkSchedule;
}

export interface IBarberLookup {
  findById(id: string, tenantId: string): Promise<BarberLookupResult | null>;
}
