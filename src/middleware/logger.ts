// ============================================================
// LYO - Request Logger Middleware
// ============================================================

import morgan from 'morgan';
import { logger } from '@/config';

export const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }
);
