import nano from 'nano';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const couchDBUrl = process.env.COUCHDB_URL || 'http://admin:admin@localhost:5984';
const dbName = process.env.COUCHDB_DB || 'playwright_training';

async function obtenerPasosDeBD(url) {
    const client = nano(couchDBUrl);
    const db = client.db.use(dbName);

    const response = await db.find({
        selector: { tipo: 'entrenamiento_playwright', url },
        sort: [{ 'timestamp': 'desc' }],
        limit: 1
    });

    if (response.docs.length === 0) {
        throw new Error(`No se encontraron pasos para la URL: ${url}`);
    }
    return response.docs[0].pasos;
}

function generarScriptDesdePasos(pasos) {
  let script = `import { chromium } from 'playwright';\n\n(async () => {\n  const browser = await chromium.launch({ headless: true }); // 👈 headless\n  const page = await browser.newPage();\n\n`;

  for (const paso of pasos) {
    switch (paso.action) {
      case "goto":
        script += `  console.log("➡️ Navegando a: ${paso.url}");\n`;
        script += `  await page.goto("${paso.url}");\n`;
        break;

      case "click":
        script += `  console.log("🖱️ Click en: ${paso.selector}");\n`;
        script += `  await page.${paso.selector}.scrollIntoViewIfNeeded();\n`;
        script += `  await page.${paso.selector}.click({ timeout: 60000 });\n`;
        break;

      case "fill":
        script += `  console.log("⌨️ Rellenando ${paso.selector} con: ${paso.value}");\n`;
        script += `  await page.${paso.selector}.scrollIntoViewIfNeeded();\n`;
        script += `  await page.${paso.selector}.fill("${paso.value}", { timeout: 60000 });\n`;
        break;

      case "select":
        script += `  console.log("🔽 Seleccionando en ${paso.selector}: ${paso.value}");\n`;
        script += `  await page.${paso.selector}.scrollIntoViewIfNeeded();\n`;
        script += `  await page.${paso.selector}.selectOption("${paso.value}", { timeout: 60000 });\n`;
        break;

      case "scroll":
        script += `  console.log("🖱️ Scroll: ${paso.value}");\n`;
        script += `  await page.evaluate(() => window.scrollBy(${paso.value}));\n`;
        break;
    }
  }

  script += `\n  await browser.close();\n})();\n`;
  return script;
}





async function ejecutarPlaywright(url, instrucciones) {
    try {
        console.log(`🔍 Buscando pasos para: ${url}`);
        let pasos = await obtenerPasosDeBD(url);

        // Aplicar instrucciones (sobrescribir valores en pasos)
        for (const inst of instrucciones) {

            pasos = pasos.map(paso => {
                if (paso.action === "fill") {
                    if (inst.id && paso.selector.includes(`#${inst.id}`)) {
                        return { ...paso, value: inst.value };
                    }
                    if (inst.name && paso.selector.includes(`{ name: '${inst.name}' }`)) {
                        return { ...paso, value: inst.value };
                    }
                    if (inst.placeholder && paso.selector.includes(inst.placeholder)) {
                        return { ...paso, value: inst.value };
                    }
                }
                return paso;
            });
        }

        const script = generarScriptDesdePasos(pasos);

        const tempScriptPath = path.join(process.cwd(), 'temp-execution.js');
        fs.writeFileSync(tempScriptPath, script);

        console.log('🚀 Ejecutando script generado...');


        const result = await ejecutarScript(tempScriptPath);
        fs.unlinkSync(tempScriptPath);

        return { success: true, message: 'Ejecución completada', detalles: result };
    } catch (error) {
        throw new Error(`Error en ejecución: ${error.message}`);
    }
}

function ejecutarScript(scriptPath) {
    console.log("Ejecutando:");

    return new Promise((resolve, reject) => {
        const process = spawn('node', [scriptPath], {
            stdio: 'pipe',
            timeout: 300000
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('Playwright:', data.toString().trim());
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error('Playwright error:', data.toString().trim());
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve({ exitCode: code, stdout, stderr });
            } else {
                reject(new Error(`El script terminó con código ${code}\n${stderr}`));
            }
        });

        process.on('error', reject);
    });
}

export { ejecutarPlaywright };
