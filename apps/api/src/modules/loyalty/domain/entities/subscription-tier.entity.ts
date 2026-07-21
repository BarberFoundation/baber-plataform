// apps/api/src/modules/loyalty/domain/entities/subscription-tier.entity.ts
import { randomUUID } from 'crypto';
import { InvalidSubscriptionTierError } from '../errors/loyalty.errors';

export type SubscriptionTierName = 'ESSENCIAL' | 'JOGADOR' | 'LENDARIO';

export interface SubscriptionTierServiceItem {
  serviceId: string;
  quantity: number;
}

export interface SubscriptionTierProps {
  id: string;
  tenantId: string;
  tier: SubscriptionTierName;
  services: SubscriptionTierServiceItem[];
  discountPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertSubscriptionTierProps {
  id?: string;
  createdAt?: Date;
  tenantId: string;
  tier: SubscriptionTierName;
  services: SubscriptionTierServiceItem[];
  discountPercentage: number;
  isActive: boolean;
}

export class SubscriptionTier {
  readonly id: string;
  readonly tenantId: string;
  readonly tier: SubscriptionTierName;
  private readonly _services: SubscriptionTierServiceItem[];
  readonly discountPercentage: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: SubscriptionTierProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.tier = props.tier;
    this._services = props.services.map((s) => ({ ...s }));
    this.discountPercentage = props.discountPercentage;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get services(): SubscriptionTierServiceItem[] {
    return this._services.map((s) => ({ ...s }));
  }

  static create(props: UpsertSubscriptionTierProps): SubscriptionTier {
    if (props.services.length === 0) {
      throw new InvalidSubscriptionTierError('Selecione ao menos 1 serviço no combo.');
    }
    if (props.services.some((s) => s.quantity < 1)) {
      throw new InvalidSubscriptionTierError('Quantidade de cada serviço deve ser maior ou igual a 1.');
    }
    if (props.discountPercentage < 0 || props.discountPercentage > 100) {
      throw new InvalidSubscriptionTierError('discountPercentage deve estar entre 0 e 100.');
    }
    const now = new Date();
    return new SubscriptionTier({
      id: props.id ?? randomUUID(),
      tenantId: props.tenantId,
      tier: props.tier,
      services: props.services,
      discountPercentage: props.discountPercentage,
      isActive: props.isActive,
      createdAt: props.createdAt ?? now,
      updatedAt: now,
    });
  }

  static reconstitute(props: SubscriptionTierProps): SubscriptionTier {
    return new SubscriptionTier(props);
  }

  calculatePriceInCents(serviceCatalog: Map<string, number>): number {
    const base = this._services.reduce((sum, item) => {
      const unitPriceInCents = serviceCatalog.get(item.serviceId);
      if (unitPriceInCents === undefined) {
        throw new InvalidSubscriptionTierError(`Serviço ${item.serviceId} não encontrado no catálogo.`);
      }
      return sum + unitPriceInCents * item.quantity;
    }, 0);
    return base - Math.round((base * this.discountPercentage) / 100);
  }
}
