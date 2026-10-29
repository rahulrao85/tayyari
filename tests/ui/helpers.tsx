import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { expect, vi } from 'vitest';
import { App } from '../../src/App';
import type { Plan } from '../../src/schemas/plan';
import { INITIAL_STATE, type PlanState } from '../../src/state/store';
import { TODAY, weddingPlan } from '../helpers';

interface Reply {
  status: number;
  json: unknown;
}
type Handler = Reply | ((body: unknown) => Reply);

/** A successful AI reply envelope. */
export const ok = (data: unknown, model = 'gemini-3.5-flash'): Reply => ({
  status: 200,
  json: { data, model, cached: false },
});

/** An error reply envelope. */
export const fail = (status = 503, code = 'AI_UNAVAILABLE'): Reply => ({
  status,
  json: { error: { code, message: 'AI is down' } },
});

/** Stubs `fetch` with a handler per API path; unknown paths answer 503. */
export function mockApi(handlers: Record<string, Handler> = {}) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const handler = handlers[url];
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    const reply = typeof handler === 'function' ? handler(body) : (handler ?? fail());
    return Promise.resolve(new Response(JSON.stringify(reply.json), { status: reply.status }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Renders the whole app, optionally with a plan already loaded. */
export function renderApp(plan?: Plan, extra: Partial<PlanState> = {}) {
  const initial: PlanState = plan ? { ...INITIAL_STATE, plan, ...extra } : INITIAL_STATE;
  const user = userEvent.setup();
  const view = render(<App today={TODAY} initial={initial} />);
  return { user, ...view };
}

/** Renders with Priya's wedding plan loaded. */
export function renderPlan(overrides: Partial<Plan> = {}, extra: Partial<PlanState> = {}) {
  return renderApp({ ...weddingPlan(), ...overrides }, extra);
}

/** Runs axe-core on the rendered page. Colour contrast is checked separately on the real tokens. */
export async function expectAccessible(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}
