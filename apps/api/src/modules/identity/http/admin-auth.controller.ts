import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Request, Response } from 'express';
import { Public } from '@shared/auth/public.decorator';
import { ExchangeFirebaseTokenUseCase } from '../application/use-cases/exchange-firebase-token.use-case';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';

class ExchangeTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

class RefreshBodyDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

class LogoutDto {
  @IsString()
  @IsNotEmpty()
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
    @Body() dto: RefreshBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken =
      (req.cookies as Record<string, string> | undefined)?.refreshToken ?? dto.refreshToken;
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token ausente.');
    }
    const result = await this.refreshUseCase.execute({ rawRefreshToken });
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutDto) {
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
