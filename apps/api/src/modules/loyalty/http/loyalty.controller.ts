import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsString, Min } from 'class-validator';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { UpsertStampCardConfigUseCase } from '../application/use-cases/upsert-stamp-card-config.use-case';
import { GetStampCardConfigUseCase } from '../application/use-cases/get-stamp-card-config.use-case';
import { GetMyStampCardUseCase } from '../application/use-cases/get-my-stamp-card.use-case';
import { RedeemCreditUseCase } from '../application/use-cases/redeem-credit.use-case';
import { StampCardConfig } from '../domain/entities/stamp-card-config.entity';

class UpsertStampCardConfigDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  eligibleServiceIds!: string[];

  @IsInt()
  @Min(1)
  stampsRequired!: number;

  @IsInt()
  @Min(1)
  creditValueInCents!: number;

  @IsBoolean()
  isActive!: boolean;
}

class RedeemCreditDto {
  @IsInt()
  @Min(1)
  amountInCents!: number;
}

function serializeConfig(config: StampCardConfig) {
  return {
    tenantId: config.tenantId,
    eligibleServiceIds: config.eligibleServiceIds,
    stampsRequired: config.stampsRequired,
    creditValueInCents: config.creditValueInCents,
    isActive: config.isActive,
    updatedAt: config.updatedAt,
  };
}

@Controller('loyalty/stamp-card')
export class LoyaltyController {
  constructor(
    private readonly upsertConfig: UpsertStampCardConfigUseCase,
    private readonly getConfig: GetStampCardConfigUseCase,
    private readonly getMyCard: GetMyStampCardUseCase,
    private readonly redeemCredit: RedeemCreditUseCase,
  ) {}

  @Roles('ADMIN')
  @Put('config')
  async upsert(@CurrentUser() user: JwtPayload, @Body() dto: UpsertStampCardConfigDto) {
    const config = await this.upsertConfig.execute({ tenantId: user.tenantId, ...dto });
    return serializeConfig(config);
  }

  @Roles('ADMIN')
  @Get('config')
  async config(@CurrentUser() user: JwtPayload) {
    const config = await this.getConfig.execute({ tenantId: user.tenantId });
    return serializeConfig(config);
  }

  @Roles('CLIENT')
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return this.getMyCard.execute({ tenantId: user.tenantId, clientId: user.userId });
  }

  @Roles('CLIENT')
  @Post('redeem')
  @HttpCode(HttpStatus.NO_CONTENT)
  async redeem(@CurrentUser() user: JwtPayload, @Body() dto: RedeemCreditDto) {
    await this.redeemCredit.execute({ tenantId: user.tenantId, clientId: user.userId, amountInCents: dto.amountInCents });
  }
}
