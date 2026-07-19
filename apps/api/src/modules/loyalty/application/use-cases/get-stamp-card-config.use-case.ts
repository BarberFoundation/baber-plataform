import { Inject, Injectable } from '@nestjs/common';
import {
  STAMP_CARD_CONFIG_REPOSITORY,
  IStampCardConfigRepository,
} from '../../domain/repositories/stamp-card-config.repository';
import { StampCardConfig } from '../../domain/entities/stamp-card-config.entity';
import { StampCardConfigNotFoundError } from '../../domain/errors/loyalty.errors';

export interface GetStampCardConfigInput {
  tenantId: string;
}

@Injectable()
export class GetStampCardConfigUseCase {
  constructor(
    @Inject(STAMP_CARD_CONFIG_REPOSITORY)
    private readonly repo: IStampCardConfigRepository,
  ) {}

  async execute(input: GetStampCardConfigInput): Promise<StampCardConfig> {
    const config = await this.repo.findByTenantId(input.tenantId);
    if (!config) {
      throw new StampCardConfigNotFoundError();
    }
    return config;
  }
}
