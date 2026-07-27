import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString } from 'class-validator';
import { Public } from '@shared/auth/public.decorator';
import { ExchangeFirebaseClientTokenUseCase } from '../application/use-cases/exchange-firebase-client-token.use-case';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { ExchangeTokenDto } from './exchange-token.dto';

export class ClientRefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

@Controller('auth/client')
export class ClientAuthController {
  constructor(
    private readonly exchangeUseCase: ExchangeFirebaseClientTokenUseCase,
    private readonly refreshUseCase: RefreshTokenUseCase,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() dto: ExchangeTokenDto) {
    return this.exchangeUseCase.execute({ idToken: dto.idToken, tenantId: dto.tenantId });
  }

  // Mobile has no cookie jar, so — unlike POST /auth/refresh (web, httpOnly cookie only) —
  // this returns the rotated refresh token in the body instead of setting a cookie.
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: ClientRefreshDto) {
    const result = await this.refreshUseCase.execute({ rawRefreshToken: dto.refreshToken });
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }
}
