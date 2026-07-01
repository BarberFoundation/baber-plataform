import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  isUUID,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '@shared/auth/public.decorator';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { AddBarberUseCase } from '../application/use-cases/add-barber.use-case';
import { UpdateBarberUseCase } from '../application/use-cases/update-barber.use-case';
import { SetWorkScheduleUseCase } from '../application/use-cases/set-work-schedule.use-case';
import { GetBarberUseCase } from '../application/use-cases/get-barber.use-case';
import { ListBarbersUseCase } from '../application/use-cases/list-barbers.use-case';
import { DeactivateBarberUseCase } from '../application/use-cases/deactivate-barber.use-case';
import { Barber } from '../domain/entities/barber.entity';
import { DayOfWeek } from '../domain/value-objects/work-schedule';

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

class WorkScheduleDto implements Record<DayOfWeek, DayScheduleDto> {
  @ValidateNested() @Type(() => DayScheduleDto) mon!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) tue!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) wed!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) thu!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) fri!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) sat!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) sun!: DayScheduleDto;
}

class AddBarberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  phone?: string | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkScheduleDto)
  workSchedule?: WorkScheduleDto;
}

class UpdateBarberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  phone!: string | null;
}

class SetWorkScheduleDto {
  @IsObject()
  @ValidateNested()
  @Type(() => WorkScheduleDto)
  workSchedule!: WorkScheduleDto;
}

function serializeBarber(barber: Barber) {
  return {
    id: barber.id,
    tenantId: barber.tenantId,
    name: barber.name,
    phone: barber.phone,
    isActive: barber.isActive,
    workSchedule: barber.workSchedule,
    createdAt: barber.createdAt,
    updatedAt: barber.updatedAt,
  };
}

@Controller('barbers')
export class TeamController {
  constructor(
    private readonly addBarber: AddBarberUseCase,
    private readonly updateBarber: UpdateBarberUseCase,
    private readonly setWorkSchedule: SetWorkScheduleUseCase,
    private readonly getBarber: GetBarberUseCase,
    private readonly listBarbers: ListBarbersUseCase,
    private readonly deactivateBarber: DeactivateBarberUseCase,
  ) {}

  @Public()
  @Get()
  async list(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    if (!isUUID(tenantId, '4')) throw new BadRequestException('x-tenant-id must be a valid UUID v4.');
    const barbers = await this.listBarbers.execute({ tenantId, includeInactive: false });
    return barbers.map(serializeBarber);
  }

  @Roles('ADMIN')
  @Get('admin')
  async listAdmin(
    @CurrentUser() user: JwtPayload,
    @Query('includeInactive') includeInactiveRaw?: string,
  ) {
    const includeInactive = includeInactiveRaw === 'true';
    const barbers = await this.listBarbers.execute({ tenantId: user.tenantId, includeInactive });
    return barbers.map(serializeBarber);
  }

  @Public()
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    if (!isUUID(tenantId, '4')) throw new BadRequestException('x-tenant-id must be a valid UUID v4.');
    const barber = await this.getBarber.execute({ id, tenantId });
    return serializeBarber(barber);
  }

  @Roles('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: AddBarberDto) {
    const barber = await this.addBarber.execute({
      tenantId: user.tenantId,
      name: dto.name,
      phone: dto.phone ?? null,
      workSchedule: dto.workSchedule,
    });
    return serializeBarber(barber);
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBarberDto,
  ) {
    const barber = await this.updateBarber.execute({
      id,
      tenantId: user.tenantId,
      name: dto.name,
      phone: dto.phone,
    });
    return serializeBarber(barber);
  }

  @Roles('ADMIN')
  @Put(':id/work-schedule')
  async updateWorkSchedule(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetWorkScheduleDto,
  ) {
    const barber = await this.setWorkSchedule.execute({
      id,
      tenantId: user.tenantId,
      workSchedule: dto.workSchedule,
    });
    return serializeBarber(barber);
  }

  @Roles('ADMIN')
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.deactivateBarber.execute({ id, tenantId: user.tenantId });
  }
}
