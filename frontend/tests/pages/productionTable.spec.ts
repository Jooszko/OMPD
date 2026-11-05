import { test } from '@playwright/test';

test.describe('Sprawdzenie zawartości strony tabeli produkcji', () => {

  test('Test powinien sprawdzić widoczność elementów i ich zawartość', async ({ page }) => {
    
        await page.goto('http://localhost:5173/login');
        await page.getByRole('textbox', { name: 'Login' }).click();
        await page.getByRole('textbox', { name: 'Login' }).fill('mklukowski');
        await page.getByRole('textbox', { name: 'Hasło' }).click();
        await page.getByRole('textbox', { name: 'Hasło' }).fill('bakery2026');
        await page.getByRole('button', { name: 'Zaloguj się' }).click();
        await page.getByRole('link', { name: 'Planowanie produkcji' }).click();
        const przycisk = page.getByRole('button', { name: 'Zatwierdź plan i utwórz dzieże' });
        const czyWidoczny = await przycisk.waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false); 

        if (czyWidoczny) {
            await przycisk.click();
        }
        
        await page.getByRole('complementary', { name: 'Menu główne' }).getByRole('link', { name: 'Tablica produkcji' }).click();

            await page.getByRole('button', { name: 'Odśwież' }).click();
            await page.getByRole('button', { name: 'Zacznij: Mieszanie' }).first().click();
            await page.getByRole('button', { name: 'Dalej: Dzielenie' }).click();
            await page.getByRole('button', { name: 'Zacznij: Dzielenie' }).click();
            await page.getByRole('button', { name: 'Dalej: Garowanie' }).click();
            await page.getByRole('button', { name: 'Zacznij: Garowanie' }).click();
            await page.getByRole('button', { name: 'Dalej: Wypiek' }).click();
            await page.getByRole('button', { name: 'Zacznij: Wypiek' }).click();
            await page.getByRole('button', { name: 'Zakończ partię' }).click();
        
    
    });
});