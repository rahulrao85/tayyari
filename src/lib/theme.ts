export type Theme = 'light' | 'dark';

const KEY = 'tayyari-theme';

/** The theme currently applied to the page. */
export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Applies a theme and remembers it in this browser. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked: the theme still applies for this visit */
  }
}
