/* ============================================================
   ELECTROFUTURO — app.js v2
   Datos · filtros facetados · checkout WhatsApp · asistente IA
   ============================================================ */
const EF = {
  productos: [],
  fuente: 'local',
  pedido: JSON.parse(localStorage.getItem('ef_pedido') || '[]'),
  paso: 1
};
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const money = n => n == null ? 'Consultar'
  : '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('visible'), 2600);
}
/* ============================================================
   1. DATOS — Supabase con respaldo local
   ============================================================ */
async function cargarProductos() {
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = EF_CONFIG;
  if (url && key && !url.includes('TU-PROYECTO')) {
    try {
      const r = await fetch(`${url}/rest/v1/productos?select=*&order=categoria.asc,nombre.asc`,
        { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (Array.isArray(d) && d.length) { EF.productos = d; EF.fuente = 'supabase'; return marcarFuente(); }
      throw new Error('Tabla vacía');
    } catch (e) { console.warn('Supabase no disponible:', e.message); }
  }
  if (Array.isArray(window.EF_PRODUCTOS) && window.EF_PRODUCTOS.length) {
    EF.productos = window.EF_PRODUCTOS;
  } else {
    try {
      const r = await fetch('assets/data/productos.json', { cache: 'default' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      EF.productos = await r.json();
    } catch (e) {
      console.error('No se pudo cargar el catálogo:', e.message);
      EF.productos = [];
      toast('No se pudo cargar el catálogo. Recarga la página.');
    }
  }
  aplicarInventario();
  await aplicarStockPortal();
  marcarFuente();
}
/* El stock que se administra en admin.html manda sobre el catálogo público.
   Los SKU que todavía no se dieron de alta en inventario conservan su
   disponibilidad original: sin ficha no hay control de stock. */
/* El portal admin manda: si una referencia tiene existencias controladas y
   llegó a cero, la tienda la muestra como Agotado. Las que el portal aún no
   controla (nunca se les cargó stock) siguen como estaban. */
async function aplicarStockPortal() {
  if (!window.Nube) return;
  try {
    const st = await Nube.stock(3500);
    let n = 0;
    EF.productos.forEach(p => {
      const s = st[p.sku];
      if (!s) return;
      if (s.precio > 0) p.precio = s.precio;
      if (s.controla) { p.disponible = Math.max(0, s.stock); p.agotado = s.stock <= 0; n++; }
    });
    if (n) console.info(`Stock del portal aplicado a ${n} referencias`);
    Nube.reintentarCola();
  } catch (e) { console.warn('Stock del portal:', e.message); }
}
function aplicarInventario() {
  if (typeof Datos === 'undefined') return;
  const inv = Datos.inventario();
  EF.productos.forEach(p => {
    const f = inv[p.sku];
    if (!f) return;
    if (f.precio) p.precio = f.precio;
    p.disponible = Math.max(0, (f.stock || 0) - (f.reservado || 0));
    p.agotado = !f.activo || p.disponible <= 0;
  });
}
function marcarFuente() {
  const el = $('#estado-datos');
  if (!el) return;
  const ok = EF.fuente === 'supabase';
  el.innerHTML = `<span class="punto ${ok ? 'ok' : 'local'}"></span>
    ${EF.productos.length} SKU · ${ok ? 'Supabase conectado' : 'Catálogo local'}`;
}
/* ============================================================
   2. CARDS
   ============================================================ */
const etiqueta = p => p.agotado ? 'Agotado' : (p.tags && p.tags[0]) || p.categoria;
/* Tipos de módulo que aparecen en los nombres del catálogo técnico.
   Se detectan del nombre para mostrarlos como chips y explicarlos. */
const MODULOS = {
  'AMOLED':   { et: 'AMOLED',   desc: 'Panel AMOLED. Negros reales y mejor consumo. Es el módulo original de gama alta.' },
  'AMM':      { et: 'AMOLED',   desc: 'Panel AMOLED. Negros reales y mejor consumo. Es el módulo original de gama alta.' },
  'OLED':     { et: 'OLED',     desc: 'Panel OLED. Calidad cercana al original, más caro que el INCELL.' },
  'INCELL':   { et: 'INCELL',   desc: 'Panel LCD INCELL. Alternativa económica al OLED; el color es bueno pero el negro se ve gris.' },
  ' CM ':     { et: 'CON MARCO',desc: 'Viene con el marco puesto. Instalación más rápida y sin riesgo de doblar el marco viejo.' },
  ' SM ':     { et: 'SIN MARCO',desc: 'Solo el módulo, sin marco. Más económico, pero hay que trasladar el marco del equipo.' },
  'ASS':      { et: 'ENSAMBLE', desc: 'Ensamble completo, listo para montar.' },
  'AMP':      { et: 'AMPLIADO', desc: 'Módulo de referencia ampliada: sirve para varios submodelos de la misma familia.' },
  'GENUINA':  { et: 'GENUINA',  desc: 'Celda original del fabricante. Mayor ciclo de vida y capacidad real.' },
  'ORIGINAL': { et: 'ORIGINAL', desc: 'Componente original, no compatible genérico.' },
  'ECONÓM':   { et: 'ECONÓMICA',desc: 'Alternativa de menor costo. Capacidad y ciclos por debajo de la genuina.' },
  'DECODE':   { et: 'DECODE',   desc: 'Con chip decodificado: evita el aviso de batería no genuina en iPhone.' },
  'MOVE IC':  { et: 'MOVE IC',  desc: 'Requiere trasladar el circuito integrado del módulo original.' },
  'OP':       { et: 'OP',       desc: 'Calidad OP, intermedia entre el genérico y el original.' },
  'AG':       { et: 'AG',       desc: 'Acabado antihuella (anti-glare).' }
};
function modulosDe(nombre) {
  const n = ' ' + nombre.toUpperCase() + ' ';
  const vistos = new Set(), salida = [];
  for (const [clave, info] of Object.entries(MODULOS)) {
    if (n.includes(clave) && !vistos.has(info.et)) { vistos.add(info.et); salida.push(info); }
  }
  return salida;
}
function foto(p) {
  if (p.imagen) return `<img src="${p.imagen}" alt="${esc(p.nombre)}" loading="lazy" decoding="async">`;
  return '';
}
/* Tarjeta de datos para las referencias sin fotografía:
   en vez de un hueco, muestra lo que el técnico realmente necesita ver. */
function fichaTecnica(p) {
  const mods = modulosDe(p.nombre).slice(0, 3);
  const sello = p.categoria === 'Baterías' ? 'BAT' : 'LCD';
  const premium = p.marca === 'Ilummen';
  return `
    <div class="prod-ficha" data-ver="${p.sku}" role="button" tabindex="0"
         aria-label="Ver detalles de ${esc(p.nombre)}">
      <span class="equipo">${esc(p.subcategoria)}</span>
      <span class="modelo">${esc(p.nombre)}</span>
      <span class="modulos">
        ${mods.map(m => `<span class="mod">${m.et}</span>`).join('')}
        ${premium ? '<span class="mod premium">Premium</span>' : ''}
      </span>
      <span class="sello">${sello}</span>
    </div>`;
}
function cardProducto(p) {
  const visual = p.imagen
    ? `<div class="prod-foto" data-ver="${p.sku}" role="button" tabindex="0"
            aria-label="Ver detalles de ${esc(p.nombre)}">
         <span class="etiqueta">${esc(etiqueta(p))}</span>
         ${foto(p)}
         <span class="lupa">⌕</span>
       </div>`
    : fichaTecnica(p);
  return `
  <article class="prod ${p.agotado ? 'agotada' : ''} ${p.imagen ? '' : 'sinfoto'}">
    ${visual}
    <div class="prod-cuerpo">
      <div class="sku">${p.sku}</div>
      <h3 data-ver="${p.sku}">${esc(p.nombre)}</h3>
      <p class="marca-p">${esc(p.marca)} · ${esc(p.subcategoria)}</p>
      <div class="pie">
        <div class="precio">${money(p.precio)}<small>${p.precio != null ? 'COP' : 'Disponibilidad'}</small></div>
      </div>
      <div class="prod-acciones">
        ${p.agotado
          ? '<span class="badge-agotado">Agotado</span>'
          : `<button class="add" data-sku="${p.sku}" aria-label="Agregar ${esc(p.nombre)} al pedido">Agregar</button>
             <button class="comprar" data-comprar="${p.sku}" aria-label="Comprar ${esc(p.nombre)} ahora">Comprar ahora</button>`}
      </div>
    </div>
  </article>`;
}
function pintarDestacados() {
  const cont = $('#destacados');
  if (!cont) return;
  const fijos = ['EF-CO-009', 'EF-CO-039', 'EF-CO-079', 'EF-CO-021'];
  let l = fijos.map(s => EF.productos.find(p => p.sku === s)).filter(Boolean);
  if (l.length < 4) l = EF.productos.filter(p => p.imagen && !p.agotado).slice(0, 4);
  cont.innerHTML = l.map(cardProducto).join('');
}
function pintarConteos() {
  $$('[data-conteo]').forEach(el => {
    const c = el.dataset.conteo;
    el.textContent = EF.productos.filter(p => p.categoria === c || p.subcategoria === c).length + ' referencias';
  });
  const t = $('#total-sku');
  if (t) t.textContent = EF.productos.length;
}
/* ============================================================
   3. FILTROS FACETADOS
   Las marcas y subcategorías se recalculan según lo ya filtrado
   ============================================================ */
const estado = { q: '', categorias: [], subcategorias: [], marcas: [], soloDisponibles: false, orden: 'relevancia' };
// Filtra ignorando una faceta, para poder contar sus opciones disponibles
function aplicar(productos, omitir) {
  const q = estado.q.trim().toLowerCase();
  return productos.filter(p => {
    if (estado.soloDisponibles && p.agotado) return false;
    if (omitir !== 'categoria' && estado.categorias.length && !estado.categorias.includes(p.categoria)) return false;
    if (omitir !== 'subcategoria' && estado.subcategorias.length && !estado.subcategorias.includes(p.subcategoria)) return false;
    if (omitir !== 'marca' && estado.marcas.length && !estado.marcas.includes(p.marca)) return false;
    if (q) {
      const blob = [p.nombre, p.marca, p.subcategoria, p.categoria, p.sku, ...(p.tags || [])].join(' ').toLowerCase();
      if (!q.split(/\s+/).every(t => blob.includes(t))) return false;
    }
    return true;
  });
}
function contar(campo) {
  return aplicar(EF.productos, campo).reduce((a, p) => (a[p[campo]] = (a[p[campo]] || 0) + 1, a), {});
}
function pintarFaceta(contenedorId, campo, seleccion, limite = 8) {
  const cont = $('#' + contenedorId);
  if (!cont) return;
  const cuentas = contar(campo);
  const claves = Object.keys(cuentas).sort((a, b) => cuentas[b] - cuentas[a] || a.localeCompare(b, 'es'));
  // las opciones ya marcadas siempre se muestran, aunque su cuenta sea 0
  seleccion.forEach(s => { if (!claves.includes(s)) claves.unshift(s); });
  const abierto = cont.dataset.abierto === '1';
  cont.innerHTML = claves.map((k, i) => `
    <label class="filtro-op ${!abierto && i >= limite ? 'oculta' : ''}">
      <input type="checkbox" value="${esc(k)}" data-f="${campo}" ${seleccion.includes(k) ? 'checked' : ''}>
      <span>${esc(k)}</span><span class="n">${cuentas[k] || 0}</span>
    </label>`).join('')
    + (claves.length > limite
        ? `<button class="ver-mas" data-abrir="${contenedorId}">${abierto ? '− Ver menos' : `+ Ver ${claves.length - limite} más`}</button>`
        : '');
}
function pintarFiltros() {
  pintarFaceta('f-categorias', 'categoria', estado.categorias, 10);
  pintarFaceta('f-subcategorias', 'subcategoria', estado.subcategorias, 8);
  pintarFaceta('f-marcas', 'marca', estado.marcas, 8);
  $('#f-disponibles').checked = estado.soloDisponibles;
}
function pintarChips() {
  const cont = $('#chips');
  if (!cont) return;
  const activos = [
    ...estado.categorias.map(v => ['categoria', v]),
    ...estado.subcategorias.map(v => ['subcategoria', v]),
    ...estado.marcas.map(v => ['marca', v])
  ];
  if (estado.q) activos.unshift(['q', estado.q]);
  if (estado.soloDisponibles) activos.push(['disponibles', 'Solo disponibles']);
  cont.innerHTML = activos.map(([c, v]) =>
    `<span class="chip">${esc(v)}<button data-quitar="${c}" data-valor="${esc(v)}" aria-label="Quitar filtro">×</button></span>`
  ).join('');
}
function filtrar() {
  const l = aplicar(EF.productos, null);
  if (estado.orden === 'precio-asc')  l.sort((a, b) => (a.precio ?? 1e9) - (b.precio ?? 1e9));
  if (estado.orden === 'precio-desc') l.sort((a, b) => (b.precio ?? -1) - (a.precio ?? -1));
  if (estado.orden === 'nombre')      l.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (estado.orden === 'relevancia')  l.sort((a, b) => (b.imagen ? 1 : 0) - (a.imagen ? 1 : 0));
  return l;
}
function pintarCatalogo() {
  const cont = $('#grid-catalogo');
  if (!cont) return;
  const l = filtrar();
  $('#conteo').textContent = `${l.length} de ${EF.productos.length} referencias`;
  cont.innerHTML = l.length ? l.map(cardProducto).join('')
    : `<div class="vacio" style="grid-column:1/-1">
         <h3>Sin resultados para esa búsqueda</h3>
         <p>Prueba con el nombre del equipo (ej. «Redmi Note 13»), la marca o el código SKU.</p>
       </div>`;
  pintarFiltros();
  pintarChips();
  $$('.cat[data-ir-cat]').forEach(b =>
    b.classList.toggle('activa', estado.categorias.includes(b.dataset.irCat)));
}
function irAlCatalogo({ cat, sub, marca, q } = {}) {
  Object.assign(estado, { categorias: [], subcategorias: [], marcas: [], q: '', soloDisponibles: false });
  if (cat) estado.categorias = [cat];
  if (sub) estado.subcategorias = [sub];
  if (marca) estado.marcas = [marca];
  if (q) estado.q = q;
  $('#buscar').value = q || '';
  $('#buscar-hero').value = '';
  pintarCatalogo();
  $('#catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
/* ============================================================
   3.b MODAL DE PRODUCTO
   ============================================================ */
const MODAL = { sku: null, qty: 1 };
function escalaPrecio(precio) {
  if (precio == null) return '';
  const f = (n, d) => `<div class="fila ${d ? 'mejor' : ''}">
      <span>${n}</span><b>${money(Math.round(precio * (1 - d)))} c/u</b></div>`;
  return `<div class="modal-escala">
    <h5>Precio según cantidad</h5>
    ${f('1 a 4 unidades', 0)}
    ${f('5 a 11 unidades · −5 %', .05)}
    ${f('12 o más · −10 %', .10)}
  </div>`;
}
function abrirModal(sku) {
  const p = EF.productos.find(x => x.sku === sku);
  if (!p) return;
  MODAL.sku = sku;
  MODAL.qty = 1;
  const ic = p.categoria === 'Pantallas' ? '▭' : p.categoria === 'Baterías' ? '▮' : '⌁';
  const specs = Object.entries(p.specs || {});
  const mods = modulosDe(p.nombre);
  const vis = $('#modal-visual');
  vis.classList.toggle('ficha', !p.imagen);
  vis.innerHTML = (p.imagen
      ? `<img src="${p.imagen}" alt="${esc(p.nombre)}">`
      : `<div class="ficha-grande">
           <div class="eq">${esc(p.subcategoria)}</div>
           <div class="mo">${esc(p.nombre)}</div>
           <div class="chips">${mods.map(m => `<span>${m.et}</span>`).join('')}</div>
         </div>`)
    + `<span class="marca-agua">Electrofuturo · ${p.sku}</span>`;
  $('#modal-datos').innerHTML = `
    <div class="breadcrumb">${esc(p.categoria)} · <b>${esc(p.subcategoria)}</b></div>
    <h3>${esc(p.nombre)}</h3>
    <div class="modal-tags">
      <span>${esc(p.marca)}</span>
      ${(p.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}
      ${p.agotado ? '<span class="agot">Agotado</span>' : '<span class="stock">Disponible</span>'}
      ${p.linea === 'tecnica' ? '<span>Línea técnica</span>' : ''}
    </div>
    <div class="modal-precio">
      <span class="v">${money(p.precio)}</span>
      <span class="u">${p.precio != null ? 'COP · IVA incluido' : 'Precio por confirmar'}</span>
    </div>
    ${p.agotado ? '' : escalaPrecio(p.precio)}
    ${mods.length ? `<div class="modal-glosario">
      <h5>Qué significa esta referencia</h5>
      <dl style="margin:0">
        ${mods.map(m => `<div class="g"><dt>${m.et}</dt><dd>${m.desc}</dd></div>`).join('')}
      </dl>
    </div>` : ''}
    ${specs.length ? `<div class="modal-specs">
      <h5>Características</h5>
      <dl style="margin:0">
        ${specs.map(([k, v]) => `<div class="fila"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
      </dl>
    </div>` : ''}
    <div class="modal-acciones">
      ${p.agotado
        ? `<button class="btn btn-linea btn-bloque" id="modal-avisar">Avísame cuando llegue</button>`
        : `<div class="modal-qty">
             <button data-mq="-1" aria-label="Quitar una unidad">−</button>
             <span id="modal-qty">1</span>
             <button data-mq="1" aria-label="Agregar una unidad">+</button>
           </div>
           <button class="btn btn-primario" id="modal-add">Agregar al pedido <span class="fl">→</span></button>
           <button class="btn btn-linea" id="modal-consultar">Consultar</button>`}
      <p class="modal-nota">${p.categoria === 'Pantallas'
        ? 'Antes de pedir, confirma el submodelo por WhatsApp: el tipo de módulo (SM, CM, INCELL, OLED) cambia según la variante del equipo.'
        : 'Confirmamos disponibilidad y valor del envío por WhatsApp antes de despachar.'}</p>
    </div>`;
  $('#modal-fondo').classList.add('abierto');
  document.body.style.overflow = 'hidden';
}
function cerrarModal() {
  $('#modal-fondo').classList.remove('abierto');
  document.body.style.overflow = '';
  MODAL.sku = null;
}
function modalConsultar() {
  const p = EF.productos.find(x => x.sku === MODAL.sku);
  if (!p) return;
  const txt = `Hola, quiero información sobre:\n\n*${p.nombre}*\nCódigo: ${p.sku}\nPrecio publicado: ${money(p.precio)}\n\n¿Está disponible?`;
  window.open(`https://wa.me/${EF_CONFIG.WHATSAPP}?text=${encodeURIComponent(txt)}`, '_blank');
}
function modalAvisar() {
  const p = EF.productos.find(x => x.sku === MODAL.sku);
  if (!p) return;
  /* Queda registrado el interés: cuando entre stock, el portal admin
     levanta la alerta con el WhatsApp del cliente ya armado. */
  if (typeof Datos !== 'undefined') {
    const tel = prompt('¿A qué WhatsApp te avisamos cuando llegue?');
    if (tel) {
      Datos.pedirAviso(p.sku, prompt('¿Tu nombre?') || 'Cliente', tel.replace(/\D/g, ''));
      toast('Listo, te avisamos apenas entre');
    }
  }
  const txt = `Hola, quiero que me avisen cuando vuelva a entrar:\n\n*${p.nombre}*\nCódigo: ${p.sku}`;
  window.open(`https://wa.me/${EF_CONFIG.WHATSAPP}?text=${encodeURIComponent(txt)}`, '_blank');
}
/* ============================================================
   4. PEDIDO Y CHECKOUT EN 4 PASOS
   ============================================================ */
const CHK = {
  paso: 1,
  entrega: 'recogida',
  flete: 0,
  pago: 'Bre-B',
  referencia: null,
  numero: null
};
const NOMBRES_PASO = ['Verificar la orden', 'Entrega y pago', 'Realizar el pago', 'Pedido confirmado'];
const guardar = () => {
  // OJO: nunca guardar aquí la imagen del producto (base64 pesado). El pedido en
  // localStorage solo lleva sku/nombre/precio/qty; la foto se busca en EF.productos
  // al momento de pintar. Guardar la imagen completa por cada ítem llenaba la cuota
  // de localStorage con 2-3 productos y el guardado fallaba en silencio: el producto
  // quedaba agregado en memoria pero el carrito no se actualizaba en pantalla.
  try {
    localStorage.setItem('ef_pedido', JSON.stringify(EF.pedido));
  } catch (err) {
    console.error('No se pudo guardar el pedido en localStorage:', err);
  }
  pintarPedido();
};
function agregar(sku, cantidad = 1) {
  const p = EF.productos.find(x => x.sku === sku);
  if (!p) return;
  const ex = EF.pedido.find(x => x.sku === sku);
  if (ex) ex.qty += cantidad;
  else EF.pedido.push({ sku, nombre: p.nombre, precio: p.precio, qty: cantidad });
  guardar();
  toast(`${p.nombre} · ${cantidad} ${cantidad === 1 ? 'unidad agregada' : 'unidades agregadas'}`);
}
function comprarAhora(sku) {
  agregar(sku, 1);
  abrirPedido(true);
}
/* Confirmacion en el mismo boton: nada de alertas ni saltos de pagina. */
function destello(btn, texto = 'Agregado \u2713') {
  if (!btn || btn._ef) return;
  const antes = btn.textContent;
  btn._ef = true;
  btn.textContent = texto;
  btn.classList.add('ok');
  setTimeout(() => { btn.textContent = antes; btn.classList.remove('ok'); btn._ef = false; }, 1200);
}
function cambiarQty(sku, d) {
  const it = EF.pedido.find(x => x.sku === sku);
  if (!it) return;
  it.qty += d;
  if (it.qty <= 0) EF.pedido = EF.pedido.filter(x => x.sku !== sku);
  guardar();
}
const subtotal  = () => EF.pedido.reduce((a, x) => a + (x.precio || 0) * x.qty, 0);
const unidades  = () => EF.pedido.reduce((a, x) => a + x.qty, 0);
const descuento = () => { const u = unidades(); return u >= 12 ? .10 : u >= 5 ? .05 : 0; };
const totalFinal = () => Math.round(subtotal() * (1 - descuento())) + (CHK.paso >= 2 ? CHK.flete : 0);
function pintarPedido() {
  const n = unidades();
  const c = $('#contador-pedido');
  if (c) { c.textContent = n; c.style.display = n ? 'grid' : 'none'; }
  const f = $('#carrito-flotante'), fn = $('#contador-flotante');
  if (f && fn) {
    fn.textContent = n;
    f.classList.toggle('visible', n > 0);
    if (n !== pintarPedido._ultimo) {
      f.classList.remove('pulso'); void f.offsetWidth; f.classList.add('pulso');
      pintarPedido._ultimo = n;
    }
  }
  const cont = $('#pedido-items');
  if (!cont) return;
  cont.innerHTML = EF.pedido.length
    ? EF.pedido.map(i => {
        const prod = EF.productos.find(x => x.sku === i.sku);
        const img = prod && prod.imagen;
        return `
      <div class="pedido-item">
        <div class="mini">${img ? `<img src="${img}" alt="">` : `<span>${i.sku.split('-')[1]}</span>`}</div>
        <div class="info">
          <div class="sku">${i.sku}</div>
          <h4>${esc(i.nombre)}</h4>
          <div class="pr">${money(i.precio)} c/u · ${money((i.precio || 0) * i.qty)}</div>
        </div>
        <div class="qty">
          <button data-q="-1" data-sku="${i.sku}" aria-label="Quitar una unidad">−</button>
          <span>${i.qty}</span>
          <button data-q="1" data-sku="${i.sku}" aria-label="Agregar una unidad">+</button>
        </div>
      </div>`;
      }).join('')
    : `<div class="vacio"><h3>Tu pedido está vacío</h3>
        <p>Agrega productos del catálogo para continuar.</p>
        <button class="btn btn-primario" id="ir-catalogo">Ver el catálogo</button></div>`;
  const sub = subtotal(), d = descuento();
  $('#p-unidades').textContent = n + (n === 1 ? ' unidad' : ' unidades');
  $('#p-subtotal').textContent = money(sub);
  $('#linea-descuento').style.display = d ? 'flex' : 'none';
  $('#p-descuento').textContent = '− ' + money(Math.round(sub * d)) + `  (${Math.round(d * 100)}%)`;
  $('#linea-flete').style.display = (CHK.paso >= 2 && CHK.flete) ? 'flex' : 'none';
  $('#p-flete').textContent = money(CHK.flete);
  $('#pedido-total').textContent = money(totalFinal());
  const falta = n >= 12 ? 0 : n >= 5 ? 12 - n : 5 - n;
  const av = $('#aviso-volumen');
  av.style.display = (falta && n) ? 'block' : 'none';
  if (falta && n) av.textContent = `Agrega ${falta} ${falta === 1 ? 'unidad' : 'unidades'} más y obtienes ${n >= 5 ? '10' : '5'} % de descuento.`;
  if (CHK.paso === 1) $('#paso-siguiente').disabled = !EF.pedido.length;
}
/* ---------- Navegación entre pasos ---------- */
function irPaso(n) {
  CHK.paso = n;
  $$('.vista').forEach(v => v.classList.toggle('activa', v.id === 'vista-' + n));
  $$('.paso').forEach(p => {
    const i = Number(p.dataset.p);
    p.classList.toggle('activo', i === n);
    p.classList.toggle('hecho', i < n);
  });
  $('#paso-nombre').textContent = NOMBRES_PASO[n - 1];
  $('#paso-num').textContent = `Paso ${n} de 4`;
  $('#pedido-titulo').textContent = n === 4 ? 'Listo' : 'Mi pedido';
  const sig = $('#paso-siguiente'), atras = $('#paso-atras'), wa = $('#enviar-wa');
  const totales = $('#totales-pie'), nota = $('#pedido-nota');
  totales.style.display = n === 4 ? 'none' : '';
  atras.style.display = (n === 2 || n === 3) ? '' : 'none';
  wa.style.display = 'none';
  sig.style.display = '';
  if (n === 1) {
    sig.innerHTML = 'Continuar <span class="fl">→</span>';
    sig.disabled = !EF.pedido.length;
    nota.textContent = 'Es una cotización: no se cobra nada aquí.';
  }
  if (n === 2) {
    sig.innerHTML = 'Ir al pago <span class="fl">→</span>';
    sig.disabled = false;
    nota.textContent = 'Confirmamos disponibilidad antes de despachar.';
  }
  if (n === 3) {
    sig.style.display = 'none';
    wa.style.display = '';
    wa.textContent = 'Prefiero coordinar por WhatsApp';
    nota.textContent = 'El pago se verifica solo; no tienes que enviar comprobante.';
    prepararPago();
  }
  if (n === 4) {
    sig.innerHTML = 'Seguir comprando';
    sig.disabled = false;
    atras.style.display = 'none';
    wa.style.display = '';
    wa.textContent = 'Escribirle a Electrofuturo';
    nota.textContent = 'Guarda tus credenciales: te dan acceso al seguimiento.';
  }
  pintarPedido();
}
function validarDatos() {
  const req = [['c-nombre', 1], ['c-telefono', 1], ['c-correo', 1],
               ['c-direccion', CHK.entrega !== 'recogida']];
  let ok = true;
  req.forEach(([id, obligatorio]) => {
    const el = $('#' + id);
    const campo = el.closest('.campo');
    const vacio = obligatorio && !el.value.trim();
    campo.classList.toggle('error', vacio);
    if (vacio) ok = false;
  });
  const correo = $('#c-correo').value.trim();
  if (correo && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(correo)) {
    $('#c-correo').closest('.campo').classList.add('error');
    toast('Revisa el correo, parece incompleto');
    return false;
  }
  if (!ok) toast('Completa los campos marcados');
  return ok;
}
/* ---------- Paso 3: pago ---------- */
function referenciaNueva() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin caracteres confundibles
  return 'EF-' + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}
function prepararPago() {
  if (!CHK.referencia) CHK.referencia = referenciaNueva();
  $('#qr-ref').textContent = CHK.referencia;
  $('#qr-metodo').textContent = CHK.pago;
  $('#qr-total').textContent = money(totalFinal());
  $('#qr-caja').style.display = '';
  $('#verificando').classList.remove('activo');
}
const PASOS_VERIFICACION = [
  'Consultando notificación bancaria',
  'Validando firma del remitente',
  'Comparando monto con el pedido',
  'Conciliando referencia ' 
];
function simularVerificacion() {
  $('#qr-caja').style.display = 'none';
  $('#verificando').classList.add('activo');
  $('#enviar-wa').style.display = 'none';
  let i = 0;
  const et = $('#paso-verificacion');
  const t = setInterval(() => {
    i++;
    if (i < PASOS_VERIFICACION.length) {
      et.textContent = PASOS_VERIFICACION[i] + (i === 3 ? CHK.referencia : '');
    } else {
      clearInterval(t);
      confirmarPedido();
    }
  }, 850);
}
/* Deja el pedido en la base compartida (datos.js) para que aparezca en el
   portal administrativo y en el portal del cliente, y reserve inventario. */
function codigoWeb() {
  const d = new Date();
  const f = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const r = (Date.now().toString(36).slice(-3) + Math.random().toString(36).slice(2, 5)).toUpperCase();
  return `EF-${f}-${r}`;
}
function registrarPedido(correo) {
  const codigo = codigoWeb();
  const datos = {
    codigo,
    cliente: {
      nombre: $('#c-nombre').value.trim(),
      telefono: $('#c-telefono').value.trim(),
      correo,
      ciudad: $('#c-ciudad').value.trim(),
      direccion: $('#c-direccion').value.trim()
    },
    items: EF.pedido.map(i => ({ sku: i.sku, nombre: i.nombre, precio: i.precio, qty: i.qty })),
    entrega: CHK.entrega === 'recogida' ? 'recoger' : 'envio',
    metodoPago: CHK.pago,
    referenciaPago: CHK.referencia,
    subtotal: subtotal(),
    descuento: Math.round(subtotal() * descuento()),
    envio: CHK.flete,
    total: totalFinal(),
    pagado: true,
    estado: 'confirmado',
    origen: 'web',
    consentimiento: window.EF_consentimiento ? window.EF_consentimiento() : null
  };
  /* Copia local: la usa el portal de clientes en este dispositivo */
  if (typeof Datos !== 'undefined') {
    try { Datos.crearPedido(datos, 'tienda'); }
    catch (e) { console.error('No se pudo guardar la copia local del pedido:', e); }
  }
  /* El pedido viaja al portal admin: llega como venta en espera */
  if (window.Nube) {
    Nube.enviarPedido({
      codigo, fecha: new Date().toISOString(),
      cliente: Object.assign({}, datos.cliente),
      items: datos.items,
      entrega: datos.entrega, pago: datos.metodoPago, referencia: datos.referenciaPago,
      subtotal: datos.subtotal, descuento: datos.descuento, envio: datos.envio, total: datos.total,
      consentimiento: datos.consentimiento
    }).then(r => { if (r.modo === 'cola') console.warn('Pedido en cola, se reintenta en la próxima visita'); });
  }
  return codigo;
}
function confirmarPedido() {
  const correo = $('#c-correo').value.trim() || 'cliente@correo.com';
  CHK.numero = registrarPedido(correo);
  const clave = 'EF' + Math.random().toString(36).slice(2, 8).toUpperCase();
  $('#ok-numero').textContent = CHK.numero;
  $('#ok-total').textContent = money(totalFinal());
  $('#ok-usuario').textContent = correo;
  $('#ok-clave').textContent = clave;
  $('#tr-fecha').textContent = new Date().toLocaleDateString('es-CO',
    { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const dias = CHK.entrega === 'recogida' ? 'Hoy mismo en tienda'
             : CHK.entrega === 'ibague' ? 'Hoy en Ibagué' : 'En 1 a 3 días hábiles';
  $('#tr-entrega').textContent = dias;
  // El pedido queda guardado para el portal de seguimiento
  const historial = JSON.parse(localStorage.getItem('ef_historial') || '[]');
  historial.unshift({
    numero: CHK.numero, referencia: CHK.referencia, fecha: new Date().toISOString(),
    total: totalFinal(), items: EF.pedido, entrega: CHK.entrega, pago: CHK.pago, estado: 'en_empaque',
    cliente: { nombre: $('#c-nombre').value.trim(), telefono: $('#c-telefono').value.trim(),
               correo, ciudad: $('#c-ciudad').value.trim(), direccion: $('#c-direccion').value.trim() },
    consentimiento: window.EF_consentimiento ? window.EF_consentimiento() : null
  });
  localStorage.setItem('ef_historial', JSON.stringify(historial.slice(0, 20)));
  EF.pedido = [];
  localStorage.setItem('ef_pedido', '[]');
  aplicarInventario();
  pintarCatalogo();
  irPaso(4);
}
function enviarWhatsApp() {
  const nombre = $('#c-nombre').value.trim() || 'Cliente';
  const tel    = $('#c-telefono').value.trim();
  const ciudad = $('#c-ciudad').value.trim();
  const dir    = $('#c-direccion').value.trim();
  const notas  = $('#c-notas').value.trim();
  const sub = subtotal(), d = descuento();
  const entregaTxt = { recogida: 'Recogida en tienda', ibague: 'Domicilio en Ibagué',
                       nacional: 'Envío nacional' }[CHK.entrega];
  const lineas = (EF.pedido.length ? EF.pedido : (JSON.parse(localStorage.getItem('ef_historial') || '[]')[0]?.items || []))
    .map(i => `• ${i.qty}× ${i.nombre}\n   ${i.sku} — ${money(i.precio)} c/u`);
  const txt = [
    '*PEDIDO ELECTROFUTURO*',
    CHK.numero ? `Pedido ${CHK.numero}` : '',
    CHK.referencia ? `Referencia ${CHK.referencia}` : '',
    '',
    `*Cliente:* ${nombre}`,
    tel ? `*WhatsApp:* ${tel}` : '',
    ciudad ? `*Ciudad:* ${ciudad}` : '',
    dir ? `*Dirección:* ${dir}` : '',
    `*Entrega:* ${entregaTxt}`,
    `*Pago:* ${CHK.pago}`,
    notas ? `*Notas:* ${notas}` : '',
    '',
    '*Productos*',
    lineas.join('\n'),
    '',
    `Subtotal: ${money(sub)}`,
    d ? `Descuento por volumen (${d * 100}%): − ${money(Math.round(sub * d))}` : '',
    CHK.flete ? `Envío: ${money(CHK.flete)}` : '',
    `*Total: ${money(totalFinal())}*`
  ].filter(Boolean).join('\n');
  window.open(`https://wa.me/${EF_CONFIG.WHATSAPP}?text=${encodeURIComponent(txt)}`, '_blank');
}
const abrirPedido = v => {
  $('#pedido').classList.toggle('abierto', v);
  $('#pedido-fondo').classList.toggle('abierto', v);
  if (v && CHK.paso === 4) { CHK.paso = 1; CHK.referencia = null; CHK.numero = null; }
  if (v) irPaso(CHK.paso === 4 ? 1 : CHK.paso);
};
/* ============================================================
   5. ASISTENTE IA
   ============================================================ */
const IA = { historial: [], ocupado: false };
const abrirIA = v => {
  $('#ia-panel').classList.toggle('abierto', v);
  $('#ia-btn').classList.toggle('oculto', v);
  if (v) setTimeout(() => $('#ia-input').focus(), 340);
};
function msjIA(texto, clase = 'ia') {
  const chat = $('#ia-chat');
  const el = document.createElement('div');
  el.className = 'msj ' + clase;
  el.innerHTML = esc(texto).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}
// Contexto compacto del catálogo para el modelo
function contextoCatalogo(pregunta) {
  const q = pregunta.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const puntuar = p => {
    const blob = [p.nombre, p.marca, p.subcategoria, p.categoria, ...(p.tags || [])].join(' ').toLowerCase();
    return q.reduce((s, t) => s + (blob.includes(t) ? 1 : 0), 0);
  };
  const rank = EF.productos.map(p => [puntuar(p), p]).filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0]).slice(0, 60).map(([, p]) => p);
  const lista = (rank.length ? rank : EF.productos.slice(0, 30));
  return lista.map(p =>
    `${p.sku} | ${p.nombre} | ${p.marca} | ${p.categoria}/${p.subcategoria} | ${p.precio == null ? 'consultar' : '$' + p.precio}${p.agotado ? ' | AGOTADO' : ''}`
  ).join('\n');
}
async function preguntarIA(texto) {
  if (IA.ocupado || !texto.trim()) return;
  IA.ocupado = true;
  $('#ia-input').value = '';
  $('#ia-sug').style.display = 'none';
  msjIA(texto, 'yo');
  const chat = $('#ia-chat');
  const cargando = document.createElement('div');
  cargando.className = 'escribiendo';
  cargando.innerHTML = '<i></i><i></i><i></i>';
  chat.appendChild(cargando);
  chat.scrollTop = chat.scrollHeight;
  try {
    const r = await fetch('/api/asistente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pregunta: texto,
        historial: IA.historial.slice(-6),
        catalogo: contextoCatalogo(texto),
        totalSku: EF.productos.length
      })
    });
    cargando.remove();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const { respuesta } = await r.json();
    msjIA(respuesta);
    IA.historial.push({ role: 'user', content: texto }, { role: 'assistant', content: respuesta });
  } catch (e) {
    cargando.remove();
    msjIA('No pude conectarme al asistente. Escríbenos por WhatsApp y te respondemos de una vez: ' +
          `wa.me/${EF_CONFIG.WHATSAPP}`, 'err');
    console.warn('Asistente:', e.message);
  }
  IA.ocupado = false;
}
/* ============================================================
   6. ARRANQUE
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // Todo el arranque va aislado: si algo aqui falla, los listeners de abajo
  // se registran igual y el sitio sigue respondiendo a los clics.
  try {
    $('#anio').textContent = new Date().getFullYear();
    $$('[data-wa]').forEach(a => a.href = 'https://wa.me/' + EF_CONFIG.WHATSAPP);
    await cargarProductos();
    pintarConteos();
    pintarDestacados();
    pintarCatalogo();
    pintarPedido();
    irPaso(1);
  } catch (e) { console.error('Arranque:', e); }
  // Aparición al hacer scroll
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(el => io.observe(el));
  /* --- Clicks --- */
  document.addEventListener('click', e => {
    const t = e.target;
    const add = t.closest('.add');
    if (add) { agregar(add.dataset.sku); return destello(add); }
    const cmp = t.closest('[data-comprar]');
    if (cmp) return comprarAhora(cmp.dataset.comprar);
    if (t.closest('#carrito-flotante')) return abrirPedido(true);
    if (t.closest('#ir-catalogo')) { abrirPedido(false); return irAlCatalogo({}); }
    const ver = t.closest('[data-ver]');
    if (ver) return abrirModal(ver.dataset.ver);
    if (t.closest('#modal-cerrar') || t === $('#modal-fondo')) return cerrarModal();
    const mq = t.closest('[data-mq]');
    if (mq) {
      MODAL.qty = Math.max(1, MODAL.qty + Number(mq.dataset.mq));
      $('#modal-qty').textContent = MODAL.qty;
      return;
    }
    if (t.closest('#modal-add'))       { agregar(MODAL.sku, MODAL.qty); return cerrarModal(); }
    if (t.closest('#modal-consultar')) return modalConsultar();
    if (t.closest('#modal-avisar'))    return modalAvisar();
    const q   = t.closest('[data-q]');   if (q)   return cambiarQty(q.dataset.sku, +q.dataset.q);
    const irCat   = t.closest('[data-ir-cat]');
    if (irCat) return irAlCatalogo({ cat: irCat.dataset.irCat });
    const irSub   = t.closest('[data-ir-sub]');
    if (irSub) return irAlCatalogo({ sub: irSub.dataset.irSub });
    const irQ     = t.closest('[data-ir-q]');
    if (irQ) return irAlCatalogo({ q: irQ.dataset.irQ });
    const abrir = t.closest('[data-abrir]');
    if (abrir) {
      const c = $('#' + abrir.dataset.abrir);
      c.dataset.abierto = c.dataset.abierto === '1' ? '0' : '1';
      return pintarFiltros();
    }
    const quitar = t.closest('[data-quitar]');
    if (quitar) {
      const { quitar: campo, valor } = quitar.dataset;
      if (campo === 'q') estado.q = '', $('#buscar').value = '';
      else if (campo === 'disponibles') estado.soloDisponibles = false;
      else {
        const clave = campo === 'categoria' ? 'categorias' : campo === 'marca' ? 'marcas' : 'subcategorias';
        estado[clave] = estado[clave].filter(v => v !== valor);
      }
      return pintarCatalogo();
    }
    if (t.closest('#abrir-pedido'))    return abrirPedido(true);
    if (t.closest('#cerrar-pedido'))   return abrirPedido(false);
    if (t.closest('#pedido-fondo'))    return abrirPedido(false);
    if (t.closest('#enviar-wa'))       return enviarWhatsApp();
    if (t.closest('#ya-pague'))        return simularVerificacion();
    const entrega = t.closest('[data-entrega]');
    if (entrega) {
      CHK.entrega = entrega.dataset.entrega;
      CHK.flete = Number(entrega.dataset.flete);
      $$('#op-entrega .opcion').forEach(o => o.classList.toggle('sel', o === entrega));
      $('#campo-direccion').style.display = CHK.entrega === 'recogida' ? 'none' : '';
      return pintarPedido();
    }
    const pago = t.closest('[data-pago]');
    if (pago) {
      CHK.pago = pago.dataset.pago;
      $$('#op-pago .opcion').forEach(o => o.classList.toggle('sel', o === pago));
      return;
    }
    if (t.closest('#paso-siguiente')) {
      if (CHK.paso === 1) return irPaso(2);
      if (CHK.paso === 2) {
        if (!validarDatos()) return;
        const chk = $('#c-datos');
        if (chk && !chk.checked) {
          chk.closest('.efp-check').classList.add('error');
          return toast('Debes autorizar el tratamiento de datos para continuar');
        }
        return irPaso(3);
      }
      if (CHK.paso === 4) return abrirPedido(false);
      return;
    }
    if (t.closest('#paso-atras')) return irPaso(CHK.paso - 1);
    if (t.closest('#copiar-clave')) {
      navigator.clipboard?.writeText($('#ok-clave').textContent);
      return toast('Clave copiada');
    }
    if (t.closest('#toggle-filtros'))  return $('#filtros').classList.toggle('abierto');
    if (t.closest('#limpiar-filtros')) {
      Object.assign(estado, { categorias: [], subcategorias: [], marcas: [], soloDisponibles: false });
      return pintarCatalogo();
    }
    if (t.closest('#ia-btn'))     return abrirIA(true);
    if (t.closest('#ia-cerrar'))  return abrirIA(false);
    if (t.closest('#ia-enviar'))  return preguntarIA($('#ia-input').value);
    const sug = t.closest('[data-sug]');
    if (sug) return preguntarIA(sug.dataset.sug);
  });
  /* --- Cambios en filtros --- */
  $('#filtros')?.addEventListener('change', e => {
    const i = e.target;
    if (i.id === 'f-disponibles') estado.soloDisponibles = i.checked;
    else if (i.dataset.f) {
      const clave = i.dataset.f === 'categoria' ? 'categorias'
                  : i.dataset.f === 'marca' ? 'marcas' : 'subcategorias';
      estado[clave] = i.checked
        ? [...estado[clave], i.value]
        : estado[clave].filter(v => v !== i.value);
    }
    pintarCatalogo();
  });
  /* --- Búsqueda --- */
  let t1;
  const buscar = v => { clearTimeout(t1); t1 = setTimeout(() => { estado.q = v; pintarCatalogo(); }, 180); };
  $('#buscar')?.addEventListener('input', e => buscar(e.target.value));
  $('#buscar-hero')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') irAlCatalogo({ q: e.target.value });
  });
  $('#orden')?.addEventListener('change', e => { estado.orden = e.target.value; pintarCatalogo(); });
  /* --- Asistente --- */
  $('#ia-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') preguntarIA(e.target.value);
  });
  document.addEventListener('keydown', e => {
    // Enter/Espacio sobre la foto de un producto abre el detalle
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.ver) {
      e.preventDefault();
      return abrirModal(e.target.dataset.ver);
    }
    if (e.key !== 'Escape') return;
    if ($('#modal-fondo').classList.contains('abierto')) return cerrarModal();
    if ($('#ia-panel').classList.contains('abierto')) return abrirIA(false);
    abrirPedido(false);
  });
});
/* ============================================================
   7. COTIZADOR RÁPIDO POR PASOS  (patrón CDA Revitolima)
   Para quien no quiere navegar el catálogo: 3 pasos y sale a
   WhatsApp con la consulta ya escrita.
   ============================================================ */
