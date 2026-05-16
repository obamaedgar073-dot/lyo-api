import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils';
import { jwtVerify } from 'jose';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
        audience: 'lyo-api',
        issuer: 'lyo-auth',
      });
      decoded = payload;
      console.log('HTTP JWT verified for sub:', decoded.sub);
    } catch (jwtErr: any) {
      console.error('HTTP JWT verify failed:', jwtErr.message);
      return res.status(401).json({ error: 'JWT failed: ' + jwtErr.message });
    }

    req.user = {
      id: decoded.sub as string,
      email: decoded.email as string,
      role: decoded.role as string,
    };

    next();
  } catch (err: any) {
    console.error('Unexpected auth error:', err.message);
    return res.status(500).json({ error: 'Auth error: ' + err.message });
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