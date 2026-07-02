import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Public } from '@shared/auth/public.decorator';
import { RequestOtpUseCase } from '../application/use-cases/request-otp.use-case';
import { VerifyOtpUseCase } from '../application/use-cases/verify-otp.use-case';

/**
 * Normalizes a phone number to a canonical form: strips all non-digit
 * characters except a leading '+'. This ensures the same real number
 * always maps to the same string, regardless of how it was formatted on
 * input (e.g. "+55 11 99999-9999" vs "5511999999999"), so Redis
 * rate-limit keys and DB lookups keyed by phone don't fragment across
 * equivalent representations.
 */
function normalizePhone(value: string): string {
  return value.replace(/(?!^\+)[^\d]/g, '');
}

export class RequestOtpDto {
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{10,15}$/)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

export class VerifyOtpDto {
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{10,15}$/)
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

@Controller('auth/otp')
export class OtpAuthController {
  constructor(
    private readonly requestOtpUseCase: RequestOtpUseCase,
    private readonly verifyOtpUseCase: VerifyOtpUseCase,
  ) {}

  @Public()
  @Post('request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async request(@Body() dto: RequestOtpDto) {
    await this.requestOtpUseCase.execute({ phone: dto.phone, tenantId: dto.tenantId });
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyOtpDto) {
    return this.verifyOtpUseCase.execute({ phone: dto.phone, code: dto.code, tenantId: dto.tenantId });
  }
}
