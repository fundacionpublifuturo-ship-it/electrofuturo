/* ============================================================
   ELECTRO FUTURO — admin.js
   Cascarón del portal: menú por perfil, router, tablero, pipeline
   único y el componente genérico de portal por línea.
   Las vistas se registran en window.VISTAS: añadir un módulo es
   registrar una función más, no tocar el cascarón.
   ============================================================ */
(function (global) {
'use strict';

const { $, $$, money, miles, esc, fecha, fechaHora, diasDe, ic, IC, tabla, td,
        cargando, vacio, pillEtapa, chipLinea, semaforo, toast, abrirPanel, cerrarPanel,
        waHref, barras, dona, animarEntrada, descargar, aCSV } = UI;

const VISTAS = global.VISTAS = global.VISTAS || {};

const EFA = global.EFA = {
  CAT: [], porSku: {}, listo:false, error:null,
  usuario: () => (Sesion.actual() || {}).nombre || 'sistema',
  rol: () => Sesion.rol(),
  nombreSku: sku => (EFA.porSku[sku] && EFA.porSku[sku].nombre) || sku,
  lineaSku: sku => {
    const f = Datos.ficha(sku);
    return (f && f.linea) || Datos.lineaDe(EFA.porSku[sku]);
  },
  productosDeLinea: cod => EFA.CAT.filter(p => EFA.lineaSku(p.sku) === cod),
  ir: (a, p) => ir(a, p),
  refrescar: () => pintar()
};

/* ============================================================
   MENÚ
   ============================================================ */
const AREAS = [
  { id:'inicio',     ic:'inicio',     txt:'Inicio',     grupo:'Operación', sub:'Resumen del día' },
  { id:'pipeline',   ic:'pipeline',   txt:'Pipeline',   grupo:'Operación', sub:'Un solo embudo, de la cotización a la entrega' },
  { id:'lineas',     ic:'lineas',     txt:'Líneas',     grupo:'Operación', sub:'Un portal por categoría de producto' },
  { id:'clientes',   ic:'clientes',   txt:'Clientes',   grupo:'Operación', sub:'Base de datos e historial' },
  { id:'inventario', ic:'inventario', txt:'Inventario', grupo:'Bodega',    sub:'Stock conectado con la tienda' },
  { id:'bodega',     ic:'bodega',     txt:'Bodega',     grupo:'Bodega',    sub:'Alistamiento, traslados, conteo y ubicaciones' },
  { id:'compras',    ic:'compras',    txt:'Compras',    grupo:'Bodega',    sub:'Reposición sugerida y proveedores' },
  { id:'cartera',    ic:'cartera',    txt:'Cartera',    grupo:'Dinero',    sub:'Cuentas por cobrar' },
  { id:'finanzas',   ic:'finanzas',   txt:'Finanzas',   grupo:'Dinero',    sub:'Caja, utilidad y capital inmovilizado' },
  { id:'garantias',  ic:'garantias',  txt:'Garantías',  grupo:'Servicio',  sub:'Casos radicados por los clientes' },
  { id:'alertas',    ic:'alertas',    txt:'Alertas',    grupo:'Servicio',  sub:'Lo que hay que resolver, con su acción' },
  { id:'ajustes',    ic:'ajustes',    txt:'Ajustes',    grupo:'Sistema',   sub:'Respaldo, reglas y auditoría' }
];

let areaActual = 'inicio';
let lineaActual = null;

function pendientes() {
  const al = Datos.alertas(EFA.CAT);
  return {
    alertas: al.filter(a => a.prio !== 'proximo').length,
    pipeline: Datos.pedidos().filter(p => ['confirmado','separado','alistamiento'].includes(p.estado)).length,
    bodega: Datos.alistamientos().filter(a => a.estado !== 'cerrado').length
          + Datos.traslados().filter(t => t.estado === 'en_transito').length,
    cartera: Datos.cartera().filter(c => !['pagada','anulada'].includes(c.estado)).length,
    garantias: Datos.garantias().filter(g => !['resuelta','rechazada'].includes(g.estado)).length
  };
}

function pintarMenu() {
  const permitidas = AREAS.filter(a => Sesion.puede(a.id));
  const p = pendientes();
  let grupo = '', html = '';
  permitidas.forEach((a, i) => {
    if (a.grupo !== grupo) { grupo = a.grupo; html += `<div class="grupo">${grupo}</div>`; }
    const n = p[a.id] || 0;
    /* En móvil la barra inferior muestra 5 destinos y el resto entra en "Más" */
    html += `<button data-area="${a.id}" title="${esc(a.txt)}" class="${i >= 5 ? 'extra' : ''}">${ic(a.ic)}
      <span class="txt">${a.txt}</span>${n ? `<span class="pend">${n > 99 ? '99+' : n}</span>` : ''}</button>`;
  });
  if (permitidas.length > 5) {
    const pend = permitidas.slice(5).reduce((a, x) => a + (p[x.id] || 0), 0);
    html += `<button class="mas-btn" data-mas="1">${ic('lineas')}
      <span class="txt">Más</span>${pend ? `<span class="pend">${pend > 99 ? '99+' : pend}</span>` : ''}</button>`;
  }
  $('#menu').innerHTML = html;
  $('#menu').classList.remove('abierto');
  const total = p.alertas;
  const c = $('#campana-n');
  c.textContent = total > 99 ? '99+' : total;
  c.style.display = total ? 'grid' : 'none';
  return permitidas;
}

function ir(area, param) {
  if (!Sesion.puede(area)) return;
  areaActual = area;
  lineaActual = area === 'lineas' ? (param || null) : null;
  const meta = AREAS.find(a => a.id === area);
  $$('#menu button').forEach(b => b.classList.toggle('activo', b.dataset.area === area));
  $('#titulo').textContent = lineaActual ? (Datos.LINEA[lineaActual] || {}).nombre : meta.txt;
  $('#subtitulo').textContent = lineaActual ? 'Portal de línea' : meta.sub;
  $$('.vista').forEach(v => v.classList.remove('activa'));
  const v = $('#v-' + area);
  if (v) v.classList.add('activa');
  pintar();
  global.scrollTo(0, 0);
}

function pintar() {
  if (!Sesion.actual()) return;
  pintarMenu();
  const destino = $('#v-' + areaActual);
  if (!destino) return;
  if (!EFA.listo) { destino.innerHTML = cargando(6); return; }
  const f = VISTAS[areaActual];
  if (!f) { destino.innerHTML = vacio('En construcción', 'Este módulo todavía no está disponible.'); return; }
  try { destino.innerHTML = f(lineaActual); }
  catch (e) {
    console.error('Vista ' + areaActual + ':', e);
    destino.innerHTML = UI.errorEst('No se pudo dibujar esta pantalla: ' + e.message, areaActual);
  }
  animarEntrada(destino);
}

/* ============================================================
   VISTA · INICIO
   ============================================================ */
VISTAS.inicio = function () {
  const rol = EFA.rol();
  const ped = Datos.pedidos();
  const hoyD = new Date().toISOString().slice(0, 10);
  const mes = new Date().toISOString().slice(0, 7);
  const vivos = ped.filter(p => !['entregado','anulado','devuelto','cotizacion'].includes(p.estado));
  const delDia = ped.filter(p => p.creado.slice(0, 10) === hoyD && p.estado !== 'anulado');
  const delMes = ped.filter(p => p.creado.slice(0, 7) === mes && p.estado !== 'anulado');
  const alertas = Datos.alertas(EFA.CAT);
  const criticas = alertas.filter(a => a.prio === 'critico');

  let kpis;
  if (rol === 'bodega') {
    const alist = Datos.alistamientos().filter(a => a.estado !== 'cerrado');
    kpis = [
      ['Por alistar', ped.filter(p => ['confirmado','separado'].includes(p.estado)).length, 'Pedidos esperando picking', ''],
      ['Alistamientos abiertos', alist.length, 'Listas en curso', alist.length ? 'aviso' : 'ok'],
      ['Listos para entrega', ped.filter(p => p.estado === 'listo').length, 'Empacados', 'ok'],
      ['Traslados en tránsito', Datos.traslados().filter(t => t.estado === 'en_transito').length, 'Sin confirmar recepción', ''],
      ['Referencias por reponer', alertas.filter(a => a.tema === 'Stock').length, 'Bajo el mínimo o en cero', 'alerta']
    ];
  } else {
    const ventaDia = delDia.reduce((a, p) => a + p.total, 0);
    const abiertas = Datos.cartera().filter(c => !['pagada','anulada'].includes(c.estado));
    const porCobrar = abiertas.reduce((a, c) => a + (c.monto - c.abonado), 0);
    kpis = [
      ['Pedidos de hoy', delDia.length, money(ventaDia) + ' en ventas', ''],
      ['En el embudo', vivos.length, 'Sin entregar todavía', ''],
      ['Por cobrar', money(porCobrar), abiertas.length + ' cuentas', porCobrar ? 'aviso' : 'ok'],
      ['Alertas críticas', criticas.length, 'Necesitan acción hoy', criticas.length ? 'alerta' : 'ok']
    ];
    if (Sesion.veCostos()) {
      const venta = delMes.reduce((a, p) => a + p.total, 0);
      const costo = delMes.reduce((a, p) => a + Datos.costoPedido(p), 0);
      kpis.push(['Utilidad bruta del mes', money(venta - costo), money(venta) + ' vendidos', 'ok']);
    }
  }

  const serie = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    serie.push({
      t: new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'short' }).slice(0, 3),
      v: ped.filter(p => p.creado.slice(0, 10) === d && p.estado !== 'anulado').reduce((a, p) => a + p.total, 0)
    });
  }

  const porLinea = {};
  delMes.forEach(p => p.items.forEach(i => {
    const l = i.linea || 'ACC';
    porLinea[l] = (porLinea[l] || 0) + i.precio * i.qty;
  }));
  const partes = Object.entries(porLinea).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([cod, v]) => ({ t:(Datos.LINEA[cod] || {}).nombre || cod, v, color:(Datos.LINEA[cod] || {}).color }));

  const ultimos = ped.slice(0, 8);

  return `
  <div class="kpis aparece">${kpis.map(([t, v, s, c]) =>
    `<div class="kpi ${c}"><span>${t}</span><b class="kpi-v">${v}</b><small>${s}</small></div>`).join('')}</div>

  <div class="cols-2">
    <div class="tarjeta aparece">
      <div class="tarjeta-cab"><div><h3>Venta de los últimos 7 días</h3>
        <p>Total facturado por día, sin contar anulados</p></div></div>
      <div class="tarjeta-cuerpo">${barras(serie)}</div>
    </div>
    <div class="tarjeta aparece">
      <div class="tarjeta-cab"><div><h3>Venta por línea este mes</h3>
        <p>Dónde se está moviendo la plata</p></div></div>
      <div class="tarjeta-cuerpo">${partes.length ? dona(partes, { formato: money })
        : vacio('Sin ventas este mes', 'Cuando entren pedidos verás el peso de cada línea.')}</div>
    </div>
  </div>

  <div class="tarjeta aparece">
    <div class="tarjeta-cab">
      <div><h3>Lo que hay que resolver</h3><p>Las cinco alertas de mayor prioridad</p></div>
      <button class="btn btn-l btn-x" data-area="alertas">Ver todas</button>
    </div>
    <div class="tarjeta-cuerpo pegado">${alertas.length
      ? alertas.slice(0, 5).map(filaAlerta).join('')
      : vacio('Todo en orden', 'No hay alertas abiertas en este momento.')}</div>
  </div>

  <div class="tarjeta aparece">
    <div class="tarjeta-cab">
      <div><h3>Últimos pedidos</h3><p>Los ocho más recientes</p></div>
      <button class="btn btn-l btn-x" data-area="pipeline">Ver el embudo</button>
    </div>
    <div class="tarjeta-cuerpo pegado">${ultimos.length ? tabla(
      ['Pedido','Línea','Cliente','Canal','Estado',{t:'Total',num:1},''],
      ultimos.map(p => [
        td('Pedido', `<b>${p.codigo}</b>`, 'sku'),
        td('Línea', chipLinea(p.linea)),
        td('Cliente', esc(p.cliente.nombre || '—')),
        td('Canal', `<span class="pill gris">${p.canal === 'mostrador' ? 'Mostrador' : 'Mayorista'}</span>`),
        td('Estado', pillEtapa(p.estado)),
        td('Total', money(p.total), 'num'),
        td('', `<button class="btn btn-l btn-x" data-pedido="${p.codigo}">Abrir</button>`, 'acc')
      ]))
      : vacio('Todavía no hay pedidos',
          'Los de la tienda entran solos. También puedes registrar una venta de mostrador.',
          Sesion.edita('pedidos') ? '<button class="btn btn-p" data-nuevo-pedido="1">Registrar venta</button>' : '')}</div>
  </div>`;
};

