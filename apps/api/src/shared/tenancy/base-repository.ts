import { SQL, and, eq } from 'drizzle-orm';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { TenantContext } from './tenant-context';

/**
 * Base para repositories Drizzle de tabelas multi-tenant.
 *
 * Garante que TODA query receba o predicado `tenant_id = <atual>`.
 * Concretos chamam `this.scoped(extraWhere?)` para montar o WHERE
 * em vez de escrever filtro cru — assim é impossível esquecer o tenant.
 *
 * Regra não-negociável (HANDOFF §6): nenhuma query crua sem tenant_id.
 */
export abstract class BaseTenantRepository {
  protected abstract readonly tenantColumn: PgColumn;

  constructor(protected readonly tenantContext: TenantContext) {}

  /** Monta o WHERE já com o filtro de tenant aplicado. */
  protected scoped(extraWhere?: SQL): SQL | undefined {
    const tenantPredicate = eq(this.tenantColumn, this.tenantContext.tenantId);
    return extraWhere ? and(tenantPredicate, extraWhere) : tenantPredicate;
  }

  /** Valores de insert com tenant_id preenchido a partir do contexto. */
  protected withTenant<T extends Record<string, unknown>>(
    values: T,
  ): T & { tenantId: string } {
    return { ...values, tenantId: this.tenantContext.tenantId };
  }
}

/** Helper opcional para checar em runtime que a tabela tem coluna tenant_id. */
export function assertTenantScoped(table: PgTable): void {
  if (!('tenantId' in table)) {
    throw new Error(
      `Tabela ${String(table)} não tem coluna tenantId — não pode usar BaseTenantRepository.`,
    );
  }
}
