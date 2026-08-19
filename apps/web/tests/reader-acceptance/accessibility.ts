import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

/** Fails when Axe finds a serious or critical issue on the current Reader page. */
export async function expectNoBlockingAccessibilityViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact !== null &&
      violation.impact !== undefined &&
      BLOCKING_IMPACTS.has(violation.impact),
  );
  const details = blocking
    .map(
      (violation) =>
        `${violation.impact}: ${violation.id} — ${violation.help} (${violation.nodes
          .flatMap((node) => node.target)
          .join(', ')})`,
    )
    .join('\n');

  expect(blocking, details || 'Axe serious/critical Reader accessibility scan').toEqual([]);
}
