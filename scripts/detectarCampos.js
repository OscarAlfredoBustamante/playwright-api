const { chromium } = require('playwright');

async function detectarCampos(data) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto(data.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForSelector('input, textarea, select, button', { timeout: 15000 });

        const campos = await page.evaluate(() => {
            const elementos = document.querySelectorAll('input, textarea, select');
            return Array.from(elementos).map(el => ({
                tag: el.tagName.toLowerCase(),
                type: el.getAttribute('type') || '',
                name: el.getAttribute('name') || '',
                id: el.id || '',
                placeholder: el.getAttribute('placeholder') || '',
                enabled: !el.disabled,
                required: el.required,
                selector: el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : ''
            }));
        });

        const botones = await page.evaluate(() => {
            const elementos = document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]');
            return Array.from(elementos).map(el => {
                const computedStyle = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                
                // Verificar si hay elementos superpuestos
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const elementFromPoint = document.elementFromPoint(centerX, centerY);
                const isObscured = elementFromPoint !== el && !el.contains(elementFromPoint);
                
                // Verificar si hay modales/overlays visibles
                const hasVisibleOverlay = () => {
                    const overlays = document.querySelectorAll('.modal, .overlay, .popup, [role="dialog"]');
                    return Array.from(overlays).some(overlay => {
                        const style = window.getComputedStyle(overlay);
                        return style.display !== 'none' && 
                               style.visibility !== 'hidden' &&
                               parseFloat(style.opacity) > 0.1;
                    });
                };

                // Solo retornar la bandera clickeable y lo esencial
                return {
                    tag: el.tagName.toLowerCase(),
                    type: el.getAttribute('type') || '',
                    text: el.innerText.trim() || el.value || el.getAttribute('aria-label') || '',
                    id: el.id || '',
                    selector: el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : '',
                    clickeable: !el.disabled && 
                              el.offsetParent !== null &&
                              computedStyle.display !== 'none' &&
                              computedStyle.visibility !== 'hidden' &&
                              parseFloat(computedStyle.opacity) > 0.1 &&
                              computedStyle.pointerEvents !== 'none' &&
                              rect.width > 0 && 
                              rect.height > 0 &&
                              rect.x + rect.width >= 0 &&
                              rect.y + rect.height >= 0 &&
                              el.getAttribute('aria-disabled') !== 'true' &&
                              el.getAttribute('aria-hidden') !== 'true' &&
                              !el.classList.contains('hidden') &&
                              !el.classList.contains('d-none') &&
                              !el.classList.contains('invisible') &&
                              !isObscured &&
                              !hasVisibleOverlay()
                };
            });
        });

        await browser.close();
        
        return { 
            success: true,
            result: { campos, botones }
        };

    } catch (error) {
        await browser.close();
        return { 
            success: false, 
            error: error.message 
        };
    }
}

module.exports = { detectarCampos };