// ============================================================
// LYO - Admin Validators
// ============================================================

import { z } from 'zod';

export const userFiltersSchema = z.object({
  query: z.object({
    role: z.enum(['user', 'moderator', 'admin']).optional(),
    status: z.enum(['active', 'suspended', 'banned']).optional(),
    search: z.string().optional(),
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'suspended', 'banned']),
  }),
});

export const reportFiltersSchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'reviewed', 'dismissed']).optional(),
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  }),
});

export const resolveReportSchema = z.object({
  body: z.object({
    resolution: z.string().min(1, 'Resolution is required'),
  }),
});
