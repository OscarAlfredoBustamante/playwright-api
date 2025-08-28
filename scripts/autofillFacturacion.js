const { chromium } = require('playwright');

// Mapeo predefinido de campos comunes para facturación
const mapeoPredefinido = {
  rfc: ['rfc', 'tax_id', 'identificacion_fiscal', 'taxid'],
  fecha: ['fecha', 'date', 'fecha_emision', 'emision_date'],
  numero_ticket: ['ticket', 'num_ticket', 'ticket_number', 'folio'],
  nombre: ['nombre', 'name', 'cliente'],
  direccion: ['direccion', 'address', 'domicilio'],
  email: ['email', 'correo', 'e-mail'],
  telefono: ['telefono', 'phone', 'tel'],
  codigo_postal: ['codigo_postal', 'zip', 'postal_code'],
  ciudad: ['ciudad', 'city'],
  estado: ['estado', 'state'],
  pais: ['pais', 'country'],
  clave: ['clave', 'key', 'codigo', 'password'] // Añadido para el campo "clave"
};

async function cerrarModales(page) {
  const selectoresCerrar = ['.close', '[data-dismiss="modal"]', '[aria-label="Close"]', '.modal-close', 'button:has-text("Cerrar")', 'button:has-text("Close")', '.btn-close'];
  for (const selector of selectoresCerrar) {
    try {
      const elementos = await page.$$(selector);
      for (const el of elementos) {
        if (await el.isVisible()) {
          await el.click();
          await page.waitForTimeout(1000);
        }
      }
    } catch (error) {
      // Ignorar errores al cerrar modales
    }
  }
}

async function detectarCamposEnPagina(page) {
  try {
    // Esperar a que cargue el contenido dinámico
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Tomar screenshot para ver el estado actual de la página
    await page.screenshot({ path: 'debug-page-state.png' });
    console.log('Screenshot tomado: debug-page-state.png');

    // Evaluar directamente en el contexto de la página para encontrar elementos visibles
    const elementos = await page.evaluate(() => {
      // Función para verificar si un elemento es visible
      const esVisible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity) > 0.1 &&
          rect.width > 0 &&
          rect.height > 0 &&
          el.offsetParent !== null;
      };

      // Buscar todos los elementos de formulario visibles
      const inputsVisibles = Array.from(document.querySelectorAll('input, textarea, select, button, a'))
        .filter(el => esVisible(el))
        .map(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          // Obtener texto del elemento
          let text = '';
          if (el.tagName.toLowerCase() === 'input') {
            text = el.value || el.getAttribute('aria-label') || el.placeholder || '';
          } else {
            text = el.innerText.trim() || el.textContent.trim() || el.getAttribute('aria-label') || el.title || '';
          }

          // Determinar el mejor selector
          let selector = '';
          if (el.id) {
            selector = `#${el.id}`;
          } else if (el.name) {
            selector = `[name="${el.name}"]`;
          } else if (el.className && typeof el.className === 'string') {
            selector = `.${el.className.split(' ')[0]}`;
          }

          return {
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            text: text,
            id: el.id || '',
            name: el.getAttribute('name') || '',
            class: el.className || '',
            selector: selector,
            visible: true,
            position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
        });

      return inputsVisibles;
    });

    // Separar campos de botones
    const campos = elementos.filter(el =>
      ['input', 'textarea', 'select'].includes(el.tag) &&
      el.type !== 'submit' &&
      el.type !== 'button' &&
      el.type !== 'reset' &&
      el.type !== 'image'
    );

    const botones = elementos.filter(el =>
      el.tag === 'button' ||
      el.tag === 'a' ||
      ['submit', 'button', 'reset', 'image'].includes(el.type)
    );

    console.log(`Elementos interactivos detectados: ${elementos.length}`);
    console.log(`Campos detectados: ${campos.length}`);
    console.log(`Botones detectados: ${botones.length}`);

    // Log detallado de todos los elementos encontrados
    elementos.forEach((el, index) => {
      console.log(`${index + 1}. ${el.tag}.${el.type} - "${el.text}" - ${el.selector} - pos:(${el.position.x},${el.position.y})`);
    });

    return { campos, botones };
  } catch (error) {
    console.log('Error al detectar elementos:', error.message);
    return { campos: [], botones: [] };
  }
}

