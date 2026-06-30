import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { tenants } from '../src/shared/database/schema';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/barbearia';

const SEED_TENANT = {
  name: 'Barbearia do Amigo',
  slug: 'barbearia-do-amigo',
  phone: null,
  address: null,
  timezone: 'America/Sao_Paulo',
};

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  const existing = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, SEED_TENANT.slug))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Tenant "${SEED_TENANT.slug}" já existe (${existing[0].id}). Nada a fazer.`);
  } else {
    const [created] = await db.insert(tenants).values(SEED_TENANT).returning();
    console.log(`Tenant criado: ${created.name} (${created.id}).`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error('Seed falhou:', err);
  process.exit(1);
});