/* ============================================================
   VISTA · PIPELINE
   ============================================================ */
const filtroPipe = { canal:'', linea:'', q:'' };
global.filtroPipe = filtroPipe;

function tarjetaPipe(p) {
  const l = Datos.LINEA[p.linea] || Datos.LINEA.ACC;
  const q = diasDe(p.movido || p.creado);
  const u = p.items.reduce((a, i) => a + i.qty, 0);
  return `<button class="tk" style="--cl:${l.color}" data-pedido="${p.codigo}">
    <span class="l1">${chipLinea(p.linea)}<b>${esc(p.cliente.nombre || p.codigo)}</b></span>
    <span class="l2"><span>${money(p.total)}</span><span>${u} u.</span></span>
    <span class="l3"><span>${esc(p.cliente.ciudad || 'Ibagué')} · ${esc(p.vendedor)}</span>
      <span>${semaforo(q)} ${q}d</span></span></button>`;
}

function kanban(filtrarLinea) {
  const l = Datos.pedidos().filter(p => {
    if (filtroPipe.canal && p.canal !== filtroPipe.canal) return false;
    const lin = filtrarLinea || filtroPipe.linea;
    if (lin && !p.items.some(i => (i.linea || 'ACC') === lin)) return false;
    if (filtroPipe.q) {
      const b = (p.codigo + ' ' + p.cliente.nombre + ' ' + (p.cliente.telefono || '')).toLowerCase();
      if (!b.includes(filtroPipe.q.toLowerCase())) return false;
    }
    return true;
  });
  const cols = Datos.ETAPAS.map(e => {
    const en = l.filter(p => p.estado === e.k);
    return `<div class="col">
      <div class="col-cab"><div><b>${e.t}</b><span class="v">${money(en.reduce((a, p) => a + p.total, 0))}</span></div>
        <span class="n">${en.length}</span></div>
      <div class="col-cuerpo">${en.length ? en.map(tarjetaPipe).join('')
        : '<p style="font-size:.73rem;color:var(--ink-300);text-align:center;padding:14px 6px">Nada aquí</p>'}</div>
    </div>`;
  }).join('');
  return { l, html: cols };
}

