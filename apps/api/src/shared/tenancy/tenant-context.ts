import { Injectable, Scope } from '@nestjs/common';

/**
 * Contexto de tenant da request atual. Request-scoped: uma instância por
 * request HTTP. Preenchido pelo TenantMiddleware a partir do JWT.
 *
 * Repositories injetam isto e filtram toda query por tenantId
 * automaticamente (ver BaseTenantRepository).
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private _tenantId: string | null = null;

  set tenantId(id: string) {
    this._tenantId = id;
  }

  get tenantId(): string {
    if (!this._tenantId) {
      throw new Error(
        'TenantContext acessado sem tenantId resolvido. ' +
          'Rota pública? Use @Public() ou resolva o tenant antes.',
      );
    }
    return this._tenantId;
  }

  get hasTenant(): boolean {
    return this._tenantId !== null;
  }
}
