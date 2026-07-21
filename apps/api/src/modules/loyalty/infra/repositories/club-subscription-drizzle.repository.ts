// apps/api/src/modules/loyalty/infra/repositories/club-subscription-drizzle.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IClubSubscriptionRepository } from '../../domain/repositories/club-subscription.repository';
import { ClubSubscription, SubscriptionQuota } from '../../domain/entities/club-subscription.entity';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ClubSubscriptionDrizzleRepository implements IClubSubscriptionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findByClientId(tenantId: string, clientId: string): Promise<ClubSubscription | null> {
    const rows = await this.db
      .select()
      .from(schema.clubSubscriptions)
      .where(and(eq(schema.clubSubscriptions.tenantId, tenantId), eq(schema.clubSubscriptions.clientId, clientId)))
      .limit(1);
    if (!rows[0]) return null;
    return this.hydrate(rows[0]);
  }

  async findByAsaasSubscriptionId(asaasSubscriptionId: string): Promise<ClubSubscription | null> {
    const rows = await this.db
      .select()
      .from(schema.clubSubscriptions)
      .where(eq(schema.clubSubscriptions.asaasSubscriptionId, asaasSubscriptionId))
      .limit(1);
    if (!rows[0]) return null;
    return this.hydrate(rows[0]);
  }

  async save(subscription: ClubSubscription): Promise<ClubSubscription> {
    const [row] = await this.db
      .insert(schema.clubSubscriptions)
      .values({
        id: subscription.id,
        tenantId: subscription.tenantId,
        clientId: subscription.clientId,
        tierId: subscription.tierId,
        status: subscription.status,
        asaasCustomerId: subscription.asaasCustomerId,
        asaasSubscriptionId: subscription.asaasSubscriptionId,
        currentCycleStart: subscription.currentCycleStart,
        currentCycleEnd: subscription.currentCycleEnd,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.clubSubscriptions.id,
        set: {
          tierId: subscription.tierId,
          status: subscription.status,
          asaasCustomerId: subscription.asaasCustomerId,
          asaasSubscriptionId: subscription.asaasSubscriptionId,
          currentCycleStart: subscription.currentCycleStart,
          currentCycleEnd: subscription.currentCycleEnd,
          updatedAt: subscription.updatedAt,
        },
      })
      .returning();

    await this.db.delete(schema.clubSubscriptionQuotas).where(eq(schema.clubSubscriptionQuotas.subscriptionId, row.id));
    const quotas = subscription.quotas;
    if (quotas.length > 0) {
      await this.db.insert(schema.clubSubscriptionQuotas).values(
        quotas.map((q) => ({
          subscriptionId: row.id,
          serviceId: q.serviceId,
          quantityTotal: q.quantityTotal,
          quantityConsumed: q.quantityConsumed,
        })),
      );
    }

    return ClubSubscription.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      clientId: row.clientId,
      tierId: row.tierId,
      status: row.status,
      asaasCustomerId: row.asaasCustomerId,
      asaasSubscriptionId: row.asaasSubscriptionId,
      currentCycleStart: row.currentCycleStart,
      currentCycleEnd: row.currentCycleEnd,
      quotas,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private async hydrate(row: typeof schema.clubSubscriptions.$inferSelect): Promise<ClubSubscription> {
    const quotaRows = await this.db
      .select()
      .from(schema.clubSubscriptionQuotas)
      .where(eq(schema.clubSubscriptionQuotas.subscriptionId, row.id));
    const quotas: SubscriptionQuota[] = quotaRows.map((q) => ({
      serviceId: q.serviceId,
      quantityTotal: q.quantityTotal,
      quantityConsumed: q.quantityConsumed,
    }));
    return ClubSubscription.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      clientId: row.clientId,
      tierId: row.tierId,
      status: row.status,
      asaasCustomerId: row.asaasCustomerId,
      asaasSubscriptionId: row.asaasSubscriptionId,
      currentCycleStart: row.currentCycleStart,
      currentCycleEnd: row.currentCycleEnd,
      quotas,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
