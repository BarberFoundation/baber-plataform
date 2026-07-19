import { Inject, Injectable } from '@nestjs/common';
import {
  STAMP_CARD_CONFIG_REPOSITORY,
  IStampCardConfigRepository,
} from '../../domain/repositories/stamp-card-config.repository';
import { StampCardConfig } from '../../domain/entities/stamp-card-config.entity';

export interface UpsertStampCardConfigInput {
  tenantId: string;
  eligibleServiceIds: string[];
  stampsRequired: number;
  creditValueInCents: number;
  isActive: boolean;
}

@Injectable()
export class UpsertStampCardConfigUseCase {
  constructor(
    @Inject(STAMP_CARD_CONFIG_REPOSITORY)
    private readonly repo: IStampCardConfigRepository,
  ) {}

  async execute(input: UpsertStampCardConfigInput): Promise<StampCardConfig> {
    const existing = await this.repo.findByTenantId(input.tenantId);
    const config = StampCardConfig.create({
      id: existing?.id,
      createdAt: existing?.createdAt,
      tenantId: input.tenantId,
      eligibleServiceIds: input.eligibleServiceIds,
      stampsRequired: input.stampsRequired,
      creditValueInCents: input.creditValueInCents,
      isActive: input.isActive,
    });
    return this.repo.upsert(config);
  }
}
