/* ============================================================
   ELECTRO FUTURO — extras.js
   Academia (cursos), política de datos y botón flotante del carrito.
   ============================================================ */

/* ---------- 1. ACADEMIA ---------- */
const EF_CURSOS = [
  {
    cod: 'CST',
    nivel: 'Básico e intermedio',
    nombre: 'Curso de Servicio Técnico',
    desc: 'Aprende a <strong>reparar equipos celulares desde cero</strong>, con práctica real sobre equipos del taller. Tú eliges el día de clase.',
    precio: '$1.000.000', antes: null,
    notaPrecio: 'Pago de contado o en cuotas sin interés.',
    datos: [
      ['📅', '<b>4 clases</b> a lo largo del mes'],
      ['🗓️', 'Tú eliges: <b>viernes, sábados o domingos</b>'],
      ['⏰', '8:00 a. m. – 1:00 p. m. · <b>20 horas</b> en total'],
      ['📍', 'Presencial en el <b>taller de Electro Futuro</b>'],
      ['👥', 'Cupo de <b>12 estudiantes</b> por grupo'],
      ['🏅', 'Certificado con <b>código verificable</b>']
    ],
    pensum: [
      { t: 'Desarme, armado y piezas', h: '5 horas',
        p: ['Desarme y armado de equipo celular', 'Reconocimiento de piezas', 'Herramientas del técnico'] },
      { t: 'Componentes y protocolos', h: '5 horas',
        p: ['Componentes externos e internos', 'Protocolo de encendido', 'Protocolo de carga',
            'Protocolo de imagen', 'Protocolo de radiofrecuencia'] },
      { t: 'Soldadura y reballing', h: '5 horas',
        p: ['Técnicas de soldadura', 'Reballing', 'Pines de carga'] },
      { t: 'Diagnóstico y reparación', h: '5 horas',
        p: ['Diagnóstico paso a paso', 'Reparaciones en general', 'Práctica con casos reales'] }
    ],
    wa: 'Hola 👋 quiero información del *CURSO DE SERVICIO TÉCNICO* ($1.000.000, 4 clases). ¿Cuándo abre el próximo grupo?'
  },
  {
    cod: 'CSB',
    nivel: 'Básico',
    nombre: 'Curso de Software Básico',
    desc: 'Programa intensivo de <strong>cinco clases seguidas</strong> enfocado en el <strong>software de equipos móviles</strong>.',
    precio: '$800.000', antes: '$1.000.000',
    notaPrecio: 'Precio especial. De contado o en cuotas sin interés.',
    datos: [
      ['📅', '<b>5 clases seguidas</b>, de lunes a viernes'],
      ['⏰', '8:00 a. m. – 12:00 m. · <b>20 horas</b> en total'],
      ['📍', 'Presencial en el <b>taller de Electro Futuro</b>'],
      ['👥', 'Cupo de <b>12 estudiantes</b> por grupo'],
      ['🏅', 'Certificado con <b>código verificable</b>']
    ],
    pensum: null,
    pendiente: 'El pénsum clase por clase se publica en los próximos días. Escríbenos y te lo enviamos apenas esté listo, junto con la fecha del próximo grupo.',
    wa: 'Hola 👋 quiero información del *CURSO DE SOFTWARE BÁSICO* ($800.000, 5 clases). ¿Cuándo abre el próximo grupo y cuál es el contenido?'
  }
];

function pintarCursos() {
  const grid = document.getElementById('efa-grid');
  if (!grid) return;
  const wa = (EF_CONFIG.WHATSAPP_ACADEMIA || EF_CONFIG.WHATSAPP);
  grid.innerHTML = EF_CURSOS.map((c, i) => {
    const pensum = c.pensum
      ? c.pensum.map((cl, n) => `
          <div class="efa-clase">
            <h4>Clase ${n + 1} · ${cl.t}</h4><small>${cl.h}</small>
            <ul>${cl.p.map(x => `<li>${x}</li>`).join('')}</ul>
          </div>`).join('')
      : `<p class="efa-pendiente">${c.pendiente}</p>`;
    return `
    <article class="efa-card">
      <div class="efa-card__top">
        <span class="efa-nivel">${c.nivel}</span>
        <h3>${c.nombre}</h3>
        <p class="efa-desc">${c.desc}</p>
        <div class="efa-precio"><span class="v">${c.precio}</span>
          ${c.antes ? `<span class="antes">${c.antes}</span>` : ''}</div>
        <p class="efa-nota-precio">${c.notaPrecio}</p>
        <ul class="efa-datos">
          ${c.datos.map(d => `<li><i>${d[0]}</i><div>${d[1]}</div></li>`).join('')}
        </ul>
      </div>
      <button class="efa-toggle" type="button" aria-expanded="false" aria-controls="efa-p${i}" data-efa="${i}">
        ${c.pensum ? 'Ver el pénsum clase por clase' : 'Ver el contenido'}<i>⌄</i>
      </button>
      <div class="efa-pensum" id="efa-p${i}">${pensum}</div>
      <div class="efa-card__foot">
        <a class="btn btn-primario" target="_blank" rel="noopener"
           href="https://wa.me/${wa}?text=${encodeURIComponent(c.wa)}">Pedir informes</a>
        <a class="btn btn-linea" target="_blank" rel="noopener"
           href="${EF_CONFIG.URL_VERIFICAR}">Verificar certificado</a>
      </div>
    </article>`;
  }).join('');
}

