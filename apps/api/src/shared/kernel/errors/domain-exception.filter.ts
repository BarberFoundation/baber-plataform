import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from './domain-error';

const ERROR_CODE_TO_STATUS: Record<string, HttpStatus> = {
  INVALID_FIREBASE_TOKEN: HttpStatus.UNAUTHORIZED,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  SERVICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  SERVICE_NAME_TAKEN: HttpStatus.CONFLICT,
  BARBER_NOT_FOUND: HttpStatus.NOT_FOUND,
  APPOINTMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  APPOINTMENT_CONFLICT: HttpStatus.CONFLICT,
  INVALID_APPOINTMENT_TIME: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_STATUS_TRANSITION: HttpStatus.UNPROCESSABLE_ENTITY,
  NO_BARBER_AVAILABLE: HttpStatus.CONFLICT,
  FORBIDDEN_CANCELLATION: HttpStatus.FORBIDDEN,
  NOTIFICATION_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
  FIREBASE_ACCOUNT_TENANT_MISMATCH: HttpStatus.CONFLICT,
  TENANT_NOT_FOUND: HttpStatus.NOT_FOUND,
  ADMIN_ACCOUNT_NOT_FOUND: HttpStatus.UNAUTHORIZED,
  USER_ALREADY_EXISTS: HttpStatus.CONFLICT,
  CANNOT_DEACTIVATE_SELF: HttpStatus.BAD_REQUEST,
  LAST_ACTIVE_ADMIN: HttpStatus.BAD_REQUEST,
};

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status = ERROR_CODE_TO_STATUS[exception.code] ?? HttpStatus.UNPROCESSABLE_ENTITY;
    res.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
    });
  }
}
