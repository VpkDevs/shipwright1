import { Redis } from "@upstash/redis";

let _redis: Redis | null | undefined;

/**
 * Returns Upstash Redis client when configured; otherwise null (local/dev fallback).
 */
export function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redis = null;
    return _redis;
  }
  _redis = new Redis({ url, token });
  return _redis;
}
