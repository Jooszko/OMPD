import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony zamówień', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('complementary', { name: 'Menu główne' }).getByRole('link', { name: 'Zamówienia' }).click();
        await page.getByRole('heading', { name: 'Zamówienia' }).click();
        await page.getByText('Klient i adres').click();
        await page.getByRole('button', { name: 'Dodaj zamówienie' }).click();
        await page.getByRole('heading', { name: 'Zamówienie jednorazowe' }).click();
        await page.getByRole('button', { name: 'Zamknij' }).click();
        await page.getByRole('tab', { name: 'Dzień' }).click();
        await page.getByRole('tab', { name: 'Stałe' }).click();
        await page.getByRole('main').getByText('Klienci').click();
        await page.getByRole('main').getByText('Dostawy').click();
        await page.getByText('Sztuki', { exact: true }).click();
        await page.getByText('Wartość').click();
        await page.getByRole('heading', { name: 'Sztuki ze stałych zamówień w' }).click();
        await page.getByText('Klient i adres').click();
        await page.getByRole('searchbox', { name: 'Szukaj klienta' }).click();
        await page.getByRole('button', { name: 'Dodaj zamówienie stałe' }).click();
        await page.getByRole('heading', { name: 'Harmonogram dostaw' }).click();
        await page.getByText('Nowe zamówienie stałe').click();
        await page.getByRole('button', { name: 'Zamknij' }).click();
        await page.getByRole('tab', { name: 'Historia' }).click();
        await page.getByRole('button', { name: '7 dni' }).click();
        await page.getByRole('button', { name: '30 dni' }).click();
        await page.getByRole('button', { name: 'Ten miesiąc' }).click();
    
    });
});