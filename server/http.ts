import type { Context, MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from '../src/schemas/api';
import type { Logger } from './log';
import type { RateLimiter } from './store';

/** Largest JSON body accepted by any route. */
export const MAX_BODY_BYTES = 8 * 1024;

/** A JSON error with a stable code. Never includes stack traces or user input. */
export function fail(c: Context, status: ContentfulStatusCode, code: ErrorCode, message: string) {
  return c.json({ error: { code, message } }, status);
}

/** Strict browser security headers on every response, static files included. */
export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
  strictTransportSecurity: 'max-age=63072000; includeSubDomains',
  xFrameOptions: 'DENY',
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
  permissionsPolicy: { camera: [], microphone: [], geolocation: [], payment: [] },
});

/**
 * The client's address. On Cloud Run the platform appends the real address
 * as the last `X-Forwarded-For` entry, so earlier (client-supplied) entries
 * are ignored.
 */
export function clientKey(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  const last = forwarded?.split(',').at(-1)?.trim();
  return last && last.length > 0 ? last.slice(0, 64) : 'direct';
}

/** Only our own pages may call the API, so other sites cannot spend the AI quota. */
export const sameOrigin: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('origin');
  const host = c.req.header('x-forwarded-host') ?? c.req.header('host');
  let allowed = false;
  try {
    allowed = origin !== undefined && host !== undefined && new URL(origin).host === host;
  } catch {
    allowed = false;
  }
  if (!allowed) return fail(c, 403, 'FORBIDDEN', 'Requests must come from the Tayyari page.');
  return next();
};

/** JSON only, with a hard size cap checked before the body is read. */
export const jsonOnly: MiddlewareHandler = async (c, next) => {
  if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json')) {
    return fail(c, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Send JSON.');
  }
  const declared = Number(c.req.header('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return fail(c, 413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  return next();
};

/** Per-client rate limit shared by every route that can call the model. */
export function rateLimit(limiter: RateLimiter): MiddlewareHandler {
  return async (c, next) => {
    const decision = limiter.check(clientKey(c));
    c.header('RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      c.header('Retry-After', String(decision.retryAfterSeconds));
      return fail(c, 429, 'RATE_LIMITED', 'Too many requests. Please wait a minute.');
    }
    return next();
  };
}

/** One structured log line per API request, with latency. */
export function requestLog(log: Logger): MiddlewareHandler {
  return async (c, next) => {
    const started = performance.now();
    await next();
    log('INFO', 'request', {
      httpRequest: {
        requestMethod: c.req.method,
        requestUrl: c.req.path,
        status: c.res.status,
        latency: `${((performance.now() - started) / 1000).toFixed(3)}s`,
      },
    });
  };
}

/** Reads the body as text with the size cap enforced even without Content-Length. */
export async function readJson(
  c: Context,
): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413 }> {
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return { ok: false, status: 413 };
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
