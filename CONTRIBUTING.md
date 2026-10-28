# Contributing

1. `npm ci`
2. Keep business logic in `src/engine` as pure functions with tests; components only render and dispatch.
3. Before pushing: `npm run check`, then `npm run build && npm run e2e`.
4. Files stay under 250 lines; no `any`; no new dependency when a few lines of code will do.