function encontrarCampoParaClave(campos, clave, mapeoPredefinido) {
  const terminos = mapeoPredefinido[clave] || [clave];
  for (const campo of campos) {
    if (!campo.selector) continue;
    for (const termino of terminos) {
      const patron = new RegExp(termino, 'i');
      if ((campo.name && patron.test(campo.name)) ||
        (campo.id && patron.test(campo.id)) ||
        (campo.class && patron.test(campo.class)) ||
        (campo.text && patron.test(campo.text))) {
        return campo;
      }
    }
  }
  return null;
}

async function llenarCampo(page, campo, valor) {
  try {
    await page.fill(campo.selector, valor);
    console.log(`Campo ${campo.selector} llenado con: ${valor}`);
  } catch (error) {
    console.log(`Error al llenar campo ${campo.selector}: ${error.message}`);
    // Intentar otros métodos si fill falla
    try {
      await page.focus(campo.selector);
      await page.type(campo.selector, valor);
    } catch (error2) {
      console.log(`También falló el método alternativo: ${error2.message}`);
    }
  }
}

function encontrarBotonAdecuado(botones, preferencias) {
  console.log('=== ANALIZANDO BOTONES ===');
  console.log(`Preferencias: ${preferencias.join(', ')}`);

  // Mostrar TODOS los botones detectados
  console.log(`Total de botones detectados: ${botones.length}`);
  botones.forEach((boton, index) => {
    console.log(`${index + 1}. Tag:${boton.tag} Type:${boton.type} Text:"${boton.text}" Selector:${boton.selector}`);
  });

  // Buscar por texto preferido
  for (const pref of preferencias) {
    const boton = botones.find(b =>
      b.text && b.text.toLowerCase().includes(pref.toLowerCase())
    );
    if (boton) {
      console.log(`Botón encontrado por preferencia "${pref}": ${boton.text}`);
      return boton;
    }
  }

  // Si no encuentra, devolver el primer botón que no sea de imagen (pueden ser problemáticos)
  const botonesNoImagen = botones.filter(b => b.type !== 'image');
  if (botonesNoImagen.length > 0) {
    console.log(`Usando el primer botón no imagen: ${botonesNoImagen[0].text}`);
    return botonesNoImagen[0];
  }

  // Si solo hay botones de imagen, usar el primero
  if (botones.length > 0) {
    console.log(`Usando el primer botón disponible: ${botones[0].text}`);
    return botones[0];
  }

  console.log('No se encontró ningún botón');
  return null;
}

async function hacerClicConfiable(page, boton) {
  console.log(`Intentando hacer clic en: ${boton.selector}`);

  console.log('=== PROPIEDADES DEL BOTÓN ===');
  console.log(`Tag: ${boton.tag}`);
  console.log(`Type: ${boton.type}`);
  console.log(`Text: "${boton.text}"`);
  console.log(`ID: ${boton.id}`);
  console.log(`Name: ${boton.name}`);
  console.log(`Class: ${boton.class}`);
  console.log(`Selector: ${boton.selector}`);
  console.log(`Visible: ${boton.visible}`);
  // Intentar diferentes métodos de clic

  let locator;

  if (boton.id) {
    locator = page.locator(`#${boton.id}`);
  } else if (boton.texto) {
    locator = page.getByRole('button', { name: boton.texto });
  }
  const metodosClic = [
    () => locator.click(),
    () => locator.dispatchEvent('click'),
    () => locator.press('Enter'),
    () => locator.press('Space')
  ];

  for (let i = 0; i < metodosClic.length; i++) {
    try {
      console.log(`Probando método de clic ${i + 1}`);
      await metodosClic[i]();
      // Esperar a ver si hay cambios
      await page.waitForTimeout(2000);

      // Verificar si la URL cambió
      const nuevaUrl = page.url();
      console.log(`URL después del clic: ${nuevaUrl}`);

      // Verificar si aparecieron nuevos elementos
      const elementosDespuesClic = await page.$$('input, textarea, select, button, a');
      console.log(`Elementos después del clic: ${elementosDespuesClic.length}`);

      if (elementosDespuesClic.length > 0) {
        console.log('El clic parece haber funcionado');
        return true;
      }
    } catch (error) {
      console.log(`Método ${i + 1} falló: ${error.message}`);
    }
  }

  console.log('Ningún método de clic funcionó');
  return false;
}

