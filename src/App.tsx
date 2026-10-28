import { useState } from 'react';
import { PlanView } from './components/plan/PlanView';
import { StartScreen } from './components/start/StartScreen';
import { applyTheme, currentTheme, type Theme } from './lib/theme';
import { PlanProvider, usePlanStore } from './state/PlanContext';
import type { PlanState } from './state/store';

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    />
  );
}

function Shell() {
  const { state } = usePlanStore();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Tayyari home">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>Tayyari</span>
          <span className="brand-sub" lang="hi">
            तैयारी
          </span>
        </a>
        <ThemeToggle />
      </header>
      <main id="main" tabIndex={-1} className="container-narrow">
        {state.plan ? <PlanView /> : <StartScreen />}
      </main>
      <p className="sr-only" role="status" aria-live="polite">
        {state.notice}
      </p>
      <footer className="site-footer">
        <p>
          Amounts are planning estimates unless marked <strong>Quoted</strong>. Tayyari never books
          vendors, confirms prices or claims availability. Your plan stays in this browser.
        </p>
      </footer>
    </>
  );
}

/** Root component. `today` is passed in so the whole app (and its tests) agree on the date. */
export function App({ today, initial }: { today: string; initial?: PlanState }) {
  return (
    <PlanProvider today={today} initial={initial}>
      <Shell />
    </PlanProvider>
  );
}
