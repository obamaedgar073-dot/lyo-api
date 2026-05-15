// ============================================================
// LYO - Database Client (Prisma)
// ============================================================

import { PrismaClient } from '@prisma/client';
import { env, isDev } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: isDev
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

if (isDev) globalForPrisma.prisma = prisma;

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