async function autofillFacturacion(data) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const url = data.url;
  const datos = data.datos;

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    let obligatoriosRestantes = Object.keys(datos.obligatorios);
    let intentos = 0;
    const maxIntentos = 5;

    while (obligatoriosRestantes.length > 0 && intentos < maxIntentos) {
      console.log(`\n=== INTENTO ${intentos + 1} ===`);
      console.log(`Campos obligatorios restantes: ${obligatoriosRestantes.join(', ')}`);

      await cerrarModales(page);

      const { campos, botones } = await detectarCamposEnPagina(page);

      console.log(`Campos detectados: ${campos.length}`);
      console.log(`Botones detectados: ${botones.length}`);

      const camposLlenados = [];
      for (const clave of obligatoriosRestantes) {
        const campo = encontrarCampoParaClave(campos, clave, mapeoPredefinido);
        if (campo) {
          console.log(`Llenando campo ${clave} con valor ${datos.obligatorios[clave]}`);
          await llenarCampo(page, campo, datos.obligatorios[clave]);
          camposLlenados.push(clave);
        } else {
          console.log(`No se encontró campo para ${clave}`);
        }
      }

      obligatoriosRestantes = obligatoriosRestantes.filter(clave => !camposLlenados.includes(clave));

      if (obligatoriosRestantes.length > 0) {
        const boton = encontrarBotonAdecuado(botones, ['agregar', 'siguiente', 'avanzar', 'buscar', 'facturar', 'enviar']);
        if (boton) {
          console.log(`Intentando hacer clic en botón: ${boton.text} (${boton.selector})`);

          const clicExitoso = await hacerClicConfiable(page, boton);

          if (clicExitoso) {
            console.log('Clic exitoso, esperando cambios en la página...');
            // Esperar a que la página cargue nuevos elementos
            await page.waitForTimeout(5000);

            // Verificar si hubo navegación
            const nuevaUrl = page.url();
            console.log(`Nueva URL después del clic: ${nuevaUrl}`);
          } else {
            console.log('El clic no produjo cambios visibles en la página');
            // Tomar screenshot para debug
            await page.screenshot({ path: `debug-intento-${intentos}.png` });
            console.log(`Screenshot guardado como debug-intento-${intentos}.png`);
          }

          intentos++;
        } else {
          console.log('No se encontró ningún botón clickeable adecuado');
          // Tomar screenshot para debug
          await page.screenshot({ path: `debug-intento-${intentos}.png` });
          console.log(`Screenshot guardado como debug-intento-${intentos}.png`);
          break;
        }
      } else {
        const botonFacturar = encontrarBotonAdecuado(botones, ['facturar', 'emitir', 'submit', 'enviar', 'generar']);
        if (botonFacturar) {
          console.log(`Haciendo clic en botón de facturación: ${botonFacturar.text} (${botonFacturar.selector})`);
          await page.click(botonFacturar.selector);
          break;
        } else {
          console.log('No se encontró botón de facturación');
          break;
        }
      }
    }

    if (obligatoriosRestantes.length > 0) {
      throw new Error(`No se pudieron llenar todos los campos obligatorios: ${obligatoriosRestantes.join(', ')}`);
    }

    // Esperar a que se complete la facturación
    await page.waitForTimeout(5000);
    await browser.close();

    return { success: true, message: 'Facturación completada' };
  } catch (error) {
    await browser.close();
    return { success: false, error: error.message };
  }
}

module.exports = { autofillFacturacion };