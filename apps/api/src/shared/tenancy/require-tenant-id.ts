import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

/** Validates the `x-tenant-id` header value, throwing a 400 if missing or not a UUID v4. */
export function requireTenantId(tenantId: string | undefined): asserts tenantId is string {
  if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
  if (!isUUID(tenantId, '4')) throw new BadRequestException('x-tenant-id must be a valid UUID v4.');
}
