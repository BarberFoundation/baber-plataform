import { randomUUID } from 'crypto';

export interface ServiceProps {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceProps {
  tenantId: string;
  name: string;
  description?: string | null;
  priceInCents: number;
  durationMinutes: number;
}

export class Service {
  readonly id: string;
  readonly tenantId: string;
  private _name: string;
  private _description: string | null;
  private _priceInCents: number;
  private _durationMinutes: number;
  private _isActive: boolean;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ServiceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this._description = props.description;
    this._priceInCents = props.priceInCents;
    this._durationMinutes = props.durationMinutes;
    this._isActive = props.isActive;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get name(): string { return this._name; }
  get description(): string | null { return this._description; }
  get priceInCents(): number { return this._priceInCents; }
  get durationMinutes(): number { return this._durationMinutes; }
  get isActive(): boolean { return this._isActive; }
  get updatedAt(): Date { return this._updatedAt; }

  static create(props: CreateServiceProps): Service {
    const now = new Date();
    return new Service({
      id: randomUUID(),
      tenantId: props.tenantId,
      name: props.name,
      description: props.description ?? null,
      priceInCents: props.priceInCents,
      durationMinutes: props.durationMinutes,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ServiceProps): Service {
    return new Service(props);
  }

  update(
    name: string,
    description: string | null,
    priceInCents: number,
    durationMinutes: number,
  ): void {
    this._name = name;
    this._description = description;
    this._priceInCents = priceInCents;
    this._durationMinutes = durationMinutes;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }
}
