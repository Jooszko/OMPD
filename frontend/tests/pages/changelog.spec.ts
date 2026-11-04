import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony dziennika zmian', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Login' }).press('Tab');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Dziennik zmian' }).click();
        await page.getByRole('heading', { name: 'Dziennik zmian' }).click();
        await page.getByRole('button', { name: 'Wszystko' }).click();
        await page.getByRole('button', { name: 'Konta i logowanie' }).click();
        await page.getByRole('button', { name: 'Klienci' }).click();
        await page.getByRole('button', { name: 'Produkty i receptury' }).click();
        await page.getByRole('button', { name: 'Zamówienia' }).click();
        await page.getByRole('button', { name: 'Finanse' }).click();
        await page.getByRole('button', { name: 'Logistyka' }).click();
        await page.getByRole('button', { name: 'Produkcja' }).click();
        await page.getByRole('button', { name: 'Dziś' }).click();
        await page.getByRole('button', { name: '7 dni' }).click();
        await page.getByRole('button', { name: '30 dni' }).click();
        await page.getByRole('button', { name: '30 dni' }).click();
        await page.getByRole('button', { name: 'Wszystko' }).click();
        await page.getByRole('button', { name: 'Dziś' }).click();
        await page.getByRole('heading', { name: 'Dziś' }).click();
    
    });
});