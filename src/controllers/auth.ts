// ============================================================
// LYO - Auth Controller
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@/config';
import { logger } from '@/config';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  success,
  AppError,
} from '@/utils';
import type { AuthRequest } from '@/middleware';
import jwt from 'jsonwebtoken';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, email, password, displayName } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      throw new AppError(409, 'DUPLICATE_ENTRY', 'Username or email already taken');
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { username, email, passwordHash, displayName },
      select: {
        id: true, username: true, email: true, displayName: true,
        avatarUrl: true, role: true, isVerified: true, createdAt: true,
      },
    });

    const accessToken = await generateAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = await generateRefreshToken(user.id);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json(
      success({ user, tokens: { accessToken, refreshToken } }, 'Account created successfully')
    );
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new AppError(403, 'ACCOUNT_INACTIVE', 'Account is suspended or banned');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = await generateAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = await generateRefreshToken(user.id);

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.json(success({ user: userWithoutPassword, tokens: { accessToken, refreshToken } }, 'Login successful'));
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const { userId, jti } = await verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: userId, status: 'active' },
      select: { id: true, email: true, role: true },
    });

    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User not found or inactive');

    await revokeRefreshToken(jti);
    const newRefreshToken = await generateRefreshToken(user.id);
    const accessToken = await generateAccessToken({ sub: user.id, email: user.email, role: user.role });

    res.json(success({ accessToken, refreshToken: newRefreshToken }, 'Token refreshed'));
  } catch (err) {
    next(err);
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const { jti } = await verifyRefreshToken(refreshToken);
      await revokeRefreshToken(jti);
    }
    res.json(success(null, 'Logged out successfully'));
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const secret = process.env.JWT_ACCESS_SECRET!;
    console.log('Secret length:', secret?.length, 'Token length:', token.length);

    let payload: any;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;
      console.log('me controller JWT verified:', payload.sub);
    } catch (jwtErr: any) {
      console.error('me jwt error:', jwtErr.message);
      return res.status(401).json({ error: jwtErr.message });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true, username: true, email: true, displayName: true,
        bio: true, avatarUrl: true, coverUrl: true, location: true,
        website: true, isVerified: true, isPrivate: true, role: true,
        status: true, followerCount: true, followingCount: true,
        postCount: true, createdAt: true, updatedAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(success(user));
  } catch (err: any) {
    console.error('me error:', err.message);
    res.status(401).json({ error: err.message });
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return res.json(success(null, 'If an account exists, a reset link has been sent'));

    logger.info(`Password reset requested for: ${email}`);
    res.json(success(null, 'If an account exists, a reset link has been sent'));
  } catch (err) {
    next(err);
  }
}