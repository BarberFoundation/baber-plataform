import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IStampCardRepository } from '../../domain/repositories/stamp-card.repository';
import { StampCard } from '../../domain/entities/stamp-card.entity';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class StampCardDrizzleRepository implements IStampCardRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findByClientId(tenantId: string, clientId: string): Promise<StampCard | null> {
    const rows = await this.db
      .select()
      .from(schema.stampCards)
      .where(and(eq(schema.stampCards.tenantId, tenantId), eq(schema.stampCards.clientId, clientId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async save(card: StampCard): Promise<StampCard> {
    const [row] = await this.db
      .insert(schema.stampCards)
      .values({
        id: card.id,
        tenantId: card.tenantId,
        clientId: card.clientId,
        currentStamps: card.currentStamps,
        creditBalanceInCents: card.creditBalanceInCents,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      })
      .onConflictDoUpdate({
        // Conflict on (tenantId, clientId), not the id column: id is a
        // defaultRandom() PK, so a re-save of an existing card generated via
        // StampCard.createNew() would carry a fresh id that doesn't match the
        // row already in the DB. Returning the DB row (not the input `card`)
        // avoids silently handing back a stale/wrong id. Mirrors the fix
        // applied to StampCardConfigDrizzleRepository.upsert().
        target: [schema.stampCards.tenantId, schema.stampCards.clientId],
        set: {
          currentStamps: card.currentStamps,
          creditBalanceInCents: card.creditBalanceInCents,
          updatedAt: card.updatedAt,
        },
      })
      .returning();
    return this.toEntity(row);
  }

  private toEntity(row: typeof schema.stampCards.$inferSelect): StampCard {
    return StampCard.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      clientId: row.clientId,
      currentStamps: row.currentStamps,
      creditBalanceInCents: row.creditBalanceInCents,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
