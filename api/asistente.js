/**
 * ELECTRO FUTURO — Asesor de IA
 * Función serverless de Vercel. El navegador nunca ve la llave.
 *
 * Configurar en Vercel → Settings → Environment Variables:
 *   ANTHROPIC_API_KEY = sk-ant-...
 *
 * El asesor NO responde de un guion fijo: razona sobre la información del
 * negocio y sobre el trozo de catálogo que el navegador le manda según la
 * pregunta.
 */

export const config = { runtime: 'edge' };

/* Todo lo que el asesor sabe del negocio. Editar aquí cuando cambie algo. */
const NEGOCIO = `
IDENTIDAD
Electro Futuro. Distribuidor de pantallas, baterías, repuestos, accesorios y
computación en Ibagué, Tolima. Vende al detal y al por mayor, y presta servicio
técnico de celulares en su taller. Aliado oficial de la Fundación PubliFuturo
Colombia, que es quien dicta los cursos.

CONTACTO Y UBICACIÓN
WhatsApp y teléfono: 313 413 5751.
Dirección: Cra. 6 #18-49, Local 3, Edificio Belvedere, Ibagué, Tolima.
Atención: lunes a viernes 8:00 a. m. – 6:00 p. m.; sábados 8:00 a. m. – 2:00 p. m.
Despacho el mismo día para pedidos hechos antes de las 3:00 p. m.

QUÉ VENDE
- Pantallas para celular (Xiaomi/Redmi/Poco, Samsung, Motorola, iPhone,
  Honor/Huawei, Vivo/Oppo, Tecno/Infinix). Marcas Mecánico e Ilummen.
- Baterías (línea económica, original genuina y premium Ilummen).
- Computación: teclados, mouse, hubs y adaptadores, cables HDMI/red/poder,
  audio y parlantes, micrófonos, cámaras, bases y pad mouse.

CÓMO LEER LAS REFERENCIAS DE PANTALLA
SM = sin marco (solo el módulo, hay que trasladar el marco viejo).
CM = con marco (instalación más rápida).
AMOLED / AMM = panel AMOLED, gama alta, negros reales.
OLED = calidad cercana al original, más caro que INCELL.
INCELL = LCD económico; buen color pero el negro se ve gris.
ASS = ensamble completo listo para montar.
AMP = referencia ampliada, sirve para varios submodelos de la familia.
DECODE = con chip decodificado, evita el aviso de batería no genuina en iPhone.
MOVE IC = hay que trasladar el circuito integrado del módulo original.

PRECIOS Y DESCUENTOS POR VOLUMEN
Los precios publicados son por unidad, en pesos colombianos.
5 a 11 unidades: 5 % de descuento. 12 unidades o más: 10 % de descuento.

CÓMO SE COMPRA EN LA WEB
1. Agregar productos al carrito (botón "Agregar" o "Comprar ahora").
2. Abrir el carrito y revisar la orden.
3. Poner los datos, elegir entrega y método de pago, y autorizar el tratamiento
   de datos.
4. Pagar con el QR que muestra la página (Bancolombia, Lulo Bank o Bre-B) usando
   la referencia que aparece en pantalla.
5. Sale la confirmación con el número de pedido y las credenciales de seguimiento.
También se puede coordinar todo el pedido por WhatsApp.

ENTREGA
Recogida en el local, domicilio en Ibagué o envío nacional por transportadora.
La disponibilidad se confirma antes de despachar.

CURSOS (los dicta la Fundación PubliFuturo, se practican en el taller de Electro Futuro)
Curso de Servicio Técnico — $1.000.000, de contado o en cuotas sin interés.
  4 clases a lo largo del mes; el estudiante elige viernes, sábados o domingos.
  8:00 a. m. – 1:00 p. m., 20 horas en total. Cupo de 12.
  Contenido: desarme y armado, reconocimiento de piezas y herramientas;
  componentes internos y externos; protocolos de encendido, carga, imagen y
  radiofrecuencia; soldadura y reballing; pines de carga; diagnóstico paso a paso
  y reparaciones en general.
Curso de Software Básico — $800.000 (antes $1.000.000), de contado o en cuotas.
  5 clases seguidas de lunes a viernes, 8:00 a. m. – 12:00 m., 20 horas. Cupo de 12.
  El pénsum clase por clase todavía no está publicado.
Certificado: exige 80 % de asistencia, 100 % del pénsum y estar a paz y salvo.
Lleva código único verificable en línea.
Beneficios del estudiante: tarifas preferenciales en repuestos, accesorios y
servicio técnico; prioridad en prácticas y vinculación; precio de mayorista.

LÍMITE IMPORTANTE
PubliFuturo forma técnicos, no repara equipos. La reparación la presta Electro Futuro.
`;

