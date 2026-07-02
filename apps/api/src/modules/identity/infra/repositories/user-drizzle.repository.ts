import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class UserDrizzleRepository implements IUserRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async findByFirebaseUid(firebaseUid: string, tenantId: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.firebaseUid, firebaseUid), eq(schema.users.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByPhone(phone: string, tenantId: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.phone, phone), eq(schema.users.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findById(id: string, tenantId: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, id), eq(schema.users.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async save(user: User): Promise<User> {
    const now = new Date();
    const [row] = await this.db
      .insert(schema.users)
      .values({
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        role: user.role,
        phone: user.phone,
        email: user.email,
        firebaseUid: user.firebaseUid,
        createdAt: user.createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.users.firebaseUid,
        set: {
          name: user.name,
          updatedAt: now,
        },
      })
      .returning();
    return this.toEntity(row);
  }

  private toEntity(row: typeof schema.users.$inferSelect): User {
    return User.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role,
      phone: row.phone,
      email: row.email,
      firebaseUid: row.firebaseUid,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
