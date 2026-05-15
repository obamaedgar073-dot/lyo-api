// ============================================================
// LYO - Error Handling Middleware
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, error } from '@/utils';
import { logger } from '@/config';
import { isDev } from '@/config';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error(err);

  // Zod validation error
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const path = e.path.join('.');
      if (!details[path]) details[path] = [];
      details[path].push(e.message);
    });
    return res.status(400).json(
      error('VALIDATION_ERROR', 'Invalid input data', details)
    );
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json(
        error('DUPLICATE_ENTRY', 'A record with this value already exists')
      );
    }
    if (err.code === 'P2025') {
      return res.status(404).json(
        error('NOT_FOUND', 'Record not found')
      );
    }
    return res.status(500).json(
      error('DATABASE_ERROR', 'Database operation failed')
    );
  }

  // App errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      error(err.code, err.message, err.details)
    );
  }

  // JWT errors
  if (err.name === 'JWTExpired') {
    return res.status(401).json(error('TOKEN_EXPIRED', 'Token has expired'));
  }
  if (err.name === 'JWTInvalid' || err.name === 'JWSSignatureVerificationFailed') {
    return res.status(401).json(error('TOKEN_INVALID', 'Invalid token'));
  }

  // Default
  return res.status(500).json(
    error(
      'INTERNAL_ERROR',
      isDev ? err.message : 'An unexpected error occurred'
    )
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(error('NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}
