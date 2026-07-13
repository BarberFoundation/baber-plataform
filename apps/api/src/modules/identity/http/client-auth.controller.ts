import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@shared/auth/public.decorator';
import { ExchangeFirebaseClientTokenUseCase } from '../application/use-cases/exchange-firebase-client-token.use-case';
import { ExchangeTokenDto } from './exchange-token.dto';

@Controller('auth/client')
export class ClientAuthController {
  constructor(private readonly exchangeUseCase: ExchangeFirebaseClientTokenUseCase) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() dto: ExchangeTokenDto) {
    return this.exchangeUseCase.execute({ idToken: dto.idToken, tenantId: dto.tenantId });
  }
}
