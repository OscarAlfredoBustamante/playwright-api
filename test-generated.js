import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.ticket-factura.com/');
  await page.locator('.img.img-2').click();
  await page.locator('div:nth-child(16) > .blog-entry > .img').click();
  await page.locator('#EmpresaId').selectOption('3');
  await page.locator('#Folio').dblclick();
  await page.locator('#Folio').fill('1234');
  await page.getByRole('textbox', { name: '__/__/____' }).click();
  await page.getByRole('textbox', { name: '__/__/____' }).fill('12/12/1212');
  await page.locator('#Monto').click();
  await page.locator('#Monto').fill('399');
  await page.locator('#Monto').press('Tab');
  await page.locator('#CodigoSeguridad').fill('12344');
  await page.getByRole('button', { name: 'Buscar' }).click();
});