const COT = { paso: 1, linea: null, tipo: null, detalle: '' };
const COT_LINEAS = {
  'Pantalla de celular': {
    ic: '▭',
    desc: 'Módulo de pantalla para reparación',
    tipos: ['Xiaomi / Redmi / Poco', 'Samsung', 'Motorola', 'iPhone',
            'Honor / Huawei', 'Vivo / Oppo', 'Tecno / Infinix']
  },
  'Batería': {
    ic: '▮',
    desc: 'Batería de reemplazo',
    tipos: ['iPhone — línea económica', 'iPhone — original genuina', 'iPhone — premium Ilummen']
  },
  'Computación': {
    ic: '⌨',
    desc: 'Periféricos y accesorios',
    tipos: ['Teclados y combos', 'Mouse', 'Hubs y adaptadores', 'Cables HDMI / red / poder',
            'Audio y parlantes', 'Micrófonos y cámara', 'Bases y pad mouse']
  }
};
function cotPintar() {
  const p = COT.paso;
  $('#cot-progreso').textContent = `Paso ${p} de 3`;
  $('#cot-barra').style.width = (p / 3 * 100) + '%';
  $$('.cot-paso').forEach((el, i) => el.classList.toggle('activo', i === p - 1));
  if (p === 1) {
    $('#cot-ops-1').innerHTML = Object.entries(COT_LINEAS).map(([k, v]) => `
      <button class="cot-op ${COT.linea === k ? 'sel' : ''}" data-cot-linea="${esc(k)}">
        <div class="ic">${v.ic}</div><b>${esc(k)}</b><span>${esc(v.desc)}</span>
      </button>`).join('');
  }
  if (p === 2 && COT.linea) {
    $('#cot-ops-2').innerHTML = COT_LINEAS[COT.linea].tipos.map(t => `
      <button class="cot-op ${COT.tipo === t ? 'sel' : ''}" data-cot-tipo="${esc(t)}">
        <b>${esc(t)}</b>
      </button>`).join('');
  }
  if (p === 3) {
    const n = EF.productos.filter(x =>
      (COT.linea.startsWith('Pantalla') && x.categoria === 'Pantallas' && x.subcategoria === COT.tipo) ||
      (COT.linea === 'Batería' && x.categoria === 'Baterías') ||
      (COT.linea === 'Computación' && x.categoria === 'Computación')).length;
    $('#cot-resumen').innerHTML = `
      <div class="r"><span>Línea</span><b>${esc(COT.linea)}</b></div>
      <div class="r"><span>Tipo</span><b>${esc(COT.tipo || '—')}</b></div>
      <div class="r"><span>En catálogo</span><b>${n} referencias</b></div>`;
  }
  $('#cot-siguiente').disabled = (p === 1 && !COT.linea) || (p === 2 && !COT.tipo);
  $('#cot-atras').style.visibility = p === 1 ? 'hidden' : 'visible';
}
function cotEnviar() {
  const detalle = $('#cot-detalle').value.trim();
  const txt = [
    '*CONSULTA DE DISPONIBILIDAD — ELECTROFUTURO*',
    '',
    `*Línea:* ${COT.linea}`,
    `*Tipo:* ${COT.tipo}`,
    detalle ? `*Modelo o referencia:* ${detalle}` : '',
    '',
    'Quedo atento al precio y a la disponibilidad.'
  ].filter(Boolean).join('\n');
  window.open(`https://wa.me/${EF_CONFIG.WHATSAPP}?text=${encodeURIComponent(txt)}`, '_blank');
  toast('Abriendo WhatsApp con tu consulta');
}
/* ============================================================
   8. CAPTURA DE LEAD — lista de precios mensual
   ============================================================ */
