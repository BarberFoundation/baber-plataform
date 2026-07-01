import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';

@Injectable()
export class EvolutionApiWhatsAppGateway implements IWhatsAppGateway {
  private readonly logger = new Logger(EvolutionApiWhatsAppGateway.name);
  private readonly baseUrl:  string;
  private readonly instance: string;
  private readonly apiKey:   string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl  = config.getOrThrow<string>('EVOLUTION_API_URL');
    this.instance = config.getOrThrow<string>('EVOLUTION_INSTANCE');
    this.apiKey   = config.getOrThrow<string>('EVOLUTION_API_KEY');
  }

  async send(to: string, message: string): Promise<void> {
    const url = `${this.baseUrl}/message/sendText/${this.instance}`;
    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        this.apiKey,
      },
      body: JSON.stringify({ number: to, text: message }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Evolution API error ${response.status}: ${body}`);
      throw new Error(`WhatsApp send failed: ${response.status}`);
    }

    this.logger.log(`WhatsApp sent to ${to}`);
  }
}
