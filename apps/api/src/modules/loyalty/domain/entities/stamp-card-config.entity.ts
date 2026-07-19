import { randomUUID } from 'crypto';
import { InvalidStampCardConfigError } from '../errors/loyalty.errors';

export interface StampCardConfigProps {
  id: string;
  tenantId: string;
  eligibleServiceIds: string[];
  stampsRequired: number;
  creditValueInCents: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertStampCardConfigProps {
  id?: string;
  createdAt?: Date;
  tenantId: string;
  eligibleServiceIds: string[];
  stampsRequired: number;
  creditValueInCents: number;
  isActive: boolean;
}

export class StampCardConfig {
  readonly id: string;
  readonly tenantId: string;
  readonly eligibleServiceIds: string[];
  readonly stampsRequired: number;
  readonly creditValueInCents: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: StampCardConfigProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.eligibleServiceIds = props.eligibleServiceIds;
    this.stampsRequired = props.stampsRequired;
    this.creditValueInCents = props.creditValueInCents;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: UpsertStampCardConfigProps): StampCardConfig {
    if (props.stampsRequired < 1) {
      throw new InvalidStampCardConfigError('stampsRequired deve ser maior ou igual a 1.');
    }
    if (props.creditValueInCents < 1) {
      throw new InvalidStampCardConfigError('creditValueInCents deve ser maior ou igual a 1.');
    }
    if (props.eligibleServiceIds.length === 0) {
      throw new InvalidStampCardConfigError('Selecione ao menos 1 serviço elegível.');
    }
    const now = new Date();
    return new StampCardConfig({
      id: props.id ?? randomUUID(),
      tenantId: props.tenantId,
      eligibleServiceIds: props.eligibleServiceIds,
      stampsRequired: props.stampsRequired,
      creditValueInCents: props.creditValueInCents,
      isActive: props.isActive,
      createdAt: props.createdAt ?? now,
      updatedAt: now,
    });
  }

  static reconstitute(props: StampCardConfigProps): StampCardConfig {
    return new StampCardConfig(props);
  }

  isServiceEligible(serviceId: string): boolean {
    return this.isActive && this.eligibleServiceIds.includes(serviceId);
  }
}
