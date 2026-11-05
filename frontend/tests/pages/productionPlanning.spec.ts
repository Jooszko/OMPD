import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony planowania produkcji', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Planowanie produkcji' }).click();
        await page.getByText('Dzień dostawy').click();
        await page.getByText('Szczegóły ciasta').click();
        await page.getByRole('heading', { name: 'Surowce na zmianę' }).click();
    
    });
});