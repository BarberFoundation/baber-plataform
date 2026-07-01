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
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Public } from '@shared/auth/public.decorator';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { CreateServiceUseCase } from '../application/use-cases/create-service.use-case';
import { UpdateServiceUseCase } from '../application/use-cases/update-service.use-case';
import { DeactivateServiceUseCase } from '../application/use-cases/deactivate-service.use-case';
import { GetServiceUseCase } from '../application/use-cases/get-service.use-case';
import { ListServicesUseCase } from '../application/use-cases/list-services.use-case';
import { Service } from '../domain/entities/service.entity';

class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsInt()
  @IsPositive()
  priceInCents!: number;

  @IsInt()
  @Min(1)
  durationMinutes!: number;
}

class UpdateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsInt()
  @IsPositive()
  priceInCents!: number;

  @IsInt()
  @Min(1)
  durationMinutes!: number;
}

function serializeService(service: Service) {
  return {
    id: service.id,
    tenantId: service.tenantId,
    name: service.name,
    description: service.description,
    priceInCents: service.priceInCents,
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

@Controller('services')
export class CatalogController {
  constructor(
    private readonly createService: CreateServiceUseCase,
    private readonly updateService: UpdateServiceUseCase,
    private readonly deactivateService: DeactivateServiceUseCase,
    private readonly getService: GetServiceUseCase,
    private readonly listServices: ListServicesUseCase,
  ) {}

  @Public()
  @Get()
  async list(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    const services = await this.listServices.execute({ tenantId, includeInactive: false });
    return services.map(serializeService);
  }

  @Roles('ADMIN')
  @Get('admin')
  async listAdmin(
    @CurrentUser() user: JwtPayload,
    @Query('includeInactive') includeInactiveRaw?: string,
  ) {
    const services = await this.listServices.execute({
      tenantId: user.tenantId,
      includeInactive: includeInactiveRaw === 'true',
    });
    return services.map(serializeService);
  }

  @Public()
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    const service = await this.getService.execute({ id, tenantId });
    return serializeService(service);
  }

  @Roles('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateServiceDto) {
    const service = await this.createService.execute({
      tenantId: user.tenantId,
      name: dto.name,
      description: dto.description ?? null,
      priceInCents: dto.priceInCents,
      durationMinutes: dto.durationMinutes,
    });
    return serializeService(service);
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    const service = await this.updateService.execute({
      id,
      tenantId: user.tenantId,
      name: dto.name,
      description: dto.description ?? null,
      priceInCents: dto.priceInCents,
      durationMinutes: dto.durationMinutes,
    });
    return serializeService(service);
  }

  @Roles('ADMIN')
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@CurrentUser() user: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.deactivateService.execute({ id, tenantId: user.tenantId });
  }
}
