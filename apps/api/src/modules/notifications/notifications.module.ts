import { Module } from '@nestjs/common';

/**
 * Notifications — envio WhatsApp (confirmação, lembrete, cancelamento).
 * Consome eventos in-process; lembrete via BullMQ delayed job.
 * Adapter WhatsAppGateway trocável (impl Evolution API).
 */
@Module({})
export class NotificationsModule {}
