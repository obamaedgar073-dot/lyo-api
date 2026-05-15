import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/utils';
import { prisma } from '@/config';
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
      throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = await verifyAccessToken(token);
    } catch (jwtErr: any) {
      console.error('JWT verify failed:', jwtErr.message);
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid token');
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.sub, status: 'active' },
        select: { id: true, email: true, role: true, status: true },
      });
    } catch (dbErr: any) {
      console.error('DB error in authenticate:', dbErr.message);
      throw new AppError(500, 'DB_ERROR', dbErr.message);
    }

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found or inactive');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
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