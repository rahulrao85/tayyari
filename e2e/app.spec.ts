import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WEDDING = {
  occasion: 'wedding',
  title: 'Priya weds Arjun',
  eventDate: '2027-02-15',
  budget: 800000,
  guests: 200,
  priorities: ['catering'],
  vibe: 'Simple ceremony',
  mustHaves: [],
  guestMix: { kids: false, elders: true, accessibility: false },
  dietary: ['Vegetarian'],
  followUp: 'Will any elders need step-free access?',
};

const CHANGE = {
  budget: { mode: 'delta', amount: -50000 },
  guests: null,
  date: { mode: 'shift', days: -14 },
  priorities: null,
  summary: 'Reduce the budget by ₹50,000 and move the event two weeks earlier.',
};

const reply = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ data, model: 'gemini-3.5-flash', cached: false }),
});

/** Watches for any console error or CSP violation on the page. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function buildWeddingPlan(page: Page) {
  await page.route('/api/intake', (route) => route.fulfill(reply(WEDDING)));
  await page.goto('/');
  await page.getByRole('button', { name: 'Try: Wedding' }).click();
  await page.getByRole('button', { name: 'Read my description' }).click();
  await expect(page.getByText('Will any elders need step-free access?')).toBeVisible();
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Priya weds Arjun' })).toBeFocused();
}

test('serves the production build under a strict CSP with no console errors', async ({ page }) => {
  const errors = trackErrors(page);
  const response = await page.goto('/');
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain('unsafe-inline');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Plan the celebration');
  await buildWeddingPlan(page);
  for (const tab of ['Change desk', 'Budget', 'Timeline', 'Vendors', 'Ideas', 'Overview']) {
    await page.getByRole('tab', { name: tab }).click();
  }
  expect(errors).toEqual([]);
});

test('the explainer test: ₹50k less and two weeks earlier revises the plan, then undo restores it', async ({
  page,
}) => {
  await page.route('/api/change', (route) => route.fulfill(reply(CHANGE)));
  await buildWeddingPlan(page);
  await page.getByRole('tab', { name: 'Change desk' }).click();
  await page
    .getByRole('button', { name: 'Budget is ₹50k less and the event is 2 weeks earlier' })
    .click();
  await page.getByRole('button', { name: 'Preview the change' }).click();
  const table = page.getByRole('table', { name: 'Before and after' });
  await expect(table.getByText('₹7,50,000')).toBeVisible();
  await expect(table.getByText('01-Feb-2027')).toBeVisible();
  await page.getByRole('button', { name: 'Apply this option' }).nth(1).click();
  await page.getByRole('button', { name: 'Accept this version' }).click();
  await expect(page.getByText('₹7.5 L')).toBeVisible();
  await page.getByRole('button', { name: 'Undo last change' }).first().click();
  await expect(page.getByText('₹8 L')).toBeVisible();
});

test('works with AI unavailable: built-in reader, planner and parser', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Describe your celebration')
    .fill('Birthday for 30 kids, budget 40k, on 20 December 2026');
  await page.getByRole('button', { name: 'Read my description' }).click();
  await expect(page.getByText(/Built-in planner answered/)).toBeVisible();
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await page.getByRole('button', { name: 'Kitna kharcha bacha hai?' }).click();
  await expect(page.getByText('Built-in planner (AI unavailable)')).toBeVisible();
  await page.getByRole('tab', { name: 'Change desk' }).click();
  await page.getByLabel('What changed?').fill('10 more guests');
  await page.getByRole('button', { name: 'Preview the change' }).click();
  await expect(page.getByText('Read by the built-in parser')).toBeVisible();
});

test('the plan survives a reload', async ({ page }) => {
  await buildWeddingPlan(page);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Priya weds Arjun' })).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`every screen has zero axe violations, including colour contrast (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    const scan = async () => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map(
          (violation) => `${violation.id}: ${violation.nodes[0]?.target.join(' ') ?? ''}`,
        ),
      ).toEqual([]);
    };
    await scan();
    await buildWeddingPlan(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    for (const tab of ['Overview', 'Change desk', 'Budget', 'Timeline', 'Vendors', 'Ideas']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: tab === 'Overview' ? 'What needs you now' : tab,
        }),
      ).toBeVisible();
      await scan();
    }
  });
}

test('no horizontal scroll on any screen', async ({ page }) => {
  const noOverflow = async () => {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  };
  await page.goto('/');
  await noOverflow();
  await buildWeddingPlan(page);
  for (const tab of ['Overview', 'Change desk', 'Budget', 'Timeline', 'Vendors', 'Ideas']) {
    await page.getByRole('tab', { name: tab }).click();
    await noOverflow();
  }
});
