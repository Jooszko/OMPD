import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony produktów', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Produkty' }).click();
        await page.getByRole('heading', { name: 'Zarządzanie produktami' }).click();
        await page.getByText('Produkt', { exact: true }).click();
        await page.getByRole('searchbox', { name: 'Szukaj produktu po nazwie' }).click();
        await page.getByRole('tab', { name: 'Cennik bazowy' }).click();
        await page.getByRole('tab', { name: 'Receptury' }).click();
        await page.getByRole('button', { name: 'Zdefiniuj nową recepturę' }).click();
        await page.getByRole('heading', { name: 'Nowa Karta Technologiczna' }).click();
        await page.getByRole('button', { name: 'Zamknij' }).click();
        await page.getByText('Produkt końcowy').click();
    
    });
});