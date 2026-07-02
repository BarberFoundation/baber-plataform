import { Injectable, Inject } from '@nestjs/common';
import { randomInt, createHash, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS } from '@shared/database/database.tokens';
import {
  OTP_CODE_REPOSITORY,
  IOtpCodeRepository,
} from '../../domain/repositories/otp-code.repository';
import {
  WHATSAPP_GATEWAY,
  IWhatsAppGateway,
} from '../../../notifications/domain/ports/whatsapp-gateway.port';
import { OtpRateLimitedError } from '../../domain/errors/identity.errors';

export interface RequestOtpInput {
  phone: string;
  tenantId: string;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_SECONDS = 60;
const HOURLY_LIMIT = 5;
const HOURLY_WINDOW_SECONDS = 60 * 60;

@Injectable()
export class RequestOtpUseCase {
  constructor(
    @Inject(OTP_CODE_REPOSITORY)
    private readonly otpRepo: IOtpCodeRepository,
    @Inject(WHATSAPP_GATEWAY)
    private readonly whatsapp: IWhatsAppGateway,
    @Inject(REDIS)
    private readonly redis: Redis,
  ) {}

  async execute(input: RequestOtpInput): Promise<void> {
    await this.checkRateLimit(input.tenantId, input.phone);

    const code = randomInt(100000, 1000000).toString();
    const codeHash = createHash('sha256').update(code).digest('hex');

    await this.otpRepo.save({
      id: randomUUID(),
      tenantId: input.tenantId,
      phone: input.phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      usedAt: null,
      createdAt: new Date(),
    });

    await this.whatsapp.send(
      input.phone,
      `Seu código de verificação Baber é: ${code}. Válido por 5 minutos.`,
    );
  }

  private async checkRateLimit(tenantId: string, phone: string): Promise<void> {
    const cooldownKey = `otp:cooldown:${tenantId}:${phone}`;
    const setResult = await this.redis.set(cooldownKey, '1', 'EX', COOLDOWN_SECONDS, 'NX');
    if (setResult !== 'OK') {
      throw new OtpRateLimitedError('Aguarde antes de solicitar um novo código.');
    }

    const hourlyKey = `otp:hourly:${tenantId}:${phone}`;
    const count = await this.redis.incr(hourlyKey);
    if (count === 1) {
      await this.redis.expire(hourlyKey, HOURLY_WINDOW_SECONDS);
    }
    if (count > HOURLY_LIMIT) {
      throw new OtpRateLimitedError('Limite de tentativas por hora atingido.');
    }
  }
}
