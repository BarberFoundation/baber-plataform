import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '@shared/auth/public.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { hashToken } from '@shared/auth/hash-token';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { ListActiveSessionsUseCase } from '../application/use-cases/list-active-sessions.use-case';
import { RevokeSessionUseCase } from '../application/use-cases/revoke-session.use-case';
import { RevokeOtherSessionsUseCase } from '../application/use-cases/revoke-other-sessions.use-case';

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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly refreshUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly listSessionsUseCase: ListActiveSessionsUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly revokeOtherSessionsUseCase: RevokeOtherSessionsUseCase,
    private readonly config: ConfigService,
  ) {}

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

  @Get('sessions')
  async listSessions(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.listSessionsUseCase.execute({
      userId: user.userId,
      currentTokenHash: this.currentTokenHash(req),
    });
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    await this.revokeSessionUseCase.execute({
      userId: user.userId,
      sessionId: id,
      currentTokenHash: this.currentTokenHash(req),
    });
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeOtherSessions(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const hash = this.currentTokenHash(req);
    if (!hash) {
      throw new UnauthorizedException('Sessão atual não identificada.');
    }
    await this.revokeOtherSessionsUseCase.execute({ userId: user.userId, currentTokenHash: hash });
  }

  private currentTokenHash(req: Request): string | null {
    const raw = (req.cookies as Record<string, string> | undefined)?.refreshToken;
    return raw ? hashToken(raw) : null;
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
