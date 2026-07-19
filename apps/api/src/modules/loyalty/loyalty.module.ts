import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/database/database.module';

import { STAMP_CARD_CONFIG_REPOSITORY } from './domain/repositories/stamp-card-config.repository';
import { STAMP_CARD_REPOSITORY } from './domain/repositories/stamp-card.repository';

import { StampCardConfigDrizzleRepository } from './infra/repositories/stamp-card-config-drizzle.repository';
import { StampCardDrizzleRepository } from './infra/repositories/stamp-card-drizzle.repository';
import { AppointmentCompletedListener } from './infra/listeners/appointment-completed.listener';

import { UpsertStampCardConfigUseCase } from './application/use-cases/upsert-stamp-card-config.use-case';
import { GetStampCardConfigUseCase } from './application/use-cases/get-stamp-card-config.use-case';
import { GetMyStampCardUseCase } from './application/use-cases/get-my-stamp-card.use-case';
import { GrantStampUseCase } from './application/use-cases/grant-stamp.use-case';
import { RedeemCreditUseCase } from './application/use-cases/redeem-credit.use-case';

import { LoyaltyController } from './http/loyalty.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [LoyaltyController],
  providers: [
    { provide: STAMP_CARD_CONFIG_REPOSITORY, useClass: StampCardConfigDrizzleRepository },
    { provide: STAMP_CARD_REPOSITORY,        useClass: StampCardDrizzleRepository },
    UpsertStampCardConfigUseCase,
    GetStampCardConfigUseCase,
    GetMyStampCardUseCase,
    GrantStampUseCase,
    RedeemCreditUseCase,
    AppointmentCompletedListener,
  ],
})
export class LoyaltyModule {}
