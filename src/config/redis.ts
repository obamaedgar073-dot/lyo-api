import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

let redis: ReturnType<typeof createClient> | null = null;

export { redis };

export async function connectRedis() {
  try {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: { connectTimeout: 5000, reconnectStrategy: false },
    });
    client.on('error', () => {});
    await client.connect();
    redis = client;
    console.log('✅ Redis connected');
  } catch {
    console.warn('⚠️ Redis not available, continuing without it');
    redis = null;
  }
}

export async function disconnectRedis() {
  if (redis) {
    await redis.disconnect();
    redis = null;
  }
}