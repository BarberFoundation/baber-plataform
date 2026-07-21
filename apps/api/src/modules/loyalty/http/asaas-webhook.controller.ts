import { Body, Controller, HttpCode, HttpStatus, Post, UnauthorizedException, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@shared/auth/public.decorator';
import { HandlePaymentWebhookUseCase } from '../application/use-cases/handle-payment-webhook.use-case';

interface AsaasWebhookBody {
  event: string;
  payment?: { subscription?: string | null };
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
    if (!expectedToken || accessToken !== expectedToken) {
      throw new UnauthorizedException('Invalid webhook token');
    }
    await this.handleWebhook.execute({
      event: body.event,
      subscriptionId: body.payment?.subscription ?? null,
    });
  }
}
