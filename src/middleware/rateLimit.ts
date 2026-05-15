// ============================================================
// LYO - Rate Limiting Middleware
// ============================================================

import rateLimit from 'express-rate-limit';
import { redis } from '@/config';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many auth attempts' } },
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});
