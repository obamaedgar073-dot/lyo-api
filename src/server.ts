import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { env } from '@/config';
import { connectRedis, logger } from '@/config';
import { setupWebSocket } from '@/websocket';
import routes from '@/routes';
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  generalLimiter,
} from '@/middleware';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  await connectRedis();
  setupWebSocket(httpServer);

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(generalLimiter);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());
  app.use(requestLogger);

  const uploadDir = path.resolve(env.UPLOAD_DIR);
  const fs = await import('fs');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadDir));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/debug-jwt', async (_req, res) => {
    const { env } = await import('@/config');
    res.json({
      JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET,
      JWT_ACCESS_EXPIRY: env.JWT_ACCESS_EXPIRY,
    });
  });

  app.get('/test-auth', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.json({ error: 'no header' });
    const token = authHeader.split(' ')[1];
    try {
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
        audience: 'lyo-api',
        issuer: 'lyo-auth',
      });
      res.json({ success: true, payload });
    } catch (err: any) {
      res.json({ error: err.message, code: err.code });
    }
  });

  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  const PORT = parseInt(process.env.PORT || '8000');
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  process.on('SIGTERM', () => httpServer.close(() => process.exit(0)));
  process.on('SIGINT', () => httpServer.close(() => process.exit(0)));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});