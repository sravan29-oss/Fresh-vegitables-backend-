import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStores = new Map<string, Map<string, RateLimitRecord>>();

// Periodic cleanup of expired rate limit records (runs every 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const store of rateLimitStores.values()) {
    for (const [key, record] of store.entries()) {
      if (now > record.resetAt) {
        store.delete(key);
      }
    }
  }
}, 60000).unref();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
  skipInDevelopment?: boolean;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    keyPrefix = 'global',
    skipInDevelopment = false,
  } = options;

  let store = rateLimitStores.get(keyPrefix);
  if (!store) {
    store = new Map<string, RateLimitRecord>();
    rateLimitStores.set(keyPrefix, store);
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // Optionally bypass in local dev or unit tests if requested
    if (skipInDevelopment && (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development')) {
      return next();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetAt) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      store.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        success: false,
        statusCode: 429,
        code: 'TOO_MANY_REQUESTS',
        message,
        retryAfterSeconds: resetSeconds,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

// Preset rate limiters for key application endpoints
export const authRateLimiter = createRateLimiter({
  keyPrefix: 'auth',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 login/auth attempts per 15 mins
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

export const orderPlacementRateLimiter = createRateLimiter({
  keyPrefix: 'order-create',
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 order submissions per 5 minutes
  message: 'Order submission rate limit reached. Please wait a few moments before placing another order.',
});

export const reviewSubmissionRateLimiter = createRateLimiter({
  keyPrefix: 'review-create',
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // 15 review submissions per 10 minutes
  message: 'Review submission limit reached. Please try again later.',
});
