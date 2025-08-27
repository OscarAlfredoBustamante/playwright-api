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
  // Agrega más campos según necesites
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
    await page.waitForSelector('input, textarea, select, button', { timeout: 10000 });
  } catch (error) {
    // Si no encuentra elementos, retornar listas vacías
    console.log('No se encontraron elementos input, textarea, select o button en la página');
    return { campos: [], botones: [] };
  }

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
      selector: el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : el.placeholder ? `[placeholder="${el.placeholder}"]` : ''
    }));
  });

  const botones = await page.evaluate(() => {
    const elementos = document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]');
    return Array.from(elementos).map(el => {
      const computedStyle = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elementFromPoint = document.elementFromPoint(centerX, centerY);
      const isObscured = elementFromPoint !== el && !el.contains(elementFromPoint);

      const hasVisibleOverlay = () => {
        const overlays = document.querySelectorAll('.modal, .overlay, .popup, [role="dialog"]');
        return Array.from(overlays).some(overlay => {
          const style = window.getComputedStyle(overlay);
          return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) > 0.1;
        });
      };

      const clickeable = !el.disabled &&
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
        !hasVisibleOverlay();

      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        text: el.innerText.trim() || el.value || el.getAttribute('aria-label') || '',
        id: el.id || '',
        selector: el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : el.value ? `[value="${el.value}"]` : '',
        clickeable: clickeable,
        // Información adicional para debug
        disabled: el.disabled,
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        pointerEvents: computedStyle.pointerEvents,
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y
      };
    });
  });

  return { campos, botones };
}

function encontrarCampoParaClave(campos, clave, mapeoPredefinido) {
  const terminos = mapeoPredefinido[clave] || [clave];
  for (const campo of campos) {
    if (!campo.enabled || !campo.selector) continue;
    for (const termino of terminos) {
      const patron = new RegExp(termino, 'i');
      if ((campo.name && patron.test(campo.name)) ||
        (campo.id && patron.test(campo.id)) ||
        (campo.placeholder && patron.test(campo.placeholder))) {
        return campo;
      }
    }
  }
  return null;
}

async function llenarCampo(page, campo, valor) {
  try {
    await page.fill(campo.selector, valor);
  } catch (error) {
    // Intentar other methods if fill fails
    await page.focus(campo.selector);
    await page.type(campo.selector, valor);
  }
}

function encontrarBotonAdecuado(botones, preferencias) {
  console.log('=== ANALIZANDO BOTONES ===');
  console.log(`Preferencias: ${preferencias.join(', ')}`);
  
  const botonesClickeables = botones.filter(boton => boton.clickeable);
  const botonesNoClickeables = botones.filter(boton => !boton.clickeable);

  console.log(`Botones clickeables encontrados: ${botonesClickeables.length}`);
  botonesClickeables.forEach(boton => {
    console.log(`- ${boton.text} (${boton.selector}) - CLICKEABLE`);
  });

  console.log(`Botones no clickeables encontrados: ${botonesNoClickeables.length}`);
  botonesNoClickeables.forEach(boton => {
    console.log(`- ${boton.text} (${boton.selector}) - NO CLICKEABLE`);
    console.log(`  Razón: disabled=${boton.disabled}, display=${boton.display}, visibility=${boton.visibility}`);
    console.log(`  opacity=${boton.opacity}, pointerEvents=${boton.pointerEvents}`);
    console.log(`  width=${boton.width}, height=${boton.height}, x=${boton.x}, y=${boton.y}`);
  });

  for (const pref of preferencias) {
    const boton = botonesClickeables.find(b =>
      b.text && b.text.toLowerCase().includes(pref.toLowerCase())
    );
    if (boton) return boton;
  }
  
  // Si no encuentra, devolver el primer botón clickeable que no sea de cierre
  const botonesNoCerrar = botonesClickeables.filter(b =>
    !b.text.toLowerCase().includes('cerrar') &&
    !b.text.toLowerCase().includes('close')
  );
  return botonesNoCerrar[0] || botonesClickeables[0];
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
        const boton = encontrarBotonAdecuado(botones, ['siguiente', 'continuar', 'next', 'avanzar', 'buscar','facturar']);
        if (boton) {
          console.log(`Haciendo clic en botón: ${boton.text} (${boton.selector})`);
          try {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }),
              page.click(boton.selector)
            ]);
          } catch (error) {
            // No hubo navegación, esperar un cambio en la página
            console.log('No hubo navegación después del clic, esperando...');
            await page.waitForTimeout(3000);
          }
          intentos++;
        } else {
          console.log('No se encontró ningún botón clickeable adecuado');
          // Tomar screenshot para debug
          await page.screenshot({ path: `debug-intento-${intentos}.png` });
          console.log('Screenshot guardado como debug-intento-${intentos}.png');
          throw new Error('No se encontró botón para continuar');
        }
      } else {
        const botonFacturar = encontrarBotonAdecuado(botones, ['facturar', 'emitir', 'submit', 'enviar', 'generar']);
        if (botonFacturar) {
          console.log(`Haciendo clic en botón de facturación: ${botonFacturar.text} (${botonFacturar.selector})`);
          await page.click(botonFacturar.selector);
          break;
        } else {
          console.log('No se encontró botón de facturación');
          throw new Error('No se encontró botón para facturar');
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