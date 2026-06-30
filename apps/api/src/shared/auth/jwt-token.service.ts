import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { Role } from './roles.decorator';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: Role;
}

@Injectable()
export class JwtTokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(
    accessSecret: string,
    refreshSecret: string,
    accessTtl: string,
    refreshTtl: string,
  );
  constructor(config: ConfigService);
  constructor(
    accessSecretOrConfig: string | ConfigService,
    refreshSecret?: string,
    accessTtl?: string,
    refreshTtl?: string,
  ) {
    if (typeof accessSecretOrConfig === 'string') {
      this.accessSecret = accessSecretOrConfig;
      this.refreshSecret = refreshSecret!;
      this.accessTtl = accessTtl!;
      this.refreshTtl = refreshTtl!;
    } else {
      const config = accessSecretOrConfig;
      this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
      this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
      this.accessTtl = config.get<string>('JWT_ACCESS_TTL', '15m');
      this.refreshTtl = config.get<string>('JWT_REFRESH_TTL', '30d');
    }
  }

  signAccess(payload: JwtPayload): string {
    return jwt.sign(
      { tenantId: payload.tenantId, role: payload.role },
      this.accessSecret,
      { subject: payload.userId, expiresIn: this.accessTtl as jwt.SignOptions['expiresIn'] },
    );
  }

  signRefresh(payload: JwtPayload): string {
    return jwt.sign(
      { tenantId: payload.tenantId, role: payload.role },
      this.refreshSecret,
      { subject: payload.userId, expiresIn: this.refreshTtl as jwt.SignOptions['expiresIn'] },
    );
  }

  verifyAccess(token: string): JwtPayload {
    const decoded = jwt.verify(token, this.accessSecret) as jwt.JwtPayload;
    const { sub, tenantId, role } = decoded as { sub?: string; tenantId?: string; role?: string };
    if (!sub || !tenantId || !role) {
      throw new Error('Token is missing required claims (sub, tenantId, role).');
    }
    return { userId: sub, tenantId, role: role as Role };
  }

  get accessExpiresInSeconds(): number {
    return this.parseTtl(this.accessTtl);
  }

  private parseTtl(ttl: string): number {
    // Numeric string (seconds directly)
    const numericOnly = /^\d+$/.exec(ttl);
    if (numericOnly) return parseInt(ttl, 10);

    const match = /^(\d+)([smhdwy])$/.exec(ttl);
    if (!match) {
      // Unrecognised format — surface it rather than silently defaulting
      throw new Error(`JWT_ACCESS_TTL format not supported: "${ttl}". Use e.g. 15m, 1h, 30d.`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000,
    };
    return value * multipliers[unit];
  }
}
