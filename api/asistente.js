/* Asesor IA de Electro Futuro — función serverless de Vercel.
   - Lee el catálogo real publicado (assets/js/productos.js) del mismo dominio.
   - Responde con Claude y devuelve botones de acción (sección, producto, categoría, WhatsApp).
   - GET /api/asistente  → diagnóstico (sirve para comprobar que la clave está puesta).
   Variables en Vercel: ANTHROPIC_API_KEY (obligatoria), ANTHROPIC_MODEL (opcional). */

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const WHATSAPP = '573134135751';
const SECCIONES = ['catalogo', 'cotizar', 'linea-tecnica', 'cursos', 'lista-precios', 'preguntas', 'ubicacion'];

let cache = { t: 0, productos: [] };

async function cargarCatalogo(req) {
  if (cache.productos.length && Date.now() - cache.t < 10 * 60 * 1000) return cache.productos;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const r = await fetch(`${proto}://${host}/assets/js/productos.js`, { cache: 'no-store' });
  if (!r.ok) throw new Error('No se pudo leer productos.js (' + r.status + ')');
  const txt = await r.text();
  const productos = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
  cache = { t: Date.now(), productos };
  return productos;
}

const pesos = (n) => (n == null ? 'consultar' : '$' + Number(n).toLocaleString('es-CO'));

function catalogoCompacto(productos) {
  return productos.map((p) => {
    const specs = Object.entries(p.specs || {}).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join('; ');
    return `${p.sku} | ${p.nombre} | ${p.marca} | ${p.categoria} > ${p.subcategoria} | ${pesos(p.precio)}${p.agotado ? ' | AGOTADO' : ''}${specs ? ' | ' + specs : ''}`;
  }).join('\n');
}

const NEGOCIO = `
Electro Futuro (by PubliFuturo) — distribuidora de tecnología y accesorios para celular en Ibagué, Tolima.
Dirección: Cra. 6 #18-49, Local 3, Edificio Belvedere, Ibagué. WhatsApp: 313 413 5751.
Horario: lunes a viernes 8 a. m. – 6 p. m.; sábados 8 a. m. – 2 p. m.
Ventas al detal y al por mayor. Envíos a todo Colombia o recogida en el local.
Pagos: Bancolombia, Lulo Bank y llave Bre-B (QR en el checkout). El pedido se arma en la tienda y se confirma por WhatsApp.
Línea técnica: pantallas (marca Mecánico) y baterías (Mecánico e Ilummen) para Xiaomi, Motorola, iPhone, Honor/Huawei, Vivo/Oppo, Samsung, Tecno/Infinix. Producto probado antes de despacho.
Academy (cursos presenciales):
- Curso de Servicio Técnico básico-intermedio (CST): $1.000.000, 4 clases (viernes, sábados o domingos a lo largo del mes), se puede pagar en cuotas. Temas: desarme y armado, reconocimiento de piezas, protocolos de encendido/carga/imagen/radiofrecuencia, soldadura (reballing) y pines de carga, diagnóstico paso a paso, reparaciones.
- Curso de Software Básico (CSB): $800.000 (antes $1.000.000), 5 clases seguidas de lunes a viernes.
Secciones de la página (usa estas claves exactas en los botones): catalogo, cotizar, linea-tecnica, cursos, lista-precios, preguntas, ubicacion.`;

