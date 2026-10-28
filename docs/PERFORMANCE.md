# Efficiency

Measured on the production build (`npm run build`).

| What                  | Result                                                                             |
| --------------------- | ---------------------------------------------------------------------------------- |
| First-load JavaScript | **93.7 kB gzipped** (budget 100 kB, enforced in CI by `scripts/bundle-budget.mjs`) |
| Lazy-loaded tabs      | Change desk, Vendors and Ideas load on demand (about 8 kB gzipped together)        |
| CSS                   | 4.7 kB gzipped                                                                     |
| Web fonts             | none (system font stack)                                                           |
| Engine recalculation  | synchronous; the plan renders before any AI reply                                  |

## Techniques

- **No model call for maths.** Budgets, timelines, diffs, options and insights are pure functions, so the UI never waits for
  AI to show numbers, and AI cost is spent only on language.
- **zod/mini** instead of the full zod API: the same validation, tree-shakable (about 6 kB gzipped instead of about 90 kB in
  our measurement).
- **Precompressed assets:** the build writes Brotli (quality 11) and gzip copies; the server picks one from
  `Accept-Encoding` with no compression at request time. Hashed assets are served with
  `Cache-Control: public, max-age=31536000, immutable`.
- **AI cache:** identical validated requests within 10 minutes are answered from a bounded in-memory cache (`X-Cache: HIT`).
- **Cancellation:** a new AI request in a panel aborts the previous one, and leaving the panel aborts in-flight work; the
  server passes the request's abort signal to the model call.
- **Failover with cooldowns:** a slow or failing model is skipped for a minute instead of being retried on every request.
- **Low thinking level** and bounded output tokens on every Gemini call; typical replies take 2–3 s.
- **Commit on blur or Enter** for amount and delay inputs, so typing does not create a version per keystroke.
