import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  OTP_CODE_REPOSITORY,
  IOtpCodeRepository,
} from '../../domain/repositories/otp-code.repository';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { InvalidOtpError } from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';
import { TokenPairIssuer } from '../services/token-pair-issuer';

export interface VerifyOtpInput {
  phone: string;
  code: string;
  tenantId: string;
}

const MAX_ATTEMPTS = 3;

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    @Inject(OTP_CODE_REPOSITORY)
    private readonly otpRepo: IOtpCodeRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly tokenPairIssuer: TokenPairIssuer,
  ) {}

  async execute(input: VerifyOtpInput): Promise<AuthResult> {
    const record = await this.otpRepo.findActiveByPhone(input.tenantId, input.phone);
    if (!record || record.attempts >= MAX_ATTEMPTS) {
      throw new InvalidOtpError();
    }

    const codeHash = createHash('sha256').update(input.code).digest('hex');
    if (codeHash !== record.codeHash) {
      await this.otpRepo.incrementAttempts(record.id);
      throw new InvalidOtpError();
    }

    await this.otpRepo.markUsed(record.id);

    let user = await this.userRepo.findByPhone(input.phone, input.tenantId);
    if (!user) {
      const newUser = User.createClient({ tenantId: input.tenantId, phone: input.phone });
      user = await this.userRepo.save(newUser);
    }

    return this.tokenPairIssuer.issue(user);
  }
}
