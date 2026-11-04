import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony ustawień produkcji', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Ustawienia produkcji' }).click();
        await page.getByRole('heading', { name: 'Ustawienia produkcji' }).click();
        await page.getByRole('heading', { name: 'Wyroby w planowaniu' }).click();
        await page.getByRole('button', { name: 'Ciasta i receptury' }).click();
        await page.getByRole('button', { name: 'Dodaj ciasto' }).click();
        await page.getByRole('heading', { name: 'Nowe ciasto' }).click();
        await page.getByRole('button', { name: 'Zamknij' }).click();
        await page.getByRole('button', { name: 'Mieszałki' }).click();
        await page.getByRole('button', { name: 'Dodaj mieszałkę' }).click();
        await page.getByRole('heading', { name: 'Nowa mieszałka' }).click();
        await page.getByRole('button', { name: 'Zamknij' }).click();

    
    });
});