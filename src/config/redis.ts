import { createClient } from 'redis';
import { env } from './env';

export const redis = createClient({ url: env.REDIS_URL || 'redis://localhost:6379' });

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

export async function connectRedis() {
  try {
    await redis.connect();
    console.log('Redis connected');
  } catch (err) {
    console.warn('Redis not available, continuing without it');
  }
}

export async function disconnectRedis() {
  try {
    await redis.disconnect();
  } catch {}
}