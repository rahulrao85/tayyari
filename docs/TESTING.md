# Testing

**203 unit, component and API tests** (Vitest) and **14 end-to-end runs** (Playwright: 7 scenarios × desktop Chrome and a
Pixel 7 profile). CI runs all of them on every push, plus format, types, lint, dead-code and bundle-size checks.

```bash
npm run check              # typecheck + lint + format + all Vitest suites with coverage thresholds
npm run build && npm run e2e
```

## Coverage (whole app: `src/` and `server/`)

| Lines | Statements | Functions | Branches |
| ----- | ---------- | --------- | -------- |
| 99.7% | 99.2%      | 99.0%     | 93.7%    |

CI fails below 99% lines, 98% statements, 98% functions or 92% branches, set just under what the suite really achieves so the
gate always passes on a healthy build (a lesson from a past challenge where an aspirational threshold failed CI).

## Suites

| Suite                     | Tests | What it proves                                                                                                                                                                                                                                                                                      |
| ------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/money-dates`      | 21    | INR parsing ("8 lakh", "2cr", "₹8,00,000"), Indian formatting, date maths across months and leap years; **property test:** largest-remainder parts always sum to the total                                                                                                                          |
| `engine/budget`           | 15    | exact allocation with priorities and 10% buffer (**property test** over random budgets, occasions, priorities); redistribution respects locks; budget rescale; shortfalls from guests or accepted quotes                                                                                            |
| `engine/timeline`         | 13    | templates acyclic with dependencies always earlier; compression; **property test:** a fresh compressed plan is never overdue, impossible or out of order for runways 0–400 days; delay propagation with reasons; statuses as time passes                                                            |
| `engine/changes`          | 29    | **the explainer test** (₹50k less, two weeks earlier) revises without restarting; locks block impossible budgets; the before/after diff; the rule-based change reader on 20 phrasings                                                                                                               |
| `engine/quotes-tradeoffs` | 11    | real cost with guest minimums and GST; flags; comparison; one accepted quote per category; follow-up drafts; all four over-budget options close the gap exactly, or report what is left                                                                                                             |
| `engine/intake`           | 17    | the description reader for weddings, birthdays and pujas; dates like "mid-Feb" and "in two months"; only missing questions are asked; AI and rule drafts merge safely                                                                                                                               |
| `engine/insights-facts`   | 13    | ranked insights; grounded facts; the built-in answerer; RFC 5545 escaping and line folding; Google Calendar links; fallback ideas                                                                                                                                                                   |
| `server/app`              | 15    | security headers and CSP; 403 other origins; 415, 413 (declared and actual size), 400 without echoing input; 405/404; per-client 429 with `Retry-After`; nonce fencing; cache HIT/MISS; past dates dropped; every route; model errors map to 503/502/504; unknown errors return 500 without details |
| `server/model`            | 13    | failover and cooldown; invalid JSON and schema-invalid output rejected; timeouts; client cancellation; the Gemini call uses JSON mode, the schema and low thinking (SDK mocked); prompts never place user text outside a fence; bounded cache and limiter; structured logs                          |
| `ui/start`                | 5     | describe → Gemini intake → follow-up → plan, with axe; AI-down fallback; the error summary takes focus; form validation                                                                                                                                                                             |
| `ui/plan`                 | 11    | tabs with arrow keys, Home and End, axe on every tab; insight links; theme toggle; Hinglish answers and the fallback; budget edits, locks and caps; over-budget options and explanations; timeline delays and .ics export; ideas and their fallback                                                 |
| `ui/changes-vendors`      | 7     | the Change Desk end to end with an option applied, accept and undo; parser fallback; blocked and empty changes; quote extraction, flags, accept, copy and remove; manual quote entry                                                                                                                |
| `ui/lib`                  | 33    | API client error mapping and cancellation; reducer, versions and undo; tampered or blocked storage; **colour contrast of the real tokens in both themes (24 pairs)**; required docs exist                                                                                                           |

## End to end (`e2e/app.spec.ts`, real Chromium against the production server)

- The production build under the real CSP: no console errors on any tab.
- The explainer test in a real browser, including accept and undo.
- Gemini unavailable (no key): the built-in reader, planner and parser keep the app working.
- The plan survives a reload.
- **axe-core with colour contrast on every screen, in light and dark: 0 violations.**
- No horizontal scroll on any screen.

AI replies in e2e are intercepted in the browser, so no key is needed and runs are deterministic.
