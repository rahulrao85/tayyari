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

/**
 * Tries each model in order. A model that times out, is overloaded or out of
 * quota is set aside for a cooldown so later requests skip straight past it.
 * Output is parsed as JSON and validated against the zod schema; invalid
 * output is never returned.
 */
export function createModelChain(options: ChainOptions): ModelClient {
  const { models, call, log, timeoutMs = 20_000, cooldownMs = 60_000, now = Date.now } = options;
  const resting = new Map<string, number>();

  return {
    async generate<T>(request: ModelRequest<T>) {
      const jsonSchema = z.toJSONSchema(request.schema, { target: 'draft-7' });
      const ready = models.filter((model) => (resting.get(model) ?? 0) <= now());
      const order = ready.length > 0 ? ready : models;
      let last: ModelError = new ModelError('AI_UNAVAILABLE', 'No model configured');
      for (const model of order) {
        if (request.signal?.aborted) throw new ModelError('AI_TIMEOUT', 'Request cancelled');
        const signals = [
          AbortSignal.timeout(timeoutMs),
          ...(request.signal ? [request.signal] : []),
        ];
        try {
          const text = await call(model, request, jsonSchema, AbortSignal.any(signals));
          const parsed = request.schema.safeParse(JSON.parse(text));
          if (parsed.success) return { data: parsed.data, model };
          last = new ModelError('AI_RESPONSE_INVALID', 'Model output did not match the schema');
          log('WARNING', 'model output invalid', { model });
        } catch (error) {
          if (request.signal?.aborted) throw new ModelError('AI_TIMEOUT', 'Request cancelled');
          const timedOut =
            error instanceof Error &&
            (error.name === 'TimeoutError' || error.name === 'AbortError');
          last = timedOut
            ? new ModelError('AI_TIMEOUT', 'Model did not answer in time')
            : error instanceof SyntaxError
              ? new ModelError('AI_RESPONSE_INVALID', 'Model output was not JSON')
              : new ModelError('AI_UNAVAILABLE', 'Model call failed');
          if (last.code !== 'AI_RESPONSE_INVALID') resting.set(model, now() + cooldownMs);
          log('WARNING', 'model call failed', { model, code: last.code });
        }
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
