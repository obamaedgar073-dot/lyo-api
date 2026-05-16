// ============================================================
// LYO - Auth Routes
// ============================================================
import { Router } from 'express';
import { register, login, refresh, logout, me, forgotPassword } from '@/controllers';
import { authenticate } from '@/middleware';
import { validate, authLimiter } from '@/middleware';
import { registerSchema, loginSchema, refreshSchema, forgotPasswordSchema } from '@/validators';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', authenticate, logout);
router.get('/me', async (req, res, next) => {
  console.log('ME route hit, auth header:', req.headers.authorization?.substring(0, 50));
  next();
}, authenticate, me);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);

export default router;