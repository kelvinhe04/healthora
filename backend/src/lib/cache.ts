import Redis from 'ioredis';
import { logger } from './logger';

const DEFAULT_TTL_SEC = Number(process.env.CACHE_TTL_SEC) || 60;

type MemoryEntry = { value: string; expiresAt: number };

const memory = new Map<string, MemoryEntry>();
let redis: Redis | null = null;
let redisFailed = false;

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url || redisFailed) return null;
  if (!redis) {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    redis.on('error', (err) => {
      logger.warn({ err }, 'Redis error; falling back to in-memory cache');
      redisFailed = true;
    });
  }
  return redis;
}

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSec: number): void {
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (client) {
    try {
      if (client.status !== 'ready') await client.connect();
      const raw = await client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      redisFailed = true;
    }
  }
  const raw = memoryGet(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSec = DEFAULT_TTL_SEC): Promise<void> {
  const payload = JSON.stringify(value);
  const client = getRedis();
  if (client) {
    try {
      if (client.status !== 'ready') await client.connect();
      await client.set(key, payload, 'EX', ttlSec);
      return;
    } catch {
      redisFailed = true;
    }
  }
  memorySet(key, payload, ttlSec);
}

export async function clearCatalogCache(): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      if (client.status !== 'ready') await client.connect();
      const keys = await client.keys('catalog:*');
      if (keys.length) await client.del(...keys);
    } catch {
      redisFailed = true;
    }
  }
  for (const key of [...memory.keys()]) {
    if (key.startsWith('catalog:')) memory.delete(key);
  }
}