function sistema(catalogo) {
  return [
    {
      type: 'text',
      text: `Eres el asesor de ventas de Electro Futuro en su tienda web. Hablas en español de Colombia, cercano y concreto, como un buen vendedor de mostrador.

Reglas:
- Responde SOLO con información del negocio y del catálogo de abajo. Si un dato no está (stock exacto, tiempos de envío a una ciudad, garantías puntuales), dilo y ofrece WhatsApp.
- Precios siempre en pesos colombianos con el valor exacto del catálogo. Si un producto está AGOTADO, dilo y sugiere una alternativa disponible parecida.
- Recomienda máximo 4 productos por respuesta, citando nombre y precio. Razona según lo que pide el cliente (compatibilidad, potencia, presupuesto, uso).
- "Réplica 1.1" significa réplica de alta calidad, no original: si preguntan por originales, distingue claramente.
- Respuestas cortas: 2 a 5 frases. Sin markdown, sin listas con viñetas, sin emojis en exceso.
- Devuelve SIEMPRE un JSON válido y nada más, con esta forma exacta:
{"respuesta":"texto para el cliente","botones":[{"texto":"Etiqueta corta","accion":"producto|seccion|categoria|whatsapp","valor":"..."}]}
- accion "producto": valor = SKU exacto del catálogo (ej. EF-CAB-021). Úsalo para cada producto que recomiendes.
- accion "seccion": valor = una de: ${SECCIONES.join(', ')}.
- accion "categoria": valor = nombre exacto de la categoría (ej. "Power bank y tomas").
- accion "whatsapp": valor = mensaje corto prellenado para el asesor humano.
- Entre 1 y 4 botones. Etiquetas de 2 a 5 palabras, en verbo cuando aplique ("Ver cargador 33W", "Ir a cursos").

DATOS DEL NEGOCIO:${NEGOCIO}

CATÁLOGO (${catalogo.split('\n').length} referencias; formato: SKU | nombre | marca | categoría > subcategoría | precio | estado | specs):
${catalogo}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

function limpiarBotones(botones, skus) {
  if (!Array.isArray(botones)) return [];
  return botones.filter((b) => b && b.texto && b.accion && b.valor).filter((b) => {
    if (b.accion === 'producto') return skus.has(String(b.valor).trim());
    if (b.accion === 'seccion') return SECCIONES.includes(b.valor);
    return ['categoria', 'whatsapp'].includes(b.accion);
  }).slice(0, 4).map((b) => ({ texto: String(b.texto).slice(0, 40), accion: b.accion, valor: String(b.valor).trim().slice(0, 300) }));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    let productos = 0, error = null;
    try { productos = (await cargarCatalogo(req)).length; } catch (e) { error = e.message; }
    return res.status(200).json({ ok: true, clave: Boolean(process.env.ANTHROPIC_API_KEY), modelo: MODELO, productos, error });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const respaldo = (motivo) => res.status(200).json({
    respaldo: true, motivo,
    respuesta: 'En este momento no puedo consultar el catálogo con el asesor inteligente. Te dejo las opciones más cercanas y el WhatsApp para atenderte de inmediato.',
    botones: [{ texto: 'Escribir por WhatsApp', accion: 'whatsapp', valor: 'Hola, necesito asesoría con un producto' }, { texto: 'Ver catálogo', accion: 'seccion', valor: 'catalogo' }],
  });

  if (!process.env.ANTHROPIC_API_KEY) return respaldo('sin_clave');

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const mensajes = (Array.isArray(body.mensajes) ? body.mensajes : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
    if (!mensajes.length || mensajes[mensajes.length - 1].role !== 'user') return res.status(400).json({ error: 'Falta la pregunta' });
    while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift();

    const productos = await cargarCatalogo(req);
    const skus = new Set(productos.map((p) => p.sku));

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELO, max_tokens: 700, system: sistema(catalogoCompacto(productos)), messages: mensajes }),
    });
    const data = await r.json();
    if (!r.ok) { console.error('Anthropic', r.status, JSON.stringify(data)); return respaldo('api_' + r.status); }

    const texto = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    let salida;
    try {
      const i = texto.indexOf('{'), j = texto.lastIndexOf('}');
      salida = JSON.parse(texto.slice(i, j + 1));
    } catch { salida = { respuesta: texto.replace(/```(json)?/g, '').trim(), botones: [] }; }

    const botones = limpiarBotones(salida.botones, skus);
    if (!botones.length) botones.push({ texto: 'Hablar con un asesor', accion: 'whatsapp', valor: 'Hola, vengo del asesor de la página' });
    return res.status(200).json({ respuesta: String(salida.respuesta || '').slice(0, 1500), botones });
  } catch (e) {
    console.error('asistente', e);
    return respaldo('error');
  }
};
