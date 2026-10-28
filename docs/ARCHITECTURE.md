# Architecture

## Principle

**The AI suggests; the code decides.** Gemini turns words into structure (a description into fields, a change request into
a change set, a pasted quote into fields) and writes language (ideas, answers, explanations). Every rupee and every date is
computed by small pure functions in `src/engine`, which never call the model and never read the clock (`today` is passed in).

## Layers

```text
src/
  engine/        pure TypeScript: no React, no network, no Date.now()
    money.ts       INR formatting and parsing ("8 lakh", "50k", "₹8,00,000"), largest-remainder rounding
    budget.ts      allocate, setLineAmount, rescaleBudget, locks, shortfalls, overBy
    timeline.ts    topoSort, buildSchedule (compression + delay propagation), task status
    changes.ts     applyChangeSet, diffPlans: the Change Desk core
    tradeoffs.ts   overBudgetOptions: trim / contingency / guests / raise, each with its exact effect
    quotes.ts      effectiveCost (minimums, GST), flags, comparison, follow-up message
    intake.ts      rule-based description reader, missing-question list, draft merging
    parse.ts       dates ("mid-Feb", "15 March 2027", "in 3 weeks"), counts, durations
    parseChange.ts rule-based change reader, used when AI is unavailable
    insights.ts    ranked "what needs you now"
    facts.ts       the only facts the AI may use, and the built-in answerer
    calendar.ts    RFC 5545 .ics export and Google Calendar links
    data/          presets: budget splits, task templates, vendors, run sheets, fallback ideas
  schemas/       zod/mini schemas shared by browser, server and tests (plan.ts, api.ts)
  state/         reducer with versions and undo; validated localStorage autosave
  lib/           typed API client (validates replies again), useAi hook (cancels stale calls), theme
  components/    UI only: renders and dispatches, never computes money or dates
server/
  app.ts         Hono app: headers → guards → validate → cache → model → validate → respond
  http.ts        CSP and security headers, same-origin, JSON-only, body cap, rate limit, logging
  model.ts       ModelClient interface, failover chain with cooldowns, Gemini caller
  prompts.ts     system prompts and nonce-fenced user data
  store.ts       bounded TTL cache and rate limiter
  main.ts        production entry: API + precompressed static files
```

## Data flow of a change

1. The family types _"Budget is ₹50k less and the event is 2 weeks earlier"_.
2. `POST /api/change`: Gemini returns `{ budget: { mode: "delta", amount: -50000 }, date: { mode: "shift", days: -14 } }`,
   validated by `ChangeExtractSchema`. If AI fails or finds nothing, `parseChangeText` reads the same sentence with rules.
3. `applyChangeSet` rescales unlocked lines (locked lines and accepted quotes never move) and shifts the date.
4. `diffPlans` rebuilds both schedules and lists every budget line and task that moved, plus new problems.
5. If `overBy > 0`, `overBudgetOptions` offers exact alternatives; the family may apply one inside the preview.
6. **Accept** pushes the previous plan onto the version history (max 20) and saves; **Undo** restores it.

## The budget invariant

All amounts are integer rupees. `largestRemainder` guarantees the category amounts always sum to exactly the total; this is
property-tested for random budgets, occasions and priorities.

## The timeline

Each occasion has 12–13 task templates with lead times and dependencies (a dependency always has a longer lead time; tested).
When the event is closer than the longest lead time **on the day the plan is made**, every lead time is scaled by the same
factor, so the plan starts that day and keeps its order. Status is judged against today, so tasks become overdue as days
pass. A property test checks that a fresh compressed plan is never overdue, impossible or out of order for every occasion and
every runway from 0 to 400 days. Delays push dependants by their original gap and record which task caused the push.

## Model choice

A sweep on 28-Oct-2026 sent the same intake request, with an injected instruction, to each model available to the key:

| Model                                   | Time      | Schema-valid         | Ignored the injection |
| --------------------------------------- | --------- | -------------------- | --------------------- |
| gemini-3.5-flash                        | 2.5 s     | yes                  | yes                   |
| gemini-3-flash-preview                  | 2.2 s     | yes                  | yes                   |
| gemini-3.1-flash-lite                   | 2.2 s     | yes                  | yes                   |
| gemini-3.6 / 3.7 / 3.8-flash            | 3.1–4.7 s | yes                  | yes                   |
| gemini-2.5-flash, gemini-2.5-flash-lite | —         | rejected by this key | —                     |

The default chain is the first three; `GEMINI_MODELS` overrides it.
