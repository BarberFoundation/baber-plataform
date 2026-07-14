import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { WorkSchedule } from '../../../team/domain/value-objects/work-schedule';
import { TenantNotFoundError } from '../../domain/errors/identity.errors';

type DB = PostgresJsDatabase<typeof schema>;

export interface UpdateTenantSettingsInput {
  tenantId: string;
  name?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  businessHours?: WorkSchedule;
}

@Injectable()
export class UpdateTenantSettingsUseCase {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async execute(input: UpdateTenantSettingsInput): Promise<schema.Tenant> {
    const set: Partial<schema.NewTenant> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.phone !== undefined) set.phone = input.phone;
    if (input.address !== undefined) set.address = input.address;
    if (input.logoUrl !== undefined) set.logoUrl = input.logoUrl;
    if (input.businessHours !== undefined) set.businessHours = input.businessHours;

    const rows = await this.db
      .update(schema.tenants)
      .set(set)
      .where(eq(schema.tenants.id, input.tenantId))
      .returning();
    if (!rows[0]) throw new TenantNotFoundError();
    return rows[0];
  }
}
