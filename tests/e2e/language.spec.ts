import { expect, test } from '@playwright/test';

import { buildApp } from '../../apps/server/src/main.js';

const CHINESE_PATTERN = /[\u3400-\u9fff]/;
let app: Awaited<ReturnType<typeof buildApp>>;

test.beforeAll(async () => {
  app = await buildApp();
  await app.listen({ port: 3000, host: '127.0.0.1' });
});

test.afterAll(async () => {
  await app.close();
});

test('EN｜ZH switches all visible welcome and player-join copy', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'EN' }).click();

  await expect(
    page.getByRole('heading', { name: 'Trouble Brewing' }),
  ).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(CHINESE_PATTERN);

  await page.getByRole('button', { name: 'ZH' }).click();
  await expect(page.getByRole('heading', { name: '暗流涌动' })).toBeVisible();

  await page.goto('/?room=TB-I18N&player=1', {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: 'EN' }).click();

  await expect(
    page.getByRole('heading', { name: 'Join the Clocktower' }),
  ).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(CHINESE_PATTERN);
});

test('English mode remains responsive while loading a 7-player setup', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('clocktower:language', 'en');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page
    .locator('.create-room input')
    .fill(`E2E-I18N-${testInfo.project.name}`);
  await page.getByRole('button', { name: 'Create Multiplayer Room' }).click();

  await expect(page.getByRole('heading', { name: 'Live Room' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Fill to a 7-player test setup' })
    .click();
  await expect(page.locator('.mp-roster article')).toHaveCount(7);

  await page.getByRole('button', { name: 'Characters R' }).click();
  await expect(
    page.getByRole('heading', { name: 'Character Reference' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
});
