/* ============================================================
   ELECTRO FUTURO — admin-mod.js
   Módulos del portal: clientes, inventario, bodega, compras,
   cartera, finanzas, garantías y ajustes. Más los paneles de
   detalle, que son donde el operativo edita.
   ============================================================ */
(function (global) {
'use strict';

const { $, $$, money, miles, esc, fecha, fechaHora, diasDe, digitos, IC, tabla, td,
        vacio, pillEtapa, chipLinea, toast, abrirPanel, cerrarPanel, waHref,
        barras, dona, descargar, aCSV } = UI;

const VISTAS = global.VISTAS = global.VISTAS || {};
const PANELES = global.PANELES = {};
const EXPORTAR = global.EXPORTAR = {};
const EFA = () => global.EFA;
const yo = () => EFA().usuario();
const repintar = () => global.EFA_pintar();

/* Filtros propios de cada módulo */
const F = {
  clientes:{ q:'', tipo:'' },
  inv:{ q:'', linea:'', modo:'', clase:'' },
  bodega:'alistamiento',
  finanzas:'caja'
};

/* ============================================================
   CLIENTES
   ============================================================ */
VISTAS.clientes = function () {
  const abc = Datos.abc();
  let l = Datos.clientes();
  if (F.clientes.tipo) l = l.filter(c => c.tipo === F.clientes.tipo);
  if (F.clientes.q) {
    const q = F.clientes.q.toLowerCase();
    l = l.filter(c => (c.nombre + ' ' + c.telefono + ' ' + (c.documento || '')).toLowerCase().includes(q));
  }
  const filas = l.map(c => {
    const ped = Datos.pedidosDeCliente(c.id).filter(p => p.estado !== 'anulado');
    const total = ped.reduce((a, p) => a + p.total, 0);
    const ult = ped.map(p => p.creado).sort().pop();
    return { c, n: ped.length, total, ult };
  }).sort((a, b) => b.total - a.total);

  return `
  <div class="herramientas aparece">
    <div class="crece"><input type="search" id="q-clientes" value="${esc(F.clientes.q)}"
      placeholder="Buscar por nombre, teléfono o documento"></div>
    <select id="f-tipo-cli" style="max-width:180px">
      <option value="">Todos los tipos</option>
      ${['minorista','mayorista','estudiante'].map(t =>
        `<option value="${t}" ${F.clientes.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
    </select>
    ${Sesion.edita('clientes') ? `<button class="btn btn-p btn-x" data-cliente-nuevo="1">${IC.mas} Nuevo cliente</button>` : ''}
    <button class="btn btn-l btn-x" data-exportar="clientes">${IC.descarga} Exportar</button>
  </div>
  <div class="tarjeta aparece"><div class="tarjeta-cuerpo pegado">${filas.length ? tabla(
    ['Cliente','Tipo','Ciudad',{t:'Pedidos',num:1},{t:'Comprado',num:1},'Última compra','Datos',''],
    filas.map(({ c, n, total, ult }) => [
      td('Cliente', `<b>${esc(c.nombre)}</b><span class="sub">${esc(c.telefono || '')}</span>`),
      td('Tipo', `<span class="pill ${c.tipo === 'mayorista' ? 'cian' : c.tipo === 'estudiante' ? 'azul' : 'gris'}">${c.tipo}</span>`),
      td('Ciudad', esc(c.ciudad || '—')),
      td('Pedidos', n, 'num'),
      td('Comprado', money(total), 'num'),
      td('Última compra', ult ? `${fecha(ult)}<span class="sub">hace ${diasDe(ult)} días</span>`
        : '<span style="color:var(--ink-300)">Nunca</span>'),
      td('Datos', c.autoriza_datos ? '<span class="pill verde">Autorizado</span>'
        : '<span class="pill ambar">Sin autorización</span>'),
      td('', `<button class="btn btn-l btn-x" data-cliente="${c.id}">Abrir</button>`, 'acc')
    ]))
    : vacio('Sin clientes todavía',
        'Se crean solos cuando entra un pedido de la tienda, o puedes agregarlos a mano.',
        Sesion.edita('clientes') ? '<button class="btn btn-p" data-cliente-nuevo="1">Crear el primero</button>' : '')
  }</div></div>`;
};

EXPORTAR.clientes = () => {
  descargar('clientes.csv', aCSV(
    ['ID','Nombre','Teléfono','Correo','Documento','Ciudad','Dirección','Tipo','Autoriza datos'],
    Datos.clientes().map(c => [c.id, c.nombre, c.telefono, c.correo || '', c.documento || '',
      c.ciudad || '', c.direccion || '', c.tipo, c.autoriza_datos ? 'Sí' : 'No'])),
    'text/csv;charset=utf-8');
  toast('Clientes exportados');
};

/* ============================================================
   INVENTARIO GLOBAL
   ============================================================ */
VISTAS.inventario = function () {
  const CAT = EFA().CAT;
  const inv = Datos.inventario();
  const abc = Datos.abc();
  const costos = Sesion.veCostos(), precios = Sesion.vePrecios();
  const conAlta = Object.keys(inv).length;

  let l = CAT.filter(p => {
    const f = inv[p.sku];
    if (F.inv.linea && EFA().lineaSku(p.sku) !== F.inv.linea) return false;
    if (F.inv.modo === 'alta' && !f) return false;
    if (F.inv.modo === 'sin' && f) return false;
    if (F.inv.modo === 'bajo' && (!f || (f.stock - f.reservado) > f.minimo)) return false;
    if (F.inv.modo === 'sinubic' && (!f || f.ubicacion.estante)) return false;
    if (F.inv.clase && (!f || ((abc[p.sku] || {}).clase || 'C') !== F.inv.clase)) return false;
    if (F.inv.q) {
      const q = F.inv.q.toLowerCase();
      if (!(p.sku + ' ' + p.nombre + ' ' + p.marca).toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const totalFiltrado = l.length;
  l = l.slice(0, 250);

  const cap = Datos.capitalInmovilizado();
  const bajos = Object.entries(inv).filter(([, f]) => f.activo && (f.stock - f.reservado) <= f.minimo).length;

  const cab = ['Código','Producto','Línea'];
  if (precios) cab.push({ t:'Precio', num:1 });
  if (costos) cab.push({ t:'Costo', num:1 }, { t:'Margen', num:1 });
  cab.push({ t:'Stock', num:1 }, { t:'Reserv.', num:1 }, { t:'Disp.', num:1 }, 'Clase', 'Ubicación', '');

  return `
  <div class="kpis aparece">
    <div class="kpi"><span>Con inventario</span><b class="kpi-v">${conAlta}</b>
      <small>de ${CAT.length} referencias del catálogo</small></div>
    <div class="kpi ${bajos ? 'alerta' : 'ok'}"><span>Bajo el mínimo</span><b class="kpi-v">${bajos}</b>
      <small>Necesitan reposición</small></div>
    ${costos ? `<div class="kpi"><span>Capital en inventario</span><b class="kpi-v">${money(cap.total)}</b>
      <small>A precio de costo</small></div>
    <div class="kpi ${cap.claseC > cap.total * .4 ? 'aviso' : ''}"><span>Congelado en clase C</span>
      <b class="kpi-v">${money(cap.claseC)}</b>
      <small>${cap.total ? Math.round(cap.claseC / cap.total * 100) : 0} % del total, en lo que casi no rota</small></div>` : ''}
  </div>

  <div class="aviso info aparece">Las referencias <b>sin dar de alta</b> no tienen control de stock:
    siguen mostrándose en la tienda como hasta ahora. Las que sí lo tienen pasan a <b>Agotado</b>
    cuando el disponible llega a cero.</div>

  <div class="herramientas aparece">
    <div class="crece"><input type="search" id="q-inv" value="${esc(F.inv.q)}"
      placeholder="Buscar por código, nombre o marca"></div>
    <select id="f-linea-inv" style="max-width:200px"><option value="">Todas las líneas</option>
      ${Datos.LINEAS.map(x => `<option value="${x.cod}" ${F.inv.linea === x.cod ? 'selected' : ''}>${x.cod} · ${x.nombre}</option>`).join('')}</select>
    <select id="f-modo-inv" style="max-width:190px">
      <option value="">Todo el catálogo</option>
      <option value="alta"    ${F.inv.modo === 'alta' ? 'selected' : ''}>Con inventario</option>
      <option value="sin"     ${F.inv.modo === 'sin' ? 'selected' : ''}>Sin dar de alta</option>
      <option value="bajo"    ${F.inv.modo === 'bajo' ? 'selected' : ''}>Bajo el mínimo</option>
      <option value="sinubic" ${F.inv.modo === 'sinubic' ? 'selected' : ''}>Sin ubicación</option>
    </select>
    <select id="f-clase-inv" style="max-width:140px">
      <option value="">Toda clase</option>
      ${['A','B','C'].map(c => `<option value="${c}" ${F.inv.clase === c ? 'selected' : ''}>Clase ${c}</option>`).join('')}
    </select>
    <button class="btn btn-l btn-x" data-csv-inv="1">${IC.descarga} Cargar CSV</button>
    <input type="file" id="archivo-csv" accept=".csv,text/csv" hidden>
    <button class="btn btn-l btn-x" data-exportar="inventario">Exportar</button>
  </div>

  <div class="tarjeta aparece"><div class="tarjeta-cab">
    <div><h3>Catálogo e inventario</h3>
      <p>${totalFiltrado} referencia(s)${totalFiltrado > 250 ? ' · se muestran las primeras 250' : ''}</p></div>
  </div><div class="tarjeta-cuerpo pegado">${l.length ? tabla(cab, l.map(p => {
    const f = inv[p.sku];
    const d = f ? f.stock - f.reservado : null;
    const u = f ? [f.ubicacion.bodega, f.ubicacion.estante, f.ubicacion.nivel, f.ubicacion.caja].filter(Boolean).join(' · ') : '';
    const cl = (abc[p.sku] || {}).clase || 'C';
    const fila = [ td('Código', p.sku, 'sku'),
      td('Producto', esc(p.nombre) + `<span class="sub">${esc(p.marca)} · ${esc(p.subcategoria)}</span>`),
      td('Línea', chipLinea(EFA().lineaSku(p.sku))) ];
    if (precios) fila.push(td('Precio', money(f ? f.precio : p.precio), 'num'));
    if (costos) {
      const m = f && f.costo && f.precio ? Math.round((1 - f.costo / f.precio) * 100) : null;
      fila.push(td('Costo', f ? money(f.costo) : '—', 'num'),
        td('Margen', m == null ? '—' : `<span class="pill ${m < 15 ? 'rojo' : m < 30 ? 'ambar' : 'verde'}">${m} %</span>`, 'num'));
    }
    fila.push(
      td('Stock', f ? f.stock : '<span style="color:var(--ink-300)">—</span>', 'num'),
      td('Reserv.', f ? (f.reservado || 0) : '—', 'num'),
      td('Disp.', f ? `<b style="color:${d <= f.minimo ? 'var(--danger)' : 'inherit'}">${d}</b>` : '—', 'num'),
      td('Clase', f ? `<span class="pill ${cl === 'A' ? 'verde' : cl === 'B' ? 'ambar' : 'gris'}">${cl}</span>` : '—'),
      td('Ubicación', u || '<span style="color:var(--ink-300)">—</span>'),
      td('', `<button class="btn ${f ? 'btn-l' : 'btn-p'} btn-x" data-ficha="${p.sku}">${f ? 'Editar' : 'Dar de alta'}</button>`, 'acc'));
    return fila;
  })) : vacio('Sin resultados', 'Cambia la búsqueda o los filtros.')}</div></div>`;
};

EXPORTAR.inventario = () => {
  const costos = Sesion.veCostos();
  descargar('inventario.csv', aCSV(
    ['SKU','Producto','Línea','Precio'].concat(costos ? ['Costo'] : [])
      .concat(['Stock','Reservado','Mínimo','Bodega','Estante','Nivel','Caja','Proveedor']),
    EFA().CAT.filter(p => Datos.ficha(p.sku)).map(p => {
      const f = Datos.ficha(p.sku);
      const b = [p.sku, p.nombre, EFA().lineaSku(p.sku), f.precio];
      if (costos) b.push(f.costo);
      return b.concat([f.stock, f.reservado || 0, f.minimo, f.ubicacion.bodega,
        f.ubicacion.estante, f.ubicacion.nivel, f.ubicacion.caja, f.proveedor]);
    })), 'text/csv;charset=utf-8');
  toast('Inventario exportado');
};

/* ============================================================
   BODEGA — alistamiento, traslados, conteo y ubicaciones
   ============================================================ */
VISTAS.bodega = function () {
  const tabs = [
    ['alistamiento','Alistamiento'], ['traslados','Traslados'],
    ['conteo','Conteo cíclico'], ['ubicaciones','Ubicaciones'], ['seriales','Seriales']
  ];
  const cuerpo = {
    alistamiento: bodAlistamiento, traslados: bodTraslados,
    conteo: bodConteo, ubicaciones: bodUbicaciones, seriales: bodSeriales
  }[F.bodega]();
  return `<div class="pestanas aparece">${tabs.map(([id, t]) =>
    `<button data-bod="${id}" class="${F.bodega === id ? 'activo' : ''}">${t}</button>`).join('')}</div>${cuerpo}`;
};

function bodAlistamiento() {
  const porAlistar = Datos.pedidos().filter(p => ['confirmado','separado'].includes(p.estado));
  const abiertos = Datos.alistamientos().filter(a => a.estado !== 'cerrado');
  return `
  <div class="aviso info aparece">La lista de alistamiento sale <b>ordenada por ubicación</b>,
    no por orden de captura: quien alista recorre la bodega una sola vez.</div>
  <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Pedidos por alistar</h3>
    <p>Confirmados y separados que todavía no tienen lista</p></div></div>
    <div class="tarjeta-cuerpo pegado">${porAlistar.length ? tabla(
      ['Pedido','Cliente','Línea',{t:'Ítems',num:1},{t:'Unidades',num:1},'Días',''],
      porAlistar.map(p => [
        td('Pedido', `<b>${p.codigo}</b>`, 'sku'), td('Cliente', esc(p.cliente.nombre)),
        td('Línea', chipLinea(p.linea)), td('Ítems', p.items.length, 'num'),
        td('Unidades', p.items.reduce((a, i) => a + i.qty, 0), 'num'),
        td('Días', UI.semaforo(diasDe(p.movido)) + ' ' + diasDe(p.movido) + 'd'),
        td('', `<button class="btn btn-p btn-x" data-alistar="${p.codigo}">Generar lista</button>`, 'acc')
      ])) : vacio('Nada por alistar', 'Cuando se confirme un pedido aparecerá aquí para generar su lista.')}
  </div></div>
  <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Listas en curso</h3>
    <p>${abiertos.length} abierta(s)</p></div></div>
    <div class="tarjeta-cuerpo pegado">${abiertos.length ? tabla(
      ['Pedido','Cliente','Estado',{t:'Recogido',num:1},'Creada',''],
      abiertos.map(a => {
        const rec = a.lineas.reduce((s, l) => s + l.recogida, 0);
        const ped = a.lineas.reduce((s, l) => s + l.pedida, 0);
        return [ td('Pedido', `<b>${a.pedido}</b>`, 'sku'), td('Cliente', esc(a.cliente)),
          td('Estado', `<span class="pill ${a.estado === 'completo' ? 'verde' : a.estado === 'parcial' ? 'ambar' : 'gris'}">${a.estado}</span>`),
          td('Recogido', `${rec} / ${ped}`, 'num'), td('Creada', fechaHora(a.creado)),
          td('', `<button class="btn btn-p btn-x" data-lista="${a.pedido}">Abrir lista</button>`, 'acc') ];
      })) : vacio('Sin listas abiertas', 'Genera una desde la tabla de arriba.')}
  </div></div>`;
}

function bodTraslados() {
  const l = Datos.traslados();
  return `
  <div class="herramientas aparece">
    <button class="btn btn-p btn-x" data-traslado-nuevo="1">${IC.mas} Nuevo traslado</button>
    <span style="font-size:.79rem;color:var(--ink-500)">Sin registrar los traslados el stock nunca cuadra.</span>
  </div>
  <div class="tarjeta aparece"><div class="tarjeta-cuerpo pegado">${l.length ? tabla(
    ['Traslado','Origen','Destino',{t:'Referencias',num:1},{t:'Unidades',num:1},'Estado','Creado',''],
    l.map(t => [
      td('Traslado', `<b>${t.id}</b>`, 'sku'), td('Origen', esc(t.origen)), td('Destino', esc(t.destino)),
      td('Referencias', t.lineas.length, 'num'),
      td('Unidades', t.lineas.reduce((a, x) => a + x.cantidad, 0), 'num'),
      td('Estado', `<span class="pill ${t.estado === 'recibido' ? 'verde' : 'ambar'}">${t.estado.replace('_', ' ')}</span>`),
      td('Creado', fechaHora(t.creado)),
      td('', t.estado === 'en_transito'
        ? `<button class="btn btn-p btn-x" data-recibir-traslado="${t.id}">Confirmar recepción</button>` : '', 'acc')
    ])) : vacio('Sin traslados', 'Registra el movimiento entre bodega y local para que el stock cuadre.')}
  </div></div>`;
}

function bodConteo() {
  const abiertos = Datos.conteos().filter(c => c.estado === 'abierto');
  const cerrados = Datos.conteos().filter(c => c.estado === 'cerrado').slice(0, 10);
  const sug = Datos.sugerirConteo(12);
  return `
  <div class="aviso info aparece">En vez de un inventario general al año, cuenta un grupo cada semana.
    El sistema propone qué contar: primero las <b>clase A</b>, luego lo que lleva más tiempo sin contarse.</div>
  <div class="herramientas aparece">
    <button class="btn btn-p btn-x" data-conteo-nuevo="1">${IC.mas} Crear conteo sugerido</button>
    <span style="font-size:.79rem;color:var(--ink-500)">${sug.length} referencia(s) propuestas</span>
  </div>
  ${abiertos.length ? abiertos.map(c => `
    <div class="tarjeta aparece"><div class="tarjeta-cab">
      <div><h3>${c.id}</h3><p>Abierto el ${fechaHora(c.creado)} · ${c.lineas.length} referencias</p></div>
      <button class="btn btn-p btn-x" data-cerrar-conteo="${c.id}">Cerrar y ajustar</button></div>
      <div class="tarjeta-cuerpo pegado">${tabla(
        ['Código','Producto',{t:'Sistema',num:1},{t:'Contado',num:1},{t:'Diferencia',num:1},'Motivo'],
        c.lineas.map(l => [
          td('Código', l.sku, 'sku'), td('Producto', esc(EFA().nombreSku(l.sku))),
          td('Sistema', l.sistema, 'num'),
          td('Contado', `<input type="number" class="mini" min="0" value="${l.contado == null ? '' : l.contado}"
            data-conteo="${c.id}" data-sku="${l.sku}">`, 'num'),
          td('Diferencia', l.contado == null ? '—'
            : `<b style="color:${l.diferencia === 0 ? 'var(--success)' : 'var(--danger)'}">${l.diferencia > 0 ? '+' : ''}${l.diferencia}</b>`, 'num'),
          td('Motivo', `<input type="text" placeholder="${l.diferencia && !l.motivo ? 'Obligatorio' : 'Opcional'}"
            value="${esc(l.motivo)}" data-motivo="${c.id}" data-sku="${l.sku}">`)
        ]))}</div></div>`).join('')
    : vacio('Sin conteos abiertos', 'Crea uno con las referencias que el sistema propone.')}
  ${cerrados.length ? `<div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Conteos cerrados</h3>
    <p>Los últimos ${cerrados.length}</p></div></div><div class="tarjeta-cuerpo pegado">${tabla(
      ['Conteo','Cerrado',{t:'Referencias',num:1},{t:'Con diferencia',num:1},'Usuario'],
      cerrados.map(c => [ td('Conteo', c.id, 'sku'), td('Cerrado', fechaHora(c.cerrado)),
        td('Referencias', c.lineas.length, 'num'),
        td('Con diferencia', c.lineas.filter(l => l.diferencia !== 0).length, 'num'),
        td('Usuario', esc(c.usuario)) ]))}</div></div>` : ''}`;
}

function bodUbicaciones() {
  const inv = Datos.inventario();
  const con = Object.entries(inv).filter(([, f]) => f.ubicacion && f.ubicacion.estante);
  const sin = Object.keys(inv).length - con.length;
  const porBodega = {};
  Object.entries(inv).forEach(([sku, f]) => {
    const b = f.ubicacion.bodega || 'Sin bodega';
    (porBodega[b] || (porBodega[b] = [])).push({ sku, f });
  });
  return `
  <div class="herramientas aparece">
    <div class="crece"><input type="search" id="q-ubic"
      placeholder="¿Dónde está el SKU? Escribe el código o el nombre"></div>
    <span class="pill ${sin ? 'ambar' : 'verde'}">${sin} sin ubicación</span>
  </div>
  <div id="res-ubic"></div>
  ${Object.keys(porBodega).sort().map(b => `
    <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>${esc(b)}</h3>
      <p>${porBodega[b].length} referencia(s)</p></div></div>
      <div class="tarjeta-cuerpo pegado">${tabla(
        ['Código','Producto','Estante','Nivel','Caja',{t:'Stock',num:1},''],
        porBodega[b].sort((x, y) => (x.f.ubicacion.estante || 'zz').localeCompare(y.f.ubicacion.estante || 'zz'))
          .slice(0, 80).map(({ sku, f }) => [
            td('Código', sku, 'sku'), td('Producto', esc(EFA().nombreSku(sku))),
            td('Estante', f.ubicacion.estante || '<span style="color:var(--ink-300)">—</span>'),
            td('Nivel', f.ubicacion.nivel || '—'), td('Caja', f.ubicacion.caja || '—'),
            td('Stock', f.stock, 'num'),
            td('', `<button class="btn btn-l btn-x" data-ficha="${sku}">Editar</button>`, 'acc')
          ]))}</div></div>`).join('')
    || vacio('Sin ubicaciones', 'Asigna bodega, estante, nivel y caja en la ficha de cada referencia.')}`;
}

function bodSeriales() {
  const l = Datos.seriales();
  const conSerial = Object.entries(Datos.inventario()).filter(([, f]) => f.serialado);
  return `
  <div class="aviso info aparece">Para relojes y power banks de gama alta conviene registrar el serial
    en la entrada y en la salida: así una garantía se rastrea hasta el pedido y el proveedor exactos.
    Marca «Lleva serial» en la ficha de la referencia.</div>
  <div class="herramientas aparece">
    <button class="btn btn-p btn-x" data-serial-nuevo="1">${IC.mas} Registrar serial</button>
    <span style="font-size:.79rem;color:var(--ink-500)">${conSerial.length} referencia(s) marcadas con serial</span>
  </div>
  <div class="tarjeta aparece"><div class="tarjeta-cuerpo pegado">${l.length ? tabla(
    ['Serial','Código','Producto','Estado','Pedido','Origen','Fecha'],
    l.slice(0, 150).map(s => [
      td('Serial', `<b>${esc(s.serial)}</b>`, 'sku'), td('Código', s.sku, 'sku'),
      td('Producto', esc(EFA().nombreSku(s.sku))),
      td('Estado', `<span class="pill ${s.estado === 'vendido' ? 'gris' : 'verde'}">${s.estado.replace('_', ' ')}</span>`),
      td('Pedido', s.pedido || '—'), td('Origen', esc(s.origen || '—')), td('Fecha', fecha(s.fecha))
    ])) : vacio('Sin seriales registrados', 'Registra el serial al recibir la mercancía.')}
  </div></div>`;
}

/* ============================================================
   COMPRAS — reposición sugerida y proveedores
   ============================================================ */
VISTAS.compras = function () {
  const rep = Datos.reposicion();
  const provs = Object.keys(rep);
  const ordenes = Datos.compras();
  return `
  <div class="aviso info aparece">El punto de reorden se calcula con la <b>venta diaria promedio</b>
    de los últimos 90 días y el <b>tiempo de entrega</b> del proveedor. La sugerencia sale agrupada
    por proveedor, lista para enviar por WhatsApp.</div>

  ${provs.length ? provs.map(p => {
    const l = rep[p];
    const prov = Datos.proveedores().find(x => x.nombre === p);
    const total = l.reduce((a, x) => a + x.valor, 0);
    const texto = `Hola 👋 necesito cotizar esta reposición:\n\n` +
      l.map(x => `• ${EFA().nombreSku(x.sku)} (${x.sku}) — *${x.sugerido}* unidades`).join('\n') +
      `\n\n¿Disponibilidad y precio?`;
    return `<div class="tarjeta aparece"><div class="tarjeta-cab">
      <div><h3>${esc(p)}</h3><p>${l.length} referencia(s)${Sesion.veCostos() ? ' · ' + money(total) + ' estimados' : ''}
        ${prov ? ` · entrega en ${prov.dias} días` : ' · sin tiempo de entrega definido'}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn-wa btn-x" target="_blank" rel="noopener"
           href="${waHref(prov ? prov.telefono : '', texto)}">${IC.wa} Pedir por WhatsApp</a>
        <button class="btn btn-p btn-x" data-crear-compra="${esc(p)}">Crear orden</button>
      </div></div>
      <div class="tarjeta-cuerpo pegado">${tabla(
        ['Código','Producto','Clase',{t:'Disponible',num:1},{t:'Punto de reorden',num:1},{t:'Sugerido',num:1}]
          .concat(Sesion.veCostos() ? [{ t:'Costo estimado', num:1 }] : []),
        l.sort((a, b) => ('ABC'.indexOf(a.clase) - 'ABC'.indexOf(b.clase))).map(x => {
          const f = [ td('Código', x.sku, 'sku'), td('Producto', esc(EFA().nombreSku(x.sku))),
            td('Clase', `<span class="pill ${x.clase === 'A' ? 'verde' : x.clase === 'B' ? 'ambar' : 'gris'}">${x.clase}</span>`),
            td('Disponible', `<b style="color:${x.disponible <= 0 ? 'var(--danger)' : 'inherit'}">${x.disponible}</b>`, 'num'),
            td('Punto de reorden', x.punto, 'num'), td('Sugerido', `<b>${x.sugerido}</b>`, 'num') ];
          if (Sesion.veCostos()) f.push(td('Costo estimado', money(x.valor), 'num'));
          return f;
        }))}</div></div>`;
  }).join('') : vacio('Nada por reponer',
      'Ninguna referencia está en su punto de reorden. Cuando alguna baje, aparecerá aquí agrupada por proveedor.')}

  <div class="tarjeta aparece"><div class="tarjeta-cab">
    <div><h3>Órdenes de compra</h3><p>${ordenes.length} registrada(s)</p></div>
    <button class="btn btn-l btn-x" data-proveedor-nuevo="1">${IC.mas} Proveedor</button></div>
    <div class="tarjeta-cuerpo pegado">${ordenes.length ? tabla(
      ['Orden','Proveedor',{t:'Referencias',num:1}].concat(Sesion.veCostos() ? [{ t:'Total', num:1 }] : [])
        .concat(['Estado','Creada','']),
      ordenes.map(c => {
        const f = [ td('Orden', `<b>${c.id}</b>`, 'sku'), td('Proveedor', esc(c.proveedor)),
          td('Referencias', c.lineas.length, 'num') ];
        if (Sesion.veCostos()) f.push(td('Total', money(c.total), 'num'));
        f.push(td('Estado', `<span class="pill ${c.estado === 'recibida' ? 'verde' : 'ambar'}">${c.estado}</span>`),
          td('Creada', fecha(c.creado)),
          td('', c.estado === 'enviada'
            ? `<button class="btn btn-p btn-x" data-recibir-compra="${c.id}">Recibir</button>` : '', 'acc'));
        return f;
      })) : vacio('Sin órdenes', 'Crea una desde la reposición sugerida de arriba.')}
  </div></div>

  <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Proveedores</h3>
    <p>El tiempo de entrega alimenta el punto de reorden</p></div></div>
    <div class="tarjeta-cuerpo pegado">${Datos.proveedores().length ? tabla(
      ['Proveedor','WhatsApp',{t:'Días de entrega',num:1},{t:'Referencias',num:1},''],
      Datos.proveedores().map(p => [
        td('Proveedor', `<b>${esc(p.nombre)}</b>`), td('WhatsApp', esc(p.telefono || '—')),
        td('Días de entrega', p.dias, 'num'),
        td('Referencias', Object.values(Datos.inventario()).filter(f => f.proveedor === p.nombre).length, 'num'),
        td('', `<button class="btn btn-l btn-x" data-proveedor="${esc(p.nombre)}">Editar</button>`, 'acc')
      ])) : vacio('Sin proveedores', 'Agrégalos para agrupar la reposición y calcular el punto de reorden.',
        '<button class="btn btn-p" data-proveedor-nuevo="1">Agregar proveedor</button>')}
  </div></div>`;
};

/* ============================================================
   CARTERA
   ============================================================ */
VISTAS.cartera = function () {
  const l = Datos.cartera().filter(c => c.estado !== 'anulada');
  const abiertas = l.filter(c => c.estado !== 'pagada');
  const hoyD = new Date().toISOString().slice(0, 10);
  const saldo = abiertas.reduce((a, c) => a + (c.monto - c.abonado), 0);
  const vencidas = abiertas.filter(c => c.vence < hoyD);
  const edades = { '0-30':0, '31-60':0, '+60':0 };
  vencidas.forEach(c => {
    const d = diasDe(c.vence);
    edades[d <= 30 ? '0-30' : d <= 60 ? '31-60' : '+60'] += c.monto - c.abonado;
  });
  return `
  <div class="kpis aparece">
    <div class="kpi ${saldo ? 'aviso' : 'ok'}"><span>Saldo por cobrar</span><b class="kpi-v">${money(saldo)}</b>
      <small>${abiertas.length} cuenta(s) abiertas</small></div>
    <div class="kpi ${vencidas.length ? 'alerta' : 'ok'}"><span>Vencidas</span>
      <b class="kpi-v">${money(vencidas.reduce((a, c) => a + (c.monto - c.abonado), 0))}</b>
      <small>${vencidas.length} pasadas de fecha</small></div>
    <div class="kpi ok"><span>Recaudado</span><b class="kpi-v">${money(l.reduce((a, c) => a + c.abonado, 0))}</b>
      <small>Abonos y pagos completos</small></div>
  </div>
  ${vencidas.length ? `<div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Edades de la cartera vencida</h3>
    <p>Cuánto lleva sin cobrarse</p></div></div><div class="tarjeta-cuerpo">${barras(
      Object.entries(edades).map(([t, v], i) => ({ t, v, color:['#F59E0B','#F97316','#EF4444'][i] }))
    )}</div></div>` : ''}
  <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Cuentas por cobrar</h3>
    <p>Pedidos sin pago confirmado</p></div>
    <button class="btn btn-l btn-x" data-exportar="cartera">${IC.descarga} Exportar</button></div>
    <div class="tarjeta-cuerpo pegado">${abiertas.length ? tabla(
      ['Pedido','Cliente','Vence',{t:'Monto',num:1},{t:'Abonado',num:1},{t:'Saldo',num:1},'Estado',''],
      abiertas.sort((a, b) => String(a.vence).localeCompare(String(b.vence))).map(c => {
        const cl = Datos.cliente(c.clienteId) || {};
        const venc = c.vence < hoyD;
        const s = c.monto - c.abonado;
        return [ td('Pedido', c.pedido, 'sku'),
          td('Cliente', `<b>${esc(cl.nombre || '—')}</b><span class="sub">${esc(cl.telefono || '')}</span>`),
          td('Vence', `${fecha(c.vence)}${venc ? ' <span class="pill rojo">Vencida</span>' : ''}`),
          td('Monto', money(c.monto), 'num'), td('Abonado', money(c.abonado), 'num'),
          td('Saldo', `<b>${money(s)}</b>`, 'num'),
          td('Estado', `<span class="pill ${c.estado === 'parcial' ? 'ambar' : 'gris'}">${c.estado}</span>`),
          td('', `<a class="btn btn-wa btn-x" target="_blank" rel="noopener"
                href="${waHref(cl.telefono, `Hola ${cl.nombre || ''} 👋 te recuerdo el saldo de *${money(s)}* del pedido *${c.pedido}*. ¿Lo puedes abonar esta semana?`)}">${IC.wa}</a>
              ${Sesion.edita('cartera') ? `<button class="btn btn-p btn-x" data-abono="${c.id}">Abonar</button>` : ''}`, 'acc') ];
      })) : vacio('Nada por cobrar', 'Todos los pedidos están pagados.')}
  </div></div>`;
};

EXPORTAR.cartera = () => {
  descargar('cartera.csv', aCSV(
    ['Pedido','Cliente','Vence','Monto','Abonado','Saldo','Estado'],
    Datos.cartera().map(c => {
      const cl = Datos.cliente(c.clienteId) || {};
      return [c.pedido, cl.nombre || '', c.vence, c.monto, c.abonado, c.monto - c.abonado, c.estado];
    })), 'text/csv;charset=utf-8');
  toast('Cartera exportada');
};

/* ============================================================
   FINANZAS
   ============================================================ */
VISTAS.finanzas = function () {
  const tabs = [['caja','Caja'], ['rentabilidad','Rentabilidad'], ['abc','Clasificación ABC']];
  const cuerpo = { caja: finCaja, rentabilidad: finRent, abc: finABC }[F.finanzas]();
  return `<div class="pestanas aparece">${tabs.map(([id, t]) =>
    `<button data-fin="${id}" class="${F.finanzas === id ? 'activo' : ''}">${t}</button>`).join('')}</div>${cuerpo}`;
};

function finCaja() {
  const caja = Datos.caja();
  const mes = new Date().toISOString().slice(0, 7);
  const hoyD = new Date().toISOString().slice(0, 10);
  const delMes = caja.filter(m => m.fecha.slice(0, 7) === mes);
  const ing = delMes.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0);
  const egr = delMes.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0);
  const hoyIng = caja.filter(m => m.fecha === hoyD && m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0);
  const hoyEgr = caja.filter(m => m.fecha === hoyD && m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0);
  const ped = Datos.pedidos().filter(p => p.creado.slice(0, 7) === mes && p.estado !== 'anulado');
  const venta = ped.reduce((a, p) => a + p.total, 0);
  const costo = ped.reduce((a, p) => a + Datos.costoPedido(p), 0);
  const porCat = {};
  delMes.filter(m => m.tipo === 'egreso').forEach(m => {
    porCat[m.categoria || 'Otro'] = (porCat[m.categoria || 'Otro'] || 0) + m.monto;
  });
  return `
  <div class="kpis aparece">
    <div class="kpi ok"><span>Ingresos del mes</span><b class="kpi-v">${money(ing)}</b>
      <small>${delMes.filter(m => m.tipo === 'ingreso').length} movimientos</small></div>
    <div class="kpi ${egr ? 'aviso' : ''}"><span>Egresos del mes</span><b class="kpi-v">${money(egr)}</b>
      <small>${delMes.filter(m => m.tipo === 'egreso').length} movimientos</small></div>
    <div class="kpi"><span>Caja del mes</span><b class="kpi-v">${money(ing - egr)}</b>
      <small>Ingresos menos egresos</small></div>
    <div class="kpi ok"><span>Utilidad bruta</span><b class="kpi-v">${money(venta - costo)}</b>
      <small>${money(venta)} vendidos · ${money(costo)} de costo</small></div>
    <div class="kpi"><span>Cierre de hoy</span><b class="kpi-v">${money(hoyIng - hoyEgr)}</b>
      <small>${money(hoyIng)} entró · ${money(hoyEgr)} salió</small></div>
  </div>
  ${Object.keys(porCat).length ? `<div class="tarjeta aparece"><div class="tarjeta-cab">
    <div><h3>En qué se va la plata este mes</h3><p>Egresos por categoría</p></div></div>
    <div class="tarjeta-cuerpo">${dona(Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([t, v], i) =>
      ({ t, v, color:['#EF4444','#F59E0B','#7C3AED','#2563EB','#64748B','#10B981'][i % 6] })), { formato: money })}
    </div></div>` : ''}
  <div class="tarjeta aparece"><div class="tarjeta-cab">
    <div><h3>Movimientos de caja</h3><p>Los pagos de pedidos entran solos; los gastos se registran a mano</p></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-p btn-x" data-mov-nuevo="1">${IC.mas} Registrar movimiento</button>
      <button class="btn btn-l btn-x" data-exportar="caja">${IC.descarga} Exportar</button></div></div>
    <div class="tarjeta-cuerpo pegado">${caja.length ? tabla(
      ['Fecha','Tipo','Categoría','Descripción','Método',{t:'Monto',num:1}],
      caja.slice().reverse().slice(0, 80).map(m => [
        td('Fecha', fecha(m.fecha)),
        td('Tipo', `<span class="pill ${m.tipo === 'ingreso' ? 'verde' : 'rojo'}">${m.tipo}</span>`),
        td('Categoría', esc(m.categoria || '—')), td('Descripción', esc(m.descripcion || '—')),
        td('Método', esc(m.metodo || '—')),
        td('Monto', (m.tipo === 'egreso' ? '− ' : '') + money(m.monto), 'num')
      ])) : vacio('Sin movimientos', 'Los pagos de pedidos entran aquí solos. Los gastos se registran a mano.',
        '<button class="btn btn-p" data-mov-nuevo="1">Registrar el primero</button>')}
  </div></div>`;
}

function finRent() {
  const ped = Datos.pedidos().filter(p => p.estado !== 'anulado' && Datos.costoPedido(p) > 0);
  if (!ped.length) return vacio('Sin datos de rentabilidad',
    'Carga el costo de los productos en Inventario y la utilidad por pedido se calcula sola.');
  return `<div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Rentabilidad por pedido</h3>
    <p>Venta menos costo de la mercancía. Solo aparecen los pedidos cuyos SKU tienen costo cargado.</p></div></div>
    <div class="tarjeta-cuerpo pegado">${tabla(
      ['Pedido','Cliente','Línea',{t:'Venta',num:1},{t:'Costo',num:1},{t:'Utilidad',num:1},{t:'Margen',num:1}],
      ped.map(p => {
        const c = Datos.costoPedido(p), u = p.total - c;
        return { p, c, u, m: p.total ? Math.round(u / p.total * 100) : 0 };
      }).sort((a, b) => a.m - b.m).map(({ p, c, u, m }) => [
        td('Pedido', p.codigo, 'sku'), td('Cliente', esc(p.cliente.nombre || '—')),
        td('Línea', chipLinea(p.linea)), td('Venta', money(p.total), 'num'),
        td('Costo', money(c), 'num'), td('Utilidad', `<b>${money(u)}</b>`, 'num'),
        td('Margen', `<span class="pill ${m < 15 ? 'rojo' : m < 30 ? 'ambar' : 'verde'}">${m} %</span>`, 'num')
      ]))}</div></div>`;
}

function finABC() {
  const abc = Datos.abc();
  const inv = Datos.inventario();
  const skus = Object.keys(inv);
  if (!skus.length) return vacio('Sin inventario', 'Da de alta referencias para clasificarlas por rotación.');
  const cap = Datos.capitalInmovilizado();
  const grupos = { A:[], B:[], C:[] };
  skus.forEach(s => grupos[(abc[s] || {}).clase || 'C'].push(s));
  const valor = c => grupos[c].reduce((a, s) => a + inv[s].stock * (inv[s].costo || 0), 0);
  return `
  <div class="aviso info aparece">Clase A es el 20 % de referencias que hacen el 80 % de la venta.
    Clase C es lo que casi no rota y está <b>congelando plata</b>.</div>
  <div class="kpis aparece">
    ${['A','B','C'].map(c => `<div class="kpi ${c === 'A' ? 'ok' : c === 'C' ? 'aviso' : ''}">
      <span>Clase ${c}</span><b class="kpi-v">${grupos[c].length}</b>
      <small>${money(valor(c))} en inventario</small></div>`).join('')}
    <div class="kpi ${cap.claseC > cap.total * .4 ? 'alerta' : ''}"><span>Capital congelado</span>
      <b class="kpi-v">${money(cap.claseC)}</b>
      <small>${cap.total ? Math.round(cap.claseC / cap.total * 100) : 0} % del inventario, en clase C</small></div>
  </div>
  <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Distribución del inventario</h3>
    <p>Cuánta plata hay en cada clase</p></div></div>
    <div class="tarjeta-cuerpo">${dona([
      { t:'Clase A · rota bien', v:valor('A'), color:'#10B981' },
      { t:'Clase B · intermedia', v:valor('B'), color:'#F59E0B' },
      { t:'Clase C · casi no rota', v:valor('C'), color:'#EF4444' }
    ], { formato: money })}</div></div>
  <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Clase C con más plata quieta</h3>
    <p>Candidatas a liquidación o promoción</p></div></div>
    <div class="tarjeta-cuerpo pegado">${(() => {
      const l = grupos.C.map(s => ({ s, v: inv[s].stock * (inv[s].costo || 0) }))
        .filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 25);
      return l.length ? tabla(['Código','Producto',{t:'Stock',num:1},{t:'Costo unit.',num:1},{t:'Plata quieta',num:1},''],
        l.map(({ s, v }) => [ td('Código', s, 'sku'), td('Producto', esc(EFA().nombreSku(s))),
          td('Stock', inv[s].stock, 'num'), td('Costo unit.', money(inv[s].costo), 'num'),
          td('Plata quieta', `<b>${money(v)}</b>`, 'num'),
          td('', `<button class="btn btn-l btn-x" data-ficha="${s}">Abrir</button>`, 'acc') ]))
        : vacio('Nada congelado', 'No hay clase C con costo cargado y stock disponible.');
    })()}</div></div>`;
}

EXPORTAR.caja = () => {
  descargar('caja.csv', aCSV(['Fecha','Tipo','Categoría','Descripción','Método','Monto','Usuario'],
    Datos.caja().map(m => [m.fecha, m.tipo, m.categoria || '', m.descripcion || '', m.metodo || '', m.monto, m.usuario])),
    'text/csv;charset=utf-8');
  toast('Caja exportada');
};

/* ============================================================
   GARANTÍAS
   ============================================================ */
VISTAS.garantias = function () {
  const l = Datos.garantias();
  return `<div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Casos de garantía</h3>
    <p>Los radican los clientes desde su portal</p></div></div>
    <div class="tarjeta-cuerpo pegado">${l.length ? tabla(
      ['Caso','Fecha','Cliente','Pedido','Producto','Motivo','Estado',''],
      l.map(g => [ td('Caso', g.id, 'sku'), td('Fecha', fecha(g.creado)),
        td('Cliente', esc(g.cliente || '—')), td('Pedido', esc(g.pedido || '—'), 'sku'),
        td('Producto', esc(EFA().nombreSku(g.sku))),
        td('Motivo', esc(String(g.motivo || '').slice(0, 70))),
        td('Estado', `<span class="pill ${g.estado === 'resuelta' ? 'verde' : g.estado === 'rechazada' ? 'rojo' : 'ambar'}">${g.estado.replace('_', ' ')}</span>`),
        td('', `<button class="btn btn-l btn-x" data-garantia="${g.id}">Gestionar</button>`, 'acc') ]))
      : vacio('Sin garantías radicadas', 'Cuando un cliente radique un caso desde su portal aparecerá aquí.')}
  </div></div>`;
};

/* ============================================================
   AJUSTES
   ============================================================ */
VISTAS.ajustes = function () {
  const cfg = Datos.config();
  const a = Datos.auditoria();
  return `
  <div class="aviso alerta aparece">Los datos viven en <b>este navegador</b>. Para que bodega y
    comercial trabajen sobre la misma información hay que conectar Supabase con
    <b>supabase/schema.sql</b>. Mientras tanto, descarga el respaldo antes de cambiar de equipo.</div>

  <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Reglas del negocio</h3>
    <p>Alimentan el motor de alertas y la reposición</p></div></div>
    <div class="tarjeta-cuerpo">
      <div class="rejilla">
        <div class="campo"><label>Margen mínimo aceptable (%)</label>
          <input type="number" id="cfg-margen" min="0" max="90" value="${cfg.margenMinimo}">
          <span class="ayuda">Por debajo de esto el sistema levanta una alerta de margen.</span></div>
        <div class="campo"><label>Días sin rotación</label>
          <input type="number" id="cfg-rot" min="15" max="365" value="${cfg.diasSinRotacion}">
          <span class="ayuda">Referencias sin vender en este plazo se marcan para liquidar.</span></div>
      </div>
      <h4 style="font-size:.88rem;margin:16px 0 10px">Escalas de precio mayorista</h4>
      <p style="font-size:.79rem;color:var(--ink-500);margin:0 0 12px">Descuento automático por cantidad.
        Una referencia puede tener sus propias escalas desde su ficha.</p>
      <div class="rejilla-4">${cfg.escalas.map((e, i) => `
        <div class="campo"><label>Desde ${e.desde} unidades</label>
          <input type="number" id="esc-${i}" min="0" max="80" value="${e.desc}">
          <span class="ayuda">% de descuento</span></div>`).join('')}</div>
      <button class="btn btn-p" data-guardar-cfg="1">Guardar reglas</button>
    </div></div>

  <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Datos de la plataforma</h3>
    <p>Respaldo, restauración y arranque</p></div></div>
    <div class="tarjeta-cuerpo"><div class="herramientas" style="margin:0;border:0;padding:0">
      <button class="btn btn-l" data-exportar-db="1">${IC.descarga} Descargar respaldo</button>
      <button class="btn btn-l" data-restaurar="1">Restaurar respaldo</button>
      <input type="file" id="archivo-json" accept=".json,application/json" hidden>
      <button class="btn btn-l" data-demo="1">Cargar datos de demostración</button>
      <button class="btn btn-d" data-vaciar="1">Vaciar todos los datos</button>
    </div></div></div>

  <div class="tarjeta aparece"><div class="tarjeta-cab"><div><h3>Auditoría</h3>
    <p>Quién cambió qué y cuándo</p></div></div>
    <div class="tarjeta-cuerpo pegado">${a.length ? tabla(
      ['Fecha','Usuario','Módulo','Acción','Detalle'],
      a.slice(0, 90).map(x => [ td('Fecha', fechaHora(x.fecha)), td('Usuario', esc(x.usuario)),
        td('Módulo', esc(x.tabla)), td('Acción', esc(x.accion)), td('Detalle', esc(x.detalle || '')) ]))
      : vacio('Sin registros', 'Cada cambio queda aquí con su fecha y su usuario.')}
  </div></div>`;
};

/* ============================================================
   PANELES DE DETALLE
   ============================================================ */
PANELES.pedido = function (codigo) {
  const p = Datos.pedido(codigo);
  if (!p) return toast('No encontré ese pedido');
  const puede = Sesion.edita('pedidos');
  const costos = Sesion.veCostos();
  const items = p.items.map(i => `<tr>
    <td class="sku">${i.sku}</td><td>${esc(i.nombre)} ${chipLinea(i.linea || 'ACC')}</td>
    <td class="num">${i.qty}</td><td class="num">${money(i.precio * i.qty)}</td></tr>`).join('');
  const linea = p.eventos.map(e => `<li class="hecho"><b>${(Datos.ETAPA[e.estado] || {}).t || e.estado}</b>
    <small>${fechaHora(e.fecha)} · ${esc(e.usuario)}</small>
    ${e.nota ? `<em>${esc(e.nota)}</em>` : ''}</li>`).join('');
  const opciones = Object.values(Datos.ETAPA).sort((a, b) => a.orden - b.orden)
    .map(e => `<option value="${e.k}" ${e.k === p.estado ? 'selected' : ''}>${e.t}</option>`).join('');
  const envio = p.entrega === 'envio' ? `<div class="rejilla">
    <div class="campo"><label>Transportadora</label>
      <input type="text" id="p-transp" value="${esc(p.transportadora)}" placeholder="Interrapidísimo"></div>
    <div class="campo"><label>Número de guía</label><input type="text" id="p-guia" value="${esc(p.guia)}"></div>
  </div>` : '';
  const util = costos ? p.total - Datos.costoPedido(p) : null;

  abrirPanel('Pedido ' + p.codigo, fechaHora(p.creado) + ' · ' + (p.canal === 'mostrador' ? 'Mostrador' : 'Mayorista'), `
    <dl class="dl">
      <dt>Cliente</dt><dd>${esc(p.cliente.nombre || '—')}</dd>
      <dt>WhatsApp</dt><dd>${esc(p.cliente.telefono || '—')}</dd>
      <dt>Entrega</dt><dd>${p.entrega === 'recoger' ? 'Recoge en el local' : esc(p.cliente.direccion || 'Envío')}</dd>
      <dt>Ciudad</dt><dd>${esc(p.cliente.ciudad || '—')}</dd>
      <dt>Método de pago</dt><dd>${esc(p.metodoPago || '—')}</dd>
      <dt>Referencia</dt><dd>${esc(p.referenciaPago || '—')}</dd>
      <dt>Asesor</dt><dd>${esc(p.vendedor)}</dd>
      <dt>Autorización de datos</dt><dd>${p.consentimiento ? 'Sí · ' + fecha(p.consentimiento.fecha) : 'No registrada'}</dd>
      ${p.motivoAnulacion ? `<dt>Motivo de anulación</dt><dd>${esc(p.motivoAnulacion)}</dd>` : ''}
    </dl>
    <div class="mini-tabla"><table><thead><tr><th>Código</th><th>Producto</th>
      <th class="num">Cant.</th><th class="num">Subtotal</th></tr></thead><tbody>${items}</tbody></table></div>
    <dl class="dl">
      <dt>Subtotal</dt><dd>${money(p.subtotal)}</dd>
      ${p.descuento ? `<dt>Descuento</dt><dd>− ${money(p.descuento)}</dd>` : ''}
      ${p.envio ? `<dt>Envío</dt><dd>${money(p.envio)}</dd>` : ''}
      <dt><b>Total</b></dt><dd><b>${money(p.total)}</b></dd>
      <dt>Pago</dt><dd>${p.pagado ? 'Confirmado' : 'Pendiente'}</dd>
      ${costos ? `<dt>Costo de mercancía</dt><dd>${money(Datos.costoPedido(p))}</dd>
        <dt><b>Utilidad</b></dt><dd><b>${money(util)}</b></dd>` : ''}
    </dl>
    ${envio}
    ${puede ? `<div class="campo"><label for="p-estado">Mover a</label><select id="p-estado">${opciones}</select></div>
      <div class="campo" id="campo-motivo" style="display:none"><label>Motivo de la anulación</label>
        <select id="p-motivo">${Datos.MOTIVOS_ANULACION.map(m => `<option>${m}</option>`).join('')}</select>
        <span class="ayuda">El motivo alimenta el informe de pérdidas del pipeline.</span></div>
      <div class="campo"><label for="p-nota">Nota del cambio (opcional)</label>
        <input type="text" id="p-nota" placeholder="Ej.: se despachó con guía 998877"></div>` : ''}
    <h4 style="font-size:.9rem;margin:22px 0 14px">Línea de tiempo</h4>
    <ul class="linea-tiempo">${linea}</ul>`,
    `${puede ? `<button class="btn btn-p" data-guardar-pedido="${p.codigo}">Guardar cambios</button>` : ''}
     ${puede && !p.pagado ? `<button class="btn btn-l" data-pagar="${p.codigo}">Marcar pagado</button>` : ''}
     ${['confirmado','separado'].includes(p.estado) && Sesion.edita('alistamiento')
        ? `<button class="btn btn-l" data-alistar="${p.codigo}">Generar alistamiento</button>` : ''}
     <a class="btn btn-wa" target="_blank" rel="noopener"
        href="${waHref(p.cliente.telefono, `Hola ${p.cliente.nombre || ''} 👋 tu pedido *${p.codigo}* está en estado: *${(Datos.ETAPA[p.estado] || {}).t}*.`)}">${IC.wa} Avisar</a>
     <button class="btn btn-l" data-remision="${p.codigo}">${IC.imprimir} Remisión</button>`);
};

PANELES.cliente = function (id) {
  const c = id ? Datos.cliente(id) : null;
  const ped = c ? Datos.pedidosDeCliente(c.id) : [];
  const puede = Sesion.edita('clientes');
  const cartera = c ? Datos.cartera().filter(x => x.clienteId === c.id && !['pagada','anulada'].includes(x.estado)) : [];
  const saldo = cartera.reduce((a, x) => a + (x.monto - x.abonado), 0);
  abrirPanel(c ? c.nombre : 'Nuevo cliente', c ? c.id : 'Se crea al guardar', `
    ${saldo ? `<div class="aviso alerta">Tiene un saldo pendiente de <b>${money(saldo)}</b>.</div>` : ''}
    <div class="campo"><label>Nombre o negocio</label>
      <input type="text" id="cl-nombre" value="${esc(c ? c.nombre : '')}" ${puede ? '' : 'disabled'}></div>
    <div class="rejilla">
      <div class="campo"><label>WhatsApp</label>
        <input type="text" id="cl-tel" inputmode="numeric" value="${esc(c ? c.telefono : '')}" ${puede ? '' : 'disabled'}></div>
      <div class="campo"><label>Documento</label>
        <input type="text" id="cl-doc" value="${esc(c ? c.documento || '' : '')}" ${puede ? '' : 'disabled'}></div>
    </div>
    <div class="campo"><label>Correo</label>
      <input type="text" id="cl-correo" inputmode="email" value="${esc(c ? c.correo || '' : '')}" ${puede ? '' : 'disabled'}></div>
    <div class="rejilla">
      <div class="campo"><label>Ciudad</label>
        <input type="text" id="cl-ciudad" value="${esc(c ? c.ciudad || 'Ibagué' : 'Ibagué')}" ${puede ? '' : 'disabled'}></div>
      <div class="campo"><label>Tipo de cliente</label>
        <select id="cl-tipo" ${puede ? '' : 'disabled'}>${['minorista','mayorista','estudiante'].map(t =>
          `<option value="${t}" ${c && c.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <span class="ayuda">Mayorista y estudiante entran a la escala de precio especial.</span></div>
    </div>
    <div class="campo"><label>Dirección</label>
      <input type="text" id="cl-dir" value="${esc(c ? c.direccion || '' : '')}" ${puede ? '' : 'disabled'}></div>
    <div class="campo"><label>Notas internas</label>
      <textarea id="cl-notas" rows="3" ${puede ? '' : 'disabled'}>${esc(c ? c.notas || '' : '')}</textarea></div>
    ${c ? `<h4 style="font-size:.9rem;margin:22px 0 12px">Historial · ${ped.length} pedido(s)</h4>
      ${ped.length ? `<div class="mini-tabla"><table><thead><tr><th>Pedido</th><th>Fecha</th>
        <th>Estado</th><th class="num">Total</th></tr></thead><tbody>
        ${ped.map(p => `<tr><td class="sku">${p.codigo}</td><td>${fecha(p.creado)}</td>
          <td>${pillEtapa(p.estado)}</td><td class="num">${money(p.total)}</td></tr>`).join('')}
        </tbody></table></div>`
        : '<p style="color:var(--ink-500);font-size:.84rem">Todavía no ha comprado.</p>'}` : ''}`,
    `${puede ? `<button class="btn btn-p" data-guardar-cliente="${c ? c.id : ''}">Guardar</button>` : ''}
     ${c ? `<a class="btn btn-wa" target="_blank" rel="noopener"
        href="${waHref(c.telefono, `Hola ${c.nombre} 👋 te escribo de *Electro Futuro*.`)}">${IC.wa} Escribir</a>` : ''}`);
};

PANELES.ficha = function (sku) {
  const p = EFA().porSku[sku];
  const f = Datos.ficha(sku);
  const puede = Sesion.edita('inventario');
  const costos = Sesion.veCostos(), precios = Sesion.vePrecios();
  const kar = Datos.kardex(sku).slice(0, 12);
  const u = f ? f.ubicacion : { bodega:'Local', estante:'', nivel:'', caja:'' };
  const abc = Datos.abc()[sku];
  const escalas = (f && f.escalas) || [];
  abrirPanel(sku, p ? p.nombre : '', `
    <dl class="dl">
      <dt>Producto</dt><dd>${esc(p ? p.nombre : sku)}</dd>
      <dt>Marca</dt><dd>${esc(p ? p.marca : '—')}</dd>
      <dt>Categoría</dt><dd>${esc(p ? p.categoria + ' · ' + p.subcategoria : '—')}</dd>
      <dt>Línea</dt><dd>${chipLinea(EFA().lineaSku(sku))}</dd>
      ${abc ? `<dt>Clase ABC</dt><dd>${abc.clase} · ${money(abc.valor)} vendidos en 180 días</dd>` : ''}
    </dl>
    <div class="campo"><label>Línea de producto</label>
      <select id="f-linea" ${puede ? '' : 'disabled'}>${Datos.LINEAS.map(l =>
        `<option value="${l.cod}" ${EFA().lineaSku(sku) === l.cod ? 'selected' : ''}>${l.cod} · ${l.nombre}</option>`).join('')}</select>
      <span class="ayuda">Se dedujo del catálogo; puedes corregirla.</span></div>
    <div class="rejilla-3">
      <div class="campo"><label>Stock físico</label>
        <input type="number" id="f-stock" min="0" value="${f ? f.stock : 0}" ${puede ? '' : 'disabled'}></div>
      <div class="campo"><label>Stock mínimo</label>
        <input type="number" id="f-min" min="0" value="${f ? f.minimo : 3}" ${puede ? '' : 'disabled'}></div>
      <div class="campo"><label>Reservado</label>
        <input type="number" value="${f ? f.reservado || 0 : 0}" disabled>
        <span class="ayuda">Lo comprometen los pedidos abiertos.</span></div>
    </div>
    <div class="rejilla">
      ${precios ? `<div class="campo"><label>Precio de venta</label>
        <input type="number" id="f-precio" min="0" value="${f ? f.precio : (p ? p.precio : 0)}" ${puede ? '' : 'disabled'}></div>` : ''}
      ${costos ? `<div class="campo"><label>Costo unitario</label>
        <input type="number" id="f-costo" min="0" value="${f ? f.costo : 0}">
        <span class="ayuda">Solo lo ve gerencia.</span></div>` : ''}
    </div>
    <h4 style="font-size:.88rem;margin:18px 0 10px">${IC.ubicacion} Ubicación física</h4>
    <div class="rejilla-4">
      <div class="campo"><label>Bodega</label><input type="text" id="f-bod" value="${esc(u.bodega)}" ${puede ? '' : 'disabled'}></div>
      <div class="campo"><label>Estante</label><input type="text" id="f-est" value="${esc(u.estante)}" ${puede ? '' : 'disabled'}></div>
      <div class="campo"><label>Nivel</label><input type="text" id="f-niv" value="${esc(u.nivel)}" ${puede ? '' : 'disabled'}></div>
      <div class="campo"><label>Caja</label><input type="text" id="f-caj" value="${esc(u.caja)}" ${puede ? '' : 'disabled'}></div>
    </div>
    <div class="rejilla">
      <div class="campo"><label>Proveedor</label>
        <input type="text" id="f-prov" list="lista-prov" value="${esc(f ? f.proveedor : '')}" ${puede ? '' : 'disabled'}>
        <datalist id="lista-prov">${Datos.proveedores().map(x => `<option value="${esc(x.nombre)}">`).join('')}</datalist>
        <span class="ayuda">Agrupa la reposición sugerida.</span></div>
      <div class="campo"><label>Lleva serial</label>
        <select id="f-serial" ${puede ? '' : 'disabled'}>
          <option value="0" ${f && f.serialado ? '' : 'selected'}>No</option>
          <option value="1" ${f && f.serialado ? 'selected' : ''}>Sí</option></select>
        <span class="ayuda">Para relojes y power banks de gama alta.</span></div>
    </div>
    ${precios ? `<h4 style="font-size:.88rem;margin:18px 0 8px">Escalas de precio propias</h4>
      <p style="font-size:.78rem;color:var(--ink-500);margin:0 0 10px">Si las dejas vacías se aplican
      las escalas generales de Ajustes.</p>
      <div id="escalas">${[0,1,2].map(i => {
        const e = escalas[i] || {};
        return `<div class="rejilla" style="gap:0 10px">
          <div class="campo"><label>Desde (unidades)</label>
            <input type="number" min="2" class="esc-desde" value="${e.desde || ''}" ${puede ? '' : 'disabled'}></div>
          <div class="campo"><label>Precio unitario</label>
            <input type="number" min="0" class="esc-precio" value="${e.precio || ''}" ${puede ? '' : 'disabled'}></div>
        </div>`;
      }).join('')}</div>` : ''}
    ${f && puede ? `<div class="campo"><label>Movimiento rápido</label>
      <div style="display:flex;gap:8px">
        <input type="number" id="f-cant" min="1" value="1" style="max-width:92px">
        <button class="btn btn-l" data-mov="entrada" data-sku="${sku}">Entrada</button>
        <button class="btn btn-l" data-mov="salida" data-sku="${sku}">Salida</button>
      </div><span class="ayuda">Suma o descuenta y queda en el kardex.</span></div>` : ''}
    <h4 style="font-size:.9rem;margin:20px 0 12px">Kardex</h4>
    ${kar.length ? `<div class="mini-tabla"><table><thead><tr><th>Fecha</th><th>Tipo</th>
      <th class="num">Cant.</th><th class="num">Saldo</th><th>Motivo</th></tr></thead><tbody>
      ${kar.map(m => `<tr><td>${fechaHora(m.fecha)}</td><td>${m.tipo}</td>
        <td class="num">${m.cantidad}</td><td class="num">${m.saldo}</td><td>${esc(m.motivo)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p style="color:var(--ink-500);font-size:.84rem">Sin movimientos todavía.</p>'}`,
    puede ? `<button class="btn btn-p" data-guardar-ficha="${sku}">Guardar</button>` : '');
};

PANELES.abono = function (id) {
  const c = Datos.cartera().find(x => x.id === id);
  if (!c) return;
  const cl = Datos.cliente(c.clienteId) || {};
  const saldo = c.monto - c.abonado;
  abrirPanel('Registrar abono', c.pedido + ' · ' + (cl.nombre || ''), `
    <dl class="dl"><dt>Monto total</dt><dd>${money(c.monto)}</dd>
      <dt>Abonado</dt><dd>${money(c.abonado)}</dd>
      <dt><b>Saldo</b></dt><dd><b>${money(saldo)}</b></dd>
      <dt>Vence</dt><dd>${fecha(c.vence)}</dd></dl>
    <div class="campo"><label>Valor del abono</label>
      <input type="number" id="ab-monto" min="1" max="${saldo}" value="${saldo}"></div>
    <div class="campo"><label>Método</label><select id="ab-metodo">
      <option>Efectivo</option><option>Bancolombia</option><option>Lulo Bank</option>
      <option>Bre-B</option><option>Otro</option></select></div>`,
    `<button class="btn btn-p" data-guardar-abono="${id}">Registrar abono</button>`);
};

PANELES.movimiento = function () {
  abrirPanel('Registrar movimiento', 'Caja', `
    <div class="rejilla">
      <div class="campo"><label>Tipo</label><select id="mv-tipo">
        <option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select></div>
      <div class="campo"><label>Categoría</label><select id="mv-cat">
        <option>Compra de mercancía</option><option>Arriendo</option><option>Servicios</option>
        <option>Nómina</option><option>Transporte</option><option>Publicidad</option>
        <option>Otro ingreso</option><option>Otro egreso</option></select></div>
    </div>
    <div class="campo"><label>Descripción</label><input type="text" id="mv-desc"></div>
    <div class="rejilla">
      <div class="campo"><label>Monto</label><input type="number" id="mv-monto" min="1" inputmode="numeric"></div>
      <div class="campo"><label>Método</label><select id="mv-metodo">
        <option>Efectivo</option><option>Bancolombia</option><option>Lulo Bank</option>
        <option>Bre-B</option><option>Otro</option></select></div>
    </div>`, '<button class="btn btn-p" data-guardar-mov="1">Guardar</button>');
};

PANELES.garantia = function (id) {
  const g = Datos.garantias().find(x => x.id === id);
  if (!g) return;
  abrirPanel('Garantía ' + g.id, fecha(g.creado), `
    <dl class="dl"><dt>Cliente</dt><dd>${esc(g.cliente || '—')}</dd>
      <dt>Pedido</dt><dd>${esc(g.pedido || '—')}</dd>
      <dt>Producto</dt><dd>${esc(EFA().nombreSku(g.sku))}</dd>
      <dt>Vence</dt><dd>${fecha(g.vence)}</dd></dl>
    <div class="campo"><label>Motivo reportado</label><textarea rows="3" disabled>${esc(g.motivo || '')}</textarea></div>
    <div class="campo"><label>Estado</label><select id="g-estado">
      ${['radicada','en_revision','aprobada','rechazada','resuelta'].map(e =>
        `<option value="${e}" ${g.estado === e ? 'selected' : ''}>${e.replace('_', ' ')}</option>`).join('')}</select></div>
    <div class="campo"><label>Respuesta al cliente</label>
      <textarea id="g-nota" rows="3">${esc(g.nota || '')}</textarea></div>`,
    `<button class="btn btn-p" data-guardar-garantia="${g.id}">Guardar</button>`);
};

/* ---------- nuevo pedido / cotización ---------- */
const NP = { items: [], linea: '' };
PANELES.nuevoPedido = function (linea) {
  NP.items = [];
  NP.linea = linea && linea !== '1' ? linea : '';
  abrirPanel('Nuevo pedido', 'Mostrador o cotización mayorista', `
    <div class="rejilla">
      <div class="campo"><label>Nombre del cliente</label><input type="text" id="np-nombre"></div>
      <div class="campo"><label>WhatsApp</label><input type="text" id="np-tel" inputmode="numeric"></div>
    </div>
    <div class="rejilla">
      <div class="campo"><label>Canal</label><select id="np-canal">
        <option value="mostrador">Mostrador · venta inmediata</option>
        <option value="mayorista">Mayorista · con cotización</option></select></div>
      <div class="campo"><label>Estado inicial</label><select id="np-estado">
        <option value="entregado">Entregado y pagado</option>
        <option value="cotizacion">Cotización</option>
        <option value="confirmado">Pedido confirmado</option></select></div>
    </div>
    <div class="campo"><label>Buscar producto</label>
      <input type="text" id="np-buscar" placeholder="Escribe el código o el nombre" autocomplete="off">
      <div id="np-sug"></div></div>
    <div id="np-items" style="margin:14px 0"></div>
    <div class="rejilla">
      <div class="campo"><label>Entrega</label><select id="np-entrega">
        <option value="recoger">Recoge en el local</option><option value="envio">Envío</option></select></div>
      <div class="campo"><label>Método de pago</label><select id="np-pago">
        <option>Efectivo</option><option>Bancolombia</option><option>Lulo Bank</option><option>Bre-B</option></select></div>
    </div>`, '<button class="btn btn-p" data-guardar-np="1">Registrar</button>');
  pintarNP();
};

function pintarNP() {
  const total = NP.items.reduce((a, i) => a + i.precio * i.qty, 0);
  const cont = $('#np-items');
  if (!cont) return;
  cont.innerHTML = NP.items.length
    ? `<div class="mini-tabla" style="margin:0"><table><tbody>${NP.items.map((i, n) => {
        const esc_ = Datos.precioPara(i.sku, i.qty, i.base);
        return `<tr><td class="sku">${i.sku}</td><td>${esc(i.nombre)}
          ${esc_.descuento ? `<span class="pill cian">−${esc_.descuento} % desde ${esc_.escala}</span>` : ''}</td>
          <td class="num"><input type="number" class="mini" min="1" value="${i.qty}" data-np-qty="${n}"></td>
          <td class="num">${money(i.precio * i.qty)}</td>
          <td class="acc"><button class="btn btn-d btn-x" data-np-quitar="${n}">×</button></td></tr>`;
      }).join('')}
      <tr><td colspan="3"><b>Total</b></td><td class="num"><b>${money(total)}</b></td><td></td></tr>
      </tbody></table></div>`
    : '<p style="color:var(--ink-500);font-size:.83rem">Agrega al menos un producto. El precio por escala se aplica solo.</p>';
}

/* ---------- alistamiento ---------- */
PANELES.lista = function (codigo) {
  const a = Datos.alistamientoDe(codigo);
  if (!a) return;
  const p = Datos.pedido(codigo);
  abrirPanel('Alistamiento ' + codigo, a.cliente + ' · ordenado por ubicación', `
    <div class="aviso info">Recorre la bodega en este orden y marca lo que vayas recogiendo.
      Si algo falta, deja la cantidad menor: el faltante queda registrado.</div>
    <div class="mini-tabla"><table><thead><tr><th>Ubicación</th><th>Producto</th>
      <th class="num">Pedida</th><th class="num">Recogida</th><th class="num">Falta</th></tr></thead><tbody>
      ${a.lineas.map(l => `<tr>
        <td><b>${esc(l.ubicacion)}</b></td>
        <td>${esc(l.nombre)}<span class="sub">${l.sku}</span></td>
        <td class="num">${l.pedida}</td>
        <td class="num"><input type="number" class="mini" min="0" max="${l.pedida}" value="${l.recogida}"
          data-recoger="${codigo}" data-sku="${l.sku}"></td>
        <td class="num">${l.faltante ? `<b style="color:var(--danger)">${l.faltante}</b>` : '0'}</td>
      </tr>`).join('')}</tbody></table></div>
    ${a.lineas.some(l => l.faltante) ? `<div class="aviso alerta">Hay faltantes. Puedes cerrar igual y
      despachar parcial, o dejar la lista abierta mientras consigues la mercancía.</div>` : ''}`,
    `<button class="btn btn-p" data-cerrar-lista="${codigo}">Cerrar y marcar listo</button>
     ${p ? `<a class="btn btn-wa" target="_blank" rel="noopener"
       href="${waHref(p.cliente.telefono, `Hola ${p.cliente.nombre} 👋 tu pedido *${codigo}* ya está alistado.`)}">${IC.wa} Avisar</a>` : ''}`);
};

/* ---------- traslado ---------- */
const TR = { lineas: [] };
PANELES.traslado = function () {
  TR.lineas = [];
  const bodegas = [...new Set(Object.values(Datos.inventario()).map(f => f.ubicacion.bodega).filter(Boolean))];
  if (!bodegas.includes('Local')) bodegas.push('Local');
  if (!bodegas.includes('Bodega 1')) bodegas.push('Bodega 1');
  abrirPanel('Nuevo traslado', 'Movimiento entre bodegas', `
    <div class="rejilla">
      <div class="campo"><label>Origen</label><select id="tr-origen">
        ${bodegas.map(b => `<option>${esc(b)}</option>`).join('')}</select></div>
      <div class="campo"><label>Destino</label><select id="tr-destino">
        ${bodegas.slice().reverse().map(b => `<option>${esc(b)}</option>`).join('')}</select></div>
    </div>
    <div class="campo"><label>Buscar referencia</label>
      <input type="text" id="tr-buscar" placeholder="Código o nombre" autocomplete="off">
      <div id="tr-sug"></div></div>
    <div id="tr-items"></div>`,
    '<button class="btn btn-p" data-guardar-traslado="1">Enviar traslado</button>');
  pintarTR();
};
function pintarTR() {
  const c = $('#tr-items');
  if (!c) return;
  c.innerHTML = TR.lineas.length ? `<div class="mini-tabla"><table><tbody>${TR.lineas.map((l, n) => `
    <tr><td class="sku">${l.sku}</td><td>${esc(EFA().nombreSku(l.sku))}</td>
    <td class="num"><input type="number" class="mini" min="1" value="${l.cantidad}" data-tr-qty="${n}"></td>
    <td class="acc"><button class="btn btn-d btn-x" data-tr-quitar="${n}">×</button></td></tr>`).join('')}
    </tbody></table></div>`
    : '<p style="color:var(--ink-500);font-size:.83rem">Agrega al menos una referencia.</p>';
}

/* ---------- proveedor y serial ---------- */
PANELES.proveedor = function (nombre) {
  const p = nombre ? Datos.proveedores().find(x => x.nombre === nombre) : null;
  abrirPanel(p ? p.nombre : 'Nuevo proveedor', 'El tiempo de entrega alimenta el punto de reorden', `
    <div class="campo"><label>Nombre</label>
      <input type="text" id="pv-nombre" value="${esc(p ? p.nombre : '')}" ${p ? 'readonly' : ''}></div>
    <div class="rejilla">
      <div class="campo"><label>WhatsApp</label>
        <input type="text" id="pv-tel" inputmode="numeric" value="${esc(p ? p.telefono : '')}"></div>
      <div class="campo"><label>Días de entrega</label>
        <input type="number" id="pv-dias" min="1" max="90" value="${p ? p.dias : 7}"></div>
    </div>`, '<button class="btn btn-p" data-guardar-proveedor="1">Guardar</button>');
};

PANELES.serial = function () {
  const con = Object.entries(Datos.inventario()).filter(([, f]) => f.serialado);
  abrirPanel('Registrar serial', 'Entrada de mercancía con serial', `
    ${con.length ? '' : '<div class="aviso alerta">Todavía no marcaste ninguna referencia como «Lleva serial». Hazlo en su ficha de inventario.</div>'}
    <div class="campo"><label>Referencia</label><select id="se-sku">
      ${con.map(([s]) => `<option value="${s}">${esc(EFA().nombreSku(s))} (${s})</option>`).join('')}</select></div>
    <div class="campo"><label>Serial o IMEI</label><input type="text" id="se-serial" autocomplete="off"></div>
    <div class="campo"><label>Origen</label><input type="text" id="se-origen" placeholder="Compra OC-0001 o proveedor"></div>`,
    '<button class="btn btn-p" data-guardar-serial="1">Registrar</button>');
};

/* ---------- remisión imprimible ---------- */
function remision(codigo) {
  const p = Datos.pedido(codigo);
  if (!p) return;
  const w = global.open('', '_blank');
  if (!w) return toast('El navegador bloqueó la ventana de impresión');
  w.document.write(`<!DOCTYPE html><html lang="es-CO"><head><meta charset="UTF-8">
    <title>Remisión ${p.codigo}</title><style>
    body{font-family:system-ui,sans-serif;color:#0F172A;padding:32px;max-width:760px;margin:0 auto}
    h1{font-size:20px;margin:0 0 4px} .g{color:#64748B;font-size:12px}
    table{width:100%;border-collapse:collapse;margin:22px 0}
    th{text-align:left;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#64748B;
      border-bottom:1px solid #E2E8F0;padding:8px 6px}
    td{padding:8px 6px;border-bottom:1px solid #F1F5F8;font-size:13px}
    .num{text-align:right;font-variant-numeric:tabular-nums}
    .tot{font-size:17px;font-weight:700;text-align:right;margin-top:8px}
    .pie{margin-top:40px;border-top:1px dashed #CBD5E1;padding-top:14px;font-size:11px;color:#64748B}
    </style></head><body>
    <h1>ELECTRO FUTURO</h1>
    <div class="g">Cra. 6 #18-49, Local 3 · Ibagué, Tolima · WhatsApp 313 413 5751</div>
    <h2 style="margin-top:22px;font-size:15px">Remisión ${p.codigo}</h2>
    <div class="g">${fechaHora(p.creado)} · ${p.entrega === 'recoger' ? 'Recoge en el local' : 'Envío'}
      ${p.guia ? ' · Guía ' + p.guia : ''}</div>
    <div style="margin-top:14px;font-size:13px"><b>${esc(p.cliente.nombre || '')}</b><br>
      ${esc(p.cliente.telefono || '')}<br>${esc(p.cliente.direccion || '')} ${esc(p.cliente.ciudad || '')}</div>
    <table><thead><tr><th>Código</th><th>Producto</th><th class="num">Cant.</th>
      <th class="num">Valor</th></tr></thead><tbody>
      ${p.items.map(i => `<tr><td>${i.sku}</td><td>${esc(i.nombre)}</td>
        <td class="num">${i.qty}</td><td class="num">$${(i.precio * i.qty).toLocaleString('es-CO')}</td></tr>`).join('')}
    </tbody></table>
    <div class="tot">Total: $${p.total.toLocaleString('es-CO')}</div>
    <div class="pie">Recibido conforme: ______________________________<br><br>
      Documento interno de entrega. No es factura de venta.</div>
    <script>window.print()<\/script></body></html>`);
  w.document.close();
}

/* ============================================================
   DEMOSTRACIÓN
   ============================================================ */
function cargarDemo() {
  const u = yo();
  const CAT = EFA().CAT;
  Datos.guardarProveedor({ nombre:'Mayorista Bogotá', telefono:'3110001122', dias:5 }, u);
  Datos.guardarProveedor({ nombre:'Importadora Cali', telefono:'3125558899', dias:12 }, u);

  const muestra = CAT.filter(p => p.imagen).slice(0, 30);
  const bodegas = ['Local','Bodega 1'];
  muestra.forEach((p, n) => Datos.guardarFicha(p.sku, {
    stock: [24, 12, 5, 2, 40, 8, 0, 16][n % 8],
    minimo: 5,
    costo: Math.round(p.precio * 0.62),
    precio: p.precio,
    proveedor: n % 2 ? 'Mayorista Bogotá' : 'Importadora Cali',
    ubicacion: { bodega: bodegas[n % 2], estante: 'ABCD'[n % 4], nivel: String(1 + n % 3), caja: String(n + 1).padStart(2, '0') }
  }, u, p));

  const clientes = [
    { nombre:'Celulares La 15', telefono:'3115557788', ciudad:'Ibagué', tipo:'mayorista' },
    { nombre:'Andrea Betancourt', telefono:'3204441122', ciudad:'Ibagué', tipo:'minorista' },
    { nombre:'TecnoFix Espinal', telefono:'3186669900', ciudad:'Espinal', tipo:'mayorista' },
    { nombre:'Servitech Melgar', telefono:'3013334455', ciudad:'Melgar', tipo:'mayorista' }
  ];
  const rutas = ['cotizacion','confirmado','alistamiento','listo','entregado'];
  clientes.forEach((c, n) => {
    const items = muestra.slice(n * 3, n * 3 + 3).map(p => {
      const q = 1 + (n * 2) % 5;
      return { sku:p.sku, nombre:p.nombre, precio:Datos.precioPara(p.sku, q, p.precio).precio,
               qty:q, linea:Datos.lineaDe(p) };
    });
    if (!items.length) return;
    const sub = items.reduce((a, i) => a + i.precio * i.qty, 0);
    const envio = n === 2 ? 14000 : 0;
    const p = Datos.crearPedido({
      cliente:c, items, entrega: envio ? 'envio' : 'recoger',
      canal: c.tipo === 'mayorista' ? 'mayorista' : 'mostrador',
      metodoPago:'Bre-B', subtotal:sub, envio, total:sub + envio,
      pagado: n !== 3, estado:'confirmado',
      consentimiento:{ autoriza:true, fecha:new Date().toISOString() }, origen:'demo'
    }, u);
    if (rutas[n] !== 'confirmado') Datos.cambiarEstado(p.codigo, rutas[n], 'Datos de demostración', u);
  });

  Datos.movimientoCaja({ tipo:'egreso', categoria:'Arriendo', descripcion:'Arriendo del local',
    monto:1200000, metodo:'Bancolombia' }, u);
  Datos.movimientoCaja({ tipo:'egreso', categoria:'Servicios', descripcion:'Energía e internet',
    monto:340000, metodo:'Bancolombia' }, u);
  repintar();
  toast('Datos de demostración cargados');
}

/* ============================================================
   CSV DE INVENTARIO
   ============================================================ */
function importarCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim());
  if (!lineas.length) return toast('El archivo está vacío');
  const cab = lineas.shift().toLowerCase().split(/[;,\t]/).map(s => s.trim().replace(/^"|"$/g, ''));
  const col = (...n) => cab.findIndex(c => n.some(x => c.includes(x)));
  const iSku = col('sku','codigo','código'), iStock = col('stock','cantidad');
  if (iSku < 0 || iStock < 0) return toast('El archivo debe traer al menos las columnas SKU y stock');
  const iCosto = col('costo'), iPrecio = col('precio'), iMin = col('minimo','mínimo'),
        iProv = col('proveedor'), iBod = col('bodega'), iEst = col('estante');
  let ok = 0; const fallos = [];
  lineas.forEach((l, n) => {
    const c = l.split(/[;,\t]/).map(s => s.trim().replace(/^"|"$/g, ''));
    const sku = c[iSku];
    if (!sku) return;
    const prod = EFA().porSku[sku];
    if (!prod) { fallos.push(`Fila ${n + 2}: el código ${sku} no está en el catálogo`); return; }
    const campos = { stock: Number(c[iStock]) || 0 };
    if (iCosto >= 0 && c[iCosto]) campos.costo = Number(c[iCosto]) || 0;
    if (iPrecio >= 0 && c[iPrecio]) campos.precio = Number(c[iPrecio]) || 0;
    if (iMin >= 0 && c[iMin]) campos.minimo = Number(c[iMin]) || 3;
    if (iProv >= 0 && c[iProv]) campos.proveedor = c[iProv];
    if (iBod >= 0 || iEst >= 0) campos.ubicacion = {
      bodega: iBod >= 0 ? c[iBod] : undefined, estante: iEst >= 0 ? c[iEst] : undefined
    };
    Datos.guardarFicha(sku, campos, yo(), prod);
    ok++;
  });
  repintar();
  toast(`${ok} referencia(s) cargadas${fallos.length ? ` · ${fallos.length} con error` : ''}`);
  if (fallos.length) console.warn('Filas con error:\n' + fallos.join('\n'));
}

/* ============================================================
   EVENTOS
   ============================================================ */
document.addEventListener('click', e => {
  const t = e.target;
  const u = yo();
  const dd = (sel) => t.closest(sel);

  /* --- pestañas internas --- */
  const bod = dd('[data-bod]');   if (bod) { F.bodega = bod.dataset.bod; return repintar(); }
  const fin = dd('[data-fin]');   if (fin) { F.finanzas = fin.dataset.fin; return repintar(); }

  /* --- abrir paneles --- */
  const ped = dd('[data-pedido]');    if (ped) return PANELES.pedido(ped.dataset.pedido);
  const cli = dd('[data-cliente]');   if (cli) return PANELES.cliente(cli.dataset.cliente);
  const fic = dd('[data-ficha]');     if (fic) return PANELES.ficha(fic.dataset.ficha);
  const abo = dd('[data-abono]');     if (abo) return PANELES.abono(abo.dataset.abono);
  const gar = dd('[data-garantia]');  if (gar) return PANELES.garantia(gar.dataset.garantia);
  const lis = dd('[data-lista]');     if (lis) return PANELES.lista(lis.dataset.lista);
  const pv  = dd('[data-proveedor]'); if (pv)  return PANELES.proveedor(pv.dataset.proveedor);
  if (dd('[data-cliente-nuevo]'))   return PANELES.cliente(null);
  if (dd('[data-proveedor-nuevo]')) return PANELES.proveedor(null);
  if (dd('[data-mov-nuevo]'))       return PANELES.movimiento();
  if (dd('[data-traslado-nuevo]'))  return PANELES.traslado();
  if (dd('[data-serial-nuevo]'))    return PANELES.serial();
  const np = dd('[data-nuevo-pedido]'); if (np) return PANELES.nuevoPedido(np.dataset.nuevoPedido);
  const rem = dd('[data-remision]');  if (rem) return remision(rem.dataset.remision);

  /* --- pedidos --- */
  const gp = dd('[data-guardar-pedido]');
  if (gp) {
    const cod = gp.dataset.guardarPedido;
    const campos = {};
    if ($('#p-transp')) campos.transportadora = $('#p-transp').value.trim();
    if ($('#p-guia'))   campos.guia = $('#p-guia').value.trim();
    if (Object.keys(campos).length) Datos.actualizarPedido(cod, campos, u);
    const nuevo = $('#p-estado') ? $('#p-estado').value : null;
    if (nuevo) Datos.cambiarEstado(cod, nuevo, $('#p-nota').value.trim(), u,
      nuevo === 'anulado' ? $('#p-motivo').value : null);
    cerrarPanel(); repintar();
    return toast('Pedido actualizado');
  }
  const pag = dd('[data-pagar]');
  if (pag) { Datos.marcarPagado(pag.dataset.pagar, null, u); cerrarPanel(); repintar(); return toast('Pago registrado'); }
  const ali = dd('[data-alistar]');
  if (ali) {
    Datos.generarAlistamiento(ali.dataset.alistar, u);
    cerrarPanel(); repintar();
    PANELES.lista(ali.dataset.alistar);
    return toast('Lista generada, ordenada por ubicación');
  }
  const cl_ = dd('[data-cerrar-lista]');
  if (cl_) { Datos.cerrarAlistamiento(cl_.dataset.cerrarLista, u); cerrarPanel(); repintar(); return toast('Pedido listo para entrega'); }

  /* --- clientes --- */
  const gc = dd('[data-guardar-cliente]');
  if (gc) {
    const datos = { id: gc.dataset.guardarCliente || undefined,
      nombre:$('#cl-nombre').value.trim(), telefono:$('#cl-tel').value.trim(),
      documento:$('#cl-doc').value.trim(), correo:$('#cl-correo').value.trim(),
      ciudad:$('#cl-ciudad').value.trim(), tipo:$('#cl-tipo').value,
      direccion:$('#cl-dir').value.trim(), notas:$('#cl-notas').value.trim() };
    if (!datos.nombre || !datos.telefono) return toast('El nombre y el WhatsApp son obligatorios');
    Datos.guardarCliente(datos, u);
    cerrarPanel(); repintar();
    return toast('Cliente guardado');
  }

  /* --- inventario --- */
  const gf = dd('[data-guardar-ficha]');
  if (gf) {
    const sku = gf.dataset.guardarFicha;
    const campos = {
      stock: Number($('#f-stock').value) || 0,
      minimo: Number($('#f-min').value) || 0,
      linea: $('#f-linea').value,
      proveedor: $('#f-prov').value.trim(),
      serialado: $('#f-serial').value === '1',
      ubicacion: { bodega:$('#f-bod').value.trim() || 'Local', estante:$('#f-est').value.trim(),
                   nivel:$('#f-niv').value.trim(), caja:$('#f-caj').value.trim() }
    };
    if ($('#f-precio')) campos.precio = Number($('#f-precio').value) || 0;
    if ($('#f-costo'))  campos.costo  = Number($('#f-costo').value) || 0;
    const desde = $$('.esc-desde').map(x => Number(x.value) || 0);
    const precio = $$('.esc-precio').map(x => Number(x.value) || 0);
    campos.escalas = desde.map((d, i) => ({ desde:d, precio:precio[i] }))
      .filter(x => x.desde > 1 && x.precio > 0).sort((a, b) => a.desde - b.desde);
    Datos.guardarFicha(sku, campos, u, EFA().porSku[sku]);
    cerrarPanel(); repintar();
    return toast('Inventario actualizado');
  }
  const mv = dd('[data-mov]');
  if (mv) {
    const cant = Number($('#f-cant').value) || 1;
    if (!Datos.ficha(mv.dataset.sku)) return toast('Primero guarda la ficha');
    Datos.movimiento(mv.dataset.sku, mv.dataset.mov, cant, 'Movimiento manual', u);
    PANELES.ficha(mv.dataset.sku); repintar();
    return toast(mv.dataset.mov === 'entrada' ? 'Entrada registrada' : 'Salida registrada');
  }
  if (dd('[data-csv-inv]')) return $('#archivo-csv').click();

  /* --- bodega --- */
  if (dd('[data-conteo-nuevo]')) {
    const sug = Datos.sugerirConteo(12);
    if (!sug.length) return toast('No hay referencias con inventario para contar');
    Datos.crearConteo(sug.map(s => s.sku), u);
    repintar();
    return toast('Conteo creado con ' + sug.length + ' referencias');
  }
  const cc = dd('[data-cerrar-conteo]');
  if (cc) {
    const c = Datos.conteos().find(x => x.id === cc.dataset.cerrarConteo);
    const sinMotivo = c.lineas.filter(l => l.contado != null && l.diferencia !== 0 && !l.motivo);
    if (sinMotivo.length) return toast(`${sinMotivo.length} diferencia(s) sin motivo. Escríbelo antes de cerrar.`);
    Datos.cerrarConteo(c.id, u);
    repintar();
    return toast('Conteo cerrado y stock ajustado');
  }
  const rt = dd('[data-recibir-traslado]');
  if (rt) { Datos.recibirTraslado(rt.dataset.recibirTraslado, u); repintar(); return toast('Traslado recibido'); }
  const gt = dd('[data-guardar-traslado]');
  if (gt) {
    if (!TR.lineas.length) return toast('Agrega al menos una referencia');
    const o = $('#tr-origen').value, d = $('#tr-destino').value;
    if (o === d) return toast('El origen y el destino no pueden ser el mismo');
    Datos.crearTraslado({ origen:o, destino:d, lineas:TR.lineas }, u);
    cerrarPanel(); repintar();
    return toast('Traslado enviado');
  }
  const tq = dd('[data-tr-quitar]');
  if (tq) { TR.lineas.splice(Number(tq.dataset.trQuitar), 1); return pintarTR(); }
  const ts = dd('[data-tr-sku]');
  if (ts) {
    const sku = ts.dataset.trSku;
    if (!TR.lineas.some(l => l.sku === sku)) TR.lineas.push({ sku, cantidad:1 });
    $('#tr-buscar').value = ''; $('#tr-sug').innerHTML = '';
    return pintarTR();
  }
  const gs = dd('[data-guardar-serial]');
  if (gs) {
    const sku = $('#se-sku') && $('#se-sku').value;
    const serial = $('#se-serial').value.trim();
    if (!sku) return toast('Marca primero alguna referencia como «Lleva serial»');
    if (!serial) return toast('Escribe el serial');
    if (!Datos.registrarSerial(sku, serial, $('#se-origen').value.trim(), u))
      return toast('Ese serial ya está registrado');
    cerrarPanel(); repintar();
    return toast('Serial registrado');
  }

  /* --- compras --- */
  const crc = dd('[data-crear-compra]');
  if (crc) {
    const prov = crc.dataset.crearCompra;
    const l = Datos.reposicion()[prov];
    if (!l || !l.length) return toast('Ya no hay nada por reponer de ese proveedor');
    const c = Datos.crearCompra(prov, l, u);
    repintar();
    return toast('Orden ' + c.id + ' creada');
  }
  const rc = dd('[data-recibir-compra]');
  if (rc) { Datos.recibirCompra(rc.dataset.recibirCompra, u); repintar(); return toast('Compra recibida, stock actualizado'); }
  const gpv = dd('[data-guardar-proveedor]');
  if (gpv) {
    const n = $('#pv-nombre').value.trim();
    if (!n) return toast('Escribe el nombre del proveedor');
    Datos.guardarProveedor({ nombre:n, telefono:$('#pv-tel').value.trim(), dias:Number($('#pv-dias').value) || 7 }, u);
    cerrarPanel(); repintar();
    return toast('Proveedor guardado');
  }

  /* --- cartera y caja --- */
  const ga = dd('[data-guardar-abono]');
  if (ga) {
    const m = Number($('#ab-monto').value) || 0;
    if (m <= 0) return toast('Escribe un valor válido');
    Datos.abonar(ga.dataset.guardarAbono, m, $('#ab-metodo').value, u);
    cerrarPanel(); repintar();
    return toast('Abono registrado');
  }
  if (dd('[data-guardar-mov]')) {
    const m = Number($('#mv-monto').value) || 0;
    if (m <= 0) return toast('Escribe un valor válido');
    Datos.movimientoCaja({ tipo:$('#mv-tipo').value, categoria:$('#mv-cat').value,
      descripcion:$('#mv-desc').value.trim(), monto:m, metodo:$('#mv-metodo').value }, u);
    cerrarPanel(); repintar();
    return toast('Movimiento registrado');
  }

  /* --- garantías --- */
  const gg = dd('[data-guardar-garantia]');
  if (gg) {
    Datos.estadoGarantia(gg.dataset.guardarGarantia, $('#g-estado').value, $('#g-nota').value.trim(), u);
    cerrarPanel(); repintar();
    return toast('Garantía actualizada');
  }

  /* --- nuevo pedido --- */
  const nq = dd('[data-np-quitar]');
  if (nq) { NP.items.splice(Number(nq.dataset.npQuitar), 1); return pintarNP(); }
  const ns = dd('[data-np-sku]');
  if (ns) {
    const p = EFA().porSku[ns.dataset.npSku];
    const ex = NP.items.find(i => i.sku === p.sku);
    if (ex) ex.qty++;
    else NP.items.push({ sku:p.sku, nombre:p.nombre, base:p.precio,
      precio: Datos.precioPara(p.sku, 1, p.precio).precio, qty:1, linea: EFA().lineaSku(p.sku) });
    NP.items.forEach(i => { i.precio = Datos.precioPara(i.sku, i.qty, i.base).precio; });
    $('#np-buscar').value = ''; $('#np-sug').innerHTML = '';
    return pintarNP();
  }
  if (dd('[data-guardar-np]')) {
    const nombre = $('#np-nombre').value.trim(), tel = $('#np-tel').value.trim();
    if (!nombre || !tel) return toast('Escribe el nombre y el WhatsApp del cliente');
    if (!NP.items.length) return toast('Agrega al menos un producto');
    const sub = NP.items.reduce((a, i) => a + i.precio * i.qty, 0);
    const estado = $('#np-estado').value;
    const p = Datos.crearPedido({
      cliente:{ nombre, telefono:tel, ciudad:'Ibagué' }, items:NP.items,
      entrega:$('#np-entrega').value, canal:$('#np-canal').value,
      metodoPago:$('#np-pago').value, subtotal:sub, total:sub,
      pagado: estado === 'entregado', estado, origen:'mostrador'
    }, u);
    cerrarPanel(); repintar();
    return toast(estado === 'cotizacion' ? 'Cotización ' + p.codigo + ' creada' : 'Pedido ' + p.codigo + ' registrado');
  }

  /* --- ajustes --- */
  if (dd('[data-guardar-cfg]')) {
    const esc_ = Datos.config().escalas.map((e, i) =>
      ({ desde:e.desde, desc: Number(($('#esc-' + i) || {}).value) || 0 }));
    Datos.guardarConfig({ margenMinimo: Number($('#cfg-margen').value) || 18,
      diasSinRotacion: Number($('#cfg-rot').value) || 90, escalas: esc_ }, u);
    repintar();
    return toast('Reglas guardadas');
  }
  if (dd('[data-exportar-db]')) {
    descargar(`electrofuturo-respaldo-${new Date().toISOString().slice(0, 10)}.json`,
      Datos.exportar(), 'application/json');
    return toast('Respaldo descargado');
  }
  if (dd('[data-restaurar]')) return $('#archivo-json').click();
  if (dd('[data-demo]'))      return cargarDemo();
  if (dd('[data-vaciar]')) {
    if (!confirm('Se borran pedidos, clientes, inventario, bodega, cartera y caja. ¿Seguro?')) return;
    Datos.vaciar(); repintar();
    return toast('Datos borrados');
  }
});

/* --- inputs --- */
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q-clientes') { F.clientes.q = t.value; repintar(); return foco('#q-clientes'); }
  if (t.id === 'q-inv')      { F.inv.q = t.value; repintar(); return foco('#q-inv'); }
  if (t.id === 'np-buscar')  return sugerir(t.value, '#np-sug', 'np-sku');
  if (t.id === 'tr-buscar')  return sugerir(t.value, '#tr-sug', 'tr-sku', true);
  if (t.id === 'q-ubic')     return buscarUbicacion(t.value);
});

function foco(sel) {
  const el = $(sel);
  if (!el) return;
  const v = el.value;
  el.focus();
  el.setSelectionRange(v.length, v.length);
}

function sugerir(q, destino, attr, soloConFicha) {
  const c = $(destino);
  if (!c) return;
  q = q.trim().toLowerCase();
  if (q.length < 2) return (c.innerHTML = '');
  let l = EFA().CAT.filter(p => (p.sku + ' ' + p.nombre).toLowerCase().includes(q));
  if (soloConFicha) l = l.filter(p => Datos.ficha(p.sku));
  c.innerHTML = l.slice(0, 6).map(p => {
    const f = Datos.ficha(p.sku);
    return `<button class="btn btn-l btn-x" style="display:block;width:100%;text-align:left;margin-top:6px"
      data-${attr}="${p.sku}">${esc(p.nombre)} · ${money(f ? f.precio : p.precio)}
      ${f ? `<span class="pill ${f.stock - f.reservado > 0 ? 'verde' : 'rojo'}">${f.stock - f.reservado} disp.</span>` : ''}</button>`;
  }).join('') || '<p style="font-size:.79rem;color:var(--ink-400);margin:8px 0 0">Sin coincidencias.</p>';
}

function buscarUbicacion(q) {
  const c = $('#res-ubic');
  if (!c) return;
  q = q.trim().toLowerCase();
  if (q.length < 2) return (c.innerHTML = '');
  const l = Object.entries(Datos.inventario())
    .filter(([sku]) => (sku + ' ' + EFA().nombreSku(sku)).toLowerCase().includes(q)).slice(0, 8);
  c.innerHTML = l.length ? `<div class="tarjeta"><div class="tarjeta-cuerpo pegado">${tabla(
    ['Código','Producto','Está en',{t:'Stock',num:1},''],
    l.map(([sku, f]) => [ td('Código', sku, 'sku'), td('Producto', esc(EFA().nombreSku(sku))),
      td('Está en', `<b>${esc([f.ubicacion.bodega, f.ubicacion.estante, f.ubicacion.nivel, f.ubicacion.caja].filter(Boolean).join(' · ') || 'Sin ubicación')}</b>`),
      td('Stock', f.stock, 'num'),
      td('', `<button class="btn btn-l btn-x" data-ficha="${sku}">Editar</button>`, 'acc') ]))}
    </div></div>` : `<div class="tarjeta"><div class="tarjeta-cuerpo">${vacio('No está en inventario',
      'Esa referencia todavía no se ha dado de alta.')}</div></div>`;
}

document.addEventListener('change', e => {
  const t = e.target;
  const u = yo();
  if (t.id === 'f-tipo-cli')  { F.clientes.tipo = t.value; return repintar(); }
  if (t.id === 'f-linea-inv') { F.inv.linea = t.value; return repintar(); }
  if (t.id === 'f-modo-inv')  { F.inv.modo = t.value; return repintar(); }
  if (t.id === 'f-clase-inv') { F.inv.clase = t.value; return repintar(); }
  if (t.dataset.npQty != null) {
    const i = NP.items[Number(t.dataset.npQty)];
    i.qty = Math.max(1, Number(t.value) || 1);
    i.precio = Datos.precioPara(i.sku, i.qty, i.base).precio;
    return pintarNP();
  }
  if (t.dataset.trQty != null) { TR.lineas[Number(t.dataset.trQty)].cantidad = Math.max(1, Number(t.value) || 1); return pintarTR(); }
  if (t.dataset.recoger) { Datos.marcarRecogido(t.dataset.recoger, t.dataset.sku, t.value); return PANELES.lista(t.dataset.recoger); }
  if (t.dataset.conteo)  { Datos.registrarConteo(t.dataset.conteo, t.dataset.sku, t.value); return repintar(); }
  if (t.dataset.motivo)  { Datos.registrarConteo(t.dataset.motivo, t.dataset.sku, undefined, t.value); return; }
  if (t.id === 'p-estado') {
    const cm = $('#campo-motivo');
    if (cm) cm.style.display = t.value === 'anulado' ? '' : 'none';
    return;
  }
  if (t.id === 'archivo-csv') {
    const f = t.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => importarCSV(r.result);
    r.readAsText(f, 'UTF-8');
    t.value = '';
    return;
  }
  if (t.id === 'archivo-json') {
    const f = t.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { Datos.importar(r.result); repintar(); toast('Respaldo restaurado'); }
      catch (err) { toast('El archivo no es un respaldo válido'); }
    };
    r.readAsText(f);
    t.value = '';
  }
});
})(window);