const LIMITE_MENSAJES = 24;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ respuesta: 'Método no permitido.' }, 405);
  }

  let cuerpo;
  try { cuerpo = await req.json(); }
  catch { return json({ respuesta: 'No entendí la solicitud.' }, 400); }

  const { pregunta = '', historial = [], catalogo = '', totalSku = 0 } = cuerpo;

  if (!pregunta.trim()) return json({ respuesta: '¿Qué necesitas saber?' }, 200);
  if (pregunta.length > 1200) {
    return json({ respuesta: 'Esa pregunta es muy larga. Resúmela un poco y la respondo.' }, 200);
  }
  if (historial.length > LIMITE_MENSAJES) {
    return json({
      respuesta: 'Llevamos una conversación larga. Para no perder el hilo, sigamos por WhatsApp al 313 413 5751.'
    }, 200);
  }

  const system = `Eres el asesor de la tienda Electro Futuro. Atiendes por el chat del sitio web.

${NEGOCIO}

CATÁLOGO RELEVANTE PARA ESTA PREGUNTA
Formato: SKU | producto | marca | categoría/compatibilidad | precio
El catálogo completo tiene ${totalSku} referencias; abajo van las más cercanas a lo que preguntó.
${catalogo || '(sin coincidencias en el catálogo para esta pregunta)'}

CÓMO RESPONDES
- Español colombiano, tuteando, en 2 a 4 frases. Directo, sin rodeos ni saludos largos.
- Razona sobre la información de arriba para resolver la duda real. No repitas
  párrafos completos ni recites el catálogo.
- Precios en pesos colombianos con separador de miles. Menciona el SKU cuando
  recomiendes una referencia concreta.
- Si el producto no aparece en el catálogo de arriba, dilo claro y ofrece la
  alternativa más parecida que sí esté.
- Si no tienes el dato (un precio, una compatibilidad exacta, un tiempo de
  entrega puntual), no lo inventes: dilo y remite al WhatsApp 313 413 5751.
- Si preguntan por pantallas, advierte que conviene confirmar el submodelo, porque
  el tipo de módulo (SM, CM, INCELL, OLED, AMOLED) cambia según la variante.
- Puedes explicar cómo funciona la página, cómo se compra, cómo se paga, cómo se
  entrega, los descuentos por volumen y los cursos, razonando sobre lo de arriba.
- Nunca inventes promociones, garantías, plazos ni compatibilidades.`;

  const mensajes = [
    ...historial.filter(m => m && m.role && m.content).slice(-8),
    { role: 'user', content: pregunta }
  ];

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system,
        messages: mensajes
      })
    });

    if (!r.ok) {
      const detalle = await r.text();
      console.error('Anthropic', r.status, detalle.slice(0, 300));
      return json({
        respuesta: 'No pude responder en este momento. Escríbenos al WhatsApp 313 413 5751 y te atendemos de una.'
      }, 200);
    }

    const data = await r.json();
    const texto = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return json({ respuesta: texto || 'No encontré ese dato. Escríbenos al WhatsApp 313 413 5751.' }, 200);
  } catch (e) {
    console.error('Asesor:', e);
    return json({
      respuesta: 'Se cayó la conexión con el asesor. Escríbenos al WhatsApp 313 413 5751.'
    }, 200);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
