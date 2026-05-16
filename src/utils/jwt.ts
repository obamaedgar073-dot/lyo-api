// ============================================================
// LYO - JWT Utilities (using jose library)
// ============================================================
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '@/config';
import { prisma } from '@/config';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export interface TokenPayload extends JWTPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

export async function generateAccessToken(payload: Omit<TokenPayload, 'jti'>): Promise<string> {
  const jti = crypto.randomUUID();
  return new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRY)
    .setAudience('lyo-api')
    .setIssuer('lyo-auth')
    .sign(accessSecret);
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ sub: userId, jti, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRY)
    .setAudience('lyo-api')
    .setIssuer('lyo-auth')
    .sign(refreshSecret);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: jti,
      userId,
      expiresAt,
    },
  });

  return token;
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, {
      algorithms: ['HS256'],
      audience: 'lyo-api',
      issuer: 'lyo-auth',
      clockTolerance: 60,
    });
    console.log('JWT verified successfully for sub:', payload.sub);
    return payload as TokenPayload;
  } catch (err: any) {
    console.error('verifyAccessToken failed:', err.code, err.message);
    throw err;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; jti: string }> {
  const { payload } = await jwtVerify(token, refreshSecret, {
    algorithms: ['HS256'],
    audience: 'lyo-api',
    issuer: 'lyo-auth',
    clockTolerance: 60,
  });

  const stored = await prisma.refreshToken.findUnique({
    where: { token: payload.jti as string },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new Error('Refresh token revoked or expired');
  }

  return { userId: payload.sub as string, jti: payload.jti as string };
}

export async function revokeRefreshToken(jti: string): Promise<void> {
  await prisma.refreshToken.update({
    where: { token: jti },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}