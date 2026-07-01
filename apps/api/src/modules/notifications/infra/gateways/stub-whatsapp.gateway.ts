import { Injectable, Logger } from '@nestjs/common';
import { IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';

@Injectable()
export class StubWhatsAppGateway implements IWhatsAppGateway {
  private readonly logger = new Logger(StubWhatsAppGateway.name);

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`[STUB] WhatsApp → ${to}: ${message}`);
  }
}
