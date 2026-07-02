import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import {
  IOtpCodeRepository,
  OtpCodeRecord,
} from '../../domain/repositories/otp-code.repository';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class OtpCodeDrizzleRepository implements IOtpCodeRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async save(record: OtpCodeRecord): Promise<void> {
    await this.db.insert(schema.otpCodes).values({
      id: record.id,
      tenantId: record.tenantId,
      phone: record.phone,
      codeHash: record.codeHash,
      expiresAt: record.expiresAt,
      attempts: record.attempts,
      usedAt: record.usedAt,
      createdAt: record.createdAt,
    });
  }

  async findActiveByPhone(tenantId: string, phone: string): Promise<OtpCodeRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.otpCodes)
      .where(
        and(
          eq(schema.otpCodes.tenantId, tenantId),
          eq(schema.otpCodes.phone, phone),
          isNull(schema.otpCodes.usedAt),
          gt(schema.otpCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.otpCodes.createdAt))
      .limit(1);
    return rows[0] ? this.toRecord(rows[0]) : null;
  }

  async incrementAttempts(id: string): Promise<void> {
    const [row] = await this.db
      .select({ attempts: schema.otpCodes.attempts })
      .from(schema.otpCodes)
      .where(eq(schema.otpCodes.id, id))
      .limit(1);
    if (!row) return;
    await this.db
      .update(schema.otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(schema.otpCodes.id, id));
  }

  async markUsed(id: string): Promise<void> {
    await this.db
      .update(schema.otpCodes)
      .set({ usedAt: new Date() })
      .where(eq(schema.otpCodes.id, id));
  }

  private toRecord(row: typeof schema.otpCodes.$inferSelect): OtpCodeRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      phone: row.phone,
      codeHash: row.codeHash,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      usedAt: row.usedAt,
      createdAt: row.createdAt,
    };
  }
}
