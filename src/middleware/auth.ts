import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils';
import { jwtVerify } from 'jose';

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || 'lyo-access-secret-key-super-secure-2026');

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Attempting JWT verify for token starting:', token.substring(0, 20));

  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET, {
      algorithms: ['HS256'],
      audience: 'lyo-api',
      issuer: 'lyo-auth',
    });

    console.log('HTTP JWT verified for sub:', payload.sub);

    req.user = {
      id: payload.sub as string,
      email: payload.email as string,
      role: payload.role as string,
    };

    next();
  } catch (err: any) {
    console.error('HTTP JWT verify failed:', err.code, err.message);
    return res.status(401).json({ error: 'JWT failed: ' + err.message });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
    }
    next();
  };
}