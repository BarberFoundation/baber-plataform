export const OTP_CODE_REPOSITORY = Symbol('IOtpCodeRepository');

export interface OtpCodeRecord {
  id: string;
  tenantId: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IOtpCodeRepository {
  save(record: OtpCodeRecord): Promise<void>;
  findActiveByPhone(tenantId: string, phone: string): Promise<OtpCodeRecord | null>;
  incrementAttempts(id: string): Promise<void>;
  markUsed(id: string): Promise<void>;
}
