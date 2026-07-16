import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserAlreadyExistsError } from '../../domain/errors/identity.errors';

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

  async findByFirebaseUidAnyTenant(firebaseUid: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.firebaseUid, firebaseUid))
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

  async findStaffByTenant(tenantId: string): Promise<User[]> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.tenantId, tenantId), ne(schema.users.role, 'CLIENT')));
    return rows.map((row) => this.toEntity(row));
  }

  async save(user: User): Promise<User> {
    const now = new Date();
    try {
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
          // Conflict on the PK (id), not firebaseUid: firebaseUid has a unique
          // index but NULLs never collide on it, so targeting firebaseUid could
          // let a re-save of a user without one fall through to a duplicate-pkey
          // error instead of updating the existing row.
          target: schema.users.id,
          set: {
            name: user.name,
            phone: user.phone,
            firebaseUid: user.firebaseUid,
            updatedAt: now,
          },
        })
        .returning();
      return this.toEntity(row);
    } catch (err) {
      // 23505 = unique_violation (firebase_uid ou tenant+phone/email) — vira erro
      // de domínio para o use case decidir entre re-ler e propagar.
      if ((err as { code?: string })?.code === '23505') {
        throw new UserAlreadyExistsError();
      }
      throw err;
    }
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
