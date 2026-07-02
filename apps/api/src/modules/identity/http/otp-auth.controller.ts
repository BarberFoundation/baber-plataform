import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Public } from '@shared/auth/public.decorator';
import { RequestOtpUseCase } from '../application/use-cases/request-otp.use-case';
import { VerifyOtpUseCase } from '../application/use-cases/verify-otp.use-case';

class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
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
