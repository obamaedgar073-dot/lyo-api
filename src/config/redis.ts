import { createClient } from 'redis';

let redis: any = null;

export { redis };

export async function connectRedis() {
  try {
    const client = createClient({ 
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: { connectTimeout: 5000 }
    });
    client.on('error', () => {});
    await client.connect();
    console.log('Redis connected');
  } catch {
    console.warn('Redis not available, continuing without it');
  }
}

export async function disconnectRedis() {}