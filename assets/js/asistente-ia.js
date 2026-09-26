/* Asesor de Electro Futuro — widget independiente y GRATIS (no usa IA de pago).
   Se carga con: <script src="assets/js/asistente-ia.js?v=11" defer></script> antes de </body>.
   Responde preguntas frecuentes (ubicación, horario, envíos, pagos, garantía, cursos…)
   y busca en window.EF_PRODUCTOS entendiendo tipo de producto, marca, compatibilidad,
   potencia, capacidad y presupuesto. Recuerda el contexto de la conversación. */
(function () {
  'use strict';
  if (window.__efAsesor) return; window.__efAsesor = true;

  var WA = '573134135751';
  var CLAVE = 'ef_asesor_chat_v2';
  var SECCION_TEXTO = {
    'catalogo': ['catalogo', 'ver catalogo', 'tienda'],
    'cotizar': ['cotizar', 'cotizacion'],
    'linea-tecnica': ['linea tecnica', 'repuestos'],
    'cursos': ['cursos', 'academy', 'academia'],
    'lista-precios': ['lista de precios', 'precios'],
    'preguntas': ['preguntas', 'preguntas frecuentes', 'faq'],
    'ubicacion': ['ubicacion', 'donde estamos', 'contacto']
  };
  var SUGERENCIAS = ['Cargador para iPhone', 'Audífonos bluetooth baratos', 'Power bank de 20000', 'Pantalla Redmi 13C', '¿Hacen envíos?', '¿Dónde están?'];

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

  var estado = { mensajes: [], ocupado: false, ctx: {} };
  try { var g = JSON.parse(sessionStorage.getItem(CLAVE) || 'null'); if (g && Array.isArray(g.mensajes)) { estado.mensajes = g.mensajes.slice(-20); estado.ctx = g.ctx || {}; } } catch (e) {}
  function guardar() { try { sessionStorage.setItem(CLAVE, JSON.stringify({ mensajes: estado.mensajes.slice(-20), ctx: estado.ctx })); } catch (e) {} }

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

  /* ---------- Conversación (motor local, sin IA de pago) ---------- */
  function enviar(texto) {
    texto = String(texto || '').trim();
    if (!texto || estado.ocupado) return;
    var sug = msgs.querySelector('.efa-sug'); if (sug) sug.remove();
    input.value = ''; input.style.height = 'auto';
    estado.mensajes.push({ role: 'user', content: texto }); burbuja(texto, 'yo'); guardar();
    estado.ocupado = true; enviarBtn.disabled = true;
    var esc = document.createElement('div'); esc.className = 'efa-escr'; esc.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(esc);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(function () {
      var d;
      try { d = responder(texto); } catch (e) { d = noEntendi(); }
      esc.remove();
      var m = { role: 'assistant', content: d.respuesta, botones: d.botones || [] };
      estado.mensajes.push(m); guardar();
      burbuja(m.content, 'bot'); pintarBotones(m.botones);
      msgs.scrollTop = msgs.scrollHeight;
      estado.ocupado = false; enviarBtn.disabled = false; input.focus();
    }, 450);
  }

  /* ===== Datos del negocio ===== */
  var N = {
    dir: 'Cra. 6 #18-49, Local 3, Edificio Belvedere, Ibagué (Tolima)',
    horario: 'lunes a viernes de 8:00 a. m. a 6:00 p. m. y sábados de 8:00 a. m. a 2:00 p. m.',
    wa: '313 413 5751'
  };
  var B = {
    wa: function (t, msg) { return { texto: t || 'Escribir por WhatsApp', accion: 'whatsapp', valor: msg || 'Hola, vengo de la página web' }; },
    sec: function (t, v) { return { texto: t, accion: 'seccion', valor: v }; },
    cat: function (t, v) { return { texto: t, accion: 'categoria', valor: v }; },
    prod: function (p) { return { texto: 'Ver ' + corto(p), accion: 'producto', valor: p.sku }; }
  };
  function corto(p) {
    var ref = p.specs && p.specs.Referencia;
    var base = p.nombre.split('(')[0].trim();
    if (ref && base.length > 22) return (p.marca && p.marca.indexOf('Genérico') < 0 ? p.marca + ' ' : '') + ref;
    return base.length > 30 ? base.slice(0, 28) + '…' : base;
  }

  /* ===== Normalización ===== */
  function limpiar(s) {
    s = norm(s).replace(/(\d)\.(\d{3})/g, '$1$2').replace(/(\d)\.(\d{3})/g, '$1$2');
    var fix = [
      [/\bcargado(r)?s?\b/g, 'cargador'], [/\bcargadores\b/g, 'cargador'], [/\baudifono(s)?\b|\baudifonos\b|\baudio?fonos?\b|\bauriculares?\b|\bcascos?\b/g, 'audifonos'],
      [/\bi ?phone\b|\bayfon\b|\biphon\b|\baifon\b/g, 'iphone'], [/\bsamsum\b|\bsansung\b|\bsamgsung\b|\bsamnsung\b/g, 'samsung'],
      [/\bxiomi\b|\bshaomi\b|\bxaomi\b|\bxiami\b|\bchaomi\b/g, 'xiaomi'], [/\bpower ?banks?\b|\bpowerbanks?\b|\bpawer ?bank\b|\bbaterias? externas?\b|\bbanco de (energia|bateria)\b|\bcargador(es)? portatil(es)?\b|\bpila portatil\b/g, 'powerbank'],
      [/\bsmart ?watch(es)?\b|\bsmartwach\b|\brelojes?\b|\bsmart ?band\b|\bmanillas? inteligentes?\b|\bwatch\b|\bband\b/g, 'reloj'],
      [/\btipo c\b|\btype ?c\b|\busb ?c\b|\busb-c\b/g, 'tipoc'], [/\bmicro ?usb\b|\bv8\b/g, 'v8'], [/\blightning\b|\blighting\b|\blaitning\b/g, 'lightning'],
      [/\bbafles?\b|\bcabinas?\b|\baltavoz\b|\baltavoces\b|\bparlantes\b|\bbocinas?\b/g, 'parlante'], [/\bdisplay\b|\bvisor(es)?\b|\blcd\b|\bmodulos?\b|\bpantallas\b/g, 'pantalla'],
      [/\bforros?\b|\bfundas?\b|\bestuches?\b|\bcarcasas?\b|\bcases\b/g, 'case'], [/\bmicas?\b|\bvidrios? templados?\b|\blaminas?\b|\bprotector(es)? de pantalla\b/g, 'hidrogel'],
      [/\bbaterias\b|\bpilas?\b/g, 'bateria'], [/\bmultitomas?\b|\bregletas?\b|\btomacorrientes?\b|\bextension electrica\b/g, 'multitoma'],
      [/\braton\b|\bmouses\b/g, 'mouse'], [/\bteclados\b/g, 'teclado'], [/\bdiademas\b/g, 'diadema'], [/\bcables\b/g, 'cable'], [/\bholders?\b|\bsoportes\b|\bbases? para (el )?carro\b/g, 'soporte'],
      [/\bpalo(s)? de selfie\b|\bpalo(s)? selfie\b|\bselfie stick\b/g, 'selfie'], [/\bmanos libres\b|\bmanoslibres\b/g, 'manoslibres'], [/\bcamaras?\b/g, 'camara'],
      [/\bmicrofonos?\b|\bmicros?\b/g, 'microfono'], [/\bcarro\b|\bauto\b|\bvehiculo\b|\bcoche\b/g, 'carro'], [/\bmotos?\b|\bmotocicleta\b/g, 'moto']
    ];
    s = s.replace(/(\d+(?:\.\d+)?)\s*(metros?|mts?|mt)\b/g, '$1m');
    fix.forEach(function (f) { s = s.replace(f[0], f[1]); });
    return s.replace(/\s+/g, ' ').trim();
  }
  function textoProd(p) {
    if (!p._t) p._t = limpiar([p.nombre, p.marca, p.categoria, p.subcategoria, (p.tags || []).join(' '), Object.keys(p.specs || {}).map(function (k) { return p.specs[k]; }).join(' ')].join(' '));
    return p._t;
  }
  function nombreProd(p) { if (!p._n) p._n = limpiar(p.nombre + ' ' + (p.specs && p.specs.Referencia || '')); return p._n; }
  function catProd(p) { if (!p._c) p._c = limpiar(p.categoria + ' ' + p.subcategoria + ' ' + p.nombre); return p._c; }

  /* ===== Tipos de producto ===== */
  var TIPOS = [
    { k: 'powerbank', re: /\bpowerbank\b/, f: function (p) { return /power banks/i.test(p.subcategoria); }, etq: 'power banks' },
    { k: 'multitoma', re: /\bmultitoma\b/, f: function (p) { return p.subcategoria === 'Tomacorrientes'; }, etq: 'multitomas' },
    { k: 'cargador_reloj', re: /\bcargador (de |para )?(el )?reloj\b|\bbase (de carga )?(del |para )?reloj\b/, f: function (p) { return p.subcategoria === 'Cargadores para reloj'; }, etq: 'cargadores para reloj' },
    { k: 'cargador_carro', re: /\bcargador (de |para )?(el )?(carro|moto)\b|\bcarro\b.*\bcargador\b/, f: function (p) { return p.subcategoria === 'Cargadores de carro'; }, etq: 'cargadores para carro y moto' },
    { k: 'inalambrico', re: /\bcarga(dor)? inalambric[oa]\b|\bmagsafe\b/, f: function (p) { return /inalámbric|magsafe/i.test(p.subcategoria + ' ' + p.nombre); }, etq: 'productos de carga inalámbrica' },
    { k: 'cargador', re: /\bcargador\b|\badaptador(es)?\b|\bcubo\b/, f: function (p) { return /Cargadores de pared|Adaptadores de viaje/.test(p.subcategoria); }, etq: 'cargadores' },
    { k: 'auxiliar', re: /\bauxiliar\b|\bcable (de )?audio\b|\bplug\b|\b3\.?5 ?mm\b/, f: function (p) { return p.subcategoria === 'Cables de audio'; }, etq: 'cables de audio' },
    { k: 'hdmi', re: /\bhdmi\b|\bvga\b|\bcable de red\b|\bethernet\b|\brj45\b/, f: function (p) { return p.categoria === 'Computación' && p.subcategoria === 'Cables'; }, etq: 'cables HDMI, VGA y de red' },
    { k: 'cable', re: /\bcable\b/, f: function (p) { return p.subcategoria === 'Cables de datos'; }, etq: 'cables de datos' },
    { k: 'diadema', re: /\bdiadema\b|\bheadset\b|\bover ?ear\b/, f: function (p) { return /diadema/i.test(p.nombre); }, etq: 'diademas' },
    { k: 'manoslibres', re: /\bmanoslibres\b|\baudifonos (de|con) cable\b|\balambricos\b/, f: function (p) { return p.subcategoria === 'Audífonos con cable'; }, etq: 'audífonos con cable' },
    { k: 'audifonos', re: /\baudifonos\b|\btws\b|\bearbuds\b/, f: function (p) { return /Audífonos inalámbricos|Audífonos deportivos|Audífonos con cable/.test(p.subcategoria); }, etq: 'audífonos' },
    { k: 'parlante', re: /\bparlante\b|\bspeaker\b/, f: function (p) { return p.subcategoria === 'Parlantes' || (p.categoria === 'Computación' && /parlante/i.test(p.nombre)); }, etq: 'parlantes' },
    { k: 'radio', re: /\bradios?\b/, f: function (p) { return p.subcategoria === 'Radios'; }, etq: 'radios' },
    { k: 'reloj', re: /\breloj\b/, f: function (p) { return p.categoria === 'Smartwatch'; }, etq: 'smartwatch' },
    { k: 'pulso', re: /\bpulsos?\b|\bcorreas?\b/, f: function (p) { return p.subcategoria === 'Correas y pulsos'; }, etq: 'pulsos y correas' },
    { k: 'pantalla', re: /\bpantalla\b|\btactil\b|\bdisplay\b/, f: function (p) { return p.categoria === 'Pantallas'; }, etq: 'pantallas' },
    { k: 'bateria', re: /\bbateria\b/, f: function (p) { return p.categoria === 'Baterías'; }, etq: 'baterías' },
    { k: 'case', re: /\bcase\b|\bantishock\b|\barmadura\b/, f: function (p) { return p.subcategoria === 'Fundas y cases' && /case|funda|forro/i.test(p.nombre); }, etq: 'cases y forros' },
    { k: 'hidrogel', re: /\bhidrogel\b|\bantiespia\b|\banti espia\b/, f: function (p) { return p.subcategoria === 'Protección de pantalla'; }, etq: 'protectores de pantalla' },
    { k: 'popsocket', re: /\bpop ?sockets?\b|\bpopsocket\b|\bventosas?\b/, f: function (p) { return /Pop sockets|Soportes para celular/.test(p.subcategoria); }, etq: 'pop sockets y ventosas' },
    { k: 'soporte_tv', re: /\bsoporte (de |para )?(el )?(tv|televisor)\b|\bbase (de |para )?tv\b/, f: function (p) { return p.subcategoria === 'Soportes para TV'; }, etq: 'soportes para TV' },
    { k: 'soporte', re: /\bsoporte\b/, f: function (p) { return /Holders y soportes/.test(p.subcategoria); }, etq: 'holders y soportes' },
    { k: 'tripode', re: /\btripodes?\b|\bselfie\b|\bestabilizador\b|\bvlog|\bgrabar\b|\bcontenido\b|\btiktok\b|\byoutube|\bcreador(es)?\b|\bpov\b/, f: function (p) { return p.subcategoria === 'Trípodes y fotografía'; }, etq: 'trípodes y accesorios para grabar' },
    { k: 'luz', re: /\baros? de luz\b|\baro\b|\bluz\b|\blampara\b|\bring light\b/, f: function (p) { return p.subcategoria === 'Iluminación y creadores'; }, etq: 'luces y lámparas' },
    { k: 'microfono', re: /\bmicrofono\b|\blavalier\b|\bsolapa\b/, f: function (p) { return p.subcategoria === 'Micrófonos'; }, etq: 'micrófonos' },
    { k: 'teclado', re: /\bteclado\b/, f: function (p) { return p.subcategoria === 'Teclados'; }, etq: 'teclados' },
    { k: 'mouse', re: /\bmouse\b/, f: function (p) { return p.subcategoria === 'Mouse'; }, etq: 'mouse' },
    { k: 'pad', re: /\bpad\b|\bmouse ?pad\b|\btapete\b/, f: function (p) { return p.subcategoria === 'Pad Mouse'; }, etq: 'pad mouse' },
    { k: 'hub', re: /\bhub\b|\botg\b|\bmultiplicador\b|\bmultipuerto\b/, f: function (p) { return p.subcategoria === 'Hubs y OTG'; }, etq: 'hubs y OTG' },
    { k: 'wifi', re: /\bwifi\b|\bwi-fi\b|\bbluetooth usb\b|\brepetidor\b|\bantena\b|\bdongle\b/, f: function (p) { return /Conectividad/.test(p.subcategoria); }, etq: 'adaptadores WiFi y conectividad' },
    { k: 'camara', re: /\bcamara\b|\bweb ?cam\b/, f: function (p) { return /Cámaras/.test(p.subcategoria); }, etq: 'cámaras' },
    { k: 'celular', re: /\bcelular(es)? (basico|sencillo|de teclas)\b|\bflechita\b|\bnokia\b|\balcatel\b|\brompe ?muros\b/, f: function (p) { return p.subcategoria === 'Celulares básicos'; }, etq: 'celulares básicos' },
    { k: 'tablet', re: /\btablets?\b|\blapiz optico\b|\bstylus\b|\bpencil\b/, f: function (p) { return p.subcategoria === 'Tablets y accesorios'; }, etq: 'tablets y accesorios' },
    { k: 'base_pc', re: /\bbase refrigerante\b|\bbase (para )?(portatil|laptop|pc)\b|\bmembrana\b/, f: function (p) { return p.subcategoria === 'Bases y protección'; }, etq: 'bases para portátil' },
    { k: 'maletin', re: /\bmaletin(es)?\b|\bmorral\b|\bbolso (para )?(pc|portatil)\b/, f: function (p) { return p.subcategoria === 'Maletines para PC'; }, etq: 'maletines' },
    { k: 'hogar', re: /\bventilador\b|\bcompresor\b|\bdispensador\b|\bafeitar\b|\bpatillera\b|\bmaquina de cortar\b|\bgadget/, f: function (p) { return p.subcategoria === 'Hogar y gadgets'; }, etq: 'artículos para el hogar y gadgets' },
    { k: 'llavero', re: /\bllaveros?\b/, f: function (p) { return p.subcategoria === 'Llaveros'; }, etq: 'llaveros' }
  ];
  var CATS = [['cargadores y cables', 'Cargadores y cables'], ['audifonos y parlantes', 'Audífonos y parlantes'], ['accesorios', 'Accesorios'], ['computacion', 'Computación'], ['smartwatch', 'Smartwatch'], ['power bank y tomas', 'Power bank y tomas']];

  var EXPANDE = {
    iphone: ['iphone', 'ip', 'lightning', 'apple', 'ios'], apple: ['apple', 'iphone', 'lightning'], tipoc: ['tipoc', 'tipo c'], v8: ['v8'],
    samsung: ['samsung'], xiaomi: ['xiaomi', 'redmi', 'poco'], redmi: ['redmi', 'xiaomi'], motorola: ['motorola', 'moto'], moto: ['moto', 'motorola'],
    huawei: ['huawei', 'hw', 'honor'], honor: ['honor', 'huawei'], infinix: ['infinix'], tecno: ['tecno', 'spark', 'pova'], oppo: ['oppo'], vivo: ['vivo'],
    gamer: ['gamer', 'rgb'], original: ['original'], replica: ['replica'], inalambrico: ['inalambric', 'bluetooth', 'tws'], bluetooth: ['bluetooth', 'inalambric'],
    rapido: ['rapida', 'turbo', 'pd', 'qc'], rapida: ['rapida', 'turbo', 'pd', 'qc'], turbo: ['turbo', 'rapida'], magnetico: ['magnetic', 'magsafe'], ninos: ['infantil', 'ninos', 'kid'], nino: ['infantil', 'ninos', 'kid']
  };
  var VACIAS = ('a al del la las lo los con sin para pa pal algo cosa cosas uno algo alguna alguno algun ante bien buen buena buenas buenos busco buscando como con cual cuales cuanto cuanta cuantos cuesta cuestan de del dame deme el ella en entonces es esa ese eso esta este esto estoy favor gracias hay hola los las la le lo me mi mis muy necesito necesitaria nesesito no o para pero podria por porfa porfavor precio precios puede quiero quisiera que se si sirva sirve sirven son su sus tal te tiene tienen tienes tengo tu un una uno unos unas usted vale valen valor venden vende ver y ya tambien opciones opcion alguno otra otro otros otras referencia referencias modelo modelos dispoible disponible disponibles hay tienda ustedes manejan manejas consigo conseguir comprar compro mostrar muestrame muestreme recomienda recomiendame recomiendas recomendacion mejor bueno buenos buenas barato barata baratos baratas economico economica economicos caro cara mas menos hasta maximo mil pesos plata presupuesto').split(' ');

  /* ===== Preguntas frecuentes ===== */
  var FAQ = [
    { re: /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|ola|saludos|que tal|hi|hello)\b[\s!.?]*$/, r: function () { return { respuesta: '¡Hola! Bienvenido a Electro Futuro. Pregúntame por cualquier producto (cargadores, audífonos, power banks, smartwatch, pantallas, accesorios…), precios, envíos, pagos o cursos.', botones: [B.sec('Ver catálogo', 'catalogo'), B.sec('Ver cursos', 'cursos')] }; } },
    { re: /\b(gracias|muchas gracias|mil gracias|te agradezco|listo gracias|ok gracias|chevere|excelente|perfecto)\b/, soloCorto: true, r: function () { return { respuesta: 'Con gusto. Si quieres separar o pedir algo, un asesor te atiende por WhatsApp.', botones: [B.wa('Hacer mi pedido', 'Hola, quiero hacer un pedido')] }; } },
    { re: /\b(chao|adios|hasta luego|nos vemos|bye)\b/, r: function () { return { respuesta: '¡Hasta pronto! Aquí estoy cuando necesites algo.', botones: [] }; } },
    { re: /\b(donde (estan|queda|quedan|es|ubicados)|direccion|ubicacion|ubicados|local|tienda fisica|como llego|punto de venta|donde los encuentro|en que parte)\b/, r: function () { return { respuesta: 'Estamos en la ' + N.dir + '. Atendemos ' + N.horario + '.', botones: [B.sec('Ver en el mapa', 'ubicacion'), B.wa('Preguntar por WhatsApp', 'Hola, quiero ir al local')] }; } },
    { re: /\b(horario|hora(s)? (de atencion|abren|cierran)|a que hora|abren|cierran|atienden|abierto|domingo|festivo|sabado)\b/, r: function () { return { respuesta: 'Atendemos ' + N.horario + '. Para domingos y festivos escríbenos antes por WhatsApp.', botones: [B.sec('Ver ubicación', 'ubicacion'), B.wa('Escribir por WhatsApp')] }; } },
    { re: /\b(whatsapp|wasap|wpp|numero|telefono|celular de ustedes|contacto|contactar|llamar|asesor|hablar con alguien|persona real|humano)\b/, noProducto: true, r: function () { return { respuesta: 'Nuestro WhatsApp es el ' + N.wa + '. Ahí te atiende un asesor para cotizar, separar o confirmar tu pedido.', botones: [B.wa('Abrir WhatsApp', 'Hola, necesito un asesor')] }; } },
    { re: /\b(envio|envios|envian|mandan|despachan|domicilio|domicilios|llega(n)? a|otra ciudad|bogota|medellin|cali|barranquilla|nacional|transportadora|interrapidisimo|servientrega|coordinadora)\b/, r: function () { return { respuesta: 'Sí, enviamos a toda Colombia y también puedes recoger en el local en Ibagué. El valor y el tiempo del envío dependen de la ciudad: el asesor te los confirma por WhatsApp al cerrar el pedido.', botones: [B.wa('Cotizar envío', 'Hola, quiero cotizar un envío a mi ciudad'), B.sec('Ver catálogo', 'catalogo')] }; } },
    { re: /\b(pago|pagos|pagar|metodos? de pago|medios? de pago|nequi|daviplata|bancolombia|lulo|bre-?b|llave|transferencia|tarjeta|efectivo|qr|consignacion|contra ?entrega|contraentrega)\b/, r: function () { return { respuesta: 'Puedes pagar por Bancolombia, Lulo Bank o llave Bre-B (el QR aparece al finalizar el pedido en la tienda). También puedes pagar en el local. Para contraentrega u otro medio, confírmalo con el asesor por WhatsApp.', botones: [B.wa('Preguntar por pagos', 'Hola, tengo una pregunta sobre los medios de pago')] }; } },
    { re: /\b(por mayor|al mayor|mayorista|mayoristas|al por mayor|distribuidor|revender|reventa|precio (de )?mayor|cantidad|docena|lote)\b/, r: function () { return { respuesta: 'Sí, vendemos al detal y al por mayor. Los precios por cantidad te los da el asesor según lo que necesites.', botones: [B.wa('Cotizar al por mayor', 'Hola, quiero precios al por mayor'), B.sec('Cotizar', 'cotizar'), B.sec('Lista de precios', 'lista-precios')] }; } },
    { re: /\b(garantia|garantias|devolucion|devoluciones|cambio|cambios|salio malo|dano|defectuoso|no funciona|reclamo)\b/, r: function () { return { respuesta: 'Los repuestos de la línea técnica se prueban antes de despacharlos. Si tienes un problema con un producto, puedes radicar la garantía desde "Mi cuenta" con el número de tu pedido, o escribirle al asesor por WhatsApp para revisar tu caso.', botones: [{ texto: 'Ir a Mi cuenta', accion: 'url', valor: 'cuenta.html' }, B.wa('Reportar un problema', 'Hola, necesito ayuda con la garantía de un producto')] }; } },
    { re: /\b(rastrear|rastreo|seguimiento|mi pedido|estado (de mi|del) pedido|guia|donde va|numero de guia)\b/, r: function () { return { respuesta: 'Puedes rastrear tu pedido en "Mi cuenta": entras con tu WhatsApp o solo con el código del pedido y ves en qué va y el número de guía.', botones: [{ texto: 'Rastrear mi pedido', accion: 'url', valor: 'cuenta.html' }, B.wa('Preguntar por mi pedido', 'Hola, quiero saber el estado de mi pedido')] }; } },
    { re: /\b(como (compro|comprar|hago (el|un) pedido|pido|hago para comprar)|hacer (un )?pedido|proceso de compra|pedir)\b/, r: function () { return { respuesta: 'Es fácil: agrega los productos al carrito desde el catálogo, llena tus datos y el pedido se confirma por WhatsApp con un asesor, que te dice el total con envío y la forma de pago.', botones: [B.sec('Ir al catálogo', 'catalogo'), B.wa('Pedir por WhatsApp', 'Hola, quiero hacer un pedido')] }; } },
    { re: /\b(cotizar|cotizacion|presupuesto para|cotizame)\b/, r: function () { return { respuesta: 'Puedes armar tu cotización en la sección Cotizar o pedírsela directamente al asesor por WhatsApp.', botones: [B.sec('Ir a Cotizar', 'cotizar'), B.wa('Cotizar por WhatsApp', 'Hola, quiero una cotización')] }; } },
    { re: /\b(lista de precios|catalogo en pdf|pdf|catalogo completo|todos los productos|que venden|que productos|que tienen|que manejan)\b/, r: function () { return { respuesta: 'Manejamos ' + productos().length + ' referencias: cargadores y cables, audífonos y parlantes, power banks y multitomas, smartwatch, accesorios, computación, y repuestos (pantallas y baterías). Dime qué buscas y te muestro opciones con precio.', botones: [B.sec('Ver catálogo', 'catalogo'), B.sec('Lista de precios', 'lista-precios')] }; } },
    { re: /\b(original(es)?|replica(s)?|generico(s)?|copia|imitacion|1\.?1|aaa|son buenos|calidad)\b/, noProducto: true, r: function () { return { respuesta: 'En el catálogo cada producto dice su tipo: "Original" es de la marca (Apple, Samsung, Xiaomi…), "Réplica 1.1" es una réplica de alta calidad, y el resto son marcas de accesorios como 1Hora, Movisun, LDNIO, Alitech o Speed Song. Dime qué buscas y te muestro las dos opciones con precio.', botones: [B.sec('Ver catálogo', 'catalogo')] }; } },
    { re: /\b(curso|cursos|clase|clases|academia|academy|aprender|estudiar|capacitacion|inscripcion|inscribirme|matricula)\b/, r: function (q) {
        if (/software/.test(q)) return { respuesta: 'Curso de Software Básico: $800.000 (antes $1.000.000), 5 clases seguidas de lunes a viernes.', botones: [B.sec('Ver cursos', 'cursos'), B.wa('Inscribirme', 'Hola, quiero inscribirme al curso de Software Básico')] };
        if (/tecnico|reparacion|reparar|celulares|hardware|soldadura|reballing/.test(q)) return { respuesta: 'Curso de Servicio Técnico básico-intermedio: $1.000.000, 4 clases (tú eliges viernes, sábados o domingos a lo largo del mes) y se puede pagar en cuotas. Ves desarme y armado, reconocimiento de piezas, protocolos de encendido, carga, imagen y radiofrecuencia, soldadura (reballing), pines de carga y diagnóstico paso a paso.', botones: [B.sec('Ver cursos', 'cursos'), B.wa('Inscribirme', 'Hola, quiero inscribirme al curso de Servicio Técnico')] };
        return { respuesta: 'Tenemos dos cursos presenciales: Servicio Técnico básico-intermedio ($1.000.000, 4 clases, se puede pagar en cuotas) y Software Básico ($800.000, 5 clases de lunes a viernes).', botones: [B.sec('Ver cursos', 'cursos'), B.wa('Pedir información', 'Hola, quiero información de los cursos')] };
      } },
    { re: /\b(reparan|reparacion|arreglan|arreglar|servicio tecnico|cambian (la )?pantalla|instalan|instalacion|mano de obra|revisan)\b/, noProducto: true, r: function () { return { respuesta: 'Vendemos repuestos (pantallas y baterías) en la Línea técnica. Para instalación o reparación del equipo, pregúntale al asesor por WhatsApp si hay disponibilidad y el valor.', botones: [B.sec('Ver Línea técnica', 'linea-tecnica'), B.wa('Preguntar por reparación', 'Hola, quiero saber si reparan mi celular')] }; } },
    { re: /\b(descuento|descuentos|promocion|promociones|oferta|ofertas|rebaja|cupon)\b/, r: function () { return { respuesta: 'Las promociones vigentes y los descuentos por cantidad te los confirma el asesor por WhatsApp.', botones: [B.wa('Preguntar por ofertas', 'Hola, ¿qué promociones tienen?'), B.sec('Ver catálogo', 'catalogo')] }; } },
    { re: /\b(factura|facturacion|factura electronica|rut|nit)\b/, r: function () { return { respuesta: 'Para factura con tus datos o los de tu empresa, pídesela al asesor al confirmar el pedido por WhatsApp.', botones: [B.wa('Pedir factura', 'Hola, necesito factura para mi compra')] }; } },
    { re: /\b(trabajo|empleo|vacante|hoja de vida|trabajar con ustedes)\b/, r: function () { return { respuesta: 'Para hojas de vida o vacantes, escríbenos por WhatsApp y te indicamos a quién enviarla.', botones: [B.wa('Escribir por WhatsApp', 'Hola, quiero enviar mi hoja de vida')] }; } },
    { re: /\b(quien eres|que eres|eres (un )?(robot|bot|ia|humano)|como te llamas)\b/, r: function () { return { respuesta: 'Soy el asesor automático de Electro Futuro: busco en el catálogo de la tienda y te respondo sobre productos, precios, envíos, pagos y cursos. Para cerrar tu pedido te atiende una persona por WhatsApp.', botones: [B.wa('Hablar con una persona', 'Hola, quiero hablar con un asesor')] }; } },
    { re: /\b(agotado|agotados|stock|disponibilidad|hay existencias|tienen en existencia|cuantas unidades|unidades)\b/, noProducto: true, r: function () { return { respuesta: 'En el catálogo los productos sin existencias aparecen como "Agotado". Para confirmar unidades exactas o reservar, escríbele al asesor.', botones: [B.wa('Confirmar disponibilidad', 'Hola, quiero confirmar disponibilidad de un producto'), B.sec('Ver catálogo', 'catalogo')] }; } }
  ];

  /* ===== Motor ===== */
  var ORD = ['primero', 'segundo', 'tercero', 'cuarto'];
  function responder(original) {
    var q = limpiar(original);
    var ctx = estado.ctx || {};

    // Detalle de un producto de la respuesta anterior: "el primero", "el 2", "ese"
    var m = q.match(/\b(el|la|del|de la)? ?(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|ultim[oa]|1|2|3|4)\b/);
    if (ctx.ultimos && ctx.ultimos.length && m && q.split(' ').length <= 6 && !/\d{2,}/.test(q)) {
      var i = { primer: 0, primero: 0, primera: 0, '1': 0, segundo: 1, segunda: 1, '2': 1, tercer: 2, tercero: 2, tercera: 2, '3': 2, cuarto: 3, cuarta: 3, '4': 3 }[m[2]];
      if (/ultim/.test(m[2])) i = ctx.ultimos.length - 1;
      var pp = porSku(ctx.ultimos[i]); if (pp) return ficha(pp);
    }
    if (ctx.ultimos && ctx.ultimos.length === 1 && /\b(ese|esa|eso|caracteristicas|especificaciones|specs|detalles|que trae|como es|compatible|sirve para|mas info|informacion)\b/.test(q) && q.split(' ').length <= 7) {
      var p1 = porSku(ctx.ultimos[0]); if (p1) return ficha(p1);
    }

    var tipo = null;
    var preguntaPrecio = /\b(cuanto (vale|cuesta|valen|cuestan|sale)|que precio|precio)\b/.test(q);
    for (var t = 0; t < TIPOS.length; t++) if (TIPOS[t].re.test(q)) { tipo = TIPOS[t]; break; }
    var palabrasProducto = tipo || /\b\d+ ?(w|mah|m|gb)\b/.test(q);
    var refina = /^(y|o|de|del|para|con|pero|en|que sea|mejor)\b|\b(barat|economic|car[oa]|mas|menos|hasta|entre|desde|original|replica|\d+ ?(w|mah|m)\b|color|negro|blanco|rosad|azul|otr[oa]s?)/.test(q);

    for (var f = 0; f < FAQ.length; f++) {
      var fq = FAQ[f];
      if (!fq.re.test(q)) continue;
      if (fq.soloCorto && q.split(' ').length > 5) continue;
      if (fq.noProducto && (palabrasProducto || (ctx.tipo && refina && q.split(' ').length <= 5))) continue;
      if (tipo && /\b(cuanto (vale|cuesta)|precio|tienen|hay|venden)\b/.test(q) && !/envio|pago|curso|garantia|mayor/.test(q)) break;
      estado.ctx = { tipo: ctx.tipo, terminos: ctx.terminos, ultimos: ctx.ultimos };
      return fq.r(q);
    }

    // Categoría general ("accesorios", "computación")
    var catGeneral = null;
    if (!tipo) CATS.forEach(function (c) { if (new RegExp('\\b' + c[0] + '\\b').test(q)) catGeneral = c[1]; });

    // Seguimiento: "y más barato?", "de 20w", "samsung?" sobre el tipo anterior
    var seguimiento = false;
    if (!tipo && !catGeneral && ctx.tipo && refina && q.split(' ').length <= 7) { tipo = TIPOS.filter(function (x) { return x.k === ctx.tipo; })[0] || null; seguimiento = !!tipo; }

    // Presupuesto
    var max = null, min = null;
    var mm = q.match(/\b(menos de|hasta|maximo|no mas de|por debajo de|max|tope|que no pase de|que no supere)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(mil|k|lucas|barras)?/);
    if (mm) max = aPesos(mm[2], mm[3]);
    var mn = q.match(/\b(mas de|desde|minimo|por encima de)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(mil|k|lucas|barras)?/);
    if (mn) min = aPesos(mn[2], mn[3]);
    if (max == null && min == null) { var dm = q.match(/\b(de|como de|unos|por|a)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(mil|k|lucas|barras|pesos)\b/); if (dm && (dm[3] !== 'pesos' || +dm[2] >= 1000)) max = aPesos(dm[2], dm[3] === 'pesos' ? null : dm[3]); }
    var entre = q.match(/\bentre\s*\$?\s*(\d+)\s*(mil|k)?\s*y\s*\$?\s*(\d+)\s*(mil|k)?/);
    if (entre) { min = aPesos(entre[1], entre[2] || entre[4]); max = aPesos(entre[3], entre[4]); }
    var barato = /\b(barat[oa]s?|economic[oa]s?|mas bajo|menor precio|bajo costo|sencill[oa])\b/.test(q);
    var caro = /\b(mas car[oa]|premium|gama alta|el mejor|la mejor|mejor calidad|top)\b/.test(q);

    // Términos de búsqueda
    var quitar = tipo ? q.replace(tipo.re, ' ') : q;
    if (catGeneral) quitar = quitar.replace(new RegExp(norm(catGeneral)), ' ');
    quitar = quitar.replace(/\b(menos de|hasta|maximo|no mas de|por debajo de|mas de|desde|minimo|entre|de|como de|unos|por|a)\s*\$?\s*\d+(?:[.,]\d+)?\s*(mil|k|lucas|barras|pesos)\b/g, ' ').replace(/\b(menos de|hasta|maximo|no mas de|por debajo de|mas de|desde|minimo|entre)\s*\$?\s*\d+(?:[.,]\d+)?/g, ' ').replace(/\by\s*\$?\s*\d+\s*(mil|k)?/g, ' ');
    var terminos = quitar.split(/[^a-z0-9]+/).filter(function (w) { return w && (w.length > 1 || /\d/.test(w)) && VACIAS.indexOf(w) < 0; });
    // unir números con unidades: "20 w" -> "20w"
    var tx = []; for (var k = 0; k < terminos.length; k++) { if (/^\d+$/.test(terminos[k]) && /^(w|mah|m|gb|mm|cm)$/.test(terminos[k + 1] || '')) { tx.push(terminos[k] + terminos[k + 1]); k++; } else tx.push(terminos[k]); }
    terminos = tx.filter(function (w) { return !/^(w|mah|m|gb|mm|cm)$/.test(w); });

    if (seguimiento && ctx.terminos) ctx.terminos.forEach(function (w) { if (terminos.indexOf(w) < 0) terminos.push(w); });
    if (!tipo && !catGeneral && !terminos.length && max == null && min == null) {
      if (preguntaPrecio && ctx.ultimos && ctx.ultimos.length === 1) { var pu = porSku(ctx.ultimos[0]); if (pu) return ficha(pu); }
      if (preguntaPrecio || barato || caro) return { respuesta: '¿De qué producto quieres saber? Escríbeme el nombre o lo que buscas, por ejemplo: "precio cargador 20W" o "audífonos baratos".', botones: [B.sec('Ver catálogo', 'catalogo'), B.sec('Lista de precios', 'lista-precios')] };
      return noEntendi();
    }
    var base = productos();
    if (tipo) base = base.filter(tipo.f);
    else if (catGeneral) base = base.filter(function (p) { return p.categoria === catGeneral; });

    function puntuar(lista) {
      return lista.map(function (p) {
        var nom = nombreProd(p), todo = textoProd(p), s = 0, ok = 0;
        terminos.forEach(function (w) {
          var vars = EXPANDE[w] || [w];
          var enNom = vars.some(function (v) { return contiene(nom, v); });
          var enTodo = enNom || vars.some(function (v) { return contiene(todo, v); });
          if (/^\d+(w|mah|m|gb|mm|cm|v|a)$/.test(w)) { // 20w, 20000mah
            var num = w.match(/^\d+/)[0], uni = w.replace(/^\d+/, '');
            var re = new RegExp('(^|[^0-9.,])' + num + ' ?' + uni + '\\b');
            if (re.test(nom)) { s += 5; ok++; } else if (re.test(todo)) { s += 3; ok++; }
            return;
          }
          if (enNom) { s += 3; ok++; } else if (enTodo) { s += 1; ok++; }
        });
        return { p: p, s: s, ok: ok };
      });
    }

    var res;
    if (terminos.length) {
      res = puntuar(base).filter(function (x) { return x.ok >= Math.max(1, Math.ceil(terminos.length * 0.6)); });
      if (!res.length && (tipo || catGeneral)) {
        // Término que no aparece (p. ej. "cargador azul"): mostrar el tipo igual
        res = base.map(function (p) { return { p: p, s: 0, ok: 0 }; });
      }
      if (!res.length && !tipo) res = puntuar(productos()).filter(function (x) { return x.ok >= Math.max(1, Math.ceil(terminos.length * 0.6)); });
    } else if (tipo || catGeneral) {
      res = base.map(function (p) { return { p: p, s: 0, ok: 0 }; });
    } else res = [];

    if (max != null) res = res.filter(function (x) { return x.p.precio != null && x.p.precio <= max; });
    if (min != null) res = res.filter(function (x) { return x.p.precio != null && x.p.precio >= min; });

    if (!res.length) {
      if (tipo || catGeneral || terminos.length) {
        estado.ctx = { tipo: tipo ? tipo.k : null };
        var que = tipo ? tipo.etq : 'eso';
        return { respuesta: 'No encontré ' + que + (max ? ' por menos de ' + pesos(max) : '') + ' con esas características en el catálogo en línea. Puede que el asesor lo tenga en bodega o te consiga algo parecido.', botones: [B.wa('Preguntar por WhatsApp', 'Hola, busco: ' + original)].concat(tipo ? [B.sec('Ver catálogo', 'catalogo')] : []) };
      }
      return noEntendi();
    }

    res.sort(function (a, b) {
      if (b.s !== a.s) return b.s - a.s;
      if (a.p.agotado !== b.p.agotado) return a.p.agotado ? 1 : -1;
      if (caro) return (b.p.precio || 0) - (a.p.precio || 0);
      return (a.p.precio || 9e9) - (b.p.precio || 9e9);
    });
    if (barato || caro || max != null) {
      var mejor = res[0].s;
      var top = res.filter(function (x) { return x.s === mejor && !x.p.agotado; });
      if (top.length) res = top.concat(res.filter(function (x) { return top.indexOf(x) < 0; }));
    }
    if (!terminos.length && !barato && !caro && max == null && min == null) {
      var porSub = {}, orden = [];
      res.forEach(function (x) { var k = x.p.subcategoria; if (!porSub[k]) { porSub[k] = []; orden.push(k); } porSub[k].push(x); });
      if (orden.length > 1) { var mezcla = []; for (var r = 0; mezcla.length < res.length; r++) orden.forEach(function (k) { if (porSub[k][r]) mezcla.push(porSub[k][r]); }); res = mezcla; }
    }
    var disponibles = res.filter(function (x) { return !x.p.agotado; });
    var mostrar = (disponibles.length ? disponibles : res).slice(0, 4);
    estado.ctx = { tipo: tipo ? tipo.k : null, terminos: terminos, ultimos: mostrar.map(function (x) { return x.p.sku; }) };

    // Un solo resultado claro: ficha completa
    if (mostrar.length === 1 || (terminos.length && res.length > 1 && res[0].s >= res[1].s + 4)) return ficha(mostrar[0].p);

    var total = res.length, precios = res.filter(function (x) { return x.p.precio; }).map(function (x) { return x.p.precio; });
    var desde = precios.length ? Math.min.apply(null, precios) : null;
    var titulo;
    if (barato) titulo = 'Las opciones más económicas' + (tipo ? ' de ' + tipo.etq : '') + ':';
    else if (caro) titulo = 'Las opciones de gama más alta' + (tipo ? ' en ' + tipo.etq : '') + ':';
    else if (total > 4) titulo = 'Tengo ' + total + ' opciones' + (tipo ? ' de ' + tipo.etq : '') + (desde ? ', desde ' + pesos(desde) : '') + (max ? ' hasta ' + pesos(max) : '') + '. Estas son las que más se ajustan:';
    else titulo = 'Esto es lo que tengo' + (max ? ' por menos de ' + pesos(max) : '') + ':';

    var lineas = mostrar.map(function (x, n) { return (n + 1) + '. ' + x.p.nombre + ' — ' + pesos(x.p.precio) + (x.p.agotado ? ' (agotado)' : ''); }).join('\n');
    var pie = total > 4 ? '\n\nPuedes afinar: "más barato", "de 20W", "para iPhone", "menos de 50 mil"… o escribe "el 1" para ver detalles.' : '\n\nEscribe "el 1", "el 2"… para ver detalles.';
    var botones = mostrar.slice(0, 3).map(function (x) { return B.prod(x.p); });
    if (total > 4) botones.push(tipo || catGeneral ? B.cat('Ver todos', tipo ? mostrar[0].p.categoria : catGeneral) : B.sec('Ver catálogo', 'catalogo'));
    else botones.push(B.wa('Pedir por WhatsApp', 'Hola, me interesa: ' + mostrar[0].p.nombre));
    return { respuesta: titulo + '\n' + lineas + pie, botones: botones };
  }

  function ficha(p) {
    estado.ctx = estado.ctx || {}; estado.ctx.ultimos = [p.sku];
    var s = p.specs || {};
    var det = Object.keys(s).filter(function (k) { return k !== 'Garantía'; }).slice(0, 6).map(function (k) { return '• ' + k + ': ' + s[k]; }).join('\n');
    var txt = p.nombre + '\n' + (p.marca && p.marca !== 'Mecánico' ? 'Marca: ' + p.marca + '\n' : '') + 'Precio: ' + pesos(p.precio) + (p.agotado ? ' — AGOTADO por ahora' : '') + (det ? '\n' + det : '');
    if (p.agotado) {
      var alt = productos().filter(function (x) { return !x.agotado && x.subcategoria === p.subcategoria && x.sku !== p.sku; })
        .sort(function (a, b) { return Math.abs((a.precio || 0) - (p.precio || 0)) - Math.abs((b.precio || 0) - (p.precio || 0)); })[0];
      if (alt) { txt += '\n\nUna alternativa disponible: ' + alt.nombre + ' — ' + pesos(alt.precio) + '.'; return { respuesta: txt, botones: [B.prod(alt), B.wa('Preguntar cuándo llega', 'Hola, ¿cuándo llega ' + p.nombre + '?')] }; }
    }
    return { respuesta: txt, botones: [B.prod(p), B.wa('Pedir este producto', 'Hola, quiero: ' + p.nombre + ' (' + pesos(p.precio) + ')')] };
  }

  function noEntendi() {
    return { respuesta: 'No te entendí bien. Puedes preguntarme, por ejemplo: "cargador para iPhone", "audífonos bluetooth baratos", "power bank de 20000", "pantalla Redmi 13C", "smartwatch para niños", "¿hacen envíos?" o "¿cuánto vale el curso?".', botones: [B.sec('Ver catálogo', 'catalogo'), B.wa('Hablar con un asesor', 'Hola, tengo una pregunta')] };
  }
  function aPesos(n, unidad) { var v = parseFloat(String(n).replace(',', '.')); if (unidad || v < 1000) v = v * 1000; return Math.round(v); }
  function contiene(txt, v) { return (' ' + txt + ' ').indexOf(' ' + v) >= 0 || (v.length >= 4 && txt.indexOf(v) >= 0); }


  /* ---------- Acciones de los botones ---------- */
  function ejecutar(b) {
    if (b.accion === 'whatsapp') { window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(b.valor), '_blank', 'noopener'); return; }
    if (b.accion === 'url') { window.location.href = b.valor; return; }
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
