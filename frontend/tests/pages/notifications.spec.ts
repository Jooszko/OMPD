import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony powiadomień', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('button', { name: 'Powiadomienia' }).click();
        await page.getByText('Powiadomienia').nth(1).click();
        await page.getByRole('button', { name: 'Zobacz wszystkie powiadomienia' }).click();
        await page.getByRole('heading', { name: 'Powiadomienia' }).click();
        await page.getByRole('button', { name: 'Wszystkie', exact: true }).click();
        await page.getByRole('button', { name: 'Nowa wiadomość' }).click();
        await page.getByRole('button', { name: 'Anuluj' }).click();
        await page.getByRole('heading', { name: 'Skrzynka odbiorcza' }).click();

    
    });
});