const { chromium } = require('playwright');

async function detectarCampos(data) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(data.url, { waitUntil: 'domcontentloaded' });

    // Esperar campos y botones
    await page.waitForSelector('input, textarea, select', { timeout: 10000 }).catch(() => {});
    await page.waitForSelector('button, input[type="submit"]', { timeout: 10000 }).catch(() => {});

    const campos = await page.evaluate(() => {
        const elementos = document.querySelectorAll('input, textarea, select');
        return Array.from(elementos).map(el => ({
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            name: el.getAttribute('name') || '',
            id: el.id || '',
            placeholder: el.getAttribute('placeholder') || '',
            selector: el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : el.tagName.toLowerCase()
        }));
    });

    const botones = await page.evaluate(() => {
        const elementos = document.querySelectorAll('button, input[type="submit"]');
        return Array.from(elementos).map(el => ({
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            text: el.innerText.trim() || el.value || '',
            id: el.id || '',
            selector: el.id ? `#${el.id}` : el.innerText.trim() ? `button:has-text("${el.innerText.trim()}")` : 'button'
        }));
    });

    await browser.close();
    return { campos, botones };
}
module.exports = { detectarCampos };

