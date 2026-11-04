import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony głównej', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Strona główna' }).click();
        await page.getByRole('heading', { name: 'Dobry wieczór, Mikołaj' }).click();
        await page.getByText('Przychód dziś').click();
        await page.getByRole('heading', { name: 'Droga zamówień' }).click();
        await page.getByText('Zaplanowane', { exact: true }).click();
        await page.getByText('W produkcji', { exact: true }).click();
        await page.getByText('W dostawie', { exact: true }).click();
        await page.getByText('Dostarczone', { exact: true }).click();
        await page.getByRole('heading', { name: 'Trasy dziś' }).click();
        await page.getByRole('heading', { name: 'Ostatnio w systemie' }).click();

    
    });
});