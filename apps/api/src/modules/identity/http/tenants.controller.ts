import { Body, Controller, Get, NotFoundException, Param, Patch } from '@nestjs/common';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '@shared/auth/public.decorator';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { DayOfWeek } from '../../team/domain/value-objects/work-schedule';
import { ListTenantsUseCase } from '../application/use-cases/list-tenants.use-case';
import { FindTenantBySlugUseCase } from '../application/use-cases/find-tenant-by-slug.use-case';
import { GetTenantSettingsUseCase } from '../application/use-cases/get-tenant-settings.use-case';
import { UpdateTenantSettingsUseCase } from '../application/use-cases/update-tenant-settings.use-case';

class DayScheduleDto {
  @IsBoolean()
  isWorking!: boolean;

  @ValidateIf((o: DayScheduleDto) => o.isWorking === true)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime deve estar no formato HH:mm' })
  startTime!: string | null;

  @ValidateIf((o: DayScheduleDto) => o.isWorking === true)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime deve estar no formato HH:mm' })
  endTime!: string | null;
}

class BusinessHoursDto implements Record<DayOfWeek, DayScheduleDto> {
  @ValidateNested() @Type(() => DayScheduleDto) mon!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) tue!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) wed!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) thu!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) fri!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) sat!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) sun!: DayScheduleDto;
}

class UpdateTenantSettingsDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessHoursDto)
  businessHours?: BusinessHoursDto;
}

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly listTenants: ListTenantsUseCase,
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
    private readonly getTenantSettings: GetTenantSettingsUseCase,
    private readonly updateTenantSettings: UpdateTenantSettingsUseCase,
  ) {}

  @Public()
  @Get()
  async list() {
    return this.listTenants.execute();
  }

  @Roles('ADMIN')
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return this.getTenantSettings.execute({ tenantId: user.tenantId });
  }

  @Roles('ADMIN')
  @Patch('me')
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateTenantSettingsDto) {
    return this.updateTenantSettings.execute({
      tenantId: user.tenantId,
      name: dto.name,
      phone: dto.phone,
      address: dto.address,
      logoUrl: dto.logoUrl,
      businessHours: dto.businessHours,
    });
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.findTenantBySlug.execute(slug);
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }
    return tenant;
  }
}
