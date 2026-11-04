import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony kontrahentów', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
    await page.goto('http://localhost:5173/login');
    await page.getByRole('textbox', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
    await page.getByRole('textbox', { name: 'Hasło' }).click();
    await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await page.getByRole('link', { name: 'Kontrahenci' }).click();
    await page.getByRole('heading', { name: 'Księga Kontrahentów' }).click();
    await page.getByRole('button', { name: 'Aktywni 9 aktywni kontrahenci' }).click();
    await page.getByRole('button', { name: 'Nieaktywni 1 nieaktywni' }).click();
    await page.getByRole('button', { name: 'Nieaktywni 1 nieaktywni' }).click();
    await page.getByRole('button', { name: 'Dodaj Kontrahenta' }).click();
    await page.getByRole('heading', { name: 'Nowa Kartoteka Kontrahenta' }).click();
    await page.locator('.text-gray-400').first().click();
    
    });
});