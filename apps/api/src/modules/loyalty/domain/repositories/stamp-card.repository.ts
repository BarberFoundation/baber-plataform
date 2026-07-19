import { StampCard } from '../entities/stamp-card.entity';

export const STAMP_CARD_REPOSITORY = Symbol('IStampCardRepository');

export interface IStampCardRepository {
  findByClientId(tenantId: string, clientId: string): Promise<StampCard | null>;
  save(card: StampCard): Promise<StampCard>;
}