/* ---------- 2. POLÍTICA DE DATOS ---------- */
function efpAbrir(v) {
  const ov = document.getElementById('efp-overlay');
  if (!ov) return;
  ov.classList.toggle('abierto', v);
  document.body.style.overflow = v ? 'hidden' : '';
}

/* Prueba de autorización que se guarda junto con el pedido. */
window.EF_consentimiento = () => ({
  autoriza: true, version: '2026-09', fecha: new Date().toISOString()
});

/* ---------- 3. BOTÓN FLOTANTE DEL CARRITO ---------- */
function montarCarritoFlotante() {
  if (document.getElementById('carrito-flotante')) return;
  const b = document.createElement('button');
  b.id = 'carrito-flotante';
  b.className = 'carrito-flotante';
  b.type = 'button';
  b.setAttribute('aria-label', 'Ver mi pedido');
  b.innerHTML = '🛒<span class="n" id="contador-flotante" aria-live="polite">0</span>';
  document.body.appendChild(b);
}

/* ---------- 4. ENGANCHES ---------- */
document.addEventListener('DOMContentLoaded', () => {
  try { pintarCursos(); } catch (e) { console.error('Academia:', e); }
  try {
    montarCarritoFlotante();
    // app.js ya pintó el carrito antes de que existiera este botón:
    // se vuelve a pintar para que el contador arranque con lo guardado.
    if (typeof pintarPedido === 'function') pintarPedido();
  } catch (e) { console.error('Carrito flotante:', e); }

  document.addEventListener('click', e => {
    const tg = e.target.closest('[data-efa]');
    if (tg) {
      const panel = document.getElementById('efa-p' + tg.dataset.efa);
      const abierto = panel.classList.toggle('abierto');
      tg.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      return;
    }
    if (e.target.closest('[data-efp-abrir]')) { e.preventDefault(); return efpAbrir(true); }
    if (e.target.closest('[data-efp-cerrar]') || e.target.id === 'efp-overlay') return efpAbrir(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('efp-overlay')?.classList.contains('abierto')) {
      efpAbrir(false);
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'c-datos') e.target.closest('.efp-check')?.classList.remove('error');
  });
});

/* ============================================================
   5. BARRA DE PÍLDORAS
   Marca la sección en la que estás, centra la píldora activa y deja
   arrastrar el carril con el ratón además de deslizarlo con el dedo.
   ============================================================ */
(function () {
  const carril = document.getElementById('nav-pills');
  if (!carril) return;
  const pills = [...carril.querySelectorAll('.pill-nav')];
  const puntos = [...document.querySelectorAll('.nav-puntos .punto')];
  let actual = '';

  function marcar(id, centrar) {
    if (id === actual) return;
    actual = id;
    pills.forEach(p => p.classList.toggle('activa', p.dataset.sec === id));
    puntos.forEach(p => p.classList.toggle('activo', p.dataset.punto === id));
    const viva = pills.find(p => p.dataset.sec === id);
    if (centrar !== false && viva && carril.scrollWidth > carril.clientWidth) {
      viva.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
    }
  }

  /* Qué sección está en pantalla */
  const secciones = pills.map(p => document.getElementById(p.dataset.sec)).filter(Boolean);
  if ('IntersectionObserver' in window && secciones.length) {
    const vistas = new Map();
    const io = new IntersectionObserver(es => {
      es.forEach(e => vistas.set(e.target.id, e.intersectionRatio));
      let mejor = '', r = 0;
      vistas.forEach((v, k) => { if (v > r) { r = v; mejor = k; } });
      if (mejor && r > 0.02) marcar(mejor);
    }, { threshold:[0, .02, .15, .4, .75], rootMargin:'-140px 0px -45% 0px' });
    secciones.forEach(s => io.observe(s));
  }
  pills.forEach(p => p.addEventListener('click', () => marcar(p.dataset.sec)));
  /* Arranque: siempre hay una píldora y un punto marcados */
  if (pills.length) marcar(pills[0].dataset.sec, false);

  /* Arrastre con el ratón */
  let arrastra = false, x0 = 0, s0 = 0, movido = 0;
  carril.addEventListener('mousedown', e => {
    arrastra = true; movido = 0;
    x0 = e.pageX; s0 = carril.scrollLeft;
    carril.classList.add('arrastrando');
  });
  ['mouseup','mouseleave'].forEach(ev => carril.addEventListener(ev, () => {
    arrastra = false; carril.classList.remove('arrastrando');
  }));
  carril.addEventListener('mousemove', e => {
    if (!arrastra) return;
    const d = e.pageX - x0;
    movido = Math.abs(d);
    if (movido > 4) e.preventDefault();
    carril.scrollLeft = s0 - d;
  });
  /* Si venía arrastrando, el clic no debe navegar */
  carril.addEventListener('click', e => { if (movido > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
})();
