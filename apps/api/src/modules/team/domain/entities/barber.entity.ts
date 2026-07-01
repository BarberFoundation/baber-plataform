import { randomUUID } from 'crypto';
import { WorkSchedule, defaultWorkSchedule } from '../value-objects/work-schedule';

export interface BarberProps {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  workSchedule: WorkSchedule;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBarberProps {
  tenantId: string;
  name: string;
  phone?: string | null;
  workSchedule?: WorkSchedule;
}

export class Barber {
  readonly id: string;
  readonly tenantId: string;
  private _name: string;
  private _phone: string | null;
  private _isActive: boolean;
  private _workSchedule: WorkSchedule;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: BarberProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this._phone = props.phone;
    this._isActive = props.isActive;
    this._workSchedule = props.workSchedule;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get name(): string { return this._name; }
  get phone(): string | null { return this._phone; }
  get isActive(): boolean { return this._isActive; }
  get workSchedule(): WorkSchedule {
    const s = this._workSchedule;
    return {
      mon: { ...s.mon }, tue: { ...s.tue }, wed: { ...s.wed },
      thu: { ...s.thu }, fri: { ...s.fri }, sat: { ...s.sat }, sun: { ...s.sun },
    };
  }
  get updatedAt(): Date { return this._updatedAt; }

  static create(props: CreateBarberProps): Barber {
    const now = new Date();
    return new Barber({
      id: randomUUID(),
      tenantId: props.tenantId,
      name: props.name,
      phone: props.phone ?? null,
      isActive: true,
      workSchedule: props.workSchedule ?? defaultWorkSchedule(),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: BarberProps): Barber {
    return new Barber(props);
  }

  update(name: string, phone: string | null): void {
    this._name = name;
    this._phone = phone;
    this._updatedAt = new Date();
  }

  setWorkSchedule(schedule: WorkSchedule): void {
    this._workSchedule = schedule;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }
}