VISTAS.pipeline = function () {
  const { l, html } = kanban();
  const anulados = Datos.pedidos().filter(p => p.estado === 'anulado');
  const motivos = {};
  anulados.forEach(p => {
    const k = p.motivoAnulacion || 'Otro';
    motivos[k] = (motivos[k] || 0) + p.total;
  });
  return `
  <div class="herramientas aparece">
    <div class="crece"><input type="search" id="q-pipe" placeholder="Buscar por código, cliente o teléfono" value="${esc(filtroPipe.q)}"></div>
    <select id="f-canal" style="max-width:190px">
      <option value="">Mostrador y mayorista</option>
      <option value="mostrador" ${filtroPipe.canal === 'mostrador' ? 'selected' : ''}>Solo mostrador</option>
      <option value="mayorista" ${filtroPipe.canal === 'mayorista' ? 'selected' : ''}>Solo mayorista</option>
    </select>
    <select id="f-linea-pipe" style="max-width:220px">
      <option value="">Todas las líneas</option>
      ${Datos.LINEAS.map(x => `<option value="${x.cod}" ${filtroPipe.linea === x.cod ? 'selected' : ''}>${x.cod} · ${x.nombre}</option>`).join('')}
    </select>
    ${Sesion.edita('pedidos') ? `<button class="btn btn-p btn-x" data-nuevo-pedido="1">${IC.mas} Nuevo pedido</button>` : ''}
    <button class="btn btn-l btn-x" data-exportar="pipeline">${IC.descarga} Exportar</button>
  </div>
  ${l.length ? `<div class="kanban aparece">${html}</div>`
    : vacio('El embudo está vacío', 'No hay pedidos que cumplan estos filtros.',
        Sesion.edita('pedidos') ? '<button class="btn btn-p" data-nuevo-pedido="1">Registrar el primero</button>' : '')}
  ${anulados.length ? `<div class="tarjeta aparece" style="margin-top:18px">
    <div class="tarjeta-cab"><div><h3>Pérdidas por anulación</h3>
      <p>${anulados.length} pedido(s) por ${money(anulados.reduce((a, p) => a + p.total, 0))}</p></div></div>
    <div class="tarjeta-cuerpo">${dona(Object.entries(motivos).map(([t, v], i) =>
      ({ t, v, color:['#EF4444','#F59E0B','#64748B','#7C3AED','#2563EB'][i % 5] })), { formato: money })}
    </div></div>` : ''}`;
};

/* ============================================================
   VISTA · LÍNEAS — componente genérico
   ============================================================ */
const seccionActual = {};

