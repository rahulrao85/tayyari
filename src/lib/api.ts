import * as z from 'zod/mini';
import { ERROR_CODES, type ErrorCode } from '../schemas/api';

/** Result of an AI call. It never throws, so every caller handles failure explicitly. */
export type AiResult<T> =
  | { ok: true; data: T; model: string; cached: boolean }
  | { ok: false; code: ErrorCode | 'NETWORK' | 'CANCELLED'; message: string };

const ErrorSchema = z.object({
  error: z.object({ code: z.enum(ERROR_CODES), message: z.string() }),
});

/**
 * POSTs to one of our `/api/*` routes and validates the reply again in the
 * browser, so raw model text can never reach the UI.
 */
export async function callAi<T>(
  path: string,
  body: unknown,
  schema: z.ZodMiniType<T>,
  signal?: AbortSignal,
): Promise<AiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal?.aborted) return { ok: false, code: 'CANCELLED', message: 'Cancelled.' };
    return { ok: false, code: 'NETWORK', message: 'Could not reach the server.' };
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ErrorSchema.safeParse(payload);
    return parsed.success
      ? { ok: false, ...parsed.data.error }
      : { ok: false, code: 'INTERNAL', message: 'Something went wrong.' };
  }
  const envelope = z
    .object({ data: schema, model: z.string().check(z.maxLength(80)), cached: z.boolean() })
    .safeParse(payload);
  if (!envelope.success)
    return { ok: false, code: 'AI_RESPONSE_INVALID', message: 'The reply was not usable.' };
  return { ok: true, ...envelope.data };
}

/** Readable model name: `gemini-3.5-flash` → `Gemini 3.5 Flash`. */
export function modelLabel(model: string): string {
  return model
    .split('-')
    .map((part) => (part.length > 0 ? `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}` : part))
    .join(' ');
}
