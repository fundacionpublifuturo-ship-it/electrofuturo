/* ============================================================
   ELECTRO FUTURO — nube.js
   Puente entre la tienda y el portal admin.

   Con Supabase configurado en config.js, todo va a la nube y se ve
   igual en cualquier dispositivo. Sin configurar, funciona en modo
   local: la tienda y el portal se hablan por localStorage, lo que
   solo sirve cuando ambos se abren en el mismo navegador.
   ============================================================ */
(function (global) {
  'use strict';

  /* config.js declara EF_CONFIG con const: no cuelga de window, se lee por nombre */
  const C = (typeof EF_CONFIG !== 'undefined' && EF_CONFIG) || global.EF_CONFIG || {};
  const URL_ = String(C.SUPABASE_URL || '').replace(/\/+$/, '');
  const KEY = String(C.SUPABASE_ANON_KEY || '');

  const INBOX = 'ef_web_inbox';     // pedidos web en modo local
  const COLA = 'ef_web_cola';       // pedidos que no alcanzaron a subir
  const POS = 'ef_gestion_v1';      // base del portal admin

  const activa = () => !!URL_ && !!KEY && !URL_.includes('TU-PROYECTO') && KEY !== 'TU_ANON_KEY';

  const cab = () => ({ apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' });

  async function rpc(fn, args, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 12000);
    try {
      const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers: cab(), body: JSON.stringify(args || {}), signal: ctl.signal
      });
      const txt = await r.text();
      const data = txt ? JSON.parse(txt) : null;
      if (!r.ok) {
        const e = new Error((data && (data.message || data.hint)) || ('HTTP ' + r.status));
        e.status = r.status;
        e.clave = /clave incorrecta/i.test(e.message);
        throw e;
      }
      return data;
    } finally { clearTimeout(t); }
  }

  const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  /* ------------------------------------------------------------
     TIENDA → PORTAL: pedidos
     ------------------------------------------------------------ */
  async function enviarPedido(p) {
    if (!activa()) {
      const l = leer(INBOX, []);
      if (!l.some(x => x.codigo === p.codigo)) l.push(p);
      escribir(INBOX, l);
      return { modo: 'local', codigo: p.codigo };
    }
    try {
      const cod = await rpc('ef_pedido_nuevo', { p_datos: p }, 9000);
      return { modo: 'nube', codigo: cod };
    } catch (e) {
      /* Sin conexión: queda en cola y se reintenta en la próxima visita */
      const q = leer(COLA, []);
      if (!q.some(x => x.codigo === p.codigo)) q.push(p);
      escribir(COLA, q);
      return { modo: 'cola', codigo: p.codigo, error: e.message };
    }
  }

  async function reintentarCola() {
    if (!activa()) return 0;
    const q = leer(COLA, []);
    if (!q.length) return 0;
    const quedan = [];
    for (const p of q) {
      try { await rpc('ef_pedido_nuevo', { p_datos: p }, 9000); } catch (e) { quedan.push(p); }
    }
    escribir(COLA, quedan);
    return q.length - quedan.length;
  }

  /* ------------------------------------------------------------
     PORTAL → TIENDA: precio y existencias
     Devuelve { sku: {precio, stock, controla} }
     ------------------------------------------------------------ */
  async function stock(ms) {
    const out = {};
    if (activa()) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), ms || 3500);
      try {
        const r = await fetch(`${URL_}/rest/v1/ef_stock_publico?select=sku,precio,stock,controla`,
          { headers: cab(), signal: ctl.signal });
        if (r.ok) (await r.json()).forEach(f => {
          out[f.sku] = { precio: Number(f.precio) || 0, stock: Number(f.stock) || 0, controla: !!f.controla };
        });
      } catch (e) { /* sin nube: la tienda sigue con su catálogo */ }
      finally { clearTimeout(t); }
      return out;
    }
    /* Modo local: se lee directo la base del portal en este navegador */
    const pos = leer(POS, null);
    if (pos && Array.isArray(pos.products)) {
      const movidos = new Set((pos.kardex || []).map(k => k.productId));
      pos.products.forEach(p => {
        if (!p.code) return;
        out[p.code] = { precio: Number(p.price) || 0, stock: Number(p.stock) || 0,
                        controla: movidos.has(p.id) || (Number(p.stock) || 0) > 0 };
      });
    }
    return out;
  }

  global.Nube = { activa, rpc, enviarPedido, reintentarCola, stock, INBOX, POS, leer, escribir };
})(window);
