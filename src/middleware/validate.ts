// ============================================================
// LYO - Validation Middleware
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '@/utils';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (!result.success) {
        const details: Record<string, string[]> = {};
        result.error.errors.forEach((e) => {
          const path = e.path.join('.');
          if (!details[path]) details[path] = [];
          details[path].push(e.message);
        });
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input data', details);
      }

      // Replace with parsed values
      req.body = result.data.body ?? req.body;
      req.query = result.data.query ?? req.query;
      req.params = result.data.params ?? req.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}
