import { Page } from '@playwright/test';

// Playwright's dialog model is push-based (an event fires when a native
// alert/confirm appears), unlike Selenium's poll-after-click model. So these
// handlers must be registered BEFORE the action that triggers the dialog.

export function acceptNextDialog(page: Page) {
  page.once('dialog', (d) => d.accept());
}

export function dismissNextDialog(page: Page) {
  page.once('dialog', (d) => d.dismiss());
}

// Stacks `count` one-shot accept handlers up front. Node's EventEmitter
// invokes `once` listeners in registration order, one per emission — this
// reproduces the confirm()-then-alert() double-dialog sequence exactly.
export function acceptDialogSequence(page: Page, count: number) {
  let handled = 0;
  const handler = (d: import('@playwright/test').Dialog) => {
    d.accept().catch(() => {});
    handled++;
    if (handled >= count) {
      page.off('dialog', handler);
    }
  };
  page.on('dialog', handler);
}
