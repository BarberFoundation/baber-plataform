import { Role } from './roles.decorator';

/** Payload de identidade resolvido a partir do access token. */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: Role;
}

/** Augment do Request do Express para carregar o usuário autenticado. */
declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
