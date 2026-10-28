import { useCallback, useEffect, useRef, useState } from 'react';
import type * as z from 'zod/mini';
import { callAi, type AiResult } from './api';

export interface AiState<T> {
  loading: boolean;
  result: AiResult<T> | null;
}

/**
 * Runs one AI request at a time for a panel. Starting a new request cancels
 * the previous one, and leaving the panel cancels whatever is in flight.
 */
export function useAi<T>(path: string, schema: z.ZodMiniType<T>) {
  const [state, setState] = useState<AiState<T>>({ loading: false, result: null });
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const run = useCallback(
    async (body: unknown): Promise<AiResult<T>> => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setState({ loading: true, result: null });
      const result = await callAi(path, body, schema, current.signal);
      if (!current.signal.aborted) setState({ loading: false, result });
      return result;
    },
    [path, schema],
  );

  const reset = useCallback(() => {
    controller.current?.abort();
    setState({ loading: false, result: null });
  }, []);

  return { ...state, run, reset };
}
