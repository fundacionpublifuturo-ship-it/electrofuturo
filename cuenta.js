/* ============================================================
   ELECTRO FUTURO — cuenta.js
   Portal de clientes: seguimiento de pedidos, garantías y datos.
   ============================================================ */
(function () {
'use strict';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const money = n => n == null ? '—' : '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const fecha = f => f ? new Date(f).toLocaleDateString('es-CO',
  { day:'2-digit', month:'long', year:'numeric' }) : '—';
const fechaHora = f => f ? new Date(f).toLocaleString('es-CO',
  { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
const soloDigitos = s => String(s || '').replace(/\D/g, '');

function aviso(msg) {
  const a = $('#aviso-flotante');
  a.textContent = msg;
  a.classList.add('visible');
  clearTimeout(a._t);
  a._t = setTimeout(() => a.classList.remove('visible'), 2800);
}

const WA = (EF_CONFIG && EF_CONFIG.WHATSAPP) || '573134135751';
const waLink = txt => `https://wa.me/${WA}?text=${encodeURIComponent(txt)}`;

let CAT = [];
const porSku = {};
let CLIENTE = null;

/* Los cuatro pasos que ve el cliente. Los estados internos del portal
   administrativo se agrupan aquí, porque "alistando" y "pago verificado"
   al cliente le dicen lo mismo: ya vamos. */
const RUTA = {
  recoger: [
    { k:'recibido',  t:'Pedido recibido',      estados:['cotizacion','confirmado'] },
    { k:'separado',  t:'Stock separado',       estados:['separado'] },
    { k:'alistando', t:'Preparando tu pedido', estados:['alistamiento'] },
    { k:'listo',     t:'Listo para recoger',   estados:['listo'] },
    { k:'entregado', t:'Entregado',            estados:['entregado'] }
  ],
  envio: [
    { k:'recibido',   t:'Pedido recibido',      estados:['cotizacion','confirmado'] },
    { k:'separado',   t:'Stock separado',       estados:['separado'] },
    { k:'alistando',  t:'Preparando tu pedido', estados:['alistamiento'] },
    { k:'despachado', t:'Despachado',           estados:['despachado','listo'] },
    { k:'entregado',  t:'Entregado',            estados:['entregado'] }
  ]
};

const ETIQUETA = {
  cotizacion:'Cotización', confirmado:'Recibido', separado:'Separado',
  alistamiento:'Preparando', listo:'Listo para recoger', despachado:'En camino',
  entregado:'Entregado', anulado:'Anulado', devuelto:'Devuelto'
};

const pill = e => {
  const c = { entregado:'verde', anulado:'rojo', devuelto:'rojo',
    listo:'cian', despachado:'cian', confirmado:'azul', separado:'cian',
    alistamiento:'ambar' }[e] || 'gris';
  return `<span class="pill ${c}">${ETIQUETA[e] || e}</span>`;
};

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
  } catch (e) { console.error('Catálogo:', e); }
}

/* ------------------------------------------------------------ SESIÓN */
function entrar(cliente) {
  CLIENTE = cliente;
  sessionStorage.setItem('ef_cliente', cliente.id);
  $('#acceso').style.display = 'none';
  $('#cuenta').style.display = '';
  $('#c-saludo').textContent = cliente.nombre;
  pintarTodo();
}

/* ------------------------------------------------------------ PINTADO */
function pintarTodo() {
  pintarCifras();
  pintarPedidos();
  pintarGarantias();
  pintarDatos();
}

function pintarCifras() {
  const ped = Datos.pedidosDeCliente(CLIENTE.id).filter(p => p.estado !== 'anulado');
  const abiertos = ped.filter(p => p.estado !== 'entregado');
  const deuda = Datos.cartera()
    .filter(c => c.clienteId === CLIENTE.id && c.estado !== 'pagada' && c.estado !== 'anulada')
    .reduce((a, c) => a + (c.monto - c.abonado), 0);
  const cifras = [
    ['Pedidos en curso', abiertos.length, abiertos.length ? 'Puedes seguirlos abajo' : 'Nada pendiente', abiertos.length ? '' : 'ok'],
    ['Pedidos totales', ped.length, money(ped.reduce((a, p) => a + p.total, 0)) + ' en compras', ''],
    ['Tipo de cuenta', CLIENTE.tipo === 'mayorista' ? 'Mayorista' : CLIENTE.tipo === 'estudiante' ? 'Estudiante' : 'Minorista',
      CLIENTE.tipo === 'minorista' ? 'Compra 5 unidades y bajas el precio' : 'Tienes precio preferencial', 'ok']
  ];
  if (deuda > 0) cifras.push(['Saldo pendiente', money(deuda), 'Escríbenos para coordinar el pago', 'alerta']);
  $('#c-cifras').innerHTML = cifras.map(([t, v, s, cl]) =>
    `<div class="cifra ${cl}"><span>${t}</span><b>${v}</b><small>${s}</small></div>`).join('');
}

function pintarPedidos() {
  const l = Datos.pedidosDeCliente(CLIENTE.id);
  $('#lista-pedidos').innerHTML = l.length ? l.map(p => `
    <div class="pedido-fila">
      <div>
        <b>${p.codigo}</b> ${pill(p.estado)}
        <div class="meta">${fecha(p.creado)} · ${p.items.length} producto${p.items.length === 1 ? '' : 's'}
          · ${p.entrega === 'recoger' ? 'Recoges en el local' : 'Envío'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <b>${money(p.total)}</b>
        <button class="btn btn-l btn-x" data-pedido="${p.codigo}">Ver</button>
      </div>
    </div>`).join('')
    : `<div class="vacio-est"><h4>Todavía no tienes pedidos</h4>
       <p>Cuando hagas el primero aparecerá aquí con su seguimiento.</p>
       <a class="btn btn-p" href="index.html#catalogo">Ver el catálogo</a></div>`;
}

function pintarGarantias() {
  const l = Datos.garantias().filter(g => g.clienteId === CLIENTE.id);
  $('#lista-garantias').innerHTML = l.length ? l.map(g => `
    <div class="pedido-fila">
      <div>
        <b>${g.id}</b> <span class="pill ${g.estado === 'resuelta' ? 'verde' : g.estado === 'rechazada' ? 'rojo' : 'ambar'}">${g.estado.replace('_', ' ')}</span>
        <div class="meta">${fecha(g.creado)} · ${esc((porSku[g.sku] && porSku[g.sku].nombre) || g.sku)}</div>
        ${g.nota ? `<div class="meta" style="margin-top:4px">Respuesta: ${esc(g.nota)}</div>` : ''}
      </div>
    </div>`).join('')
    : `<div class="vacio-est"><h4>Sin garantías radicadas</h4>
       <p>Si un producto te salió con falla, radícala aquí y le hacemos seguimiento.</p></div>`;
}

function pintarDatos() {
  $('#d-nombre').value = CLIENTE.nombre || '';
  $('#d-tel').value = CLIENTE.telefono || '';
  $('#d-correo').value = CLIENTE.correo || '';
  $('#d-ciudad').value = CLIENTE.ciudad || '';
  $('#d-doc').value = CLIENTE.documento || '';
  $('#d-dir').value = CLIENTE.direccion || '';
  $('#d-consent').textContent = CLIENTE.autoriza_datos
    ? `Autorizaste el tratamiento de tus datos el ${fecha(CLIENTE.autoriza_fecha)}. Puedes revocarlo cuando quieras.`
    : 'No tenemos registrada una autorización tuya. La pedimos al confirmar el próximo pedido.';
  $('#d-baja').href = waLink(
    `Hola, soy ${CLIENTE.nombre} (${CLIENTE.telefono}). Quiero solicitar la *eliminación de mis datos personales* de la base de Electro Futuro.`);
}

/* ------------------------------------------------------------ PANEL */
function abrirPanel(t, s, cuerpo, pie) {
  $('#panel-titulo').textContent = t;
  $('#panel-sub').textContent = s || '';
  $('#panel-cuerpo').innerHTML = cuerpo;
  $('#panel-pie').innerHTML = pie || '';
  $('#panel').classList.add('abierto');
  $('#velo').classList.add('abierto');
}
function cerrarPanel() {
  $('#panel').classList.remove('abierto');
  $('#velo').classList.remove('abierto');
}

function panelPedido(codigo, soloLectura) {
  const p = Datos.pedido(codigo);
  if (!p) return aviso('No encontramos ese pedido');

  const ruta = RUTA[p.entrega] || RUTA.recoger;
  const alcanzado = {};
  p.eventos.forEach(e => ruta.forEach((paso, n) => {
    if (paso.estados.includes(e.estado)) {
      alcanzado[paso.k] = e.fecha;
      for (let i = 0; i < n; i++) alcanzado[ruta[i].k] = alcanzado[ruta[i].k] || e.fecha;
    }
  }));

  const linea = p.estado === 'anulado'
    ? '<li class="hecho"><b>Pedido anulado</b><em>Escríbenos si fue un error.</em></li>'
    : ruta.map(paso => `
      <li class="${alcanzado[paso.k] ? 'hecho' : ''}">
        <b style="${alcanzado[paso.k] ? '' : 'color:var(--gris-suave)'}">${paso.t}</b>
        ${alcanzado[paso.k] ? `<small>${fechaHora(alcanzado[paso.k])}</small>` : ''}
      </li>`).join('');

  const items = p.items.map(i => {
    const prod = porSku[i.sku];
    return `<tr>
      <td style="width:52px">${prod && prod.imagen
        ? `<img src="${prod.imagen}" alt="" style="width:40px;height:40px;object-fit:contain">`
        : `<span class="pill gris">${i.sku.split('-')[1] || ''}</span>`}</td>
      <td>${esc(i.nombre)}<br><small style="color:var(--gris);font-family:var(--mono)">${i.sku}</small></td>
      <td class="num">${i.qty}</td>
      <td class="num">${money(i.precio * i.qty)}</td></tr>`;
  }).join('');

  const guia = p.guia
    ? `<dt>Guía</dt><dd>${esc(p.transportadora || 'Transportadora')} · <b>${esc(p.guia)}</b></dd>` : '';

  const cuerpo = `
    <div class="aviso info" style="margin-bottom:20px">
      <b>${ETIQUETA[p.estado] || p.estado}.</b>
      ${p.estado === 'listo' ? 'Puedes pasar por el local: Cra. 6 #18-49, Local 3.'
        : p.estado === 'despachado' ? 'Va en camino con la transportadora.'
        : p.estado === 'entregado' ? '¡Gracias por tu compra!'
        : 'Te avisamos por WhatsApp en cada cambio.'}
    </div>
    <ul class="linea-tiempo" style="margin-bottom:24px">${linea}</ul>
    <div class="tabla-cont" style="border:1px solid var(--linea);border-radius:12px;overflow:hidden;margin-bottom:18px">
      <table><tbody>${items}</tbody></table>
    </div>
    <dl class="dl">
      <dt>Subtotal</dt><dd>${money(p.subtotal)}</dd>
      ${p.descuento ? `<dt>Descuento por volumen</dt><dd>− ${money(p.descuento)}</dd>` : ''}
      ${p.envio ? `<dt>Envío</dt><dd>${money(p.envio)}</dd>` : ''}
      <dt><b>Total</b></dt><dd><b>${money(p.total)}</b></dd>
      <dt>Pago</dt><dd>${p.pagado ? 'Confirmado' : 'Pendiente'}</dd>
      <dt>Entrega</dt><dd>${p.entrega === 'recoger' ? 'Recoges en el local' : esc(p.cliente.direccion || 'Envío')}</dd>
      ${guia}
    </dl>`;

  const pie = soloLectura
    ? `<a class="btn btn-p" target="_blank" rel="noopener" href="${waLink('Hola, quiero preguntar por mi pedido *' + p.codigo + '*.')}">Escribir por WhatsApp</a>`
    : `<button class="btn btn-p" data-repetir="${p.codigo}">Repetir este pedido</button>
       <a class="btn btn-l" target="_blank" rel="noopener" href="${waLink('Hola, quiero preguntar por mi pedido *' + p.codigo + '*.')}">Escribir por WhatsApp</a>
       ${p.estado === 'entregado' ? `<button class="btn btn-l" data-garantia-de="${p.codigo}">Radicar garantía</button>` : ''}`;

  abrirPanel('Pedido ' + p.codigo, fecha(p.creado), cuerpo, pie);
}

function panelGarantia(codigo) {
  const pedidos = Datos.pedidosDeCliente(CLIENTE.id).filter(p => p.estado === 'entregado');
  if (!pedidos.length) return aviso('Solo puedes radicar garantía sobre pedidos entregados');
  const elegido = codigo || pedidos[0].codigo;
  const opcionesPed = pedidos.map(p =>
    `<option value="${p.codigo}" ${p.codigo === elegido ? 'selected' : ''}>${p.codigo} · ${fecha(p.creado)}</option>`).join('');
  const p = Datos.pedido(elegido);
  const opcionesSku = p.items.map(i =>
    `<option value="${i.sku}">${esc(i.nombre)}</option>`).join('');

  abrirPanel('Radicar garantía', 'Te respondemos en máximo 3 días hábiles', `
    <div class="campo"><label>Pedido</label><select id="g-pedido">${opcionesPed}</select></div>
    <div class="campo"><label>Producto</label><select id="g-sku">${opcionesSku}</select></div>
    <div class="campo"><label>¿Qué le pasa?</label>
      <textarea id="g-motivo" rows="4" placeholder="Ej.: la pantalla dejó de responder al táctil a los 8 días"></textarea>
      <small>Sé concreto: cuándo empezó, qué equipo es y qué hiciste antes de la falla.</small></div>`,
    '<button class="btn btn-p" id="guardar-garantia">Radicar</button>');
}

/* Repite el pedido: deja los productos en el carrito de la tienda. */
function repetir(codigo) {
  const p = Datos.pedido(codigo);
  if (!p) return;
  const carrito = p.items.map(i => ({ sku: i.sku, nombre: i.nombre, precio: i.precio, qty: i.qty }));
  try {
    localStorage.setItem('ef_pedido', JSON.stringify(carrito));
    location.href = 'index.html#catalogo';
  } catch (e) { aviso('No se pudo cargar el carrito'); }
}

/* ------------------------------------------------------------ EVENTOS */
document.addEventListener('DOMContentLoaded', async () => {
  await cargarCatalogo();
  $('#wa-ayuda').href = waLink('Hola, quiero acceder a mi cuenta en la página de Electro Futuro.');

  const guardado = sessionStorage.getItem('ef_cliente');
  if (guardado) {
    const c = Datos.cliente(guardado);
    if (c) entrar(c);
  }

  $('#entrar').addEventListener('click', () => {
    const tel = soloDigitos($('#tel').value);
    const err = $('#acceso-error');
    if (tel.length < 7) {
      err.textContent = 'Escribe tu número completo.';
      return err.classList.add('visible');
    }
    const c = Datos.clientePorTelefono(tel);
    if (!c) {
      err.innerHTML = 'No encontramos ese número. Si compraste con otro, pruébalo, o escríbenos por WhatsApp.';
      return err.classList.add('visible');
    }
    err.classList.remove('visible');
    entrar(c);
  });

  $('#rastrear').addEventListener('click', () => {
    const cod = $('#codigo').value.trim().toUpperCase();
    const err = $('#acceso-error');
    if (!cod) { err.textContent = 'Escribe el código del pedido.'; return err.classList.add('visible'); }
    const p = Datos.pedido(cod);
    if (!p) { err.textContent = 'No encontramos ese pedido.'; return err.classList.add('visible'); }
    err.classList.remove('visible');
    panelPedido(cod, true);
  });

  ['tel', 'codigo'].forEach(id => $('#' + id).addEventListener('keydown', e => {
    if (e.key === 'Enter') $(id === 'tel' ? '#entrar' : '#rastrear').click();
  }));

  $('#salir').addEventListener('click', () => {
    sessionStorage.removeItem('ef_cliente');
    location.reload();
  });

  $('#panel-cerrar').addEventListener('click', cerrarPanel);
  $('#velo').addEventListener('click', cerrarPanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarPanel(); });

  document.addEventListener('click', e => {
    const t = e.target;

    const tab = t.closest('[data-tab]');
    if (tab) {
      $$('.pestanas button').forEach(b => b.classList.toggle('activo', b === tab));
      $$('.vista').forEach(v => v.classList.toggle('activa', v.id === 't-' + tab.dataset.tab));
      return;
    }
    const ver = t.closest('[data-pedido]');
    if (ver) return panelPedido(ver.dataset.pedido, !CLIENTE);

    const rep = t.closest('[data-repetir]');
    if (rep) return repetir(rep.dataset.repetir);

    if (t.closest('#nueva-garantia')) return panelGarantia(null);
    const gd = t.closest('[data-garantia-de]');
    if (gd) return panelGarantia(gd.dataset.garantiaDe);

    if (t.closest('#guardar-garantia')) {
      const motivo = $('#g-motivo').value.trim();
      if (motivo.length < 10) return aviso('Cuéntanos con un poco más de detalle qué pasó');
      Datos.radicarGarantia({
        clienteId: CLIENTE.id, cliente: CLIENTE.nombre,
        pedido: $('#g-pedido').value, sku: $('#g-sku').value, motivo
      }, CLIENTE.nombre);
      cerrarPanel(); pintarGarantias();
      return aviso('Garantía radicada. Te respondemos por WhatsApp.');
    }

    if (t.closest('#guardar-datos')) {
      const nombre = $('#d-nombre').value.trim();
      if (!nombre) return aviso('El nombre no puede quedar vacío');
      CLIENTE = Datos.guardarCliente({
        id: CLIENTE.id, nombre,
        telefono: CLIENTE.telefono,
        correo: $('#d-correo').value.trim(),
        ciudad: $('#d-ciudad').value.trim(),
        documento: $('#d-doc').value.trim(),
        direccion: $('#d-dir').value.trim()
      }, nombre);
      pintarDatos();
      return aviso('Datos actualizados');
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id !== 'g-pedido') return;
    const p = Datos.pedido(e.target.value);
    $('#g-sku').innerHTML = p.items.map(i =>
      `<option value="${i.sku}">${esc(i.nombre)}</option>`).join('');
  });
});
})();
