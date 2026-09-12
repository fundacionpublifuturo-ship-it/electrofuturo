/* ============================================================
   ELECTRO FUTURO — admin.js
   Portal administrativo. Tres perfiles con vistas independientes:
   comercial, gerencia y bodega.
   ============================================================ */
(function () {
'use strict';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const money = n => n == null || n === '' ? '—'
  : '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const fecha = f => f ? new Date(f).toLocaleDateString('es-CO',
  { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fechaHora = f => f ? new Date(f).toLocaleString('es-CO',
  { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';

function aviso(msg) {
  const a = $('#aviso-flotante');
  a.textContent = msg;
  a.classList.add('visible');
  clearTimeout(a._t);
  a._t = setTimeout(() => a.classList.remove('visible'), 2800);
}

/* ------------------------------------------------------------ CATÁLOGO */
let CAT = [];
const porSku = {};

async function cargarCatalogo() {
  if (Array.isArray(window.EF_PRODUCTOS) && window.EF_PRODUCTOS.length) {
    CAT = window.EF_PRODUCTOS;
    CAT.forEach(p => { porSku[p.sku] = p; });
    return;
  }
  try {
    const r = await fetch('assets/data/productos.json', { cache: 'default' });
    CAT = await r.json();
    CAT.forEach(p => { porSku[p.sku] = p; });
  } catch (e) {
    console.error('Catálogo:', e);
    aviso('No se pudo cargar el catálogo');
  }
}
const nombreSku = sku => (porSku[sku] && porSku[sku].nombre) || sku;

/* ------------------------------------------------------------ MENÚ */
const AREAS = [
  { id:'inicio',     ic:'▤', txt:'Inicio',       grupo:'Operación', sub:'Resumen del día' },
  { id:'pedidos',    ic:'▦', txt:'Pedidos',      grupo:'Operación', sub:'Seguimiento de recogidas y envíos' },
  { id:'clientes',   ic:'◍', txt:'Clientes',     grupo:'Operación', sub:'Base de datos de clientes' },
  { id:'inventario', ic:'▥', txt:'Inventario',   grupo:'Operación', sub:'Stock conectado con la tienda' },
  { id:'garantias',  ic:'⚙', txt:'Garantías',    grupo:'Operación', sub:'Casos radicados por los clientes' },
  { id:'cartera',    ic:'◷', txt:'Cartera',      grupo:'Dinero',    sub:'Cuentas por cobrar' },
  { id:'finanzas',   ic:'◈', txt:'Finanzas',     grupo:'Dinero',    sub:'Caja, utilidad y rentabilidad' },
  { id:'ajustes',    ic:'⚒', txt:'Ajustes',      grupo:'Sistema',   sub:'Respaldo, datos y auditoría' }
];

function pintarMenu() {
  const permitidas = AREAS.filter(a => Sesion.puede(a.id));
  let grupo = '', html = '';
  permitidas.forEach(a => {
    if (a.grupo !== grupo) { grupo = a.grupo; html += `<div class="grupo">${grupo}</div>`; }
    html += `<button data-area="${a.id}"><i>${a.ic}</i>${a.txt}</button>`;
  });
  $('#menu').innerHTML = html;
  return permitidas;
}

let areaActual = 'inicio';

function ir(area) {
  if (!Sesion.puede(area)) return;
  areaActual = area;
  const meta = AREAS.find(a => a.id === area);
  $$('#menu button').forEach(b => b.classList.toggle('activo', b.dataset.area === area));
  $$('.vista').forEach(v => v.classList.toggle('activa', v.id === 'v-' + area));
  $('#titulo').textContent = meta.txt;
  $('#subtitulo').textContent = meta.sub;
  $('#acciones').innerHTML = area === 'pedidos'
    ? '<button class="btn btn-p btn-x" id="nuevo-pedido">Registrar pedido de mostrador</button>' : '';
  pintar();
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------ PINTADO */
function pintar() {
  const f = {
    inicio: pintarInicio, pedidos: pintarPedidos, clientes: pintarClientes,
    inventario: pintarInventario, cartera: pintarCartera, finanzas: pintarFinanzas,
    garantias: pintarGarantias, ajustes: pintarAjustes
  }[areaActual];
  if (f) f();
}

const pillEstado = e => {
  const color = { nuevo:'gris', pago_verificado:'cian', alistando:'ambar',
    listo_recoger:'cian', despachado:'cian', entregado:'verde',
    anulado:'rojo', devuelto:'rojo' }[e] || 'gris';
  return `<span class="pill ${color}">${Datos.ETIQUETA_ESTADO[e] || e}</span>`;
};

/* ---------- INICIO ---------- */
function pintarInicio() {
  const ped = Datos.pedidos();
  const hoy = new Date().toISOString().slice(0, 10);
  const rol = Sesion.actual().rol;
  const vivos = ped.filter(p => !['entregado','anulado','devuelto'].includes(p.estado));
  const delDia = ped.filter(p => p.creado.slice(0, 10) === hoy);
  const ventaDia = delDia.reduce((a, p) => a + (p.total || 0), 0);
  const porCobrar = Datos.cartera().filter(c => c.estado !== 'pagada' && c.estado !== 'anulada')
    .reduce((a, c) => a + (c.monto - c.abonado), 0);
  const alertas = Datos.alertasStock();

  let c = [];
  if (rol === 'bodega') {
    c = [
      ['Por alistar', ped.filter(p => p.estado === 'alistando').length, 'Pedidos en preparación', ''],
      ['Listos para recoger', ped.filter(p => p.estado === 'listo_recoger').length, 'Esperando al cliente', 'ok'],
      ['Por despachar', ped.filter(p => p.estado === 'pago_verificado' && p.entrega === 'envio').length, 'Envíos pendientes', ''],
      ['Alertas de stock', alertas.length, 'Referencias en el mínimo', alertas.length ? 'alerta' : 'ok']
    ];
  } else {
    c = [
      ['Pedidos de hoy', delDia.length, money(ventaDia) + ' en ventas', ''],
      ['Pedidos abiertos', vivos.length, 'Sin entregar todavía', ''],
      ['Por cobrar', money(porCobrar), Datos.cartera().filter(x => x.estado !== 'pagada' && x.estado !== 'anulada').length + ' cuentas', porCobrar ? 'alerta' : 'ok'],
      ['Alertas de stock', alertas.length, 'Referencias en el mínimo', alertas.length ? 'alerta' : 'ok']
    ];
    if (Sesion.veCostos()) {
      const mes = new Date().toISOString().slice(0, 7);
      const delMes = ped.filter(p => p.creado.slice(0, 7) === mes && p.estado !== 'anulado');
      const venta = delMes.reduce((a, p) => a + (p.total || 0), 0);
      const costo = delMes.reduce((a, p) => a + costoPedido(p), 0);
      c.push(['Utilidad bruta del mes', money(venta - costo), money(venta) + ' vendidos', 'ok']);
    }
  }
  $('#tablero').innerHTML = c.map(([t, v, s, cl]) =>
    `<div class="cifra ${cl}"><span>${t}</span><b>${v}</b><small>${s}</small></div>`).join('');

  $('#tabla-alertas').innerHTML = alertas.length ? tabla(
    ['Código', 'Producto', { t:'Disponible', num:1 }, { t:'Mínimo', num:1 }, ''],
    alertas.slice(0, 12).map(a => [
      `<td class="sku">${a.sku}</td>`,
      `<td>${esc(nombreSku(a.sku))}</td>`,
      `<td class="num"><b style="color:var(--rojo)">${a.disponible}</b></td>`,
      `<td class="num">${a.minimo}</td>`,
      `<td class="acc"><button class="btn btn-l btn-x" data-ficha="${a.sku}">Reponer</button></td>`
    ])) : vacio('Sin alertas', 'Ninguna referencia con inventario está bajo el mínimo.');

  const ult = ped.slice(0, 10);
  $('#tabla-ultimos').innerHTML = ult.length ? tabla(
    ['Pedido', 'Cliente', 'Entrega', 'Estado', { t:'Total', num:1 }],
    ult.map(p => [
      `<td class="sku"><a href="#" data-pedido="${p.codigo}"><b>${p.codigo}</b></a></td>`,
      `<td>${esc(p.cliente.nombre || '—')}</td>`,
      `<td>${p.entrega === 'recoger' ? 'Recoger' : 'Envío'}</td>`,
      `<td>${pillEstado(p.estado)}</td>`,
      `<td class="num">${money(p.total)}</td>`
    ])) : vacio('Todavía no hay pedidos', 'Los pedidos de la tienda aparecen aquí apenas se confirman.');
}

/* ---------- PEDIDOS ---------- */
function pintarPedidos() {
  const sel = $('#f-estado');
  if (sel.options.length === 1) {
    Datos.ESTADOS.forEach(e => sel.add(new Option(Datos.ETIQUETA_ESTADO[e], e)));
  }
  const q = $('#q-pedidos').value.trim().toLowerCase();
  const fe = sel.value, fen = $('#f-entrega').value;
  const l = Datos.pedidos().filter(p => {
    if (fe && p.estado !== fe) return false;
    if (fen && p.entrega !== fen) return false;
    if (!q) return true;
    return (p.codigo + ' ' + p.cliente.nombre + ' ' + p.cliente.telefono).toLowerCase().includes(q);
  });
  $('#tabla-pedidos').innerHTML = l.length ? tabla(
    ['Pedido', 'Fecha', 'Cliente', 'Entrega', 'Pago', 'Estado', { t:'Total', num:1 }, ''],
    l.map(p => [
      `<td class="sku"><b>${p.codigo}</b></td>`,
      `<td>${fecha(p.creado)}</td>`,
      `<td>${esc(p.cliente.nombre || '—')}<br><small style="color:var(--gris)">${esc(p.cliente.telefono || '')}</small></td>`,
      `<td>${p.entrega === 'recoger' ? 'Recoger' : 'Envío' + (p.guia ? '<br><small style="color:var(--gris)">' + esc(p.guia) + '</small>' : '')}</td>`,
      `<td>${p.pagado ? '<span class="pill verde">Pagado</span>' : '<span class="pill ambar">Pendiente</span>'}</td>`,
      `<td>${pillEstado(p.estado)}</td>`,
      `<td class="num">${money(p.total)}</td>`,
      `<td class="acc"><button class="btn btn-l btn-x" data-pedido="${p.codigo}">Abrir</button></td>`
    ])) : vacio('Sin pedidos', 'Ajusta los filtros o espera a que entre el primero.');
}

/* ---------- CLIENTES ---------- */
function pintarClientes() {
  const q = $('#q-clientes').value.trim().toLowerCase();
  const l = Datos.clientes().filter(c =>
    !q || (c.nombre + ' ' + c.telefono + ' ' + (c.documento || '')).toLowerCase().includes(q));
  $('#tabla-clientes').innerHTML = l.length ? tabla(
    ['Cliente', 'Teléfono', 'Ciudad', 'Tipo', { t:'Pedidos', num:1 }, { t:'Comprado', num:1 }, ''],
    l.map(c => {
      const ped = Datos.pedidosDeCliente(c.id).filter(p => p.estado !== 'anulado');
      return [
        `<td><b>${esc(c.nombre)}</b>${c.autoriza_datos ? '' : ' <span class="pill ambar">Sin autorización</span>'}</td>`,
        `<td>${esc(c.telefono || '—')}</td>`,
        `<td>${esc(c.ciudad || '—')}</td>`,
        `<td><span class="pill ${c.tipo === 'mayorista' ? 'cian' : 'gris'}">${c.tipo}</span></td>`,
        `<td class="num">${ped.length}</td>`,
        `<td class="num">${money(ped.reduce((a, p) => a + p.total, 0))}</td>`,
        `<td class="acc"><button class="btn btn-l btn-x" data-cliente="${c.id}">Abrir</button></td>`
      ];
    })) : vacio('Sin clientes todavía', 'Se crean solos cuando entra un pedido, o puedes agregarlos a mano.');
}

/* ---------- INVENTARIO ---------- */
function pintarInventario() {
  const inv = Datos.inventario();
  const conAlta = Object.keys(inv).length;
  $('#aviso-inventario').innerHTML = `Hay <b>${conAlta}</b> de <b>${CAT.length}</b> referencias con
    inventario cargado. Las que no tienen inventario siguen mostrándose en la tienda con su
    disponibilidad actual; las que sí lo tienen pasan a <b>Agotado</b> cuando el disponible llega a cero.`;

  const selc = $('#f-cat-inv');
  if (selc.options.length === 1) {
    [...new Set(CAT.map(p => p.categoria))].sort().forEach(c => selc.add(new Option(c, c)));
  }
  const q = $('#q-inv').value.trim().toLowerCase();
  const cat = selc.value, modo = $('#f-inv').value;

  let l = CAT.filter(p => {
    if (cat && p.categoria !== cat) return false;
    if (q && !(p.sku + ' ' + p.nombre + ' ' + p.marca).toLowerCase().includes(q)) return false;
    const f = inv[p.sku];
    if (modo === 'alta' && !f) return false;
    if (modo === 'sin' && f) return false;
    if (modo === 'bajo' && (!f || (f.stock - f.reservado) > f.minimo)) return false;
    return true;
  }).slice(0, 300);

  const costos = Sesion.veCostos();
  const cab = ['Código', 'Producto', { t:'Precio', num:1 }];
  if (costos) cab.push({ t:'Costo', num:1 }, { t:'Margen', num:1 });
  cab.push({ t:'Stock', num:1 }, { t:'Reserv.', num:1 }, { t:'Mínimo', num:1 }, '');

  $('#tabla-inv').innerHTML = l.length ? tabla(cab, l.map(p => {
    const f = inv[p.sku];
    const precio = f ? f.precio || p.precio : p.precio;
    const disp = f ? f.stock - f.reservado : null;
    const fila = [
      `<td class="sku">${p.sku}</td>`,
      `<td>${esc(p.nombre)}<br><small style="color:var(--gris)">${esc(p.marca)} · ${esc(p.subcategoria)}</small></td>`,
      `<td class="num">${money(precio)}</td>`
    ];
    if (costos) {
      const margen = f && f.costo ? Math.round((1 - f.costo / precio) * 100) : null;
      fila.push(`<td class="num">${f ? money(f.costo) : '—'}</td>`,
        `<td class="num">${margen == null ? '—' :
          `<span class="pill ${margen < 15 ? 'rojo' : margen < 30 ? 'ambar' : 'verde'}">${margen} %</span>`}</td>`);
    }
    fila.push(
      `<td class="num">${f ? `<b style="color:${disp <= f.minimo ? 'var(--rojo)' : 'inherit'}">${f.stock}</b>` : '<span style="color:var(--gris-suave)">—</span>'}</td>`,
      `<td class="num">${f ? (f.reservado || 0) : '—'}</td>`,
      `<td class="num">${f ? f.minimo : '—'}</td>`,
      `<td class="acc"><button class="btn ${f ? 'btn-l' : 'btn-p'} btn-x" data-ficha="${p.sku}">${f ? 'Editar' : 'Dar de alta'}</button></td>`
    );
    return fila;
  })) : vacio('Sin resultados', 'Cambia la búsqueda o el filtro.');
}

/* ---------- CARTERA ---------- */
function pintarCartera() {
  const l = Datos.cartera().filter(c => c.estado !== 'anulada');
  const abiertas = l.filter(c => c.estado !== 'pagada');
  const saldo = abiertas.reduce((a, c) => a + (c.monto - c.abonado), 0);
  const hoy = new Date().toISOString().slice(0, 10);
  const vencidas = abiertas.filter(c => c.vence < hoy);

  $('#cifras-cartera').innerHTML = [
    ['Saldo por cobrar', money(saldo), abiertas.length + ' cuentas abiertas', saldo ? 'alerta' : 'ok'],
    ['Vencidas', money(vencidas.reduce((a, c) => a + (c.monto - c.abonado), 0)),
      vencidas.length + ' cuentas pasadas de fecha', vencidas.length ? 'alerta' : 'ok'],
    ['Recaudado', money(l.reduce((a, c) => a + c.abonado, 0)), 'Abonos y pagos completos', 'ok']
  ].map(([t, v, s, cl]) => `<div class="cifra ${cl}"><span>${t}</span><b>${v}</b><small>${s}</small></div>`).join('');

  $('#tabla-cartera').innerHTML = abiertas.length ? tabla(
    ['Pedido', 'Cliente', 'Vence', { t:'Monto', num:1 }, { t:'Abonado', num:1 }, { t:'Saldo', num:1 }, 'Estado', ''],
    abiertas.map(c => {
      const cli = Datos.cliente(c.clienteId);
      const vencida = c.vence < hoy;
      return [
        `<td class="sku">${c.pedido}</td>`,
        `<td>${esc(cli ? cli.nombre : '—')}</td>`,
        `<td>${fecha(c.vence)}${vencida ? ' <span class="pill rojo">Vencida</span>' : ''}</td>`,
        `<td class="num">${money(c.monto)}</td>`,
        `<td class="num">${money(c.abonado)}</td>`,
        `<td class="num"><b>${money(c.monto - c.abonado)}</b></td>`,
        `<td><span class="pill ${c.estado === 'parcial' ? 'ambar' : 'gris'}">${c.estado}</span></td>`,
        `<td class="acc"><button class="btn btn-p btn-x" data-abono="${c.id}">Registrar abono</button></td>`
      ];
    })) : vacio('Nada por cobrar', 'Todos los pedidos están pagados.');
}

/* ---------- FINANZAS ---------- */
function costoPedido(p) {
  const inv = Datos.inventario();
  return p.items.reduce((a, i) => a + ((inv[i.sku] && inv[i.sku].costo) || 0) * i.qty, 0);
}

function pintarFinanzas() {
  const caja = Datos.caja();
  const mes = new Date().toISOString().slice(0, 7);
  const delMes = caja.filter(m => m.fecha.slice(0, 7) === mes);
  const ing = delMes.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0);
  const egr = delMes.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0);
  const ped = Datos.pedidos().filter(p => p.creado.slice(0, 7) === mes && p.estado !== 'anulado');
  const costo = ped.reduce((a, p) => a + costoPedido(p), 0);
  const venta = ped.reduce((a, p) => a + p.total, 0);

  $('#cifras-finanzas').innerHTML = [
    ['Ingresos del mes', money(ing), delMes.filter(m => m.tipo === 'ingreso').length + ' movimientos', 'ok'],
    ['Egresos del mes', money(egr), delMes.filter(m => m.tipo === 'egreso').length + ' movimientos', egr ? 'alerta' : ''],
    ['Caja del mes', money(ing - egr), 'Ingresos menos egresos', ''],
    ['Utilidad bruta', money(venta - costo), money(venta) + ' vendidos · ' + money(costo) + ' de costo', 'ok']
  ].map(([t, v, s, cl]) => `<div class="cifra ${cl}"><span>${t}</span><b>${v}</b><small>${s}</small></div>`).join('');

  $('#tabla-caja').innerHTML = caja.length ? tabla(
    ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Método', { t:'Monto', num:1 }],
    caja.slice().reverse().slice(0, 60).map(m => [
      `<td>${fecha(m.fecha)}</td>`,
      `<td><span class="pill ${m.tipo === 'ingreso' ? 'verde' : 'rojo'}">${m.tipo}</span></td>`,
      `<td>${esc(m.categoria || '—')}</td>`,
      `<td>${esc(m.descripcion || '—')}</td>`,
      `<td>${esc(m.metodo || '—')}</td>`,
      `<td class="num">${m.tipo === 'egreso' ? '− ' : ''}${money(m.monto)}</td>`
    ])) : vacio('Sin movimientos', 'Los pagos de pedidos entran aquí solos. Los gastos se registran a mano.');

  const conCosto = ped.filter(p => costoPedido(p) > 0);
  $('#tabla-margen').innerHTML = conCosto.length ? tabla(
    ['Pedido', 'Cliente', { t:'Venta', num:1 }, { t:'Costo', num:1 }, { t:'Utilidad', num:1 }, { t:'Margen', num:1 }],
    conCosto.map(p => {
      const c = costoPedido(p), u = p.total - c;
      const m = p.total ? Math.round(u / p.total * 100) : 0;
      return [
        `<td class="sku">${p.codigo}</td>`,
        `<td>${esc(p.cliente.nombre || '—')}</td>`,
        `<td class="num">${money(p.total)}</td>`,
        `<td class="num">${money(c)}</td>`,
        `<td class="num"><b>${money(u)}</b></td>`,
        `<td class="num"><span class="pill ${m < 15 ? 'rojo' : m < 30 ? 'ambar' : 'verde'}">${m} %</span></td>`
      ];
    })) : vacio('Sin datos de rentabilidad',
      'Carga el costo de los productos en Inventario y la utilidad se calcula sola.');
}

/* ---------- GARANTÍAS ---------- */
function pintarGarantias() {
  const l = Datos.garantias();
  $('#tabla-garantias').innerHTML = l.length ? tabla(
    ['Caso', 'Fecha', 'Cliente', 'Pedido', 'Producto', 'Motivo', 'Estado', ''],
    l.map(g => [
      `<td class="sku">${g.id}</td>`,
      `<td>${fecha(g.creado)}</td>`,
      `<td>${esc(g.cliente || '—')}</td>`,
      `<td class="sku">${esc(g.pedido || '—')}</td>`,
      `<td>${esc(nombreSku(g.sku))}</td>`,
      `<td>${esc(g.motivo || '').slice(0, 60)}</td>`,
      `<td><span class="pill ${g.estado === 'resuelta' ? 'verde' : g.estado === 'rechazada' ? 'rojo' : 'ambar'}">${g.estado}</span></td>`,
      `<td class="acc"><button class="btn btn-l btn-x" data-garantia="${g.id}">Gestionar</button></td>`
    ])) : vacio('Sin garantías radicadas', 'Los clientes las radican desde su portal.');
}

/* ---------- AJUSTES ---------- */
function pintarAjustes() {
  const a = Datos.auditoria();
  $('#tabla-auditoria').innerHTML = a.length ? tabla(
    ['Fecha', 'Usuario', 'Módulo', 'Acción', 'Detalle'],
    a.slice(0, 80).map(x => [
      `<td>${fechaHora(x.fecha)}</td>`,
      `<td>${esc(x.usuario)}</td>`,
      `<td>${esc(x.tabla)}</td>`,
      `<td>${esc(x.accion)}</td>`,
      `<td>${esc(x.detalle || '')}</td>`
    ])) : vacio('Sin registros', 'Cada cambio queda aquí con fecha y usuario.');
}

/* ------------------------------------------------------------ TABLAS */
function tabla(cabeceras, filas) {
  const th = cabeceras.map(c => typeof c === 'string'
    ? `<th>${c}</th>` : `<th class="${c.num ? 'num' : ''}">${c.t}</th>`).join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${
    filas.map(f => `<tr>${f.join('')}</tr>`).join('')}</tbody></table>`;
}
const vacio = (t, p) => `<div class="vacio-est"><h4>${t}</h4><p>${p}</p></div>`;

/* ------------------------------------------------------------ PANEL */
function abrirPanel(titulo, sub, cuerpo, pie) {
  $('#panel-titulo').textContent = titulo;
  $('#panel-sub').textContent = sub || '';
  $('#panel-cuerpo').innerHTML = cuerpo;
  $('#panel-pie').innerHTML = pie || '';
  $('#panel').classList.add('abierto');
  $('#velo').classList.add('abierto');
}
function cerrarPanel() {
  $('#panel').classList.remove('abierto');
  $('#velo').classList.remove('abierto');
}

/* ---------- detalle de pedido ---------- */
function panelPedido(codigo) {
  const p = Datos.pedido(codigo);
  if (!p) return;
  const cli = Datos.cliente(p.clienteId);
  const items = p.items.map(i => `
    <tr><td class="sku">${i.sku}</td><td>${esc(i.nombre)}</td>
    <td class="num">${i.qty}</td><td class="num">${money(i.precio * i.qty)}</td></tr>`).join('');

  const linea = p.eventos.map(e => `
    <li class="hecho"><b>${Datos.ETIQUETA_ESTADO[e.estado] || e.estado}</b>
    <small>${fechaHora(e.fecha)} · ${esc(e.usuario)}</small>
    ${e.nota ? `<em>${esc(e.nota)}</em>` : ''}</li>`).join('');

  const opciones = Datos.ESTADOS.map(e =>
    `<option value="${e}" ${e === p.estado ? 'selected' : ''}>${Datos.ETIQUETA_ESTADO[e]}</option>`).join('');

  const envio = p.entrega === 'envio' ? `
    <div class="rejilla">
      <div class="campo"><label>Transportadora</label>
        <input type="text" id="p-transp" value="${esc(p.transportadora)}" placeholder="Interrapidísimo"></div>
      <div class="campo"><label>Número de guía</label>
        <input type="text" id="p-guia" value="${esc(p.guia)}"></div>
    </div>` : '';

  const cuerpo = `
    <dl class="dl">
      <dt>Cliente</dt><dd>${esc(p.cliente.nombre || '—')}</dd>
      <dt>WhatsApp</dt><dd>${esc(p.cliente.telefono || '—')}</dd>
      <dt>Correo</dt><dd>${esc(p.cliente.correo || '—')}</dd>
      <dt>Entrega</dt><dd>${p.entrega === 'recoger' ? 'Recoge en el local' : esc(p.cliente.direccion || 'Envío')}</dd>
      <dt>Ciudad</dt><dd>${esc(p.cliente.ciudad || '—')}</dd>
      <dt>Método de pago</dt><dd>${esc(p.metodoPago || '—')}</dd>
      <dt>Referencia</dt><dd>${esc(p.referenciaPago || '—')}</dd>
      <dt>Autorización de datos</dt><dd>${p.consentimiento ? 'Sí · ' + fecha(p.consentimiento.fecha) : 'No registrada'}</dd>
    </dl>
    <div class="tabla-cont" style="border:1px solid var(--linea);border-radius:12px;overflow:hidden;margin-bottom:18px">
      <table><thead><tr><th>Código</th><th>Producto</th><th class="num">Cant.</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${items}</tbody></table>
    </div>
    <dl class="dl">
      <dt>Subtotal</dt><dd>${money(p.subtotal)}</dd>
      ${p.descuento ? `<dt>Descuento</dt><dd>− ${money(p.descuento)}</dd>` : ''}
      ${p.envio ? `<dt>Envío</dt><dd>${money(p.envio)}</dd>` : ''}
      <dt><b>Total</b></dt><dd><b>${money(p.total)}</b></dd>
      <dt>Pago</dt><dd>${p.pagado ? 'Confirmado' : 'Pendiente'}</dd>
    </dl>
    ${envio}
    <div class="campo"><label for="p-estado">Cambiar estado</label>
      <select id="p-estado">${opciones}</select></div>
    <div class="campo"><label for="p-nota">Nota del cambio (opcional)</label>
      <input type="text" id="p-nota" placeholder="Ej.: se despachó con guía 998877"></div>
    <h4 style="font-size:.9rem;margin:22px 0 14px">Línea de tiempo</h4>
    <ul class="linea-tiempo">${linea}</ul>`;

  const wa = 'https://wa.me/57' + String(p.cliente.telefono || '').replace(/\D/g, '') +
    '?text=' + encodeURIComponent(`Hola ${p.cliente.nombre || ''} 👋 tu pedido *${p.codigo}* está en estado: *${Datos.ETIQUETA_ESTADO[p.estado]}*.`);

  const pie = `
    <button class="btn btn-p" data-guardar-pedido="${p.codigo}">Guardar cambios</button>
    ${p.pagado ? '' : `<button class="btn btn-l" data-pagar="${p.codigo}">Marcar como pagado</button>`}
    <a class="btn btn-l" target="_blank" rel="noopener" href="${wa}">Avisar por WhatsApp</a>
    ${p.estado === 'anulado' ? '' : `<button class="btn btn-d" data-anular="${p.codigo}">Anular</button>`}`;

  abrirPanel('Pedido ' + p.codigo, fechaHora(p.creado) + (cli ? ' · ' + cli.id : ''), cuerpo, pie);
}

/* ---------- ficha de cliente ---------- */
function panelCliente(id) {
  const c = id ? Datos.cliente(id) : null;
  const ped = c ? Datos.pedidosDeCliente(c.id) : [];
  const cuerpo = `
    <div class="campo"><label>Nombre o negocio</label>
      <input type="text" id="cl-nombre" value="${esc(c ? c.nombre : '')}"></div>
    <div class="rejilla">
      <div class="campo"><label>WhatsApp</label>
        <input type="text" id="cl-tel" value="${esc(c ? c.telefono : '')}"></div>
      <div class="campo"><label>Documento</label>
        <input type="text" id="cl-doc" value="${esc(c ? c.documento || '' : '')}"></div>
    </div>
    <div class="campo"><label>Correo</label>
      <input type="text" id="cl-correo" value="${esc(c ? c.correo || '' : '')}"></div>
    <div class="rejilla">
      <div class="campo"><label>Ciudad</label>
        <input type="text" id="cl-ciudad" value="${esc(c ? c.ciudad || 'Ibagué' : 'Ibagué')}"></div>
      <div class="campo"><label>Tipo de cliente</label>
        <select id="cl-tipo">
          ${['minorista','mayorista','estudiante'].map(t =>
            `<option value="${t}" ${c && c.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select><small>El mayorista y el estudiante entran a la lista de precios especial.</small></div>
    </div>
    <div class="campo"><label>Dirección</label>
      <input type="text" id="cl-dir" value="${esc(c ? c.direccion || '' : '')}"></div>
    <div class="campo"><label>Notas internas</label>
      <textarea id="cl-notas" rows="3">${esc(c ? c.notas || '' : '')}</textarea></div>
    ${c ? `<h4 style="font-size:.9rem;margin:22px 0 12px">Historial (${ped.length} pedidos)</h4>
      ${ped.length ? `<div class="tabla-cont" style="border:1px solid var(--linea);border-radius:12px;overflow:hidden">
      <table><thead><tr><th>Pedido</th><th>Fecha</th><th>Estado</th><th class="num">Total</th></tr></thead><tbody>
      ${ped.map(p => `<tr><td class="sku">${p.codigo}</td><td>${fecha(p.creado)}</td>
        <td>${pillEstado(p.estado)}</td><td class="num">${money(p.total)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p style="color:var(--gris);font-size:.84rem">Todavía no ha comprado.</p>'}` : ''}`;

  abrirPanel(c ? c.nombre : 'Nuevo cliente', c ? c.id : 'Se crea al guardar', cuerpo,
    `<button class="btn btn-p" data-guardar-cliente="${c ? c.id : ''}">Guardar</button>`);
}

/* ---------- ficha de inventario ---------- */
function panelFicha(sku) {
  const p = porSku[sku];
  const f = Datos.ficha(sku);
  const costos = Sesion.veCostos();
  const kar = Datos.kardex(sku).slice(0, 15);
  const cuerpo = `
    <dl class="dl">
      <dt>Producto</dt><dd>${esc(p ? p.nombre : sku)}</dd>
      <dt>Marca</dt><dd>${esc(p ? p.marca : '—')}</dd>
      <dt>Categoría</dt><dd>${esc(p ? p.categoria + ' · ' + p.subcategoria : '—')}</dd>
      <dt>Precio del catálogo</dt><dd>${money(p ? p.precio : null)}</dd>
    </dl>
    <div class="rejilla-3">
      <div class="campo"><label>Stock físico</label>
        <input type="number" id="f-stock" min="0" value="${f ? f.stock : 0}"></div>
      <div class="campo"><label>Stock mínimo</label>
        <input type="number" id="f-min" min="0" value="${f ? f.minimo : 3}"></div>
      <div class="campo"><label>Reservado</label>
        <input type="number" value="${f ? f.reservado || 0 : 0}" disabled>
        <small>Lo comprometen los pedidos abiertos.</small></div>
    </div>
    <div class="rejilla">
      <div class="campo"><label>Precio de venta</label>
        <input type="number" id="f-precio" min="0" value="${f ? f.precio || (p ? p.precio : 0) : (p ? p.precio : 0)}"></div>
      ${costos ? `<div class="campo"><label>Costo unitario</label>
        <input type="number" id="f-costo" min="0" value="${f ? f.costo : 0}">
        <small>Solo lo ve gerencia.</small></div>` : ''}
    </div>
    <div class="campo">
      <label>Movimiento rápido</label>
      <div style="display:flex;gap:8px">
        <input type="number" id="f-cant" min="1" value="1" style="max-width:96px">
        <button class="btn btn-l" data-mov="entrada" data-sku="${sku}">Entrada</button>
        <button class="btn btn-l" data-mov="salida" data-sku="${sku}">Salida</button>
      </div>
      <small>La entrada suma al stock, la salida lo descuenta y ambas quedan en el kardex.</small>
    </div>
    <h4 style="font-size:.9rem;margin:22px 0 12px">Kardex</h4>
    ${kar.length ? `<div class="tabla-cont" style="border:1px solid var(--linea);border-radius:12px;overflow:hidden">
      <table><thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Cant.</th><th class="num">Saldo</th><th>Motivo</th></tr></thead>
      <tbody>${kar.map(m => `<tr><td>${fechaHora(m.fecha)}</td><td>${m.tipo}</td>
        <td class="num">${m.cantidad}</td><td class="num">${m.saldo}</td>
        <td>${esc(m.motivo)}</td></tr>`).join('')}</tbody></table></div>`
      : '<p style="color:var(--gris);font-size:.84rem">Sin movimientos todavía.</p>'}`;

  abrirPanel(sku, p ? p.nombre : '', cuerpo,
    `<button class="btn btn-p" data-guardar-ficha="${sku}">Guardar</button>`);
}

/* ---------- abono ---------- */
function panelAbono(id) {
  const c = Datos.cartera().find(x => x.id === id);
  if (!c) return;
  const saldo = c.monto - c.abonado;
  abrirPanel('Registrar abono', c.pedido, `
    <dl class="dl">
      <dt>Monto total</dt><dd>${money(c.monto)}</dd>
      <dt>Abonado</dt><dd>${money(c.abonado)}</dd>
      <dt><b>Saldo</b></dt><dd><b>${money(saldo)}</b></dd>
      <dt>Vence</dt><dd>${fecha(c.vence)}</dd>
    </dl>
    <div class="campo"><label>Valor del abono</label>
      <input type="number" id="ab-monto" min="1" max="${saldo}" value="${saldo}"></div>
    <div class="campo"><label>Método</label>
      <select id="ab-metodo">
        <option>Efectivo</option><option>Bancolombia</option>
        <option>Lulo Bank</option><option>Bre-B</option><option>Otro</option>
      </select></div>`,
    `<button class="btn btn-p" data-guardar-abono="${id}">Registrar abono</button>`);
}

/* ---------- movimiento de caja ---------- */
function panelMovimiento() {
  abrirPanel('Registrar movimiento', 'Caja', `
    <div class="campo"><label>Tipo</label>
      <select id="mv-tipo"><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select></div>
    <div class="campo"><label>Categoría</label>
      <select id="mv-cat">
        <option>Compra de mercancía</option><option>Arriendo</option><option>Servicios</option>
        <option>Nómina</option><option>Transporte</option><option>Publicidad</option>
        <option>Otro ingreso</option><option>Otro egreso</option>
      </select></div>
    <div class="campo"><label>Descripción</label><input type="text" id="mv-desc"></div>
    <div class="rejilla">
      <div class="campo"><label>Monto</label><input type="number" id="mv-monto" min="1"></div>
      <div class="campo"><label>Método</label>
        <select id="mv-metodo"><option>Efectivo</option><option>Bancolombia</option>
          <option>Lulo Bank</option><option>Bre-B</option><option>Otro</option></select></div>
    </div>`,
    '<button class="btn btn-p" id="guardar-mov">Guardar</button>');
}

/* ---------- garantía ---------- */
function panelGarantia(id) {
  const g = Datos.garantias().find(x => x.id === id);
  if (!g) return;
  abrirPanel('Garantía ' + g.id, fecha(g.creado), `
    <dl class="dl">
      <dt>Cliente</dt><dd>${esc(g.cliente || '—')}</dd>
      <dt>Pedido</dt><dd>${esc(g.pedido || '—')}</dd>
      <dt>Producto</dt><dd>${esc(nombreSku(g.sku))}</dd>
    </dl>
    <div class="campo"><label>Motivo reportado</label>
      <textarea rows="3" disabled>${esc(g.motivo || '')}</textarea></div>
    <div class="campo"><label>Estado</label>
      <select id="g-estado">
        ${['radicada','en_revision','aprobada','rechazada','resuelta'].map(e =>
          `<option value="${e}" ${g.estado === e ? 'selected' : ''}>${e.replace('_', ' ')}</option>`).join('')}
      </select></div>
    <div class="campo"><label>Respuesta al cliente</label>
      <textarea id="g-nota" rows="3">${esc(g.nota || '')}</textarea></div>`,
    `<button class="btn btn-p" data-guardar-garantia="${g.id}">Guardar</button>`);
}

/* ---------- pedido de mostrador ---------- */
function panelNuevoPedido() {
  abrirPanel('Pedido de mostrador', 'Venta registrada por un asesor', `
    <div class="aviso info">Sirve para las ventas que se hacen en el local. Descuenta
      inventario igual que un pedido de la web.</div>
    <div class="rejilla">
      <div class="campo"><label>Nombre del cliente</label><input type="text" id="np-nombre"></div>
      <div class="campo"><label>WhatsApp</label><input type="text" id="np-tel"></div>
    </div>
    <div class="campo"><label>Producto</label>
      <input type="text" id="np-buscar" placeholder="Escribe el SKU o el nombre" autocomplete="off">
      <div id="np-sug"></div></div>
    <div id="np-items" style="margin:14px 0"></div>
    <div class="rejilla">
      <div class="campo"><label>Método de pago</label>
        <select id="np-pago"><option>Efectivo</option><option>Bancolombia</option>
          <option>Lulo Bank</option><option>Bre-B</option></select></div>
      <div class="campo"><label>¿Ya pagó?</label>
        <select id="np-pagado"><option value="1">Sí, pagado</option><option value="0">No, queda en cartera</option></select></div>
    </div>`,
    '<button class="btn btn-p" id="guardar-np">Registrar venta</button>');
  NP.items = [];
  pintarNP();
}

const NP = { items: [] };
function pintarNP() {
  const total = NP.items.reduce((a, i) => a + i.precio * i.qty, 0);
  $('#np-items').innerHTML = NP.items.length
    ? `<div class="tabla-cont" style="border:1px solid var(--linea);border-radius:12px;overflow:hidden">
       <table><tbody>${NP.items.map((i, n) => `<tr>
         <td class="sku">${i.sku}</td><td>${esc(i.nombre)}</td>
         <td class="num"><input type="number" class="mini" min="1" value="${i.qty}" data-np-qty="${n}"></td>
         <td class="num">${money(i.precio * i.qty)}</td>
         <td class="acc"><button class="btn btn-d btn-x" data-np-quitar="${n}">×</button></td></tr>`).join('')}
       <tr><td colspan="3"><b>Total</b></td><td class="num"><b>${money(total)}</b></td><td></td></tr>
       </tbody></table></div>`
    : '<p style="color:var(--gris);font-size:.84rem">Agrega al menos un producto.</p>';
}

/* ------------------------------------------------------------ CSV */
function importarCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim());
  const cab = lineas.shift().toLowerCase().split(/[;,\t]/).map(s => s.trim());
  const iSku = cab.findIndex(c => c.includes('sku') || c === 'codigo' || c === 'código');
  const iStock = cab.findIndex(c => c.includes('stock') || c.includes('cantidad'));
  const iCosto = cab.findIndex(c => c.includes('costo'));
  const iPrecio = cab.findIndex(c => c.includes('precio'));
  const iMin = cab.findIndex(c => c.includes('minimo') || c.includes('mínimo'));
  if (iSku < 0 || iStock < 0) {
    return aviso('El archivo debe tener al menos las columnas SKU y stock');
  }
  let ok = 0, fallos = [];
  const usuario = Sesion.actual().nombre;
  lineas.forEach((l, n) => {
    const c = l.split(/[;,\t]/).map(s => s.trim());
    const sku = c[iSku];
    if (!sku) return;
    if (!porSku[sku]) { fallos.push(`Fila ${n + 2}: el código ${sku} no está en el catálogo`); return; }
    const campos = { stock: Number(c[iStock]) || 0 };
    if (iCosto >= 0 && c[iCosto]) campos.costo = Number(c[iCosto]) || 0;
    if (iPrecio >= 0 && c[iPrecio]) campos.precio = Number(c[iPrecio]) || 0;
    if (iMin >= 0 && c[iMin]) campos.minimo = Number(c[iMin]) || 3;
    Datos.guardarFicha(sku, campos, usuario);
    ok++;
  });
  pintar();
  aviso(`${ok} referencias cargadas${fallos.length ? ` · ${fallos.length} con error` : ''}`);
  if (fallos.length) console.warn('Filas con error:\n' + fallos.join('\n'));
}

/* ------------------------------------------------------------ DEMO */
function cargarDemo() {
  const usuario = Sesion.actual().nombre;
  const muestra = CAT.filter(p => p.imagen).slice(0, 24);
  muestra.forEach((p, n) => Datos.guardarFicha(p.sku, {
    stock: [18, 9, 4, 2, 30, 12][n % 6],
    minimo: 5,
    costo: Math.round(p.precio * 0.62),
    precio: p.precio
  }, usuario));

  const clientes = [
    { nombre:'Celulares La 15', telefono:'3115557788', ciudad:'Ibagué', tipo:'mayorista', autoriza_datos:true },
    { nombre:'Andrea Betancourt', telefono:'3204441122', ciudad:'Ibagué', tipo:'minorista', autoriza_datos:true },
    { nombre:'TecnoFix Espinal', telefono:'3186669900', ciudad:'Espinal', tipo:'mayorista', autoriza_datos:true }
  ];
  const estados = ['nuevo', 'pago_verificado', 'alistando', 'listo_recoger', 'entregado'];
  clientes.forEach((c, n) => {
    const items = muestra.slice(n * 2, n * 2 + 3).map(p => ({
      sku: p.sku, nombre: p.nombre, precio: p.precio, qty: 1 + (n % 3)
    }));
    const sub = items.reduce((a, i) => a + i.precio * i.qty, 0);
    const p = Datos.crearPedido({
      cliente: c, items, entrega: n === 1 ? 'envio' : 'recoger',
      metodoPago: 'Bre-B', subtotal: sub, envio: n === 1 ? 12000 : 0,
      total: sub + (n === 1 ? 12000 : 0), pagado: n !== 2,
      consentimiento: { autoriza: true, fecha: new Date().toISOString() },
      origen: 'demo'
    }, usuario);
    Datos.cambiarEstado(p.codigo, estados[n + 1], 'Datos de demostración', usuario);
  });
  Datos.movimientoCaja({ tipo:'egreso', categoria:'Compra de mercancía',
    descripcion:'Compra a proveedor', monto:1850000, metodo:'Bancolombia' }, usuario);
  Datos.movimientoCaja({ tipo:'egreso', categoria:'Arriendo',
    descripcion:'Arriendo del local', monto:1200000, metodo:'Bancolombia' }, usuario);
  pintar();
  aviso('Datos de demostración cargados');
}

/* ------------------------------------------------------------ EVENTOS */
function arrancarApp() {
  const s = Sesion.actual();
  $('#acceso').style.display = 'none';
  $('#app').classList.add('activa');
  $('#s-nombre').textContent = s.nombre;
  $('#s-rol').textContent = s.rol;
  const permitidas = pintarMenu();
  ir(permitidas[0].id);
}

document.addEventListener('DOMContentLoaded', async () => {
  await cargarCatalogo();
  if (Sesion.actual()) arrancarApp();

  $('#entrar').addEventListener('click', () => {
    const u = Sesion.entrar($('#u').value, $('#c').value);
    if (!u) {
      const e = $('#acceso-error');
      e.textContent = 'Usuario o contraseña incorrectos.';
      e.classList.add('visible');
      return;
    }
    arrancarApp();
  });
  ['u', 'c'].forEach(id => $('#' + id).addEventListener('keydown',
    e => { if (e.key === 'Enter') $('#entrar').click(); }));

  $('#salir').addEventListener('click', () => { Sesion.salir(); location.reload(); });
  $('#panel-cerrar').addEventListener('click', cerrarPanel);
  $('#velo').addEventListener('click', cerrarPanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarPanel(); });

  ['q-pedidos','f-estado','f-entrega','q-clientes','q-inv','f-inv','f-cat-inv']
    .forEach(id => {
      const el = $('#' + id);
      if (el) el.addEventListener('input', pintar);
      if (el && el.tagName === 'SELECT') el.addEventListener('change', pintar);
    });

  document.addEventListener('click', e => {
    const t = e.target;
    const usuario = Sesion.actual() ? Sesion.actual().nombre : 'sistema';

    const area = t.closest('[data-area]');   if (area) return ir(area.dataset.area);
    const irA  = t.closest('[data-ir]');     if (irA)  return ir(irA.dataset.ir);

    const ped = t.closest('[data-pedido]');
    if (ped) { e.preventDefault(); return panelPedido(ped.dataset.pedido); }
    const cli = t.closest('[data-cliente]'); if (cli) return panelCliente(cli.dataset.cliente);
    const fic = t.closest('[data-ficha]');   if (fic) return panelFicha(fic.dataset.ficha);
    const abo = t.closest('[data-abono]');   if (abo) return panelAbono(abo.dataset.abono);
    const gar = t.closest('[data-garantia]');if (gar) return panelGarantia(gar.dataset.garantia);

    if (t.closest('#nuevo-cliente')) return panelCliente(null);
    if (t.closest('#nuevo-pedido'))  return panelNuevoPedido();
    if (t.closest('#nuevo-mov'))     return panelMovimiento();
    if (t.closest('#kardex-todo')) {
      const k = Datos.kardex().slice(0, 100);
      return abrirPanel('Kardex general', k.length + ' movimientos',
        k.length ? `<div class="tabla-cont"><table><thead><tr><th>Fecha</th><th>Código</th>
          <th>Tipo</th><th class="num">Cant.</th><th class="num">Saldo</th><th>Motivo</th></tr></thead><tbody>
          ${k.map(m => `<tr><td>${fechaHora(m.fecha)}</td><td class="sku">${m.sku}</td><td>${m.tipo}</td>
          <td class="num">${m.cantidad}</td><td class="num">${m.saldo}</td><td>${esc(m.motivo)}</td></tr>`).join('')}
          </tbody></table></div>` : '<p style="color:var(--gris)">Sin movimientos.</p>', '');
    }

    /* --- guardados --- */
    const gp = t.closest('[data-guardar-pedido]');
    if (gp) {
      const cod = gp.dataset.guardarPedido;
      const campos = {};
      if ($('#p-transp')) campos.transportadora = $('#p-transp').value.trim();
      if ($('#p-guia'))   campos.guia = $('#p-guia').value.trim();
      Datos.actualizarPedido(cod, campos, usuario);
      const nuevo = $('#p-estado').value;
      Datos.cambiarEstado(cod, nuevo, $('#p-nota').value.trim(), usuario);
      cerrarPanel(); pintar();
      return aviso('Pedido actualizado');
    }
    const pagar = t.closest('[data-pagar]');
    if (pagar) {
      Datos.marcarPagado(pagar.dataset.pagar, null, usuario);
      cerrarPanel(); pintar(); return aviso('Pago registrado');
    }
    const anular = t.closest('[data-anular]');
    if (anular) {
      if (!confirm('¿Anular este pedido? Se libera el inventario reservado.')) return;
      Datos.cambiarEstado(anular.dataset.anular, 'anulado', 'Anulado desde el portal', usuario);
      cerrarPanel(); pintar(); return aviso('Pedido anulado');
    }
    const gc = t.closest('[data-guardar-cliente]');
    if (gc) {
      const datos = {
        id: gc.dataset.guardarCliente || undefined,
        nombre: $('#cl-nombre').value.trim(),
        telefono: $('#cl-tel').value.trim(),
        documento: $('#cl-doc').value.trim(),
        correo: $('#cl-correo').value.trim(),
        ciudad: $('#cl-ciudad').value.trim(),
        tipo: $('#cl-tipo').value,
        direccion: $('#cl-dir').value.trim(),
        notas: $('#cl-notas').value.trim()
      };
      if (!datos.nombre || !datos.telefono) return aviso('El nombre y el WhatsApp son obligatorios');
      Datos.guardarCliente(datos, usuario);
      cerrarPanel(); pintar(); return aviso('Cliente guardado');
    }
    const gf = t.closest('[data-guardar-ficha]');
    if (gf) {
      const sku = gf.dataset.guardarFicha;
      const campos = {
        stock: Number($('#f-stock').value) || 0,
        minimo: Number($('#f-min').value) || 0,
        precio: Number($('#f-precio').value) || 0
      };
      if ($('#f-costo')) campos.costo = Number($('#f-costo').value) || 0;
      Datos.guardarFicha(sku, campos, usuario);
      cerrarPanel(); pintar(); return aviso('Inventario actualizado');
    }
    const mov = t.closest('[data-mov]');
    if (mov) {
      const cant = Number($('#f-cant').value) || 1;
      if (!Datos.ficha(mov.dataset.sku)) return aviso('Primero guarda la ficha del producto');
      Datos.movimiento(mov.dataset.sku, mov.dataset.mov, cant, 'Movimiento manual', usuario);
      panelFicha(mov.dataset.sku); pintar();
      return aviso(mov.dataset.mov === 'entrada' ? 'Entrada registrada' : 'Salida registrada');
    }
    const ga = t.closest('[data-guardar-abono]');
    if (ga) {
      const monto = Number($('#ab-monto').value) || 0;
      if (monto <= 0) return aviso('Escribe un valor válido');
      Datos.abonar(ga.dataset.guardarAbono, monto, $('#ab-metodo').value, usuario);
      cerrarPanel(); pintar(); return aviso('Abono registrado');
    }
    if (t.closest('#guardar-mov')) {
      const monto = Number($('#mv-monto').value) || 0;
      if (monto <= 0) return aviso('Escribe un valor válido');
      Datos.movimientoCaja({
        tipo: $('#mv-tipo').value, categoria: $('#mv-cat').value,
        descripcion: $('#mv-desc').value.trim(), monto, metodo: $('#mv-metodo').value
      }, usuario);
      cerrarPanel(); pintar(); return aviso('Movimiento registrado');
    }
    const gg = t.closest('[data-guardar-garantia]');
    if (gg) {
      Datos.estadoGarantia(gg.dataset.guardarGarantia, $('#g-estado').value, $('#g-nota').value.trim(), usuario);
      cerrarPanel(); pintar(); return aviso('Garantía actualizada');
    }

    /* --- pedido de mostrador --- */
    const npq = t.closest('[data-np-quitar]');
    if (npq) { NP.items.splice(Number(npq.dataset.npQuitar), 1); return pintarNP(); }
    const nps = t.closest('[data-np-sku]');
    if (nps) {
      const p = porSku[nps.dataset.npSku];
      const ex = NP.items.find(i => i.sku === p.sku);
      if (ex) ex.qty++;
      else NP.items.push({ sku: p.sku, nombre: p.nombre, precio: p.precio, qty: 1 });
      $('#np-buscar').value = ''; $('#np-sug').innerHTML = '';
      return pintarNP();
    }
    if (t.closest('#guardar-np')) {
      const nombre = $('#np-nombre').value.trim(), tel = $('#np-tel').value.trim();
      if (!nombre || !tel) return aviso('Escribe el nombre y el WhatsApp del cliente');
      if (!NP.items.length) return aviso('Agrega al menos un producto');
      const sub = NP.items.reduce((a, i) => a + i.precio * i.qty, 0);
      const pagado = $('#np-pagado').value === '1';
      const p = Datos.crearPedido({
        cliente: { nombre, telefono: tel, ciudad: 'Ibagué' },
        items: NP.items, entrega: 'recoger', metodoPago: $('#np-pago').value,
        subtotal: sub, total: sub, pagado,
        estado: pagado ? 'pago_verificado' : 'nuevo', origen: 'mostrador'
      }, usuario);
      Datos.cambiarEstado(p.codigo, 'entregado', 'Venta de mostrador', usuario);
      cerrarPanel(); pintar();
      return aviso('Venta ' + p.codigo + ' registrada');
    }

    /* --- ajustes --- */
    if (t.closest('#exportar')) {
      const b = new Blob([Datos.exportar()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `electrofuturo-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      return aviso('Respaldo descargado');
    }
    if (t.closest('#restaurar'))  return $('#archivo-json').click();
    if (t.closest('#importar-inv')) return $('#archivo-csv').click();
    if (t.closest('#demo'))       return cargarDemo();
    if (t.closest('#vaciar')) {
      if (!confirm('Se borran pedidos, clientes, inventario, cartera y caja. ¿Seguro?')) return;
      Datos.vaciar(); pintar(); return aviso('Datos borrados');
    }
  });

  document.addEventListener('change', e => {
    const q = e.target.closest('[data-np-qty]');
    if (q) { NP.items[Number(q.dataset.npQty)].qty = Math.max(1, Number(q.value) || 1); return pintarNP(); }
  });

  document.addEventListener('input', e => {
    if (e.target.id !== 'np-buscar') return;
    const q = e.target.value.trim().toLowerCase();
    if (q.length < 2) return ($('#np-sug').innerHTML = '');
    const l = CAT.filter(p => (p.sku + ' ' + p.nombre).toLowerCase().includes(q)).slice(0, 6);
    $('#np-sug').innerHTML = l.map(p =>
      `<button class="btn btn-l btn-x" style="display:block;width:100%;text-align:left;margin-top:6px"
        data-np-sku="${p.sku}">${esc(p.nombre)} · ${money(p.precio)}</button>`).join('');
  });

  $('#archivo-json').addEventListener('change', ev => {
    const f = ev.target.files[0]; if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      try { Datos.importar(lector.result); pintar(); aviso('Respaldo restaurado'); }
      catch (err) { aviso('El archivo no es un respaldo válido'); }
    };
    lector.readAsText(f);
    ev.target.value = '';
  });

  $('#archivo-csv').addEventListener('change', ev => {
    const f = ev.target.files[0]; if (!f) return;
    const lector = new FileReader();
    lector.onload = () => importarCSV(lector.result);
    lector.readAsText(f, 'UTF-8');
    ev.target.value = '';
  });

  window.addEventListener('ef:datos', () => { if (Sesion.actual()) pintar(); });
});
})();
