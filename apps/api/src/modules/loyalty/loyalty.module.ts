import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';

import { STAMP_CARD_CONFIG_REPOSITORY } from './domain/repositories/stamp-card-config.repository';
import { STAMP_CARD_REPOSITORY } from './domain/repositories/stamp-card.repository';
import { SUBSCRIPTION_TIER_REPOSITORY } from './domain/repositories/subscription-tier.repository';
import { CLUB_SUBSCRIPTION_REPOSITORY } from './domain/repositories/club-subscription.repository';
import { PAYMENT_GATEWAY } from './domain/ports/payment-gateway.port';

import { StampCardConfigDrizzleRepository } from './infra/repositories/stamp-card-config-drizzle.repository';
import { StampCardDrizzleRepository } from './infra/repositories/stamp-card-drizzle.repository';
import { SubscriptionTierDrizzleRepository } from './infra/repositories/subscription-tier-drizzle.repository';
import { ClubSubscriptionDrizzleRepository } from './infra/repositories/club-subscription-drizzle.repository';
import { AsaasPaymentGateway } from './infra/gateways/asaas-payment.gateway';
import { StubPaymentGateway } from './infra/gateways/stub-payment.gateway';

import { UpsertStampCardConfigUseCase } from './application/use-cases/upsert-stamp-card-config.use-case';
import { GetStampCardConfigUseCase } from './application/use-cases/get-stamp-card-config.use-case';
import { GetMyStampCardUseCase } from './application/use-cases/get-my-stamp-card.use-case';
import { GrantStampUseCase } from './application/use-cases/grant-stamp.use-case';
import { RedeemCreditUseCase } from './application/use-cases/redeem-credit.use-case';
import { UpsertSubscriptionTierUseCase } from './application/use-cases/upsert-subscription-tier.use-case';
import { GetSubscriptionTiersUseCase } from './application/use-cases/get-subscription-tiers.use-case';
import { ActivateClubSubscriptionUseCase } from './application/use-cases/activate-club-subscription.use-case';
import { GetMyClubSubscriptionUseCase } from './application/use-cases/get-my-club-subscription.use-case';
import { CancelClubSubscriptionUseCase } from './application/use-cases/cancel-club-subscription.use-case';
import { HandlePaymentWebhookUseCase } from './application/use-cases/handle-payment-webhook.use-case';

import { AppointmentCompletedListener } from './infra/listeners/appointment-completed.listener';
import { ClubSubscriptionAppointmentBookedListener } from './infra/listeners/club-subscription-appointment-booked.listener';
import { ClubSubscriptionAppointmentCancelledListener } from './infra/listeners/club-subscription-appointment-cancelled.listener';

import { LoyaltyController } from './http/loyalty.controller';
import { ClubSubscriptionController } from './http/club-subscription.controller';
import { AsaasWebhookController } from './http/asaas-webhook.controller';

@Module({
  imports: [DatabaseModule, ConfigModule, CatalogModule],
  controllers: [LoyaltyController, ClubSubscriptionController, AsaasWebhookController],
  providers: [
    { provide: STAMP_CARD_CONFIG_REPOSITORY, useClass: StampCardConfigDrizzleRepository },
    { provide: STAMP_CARD_REPOSITORY, useClass: StampCardDrizzleRepository },
    { provide: SUBSCRIPTION_TIER_REPOSITORY, useClass: SubscriptionTierDrizzleRepository },
    { provide: CLUB_SUBSCRIPTION_REPOSITORY, useClass: ClubSubscriptionDrizzleRepository },
    {
      provide: PAYMENT_GATEWAY,
      useFactory: (config: ConfigService) =>
        config.get('ASAAS_API_URL') && config.get('ASAAS_API_KEY')
          ? new AsaasPaymentGateway(config)
          : new StubPaymentGateway(),
      inject: [ConfigService],
    },
    UpsertStampCardConfigUseCase,
    GetStampCardConfigUseCase,
    GetMyStampCardUseCase,
    GrantStampUseCase,
    RedeemCreditUseCase,
    UpsertSubscriptionTierUseCase,
    GetSubscriptionTiersUseCase,
    ActivateClubSubscriptionUseCase,
    GetMyClubSubscriptionUseCase,
    CancelClubSubscriptionUseCase,
    HandlePaymentWebhookUseCase,
    AppointmentCompletedListener,
    ClubSubscriptionAppointmentBookedListener,
    ClubSubscriptionAppointmentCancelledListener,
  ],
})
export class LoyaltyModule {}
