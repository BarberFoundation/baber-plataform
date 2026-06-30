import { Module } from '@nestjs/common';

/**
 * Identity — auth, usuários, roles.
 * Cliente (mobile): OTP via WhatsApp. Admin (web): Firebase → JWT próprio.
 * A implementar: use-cases de OTP/Firebase/refresh, repos, controllers.
 */
@Module({})
export class IdentityModule {}
