import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Put, Patch } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { CreateSubscriptionTierUseCase } from '../application/use-cases/create-subscription-tier.use-case';
import { UpdateSubscriptionTierUseCase } from '../application/use-cases/update-subscription-tier.use-case';
import { DeactivateSubscriptionTierUseCase } from '../application/use-cases/deactivate-subscription-tier.use-case';
import { GetSubscriptionTiersUseCase } from '../application/use-cases/get-subscription-tiers.use-case';
import { ActivateClubSubscriptionUseCase } from '../application/use-cases/activate-club-subscription.use-case';
import { GetMyClubSubscriptionUseCase } from '../application/use-cases/get-my-club-subscription.use-case';
import { CancelClubSubscriptionUseCase } from '../application/use-cases/cancel-club-subscription.use-case';
import { GetAvailableSubscriptionTiersUseCase } from '../application/use-cases/get-available-subscription-tiers.use-case';
import { PAYMENT_GATEWAY, IPaymentGateway } from '../domain/ports/payment-gateway.port';
import { SubscriptionTier } from '../domain/entities/subscription-tier.entity';
import { ClubSubscription } from '../domain/entities/club-subscription.entity';

class TierServiceItemDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

class SubscriptionTierDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TierServiceItemDto)
  services!: TierServiceItemDto[];

  @IsInt()
  @Min(0)
  @Max(100)
  discountPercentage!: number;
}

class ActivateClubSubscriptionDto {
  @IsUUID()
  tierId!: string;

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
    id: tier.id,
    name: tier.name,
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
    private readonly createTier: CreateSubscriptionTierUseCase,
    private readonly updateTier: UpdateSubscriptionTierUseCase,
    private readonly deactivateTier: DeactivateSubscriptionTierUseCase,
    private readonly getTiers: GetSubscriptionTiersUseCase,
    private readonly activate: ActivateClubSubscriptionUseCase,
    private readonly getMySubscription: GetMyClubSubscriptionUseCase,
    private readonly cancelSubscription: CancelClubSubscriptionUseCase,
    private readonly getAvailableTiers: GetAvailableSubscriptionTiersUseCase,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
  ) {}

  @Roles('ADMIN')
  @Post('tiers')
  async create(@CurrentUser() user: JwtPayload, @Body() dto: SubscriptionTierDto) {
    const result = await this.createTier.execute({ tenantId: user.tenantId, ...dto });
    return serializeTier(result);
  }

  @Roles('ADMIN')
  @Put('tiers/:id')
  async update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: SubscriptionTierDto) {
    const result = await this.updateTier.execute({ tenantId: user.tenantId, id, ...dto });
    return serializeTier(result);
  }

  @Roles('ADMIN')
  @Patch('tiers/:id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.deactivateTier.execute({ tenantId: user.tenantId, id });
  }

  @Roles('ADMIN')
  @Get('tiers')
  async tiers(@CurrentUser() user: JwtPayload) {
    const result = await this.getTiers.execute({ tenantId: user.tenantId });
    return result.map(serializeTier);
  }

  @Roles('CLIENT')
  @Get('tiers/available')
  async availableTiers(@CurrentUser() user: JwtPayload) {
    return this.getAvailableTiers.execute({ tenantId: user.tenantId });
  }

  @Roles('CLIENT')
  @Post('activate')
  async activateSubscription(@CurrentUser() user: JwtPayload, @Body() dto: ActivateClubSubscriptionDto) {
    const result = await this.activate.execute({ tenantId: user.tenantId, clientId: user.userId, ...dto });
    return {
      ...serializeSubscription(result.subscription),
      payment: result.payment,
    };
  }

  @Roles('CLIENT')
  @Get('payments/:paymentId/status')
  async paymentStatus(@Param('paymentId') paymentId: string) {
    return this.paymentGateway.getPaymentStatus(paymentId);
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
