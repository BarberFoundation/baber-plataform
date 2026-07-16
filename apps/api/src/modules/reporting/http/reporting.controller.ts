import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { RevenueReportService } from '../application/revenue-report.service';
import { OccupancyReportService } from '../application/occupancy-report.service';
import { NewReturningClientsService } from '../application/new-returning-clients.service';
import { InactiveClientsService } from '../application/inactive-clients.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const INACTIVE_DAYS_OPTIONS = ['30', '60', '90'] as const;

export class ReportRangeQueryDto {
  @Matches(DATE_RE, { message: 'from deve ser YYYY-MM-DD' })
  from!: string;

  @Matches(DATE_RE, { message: 'to deve ser YYYY-MM-DD' })
  to!: string;
}

export class ClientsInactiveQueryDto {
  @IsOptional()
  @IsIn(INACTIVE_DAYS_OPTIONS, { message: 'days deve ser 30, 60 ou 90' })
  days?: string;
}

export function assertValidRange(from: string, to: string): void {
  if (from > to) throw new BadRequestException('from deve ser <= to');
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  if (days > MAX_RANGE_DAYS) throw new BadRequestException(`janela máxima de ${MAX_RANGE_DAYS} dias`);
}

@Controller('reports')
export class ReportingController {
  constructor(
    private readonly revenueReport: RevenueReportService,
    private readonly occupancyReport: OccupancyReportService,
    private readonly newReturningClients: NewReturningClientsService,
    private readonly inactiveClients: InactiveClientsService,
  ) {}

  @Get('revenue')
  @Roles('ADMIN')
  getRevenue(@CurrentUser() user: JwtPayload, @Query() query: ReportRangeQueryDto) {
    assertValidRange(query.from, query.to);
    return this.revenueReport.execute(user.tenantId, query.from, query.to);
  }

  @Get('occupancy')
  @Roles('ADMIN')
  getOccupancy(@CurrentUser() user: JwtPayload, @Query() query: ReportRangeQueryDto) {
    assertValidRange(query.from, query.to);
    return this.occupancyReport.execute(user.tenantId, query.from, query.to);
  }

  @Get('clients/new-returning')
  @Roles('ADMIN', 'RECEPTIONIST')
  getNewReturningClients(@CurrentUser() user: JwtPayload, @Query() query: ReportRangeQueryDto) {
    assertValidRange(query.from, query.to);
    return this.newReturningClients.execute(user.tenantId, query.from, query.to);
  }

  @Get('clients/inactive')
  @Roles('ADMIN', 'RECEPTIONIST')
  getInactiveClients(@CurrentUser() user: JwtPayload, @Query() query: ClientsInactiveQueryDto) {
    const days = Number(query.days ?? '60');
    return this.inactiveClients.execute(user.tenantId, days);
  }
}
