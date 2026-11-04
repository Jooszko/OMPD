import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony finansów', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
          await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Login' }).press('Tab');
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Finanse' }).click();
        await page.getByRole('heading', { name: 'Finanse' }).click();
        await page.getByRole('button', { name: '7 dni' }).click();
        await page.getByRole('button', { name: '30 dni' }).click();
        await page.getByRole('button', { name: 'Ten miesiąc' }).click();
        await page.getByRole('button', { name: 'Własny zakres' }).click();
        await page.getByRole('button', { name: 'Ten miesiąc' }).click();
        await page.getByRole('link', { name: 'Przegląd' }).click();
        await page.getByRole('heading', { name: 'Przychody i koszty dziennie' }).click();
        await page.getByRole('heading', { name: 'Struktura kosztów' }).click();
        await page.getByRole('heading', { name: 'Najwięksi klienci' }).click();
        await page.getByRole('heading', { name: 'Ostatnie wydatki' }).click();
        await page.getByRole('link', { name: 'Wydatki', exact: true }).click();
        await page.getByText('Wydatki cykliczne').click();
        await page.getByRole('heading', { name: 'Wydatki w okresie' }).click();
        await page.getByRole('link', { name: 'Rentowność produktów' }).click();
        await page.getByRole('heading', { name: 'Wysoka marża' }).click();
        await page.getByRole('heading', { name: 'Średnia marża' }).click();
        await page.getByRole('heading', { name: 'Niska marża – do przejrzenia' }).click();
        await page.getByRole('heading', { name: 'Na czym zarabiamy najwięcej' }).click();
        await page.getByRole('heading', { name: 'Jak liczymy marżę' }).click();
        await page.getByRole('link', { name: 'Raporty' }).click();
        await page.getByRole('button', { name: 'Miesiąc' }).click();
        await page.getByRole('button', { name: 'Kwartał' }).click();
        await page.getByRole('button', { name: 'Rok' }).click();
        await page.getByRole('button', { name: 'Miesiąc' }).click();
        await page.getByRole('heading', { name: 'Ostatnie okresy' }).click();
        await page.getByRole('heading', { name: 'Rachunek zysków i strat' }).click();
        await page.locator('div').filter({ hasText: 'FinansePrzychody, koszty i' }).nth(4).click();
        await page.getByRole('heading', { name: 'Zamknięcia dni' }).click();
        await page.getByRole('link', { name: 'Dla księgowej' }).click();
        await page.getByRole('button', { name: 'Rachunek zysków i strat Do' }).click();

    
    });
});