import { ErrorCode, type ErrorCodeType } from '@dosemate/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCodeType,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (code: ErrorCodeType = ErrorCode.UNAUTHORIZED, message = 'Unauthorized') =>
  new AppError(401, code, message);

export const forbidden = (code: ErrorCodeType = ErrorCode.FORBIDDEN, message = 'Forbidden') =>
  new AppError(403, code, message);

export const notFound = (message = 'Resource not found') =>
  new AppError(404, ErrorCode.NOT_FOUND, message);

export const badRequest = (code: ErrorCodeType = ErrorCode.VALIDATION_ERROR, message = 'Bad request', details?: unknown) =>
  new AppError(400, code, message, details);

export function globalErrorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof AppError) {
    return reply.status(err.statusCode).send({
      code: err.code,
      message: err.message,
      details: err.details,
      requestId: req.id,
    });
  }

  if (err instanceof ZodError) {
    return reply.status(400).send({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      details: err.flatten(),
      requestId: req.id,
    });
  }

  // Fastify schema validation error
  if ('validation' in err && err.validation) {
    return reply.status(400).send({
      code: ErrorCode.VALIDATION_ERROR,
      message: err.message,
      details: err.validation,
      requestId: req.id,
    });
  }

  // Prisma known constraint conflicts
  if ('code' in err && err.code === 'P2002') {
    return reply.status(409).send({
      code: ErrorCode.CONFLICT,
      message: 'Record already exists',
      requestId: req.id,
    });
  }

  req.log.error({ err }, 'Unhandled API error');
  return reply.status(500).send({
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Internal server error',
    requestId: req.id,
  });
}