function configLinea(cod) {
  const meta = Datos.LINEA[cod];
  const productos = EFA.productosDeLinea(cod);
  const secciones = [
    { id:'operacion',   label:'Operación',   render:secOperacion },
    { id:'pipeline',    label:'Pipeline',    render:secPipeline },
    { id:'inventario',  label:'Inventario',  render:secInventario },
    { id:'movimientos', label:'Movimientos', render:secMovimientos },
    { id:'clientes',    label:'Clientes',    render:secClientes }
  ];
  if (Sesion.veCostos()) secciones.push({ id:'rentabilidad', label:'Rentabilidad', render:secRentabilidad });
  secciones.push({ id:'alertas', label:'Alertas', render:secAlertas });
  if (cod === 'PNT' || cod === 'BAT') secciones.push({ id:'compat', label:'Compatibilidad', render:secCompatibilidad });
  if (cod === 'STC') secciones.push({ id:'ordenes', label:'Órdenes de servicio', render:secOrdenes });
  if (cod === 'COM') secciones.push({ id:'especs', label:'Especificaciones', render:secEspecs });
  return { cod, meta, productos, secciones };
}

VISTAS.lineas = function (cod) {
  if (cod) return portalLinea(cod);
  const abc = Datos.abc();
  return `<div class="aviso info aparece">Cada línea abre el <b>mismo portal</b> con sus propias
    columnas, indicadores y pestañas. Añadir una categoría es añadir un objeto a la configuración,
    no escribir una pantalla nueva.</div>
    <div class="lineas-grid">${Datos.LINEAS.map(l => {
      const prods = EFA.productosDeLinea(l.cod);
      const conFicha = prods.filter(p => Datos.ficha(p.sku));
      const stock = conFicha.reduce((a, p) => a + Datos.ficha(p.sku).stock, 0);
      const venta = Datos.pedidosDeLinea(l.cod).filter(p => p.estado !== 'anulado')
        .reduce((a, p) => a + p.items.filter(i => (i.linea || 'ACC') === l.cod)
          .reduce((s, i) => s + i.precio * i.qty, 0), 0);
      const claseA = conFicha.filter(p => (abc[p.sku] || {}).clase === 'A').length;
      return `<button class="linea-card aparece" style="--cl:${l.color}" data-linea="${l.cod}">
        <span class="cab">${chipLinea(l.cod)}<h4>${esc(l.nombre)}</h4></span>
        <span class="datos">
          <span>Referencias<b>${prods.length}</b></span>
          <span>En stock<b>${miles(stock)}</b></span>
          <span>Vendido<b>${venta ? money(venta) : '—'}</b></span>
        </span>
        ${claseA ? `<span style="display:block;margin-top:9px;font-size:.71rem;color:var(--ink-400)">${claseA} referencia(s) clase A</span>` : ''}
      </button>`;
    }).join('')}</div>`;
};

function portalLinea(cod) {
  const c = configLinea(cod);
  const sec = seccionActual[cod] && c.secciones.some(s => s.id === seccionActual[cod])
    ? seccionActual[cod] : c.secciones[0].id;
  seccionActual[cod] = sec;
  const activa = c.secciones.find(s => s.id === sec);
  return `
  <div class="herramientas aparece" style="border-left:4px solid ${c.meta.color}">
    <button class="btn btn-l btn-x" data-area="lineas">← Todas las líneas</button>
    ${chipLinea(cod)}<b style="font-size:.9rem">${esc(c.meta.nombre)}</b>
    <span style="flex:1"></span>
    ${Sesion.edita('pedidos') ? `<button class="btn btn-p btn-x" data-nuevo-pedido="${cod}">${IC.mas} Nuevo pedido</button>` : ''}
  </div>
  <div class="pestanas aparece">${c.secciones.map(s =>
    `<button data-sec="${s.id}" data-linea-sec="${cod}" class="${s.id === sec ? 'activo' : ''}">${s.label}</button>`).join('')}</div>
  <div id="sec-cuerpo">${activa.render(c)}</div>`;
}

/* ---------- secciones ---------- */
function secOperacion(c) {
  if (!c.productos.length) return vacio('Sin referencias en esta línea',
    'Cuando cargues productos de ' + esc(c.meta.nombre) + ' al catálogo aparecerán aquí con su stock y su rotación.');
  const costos = Sesion.veCostos(), precios = Sesion.vePrecios();
  const abc = Datos.abc();
  const cab = ['Código','Producto'];
  if (precios) cab.push({ t:'Precio', num:1 });
  if (costos) cab.push({ t:'Costo', num:1 }, { t:'Margen', num:1 });
  cab.push({ t:'Disponible', num:1 }, 'Clase', 'Ubicación', '');
  return `<div class="tarjeta"><div class="tarjeta-cab">
    <div><h3>Operación</h3><p>${c.productos.length} referencias en esta línea</p></div>
    <button class="btn btn-l btn-x" data-exportar="linea:${c.cod}">${IC.descarga} Exportar</button>
  </div><div class="tarjeta-cuerpo pegado">${tabla(cab, c.productos.slice(0, 200).map(p => {
    const f = Datos.ficha(p.sku);
    const disp = f ? f.stock - f.reservado : null;
    const u = f ? [f.ubicacion.bodega, f.ubicacion.estante, f.ubicacion.nivel].filter(Boolean).join('·') : '';
    const fila = [ td('Código', p.sku, 'sku'),
      td('Producto', esc(p.nombre) + `<span class="sub">${esc(p.marca)}</span>`) ];
    if (precios) fila.push(td('Precio', money(f ? f.precio : p.precio), 'num'));
    if (costos) {
      const m = f && f.costo && f.precio ? Math.round((1 - f.costo / f.precio) * 100) : null;
      fila.push(td('Costo', f ? money(f.costo) : '—', 'num'),
        td('Margen', m == null ? '—' : `<span class="pill ${m < 15 ? 'rojo' : m < 30 ? 'ambar' : 'verde'}">${m} %</span>`, 'num'));
    }
    fila.push(
      td('Disponible', f ? `<b>${disp}</b>` : '<span style="color:var(--ink-300)">sin control</span>', 'num'),
      td('Clase', f ? `<span class="pill ${(abc[p.sku] || {}).clase === 'A' ? 'verde' : (abc[p.sku] || {}).clase === 'B' ? 'ambar' : 'gris'}">${(abc[p.sku] || {}).clase || 'C'}</span>` : '—'),
      td('Ubicación', u || '<span style="color:var(--ink-300)">—</span>'),
      td('', `<button class="btn btn-l btn-x" data-ficha="${p.sku}">${f ? 'Editar' : 'Dar de alta'}</button>`, 'acc'));
    return fila;
  }))}</div></div>`;
}

