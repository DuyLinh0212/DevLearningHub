import { Locator } from '@playwright/test';

// Options are usually populated by an async API call after the <select> itself renders, so a
// naive immediate count() often races the network and sees only the placeholder. Wait for a
// second option (index 1, the first real one) to attach before giving up.
export async function selectFirstRealOption(selectLocator: Locator, timeoutMs = 15000) {
  try {
    await selectLocator.locator('option').nth(1).waitFor({ state: 'attached', timeout: timeoutMs });
  } catch {
    throw new Error('Dropdown has no real options beyond the placeholder');
  }
  await selectLocator.selectOption({ index: 1 });
}
