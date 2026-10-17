import { test, expect } from '@playwright/test';

test.describe('Moduł Logowania', () => {

  test('powinien pomyślnie zalogować użytkownika i przekierować na pulpit a następnie wylogować', async ({ page }) => {

    await page.goto('http://localhost:5173/login');

    await page.fill('input[type="text"], input[name="username"], input[type="email"]', 'test1');
    await page.fill('input[type="password"]', 'Zaq12wsx');

    await page.click('button[type="submit"]');

    await expect(page.locator('h1')).toContainText('Dzień dobry');
    await expect(page.locator('a').first()).toContainText('Strona Główna');

    await page.click('button[id="logout-button"]');
    await expect(page.locator('h1')).toContainText('Zaloguj się');
  });

  test('powinien wyświetlić błąd przy błędnych danych logowania', async ({ page }) => {

    await page.goto('http://localhost:5173/login');

    await page.fill('input[type="text"], input[name="username"], input[type="email"]', 'zly_user');
    await page.fill('input[type="password"]', 'zle_haslo');

    await page.click('button[type="submit"]');

    await expect(page.locator('.text-red-500, [role="alert"]')).toBeVisible();
  });

});