function secPipeline(c) {
  const { l, html } = kanban(c.cod);
  return `<div class="aviso info">Es el <b>mismo embudo general</b> filtrado por ${c.cod}.
    Lo que muevas aquí se mueve también en Pipeline.</div>
    ${l.length ? `<div class="kanban">${html}</div>`
      : vacio('Sin pedidos de esta línea', 'Cuando entre el primero aparecerá en este embudo.')}`;
}

function secInventario(c) {
  const conFicha = c.productos.filter(p => Datos.ficha(p.sku));
  if (!conFicha.length) return vacio('Sin inventario cargado',
    'Da de alta las referencias desde la pestaña Operación para empezar a controlar stock.');
  const costos = Sesion.veCostos();
  const valor = conFicha.reduce((a, p) => { const f = Datos.ficha(p.sku); return a + f.stock * (f.costo || 0); }, 0);
  const bajos = conFicha.filter(p => { const f = Datos.ficha(p.sku); return (f.stock - f.reservado) <= f.minimo; });
  return `<div class="kpis">
    <div class="kpi"><span>Referencias con stock</span><b class="kpi-v">${conFicha.length}</b>
      <small>de ${c.productos.length} en la línea</small></div>
    <div class="kpi"><span>Unidades en bodega</span>
      <b class="kpi-v">${miles(conFicha.reduce((a, p) => a + Datos.ficha(p.sku).stock, 0))}</b>
      <small>Stock físico</small></div>
    ${costos ? `<div class="kpi"><span>Valor del inventario</span><b class="kpi-v">${money(valor)}</b>
      <small>A precio de costo</small></div>` : ''}
    <div class="kpi ${bajos.length ? 'alerta' : 'ok'}"><span>Bajo el mínimo</span>
      <b class="kpi-v">${bajos.length}</b><small>Necesitan reposición</small></div>
  </div>
  <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Stock de la línea</h3>
    <p>Ordenado por lo que menos queda</p></div></div>
  <div class="tarjeta-cuerpo pegado">${tabla(
    ['Código','Producto',{t:'Stock',num:1},{t:'Reserv.',num:1},{t:'Disp.',num:1},{t:'Mínimo',num:1},'Ubicación',''],
    conFicha.map(p => ({ p, f: Datos.ficha(p.sku) }))
      .sort((a, b) => (a.f.stock - a.f.reservado) - (b.f.stock - b.f.reservado))
      .map(({ p, f }) => {
        const d = f.stock - f.reservado;
        const u = [f.ubicacion.bodega, f.ubicacion.estante, f.ubicacion.nivel, f.ubicacion.caja].filter(Boolean).join(' · ');
        return [ td('Código', p.sku, 'sku'), td('Producto', esc(p.nombre)),
          td('Stock', f.stock, 'num'), td('Reserv.', f.reservado || 0, 'num'),
          td('Disp.', `<b style="color:${d <= f.minimo ? 'var(--danger)' : 'inherit'}">${d}</b>`, 'num'),
          td('Mínimo', f.minimo, 'num'),
          td('Ubicación', u || '<span style="color:var(--ink-300)">Sin ubicación</span>'),
          td('', `<button class="btn btn-l btn-x" data-ficha="${p.sku}">Abrir</button>`, 'acc') ];
      }))}</div></div>`;
}

function secMovimientos(c) {
  const skus = new Set(c.productos.map(p => p.sku));
  const mov = Datos.kardex().filter(m => skus.has(m.sku)).slice(0, 120);
  if (!mov.length) return vacio('Sin movimientos',
    'Las entradas y salidas de esta línea aparecerán aquí con su saldo corrido.');
  return `<div class="tarjeta"><div class="tarjeta-cab">
    <div><h3>Kardex de la línea</h3><p>Últimos ${mov.length} movimientos</p></div>
    <button class="btn btn-l btn-x" data-exportar="kardex:${c.cod}">${IC.descarga} Exportar</button></div>
    <div class="tarjeta-cuerpo pegado">${tabla(
      ['Fecha','Código','Producto','Tipo',{t:'Cantidad',num:1},{t:'Saldo',num:1},'Motivo','Usuario'],
      mov.map(m => [ td('Fecha', fechaHora(m.fecha)), td('Código', m.sku, 'sku'),
        td('Producto', esc(EFA.nombreSku(m.sku))),
        td('Tipo', `<span class="pill ${['entrada','devolucion'].includes(m.tipo) ? 'verde' : m.tipo === 'ajuste' ? 'ambar' : 'gris'}">${m.tipo}</span>`),
        td('Cantidad', (m.cantidad > 0 ? '+' : '') + m.cantidad, 'num'),
        td('Saldo', m.saldo, 'num'), td('Motivo', esc(m.motivo)), td('Usuario', esc(m.usuario)) ]))}</div></div>`;
}

