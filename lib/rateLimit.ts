type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __belaclubRateLimit?: Map<string, RateLimitBucket>;
};

const buckets =
  globalForRateLimit.__belaclubRateLimit ||
  new Map<string, RateLimitBucket>();

globalForRateLimit.__belaclubRateLimit = buckets;

export const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    realIp ||
    "unknown"
  );
};

export const checkRateLimit = (
  key: string,
  options: { limit: number; windowMs: number }
) => {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return { allowed: true, remaining: options.limit - 1 };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    allowed: true,
    remaining: options.limit - current.count,
  };
};
