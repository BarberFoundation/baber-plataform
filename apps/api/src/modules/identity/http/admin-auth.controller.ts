import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '@shared/auth/public.decorator';
import { ExchangeFirebaseTokenUseCase } from '../application/use-cases/exchange-firebase-token.use-case';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';

class ExchangeTokenDto {
  idToken!: string;
  tenantId!: string;
}

class RefreshDto {
  refreshToken!: string;
}

@Controller('auth/admin')
export class AdminAuthController {
  constructor(
    private readonly exchangeUseCase: ExchangeFirebaseTokenUseCase,
    private readonly refreshUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
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

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.refreshUseCase.execute({
      rawRefreshToken: dto.refreshToken,
    });
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: RefreshDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    await this.logoutUseCase.execute({ rawRefreshToken: dto.refreshToken });
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }
}