function secClientes(c) {
  const porCliente = {};
  Datos.pedidosDeLinea(c.cod).filter(p => p.estado !== 'anulado').forEach(p => {
    const a = porCliente[p.clienteId] || (porCliente[p.clienteId] = { n:0, v:0, ult:'' });
    a.n++;
    a.v += p.items.filter(i => (i.linea || 'ACC') === c.cod).reduce((s, i) => s + i.precio * i.qty, 0);
    if (p.creado > a.ult) a.ult = p.creado;
  });
  const filas = Object.entries(porCliente).map(([id, a]) => ({ cl: Datos.cliente(id), a }))
    .filter(x => x.cl).sort((a, b) => b.a.v - a.a.v);
  if (!filas.length) return vacio('Nadie ha comprado esta línea todavía',
    'Cuando entren pedidos verás quién compra ' + esc(c.meta.nombre) + ' y cada cuánto.');
  return `<div class="tarjeta"><div class="tarjeta-cab"><div><h3>Quién compra esta línea</h3>
    <p>Ordenado por valor comprado</p></div></div>
    <div class="tarjeta-cuerpo pegado">${tabla(
      ['Cliente','Tipo','Ciudad',{t:'Pedidos',num:1},{t:'Comprado',num:1},'Última compra',''],
      filas.map(({ cl, a }) => [
        td('Cliente', `<b>${esc(cl.nombre)}</b><span class="sub">${esc(cl.telefono)}</span>`),
        td('Tipo', `<span class="pill ${cl.tipo === 'mayorista' ? 'cian' : 'gris'}">${cl.tipo}</span>`),
        td('Ciudad', esc(cl.ciudad || '—')), td('Pedidos', a.n, 'num'),
        td('Comprado', money(a.v), 'num'),
        td('Última compra', `${fecha(a.ult)}<span class="sub">hace ${diasDe(a.ult)} días</span>`),
        td('', `<button class="btn btn-l btn-x" data-cliente="${cl.id}">Abrir</button>`, 'acc') ]))}</div></div>`;
}

function secRentabilidad(c) {
  const con = c.productos.map(p => ({ p, f: Datos.ficha(p.sku) })).filter(x => x.f && x.f.costo > 0);
  if (!con.length) return vacio('Falta cargar costos',
    'Escribe el costo unitario en la ficha de cada referencia y la utilidad se calcula sola.');
  const v = Datos.ventaPorSku(180);
  return `<div class="tarjeta"><div class="tarjeta-cab"><div><h3>Costo, precio y margen</h3>
    <p>Por referencia, empezando por el margen más bajo</p></div></div>
    <div class="tarjeta-cuerpo pegado">${tabla(
      ['Código','Producto',{t:'Costo',num:1},{t:'Precio',num:1},{t:'Utilidad u.',num:1},
       {t:'Margen',num:1},{t:'Vendidas 180d',num:1},{t:'Utilidad total',num:1}],
      con.map(({ p, f }) => {
        const util = f.precio - f.costo;
        return { p, f, util, m: f.precio ? Math.round(util / f.precio * 100) : 0,
                 u: (v[p.sku] || {}).unidades || 0 };
      }).sort((a, b) => a.m - b.m).map(({ p, f, util, m, u }) => [
        td('Código', p.sku, 'sku'), td('Producto', esc(p.nombre)),
        td('Costo', money(f.costo), 'num'), td('Precio', money(f.precio), 'num'),
        td('Utilidad u.', money(util), 'num'),
        td('Margen', `<span class="pill ${m < 15 ? 'rojo' : m < 30 ? 'ambar' : 'verde'}">${m} %</span>`, 'num'),
        td('Vendidas 180d', u, 'num'), td('Utilidad total', money(util * u), 'num') ]))}</div></div>`;
}

function secAlertas(c) {
  const skus = new Set(c.productos.map(p => p.sku));
  const l = Datos.alertas(EFA.CAT).filter(a => skus.has(a.ref)
    || (a.area === 'pipeline' && (Datos.pedido(a.ref) || {}).linea === c.cod));
  if (!l.length) return vacio('Sin alertas en esta línea', 'Nada por reponer, revisar ni cobrar aquí.');
  return `<div class="tarjeta"><div class="tarjeta-cuerpo pegado">${l.map(filaAlerta).join('')}</div></div>`;
}

const MODULOS = {
  'AMOLED':'Panel AMOLED, negros reales', 'AMM':'Panel AMOLED', 'OLED':'Panel OLED',
  'INCELL':'LCD INCELL, económico', ' CM ':'Con marco', ' SM ':'Sin marco',
  'ASS':'Ensamble completo', 'AMP':'Referencia ampliada', 'GENUINA':'Celda original',
  'DECODE':'Chip decodificado', 'MOVE IC':'Traslado de IC', 'ORIGINAL':'Componente original'
};
function modulosDe(nombre) {
  const n = ' ' + String(nombre).toUpperCase() + ' ';
  return Object.entries(MODULOS).filter(([k]) => n.includes(k)).map(([k, d]) => ({ k:k.trim(), d }));
}

function secCompatibilidad(c) {
  if (!c.productos.length) return vacio('Sin referencias', 'Cuando cargues productos verás su compatibilidad aquí.');
  const porEquipo = {};
  c.productos.forEach(p => {
    const k = p.subcategoria || 'Sin clasificar';
    (porEquipo[k] || (porEquipo[k] = [])).push(p);
  });
  return `<div class="aviso info">Antes de vender hay que confirmar el submodelo: el tipo de módulo
    (SM, CM, INCELL, OLED, AMOLED) cambia según la variante del equipo.</div>
    ${Object.keys(porEquipo).sort((a, b) => a.localeCompare(b, 'es')).map(k => {
      const l = porEquipo[k];
      return `<div class="tarjeta"><div class="tarjeta-cab"><div><h3>${esc(k)}</h3>
        <p>${l.length} referencia(s)</p></div></div>
        <div class="tarjeta-cuerpo pegado">${tabla(
          ['Código','Referencia','Tipo de módulo','Marca',{t:'Disponible',num:1},'Garantía'],
          l.map(p => {
            const f = Datos.ficha(p.sku);
            const mods = modulosDe(p.nombre);
            return [ td('Código', p.sku, 'sku'), td('Referencia', esc(p.nombre)),
              td('Tipo de módulo', mods.length
                ? mods.map(m => `<span class="pill gris" title="${esc(m.d)}">${m.k}</span>`).join(' ')
                : '<span style="color:var(--ink-300)">—</span>'),
              td('Marca', esc(p.marca)),
              td('Disponible', f ? f.stock - f.reservado : '<span style="color:var(--ink-300)">—</span>', 'num'),
              td('Garantía', (p.specs && p.specs['Garantía']) ? esc(p.specs['Garantía']) : 'Probado antes de despacho') ];
          }))}</div></div>`;
    }).join('')}`;
}

