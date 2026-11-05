import { test } from '@playwright/test';

test.describe('Sprawdzenie ładowanie stron', () => {

  test('Test powinien przejść po wszystkich stronach admina i sprawdzić ich zawartość', async ({ page }) => {
    
    await page.goto('http://localhost:5173/login');
    await page.getByRole('textbox', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
    await page.getByRole('textbox', { name: 'Hasło' }).click();
    await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await page.getByRole('button', { name: 'Zwiń menu' }).click();
    await page.getByRole('button', { name: 'Rozwiń menu' }).click();
    await page.getByRole('link', { name: 'Strona główna' }).click();
    await page.getByRole('button', { name: 'Powiadomienia' }).click();
    await page.getByRole('complementary', { name: 'Menu główne' }).getByRole('link', { name: 'Zamówienia' }).click();
    await page.getByRole('link', { name: 'Klienci' }).click();
    await page.getByRole('link', { name: 'Tablica produkcji' }).click();
    await page.getByRole('link', { name: 'Planowanie produkcji' }).click();
    await page.getByRole('link', { name: 'Ustawienia produkcji' }).click();
    await page.getByRole('link', { name: 'Produkty' }).click();
    await page.getByRole('link', { name: 'Magazyn' }).click();
    await page.getByRole('link', { name: 'Kontrahenci' }).click();
    await page.getByRole('link', { name: 'Logistyka' }).click();
    await page.getByRole('link', { name: 'Statystyki dostaw' }).click();
    await page.getByRole('link', { name: 'Finanse' }).click();
    await page.getByRole('link', { name: 'Użytkownicy' }).click();
    await page.getByRole('link', { name: 'Dziennik zmian' }).click();
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await page.getByRole('heading', { name: 'Zaloguj się' }).click();
    
    });
});