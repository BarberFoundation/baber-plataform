import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';

@Controller('me')
export class MeController {
  @Get()
  me(@CurrentUser() user: JwtPayload) {
    return {
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
    };
  }
}
