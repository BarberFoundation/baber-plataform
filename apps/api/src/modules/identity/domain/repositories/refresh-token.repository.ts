export const REFRESH_TOKEN_REPOSITORY = Symbol('IRefreshTokenRepository');

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface IRefreshTokenRepository {
  save(record: RefreshTokenRecord): Promise<void>;
  findByHash(hash: string): Promise<RefreshTokenRecord | null>;
  revokeByHash(hash: string): Promise<void>;
  findActiveByUserId(userId: string): Promise<RefreshTokenRecord[]>;
  revokeById(id: string, userId: string): Promise<number>;
  revokeAllExceptHash(userId: string, exceptHash: string): Promise<void>;
}
