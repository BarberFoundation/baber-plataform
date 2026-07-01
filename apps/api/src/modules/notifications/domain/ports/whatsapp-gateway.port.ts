export const WHATSAPP_GATEWAY = Symbol('IWhatsAppGateway');

export interface IWhatsAppGateway {
  send(to: string, message: string): Promise<void>;
}
