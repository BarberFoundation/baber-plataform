import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { UpsertSubscriptionTierUseCase } from '../application/use-cases/upsert-subscription-tier.use-case';
import { GetSubscriptionTiersUseCase } from '../application/use-cases/get-subscription-tiers.use-case';
import { ActivateClubSubscriptionUseCase } from '../application/use-cases/activate-club-subscription.use-case';
import { GetMyClubSubscriptionUseCase } from '../application/use-cases/get-my-club-subscription.use-case';
import { CancelClubSubscriptionUseCase } from '../application/use-cases/cancel-club-subscription.use-case';
import { SubscriptionTier, SubscriptionTierName } from '../domain/entities/subscription-tier.entity';
import { ClubSubscription } from '../domain/entities/club-subscription.entity';

class TierServiceItemDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

class UpsertSubscriptionTierDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TierServiceItemDto)
  services!: TierServiceItemDto[];

  @IsInt()
  @Min(0)
  discountPercentage!: number;

  @IsBoolean()
  isActive!: boolean;
}

class ActivateClubSubscriptionDto {
  @IsIn(['ESSENCIAL', 'JOGADOR', 'LENDARIO'])
  tier!: SubscriptionTierName;

  @IsString()
  @IsNotEmpty()
  cpfCnpj!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

function serializeTier(tier: SubscriptionTier) {
  return {
    tier: tier.tier,
    services: tier.services,
    discountPercentage: tier.discountPercentage,
    isActive: tier.isActive,
    updatedAt: tier.updatedAt,
  };
}

function serializeSubscription(sub: ClubSubscription) {
  return {
    status: sub.status,
    tierId: sub.tierId,
    currentCycleStart: sub.currentCycleStart,
    currentCycleEnd: sub.currentCycleEnd,
    quotas: sub.quotas,
    updatedAt: sub.updatedAt,
  };
}

@Controller('loyalty/club-subscription')
export class ClubSubscriptionController {
  constructor(
    private readonly upsertTier: UpsertSubscriptionTierUseCase,
    private readonly getTiers: GetSubscriptionTiersUseCase,
    private readonly activate: ActivateClubSubscriptionUseCase,
    private readonly getMySubscription: GetMyClubSubscriptionUseCase,
    private readonly cancelSubscription: CancelClubSubscriptionUseCase,
  ) {}

  @Roles('ADMIN')
  @Put('tiers/:tier')
  async upsert(
    @CurrentUser() user: JwtPayload,
    @Param('tier') tier: SubscriptionTierName,
    @Body() dto: UpsertSubscriptionTierDto,
  ) {
    const result = await this.upsertTier.execute({ tenantId: user.tenantId, tier, ...dto });
    return serializeTier(result);
  }

  @Roles('ADMIN')
  @Get('tiers')
  async tiers(@CurrentUser() user: JwtPayload) {
    const result = await this.getTiers.execute({ tenantId: user.tenantId });
    return result.map(serializeTier);
  }

  @Roles('CLIENT')
  @Post('activate')
  async activateSubscription(@CurrentUser() user: JwtPayload, @Body() dto: ActivateClubSubscriptionDto) {
    const result = await this.activate.execute({ tenantId: user.tenantId, clientId: user.userId, ...dto });
    return serializeSubscription(result);
  }

  @Roles('CLIENT')
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const result = await this.getMySubscription.execute({ tenantId: user.tenantId, clientId: user.userId });
    return serializeSubscription(result);
  }

  @Roles('CLIENT')
  @Post('cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@CurrentUser() user: JwtPayload) {
    await this.cancelSubscription.execute({ tenantId: user.tenantId, clientId: user.userId });
  }
}
