import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony użytkowników', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
          await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Użytkownicy' }).click();
        await page.getByRole('heading', { name: 'Użytkownicy' }).click();
        await page.getByRole('button', { name: 'Dodaj pracownika' }).click();
        await page.getByRole('heading', { name: 'Nowy pracownik' }).click();
        await page.getByRole('button', { name: 'Zamknij' }).click();
        await page.getByText('Pracownik', { exact: true }).click();
        await page.getByRole('searchbox', { name: 'Szukaj pracownika' }).click();
        await page.getByText('Sortujalfabetyczniewg').click();
    
    });
});