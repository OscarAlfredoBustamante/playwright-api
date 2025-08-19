import spawn from 'cross-spawn';
import fs from "fs";
import path from "path";

function entrenar(data) {
  console.log("Comenzando a entrenar....");
  const outputFile = path.join(process.cwd(), "test-generated.js");

  return new Promise((resolve, reject) => {
    const process = spawn('npx', [
      "playwright",
      "codegen",
      data.url,
      "--output",
      outputFile
    ], {
      stdio: 'inherit'
    });

    process.on('error', (err) => {
      console.error('Error al ejecutar playwright:', err);
      reject(err);
    });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Playwright terminó con código ${code}`));
        return;
      }

      console.log("Terminando de entrenar....");
      try {
        const output = fs.readFileSync(outputFile, "utf8");
        const campos = procesarOutput(output);
        resolve(campos);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function procesarOutput(output) {
  const campos = [];
  
  // 🔹 Caso 1: page.locator('#id').fill('valor')
  const regexLocator = /page\.locator\(['"`]#(.*?)['"`]\)\.fill\(['"`](.*?)['"`]\)/g;
  let match;
  while ((match = regexLocator.exec(output)) !== null) {
    campos.push({
      id: match[1],
      name: "",
      placeholder: "",
      type: "text",
      value: match[2],
    });
  }

  // 🔹 Caso 2: page.getByRole('textbox', { name: 'algo' }).fill('valor')
  const regexRole = /page\.getByRole\(\s*['"`]textbox['"`],\s*\{\s*name:\s*['"`](.*?)['"`]\s*\}\s*\)\.fill\(['"`](.*?)['"`]\)/g;
  while ((match = regexRole.exec(output)) !== null) {
    campos.push({
      id: "",
      name: match[1],
      placeholder: "",
      type: "text",
      value: match[2],
    });
  }

  return campos;
}

export { entrenar };