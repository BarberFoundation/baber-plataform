import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca rota como pública: pula o JwtGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
