const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function llenarFormulario(data) {
    const pasos = [];
const urlFolderName = data.url
    .replace(/(^\w+:|^)\/\//, '') // quitar protocolo
    .replace(/[^\w.-]/g, '_'); // reemplazar caracteres raros por "_"

const screenshotsDir = path.join(__dirname, 'screenshots', urlFolderName);

if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

    try {
        pasos.push('Iniciando navegador...');
        const browser = await chromium.launch({ headless: true });
        pasos.push('Navegador iniciado.');

        const page = await browser.newPage();
        pasos.push('Nueva pestaña creada.');

        await page.goto(data.url);
        pasos.push(`Página abierta: ${await page.title()}`);
        await page.screenshot({ path: path.join(screenshotsDir, '1-pagina-abierta.png'), fullPage: true });

        // Llenar campos de forma dinámica
        for (let i = 0; i < data.datos.length; i++) {
            const campoInfo = data.datos[i];
            let selector = null;

            if (campoInfo.id) {
                selector = `#${campoInfo.id}`;
            } else if (campoInfo.name) {
                selector = `[name="${campoInfo.name}"]`;
            } else if (campoInfo.placeholder) {
                selector = `[placeholder="${campoInfo.placeholder}"]`;
            } else if (campoInfo.type) {
                selector = `input[type="${campoInfo.type}"]`;
            }

            if (!selector) {
                pasos.push(`⚠️ No se pudo generar selector para el campo: ${JSON.stringify(campoInfo)}`);
                continue;
            }

            try {
                await page.fill(selector, campoInfo.valor);
                pasos.push(`✅ Se llenó ${selector} con: ${campoInfo.valor}`);
            } catch (err) {
                pasos.push(`⚠️ No se encontró el campo con selector: ${selector}`);
            }

            await page.screenshot({
                path: path.join(screenshotsDir, `${i + 2}.png`),
                fullPage: true
            });
        }

let botonSelector = null;

// Prioridad para seleccionar el botón
if (data.boton_id) {
    botonSelector = `#${data.boton_id}`;
} else if (data.boton_name) {
    botonSelector = `[name="${data.boton_name}"]`;
} else if (data.boton_text) {
    botonSelector = `button:has-text("${data.boton_text}")`;
} else if (data.boton_enviar) {
    botonSelector = data.boton_enviar; // Si viene un selector ya definido
}

if (!botonSelector) {
    pasos.push("⚠️ No se pudo generar selector para el botón");
} else {
    const botonHabilitado = await page.isEnabled(botonSelector);
    pasos.push(`Botón habilitado: ${botonHabilitado}`);

    if (botonHabilitado) {
        await page.click(botonSelector);
        pasos.push(`✅ Se hizo clic en el botón: ${botonSelector}`);
    } else {
        pasos.push(`⚠️ El botón ${botonSelector} está deshabilitado`);
    }
}

        await page.screenshot({ path: path.join(screenshotsDir, 'pagina_post_enviar.png'), fullPage: true });

        pasos.push('Cerrando navegador...');
        await browser.close();
        pasos.push('Navegador cerrado.');

        return { status: 'Formulario enviado', pasos };

    } catch (error) {
        pasos.push(`Error: ${error.message}`);
        return { status: 'Error', pasos };
    }
}


module.exports = { llenarFormulario };

