const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function llenarFormulario(data) {
    const pasos = [];
    const screenshotsDir = path.join(__dirname, 'screenshots');

    // Crear carpeta si no existe
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }

    try {
        pasos.push('Iniciando navegador...');
        const browser = await chromium.launch({ headless: true });
        pasos.push('Navegador iniciado.');

        const page = await browser.newPage();
        pasos.push('Nueva pestaña creada.');

        await page.goto(data.url);
        pasos.push(`Página abierta: ${await page.title()}`);
        await page.screenshot({ path: path.join(screenshotsDir, '1-pagina-abierta.png') });

        // Llenar campos de forma dinámica
        for (let i = 0; i < data.datos.length; i++) {
            const { campo, valor } = data.datos[i]; // campo = selector

            try {
                await page.fill(campo, valor);
                pasos.push(`✅ Se llenó ${campo} con: ${valor}`);
            } catch (err) {
            console.log(err);
                pasos.push(`⚠️ No se encontró el campo: ${campo}`);
            }

            await page.screenshot({
                path: path.join(screenshotsDir, `${i + 2}-${campo.replace(/[#.]/g, '')}.png`)
            });
        }
        
       await page.getByRole('button', { name: 'ENVIAR' }).click();

await page.screenshot({ path: path.join(screenshotsDir, 'pagina_post_envir.png') });


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

