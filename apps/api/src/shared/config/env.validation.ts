import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class EnvVars {
  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_ACCESS_TTL = '15m';

  @IsString()
  JWT_REFRESH_TTL = '30d';

  @IsOptional()
  @IsString()
  EVOLUTION_API_URL?: string;

  @IsOptional()
  @IsString()
  EVOLUTION_API_KEY?: string;

  @IsOptional()
  @IsString()
  EVOLUTION_INSTANCE?: string;

  @IsOptional()
  @IsString()
  EVOLUTION_INSTANCE_NAME?: string;

  @IsOptional()
  @IsString()
  ASAAS_API_URL?: string;

  @IsOptional()
  @IsString()
  ASAAS_API_KEY?: string;

  @IsOptional()
  @IsString()
  ASAAS_WEBHOOK_TOKEN?: string;

  @IsOptional()
  @IsString()
  FIREBASE_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  FIREBASE_CLIENT_EMAIL?: string;

  @IsOptional()
  @IsString()
  FIREBASE_PRIVATE_KEY?: string;

  /** Origens permitidas para CORS, separadas por vírgula. Obrigatória em produção para habilitar cross-origin. */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT = 3000;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment variables:\n${errors
        .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }

  if (validated.NODE_ENV === 'production') {
    const requiredFirebase = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'] as const;
    const missingFirebase = requiredFirebase.filter((key) => !validated[key]);
    if (missingFirebase.length > 0) {
      throw new Error(
        `Firebase Admin credentials are required in production (token signature verification). Missing: ${missingFirebase.join(', ')}`,
      );
    }

    const requiredAsaas = ['ASAAS_API_URL', 'ASAAS_API_KEY'] as const;
    const missingAsaas = requiredAsaas.filter((key) => !validated[key]);
    if (missingAsaas.length > 0) {
      throw new Error(
        `Asaas credentials are required in production (missing envs silently fall back to a stub payment gateway that reports every charge as paid). Missing: ${missingAsaas.join(', ')}`,
      );
    }
  }

  return validated;
}
