import { Page } from '@playwright/test';

export async function gotoRoute(page: Page, baseUrl: string, routePath: string) {
  await page.goto(baseUrl + routePath);
}

export async function clickFirstListItemAndCapture(page: Page, selector: string, timeoutMs = 10000) {
  const el = page.locator(selector).first();
  await el.waitFor({ timeout: timeoutMs });
  await el.click();
  await page.waitForTimeout(500);
  return page.url();
}
