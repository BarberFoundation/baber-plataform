import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { UpdateUserNameUseCase } from '../application/use-cases/update-user-name.use-case';
import { GetUserProfileUseCase } from '../application/use-cases/get-user-profile.use-case';

export class UpdateNameDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  name!: string;
}

@Controller('me')
export class MeController {
  constructor(
    private readonly updateUserNameUseCase: UpdateUserNameUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
  ) {}

  @Get()
  async me(@CurrentUser() user: JwtPayload) {
    return this.getUserProfileUseCase.execute({ userId: user.userId, tenantId: user.tenantId });
  }

  @Patch()
  async updateName(@CurrentUser() user: JwtPayload, @Body() dto: UpdateNameDto) {
    return this.updateUserNameUseCase.execute({
      userId: user.userId,
      tenantId: user.tenantId,
      name: dto.name,
    });
  }
}
