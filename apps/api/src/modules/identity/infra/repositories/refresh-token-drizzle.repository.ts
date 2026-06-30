import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import {
  IRefreshTokenRepository,
  RefreshTokenRecord,
} from '../../domain/repositories/refresh-token.repository';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class RefreshTokenDrizzleRepository implements IRefreshTokenRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async save(record: RefreshTokenRecord): Promise<void> {
    await this.db.insert(schema.refreshTokens).values({
      id: record.id,
      userId: record.userId,
      tenantId: record.tenantId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
    });
  }

  async findByHash(hash: string): Promise<RefreshTokenRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.tokenHash, hash))
      .limit(1);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    };
  }

  async revokeByHash(hash: string): Promise<void> {
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.tokenHash, hash));
  }
}
