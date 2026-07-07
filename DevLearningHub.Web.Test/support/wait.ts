import { Page } from '@playwright/test';

export const DEFAULT_TIMEOUT = 10000;

export async function waitForUrlContains(page: Page, text: string, timeout = DEFAULT_TIMEOUT) {
  await page.waitForURL((url) => url.toString().includes(text), { timeout });
}

export async function waitForUrlDoesNotContain(page: Page, text: string, timeout = DEFAULT_TIMEOUT) {
  await page.waitForURL((url) => !url.toString().includes(text), { timeout });
}
