// ============================================================
// LYO - User Validators
// ============================================================

import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().min(1).max(50).optional(),
    bio: z.string().max(160).optional().nullable(),
    location: z.string().max(100).optional().nullable(),
    website: z.string().url().max(200).optional().nullable(),
    isPrivate: z.boolean().optional(),
  }),
});

export const searchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(100),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).optional(),
  }),
});
