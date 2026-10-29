import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import * as z from 'zod/mini';
import type { Logger } from './log';

/** Why a model call failed, mapped to an HTTP status by the routes. */
export type ModelErrorCode = 'AI_UNAVAILABLE' | 'AI_RESPONSE_INVALID' | 'AI_TIMEOUT';

export class ModelError extends Error {
  constructor(
    readonly code: ModelErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

/** One structured-output request. */
export interface ModelRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodMiniType<T>;
  signal?: AbortSignal;
}

/** Anything that can turn a prompt into schema-valid data. Gemini in production, a fake in tests. */
export interface ModelClient {
  generate<T>(request: ModelRequest<T>): Promise<{ data: T; model: string }>;
}

/** The raw call to one model; injected so the failover logic is testable without a network. */
export type CallModel = (
  model: string,
  request: ModelRequest<unknown>,
  jsonSchema: unknown,
  signal: AbortSignal,
) => Promise<string>;

export interface ChainOptions {
  models: readonly string[];
  call: CallModel;
  timeoutMs?: number;
  cooldownMs?: number;
  log: Logger;
  now?: () => number;
}

/** Default per-call timeout and how long a failing model is skipped. */
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_COOLDOWN_MS = 60_000;

const cancelled = () => new ModelError('AI_TIMEOUT', 'Request cancelled');

/** Maps a thrown error from one model call to a stable error code. */
function toModelError(error: unknown): ModelError {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return new ModelError('AI_TIMEOUT', 'Model did not answer in time');
  }
  if (error instanceof SyntaxError) {
    return new ModelError('AI_RESPONSE_INVALID', 'Model output was not JSON');
  }
  return new ModelError('AI_UNAVAILABLE', 'Model call failed');
}

/** Combines the per-call timeout with the caller's own abort signal, if any. */
function callSignal(timeoutMs: number, caller: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return caller ? AbortSignal.any([timeout, caller]) : timeout;
}

/**
 * Tries each model in order. A model that times out, is overloaded or out of
 * quota is set aside for a cooldown so later requests skip straight past it.
 * Output is parsed as JSON and validated against the zod schema; invalid
 * output is never returned.
 */
export function createModelChain(options: ChainOptions): ModelClient {
  const {
    models,
    call,
    log,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    now = Date.now,
  } = options;
  const resting = new Map<string, number>();

  /** Models not cooling down; if every model is resting, try them all anyway. */
  function candidates(): readonly string[] {
    const ready = models.filter((model) => (resting.get(model) ?? 0) <= now());
    return ready.length > 0 ? ready : models;
  }

  /** One call to one model: the valid data, or the error that explains why not. */
  async function attempt<T>(
    model: string,
    request: ModelRequest<T>,
    jsonSchema: unknown,
  ): Promise<{ data: T } | { error: ModelError }> {
    try {
      const text = await call(model, request, jsonSchema, callSignal(timeoutMs, request.signal));
      const parsed = request.schema.safeParse(JSON.parse(text));
      if (parsed.success) return { data: parsed.data };
      return {
        error: new ModelError('AI_RESPONSE_INVALID', 'Model output did not match the schema'),
      };
    } catch (error) {
      if (request.signal?.aborted) throw cancelled();
      const failure = toModelError(error);
      if (failure.code !== 'AI_RESPONSE_INVALID') resting.set(model, now() + cooldownMs);
      return { error: failure };
    }
  }

  return {
    async generate<T>(request: ModelRequest<T>) {
      const jsonSchema = z.toJSONSchema(request.schema, { target: 'draft-7' });
      let last = new ModelError('AI_UNAVAILABLE', 'No model configured');
      for (const model of candidates()) {
        if (request.signal?.aborted) throw cancelled();
        const outcome = await attempt(model, request, jsonSchema);
        if ('data' in outcome) return { data: outcome.data, model };
        last = outcome.error;
        log('WARNING', 'model call failed', { model, code: last.code });
      }
      throw last;
    },
  };
}

/**
 * Default chain, picked by a live latency and schema-validity sweep against
 * the key (see docs/ARCHITECTURE.md). Override with GEMINI_MODELS.
 */
export const DEFAULT_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
];

/** The real call to Gemini through the official SDK, in JSON mode with a schema. */
export function geminiCaller(apiKey: string): CallModel {
  const ai = new GoogleGenAI({ apiKey });
  return async (model, request, jsonSchema, signal) => {
    const response = await ai.models.generateContent({
      model,
      contents: request.prompt,
      config: {
        systemInstruction: request.system,
        responseMimeType: 'application/json',
        responseJsonSchema: jsonSchema,
        temperature: 0.4,
        maxOutputTokens: 2048,
        abortSignal: signal,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const text = response.text;
    if (!text) throw new Error('Empty model response');
    return text;
  };
}