function secOrdenes() {
  const g = Datos.garantias();
  return `<div class="aviso info">El servicio técnico se opera con órdenes: equipo recibido,
    técnico asignado, repuesto consumido y garantía. Los casos que radican los clientes desde su
    portal llegan a esta bandeja.</div>
    ${g.length ? `<div class="tarjeta"><div class="tarjeta-cuerpo pegado">${tabla(
      ['Caso','Fecha','Cliente','Repuesto','Estado',''],
      g.map(x => [ td('Caso', x.id, 'sku'), td('Fecha', fecha(x.creado)),
        td('Cliente', esc(x.cliente || '—')), td('Repuesto', esc(EFA.nombreSku(x.sku))),
        td('Estado', `<span class="pill ${x.estado === 'resuelta' ? 'verde' : x.estado === 'rechazada' ? 'rojo' : 'ambar'}">${x.estado.replace('_', ' ')}</span>`),
        td('', `<button class="btn btn-l btn-x" data-garantia="${x.id}">Gestionar</button>`, 'acc') ]))}</div></div>`
      : vacio('Sin órdenes de servicio', 'Los casos que radiquen los clientes llegan a esta bandeja.')}`;
}

function secEspecs(c) {
  const con = c.productos.filter(p => p.specs && Object.keys(p.specs).length);
  if (!con.length) return vacio('Sin especificaciones cargadas',
    'Agrega las fichas técnicas al catálogo y aparecerán aquí.');
  return `<div class="tarjeta"><div class="tarjeta-cab"><div><h3>Fichas técnicas</h3>
    <p>${con.length} referencias con especificaciones</p></div></div>
    <div class="tarjeta-cuerpo pegado">${tabla(['Código','Producto','Especificaciones','Serial'],
      con.slice(0, 120).map(p => {
        const f = Datos.ficha(p.sku);
        return [ td('Código', p.sku, 'sku'), td('Producto', esc(p.nombre)),
          td('Especificaciones', Object.entries(p.specs).map(([k, v]) =>
            `<span class="pill gris">${esc(k)}: ${esc(v)}</span>`).join(' ')),
          td('Serial', f && f.serialado ? '<span class="pill cian">Con serial</span>' : '—') ];
      }))}</div></div>`;
}

/* ============================================================
   VISTA · ALERTAS
   ============================================================ */
function filaAlerta(a) {
  const et = { critico:'Crítico', urgente:'Urgente', proximo:'Próximo' }[a.prio];
  return `<div class="alerta-f ${a.prio}">
    <span class="marca"></span>
    <div class="txt"><b>${esc(a.titulo)}</b><p>${esc(a.mensaje)}</p>
      <span class="acc-sug">${IC.flecha} ${esc(a.accion)}</span></div>
    <div class="bts">
      <span class="pill ${a.prio === 'critico' ? 'rojo' : a.prio === 'urgente' ? 'ambar' : 'azul'}">${et}</span>
      ${a.wa ? `<a class="btn btn-wa btn-x" target="_blank" rel="noopener" href="${waHref(a.wa.tel, a.wa.texto)}">${IC.wa} WhatsApp</a>` : ''}
      ${a.area === 'pipeline'   ? `<button class="btn btn-l btn-x" data-pedido="${a.ref}">Abrir</button>` :
        a.area === 'inventario' ? `<button class="btn btn-l btn-x" data-ficha="${a.ref}">Abrir</button>` :
        a.area === 'cartera'    ? `<button class="btn btn-l btn-x" data-area="cartera">Ir a cartera</button>` :
        a.area === 'garantias'  ? `<button class="btn btn-l btn-x" data-garantia="${a.ref}">Abrir</button>` :
        a.area === 'clientes'   ? `<button class="btn btn-l btn-x" data-cliente="${a.ref}">Abrir</button>` : ''}
    </div></div>`;
}
global.filaAlerta = filaAlerta;

let filtroAlerta = '';
VISTAS.alertas = function () {
  const todas = Datos.alertas(EFA.CAT);
  const l = filtroAlerta ? todas.filter(a => a.prio === filtroAlerta) : todas;
  const n = p => todas.filter(a => a.prio === p).length;
  const bt = (v, t) => `<button class="btn ${filtroAlerta === v ? 'btn-p' : 'btn-l'} btn-x" data-prio="${v}">${t}</button>`;
  return `<div class="herramientas aparece">
      ${bt('', `Todas (${todas.length})`)}${bt('critico', `Críticas (${n('critico')})`)}
      ${bt('urgente', `Urgentes (${n('urgente')})`)}${bt('proximo', `Próximas (${n('proximo')})`)}
    </div>
    <div class="tarjeta aparece"><div class="tarjeta-cuerpo pegado">${l.length ? l.map(filaAlerta).join('')
      : vacio('Nada que resolver',
          'No hay alertas con este filtro. Cuando algo requiera acción aparece aquí, con el botón que la ejecuta.')}
    </div></div>`;
};

/* ============================================================
   ARRANQUE
   ============================================================ */
