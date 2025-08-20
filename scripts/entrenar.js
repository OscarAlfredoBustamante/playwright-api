import spawn from 'cross-spawn';
import fs from "fs";
import path from "path";
import nano from 'nano';

// Configuración de CouchDB
const couchDBUrl = process.env.COUCHDB_URL || 'http://admin:admin@localhost:5984';
const dbName = process.env.COUCHDB_DB || 'playwright_training';

// Variable global para la conexión a la DB
let db = null;

// Función para inicializar la conexión a CouchDB
async function inicializarCouchDB() {
  try {
    const client = nano(couchDBUrl);

    // Verificar si la DB existe
    const dbList = await client.db.list();
    if (!dbList.includes(dbName)) {
      console.log(`La base "${dbName}" no existe. Se creará...`);
      await client.db.create(dbName);
    }

    // Inicializar la DB
    db = client.db.use(dbName);

    // Crear índice automáticamente
    try {
      await db.createIndex({
        index: {
          fields: ['tipo', 'url', 'timestamp']
        },
        name: 'entrenamiento-sort-index',
        type: 'json'
      });
      console.log('✅ Índice creado exitosamente');
    } catch (indexError) {
      console.log('ℹ️ Índice ya existe o no se pudo crear:', indexError.message);
    }

    const info = await db.info();
    console.log(`✅ Conectado a CouchDB - Base de datos "${info.db_name}" lista.`);
    return true;
  } catch (error) {
    console.warn('❌ No se pudo conectar a CouchDB o crear la DB:', error.message);
    return false;
  }
}

// Función para guardar datos en CouchDB
async function guardarEnCouchDB(data) {
  if (!db) {
    console.warn('CouchDB no está inicializado. Saltando guardado...');
    return null;
  }

  try {
    const response = await db.insert(data);
    console.log('✅ Datos guardados en CouchDB con ID:', response.id);
    return response;
  } catch (error) {
    console.error('❌ Error al guardar en CouchDB:', error.message);
    return null;
  }
}

function entrenar(data) {
  console.log("Comenzando a entrenar....");
  const outputFile = path.join(process.cwd(), "test-generated.js");
  const timestamp = new Date().toISOString();

  return new Promise(async (resolve, reject) => {
    const couchDBInicializado = await inicializarCouchDB();
    
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

    process.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`Playwright terminó con código ${code}`));
        return;
      }

      console.log("Terminando de entrenar....");
      try {
        const output = fs.readFileSync(outputFile, "utf8");
        const campos = procesarOutput(output);
        const pasos = extraerPasos(output); // 👈 nuevo

        if (couchDBInicializado) {
          const documento = {
            tipo: 'entrenamiento_playwright',
            url: data.url,
            timestamp,
            pasos,                // 👈 lista estructurada
            campos_extraidos: campos,
            metadata: {
              total_campos: campos.length,
              total_pasos: pasos.length,
              fecha_generacion: timestamp,
              nombre_archivo: path.basename(outputFile)
            }
          };
          await guardarEnCouchDB(documento);
        }

        resolve({ campos, pasos });
      } catch (err) {
        reject(err);
      }
    });
  });
}

function extraerPasos(output) {
  const pasos = [];
  const lineas = output.split('\n');

  for (const linea of lineas) {
    let match;

    // Goto
    match = linea.match(/await page\.goto\(['"`](.*?)['"`]\)/);
    if (match) {
      pasos.push({ action: 'goto', url: match[1] });
      continue;
    }

    // Click
    match = linea.match(/await page\.(.*)\.click\(\)/);
    if (match) {
      pasos.push({ action: 'click', selector: match[1] });
      continue;
    }

    // Fill
    match = linea.match(/await page\.(.*)\.fill\(['"`](.*?)['"`]\)/);
    if (match) {
      pasos.push({ action: 'fill', selector: match[1], value: match[2] });
      continue;
    }

    // Select
    match = linea.match(/await page\.(.*)\.selectOption\(['"`](.*?)['"`]\)/);
    if (match) {
      pasos.push({ action: 'select', selector: match[1], value: match[2] });
      continue;
    }
  }

  return pasos;
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

  // 🔹 Caso 3: page.getByPlaceholder('placeholder').fill('valor')
  const regexPlaceholder = /page\.getByPlaceholder\(['"`](.*?)['"`]\)\.fill\(['"`](.*?)['"`]\)/g;
  while ((match = regexPlaceholder.exec(output)) !== null) {
    campos.push({
      id: "",
      name: "",
      placeholder: match[1],
      type: "text",
      value: match[2],
    });
  }

  // 🔹 Caso 4: page.getByLabel('label').fill('valor')
  const regexLabel = /page\.getByLabel\(['"`](.*?)['"`]\)\.fill\(['"`](.*?)['"`]\)/g;
  while ((match = regexLabel.exec(output)) !== null) {
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

// Función adicional para recuperar entrenamientos
async function obtenerEntrenamientos() {
  if (!db) {
    await inicializarCouchDB();
  }

  try {
    const response = await db.find({
      selector: {
        tipo: 'entrenamiento_playwright'
      }
    });
    return response.docs;
  } catch (error) {
    console.error('Error al obtener entrenamientos:', error.message);
    return [];
  }
}

export { entrenar, obtenerEntrenamientos };