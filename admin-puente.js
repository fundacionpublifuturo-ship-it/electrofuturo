/* ============================================================
   ELECTRO FUTURO — admin-puente.js
   Corre después del portal de gestión y lo conecta con la tienda:

   1. Carga una sola vez las 213 referencias del catálogo web al
      inventario del portal, con su SKU como código.
   2. Trae los pedidos de la tienda y los deja como "ventas en espera":
      en Punto de Venta → Recuperar venta en espera, se facturan y el
      stock se descuenta con el flujo normal del portal.
   3. Publica precio y existencias para que la tienda muestre
      "Agotado" cuando el portal diga que no hay.
   ============================================================ */
(function (global) {
  'use strict';

  const CAT_POS = {
    ACC: 'Accesorios', CAB: 'Cargadores y cables', AUD: 'Audífonos y parlantes',
    PWB: 'Power bank y tomas', RLJ: 'Relojes smart', HER: 'Herramientas y repuestos',
    PNT: 'Pantallas', BAT: 'Baterías', COM: 'Computación'
  };
  function categoria(p) {
    const t = ((p.categoria || '') + ' ' + (p.subcategoria || '') + ' ' + (p.nombre || '')).toUpperCase();
    if (p.categoria === 'Pantallas') return CAT_POS.PNT;
    if (p.categoria === 'Baterías') return CAT_POS.BAT;
    if (/RELOJ|SMARTWATCH|WATCH/.test(t)) return CAT_POS.RLJ;
    if (/POWER ?BANK|TOMACORRIENTE|REGLETA/.test(t)) return CAT_POS.PWB;
    if (/AUDIF|DIADEMA|PARLANTE|AUDIO|BUDS|SPEAKER|MICR/.test(t)) return CAT_POS.AUD;
    if (/CARGADOR|CABLE|HDMI|USB|ADAPTADOR|HUB/.test(t)) return CAT_POS.CAB;
    if (/PINZA|DESTORNILLA|HERRAMIENT|SOLDAD|FLUX|MALLA/.test(t)) return CAT_POS.HER;
    if (p.categoria === 'Computación') return CAT_POS.COM;
    return CAT_POS.ACC;
  }

  const enNube = () => global.Nube && Nube.activa() && !!global.EF_CLAVE;
  const aviso = (m, e) => { try { toast(m, e || '🌐'); } catch (x) { console.log(m); } };

  /* ---------- 1. catálogo de la tienda → inventario del portal ---------- */
  function sembrarCatalogo() {
    const web = global.EF_PRODUCTOS || [];
    if (!web.length) return 0;
    const codigos = new Set(S.products.map(p => String(p.code || '').toUpperCase()));
    const marcas = new Set(S.config.marcas || []);
    let n = 0;
    web.forEach(w => {
      if (codigos.has(w.sku.toUpperCase())) return;
      const cat = categoria(w);
      S.products.push({
        id: uid('pr'), code: w.sku, name: w.nombre, category: cat, brand: w.marca || '',
        price: Number(w.precio) || 0, price2: Number(w.precio) || 0, cost: 0,
        stock: 0, min: 0, sold: 0, img: false, createdAt: nowISO(),
        /* Sin existencia cargada todavía: se puede facturar con advertencia */
        conAdv: true, web: true,
        desc: [w.subcategoria, w.specs && w.specs['Compatibilidad']].filter(Boolean).join(' · ')
      });
      if (w.marca) marcas.add(w.marca);
      n++;
    });
    if (n) {
      S.config.marcas = [...marcas];
      S.config.webCatalogo = nowISO();
      save('products', 'config');
    }
    return n;
  }

  /* ---------- 2. pedidos de la tienda → ventas en espera ---------- */
  function productoPara(item) {
    const cod = String(item.sku || '').toUpperCase();
    let p = S.products.find(x => String(x.code || '').toUpperCase() === cod);
    if (!p) {
      p = { id: uid('pr'), code: item.sku, name: item.nombre, category: CAT_POS.ACC,
            price: Number(item.precio) || 0, price2: Number(item.precio) || 0, cost: 0,
            stock: 0, min: 0, sold: 0, img: false, createdAt: nowISO(), conAdv: true, web: true };
      S.products.push(p);
    }
    return p;
  }

  function aEspera(ped) {
    if (S.held.some(h => h.web && h.web.codigo === ped.codigo)) return false;
    const cli = ped.cliente || {};
    const cart = (ped.items || []).map(i => {
      const p = productoPara(i);
      return { productId: p.id, name: p.name, price: Number(i.precio) || p.price, cost: p.cost || 0,
               qty: Math.max(1, Number(i.qty) || 1), code: p.code, category: p.category };
    });
    if (!cart.length) return false;
    try { ensureClient(cli.nombre || 'Cliente web', cli.telefono || '', cli.documento || ''); } catch (e) { }
    const total = cart.reduce((a, i) => a + i.qty * i.price, 0);
    S.held.unshift({
      id: uid('hd'), at: ped.fecha || nowISO(),
      name: `🌐 ${ped.codigo} · ${cli.nombre || 'Cliente web'}`,
      cart,
      hdr: { docType: 'POS', nit: cli.documento || '', clientName: cli.nombre || 'Consumidor final',
             phone: cli.telefono || '', seller: 'Tienda web', priceKey: 'price' },
      total,
      web: {
        codigo: ped.codigo, entrega: ped.entrega, pago: ped.pago, referencia: ped.referencia,
        direccion: cli.direccion || '', ciudad: cli.ciudad || '', correo: cli.correo || '',
        envio: ped.envio || 0, descuento: ped.descuento || 0, totalWeb: ped.total || total
      }
    });
    try { audit('PEDIDO_WEB', ped.codigo + ' · ' + (cli.nombre || '')); } catch (e) { }
    return true;
  }

  let trayendo = false;
  async function traerPedidos() {
    if (trayendo) return;
    trayendo = true;
    let nuevos = 0;
    try {
      if (enNube()) {
        const filas = await Nube.rpc('ef_pedidos_pendientes', { p_clave: EF_CLAVE });
        for (const f of (filas || [])) {
          if (aEspera(f.datos)) nuevos++;
          await Nube.rpc('ef_pedido_tomado', { p_clave: EF_CLAVE, p_id: f.id });
        }
      }
      /* Modo local (o pedidos hechos en este mismo navegador) */
      const loc = Nube.leer(Nube.INBOX, []);
      if (loc.length) {
        loc.forEach(p => { if (aEspera(p)) nuevos++; });
        Nube.escribir(Nube.INBOX, []);
      }
      if (nuevos) {
        save('held', 'clients', 'products');
        render();
        aviso(nuevos === 1 ? 'Llegó 1 pedido de la tienda: está en ventas en espera'
                           : `Llegaron ${nuevos} pedidos de la tienda: están en ventas en espera`, '🌐');
      }
    } catch (e) {
      console.warn('Pedidos web:', e.message);
    } finally { trayendo = false; }
    return nuevos;
  }

  /* ---------- 3. existencias del portal → tienda ---------- */
  let tPub = null;
  function publicarLuego() { clearTimeout(tPub); tPub = setTimeout(publicarStock, 1500); }
  async function publicarStock() {
    if (!enNube()) return;   // en local la tienda lee directo la base del portal
    const movidos = new Set((S.kardex || []).map(k => k.productId));
    const filas = S.products.filter(p => p.code).map(p => ({
      sku: p.code, nombre: p.name, precio: Math.round(Number(p.price) || 0),
      stock: Math.round(Number(p.stock) || 0),
      controla: !p.sinInv && (movidos.has(p.id) || (Number(p.stock) || 0) > 0)
    }));
    try {
      for (let i = 0; i < filas.length; i += 400) {
        await Nube.rpc('ef_publicar_stock', { p_clave: EF_CLAVE, p_filas: filas.slice(i, i + 400) });
      }
    } catch (e) { console.warn('Publicar stock:', e.message); }
  }

  /* Cada vez que el portal guarda productos o kardex, se publica */
  const _save = global.save;
  if (typeof _save === 'function') {
    save = function (...keys) {
      _save.apply(this, keys);
      if (!keys.length || keys.includes('products') || keys.includes('kardex') || keys.includes('sales')) publicarLuego();
    };
  }

  /* ---------- arranque: cuando el portal terminó de cargar ---------- */
  let arrancado = false;
  function arrancar() {
    if (arrancado) return;
    arrancado = true;
    const n = sembrarCatalogo();
    if (n) aviso(`${n} referencias de la tienda cargadas al inventario`, '📦');
    publicarStock();
    traerPedidos();
    setInterval(traerPedidos, 30000);
    global.addEventListener('focus', traerPedidos);
    global.addEventListener('storage', e => { if (e.key === Nube.INBOX) traerPedidos(); });
  }

  /* El portal avisa con ef:listo cuando terminó de cargar su base.
     Si ya pasó antes de que este archivo cargara, se arranca de una. */
  if (global.__efListo) setTimeout(arrancar, 150);
  else global.addEventListener('ef:listo', () => setTimeout(arrancar, 150), { once: true });

  global.EF_puente = { traerPedidos, publicarStock, sembrarCatalogo };
})(window);
