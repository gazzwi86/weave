// Law 18: rate-limit middleware is mandatory on auth-bearing endpoints.
// ponytail: in-memory Map, single dev process only -- swap for
// @upstash/ratelimit + @upstash/redis once there's more than one instance.

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Sliding-window rate limit check. Records `now` against `key`'s request
 * history in `store`, drops entries older than `windowMs`, and returns
 * whether the request is allowed (true) or should be rejected (false).
 */
export function checkRateLimit(
  store: Map<string, number[]>,
  key: string,
  now: number,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS
): boolean {
  const windowStart = now - windowMs;
  const recent = (store.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (recent.length >= limit) {
    store.set(key, recent);
    return false;
  }

  recent.push(now);
  store.set(key, recent);
  return true;
}
