// apps/api/src/modules/loyalty/domain/entities/club-subscription.entity.ts
import { randomUUID } from 'crypto';
import { SubscriptionQuotaExhaustedError } from '../errors/loyalty.errors';

export type ClubSubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface SubscriptionQuota {
  serviceId: string;
  quantityTotal: number;
  quantityConsumed: number;
}

export interface ClubSubscriptionProps {
  id: string;
  tenantId: string;
  clientId: string;
  tierId: string;
  status: ClubSubscriptionStatus;
  asaasCustomerId: string;
  asaasSubscriptionId: string;
  currentCycleStart: string;
  currentCycleEnd: string;
  quotas: SubscriptionQuota[];
  lastProcessedPaymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClubSubscriptionProps {
  tenantId: string;
  clientId: string;
  tierId: string;
  asaasCustomerId: string;
  asaasSubscriptionId: string;
  currentCycleStart: string;
  currentCycleEnd: string;
  quotas: SubscriptionQuota[];
}

export class ClubSubscription {
  readonly id: string;
  readonly tenantId: string;
  readonly clientId: string;
  private _tierId: string;
  private _status: ClubSubscriptionStatus;
  private _asaasCustomerId: string;
  private _asaasSubscriptionId: string;
  private _currentCycleStart: string;
  private _currentCycleEnd: string;
  private _quotas: SubscriptionQuota[];
  private _lastProcessedPaymentId: string | null;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ClubSubscriptionProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.clientId = props.clientId;
    this._tierId = props.tierId;
    this._status = props.status;
    this._asaasCustomerId = props.asaasCustomerId;
    this._asaasSubscriptionId = props.asaasSubscriptionId;
    this._currentCycleStart = props.currentCycleStart;
    this._currentCycleEnd = props.currentCycleEnd;
    this._quotas = props.quotas.map((q) => ({ ...q }));
    this._lastProcessedPaymentId = props.lastProcessedPaymentId;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get tierId(): string { return this._tierId; }
  get status(): ClubSubscriptionStatus { return this._status; }
  get asaasCustomerId(): string { return this._asaasCustomerId; }
  get asaasSubscriptionId(): string { return this._asaasSubscriptionId; }
  get currentCycleStart(): string { return this._currentCycleStart; }
  get currentCycleEnd(): string { return this._currentCycleEnd; }
  get quotas(): SubscriptionQuota[] { return this._quotas.map((q) => ({ ...q })); }
  get lastProcessedPaymentId(): string | null { return this._lastProcessedPaymentId; }
  get updatedAt(): Date { return this._updatedAt; }

  static createNew(props: CreateClubSubscriptionProps): ClubSubscription {
    const now = new Date();
    return new ClubSubscription({
      id: randomUUID(),
      tenantId: props.tenantId,
      clientId: props.clientId,
      tierId: props.tierId,
      status: 'ACTIVE',
      asaasCustomerId: props.asaasCustomerId,
      asaasSubscriptionId: props.asaasSubscriptionId,
      currentCycleStart: props.currentCycleStart,
      currentCycleEnd: props.currentCycleEnd,
      quotas: props.quotas.map((q) => ({ ...q, quantityConsumed: 0 })),
      lastProcessedPaymentId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ClubSubscriptionProps): ClubSubscription {
    return new ClubSubscription(props);
  }

  /** No-op for services outside the plan's combo — booking a non-plan service just isn't discounted, it's not a domain error. */
  consumeQuota(serviceId: string): void {
    const quota = this._quotas.find((q) => q.serviceId === serviceId);
    if (!quota) return;
    if (quota.quantityConsumed >= quota.quantityTotal) {
      throw new SubscriptionQuotaExhaustedError();
    }
    quota.quantityConsumed += 1;
    this._updatedAt = new Date();
  }

  refundQuota(serviceId: string): void {
    const quota = this._quotas.find((q) => q.serviceId === serviceId);
    if (!quota) return;
    quota.quantityConsumed = Math.max(0, quota.quantityConsumed - 1);
    this._updatedAt = new Date();
  }

  markPastDue(): void {
    this._status = 'PAST_DUE';
    this._updatedAt = new Date();
  }

  cancel(): void {
    this._status = 'CANCELED';
    this._updatedAt = new Date();
  }

  /** True if this exact Asaas payment was already applied — signals the webhook is a redelivery/replay, not a new event. */
  hasProcessedPayment(paymentId: string): boolean {
    return this._lastProcessedPaymentId !== null && this._lastProcessedPaymentId === paymentId;
  }

  recordProcessedPayment(paymentId: string): void {
    this._lastProcessedPaymentId = paymentId;
    this._updatedAt = new Date();
  }

  renew(cycleStart: string, cycleEnd: string, tierQuotas: { serviceId: string; quantityTotal: number }[]): void {
    this._status = 'ACTIVE';
    this._currentCycleStart = cycleStart;
    this._currentCycleEnd = cycleEnd;
    this._quotas = tierQuotas.map((q) => ({ ...q, quantityConsumed: 0 }));
    this._updatedAt = new Date();
  }

  reactivate(tierId: string, asaasCustomerId: string, asaasSubscriptionId: string, cycleStart: string, cycleEnd: string, tierQuotas: { serviceId: string; quantityTotal: number }[]): void {
    this._tierId = tierId;
    this._status = 'ACTIVE';
    this._asaasCustomerId = asaasCustomerId;
    this._asaasSubscriptionId = asaasSubscriptionId;
    this._currentCycleStart = cycleStart;
    this._currentCycleEnd = cycleEnd;
    this._quotas = tierQuotas.map((q) => ({ ...q, quantityConsumed: 0 }));
    // New Asaas subscription id starting a fresh billing relationship — old
    // dedupe marker no longer applies.
    this._lastProcessedPaymentId = null;
    this._updatedAt = new Date();
  }
}