async function cargarCatalogo() {
  if (Array.isArray(global.EF_PRODUCTOS) && global.EF_PRODUCTOS.length) {
    EFA.CAT = global.EF_PRODUCTOS;
  } else {
    try {
      const r = await fetch('assets/data/productos.json', { cache:'default' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      EFA.CAT = await r.json();
    } catch (e) { EFA.error = e.message; console.error('Catálogo:', e); }
  }
  EFA.porSku = {};
  EFA.CAT.forEach(p => { EFA.porSku[p.sku] = p; });
  EFA.listo = true;
}

function arrancar() {
  const s = Sesion.actual();
  $('#acceso').style.display = 'none';
  $('#app').classList.add('activa');
  $('#u-nombre').textContent = s.nombre;
  $('#u-rol').textContent = s.rol;
  $('#u-inicial').textContent = s.nombre[0];
  $('#perfil-etiqueta').textContent = s.rol;
  const permitidas = pintarMenu();
  ir(permitidas[0].id);
}

function exportar(que) {
  if (que === 'pipeline') {
    descargar('pipeline.csv', aCSV(
      ['Pedido','Fecha','Cliente','Teléfono','Línea','Canal','Estado','Total','Pagado'],
      Datos.pedidos().map(p => [p.codigo, fecha(p.creado), p.cliente.nombre, p.cliente.telefono,
        p.linea, p.canal, (Datos.ETAPA[p.estado] || {}).t, p.total, p.pagado ? 'Sí' : 'No'])),
      'text/csv;charset=utf-8');
    return toast('Pipeline exportado');
  }
  if (que.startsWith('linea:')) {
    const cod = que.split(':')[1];
    const costos = Sesion.veCostos();
    descargar(`linea-${cod}.csv`, aCSV(
      ['SKU','Producto','Marca','Precio'].concat(costos ? ['Costo'] : [])
        .concat(['Stock','Reservado','Mínimo','Ubicación']),
      EFA.productosDeLinea(cod).map(p => {
        const f = Datos.ficha(p.sku) || {};
        const u = f.ubicacion ? [f.ubicacion.bodega, f.ubicacion.estante, f.ubicacion.nivel, f.ubicacion.caja].filter(Boolean).join(' · ') : '';
        const base = [p.sku, p.nombre, p.marca, f.precio || p.precio];
        if (costos) base.push(f.costo || 0);
        return base.concat([f.stock || 0, f.reservado || 0, f.minimo || '', u]);
      })), 'text/csv;charset=utf-8');
    return toast('Línea exportada');
  }
  if (que.startsWith('kardex:')) {
    const cod = que.split(':')[1];
    const skus = new Set(EFA.productosDeLinea(cod).map(p => p.sku));
    descargar(`kardex-${cod}.csv`, aCSV(
      ['Fecha','SKU','Producto','Tipo','Cantidad','Saldo','Motivo','Usuario'],
      Datos.kardex().filter(m => skus.has(m.sku)).map(m =>
        [fechaHora(m.fecha), m.sku, EFA.nombreSku(m.sku), m.tipo, m.cantidad, m.saldo, m.motivo, m.usuario])),
      'text/csv;charset=utf-8');
    return toast('Kardex exportado');
  }
  if (global.EXPORTAR && global.EXPORTAR[que]) return global.EXPORTAR[que]();
}

document.addEventListener('DOMContentLoaded', async () => {
  await cargarCatalogo();
  if (Sesion.actual()) arrancar();

  $('#entrar').addEventListener('click', () => {
    const u = Sesion.entrar($('#u').value, $('#c').value);
    if (!u) {
      const e = $('#acceso-error');
      e.textContent = 'Usuario o contraseña incorrectos.';
      return e.classList.add('visible');
    }
    arrancar();
  });
  ['u','c'].forEach(id => $('#' + id).addEventListener('keydown',
    e => { if (e.key === 'Enter') $('#entrar').click(); }));

  $('#salir').addEventListener('click', () => { Sesion.salir(); location.reload(); });
  $('#plegar').addEventListener('click', () => $('#app').classList.toggle('plegada'));
  $('#panel-cerrar').addEventListener('click', cerrarPanel);
  $('#velo').addEventListener('click', cerrarPanel);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarPanel();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const b = $('#buscar-global');
      if (b) { b.focus(); b.select(); }
    }
  });

  document.addEventListener('click', e => {
    const t = e.target;
    const sec = t.closest('[data-linea-sec]');
    if (sec) { seccionActual[sec.dataset.lineaSec] = sec.dataset.sec; return pintar(); }
    const area = t.closest('[data-area]');
    if (area) return ir(area.dataset.area);
    const lin = t.closest('[data-linea]');
    if (lin) return ir('lineas', lin.dataset.linea);
    const prio = t.closest('[data-prio]');
    if (prio) { filtroAlerta = prio.dataset.prio; return pintar(); }
    if (t.closest('[data-reintentar]')) return pintar();
    if (t.closest('[data-mas]')) return $('#menu').classList.toggle('abierto');
    if (t.closest('#campana')) return ir('alertas');
    const exp = t.closest('[data-exportar]');
    if (exp) return exportar(exp.dataset.exportar);
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'q-pipe') { filtroPipe.q = e.target.value; pintar(); $('#q-pipe').focus(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'f-canal')      { filtroPipe.canal = e.target.value; return pintar(); }
    if (e.target.id === 'f-linea-pipe') { filtroPipe.linea = e.target.value; return pintar(); }
  });

  $('#buscar-global').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim();
    if (!q) return;
    const p = Datos.pedidos().find(x => x.codigo.toLowerCase() === q.toLowerCase());
    if (p) return global.PANELES.pedido(p.codigo);
    if (EFA.porSku[q.toUpperCase()]) return global.PANELES.ficha(q.toUpperCase());
    const c = Datos.clientes().find(x => x.nombre.toLowerCase().includes(q.toLowerCase())
      || UI.digitos(x.telefono) === UI.digitos(q));
    if (c) return global.PANELES.cliente(c.id);
    toast('No encontré nada con «' + q + '»');
  });

  global.addEventListener('ef:datos', () => pintar());
});

global.EFA_pintar = pintar;
})(window);
