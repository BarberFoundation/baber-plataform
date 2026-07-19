import { StampCardConfig } from '../entities/stamp-card-config.entity';

export const STAMP_CARD_CONFIG_REPOSITORY = Symbol('IStampCardConfigRepository');

export interface IStampCardConfigRepository {
  findByTenantId(tenantId: string): Promise<StampCardConfig | null>;
  upsert(config: StampCardConfig): Promise<StampCardConfig>;
}
