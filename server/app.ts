import { createHash } from 'node:crypto';
import { Hono, type Context } from 'hono';
import type * as z from 'zod/mini';
import {
  AnswerSchema,
  AskRequestSchema,
  ChangeExtractSchema,
  ChangeRequestSchema,
  ExplainRequestSchema,
  ExplanationSchema,
  IdeasRequestSchema,
  IdeasSchema,
  IntakeExtractSchema,
  IntakeRequestSchema,
  QuoteExtractSchema,
  QuoteRequestSchema,
  type AiReply,
} from '../src/schemas/api';
import {
  fail,
  jsonOnly,
  rateLimit,
  readJson,
  requestLog,
  sameOrigin,
  securityHeaders,
} from './http';
import type { Logger } from './log';
import { ModelError, type ModelClient } from './model';
import { PROMPT, SYSTEM } from './prompts';
import { RateLimiter, TtlCache } from './store';

export interface AppDeps {
  model: ModelClient | null;
  log: Logger;
  limiter?: RateLimiter;
  cache?: TtlCache<AiReply<unknown>>;
}

const STATUS = { AI_UNAVAILABLE: 503, AI_RESPONSE_INVALID: 502, AI_TIMEOUT: 504 } as const;

interface AiRoute<Req, Out> {
  request: z.ZodMiniType<Req>;
  output: z.ZodMiniType<Out>;
  system: string;
  prompt: (body: Req) => string;
  /** Final checks in code after the schema, e.g. dropping a date in the past. */
  finish?: (data: Out, body: Req) => Out;
}

/**
 * Builds the Hono app: security headers everywhere, and for each AI route
 * guard → validate → cache → model → validate → respond.
 */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const limiter = deps.limiter ?? new RateLimiter(20, 5 * 60_000);
  const cache = deps.cache ?? new TtlCache<AiReply<unknown>>(10 * 60_000, 500);

  app.use('*', securityHeaders);
  app.use('/api/*', requestLog(deps.log), async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  app.get('/api/health', (c) =>
    c.json({ status: 'ok', ai: deps.model ? 'configured' : 'not-configured' }),
  );

  const paths = new Set<string>();
  function aiRoute<Req, Out>(path: string, route: AiRoute<Req, Out>): void {
    paths.add(path);
    app.post(path, sameOrigin, jsonOnly, rateLimit(limiter), async (c: Context) => {
      const body = await readJson(c);
      if (!body.ok) {
        return body.status === 413
          ? fail(c, 413, 'PAYLOAD_TOO_LARGE', 'Request is too large.')
          : fail(c, 400, 'BAD_REQUEST', 'Body must be valid JSON.');
      }
      const parsed = route.request.safeParse(body.value);
      if (!parsed.success) {
        const field = parsed.error.issues[0]?.path.join('.') ?? 'body';
        return fail(c, 400, 'BAD_REQUEST', `Check the field "${field || 'body'}".`);
      }
      const key = createHash('sha256')
        .update(`${path}:${JSON.stringify(parsed.data)}`)
        .digest('hex');
      const hit = cache.get(key);
      if (hit) {
        c.header('X-Cache', 'HIT');
        return c.json({ ...hit, cached: true });
      }
      if (!deps.model)
        return fail(c, 503, 'AI_UNAVAILABLE', 'AI is not configured on this server.');
      try {
        const result = await deps.model.generate({
          system: route.system,
          prompt: route.prompt(parsed.data),
          schema: route.output,
          signal: c.req.raw.signal,
        });
        const data = route.finish ? route.finish(result.data, parsed.data) : result.data;
        const reply: AiReply<Out> = { data, model: result.model, cached: false };
        cache.set(key, reply);
        c.header('X-Cache', 'MISS');
        return c.json(reply);
      } catch (error) {
        if (error instanceof ModelError)
          return fail(c, STATUS[error.code], error.code, error.message);
        deps.log('ERROR', 'unexpected AI route error', { path });
        return fail(c, 500, 'INTERNAL', 'Something went wrong.');
      }
    });
  }

  aiRoute('/api/intake', {
    request: IntakeRequestSchema,
    output: IntakeExtractSchema,
    system: SYSTEM.intake,
    prompt: (body) => PROMPT.intake(body.text, body.today),
    finish: (data, body) => ({
      ...data,
      eventDate: data.eventDate && data.eventDate >= body.today ? data.eventDate : null,
    }),
  });
  aiRoute('/api/change', {
    request: ChangeRequestSchema,
    output: ChangeExtractSchema,
    system: SYSTEM.change,
    prompt: (body) => PROMPT.change(body.text, body.today, body.current),
  });
  aiRoute('/api/quote', {
    request: QuoteRequestSchema,
    output: QuoteExtractSchema,
    system: SYSTEM.quote,
    prompt: (body) => PROMPT.quote(body.text, body.category),
  });
  aiRoute('/api/ideas', {
    request: IdeasRequestSchema,
    output: IdeasSchema,
    system: SYSTEM.ideas,
    prompt: (body) => PROMPT.ideas(body),
  });
  aiRoute('/api/ask', {
    request: AskRequestSchema,
    output: AnswerSchema,
    system: SYSTEM.ask,
    prompt: (body) => PROMPT.ask(body.question, body.facts, body.history),
  });
  aiRoute('/api/explain', {
    request: ExplainRequestSchema,
    output: ExplanationSchema,
    system: SYSTEM.explain,
    prompt: (body) => PROMPT.explain(body.facts, body.changes, body.options),
  });

  app.all('/api/*', (c) =>
    paths.has(c.req.path) || c.req.path === '/api/health'
      ? fail(c, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.')
      : fail(c, 404, 'NOT_FOUND', 'No such endpoint.'),
  );
  return app;
}