function enviarLead() {
  const nombre = $('#l-nombre').value.trim();
  const tel    = $('#l-telefono').value.trim();
  const perfil = $('#l-perfil').value;
  let falta = false;
  [['l-nombre', nombre], ['l-telefono', tel]].forEach(([id, v]) => {
    $('#' + id).closest('.campo').classList.toggle('error', !v);
    if (!v) falta = true;
  });
  if (falta) return toast('Completa tu nombre y tu WhatsApp');
  const txt = [
    '*QUIERO LA LISTA DE PRECIOS MAYORISTA*',
    '',
    `*Nombre / negocio:* ${nombre}`,
    `*WhatsApp:* ${tel}`,
    `*Soy:* ${perfil}`,
    '',
    'Quiero recibir la lista actualizada cada mes y el envío gratis de mi primer pedido.'
  ].join('\n');
  $('#lead-campos').style.display = 'none';
  $('#lead-ok').classList.add('visible');
  $('#lead-wa').href = `https://wa.me/${EF_CONFIG.WHATSAPP}?text=${encodeURIComponent(txt)}`;
}
/* ============================================================
   9. ENGANCHES
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  cotPintar();
  document.addEventListener('click', e => {
    const t = e.target;
    const l = t.closest('[data-cot-linea]');
    if (l) { COT.linea = l.dataset.cotLinea; COT.tipo = null; return cotPintar(); }
    const tp = t.closest('[data-cot-tipo]');
    if (tp) { COT.tipo = tp.dataset.cotTipo; return cotPintar(); }
    if (t.closest('#cot-siguiente')) {
      if (COT.paso < 3) { COT.paso++; cotPintar(); }
      else cotEnviar();
      return;
    }
    if (t.closest('#cot-atras'))  { COT.paso = Math.max(1, COT.paso - 1); return cotPintar(); }
    if (t.closest('#lead-enviar')) return enviarLead();
    if (t.closest('#cerrar-anuncio')) {
      $('#anuncio').classList.add('oculto');
      sessionStorage.setItem('ef_anuncio', '0');
      return;
    }
    if (t.closest('[data-abrir-ia]')) { abrirIA(true); return; }
  });
  if (sessionStorage.getItem('ef_anuncio') === '0') $('#anuncio').classList.add('oculto');
  // El botón "Siguiente" cambia de texto en el último paso
  const obs = new MutationObserver(() => {
    const b = $('#cot-siguiente');
    if (b) b.innerHTML = COT.paso === 3
      ? 'Consultar por WhatsApp <span class="fl">→</span>'
      : 'Continuar <span class="fl">→</span>';
  });
  obs.observe($('#cot-barra'), { attributes: true });
});
/* ============================================================
   10. VIDA: cinta de marcas, cifras animadas, sombra del nav
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  /* --- Cinta de marcas, tomada de los datos reales --- */
  const pista = $('#marcas-pista');
  if (pista) {
    const marcas = [...new Set(EF.productos.map(p => p.marca))]
      .filter(m => m && m !== 'Genérico');
    const compat = [...new Set(EF.productos
      .filter(p => p.categoria === 'Pantallas').map(p => p.subcategoria))];
    const todas = [...new Set([...compat, ...marcas])];
    // se duplica la lista para que el bucle no tenga costura visible
    const html = todas.map(m => `<span>${esc(m)}</span>`).join('');
    pista.innerHTML = html + html;
  }
  /* --- Cifras que suben al entrar en pantalla --- */
  const contar = el => {
    const fin = Number(el.dataset.contar);
    const dur = 1100;
    let t0 = null;
    const paso = t => {
      if (!t0) t0 = t;
      const p = Math.min((t - t0) / dur, 1);
      // desaceleración al final
      el.textContent = Math.round(fin * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  const ioCifras = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { contar(e.target); ioCifras.unobserve(e.target); }
  }), { threshold: .5 });
  $$('[data-contar]').forEach(el => ioCifras.observe(el));
  /* --- El nav gana sombra al despegarse del hero --- */
  const nav = $('.nav');
  let ultimo = false;
  addEventListener('scroll', () => {
    const abajo = scrollY > 12;
    if (abajo !== ultimo) { nav.classList.toggle('desplazado', abajo); ultimo = abajo; }
  }, { passive: true });
});
