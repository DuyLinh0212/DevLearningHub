import { Page } from '@playwright/test';
import { waitForUrlDoesNotContain } from './wait';
import env from '../config/env';

export async function fillLoginForm(page: Page, baseUrl: string, username?: string, password?: string) {
  await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('input[name="usernameOrEmail"]').waitFor();
  await page.locator('input[name="usernameOrEmail"]').fill(username || '');
  await page.locator('input[name="password"]').fill(password || '');
  await page.locator('button.btn-submit').click();
  await waitForUrlDoesNotContain(page, '/login', 45000);
}

export async function loginAsAdmin(page: Page) {
  await fillLoginForm(page, env.ADMIN_URL, env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
}

export async function loginAsUser(page: Page) {
  await fillLoginForm(page, env.USER_URL, env.USER_USERNAME, env.USER_PASSWORD);
}

export async function loginAs(page: Page, baseUrl: string, username: string, password: string) {
  await fillLoginForm(page, baseUrl, username, password);
}
