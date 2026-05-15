// ============================================================
// LYO - Post Validators
// ============================================================

import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    content: z.string().max(280, 'Post must be at most 280 characters').optional(),
    visibility: z.enum(['public', 'followers', 'private']).default('public'),
    replyToId: z.string().optional(),
  }),
});

export const vibeSchema = z.object({
  body: z.object({
    vibeType: z.enum(['fire', 'heart', 'laugh', 'insight', 'cool']),
  }),
});

export const commentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment too long'),
  }),
});

export const feedQuerySchema = z.object({
  query: z.object({
    type: z.enum(['following', 'discover', 'trending']).optional(),
    hashtag: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).optional(),
  }),
});
