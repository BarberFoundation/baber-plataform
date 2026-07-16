import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { InviteTeamMemberUseCase } from '../application/use-cases/invite-team-member.use-case';
import { ListTeamMembersUseCase } from '../application/use-cases/list-team-members.use-case';
import { DeactivateTeamMemberUseCase } from '../application/use-cases/deactivate-team-member.use-case';
import { User } from '../domain/entities/user.entity';

class InviteTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsIn(['ADMIN', 'RECEPTIONIST'])
  role!: 'ADMIN' | 'RECEPTIONIST';
}

function serializeTeamMember(user: User) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

@Controller('team-members')
export class TeamMembersController {
  constructor(
    private readonly inviteTeamMember: InviteTeamMemberUseCase,
    private readonly listTeamMembers: ListTeamMembersUseCase,
    private readonly deactivateTeamMember: DeactivateTeamMemberUseCase,
  ) {}

  @Roles('ADMIN')
  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    const members = await this.listTeamMembers.execute({ tenantId: user.tenantId });
    return members.map(serializeTeamMember);
  }

  @Roles('ADMIN')
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(@CurrentUser() user: JwtPayload, @Body() dto: InviteTeamMemberDto) {
    const created = await this.inviteTeamMember.execute({
      tenantId: user.tenantId,
      name: dto.name,
      phone: dto.phone,
      role: dto.role,
    });
    return serializeTeamMember(created);
  }

  @Roles('ADMIN')
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@CurrentUser() user: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.deactivateTeamMember.execute({
      tenantId: user.tenantId,
      targetId: id,
      requestedByUserId: user.userId,
    });
  }
}
