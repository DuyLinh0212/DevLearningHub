import { Locator } from '@playwright/test';

export async function selectFirstRealOption(selectLocator: Locator) {
  const optionCount = await selectLocator.locator('option').count();
  if (optionCount < 2) {
    throw new Error('Dropdown has no real options beyond the placeholder');
  }
  await selectLocator.selectOption({ index: 1 });
}
