/* Asesor IA de Electro Futuro — widget independiente.
   Se carga con: <script src="assets/js/asistente-ia.js?v=11" defer></script> antes de </body>.
   No depende de app.js. Usa /api/asistente (Claude) y, si no hay conexión o clave,
   responde buscando en window.EF_PRODUCTOS para que el chat nunca quede mudo. */
(function () {
  'use strict';
  if (window.__efAsesor) return; window.__efAsesor = true;

  var API = '/api/asistente';
  var WA = '573134135751';
  var CLAVE = 'ef_asesor_chat_v1';
  var SECCION_TEXTO = {
    'catalogo': ['catalogo', 'ver catalogo', 'tienda'],
    'cotizar': ['cotizar', 'cotizacion'],
    'linea-tecnica': ['linea tecnica', 'repuestos'],
    'cursos': ['cursos', 'academy', 'academia'],
    'lista-precios': ['lista de precios', 'precios'],
    'preguntas': ['preguntas', 'preguntas frecuentes', 'faq'],
    'ubicacion': ['ubicacion', 'donde estamos', 'contacto']
  };
  var SUGERENCIAS = ['Cargador rápido para iPhone', 'Power bank de 20.000 mAh', 'Pantalla para Redmi 13C', 'Curso de servicio técnico'];

  var css = [
    '.efa-root{--efa-tinta:#1B2126;--efa-cian:#19C1D6;--efa-cian-p:#0E93A5;--efa-gris:#5B6770;--efa-linea:#E3E8EB;--efa-fondo:#F6F8F9;--efa-blanco:#fff;font-family:Inter,Poppins,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--efa-tinta)}',
    '.efa-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;height:56px;padding:0 20px 0 16px;border:0;border-radius:28px;display:flex;align-items:center;gap:10px;cursor:pointer;color:#fff;font:600 15px/1 Poppins,Inter,system-ui,sans-serif;background:linear-gradient(135deg,var(--efa-cian),var(--efa-cian-p));box-shadow:0 10px 28px rgba(14,147,165,.35);transition:transform .2s,box-shadow .2s}',
    '.efa-fab:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(14,147,165,.45)}',
    '.efa-fab:focus-visible,.efa-root button:focus-visible,.efa-root textarea:focus-visible{outline:3px solid var(--efa-tinta);outline-offset:2px}',
    '.efa-fab svg{width:24px;height:24px;flex:none}',
    '.efa-fab .efa-punto{width:8px;height:8px;border-radius:50%;background:#7CFFB2;box-shadow:0 0 0 3px rgba(124,255,178,.3)}',
    '.efa-panel{position:fixed;right:20px;bottom:20px;z-index:2147483001;width:392px;max-width:calc(100vw - 24px);height:min(640px,calc(100vh - 40px));display:flex;flex-direction:column;background:var(--efa-blanco);border-radius:22px;box-shadow:0 24px 60px rgba(27,33,38,.28);overflow:hidden;opacity:0;transform:translateY(16px) scale(.98);pointer-events:none;transition:opacity .22s,transform .22s}',
    '.efa-root.abierto .efa-panel{opacity:1;transform:none;pointer-events:auto}',
    '.efa-root.abierto .efa-fab{opacity:0;pointer-events:none}',
    '.efa-cab{padding:16px 16px 14px 18px;display:flex;align-items:center;gap:12px;background:var(--efa-tinta);color:#fff}',
    '.efa-av{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,var(--efa-cian),var(--efa-cian-p));flex:none}',
    '.efa-av svg{width:22px;height:22px}',
    '.efa-cab h2{margin:0;font:600 16px/1.2 Poppins,Inter,sans-serif;color:#fff}',
    '.efa-cab p{margin:3px 0 0;font-size:12.5px;color:#B9C4CB}',
    '.efa-cerrar{margin-left:auto;width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;display:grid;place-items:center}',
    '.efa-cerrar:hover{background:rgba(255,255,255,.16)}',
    '.efa-msgs{flex:1;overflow-y:auto;padding:18px 16px 8px;background:var(--efa-fondo);display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain}',
    '.efa-m{max-width:88%;padding:11px 14px;border-radius:16px;font-size:14.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}',
    '.efa-m.bot{align-self:flex-start;background:#fff;border:1px solid var(--efa-linea);border-bottom-left-radius:6px}',
    '.efa-m.yo{align-self:flex-end;background:var(--efa-tinta);color:#fff;border-bottom-right-radius:6px}',
    '.efa-acc{align-self:flex-start;display:flex;flex-wrap:wrap;gap:8px;max-width:100%;margin-top:-2px}',
    '.efa-btn{position:relative;border:0;cursor:pointer;color:#fff;padding:10px 14px;border-radius:12px;font:600 13.5px/1.2 Poppins,Inter,sans-serif;text-align:left;display:inline-flex;align-items:center;gap:8px;',
    'background:linear-gradient(110deg,var(--efa-cian-p) 0%,var(--efa-cian) 35%,#5FDCEB 50%,var(--efa-cian) 65%,var(--efa-cian-p) 100%);background-size:250% 100%;animation:efa-brillo 4s linear infinite;box-shadow:0 6px 16px rgba(14,147,165,.28);transition:transform .15s,box-shadow .15s}',
    '.efa-btn:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(14,147,165,.38)}',
    '.efa-btn.wa{background:linear-gradient(110deg,#128C7E 0%,#25D366 40%,#5BE38E 50%,#25D366 60%,#128C7E 100%);background-size:250% 100%;box-shadow:0 6px 16px rgba(18,140,126,.28)}',
    '.efa-btn small{font-weight:500;opacity:.9;font-size:12px;padding:2px 7px;border-radius:8px;background:rgba(255,255,255,.18)}',
    '.efa-btn svg{width:16px;height:16px;flex:none}',
    '@keyframes efa-brillo{0%{background-position:100% 0}100%{background-position:-150% 0}}',
    '.efa-sug{display:flex;flex-wrap:wrap;gap:8px;padding:2px 0 6px}',
    '.efa-chip{border:1px solid var(--efa-linea);background:#fff;color:var(--efa-tinta);padding:8px 12px;border-radius:20px;font-size:13px;cursor:pointer}',
    '.efa-chip:hover{border-color:var(--efa-cian);color:var(--efa-cian-p)}',
    '.efa-escr{align-self:flex-start;display:flex;gap:5px;padding:14px 16px;background:#fff;border:1px solid var(--efa-linea);border-radius:16px;border-bottom-left-radius:6px}',
    '.efa-escr i{width:7px;height:7px;border-radius:50%;background:var(--efa-cian);animation:efa-rebote 1s infinite}',
    '.efa-escr i:nth-child(2){animation-delay:.15s}.efa-escr i:nth-child(3){animation-delay:.3s}',
    '@keyframes efa-rebote{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}',
    '.efa-pie{padding:10px 12px 12px;border-top:1px solid var(--efa-linea);background:#fff;display:flex;gap:8px;align-items:flex-end}',
    '.efa-pie textarea{flex:1;resize:none;border:1px solid var(--efa-linea);border-radius:14px;padding:11px 13px;font:14.5px/1.4 Inter,system-ui,sans-serif;max-height:110px;min-height:44px;color:var(--efa-tinta);background:var(--efa-fondo)}',
    '.efa-pie textarea:focus{border-color:var(--efa-cian);background:#fff;outline:none}',
    '.efa-enviar{width:44px;height:44px;border:0;border-radius:14px;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--efa-cian),var(--efa-cian-p));display:grid;place-items:center;flex:none}',
    '.efa-enviar:disabled{opacity:.45;cursor:default}',
    '.efa-nota{font-size:11px;color:var(--efa-gris);text-align:center;padding:0 12px 10px;background:#fff}',
    '.efa-resalte{outline:3px solid var(--efa-cian)!important;outline-offset:4px;transition:outline-color 1.2s}',
    '@media (max-width:560px){.efa-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;height:100dvh;border-radius:0}.efa-fab{right:14px;bottom:14px;height:52px;padding:0 16px 0 14px}.efa-fab .efa-txt{display:none}}',
    '@media (prefers-reduced-motion:reduce){.efa-btn{animation:none}.efa-panel,.efa-fab{transition:none}.efa-escr i{animation:none}}'
  ].join('');

  var ICO = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/></svg>',
    rayo: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    enviar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    ir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3z"/></svg>'
  };

  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  var pesos = function (n) { return n == null ? 'Consultar' : '$' + Number(n).toLocaleString('es-CO'); };
  var productos = function () { return Array.isArray(window.EF_PRODUCTOS) ? window.EF_PRODUCTOS : []; };
  var porSku = function (sku) { return productos().find(function (p) { return p.sku === sku; }); };

  var estado = { mensajes: [], ocupado: false };
  try { var g = JSON.parse(sessionStorage.getItem(CLAVE) || 'null'); if (g && Array.isArray(g.mensajes)) estado.mensajes = g.mensajes.slice(-20); } catch (e) {}
  function guardar() { try { sessionStorage.setItem(CLAVE, JSON.stringify({ mensajes: estado.mensajes.slice(-20) })); } catch (e) {} }

  /* ---------- Interfaz ---------- */
  var root, msgs, input, enviarBtn, fab;
  function montar() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    ocultarAsesorViejo();
    root = document.createElement('div'); root.className = 'efa-root';
    root.innerHTML =
      '<button class="efa-fab" type="button" aria-label="Abrir asesor">' + ICO.chat + '<span class="efa-txt">¿Te ayudo a elegir?</span><span class="efa-punto" aria-hidden="true"></span></button>' +
      '<section class="efa-panel" role="dialog" aria-label="Asesor Electro Futuro" aria-modal="false">' +
        '<header class="efa-cab"><div class="efa-av">' + ICO.rayo + '</div><div><h2>Asesor Electro Futuro</h2><p>Precios y disponibilidad del catálogo actual</p></div>' +
        '<button class="efa-cerrar" type="button" aria-label="Cerrar asesor">' + ICO.x + '</button></header>' +
        '<div class="efa-msgs" aria-live="polite"></div>' +
        '<div class="efa-pie"><textarea rows="1" placeholder="Pregunta por un producto, precio o curso" aria-label="Escribe tu pregunta"></textarea>' +
        '<button class="efa-enviar" type="button" aria-label="Enviar">' + ICO.enviar + '</button></div>' +
        '<div class="efa-nota">Para confirmar tu pedido te atiende un asesor por WhatsApp.</div>' +
      '</section>';
    document.body.appendChild(root);
    fab = root.querySelector('.efa-fab'); msgs = root.querySelector('.efa-msgs');
    input = root.querySelector('textarea'); enviarBtn = root.querySelector('.efa-enviar');

    fab.addEventListener('click', abrir);
    root.querySelector('.efa-cerrar').addEventListener('click', cerrar);
    enviarBtn.addEventListener('click', function () { enviar(input.value); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(input.value); } });
    input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 110) + 'px'; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('abierto')) cerrar(); });

    pintarTodo();
    apilarSobreFlotantes();
    window.addEventListener('resize', apilarSobreFlotantes);
    setTimeout(apilarSobreFlotantes, 1500);
  }

  // Oculta el asesor anterior (el que venía dentro de app.js) para que no queden dos burbujas.
  function ocultarAsesorViejo() {
    var s = document.createElement('style');
    s.textContent = '.ia-panel,.ia-fab,.ia-boton,.ia-lanzador,#ia-panel,#ia-fab,#asesor-ia,.asesor-fab,.asesor-panel{display:none!important}';
    document.head.appendChild(s);
  }

  // Si el carrito flotante u otro botón fijo ocupa la esquina, el asesor se pone encima.
  function apilarSobreFlotantes() {
    if (!fab) return;
    var tope = 20, vw = window.innerWidth, vh = window.innerHeight;
    document.querySelectorAll('body *').forEach(function (el) {
      if (root.contains(el)) return;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
      var r = el.getBoundingClientRect();
      if (r.width < 30 || r.width > 160 || r.height > 160) return;
      if (r.right > vw - 110 && r.bottom > vh - 170) tope = Math.max(tope, vh - r.top + 12);
    });
    fab.style.bottom = tope + 'px';
  }

  function abrir() {
    root.classList.add('abierto');
    setTimeout(function () { input.focus(); msgs.scrollTop = msgs.scrollHeight; }, 60);
  }
  function cerrar() { root.classList.remove('abierto'); fab.focus(); }

  function burbuja(texto, quien) {
    var d = document.createElement('div'); d.className = 'efa-m ' + quien; d.textContent = texto; msgs.appendChild(d); return d;
  }
  function pintarBotones(botones) {
    if (!botones || !botones.length) return;
    var fila = document.createElement('div'); fila.className = 'efa-acc';
    botones.forEach(function (b) {
      var btn = document.createElement('button'); btn.type = 'button';
      btn.className = 'efa-btn' + (b.accion === 'whatsapp' ? ' wa' : '');
      var p = b.accion === 'producto' ? porSku(b.valor) : null;
      btn.innerHTML = (b.accion === 'whatsapp' ? ICO.wa : '') + '<span></span>' + (p ? '<small>' + pesos(p.precio) + (p.agotado ? ' · agotado' : '') + '</small>' : '') + (b.accion === 'whatsapp' ? '' : ICO.ir);
      btn.querySelector('span').textContent = b.texto;
      btn.addEventListener('click', function () { ejecutar(b); });
      fila.appendChild(btn);
    });
    msgs.appendChild(fila);
  }
  function pintarTodo() {
    msgs.innerHTML = '';
    burbuja('Hola. Soy el asesor de Electro Futuro. Dime qué necesitas y para qué equipo, y te digo qué referencia te sirve y cuánto vale.', 'bot');
    if (!estado.mensajes.length) {
      var sug = document.createElement('div'); sug.className = 'efa-sug';
      SUGERENCIAS.forEach(function (t) {
        var c = document.createElement('button'); c.type = 'button'; c.className = 'efa-chip'; c.textContent = t;
        c.addEventListener('click', function () { enviar(t); }); sug.appendChild(c);
      });
      msgs.appendChild(sug);
    }
    estado.mensajes.forEach(function (m) {
      burbuja(m.content, m.role === 'user' ? 'yo' : 'bot');
      if (m.role === 'assistant' && m.botones) pintarBotones(m.botones);
    });
    msgs.scrollTop = msgs.scrollHeight;
  }

  /* ---------- Conversación ---------- */
  function enviar(texto) {
    texto = String(texto || '').trim();
    if (!texto || estado.ocupado) return;
    var sug = msgs.querySelector('.efa-sug'); if (sug) sug.remove();
    input.value = ''; input.style.height = 'auto';
    estado.mensajes.push({ role: 'user', content: texto }); burbuja(texto, 'yo'); guardar();
    estado.ocupado = true; enviarBtn.disabled = true;
    var esc = document.createElement('div'); esc.className = 'efa-escr'; esc.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(esc);
    msgs.scrollTop = msgs.scrollHeight;

    var historial = estado.mensajes.slice(-10).map(function (m) { return { role: m.role, content: m.content }; });
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);

    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensajes: historial }), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (d.respaldo) { var loc = respuestaLocal(texto); if (loc.encontrado) return loc; }
        return d;
      })
      .catch(function () { return respuestaLocal(texto); })
      .then(function (d) {
        clearTimeout(t); esc.remove();
        var m = { role: 'assistant', content: d.respuesta || 'No encontré una respuesta. Escríbenos por WhatsApp y te ayudamos.', botones: d.botones || [] };
        estado.mensajes.push(m); guardar();
        burbuja(m.content, 'bot'); pintarBotones(m.botones);
        msgs.scrollTop = msgs.scrollHeight;
        estado.ocupado = false; enviarBtn.disabled = false; input.focus();
      });
  }

  // Respaldo sin IA: busca en el catálogo cargado en la página.
  var VACIAS = ['de','la','el','los','las','un','una','para','con','por','que','cual','cuanto','vale','cuesta','precio','tienen','tiene','hay','me','mi','quiero','necesito','busco','y','o','en','del','al','es','sirve','algun','alguna','valor'];
  function respuestaLocal(texto) {
    var q = norm(texto);
    if (/curso|clase|academ|aprender/.test(q)) return { encontrado: true, respuesta: 'Tenemos el Curso de Servicio Técnico básico-intermedio ($1.000.000, 4 clases, se puede pagar en cuotas) y el Curso de Software Básico ($800.000, 5 clases de lunes a viernes).', botones: [{ texto: 'Ver cursos', accion: 'seccion', valor: 'cursos' }, { texto: 'Inscribirme por WhatsApp', accion: 'whatsapp', valor: 'Hola, quiero información de los cursos' }] };
    if (/donde|direcc|ubica|horario|abren|local/.test(q)) return { encontrado: true, respuesta: 'Estamos en la Cra. 6 #18-49, Local 3, Edificio Belvedere, Ibagué. Atendemos de lunes a viernes de 8 a. m. a 6 p. m. y sábados de 8 a. m. a 2 p. m.', botones: [{ texto: 'Ver ubicación', accion: 'seccion', valor: 'ubicacion' }, { texto: 'Escribir por WhatsApp', accion: 'whatsapp', valor: 'Hola, tengo una pregunta' }] };
    var palabras = q.split(/[^a-z0-9.]+/).filter(function (w) { return w.length > 1 && VACIAS.indexOf(w) < 0; });
    if (!palabras.length) return { encontrado: false, respuesta: 'Cuéntame qué producto buscas y para qué equipo, y te muestro las opciones.', botones: [{ texto: 'Ver catálogo', accion: 'seccion', valor: 'catalogo' }] };
    var res = productos().map(function (p) {
      var nom = norm(p.nombre), resto = norm([p.marca, p.categoria, p.subcategoria, (p.tags || []).join(' '), Object.values(p.specs || {}).join(' ')].join(' '));
      var s = 0; palabras.forEach(function (w) { if (nom.indexOf(w) >= 0) s += 3; else if (resto.indexOf(w) >= 0) s += 1; });
      if (p.agotado) s -= 0.5;
      return { p: p, s: s };
    }).filter(function (x) { return x.s >= Math.max(2, palabras.length); }).sort(function (a, b) { return b.s - a.s; }).slice(0, 4);
    if (!res.length) return { encontrado: false, respuesta: 'No encontré esa referencia en el catálogo en línea. Un asesor te confirma disponibilidad por WhatsApp.', botones: [{ texto: 'Preguntar por WhatsApp', accion: 'whatsapp', valor: 'Hola, busco: ' + texto }, { texto: 'Ver catálogo', accion: 'seccion', valor: 'catalogo' }] };
    var lista = res.map(function (x) { return x.p.nombre + ' — ' + pesos(x.p.precio) + (x.p.agotado ? ' (agotado)' : ''); }).join('\n');
    return { encontrado: true, respuesta: 'Esto es lo que tengo en catálogo:\n' + lista, botones: res.slice(0, 3).map(function (x) { var ref = (x.p.specs && x.p.specs.Referencia) || x.p.nombre.split('(')[0].trim().slice(0, 24); return { texto: 'Ver ' + x.p.marca + ' ' + ref, accion: 'producto', valor: x.p.sku }; }).concat([{ texto: 'Pedir por WhatsApp', accion: 'whatsapp', valor: 'Hola, me interesa: ' + res[0].p.nombre }]) };
  }

  /* ---------- Acciones de los botones ---------- */
  function ejecutar(b) {
    if (b.accion === 'whatsapp') { window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(b.valor), '_blank', 'noopener'); return; }
    if (window.innerWidth <= 560) cerrar();
    if (b.accion === 'seccion') return irSeccion(b.valor);
    if (b.accion === 'producto') return abrirProducto(b.valor);
    if (b.accion === 'categoria') return filtrarCategoria(b.valor);
  }

  function buscarSeccion(clave) {
    var textos = SECCION_TEXTO[clave] || [clave];
    var enlaces = Array.prototype.slice.call(document.querySelectorAll('a[href^="#"]'));
    for (var i = 0; i < enlaces.length; i++) {
      var t = norm(enlaces[i].textContent), id = enlaces[i].getAttribute('href').slice(1);
      if (id && textos.some(function (x) { return t === x || t.indexOf(x) === 0; })) { var el = document.getElementById(id); if (el) return el; }
    }
    var ids = [clave, clave.replace('-', ''), clave.replace('-', '_'), 'seccion-' + clave, textos[0].replace(/ /g, '-')];
    for (var j = 0; j < ids.length; j++) { var e = document.getElementById(ids[j]); if (e) return e; }
    var tits = document.querySelectorAll('section h2, section h1');
    for (var k = 0; k < tits.length; k++) if (textos.some(function (x) { return norm(tits[k].textContent).indexOf(x) >= 0; })) return tits[k].closest('section');
    return null;
  }
  // La página usa pestañas: primero se hace clic en la píldora del menú para mostrar la sección.
  function activarPestana(clave) {
    var textos = SECCION_TEXTO[clave] || [clave];
    var pills = document.querySelectorAll('nav a, nav button, header a, header button, [role="tab"], .ef-pill, .pill');
    for (var i = 0; i < pills.length; i++) {
      if (root.contains(pills[i])) continue;
      var t = norm(pills[i].textContent);
      if (t && textos.some(function (x) { return t === x || t.indexOf(x) === 0; })) { pills[i].click(); return true; }
    }
    return false;
  }
  function irSeccion(clave) {
    activarPestana(clave);
    var el = buscarSeccion(clave);
    if (!el) { window.location.hash = clave; return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    resaltar(el);
  }
  function resaltar(el) { el.classList.add('efa-resalte'); setTimeout(function () { el.classList.remove('efa-resalte'); }, 1800); }

  function abrirProducto(sku) {
    var p = porSku(sku); if (!p) return irSeccion('catalogo');
    var fns = ['EF_abrirProducto', 'abrirProducto', 'abrirDetalle', 'abrirModalProducto', 'verProducto', 'mostrarProducto', 'abrirModal'];
    for (var i = 0; i < fns.length; i++) {
      if (typeof window[fns[i]] === 'function') { try { window[fns[i]](p.sku); return; } catch (e) { try { window[fns[i]](p); return; } catch (e2) {} } }
    }
    activarPestana('catalogo');
    var sel = ['[data-sku="' + p.sku + '"]', '[data-id="' + p.id + '"]', '[data-producto="' + p.sku + '"]', '[data-id="' + p.sku + '"]'];
    for (var j = 0; j < sel.length; j++) {
      var el = document.querySelector(sel[j]);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); var clic = el.querySelector('img, h3, .nombre, a') || el; setTimeout(function () { clic.click(); }, 450); return; }
    }
    buscarEnCatalogo(p.nombre);
  }
  function filtrarCategoria(cat) {
    activarPestana('catalogo');
    var sec = buscarSeccion('catalogo') || document;
    var obj = norm(cat);
    var cands = sec.querySelectorAll('button, [role="tab"], label, .chip, .filtro, li');
    for (var i = 0; i < cands.length; i++) {
      var t = norm(cands[i].textContent).replace(/\s*\d+$/, '');
      if (t === obj) { if (sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); cands[i].click(); return; }
    }
    var selects = sec.querySelectorAll('select');
    for (var s = 0; s < selects.length; s++) {
      var op = Array.prototype.find.call(selects[s].options, function (o) { return norm(o.textContent) === obj || norm(o.value) === obj; });
      if (op) { selects[s].value = op.value; selects[s].dispatchEvent(new Event('change', { bubbles: true })); sec.scrollIntoView({ behavior: 'smooth' }); return; }
    }
    buscarEnCatalogo(cat);
  }
  function buscarEnCatalogo(texto) {
    activarPestana('catalogo');
    var sec = buscarSeccion('catalogo');
    var campo = (sec || document).querySelector('input[type="search"], input[placeholder*="usca"], input[name*="busc"], input[id*="busc"]');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (campo) {
      campo.value = texto;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      campo.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
      resaltar(campo);
    }
  }

  window.EF_asesor = { abrir: function () { root && abrir(); }, preguntar: function (t) { if (root) { abrir(); enviar(t); } } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
