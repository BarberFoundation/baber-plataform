import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '@shared/auth/public.decorator';
import { ExchangeFirebaseTokenUseCase } from '../application/use-cases/exchange-firebase-token.use-case';

class ExchangeTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

@Controller('auth/admin')
export class AdminAuthController {
  constructor(
    private readonly exchangeUseCase: ExchangeFirebaseTokenUseCase,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(
    @Body() dto: ExchangeTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.exchangeUseCase.execute({
      idToken: dto.idToken,
      tenantId: dto.tenantId,
    });
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }
}
