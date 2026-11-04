import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony magazynu', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Magazyn' }).click();
        await page.getByText('Historia stanu', { exact: true }).click();
        await page.getByRole('heading', { name: 'Wszystkie surowce' }).click();
        await page.getByRole('button', { name: 'Nowy składnik' }).click();
        await page.getByRole('heading', { name: 'Nowy składnik' }).click();
        await page.getByRole('button', { name: 'Zamknij' }).click();
        await page.getByRole('button', { name: 'Przyjmij dostawę' }).click();
        await page.getByRole('heading', { name: 'Zmiana stanu magazynu' }).click();
        await page.getByRole('button', { name: 'Zamknij' }).click();
    
    });
});