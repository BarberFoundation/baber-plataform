import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from './domain-error';

const ERROR_CODE_TO_STATUS: Record<string, HttpStatus> = {
  INVALID_FIREBASE_TOKEN: HttpStatus.UNAUTHORIZED,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
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
