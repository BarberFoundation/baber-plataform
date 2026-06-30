import { SetMetadata } from '@nestjs/common';

export type Role = 'CLIENT' | 'BARBER' | 'ADMIN';

export const ROLES_KEY = 'roles';

/** Restringe a rota aos roles informados. Vazio = qualquer autenticado. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
