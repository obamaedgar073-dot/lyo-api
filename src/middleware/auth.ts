import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/utils';
import { AppError } from '@/utils';

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
      decoded = await verifyAccessToken(token);
    } catch (jwtErr: any) {
      console.error('JWT verify failed:', jwtErr.message);
      return res.status(401).json({ error: 'JWT failed: ' + jwtErr.message });
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
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