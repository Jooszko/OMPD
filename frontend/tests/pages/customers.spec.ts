import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony klientów', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Klienci' }).click();
        await page.getByRole('button', { name: 'Wszyscy 40 wszystkie punkty' }).click();
        await page.getByRole('button', { name: 'Aktywni 37 dostają towar' }).click();
        await page.getByRole('button', { name: 'Nieaktywni 3 wstrzymane' }).click();
        await page.getByRole('button', { name: 'Bez lokalizacji 0 nie ma ich' }).click();
        await page.getByRole('button', { name: 'Bez lokalizacji 0 nie ma ich' }).click();
        await page.getByRole('heading', { name: 'Klienci' }).click();
        await page.getByRole('button', { name: 'Dodaj klienta' }).click();
        await page.getByRole('button', { name: 'Zamknij' }).click();
        await page.getByRole('button', { name: 'Wszystkie trasy' }).click();

    
    });
});