import { Page } from '@playwright/test';

// Playwright auto-detects a leading `//` as XPath, so these selector strings
// work unchanged from the old By.xpath(...) versions.

export function tabByLabel(label: string) {
  return `//button[contains(@class,'mq-tab')][.//span[contains(text(),"${label}")]]`;
}

export function chipByLabel(label: string) {
  return `//button[contains(@class,'mq-chip')][contains(text(),"${label}")]`;
}

export function cardByTitle(title: string) {
  return `.mq-card:has(.mq-card-title:has-text("${title}"))`;
}

export async function openPendingTab(page: Page, adminUrl: string, tabLabel: string) {
  await page.goto(adminUrl + '/admin/moderation');
  await page.locator('.mq-tab').first().waitFor();
  await page.locator(tabByLabel(tabLabel)).click();
  await page.waitForTimeout(300);
  // Hardcoded label, kept as-is from the original (faithful port, not a fix).
  await page.locator(chipByLabel('Chờ duyệt')).click();
  await page.waitForTimeout(300);
}

export async function approveItem(page: Page, adminUrl: string, tabLabel: string, title: string) {
  await openPendingTab(page, adminUrl, tabLabel);
  const card = page.locator(cardByTitle(title));
  await card.waitFor();
  await card.locator('button.btn-approve').click();
  await page.locator('.mq-modal-overlay').waitFor();
  await page.locator('.mq-modal-actions button.btn-approve').click();
  await page.waitForTimeout(500);
}
