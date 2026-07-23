export const PAYMENT_GATEWAY = Symbol('IPaymentGateway');

export type BillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';

export interface CreateCustomerInput {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
}

export interface CreateCustomerOutput {
  customerId: string;
}

export interface CreateOneOffChargeInput {
  customerId: string;
  billingType: BillingType;
  valueInCents: number;
  dueDate: string;
  description?: string;
}

export interface CreateOneOffChargeOutput {
  paymentId: string;
}

export interface CreateSubscriptionInput {
  customerId: string;
  billingType: BillingType;
  valueInCents: number;
  nextDueDate: string;
  description?: string;
}

export interface CreateSubscriptionOutput {
  subscriptionId: string;
}

export interface PixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export interface IPaymentGateway {
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerOutput>;
  createOneOffCharge(input: CreateOneOffChargeInput): Promise<CreateOneOffChargeOutput>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionOutput>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getPixQrCode(paymentId: string): Promise<PixQrCode>;
}
