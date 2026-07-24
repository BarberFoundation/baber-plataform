import { Body, Controller, HttpCode, HttpStatus, Post, UnauthorizedException, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Public } from '@shared/auth/public.decorator';
import { HandlePaymentWebhookUseCase } from '../application/use-cases/handle-payment-webhook.use-case';

interface AsaasWebhookBody {
  event: string;
  payment?: { id?: string; subscription?: string | null };
}

// Plain `!==` short-circuits on the first differing byte, letting an attacker
// recover ASAAS_WEBHOOK_TOKEN one character at a time from response timing.
// timingSafeEqual needs equal-length buffers, so a length mismatch is checked
// (and rejected) before comparing — that check alone doesn't leak per-character
// timing since it's a single length comparison, not a byte-by-byte one.
function tokensMatch(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const receivedBuf = Buffer.from(received);
  const expectedBuf = Buffer.from(expected);
  if (receivedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(receivedBuf, expectedBuf);
}

@Controller('loyalty/club-subscription/webhooks')
export class AsaasWebhookController {
  constructor(
    private readonly handleWebhook: HandlePaymentWebhookUseCase,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Headers('asaas-access-token') accessToken: string | undefined,
    @Body() body: AsaasWebhookBody,
  ): Promise<void> {
    const expectedToken = this.config.get<string>('ASAAS_WEBHOOK_TOKEN');
    if (!expectedToken || !tokensMatch(accessToken, expectedToken)) {
      throw new UnauthorizedException('Invalid webhook token');
    }
    await this.handleWebhook.execute({
      event: body.event,
      subscriptionId: body.payment?.subscription ?? null,
      paymentId: body.payment?.id ?? null,
    });
  }
}
