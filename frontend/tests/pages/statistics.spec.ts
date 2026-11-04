import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony statystyk', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Statystyki dostaw' }).click();
        await page.getByRole('heading', { name: 'Statystyki dostaw' }).click();
        await page.locator('span').filter({ hasText: 'Skuteczność' }).click();
        await page.locator('span').filter({ hasText: 'Dostarczone' }).click();
        await page.locator('span').filter({ hasText: 'Nieudane' }).click();
        await page.locator('span').filter({ hasText: 'W toku' }).click();
        await page.getByRole('heading', { name: 'Przystanki dziennie' }).click();
        await page.getByRole('heading', { name: 'Przyczyny nieudanych dostaw' }).click();
        await page.getByRole('heading', { name: 'Klienci z największą liczbą' }).click();
        await page.getByRole('heading', { name: 'Porównanie kierowców' }).click();
        await page.getByRole('heading', { name: 'Pokrycie potwierdzeniami' }).click();
        await page.getByRole('button', { name: '7 dni' }).click();
        await page.getByRole('button', { name: '30 dni' }).click();
        await page.getByRole('button', { name: '90 dni' }).click();
    
    });
});