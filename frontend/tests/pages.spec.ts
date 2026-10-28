import { test } from '@playwright/test';

test.describe('Sprawdzenie ładowanie stron', () => {

  test('Test powinien przejść po wszystkich stronach admina i sprawdzić ich zawartość', async ({ page }) => {
    
    await page.goto('http://localhost:5173/login');
    await page.getByRole('textbox', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Login' }).fill('test1');
    await page.getByRole('textbox', { name: 'Hasło' }).click();
    await page.getByRole('textbox', { name: 'Hasło' }).press('CapsLock');
    await page.getByRole('textbox', { name: 'Hasło' }).fill('Z');
    await page.getByRole('textbox', { name: 'Hasło' }).press('CapsLock');
    await page.getByRole('textbox', { name: 'Hasło' }).fill('Zaq12wsx');
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await page.getByRole('link', { name: 'Strona główna' }).click();
    await page.getByRole('heading', { name: /Dzień dobry|Dobry wieczór/ }).click();
    await page.getByRole('heading', { name: 'Droga zamówień' }).click();
    await page.getByRole('heading', { name: 'Trasy dziś' }).click();
    await page.getByRole('heading', { name: 'Ostatnio w systemie' }).click();
    await page.getByRole('navigation').getByRole('link', { name: 'Zamówienia' }).click();
    await page.getByRole('heading', { name: 'Zamówienia', exact: true }).click();
    await page.getByRole('tab', { name: 'Dzień' }).click();
    await page.getByRole('link', { name: 'Tablica produkcji' }).click();
    await page.getByText('Tablica produkcyjna').click();
    await page.getByRole('navigation').getByRole('link', { name: 'Planowanie produkcji' }).click();
    await page.getByRole('heading', { name: 'Planowanie produkcji' }).click();
    await page.getByRole('link', { name: 'Ustawienia produkcji' }).click();
    await page.getByRole('heading', { name: 'Ustawienia produkcji' }).click();
    await page.getByRole('link', { name: 'Magazyn' }).click();
    await page.getByRole('heading', { name: 'Wszystkie surowce' }).click();
    await page.getByRole('link', { name: 'Logistyka' }).click();
    await page.getByRole('heading', { name: 'Logistyka i Trasy' }).click();
    await page.getByRole('link', { name: 'Statystyki dostaw' }).click();
    await page.getByRole('heading', { name: 'Statystyki dostaw' }).click();
    await page.getByRole('link', { name: 'Produkty' }).click();
    await page.getByRole('heading', { name: 'Zarządzanie Produktami' }).click();
    await page.getByRole('link', { name: 'Finanse' }).click();
    await page.getByRole('heading', { name: 'Finanse' }).click();
    await page.getByRole('link', { name: 'Użytkownicy' }).click();
    await page.getByRole('heading', { name: 'Użytkownicy' }).click();
    await page.getByRole('link', { name: 'Dziennik zmian' }).click();
    await page.getByRole('heading', { name: 'Dziennik zmian' }).click();
    await page.getByRole('link', { name: 'Klienci' }).click();
    await page.getByRole('heading', { name: 'Klienci', exact: true }).click();
    await page.getByRole('link', { name: 'Kontrahenci' }).click();
    await page.getByRole('heading', { name: 'Księga Kontrahentów' }).click();
    
    });
});