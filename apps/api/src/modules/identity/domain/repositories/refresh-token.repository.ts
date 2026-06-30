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
}
