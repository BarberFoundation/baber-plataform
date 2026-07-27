import { StampCard } from '../entities/stamp-card.entity';

export const STAMP_CARD_REPOSITORY = Symbol('IStampCardRepository');

export interface IStampCardRepository {
  findByClientId(tenantId: string, clientId: string): Promise<StampCard | null>;
  save(card: StampCard): Promise<StampCard>;
  /**
   * Serializes concurrent read-modify-write cycles against the same card
   * (e.g. a stamp grant racing a credit redemption) via a DB-level lock.
   * Callers must find/mutate/save the card inside `work`.
   */
  withLock<T>(tenantId: string, clientId: string, work: () => Promise<T>): Promise<T>;
}
