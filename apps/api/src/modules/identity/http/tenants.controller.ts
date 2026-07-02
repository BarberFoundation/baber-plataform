import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '@shared/auth/public.decorator';
import { ListTenantsUseCase } from '../application/use-cases/list-tenants.use-case';
import { FindTenantBySlugUseCase } from '../application/use-cases/find-tenant-by-slug.use-case';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly listTenants: ListTenantsUseCase,
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
  ) {}

  @Public()
  @Get()
  async list() {
    return this.listTenants.execute();
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
