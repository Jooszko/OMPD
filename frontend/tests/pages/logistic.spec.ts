import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony logistyki', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Logistyka' }).click();
        await page.getByRole('heading', { name: 'Logistyka i trasy' }).click();
        await page.getByRole('button', { name: 'Dziś' }).click();
        await page.getByRole('button', { name: 'Kalendarz' }).click();
        await page.getByRole('button', { name: 'Kalendarz' }).click();
        await page.getByText('Dostarczone').first().click();
        await page.getByText('W trasie').click();
        await page.getByText('Problemy').click();
        await page.getByText('Trasa 1').click();
    
    });
});