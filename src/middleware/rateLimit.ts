import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  validate: { xForwardedForHeader: false },
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many auth attempts' } },
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  validate: { xForwardedForHeader: false },
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});