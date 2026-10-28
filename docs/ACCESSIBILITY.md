# Accessibility

Target: **WCAG 2.2 AA**. How it is checked:

- **Real browser:** Playwright runs axe-core (WCAG 2.0/2.1/2.2 A and AA rules, colour contrast **on**) on the start screen and
  on every tab of a built plan, in **light and dark**, on desktop Chrome and a Pixel 7 profile: **0 violations**.
- **Component tests:** axe-core runs inside the Vitest UI tests after key interactions (forms with errors, previews, options,
  quotes).
- **Token contrast:** a unit test reads the real colour tokens from `tokens.css` and `app.css` for each theme and checks that
  every text and background pair the UI uses is at least 4.5:1. It caught one real failure (light-theme blue on its tint,
  4.46:1), fixed by darkening the light primary to `#1d4ed8`.
- **Layout:** an end-to-end test asserts there is no horizontal scroll on any screen at phone width.

## What is built in

- `lang="en-IN"`, with `lang="hi"` on Devanagari text; a skip link; `header`, `main` and `footer` landmarks.
- When a plan is created, focus moves to its title. Form errors appear in a summary that takes focus and links to each field;
  fields get `aria-invalid` and `aria-describedby` for hints and errors.
- Tabs follow the WAI-ARIA tabs pattern: roving `tabindex`, arrow keys, Home and End.
- AI results, answers and change notes are announced through `aria-live` regions.
- Status is always **text plus a symbol** (✓ ! ✕), never colour alone.
- Tables have captions and `th scope`; under 640 px they become stacked cards with labels.
- Touch targets are at least 44 px; every input has a visible label; focus rings are visible in both themes.
- `prefers-reduced-motion`, `prefers-contrast: more` and forced-colours mode are respected.
- Links that open a new tab say so to screen readers.
