import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  IPaymentGateway,
  CreateCustomerInput,
  CreateCustomerOutput,
  CreateOneOffChargeInput,
  CreateOneOffChargeOutput,
  CreateSubscriptionInput,
  CreateSubscriptionOutput,
  PixQrCode,
  PaymentStatusOutput,
} from '../../domain/ports/payment-gateway.port';

@Injectable()
export class StubPaymentGateway implements IPaymentGateway {
  private readonly logger = new Logger(StubPaymentGateway.name);

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerOutput> {
    this.logger.warn(`[stub] createCustomer ${input.name}`);
    return { customerId: `cus_stub_${randomUUID()}` };
  }

  async createOneOffCharge(input: CreateOneOffChargeInput): Promise<CreateOneOffChargeOutput> {
    this.logger.warn(`[stub] createOneOffCharge ${input.valueInCents} cents for ${input.customerId}`);
    return { paymentId: `pay_stub_${randomUUID()}` };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionOutput> {
    this.logger.warn(`[stub] createSubscription ${input.valueInCents} cents/mo for ${input.customerId}`);
    return { subscriptionId: `sub_stub_${randomUUID()}` };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    this.logger.warn(`[stub] cancelSubscription ${subscriptionId}`);
  }

  async getPixQrCode(paymentId: string): Promise<PixQrCode> {
    this.logger.warn(`[stub] getPixQrCode ${paymentId}`);
    return { encodedImage: '', payload: 'stub-pix-payload', expirationDate: new Date().toISOString() };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusOutput> {
    this.logger.warn(`[stub] getPaymentStatus ${paymentId}`);
    return { status: 'CONFIRMED' };
  }
}
