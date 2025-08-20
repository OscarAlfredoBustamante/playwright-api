import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://clientes.facturassubway.mx/');
  await page.locator('#number_store').click();
  await page.locator('#number_store').fill('121212');
  await page.locator('#num_ticket').click();
  await page.locator('#num_ticket').fill('1/121212');
  await page.locator('#total_ticket').click();
  await page.locator('#total_ticket').fill('121212');
  await page.locator('#tax_id_receiver').click();
  await page.locator('#tax_id_receiver').fill('121212');
  await page.locator('#name_receiver').click();
  await page.locator('#name_receiver').fill('12121212');
  await page.locator('#cp_receiver').click();
  await page.locator('#cp_receiver').fill('121212');
  await page.locator('#regime_receiver').selectOption('624');
  await page.locator('#email_receiver').click();
  await page.locator('#email_receiver').fill('1212@hotmail');
  await page.getByRole('button', { name: 'Realizar facturación' }).click();
});