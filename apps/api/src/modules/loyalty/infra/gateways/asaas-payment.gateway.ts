import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
export class AsaasPaymentGateway implements IPaymentGateway {
  private readonly logger = new Logger(AsaasPaymentGateway.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.getOrThrow<string>('ASAAS_API_URL');
    this.apiKey = this.config.getOrThrow<string>('ASAAS_API_KEY');
  }

  private async request<T>(path: string, options: { method: string; body?: unknown }): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method,
      headers: { 'Content-Type': 'application/json', access_token: this.apiKey },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Asaas ${options.method} ${path} failed: ${response.status} ${text}`);
      throw new Error(`Asaas request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerOutput> {
    const result = await this.request<{ id: string }>('/customers', {
      method: 'POST',
      body: { name: input.name, cpfCnpj: input.cpfCnpj, email: input.email, mobilePhone: input.phone },
    });
    return { customerId: result.id };
  }

  async createOneOffCharge(input: CreateOneOffChargeInput): Promise<CreateOneOffChargeOutput> {
    const result = await this.request<{ id: string }>('/payments', {
      method: 'POST',
      body: {
        customer: input.customerId,
        billingType: input.billingType,
        value: input.valueInCents / 100,
        dueDate: input.dueDate,
        description: input.description,
      },
    });
    return { paymentId: result.id };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionOutput> {
    const result = await this.request<{ id: string }>('/subscriptions', {
      method: 'POST',
      body: {
        customer: input.customerId,
        billingType: input.billingType,
        value: input.valueInCents / 100,
        nextDueDate: input.nextDueDate,
        cycle: 'MONTHLY',
        description: input.description,
      },
    });
    return { subscriptionId: result.id };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  }

  async getPixQrCode(paymentId: string): Promise<PixQrCode> {
    return this.request<PixQrCode>(`/payments/${paymentId}/pixQrCode`, { method: 'GET' });
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusOutput> {
    const result = await this.request<{ status: string }>(`/payments/${paymentId}`, { method: 'GET' });
    return { status: result.status };
  }
}
