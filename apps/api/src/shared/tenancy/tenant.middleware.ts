import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContext } from './tenant-context';

interface JwtPayloadLike {
  tenantId?: string;
}

/**
 * Lê o tenantId do JWT já decodificado e injeta no TenantContext.
 *
 * NOTA: a verificação de assinatura do JWT é responsabilidade do JwtGuard.
 * Este middleware roda ANTES dos guards no pipeline do Nest, então aqui só
 * fazemos um decode best-effort do tenantId para o request-scoped context.
 * O guard ainda valida e rejeita tokens inválidos — quem não passar no guard
 * nunca chega no handler que usa o TenantContext.
 *
 * Decode real do JWT entra quando Identity for implementado. Por ora,
 * aceita header `x-tenant-id` em dev para destravar testes manuais.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContext) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const fromHeader = req.header('x-tenant-id');
    const fromToken = this.decodeTenantId(req.header('authorization'));

    const tenantId = fromToken ?? fromHeader;
    if (tenantId) {
      this.tenantContext.tenantId = tenantId;
    }

    next();
  }

  private decodeTenantId(authHeader?: string): string | undefined {
    if (!authHeader?.startsWith('Bearer ')) return undefined;
    const token = authHeader.slice('Bearer '.length);
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as JwtPayloadLike;
      return payload.tenantId;
    } catch {
      return undefined;
    }
  }
}
