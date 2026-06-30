import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthenticatedUser } from './authenticated-user';

/**
 * Guard de autenticação.
 *
 * SHELL: hoje apenas decodifica o payload do Bearer (sem verificar
 * assinatura) e popula `req.user`. A verificação criptográfica do JWT
 * entra quando o módulo Identity emitir/validar tokens de verdade
 * (JWT_ACCESS_SECRET). Rotas @Public() são liberadas.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = this.decode(req.header('authorization'));
    if (!user) {
      throw new UnauthorizedException('Token ausente ou inválido.');
    }

    req.user = user;
    return true;
  }

  private decode(authHeader?: string): AuthenticatedUser | undefined {
    if (!authHeader?.startsWith('Bearer ')) return undefined;
    const parts = authHeader.slice('Bearer '.length).split('.');
    if (parts.length !== 3) return undefined;
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (!payload.userId || !payload.tenantId || !payload.role) return undefined;
      return {
        userId: payload.userId,
        tenantId: payload.tenantId,
        role: payload.role,
      };
    } catch {
      return undefined;
    }
  }
}
