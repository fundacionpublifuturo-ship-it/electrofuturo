/* ============================================================
   ELECTRO FUTURO — admin-ui.js
   Piezas compartidas por el portal administrativo y el de clientes:
   iconos, formato, tablas, los cuatro estados, panel lateral, toast
   y gráficas SVG dibujadas a mano.
   ============================================================ */
(function (global) {
'use strict';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ---------- formato ---------- */
const money = n => (n == null || n === '' || isNaN(n)) ? '—'
  : '$' + Math.round(Number(n)).toLocaleString('es-CO');
const miles = n => Number(n || 0).toLocaleString('es-CO');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const fecha = f => f ? new Date(f).toLocaleDateString('es-CO',
  { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fechaHora = f => f ? new Date(f).toLocaleString('es-CO',
  { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
const diasDe = f => f ? Math.floor((Date.now() - new Date(f)) / 864e5) : 0;
const digitos = s => String(s || '').replace(/\D/g, '');

/* ---------- iconos: un solo set, trazo 2px ---------- */
const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  inicio:     P('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
  pipeline:   P('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>'),
  lineas:     P('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),
  clientes:   P('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16.5 7.2a3 3 0 0 1 0 5.6"/><path d="M18 20c0-2.3-.9-4-2.3-5"/>'),
  inventario: P('<path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z"/><path d="M3 8.5 12 13l9-4.5M12 13v7"/>'),
  bodega:     P('<path d="M3 21V9l9-5 9 5v12"/><path d="M9 21v-6h6v6"/><path d="M3 13h18"/>'),
  compras:    P('<path d="M3 4h2l2.2 11.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L20.5 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>'),
  cartera:    P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>'),
  finanzas:   P('<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7.5 14.5 3.5-4 3 2.5 4.5-6"/>'),
  garantias:  P('<path d="M12 3 5 6v5.5c0 4.3 3 8.2 7 9.5 4-1.3 7-5.2 7-9.5V6z"/><path d="m9.3 12 1.9 1.9 3.6-3.7"/>'),
  alertas:    P('<path d="M12 4a6 6 0 0 0-6 6c0 4-1.5 5.5-1.5 5.5h15S18 14 18 10a6 6 0 0 0-6-6z"/><path d="M10.3 19a2 2 0 0 0 3.4 0"/>'),
  ajustes:    P('<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z"/>'),
  buscar:     P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  mas:        P('<path d="M12 5v14M5 12h14"/>'),
  wa:         P('<path d="M20 12a8 8 0 0 1-11.9 7L4 20l1.1-3.9A8 8 0 1 1 20 12z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5"/>'),
  flecha:     P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  descarga:   P('<path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M5 20h14"/>'),
  imprimir:   P('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/>'),
  caja:       P('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  vacio:      P('<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5"/><path d="M12 13v7"/>'),
  salir:      P('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  tienda:     P('<path d="M4 9h16l-1 11H5z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>'),
  plegar:     P('<path d="M15 6l-6 6 6 6"/>'),
  ubicacion:  P('<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>')
};
const ic = (n, cls) => `<span class="ic ${cls || ''}" aria-hidden="true">${IC[n] || ''}</span>`;

/* ---------- tabla ---------- */
/* cab: ['Texto'] o {t, num, w}. filas: [[celdas]] con <td> ya armados. */
function tabla(cab, filas, apila) {
  const th = cab.map(c => typeof c === 'string'
    ? `<th>${c}</th>` : `<th class="${c.num ? 'num' : ''}">${c.t}</th>`).join('');
  return `<div class="tabla-cont"><table class="${apila === false ? '' : 'apila'}">
    <thead><tr>${th}</tr></thead><tbody>${filas.map(f => `<tr>${f.join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}
/* data-label alimenta la versión apilada en móvil */
const td = (etiqueta, contenido, clase) =>
  `<td data-label="${esc(etiqueta)}" class="${clase || ''}">${contenido}</td>`;

/* ---------- los cuatro estados ---------- */
const cargando = (filas = 5) =>
  `<div class="esqueleto">${Array.from({ length: filas },
    (_, i) => `<div class="esq" style="width:${[100, 82, 91, 74, 88][i % 5]}%"></div>`).join('')}</div>`;

const vacio = (titulo, texto, accionHtml) =>
  `<div class="vacio-est">${IC.vacio}<h4>${esc(titulo)}</h4><p>${texto}</p>${accionHtml || ''}</div>`;

const errorEst = (texto, reintentar) =>
  `<div class="error-est"><h4>Algo falló</h4><p>${esc(texto)}</p>
   ${reintentar ? `<button class="btn btn-l" data-reintentar="${reintentar}">Reintentar</button>` : ''}</div>`;

/* ---------- píldoras ---------- */
function pillEtapa(k) {
  const c = { cotizacion:'gris', confirmado:'azul', separado:'cian', alistamiento:'ambar',
              listo:'cian', despachado:'azul', entregado:'verde',
              anulado:'rojo', devuelto:'rojo' }[k] || 'gris';
  const t = (Datos.ETAPA[k] || {}).t || k;
  return `<span class="pill ${c}">${t}</span>`;
}
function chipLinea(cod) {
  const l = Datos.LINEA[cod] || Datos.LINEA.ACC;
  return `<span class="chip-linea" style="background:${l.color}" title="${esc(l.nombre)}">${l.cod}</span>`;
}
/* Semáforo por días sin movimiento */
const semaforo = d => `<span class="semaforo ${d <= 1 ? 'v' : d <= 3 ? 'a' : 'r'}"></span>`;

/* ---------- toast ---------- */
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('visible'), 2800);
}

/* ---------- panel lateral ---------- */
function abrirPanel(titulo, sub, cuerpo, pie) {
  $('#panel-titulo').textContent = titulo;
  $('#panel-sub').textContent = sub || '';
  $('#panel-cuerpo').innerHTML = cuerpo;
  $('#panel-pie').innerHTML = pie || '';
  $('#panel-cuerpo').scrollTop = 0;
  $('#panel').classList.add('abierto');
  $('#velo').classList.add('abierto');
  document.body.style.overflow = 'hidden';
}
function cerrarPanel() {
  $('#panel').classList.remove('abierto');
  $('#velo').classList.remove('abierto');
  document.body.style.overflow = '';
}

/* ---------- WhatsApp ---------- */
const waHref = (tel, texto) =>
  'https://wa.me/' + (digitos(tel) ? (digitos(tel).length <= 10 ? '57' : '') + digitos(tel)
                                   : (global.EF_CONFIG && EF_CONFIG.WHATSAPP) || '573134135751')
  + '?text=' + encodeURIComponent(texto || '');

/* ============================================================
   GRÁFICAS SVG — dibujadas a mano, sin librerías
   ============================================================ */
function barras(datos, opciones) {
  const o = Object.assign({ alto:170, color:'var(--cyan-600)', formato: money }, opciones);
  if (!datos.length) return vacio('Sin datos', 'Todavía no hay movimientos para graficar.');
  /* Coordenadas reales, no porcentajes estirados: con preserveAspectRatio="none"
     el texto de los rótulos se deforma y queda ilegible. */
  const W = 640, H = 180, base = H - 26, techo = 14;
  const max = Math.max(...datos.map(d => d.v), 1);
  const paso = W / datos.length;
  const bw = Math.min(paso * .62, 54);
  const cuerpo = datos.map((d, i) => {
    const h = Math.max((d.v / max) * (base - techo), 1.5);
    const x = i * paso + (paso - bw) / 2;
    return `<rect class="barra" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}"
              height="${h.toFixed(1)}" rx="3" fill="${d.color || o.color}">
              <title>${esc(d.t)}: ${o.formato(d.v)}</title></rect>
            <text class="rot" x="${(i * paso + paso / 2).toFixed(1)}" y="${base + 15}"
              text-anchor="middle">${esc(d.t)}</text>`;
  }).join('');
  return `<svg class="grafica" viewBox="0 0 ${W} ${H}" style="height:${o.alto}px"
            role="img" aria-label="Gráfica de barras">
    <line class="eje" x1="0" y1="${base}" x2="${W}" y2="${base}"/>${cuerpo}</svg>`;
}

function dona(partes, opciones) {
  const o = Object.assign({ tam:150 }, opciones);
  const total = partes.reduce((a, p) => a + p.v, 0);
  if (!total) return vacio('Sin datos', 'Aún no hay con qué calcular la distribución.');
  const R = 42, C = 2 * Math.PI * R;
  let off = 0;
  const anillos = partes.map(p => {
    const frac = p.v / total;
    const s = `<circle r="${R}" cx="50" cy="50" fill="none" stroke="${p.color}" stroke-width="14"
      stroke-dasharray="${(frac * C).toFixed(2)} ${C}" stroke-dashoffset="${(-off * C).toFixed(2)}"
      transform="rotate(-90 50 50)"><title>${esc(p.t)}: ${Math.round(frac * 100)} %</title></circle>`;
    off += frac;
    return s;
  }).join('');
  return `<div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
    <svg viewBox="0 0 100 100" style="width:${o.tam}px;height:${o.tam}px;flex:0 0 auto" role="img">
      ${anillos}</svg>
    <div style="flex:1;min-width:150px">${partes.map(p => `
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px;font-size:.8rem">
        <span style="width:10px;height:10px;border-radius:3px;background:${p.color};flex:0 0 10px"></span>
        <span style="flex:1">${esc(p.t)}</span>
        <b class="num">${o.formato ? o.formato(p.v) : miles(p.v)}</b>
      </div>`).join('')}</div></div>`;
}

function sparkline(valores, color) {
  if (!valores.length) return '';
  const max = Math.max(...valores, 1), min = Math.min(...valores, 0);
  const rango = max - min || 1;
  const pts = valores.map((v, i) =>
    `${(i / (valores.length - 1 || 1) * 100).toFixed(1)},${(30 - (v - min) / rango * 26).toFixed(1)}`).join(' ');
  return `<svg class="grafica" viewBox="0 0 100 32" preserveAspectRatio="none" style="height:34px">
    <polyline points="${pts}" fill="none" stroke="${color || 'var(--cyan-600)'}" stroke-width="2"
      vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/* ---------- aparición escalonada ---------- */
let io = null;
function animarEntrada(cont) {
  if (!('IntersectionObserver' in global)) return;
  if (!io) {
    io = new IntersectionObserver(es => es.forEach((e, i) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('visible'), Math.min(i, 6) * 60);
      io.unobserve(e.target);
    }), { threshold: .08, rootMargin: '0px 0px -30px 0px' });
  }
  $$('.aparece:not(.visible)', cont || document).forEach(el => io.observe(el));
}

/* ---------- descargas ---------- */
function descargar(nombre, contenido, tipo) {
  const b = new Blob([contenido], { type: tipo || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function aCSV(cab, filas) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '\uFEFF' + [cab.map(q).join(';'), ...filas.map(f => f.map(q).join(';'))].join('\n');
}

global.UI = { $, $$, money, miles, esc, fecha, fechaHora, diasDe, digitos, IC, ic, tabla, td,
  cargando, vacio, errorEst, pillEtapa, chipLinea, semaforo, toast, abrirPanel, cerrarPanel,
  waHref, barras, dona, sparkline, animarEntrada, descargar, aCSV };
})(window);
