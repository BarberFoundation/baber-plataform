import { randomUUID } from 'crypto';
import { InsufficientCreditError, InvalidRedemptionAmountError } from '../errors/loyalty.errors';

export interface StampCardProps {
  id: string;
  tenantId: string;
  clientId: string;
  currentStamps: number;
  creditBalanceInCents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddStampResult {
  completed: boolean;
  creditEarnedInCents: number;
}

export class StampCard {
  readonly id: string;
  readonly tenantId: string;
  readonly clientId: string;
  private _currentStamps: number;
  private _creditBalanceInCents: number;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: StampCardProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.clientId = props.clientId;
    this._currentStamps = props.currentStamps;
    this._creditBalanceInCents = props.creditBalanceInCents;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get currentStamps(): number { return this._currentStamps; }
  get creditBalanceInCents(): number { return this._creditBalanceInCents; }
  get updatedAt(): Date { return this._updatedAt; }

  static createNew(tenantId: string, clientId: string): StampCard {
    const now = new Date();
    return new StampCard({
      id: randomUUID(),
      tenantId,
      clientId,
      currentStamps: 0,
      creditBalanceInCents: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: StampCardProps): StampCard {
    return new StampCard(props);
  }

  addStamp(stampsRequired: number, creditValueInCents: number): AddStampResult {
    this._currentStamps += 1;
    this._updatedAt = new Date();
    if (this._currentStamps >= stampsRequired) {
      this._currentStamps = 0;
      this._creditBalanceInCents += creditValueInCents;
      return { completed: true, creditEarnedInCents: creditValueInCents };
    }
    return { completed: false, creditEarnedInCents: 0 };
  }

  redeemCredit(amountInCents: number): void {
    if (amountInCents <= 0) throw new InvalidRedemptionAmountError();
    if (amountInCents > this._creditBalanceInCents) throw new InsufficientCreditError();
    this._creditBalanceInCents -= amountInCents;
    this._updatedAt = new Date();
  }
}
