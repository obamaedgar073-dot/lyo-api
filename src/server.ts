// ============================================================
// LYO - Server Entry Point
// ============================================================

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
  authenticate,
  errorHandler,
  notFoundHandler,
  requestLogger,
  generalLimiter,
} from '@/middleware';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Connect to Redis
  await connectRedis();

  // Setup WebSocket
  setupWebSocket(httpServer);

  // Security middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }));

  // Rate limiting
  app.use(generalLimiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Logging
  app.use(requestLogger);

  // Static files
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', routes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Start server
  const PORT = parseInt(env.PORT);
  httpServer.listen(PORT, () => {
    logger.info(`🚀 LYO API server running on port ${PORT}`);
    logger.info(`📁 Upload directory: ${path.resolve(env.UPLOAD_DIR)}`);
    logger.info(`🌐 CORS enabled for: ${env.CLIENT_URL}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
