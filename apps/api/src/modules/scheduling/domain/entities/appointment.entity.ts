import { randomUUID } from 'crypto';
import { AppointmentStatus } from '../value-objects/appointment-status';

export interface AppointmentProps {
  id: string;
  tenantId: string;
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm (computed: startTime + durationMinutes)
  durationMinutes: number; // cached from service at booking time
  status: AppointmentStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentProps {
  tenantId: string;
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes?: string | null;
}

export class Appointment {
  readonly id: string;
  readonly tenantId: string;
  readonly barberId: string;
  readonly serviceId: string;
  private _clientName: string;
  private _clientPhone: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMinutes: number;
  private _status: AppointmentStatus;
  private _notes: string | null;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: AppointmentProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.barberId = props.barberId;
    this.serviceId = props.serviceId;
    this._clientName = props.clientName;
    this._clientPhone = props.clientPhone;
    this.date = props.date;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.durationMinutes = props.durationMinutes;
    this._status = props.status;
    this._notes = props.notes;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get clientName(): string { return this._clientName; }
  get clientPhone(): string { return this._clientPhone; }
  get status(): AppointmentStatus { return this._status; }
  get notes(): string | null { return this._notes; }
  get updatedAt(): Date { return this._updatedAt; }

  static create(props: CreateAppointmentProps): Appointment {
    const now = new Date();
    return new Appointment({
      id: randomUUID(),
      tenantId: props.tenantId,
      barberId: props.barberId,
      serviceId: props.serviceId,
      clientName: props.clientName,
      clientPhone: props.clientPhone,
      date: props.date,
      startTime: props.startTime,
      endTime: props.endTime,
      durationMinutes: props.durationMinutes,
      status: 'PENDING',
      notes: props.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: AppointmentProps): Appointment {
    return new Appointment(props);
  }

  confirm(): void {
    if (this._status !== 'PENDING') {
      throw new Error(`Cannot confirm appointment with status ${this._status}`);
    }
    this._status = 'CONFIRMED';
    this._updatedAt = new Date();
  }

  cancel(): void {
    if (this._status === 'COMPLETED' || this._status === 'CANCELLED') {
      throw new Error(`Cannot cancel appointment with status ${this._status}`);
    }
    this._status = 'CANCELLED';
    this._updatedAt = new Date();
  }

  complete(): void {
    if (this._status !== 'CONFIRMED') {
      throw new Error(`Cannot complete appointment with status ${this._status}`);
    }
    this._status = 'COMPLETED';
    this._updatedAt = new Date();
  }
}
