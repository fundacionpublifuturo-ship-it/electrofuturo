/* ============================================================
   ELECTRO FUTURO — datos.js  v2
   Capa de datos compartida por index.html, admin.html y cuenta.html.
   Copia local de los pedidos para el portal de clientes (cuenta.html).
   El puente con el portal admin está en nube.js y supabase/puente.sql.
   es reemplazar cuerpos de función, no rehacer pantallas.
   ============================================================ */
(function (global) {
'use strict';

const CLAVE = 'ef_db_v2';
const CLAVE_VIEJA = 'ef_db_v1';

/* ============================================================
   1. LÍNEAS DE PRODUCTO — código corto y color fijo
   ============================================================ */
const LINEAS = [
  { cod:'ACC', slug:'accesorios',   nombre:'Accesorios',                   color:'#19C1D6' },
  { cod:'CAB', slug:'cables',       nombre:'Cargadores y cables',          color:'#2563EB' },
  { cod:'AUD', slug:'audio',        nombre:'Audio, diademas y parlantes',  color:'#7C3AED' },
  { cod:'PWB', slug:'powerbanks',   nombre:'Power banks y tomacorrientes', color:'#10B981' },
  { cod:'RLJ', slug:'relojes',      nombre:'Relojes inteligentes',         color:'#F59E0B' },
  { cod:'HER', slug:'herramientas', nombre:'Herramientas y repuestos',     color:'#64748B' },
  { cod:'PNT', slug:'pantallas',    nombre:'Pantallas',                    color:'#EF4444' },
  { cod:'BAT', slug:'baterias',     nombre:'Baterías',                     color:'#F97316' },
  { cod:'COM', slug:'computacion',  nombre:'Computación',                  color:'#4F46E5' },
  { cod:'STC', slug:'servicio',     nombre:'Servicio técnico',             color:'#2DD4BF' }
];
const LINEA = {};
LINEAS.forEach(l => { LINEA[l.cod] = l; });

function lineaDe(p) {
  if (!p) return 'ACC';
  const t = ((p.categoria || '') + ' ' + (p.subcategoria || '') + ' ' + (p.nombre || '')).toUpperCase();
  if (p.categoria === 'Pantallas') return 'PNT';
  if (p.categoria === 'Baterías')  return 'BAT';
  if (/RELOJ|SMARTWATCH|WATCH/.test(t)) return 'RLJ';
  if (/POWER ?BANK|TOMACORRIENTE|REGLETA|UPS/.test(t)) return 'PWB';
  if (/AUDIF|DIADEMA|PARLANTE|AUDIO|BUDS|SPEAKER|MICR/.test(t)) return 'AUD';
  if (/CARGADOR|CABLE|HDMI|USB|ADAPTADOR|HUB/.test(t)) return 'CAB';
  if (/PINZA|DESTORNILLA|HERRAMIENT|SOLDAD|FLUX|MALLA/.test(t)) return 'HER';
  if (p.categoria === 'Computación') return 'COM';
  return 'ACC';
}

/* ============================================================
   2. PIPELINE ÚNICO
   ============================================================ */
const ETAPAS = [
  { k:'cotizacion',   t:'Cotización',         desc:'El mayorista pidió precios', reserva:false, salida:false },
  { k:'confirmado',   t:'Pedido confirmado',  desc:'El cliente aceptó',          reserva:true,  salida:false },
  { k:'separado',     t:'Separado',           desc:'Stock apartado',             reserva:true,  salida:false },
  { k:'alistamiento', t:'En alistamiento',    desc:'Picking en bodega',          reserva:true,  salida:false },
  { k:'listo',        t:'Listo para entrega', desc:'Empacado y esperando',       reserva:false, salida:true  },
  { k:'despachado',   t:'Despachado',         desc:'Con la transportadora',      reserva:false, salida:true  },
  { k:'entregado',    t:'Entregado y pagado', desc:'Cerrado',                    reserva:false, salida:true  }
];
const ETAPA = {};
ETAPAS.forEach((e, i) => { ETAPA[e.k] = Object.assign({ orden: i }, e); });
ETAPA.anulado  = { k:'anulado',  t:'Anulado',  orden:98, reserva:false, salida:false };
ETAPA.devuelto = { k:'devuelto', t:'Devuelto', orden:99, reserva:false, salida:false };

const MOTIVOS_ANULACION = ['Sin stock','El cliente desistió','Precio','Error de digitación','Otro'];

const MIGRA_ESTADO = {
  nuevo:'confirmado', pago_verificado:'confirmado', alistando:'alistamiento',
  listo_recoger:'listo', despachado:'despachado', entregado:'entregado',
  anulado:'anulado', devuelto:'devuelto'
};

/* ============================================================
   3. ESTRUCTURA
   ============================================================ */
const VACIO = () => ({
  version: 2,
  inventario: {},
  clientes: [], pedidos: [], movimientos: [], cartera: [], caja: [],
  garantias: [], auditoria: [], proveedores: [], alistamientos: [],
  traslados: [], conteos: [], compras: [], seriales: [], avisos: [],
  seq: { pedido:0, cliente:0, compra:0, traslado:0, conteo:0 },
  config: {
    margenMinimo: 18,
    diasSinRotacion: 90,
    escalas: [ {desde:1,desc:0}, {desde:12,desc:5}, {desde:50,desc:10}, {desde:100,desc:15} ]
  }
});

let db = null;

function cargar() {
  if (db) return db;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) { db = Object.assign(VACIO(), JSON.parse(crudo)); }
    else {
      const viejo = localStorage.getItem(CLAVE_VIEJA);
      db = viejo ? migrar(JSON.parse(viejo)) : VACIO();
      if (viejo) guardar();
    }
  } catch (e) {
    console.error('Base local ilegible, se reinicia:', e);
    db = VACIO();
  }
  return db;
}

function migrar(v1) {
  const n = Object.assign(VACIO(), v1, { version: 2 });
  n.seq = Object.assign(VACIO().seq, v1.seq || {});
  n.config = VACIO().config;
  Object.values(n.inventario || {}).forEach(f => {
    f.ubicacion = f.ubicacion || { bodega:'Local', estante:'', nivel:'', caja:'' };
    f.escalas = f.escalas || [];
    f.proveedor = f.proveedor || '';
    f.serialado = !!f.serialado;
  });
  (n.pedidos || []).forEach(p => {
    p.estado = MIGRA_ESTADO[p.estado] || p.estado;
    (p.eventos || []).forEach(ev => { ev.estado = MIGRA_ESTADO[ev.estado] || ev.estado; });
    p.movido = p.movido || p.creado;
    p.canal = p.canal || (p.origen === 'mostrador' ? 'mostrador' : 'mayorista');
    p.linea = p.linea || lineaPedido(p);
  });
  ['alistamientos','traslados','conteos','compras','seriales','avisos','proveedores']
    .forEach(k => { n[k] = n[k] || []; });
  return n;
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(db));
    global.dispatchEvent(new CustomEvent('ef:datos'));
    return true;
  } catch (e) { console.error('No se pudo guardar:', e); return false; }
}

const hoy     = () => new Date().toISOString();
const soloDia = f => (f || hoy()).slice(0, 10);
const anio    = () => new Date().getFullYear();
const dias    = (a, b) => Math.floor((new Date(b || hoy()) - new Date(a)) / 864e5);
const consec  = (k, p, n) => p + String(++db.seq[k]).padStart(n, '0');

function registrar(tabla, accion, detalle, usuario) {
  db.auditoria.unshift({
    fecha: hoy(), tabla, accion, detalle,
    usuario: usuario || (global.Sesion && Sesion.actual() && Sesion.actual().nombre) || 'sistema'
  });
  db.auditoria = db.auditoria.slice(0, 600);
}

function lineaPedido(p) {
  const c = {};
  (p.items || []).forEach(i => { const l = i.linea || 'ACC'; c[l] = (c[l] || 0) + i.qty; });
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'ACC';
}

/* ============================================================
   4. API
   ============================================================ */
const Datos = {
  LINEAS, LINEA, ETAPAS, ETAPA, MOTIVOS_ANULACION, lineaDe,

  todo() { return cargar(); },
  config() { return cargar().config; },
  guardarConfig(c, u) { cargar(); Object.assign(db.config, c); registrar('config','editar','',u); guardar(); },

  /* ---------- INVENTARIO ---------- */
  fichaNueva(p) {
    return {
      stock:0, reservado:0, minimo:3, costo:0,
      precio: p ? p.precio || 0 : 0,
      escalas: [], activo:true, linea: lineaDe(p),
      ubicacion: { bodega:'Local', estante:'', nivel:'', caja:'' },
      proveedor:'', serialado:false, creado: hoy()
    };
  },
  inventario() { return cargar().inventario; },
  ficha(sku)   { return cargar().inventario[sku] || null; },
  disponible(sku) {
    const f = cargar().inventario[sku];
    if (!f) return null;
    return Math.max(0, (f.stock || 0) - (f.reservado || 0));
  },
  guardarFicha(sku, campos, usuario, producto) {
    cargar();
    const antes = db.inventario[sku];
    const f = Object.assign(antes || this.fichaNueva(producto), campos);
    if (campos.ubicacion) f.ubicacion = Object.assign({}, f.ubicacion, campos.ubicacion);
    db.inventario[sku] = f;
    const st0 = antes ? antes.stock : 0;
    if (f.stock !== st0) {
      db.movimientos.unshift({ fecha: hoy(), sku, tipo:'ajuste', cantidad: f.stock - st0,
        saldo: f.stock, motivo: antes ? 'Ajuste manual' : 'Alta en inventario',
        usuario: usuario || 'sistema' });
    }
    registrar('inventario', antes ? 'editar' : 'crear', sku, usuario);
    guardar();
    return f;
  },
  movimiento(sku, tipo, cantidad, motivo, usuario) {
    cargar();
    const f = db.inventario[sku];
    if (!f) return null;
    const suma = (tipo === 'entrada' || tipo === 'devolucion');
    f.stock = Math.max(0, f.stock + (suma ? cantidad : -cantidad));
    db.movimientos.unshift({ fecha: hoy(), sku, tipo, cantidad, saldo: f.stock,
      motivo: motivo || '', usuario: usuario || 'sistema' });
    db.movimientos = db.movimientos.slice(0, 2000);
    if (suma) this.resolverAvisos(sku);
    guardar();
    return f;
  },
  kardex(sku) { return cargar().movimientos.filter(m => !sku || m.sku === sku); },

  /* ---------- PRECIOS POR ESCALA ---------- */
  precioPara(sku, cantidad, precioBase) {
    cargar();
    const f = db.inventario[sku];
    const base = (f && f.precio) || precioBase || 0;
    if (f && f.escalas && f.escalas.length) {
      const e = f.escalas.filter(x => cantidad >= x.desde).sort((a, b) => b.desde - a.desde)[0];
      if (e) return { precio:e.precio, escala:e.desde, descuento: base ? Math.round((1 - e.precio / base) * 100) : 0 };
      return { precio:base, escala:1, descuento:0 };
    }
    const g = db.config.escalas.filter(x => cantidad >= x.desde).sort((a, b) => b.desde - a.desde)[0] || { desde:1, desc:0 };
    return { precio: Math.round(base * (1 - g.desc / 100)), escala:g.desde, descuento:g.desc };
  },

  /* ---------- CLIENTES ---------- */
  clientes() { return cargar().clientes; },
  cliente(id) { return cargar().clientes.find(c => c.id === id) || null; },
  clientePorTelefono(tel) {
    const t = String(tel || '').replace(/\D/g, '');
    if (!t) return null;
    return cargar().clientes.find(c => String(c.telefono).replace(/\D/g, '') === t) || null;
  },
  guardarCliente(datos, usuario) {
    cargar();
    let c = datos.id ? db.clientes.find(x => x.id === datos.id) : null;
    if (!c && datos.telefono) c = this.clientePorTelefono(datos.telefono);
    if (c) {
      Object.keys(datos).forEach(k => {
        if (k !== 'id' && datos[k] !== undefined && datos[k] !== '') c[k] = datos[k];
      });
      registrar('clientes', 'editar', c.nombre, usuario);
    } else {
      c = Object.assign({ id: consec('cliente','C',4), tipo:'minorista', ciudad:'Ibagué',
                          creado: hoy(), notas:'' }, datos);
      db.clientes.push(c);
      registrar('clientes', 'crear', c.nombre, usuario);
    }
    guardar();
    return c;
  },

  /* ---------- PEDIDOS ---------- */
  pedidos() { return cargar().pedidos; },
  pedido(codigo) { return cargar().pedidos.find(p => p.codigo === codigo) || null; },
  pedidosDeCliente(id) { return cargar().pedidos.filter(p => p.clienteId === id); },
  pedidosDeLinea(cod) {
    return cargar().pedidos.filter(p => (p.items || []).some(i => (i.linea || 'ACC') === cod));
  },

  crearPedido(datos, usuario) {
    cargar();
    const cliente = this.guardarCliente({
      nombre: datos.cliente.nombre, telefono: datos.cliente.telefono,
      correo: datos.cliente.correo, ciudad: datos.cliente.ciudad,
      direccion: datos.cliente.direccion,
      autoriza_datos: !!datos.consentimiento,
      autoriza_fecha: datos.consentimiento ? datos.consentimiento.fecha : undefined
    }, usuario);

    const items = datos.items.map(i => Object.assign({ linea:i.linea || 'ACC' }, i));
    const estado = datos.estado || 'confirmado';
    const p = {
      codigo: datos.codigo || `EF-${anio()}-${String(++db.seq.pedido).padStart(5, '0')}`,
      clienteId: cliente.id, cliente: Object.assign({}, datos.cliente), items,
      linea: lineaPedido({ items }),
      canal: datos.canal || (datos.origen === 'mostrador' ? 'mostrador' : 'mayorista'),
      entrega: datos.entrega, metodoPago: datos.metodoPago || '',
      referenciaPago: datos.referenciaPago || '',
      subtotal: datos.subtotal || 0, descuento: datos.descuento || 0,
      envio: datos.envio || 0, total: datos.total || 0,
      pagado: !!datos.pagado, estado, motivoAnulacion:'',
      transportadora:'', guia:'', origen: datos.origen || 'web',
      vendedor: usuario || 'web', creado: hoy(), movido: hoy(),
      eventos: [{ fecha: hoy(), estado, nota:'Pedido recibido', usuario: usuario || 'web' }],
      consentimiento: datos.consentimiento || null
    };

    if (ETAPA[estado] && ETAPA[estado].reserva) this._reservar(p, +1);
    if (ETAPA[estado] && ETAPA[estado].salida)  this._descontar(p, usuario);

    db.pedidos.unshift(p);

    if (!p.pagado && p.total > 0 && estado !== 'cotizacion') {
      db.cartera.push({ id:'CT' + p.codigo, clienteId:cliente.id, pedido:p.codigo,
        monto:p.total, abonado:0,
        vence: soloDia(new Date(Date.now() + 15 * 864e5).toISOString()), estado:'pendiente' });
    } else if (p.pagado) {
      db.caja.push({ fecha:soloDia(), tipo:'ingreso', categoria:'Venta',
        descripcion:'Pedido ' + p.codigo, monto:p.total, metodo:p.metodoPago,
        pedido:p.codigo, usuario: usuario || 'web' });
    }
    registrar('pedidos', 'crear', p.codigo, usuario);
    guardar();
    return p;
  },

  _reservar(p, signo) {
    p.items.forEach(i => {
      const f = db.inventario[i.sku];
      if (f) f.reservado = Math.max(0, (f.reservado || 0) + signo * i.qty);
    });
  },
  _descontar(p, usuario) {
    p.items.forEach(i => {
      const f = db.inventario[i.sku];
      if (!f) return;
      f.stock = Math.max(0, (f.stock || 0) - i.qty);
      db.movimientos.unshift({ fecha:hoy(), sku:i.sku, tipo:'salida', cantidad:i.qty,
        saldo:f.stock, motivo:'Pedido ' + p.codigo, usuario: usuario || 'sistema' });
    });
  },
  _devolver(p, usuario) {
    p.items.forEach(i => {
      const f = db.inventario[i.sku];
      if (!f) return;
      f.stock += i.qty;
      db.movimientos.unshift({ fecha:hoy(), sku:i.sku, tipo:'devolucion', cantidad:i.qty,
        saldo:f.stock, motivo:'Reversa ' + p.codigo, usuario: usuario || 'sistema' });
    });
  },

  cambiarEstado(codigo, estado, nota, usuario, motivo) {
    cargar();
    const p = db.pedidos.find(x => x.codigo === codigo);
    if (!p || p.estado === estado) return p;
    const a = ETAPA[p.estado] || { reserva:false, salida:false };
    const b = ETAPA[estado]   || { reserva:false, salida:false };
    if (!a.reserva && b.reserva) this._reservar(p, +1);
    if (a.reserva && !b.reserva) this._reservar(p, -1);
    if (!a.salida && b.salida)   this._descontar(p, usuario);
    if (a.salida && !b.salida)   this._devolver(p, usuario);

    p.estado = estado;
    p.movido = hoy();
    if (estado === 'anulado') p.motivoAnulacion = motivo || 'Otro';
    if (estado === 'entregado') p.pagado = true;
    p.eventos.push({ fecha:hoy(), estado,
      nota: nota || (motivo ? 'Motivo: ' + motivo : ''), usuario: usuario || 'sistema' });

    if (estado === 'anulado') {
      const ct = db.cartera.find(c => c.pedido === codigo);
      if (ct) ct.estado = 'anulada';
    }
    if (estado === 'entregado') {
      const ct = db.cartera.find(c => c.pedido === codigo);
      if (ct && ct.estado !== 'pagada') { ct.abonado = ct.monto; ct.estado = 'pagada'; }
    }
    registrar('pedidos', 'estado', `${codigo} → ${(ETAPA[estado] || {}).t || estado}`, usuario);
    guardar();
    return p;
  },

  actualizarPedido(codigo, campos, usuario) {
    cargar();
    const p = db.pedidos.find(x => x.codigo === codigo);
    if (!p) return null;
    Object.assign(p, campos);
    registrar('pedidos', 'editar', codigo, usuario);
    guardar();
    return p;
  },

  marcarPagado(codigo, metodo, usuario) {
    cargar();
    const p = db.pedidos.find(x => x.codigo === codigo);
    if (!p || p.pagado) return p;
    p.pagado = true;
    p.metodoPago = metodo || p.metodoPago;
    const ct = db.cartera.find(c => c.pedido === codigo);
    if (ct) { ct.abonado = ct.monto; ct.estado = 'pagada'; }
    db.caja.push({ fecha:soloDia(), tipo:'ingreso', categoria:'Venta',
      descripcion:'Pedido ' + codigo, monto:p.total, metodo:p.metodoPago,
      pedido:codigo, usuario: usuario || 'sistema' });
    registrar('pedidos', 'pago', codigo, usuario);
    guardar();
    return p;
  },

  /* ---------- ALISTAMIENTO ---------- */
  alistamientos() { return cargar().alistamientos; },
  alistamientoDe(codigo) { return cargar().alistamientos.find(a => a.pedido === codigo) || null; },

  generarAlistamiento(codigo, usuario) {
    cargar();
    const p = db.pedidos.find(x => x.codigo === codigo);
    if (!p) return null;
    const ya = db.alistamientos.find(x => x.pedido === codigo);
    if (ya) return ya;
    const lineas = p.items.map(i => {
      const u = (db.inventario[i.sku] || {}).ubicacion || {};
      return {
        sku:i.sku, nombre:i.nombre, pedida:i.qty, recogida:0, faltante:0,
        ubicacion: [u.bodega, u.estante, u.nivel, u.caja].filter(Boolean).join(' · ') || 'Sin ubicación',
        orden: [u.bodega || 'zzz', u.estante || 'zzz', u.nivel || 'zzz', u.caja || 'zzz'].join('|')
      };
    }).sort((x, y) => x.orden.localeCompare(y.orden, 'es'));
    const a = { pedido:codigo, cliente:p.cliente.nombre, estado:'abierto',
                creado:hoy(), usuario: usuario || 'sistema', lineas };
    db.alistamientos.unshift(a);
    if (p.estado !== 'alistamiento') this.cambiarEstado(codigo, 'alistamiento', 'Lista de alistamiento generada', usuario);
    registrar('alistamiento', 'crear', codigo, usuario);
    guardar();
    return a;
  },

  marcarRecogido(codigo, sku, cantidad) {
    cargar();
    const a = db.alistamientos.find(x => x.pedido === codigo);
    if (!a) return null;
    const l = a.lineas.find(x => x.sku === sku);
    if (!l) return null;
    l.recogida = Math.max(0, Math.min(l.pedida, Number(cantidad) || 0));
    l.faltante = l.pedida - l.recogida;
    a.estado = a.lineas.every(x => x.recogida === x.pedida) ? 'completo'
             : a.lineas.some(x => x.recogida > 0) ? 'parcial' : 'abierto';
    guardar();
    return a;
  },

  cerrarAlistamiento(codigo, usuario) {
    cargar();
    const a = db.alistamientos.find(x => x.pedido === codigo);
    if (!a) return null;
    a.estado = 'cerrado';
    a.cerrado = hoy();
    this.cambiarEstado(codigo, 'listo', 'Alistamiento cerrado', usuario);
    registrar('alistamiento', 'cerrar', codigo, usuario);
    guardar();
    return a;
  },

  /* ---------- TRASLADOS ---------- */
  traslados() { return cargar().traslados; },
  crearTraslado(t, usuario) {
    cargar();
    const tr = Object.assign({ id: consec('traslado','TR-',4), estado:'en_transito',
                               creado: hoy(), usuario: usuario || 'sistema' }, t);
    tr.lineas.forEach(l => {
      const f = db.inventario[l.sku];
      if (!f) return;
      f.stock = Math.max(0, f.stock - l.cantidad);
      db.movimientos.unshift({ fecha:hoy(), sku:l.sku, tipo:'salida', cantidad:l.cantidad,
        saldo:f.stock, motivo:`Traslado ${tr.id} → ${tr.destino}`, usuario: usuario || 'sistema' });
    });
    db.traslados.unshift(tr);
    registrar('traslados', 'crear', tr.id, usuario);
    guardar();
    return tr;
  },
  recibirTraslado(id, usuario) {
    cargar();
    const tr = db.traslados.find(x => x.id === id);
    if (!tr || tr.estado === 'recibido') return tr;
    tr.estado = 'recibido';
    tr.recibido = hoy();
    tr.lineas.forEach(l => {
      const f = db.inventario[l.sku];
      if (!f) return;
      f.stock += l.cantidad;
      f.ubicacion = Object.assign({}, f.ubicacion, { bodega: tr.destino });
      db.movimientos.unshift({ fecha:hoy(), sku:l.sku, tipo:'entrada', cantidad:l.cantidad,
        saldo:f.stock, motivo:`Traslado ${tr.id} recibido en ${tr.destino}`, usuario: usuario || 'sistema' });
    });
    registrar('traslados', 'recibir', id, usuario);
    guardar();
    return tr;
  },

  /* ---------- CONTEO CÍCLICO ---------- */
  conteos() { return cargar().conteos; },
  sugerirConteo(n) {
    cargar();
    const abc = this.abc();
    const ultimo = {};
    db.conteos.forEach(c => c.lineas.forEach(l => {
      if (!ultimo[l.sku] || ultimo[l.sku] < c.creado) ultimo[l.sku] = c.creado;
    }));
    return Object.keys(db.inventario)
      .map(sku => ({ sku, clase:(abc[sku] || {}).clase || 'C', ultimo: ultimo[sku] || '' }))
      .sort((a, b) => ('ABC'.indexOf(a.clase) - 'ABC'.indexOf(b.clase))
                   || String(a.ultimo).localeCompare(String(b.ultimo)))
      .slice(0, n || 12);
  },
  crearConteo(skus, usuario) {
    cargar();
    const c = { id: consec('conteo','CC-',4), estado:'abierto', creado:hoy(),
      usuario: usuario || 'sistema',
      lineas: skus.map(sku => ({ sku, sistema:(db.inventario[sku] || {}).stock || 0,
                                 contado:null, diferencia:0, motivo:'' })) };
    db.conteos.unshift(c);
    registrar('conteos', 'crear', c.id, usuario);
    guardar();
    return c;
  },
  registrarConteo(id, sku, contado, motivo) {
    cargar();
    const c = db.conteos.find(x => x.id === id);
    if (!c) return null;
    const l = c.lineas.find(x => x.sku === sku);
    if (!l) return null;
    l.contado = contado === '' || contado == null ? null : Number(contado);
    l.diferencia = l.contado == null ? 0 : l.contado - l.sistema;
    if (motivo !== undefined) l.motivo = motivo;
    guardar();
    return c;
  },
  cerrarConteo(id, usuario) {
    cargar();
    const c = db.conteos.find(x => x.id === id);
    if (!c) return null;
    c.lineas.forEach(l => {
      if (l.contado == null || l.diferencia === 0) return;
      const f = db.inventario[l.sku];
      if (!f) return;
      f.stock = l.contado;
      db.movimientos.unshift({ fecha:hoy(), sku:l.sku, tipo:'ajuste', cantidad:l.diferencia,
        saldo:f.stock, motivo:`Conteo ${c.id}${l.motivo ? ' · ' + l.motivo : ''}`,
        usuario: usuario || 'sistema' });
    });
    c.estado = 'cerrado';
    c.cerrado = hoy();
    registrar('conteos', 'cerrar', id, usuario);
    guardar();
    return c;
  },

  /* ---------- ROTACIÓN, ABC Y REPOSICIÓN ---------- */
  ventaPorSku(d) {
    cargar();
    const corte = new Date(Date.now() - (d || 90) * 864e5).toISOString();
    const r = {};
    db.pedidos.filter(p => p.estado !== 'anulado' && p.estado !== 'cotizacion' && p.creado >= corte)
      .forEach(p => p.items.forEach(i => {
        const a = r[i.sku] || (r[i.sku] = { unidades:0, valor:0, ultima:'' });
        a.unidades += i.qty;
        a.valor += i.precio * i.qty;
        if (p.creado > a.ultima) a.ultima = p.creado;
      }));
    return r;
  },
  abc(d) {
    const v = this.ventaPorSku(d || 180);
    const filas = Object.entries(v).map(([sku, x]) => ({ sku, valor:x.valor }))
      .sort((a, b) => b.valor - a.valor);
    const total = filas.reduce((a, f) => a + f.valor, 0) || 1;
    let acum = 0;
    const r = {};
    filas.forEach(f => {
      /* Se clasifica con el acumulado ANTES de sumar esta referencia: así la
         más vendida siempre queda en A, incluso si ella sola es el 100 %. */
      const antes = acum / total;
      acum += f.valor;
      r[f.sku] = { valor:f.valor, acumulado: acum / total,
                   clase: antes < .8 ? 'A' : antes < .95 ? 'B' : 'C' };
    });
    Object.keys(cargar().inventario).forEach(sku => {
      if (!r[sku]) r[sku] = { valor:0, acumulado:1, clase:'C' };
    });
    return r;
  },
  capitalInmovilizado() {
    cargar();
    const abc = this.abc();
    let total = 0, c = 0;
    Object.entries(db.inventario).forEach(([sku, f]) => {
      const v = f.stock * (f.costo || 0);
      total += v;
      if (((abc[sku] || {}).clase || 'C') === 'C') c += v;
    });
    return { total, claseC: c };
  },
  reposicion() {
    cargar();
    const v = this.ventaPorSku(90);
    const abc = this.abc();
    const r = {};
    Object.entries(db.inventario).forEach(([sku, f]) => {
      if (!f.activo) return;
      const diario = ((v[sku] || {}).unidades || 0) / 90;
      const prov = db.proveedores.find(p => p.nombre === f.proveedor);
      const entrega = prov ? (prov.dias || 7) : 7;
      const punto = Math.ceil(diario * entrega) + f.minimo;
      const disp = f.stock - f.reservado;
      if (disp > punto) return;
      const sugerido = Math.max(f.minimo, Math.ceil(diario * entrega * 2)) || f.minimo || 1;
      const key = f.proveedor || 'Sin proveedor asignado';
      (r[key] || (r[key] = [])).push({ sku, disponible:disp, punto, sugerido,
        clase:(abc[sku] || {}).clase || 'C', costo:f.costo, valor: sugerido * (f.costo || 0) });
    });
    return r;
  },

  proveedores() { return cargar().proveedores; },
  guardarProveedor(p, u) {
    cargar();
    const ex = db.proveedores.find(x => x.nombre === p.nombre);
    if (ex) Object.assign(ex, p);
    else db.proveedores.push(Object.assign({ dias:7, telefono:'' }, p));
    registrar('proveedores', ex ? 'editar' : 'crear', p.nombre, u);
    guardar();
  },

  compras() { return cargar().compras; },
  crearCompra(proveedor, lineas, usuario) {
    cargar();
    const c = { id: consec('compra','OC-',4), proveedor, lineas, estado:'enviada',
      creado:hoy(), usuario: usuario || 'sistema',
      total: lineas.reduce((a, l) => a + l.sugerido * (l.costo || 0), 0) };
    db.compras.unshift(c);
    registrar('compras', 'crear', c.id, usuario);
    guardar();
    return c;
  },
  recibirCompra(id, usuario) {
    cargar();
    const c = db.compras.find(x => x.id === id);
    if (!c || c.estado === 'recibida') return c;
    c.estado = 'recibida';
    c.recibido = hoy();
    c.lineas.forEach(l => this.movimiento(l.sku, 'entrada', l.sugerido, 'Compra ' + c.id, usuario));
    db.caja.push({ fecha:soloDia(), tipo:'egreso', categoria:'Compra de mercancía',
      descripcion:`Compra ${c.id} · ${c.proveedor}`, monto:c.total, metodo:'',
      usuario: usuario || 'sistema' });
    registrar('compras', 'recibir', id, usuario);
    guardar();
    return c;
  },

  /* ---------- SERIALES ---------- */
  seriales(sku) { return cargar().seriales.filter(s => !sku || s.sku === sku); },
  registrarSerial(sku, serial, origen, usuario) {
    cargar();
    if (!serial || db.seriales.some(s => s.serial === serial)) return null;
    const s = { serial, sku, estado:'en_stock', origen: origen || '', pedido:'', fecha: hoy() };
    db.seriales.unshift(s);
    registrar('seriales', 'entrada', serial, usuario);
    guardar();
    return s;
  },
  salidaSerial(serial, pedido, usuario) {
    cargar();
    const s = db.seriales.find(x => x.serial === serial);
    if (!s) return null;
    s.estado = 'vendido'; s.pedido = pedido; s.salida = hoy();
    registrar('seriales', 'salida', serial, usuario);
    guardar();
    return s;
  },

  /* ---------- AVÍSAME CUANDO LLEGUE ---------- */
  avisos() { return cargar().avisos; },
  pedirAviso(sku, nombre, telefono) {
    cargar();
    if (db.avisos.some(a => a.sku === sku && a.telefono === telefono && a.estado !== 'avisado')) return null;
    const a = { sku, nombre, telefono, estado:'pendiente', fecha: hoy() };
    db.avisos.unshift(a);
    guardar();
    return a;
  },
  resolverAvisos(sku) {
    cargar();
    db.avisos.filter(a => a.sku === sku && a.estado === 'pendiente')
             .forEach(a => { a.estado = 'por_avisar'; });
  },
  marcarAvisado(sku, telefono) {
    cargar();
    const a = db.avisos.find(x => x.sku === sku && x.telefono === telefono);
    if (a) { a.estado = 'avisado'; a.avisado = hoy(); guardar(); }
  },

  /* ---------- CARTERA Y CAJA ---------- */
  cartera() { return cargar().cartera; },
  abonar(id, monto, metodo, usuario) {
    cargar();
    const c = db.cartera.find(x => x.id === id);
    if (!c) return null;
    c.abonado = Math.min(c.monto, (c.abonado || 0) + monto);
    c.estado = c.abonado >= c.monto ? 'pagada' : 'parcial';
    db.caja.push({ fecha:soloDia(), tipo:'ingreso', categoria:'Abono',
      descripcion:'Abono ' + c.pedido, monto, metodo: metodo || '',
      pedido:c.pedido, usuario: usuario || 'sistema' });
    if (c.estado === 'pagada') {
      const p = db.pedidos.find(x => x.codigo === c.pedido);
      if (p) p.pagado = true;
    }
    registrar('cartera', 'abono', c.pedido, usuario);
    guardar();
    return c;
  },
  caja() { return cargar().caja; },
  movimientoCaja(m, usuario) {
    cargar();
    db.caja.push(Object.assign({ fecha:soloDia(), usuario: usuario || 'sistema' }, m));
    registrar('caja', m.tipo, m.descripcion, usuario);
    guardar();
  },
  costoPedido(p) {
    cargar();
    return (p.items || []).reduce((a, i) => a + ((db.inventario[i.sku] || {}).costo || 0) * i.qty, 0);
  },

  /* ---------- GARANTÍAS ---------- */
  garantias() { return cargar().garantias; },
  radicarGarantia(g, usuario) {
    cargar();
    g.id = 'G' + Date.now().toString(36).toUpperCase();
    g.estado = 'radicada';
    g.creado = hoy();
    g.vence = new Date(Date.now() + 30 * 864e5).toISOString();
    db.garantias.unshift(g);
    registrar('garantias', 'radicar', g.id, usuario);
    guardar();
    return g;
  },
  estadoGarantia(id, estado, nota, usuario) {
    cargar();
    const g = db.garantias.find(x => x.id === id);
    if (!g) return null;
    g.estado = estado; g.nota = nota || g.nota;
    registrar('garantias', estado, id, usuario);
    guardar();
    return g;
  },

  /* ============================================================
     MOTOR DE ALERTAS — cada alerta trae su acción y su WhatsApp listo
     ============================================================ */
  alertas(catalogo) {
    cargar();
    const cat = catalogo || global.EF_PRODUCTOS || [];
    const nom = sku => { const p = cat.find(x => x.sku === sku); return p ? p.nombre : sku; };
    const abc = this.abc();
    const v = this.ventaPorSku(this.config().diasSinRotacion);
    const A = [];
    const push = o => A.push(Object.assign({ id:'A' + (A.length + 1) }, o));

    Object.entries(db.inventario).forEach(([sku, f]) => {
      if (!f.activo) return;
      const disp = f.stock - f.reservado;
      const clase = (abc[sku] || {}).clase || 'C';
      if (disp <= 0 && clase === 'A') {
        push({ prio:'critico', area:'inventario', tema:'Stock', ref:sku,
          titulo:`${nom(sku)} en cero`,
          mensaje:'Es una referencia clase A: de las que más venden, y está agotada.',
          accion:'Pedido urgente al proveedor',
          wa:{ tel:'', texto:`Hola 👋 necesito reposición *urgente* de *${nom(sku)}* (${sku}). ¿Cuántas unidades tienes y en cuánto las despachas?` } });
      } else if (disp <= f.minimo) {
        /* disp puede ser negativo si hay más comprometido que stock físico:
           eso no se muestra como "quedan -1", se dice lo que realmente pasa. */
        push({ prio: disp <= 0 ? 'critico' : 'urgente', area:'inventario', tema:'Stock', ref:sku,
          titulo: disp < 0 ? `${nom(sku)} comprometido de más` : `${nom(sku)} bajo el mínimo`,
          mensaje: disp < 0
            ? `Hay ${f.stock} en bodega y ${f.reservado} comprometidos en pedidos: faltan ${-disp}.`
            : `Quedan ${disp} disponibles y el mínimo es ${f.minimo}.`,
          accion: disp < 0 ? 'Conseguir el faltante o avisar al cliente' : 'Reponer' });
      }
      if (f.costo && f.precio) {
        const m = Math.round((1 - f.costo / f.precio) * 100);
        if (m < this.config().margenMinimo) push({ prio:'urgente', area:'inventario', tema:'Margen', ref:sku,
          titulo:`Margen de ${m} % en ${nom(sku)}`,
          mensaje:`Por debajo del mínimo definido (${this.config().margenMinimo} %).`,
          accion:'Revisar precio o costo' });
      }
      if (f.stock > 0 && !(v[sku] || {}).ultima) {
        push({ prio:'proximo', area:'inventario', tema:'Rotación', ref:sku,
          titulo:`${nom(sku)} sin rotación`,
          mensaje:`No se vende hace más de ${this.config().diasSinRotacion} días y hay ${f.stock} unidades en bodega.`,
          accion:'Liquidar o promocionar' });
      }
    });

    db.pedidos.forEach(p => {
      const q = dias(p.movido || p.creado);
      if (p.pagado && ['confirmado','separado'].includes(p.estado) && q >= 2) {
        push({ prio:'critico', area:'pipeline', tema:'Despacho', ref:p.codigo,
          titulo:`${p.codigo} pagado sin despachar`,
          mensaje:`Lleva ${q} días quieto y el cliente ya pagó.`,
          accion:'Alistar y despachar',
          wa:{ tel:p.cliente.telefono, texto:`Hola ${p.cliente.nombre} 👋 tu pedido *${p.codigo}* entra hoy a alistamiento. Te confirmo la hora de salida.` } });
      }
      if (p.estado === 'alistamiento' && q >= 1) {
        push({ prio:'urgente', area:'pipeline', tema:'Alistamiento', ref:p.codigo,
          titulo:`${p.codigo} lleva ${q} día(s) en alistamiento`,
          mensaje:'Un alistamiento no debería pasar del día.', accion:'Revisar con bodega' });
      }
      if (p.estado === 'cotizacion' && q >= 3) {
        push({ prio:'urgente', area:'pipeline', tema:'Cotización', ref:p.codigo,
          titulo:`Cotización ${p.codigo} sin respuesta`,
          mensaje:`${q} días desde que se envió.`, accion:'Seguimiento por WhatsApp',
          wa:{ tel:p.cliente.telefono, texto:`Hola ${p.cliente.nombre} 👋 te escribo por la cotización *${p.codigo}*. ¿La alcanzaste a revisar? Puedo ajustar cantidades o precios.` } });
      }
    });

    const hoyD = soloDia();
    db.cartera.filter(c => !['pagada','anulada'].includes(c.estado) && c.vence < hoyD).forEach(c => {
      const cli = this.cliente(c.clienteId) || {};
      const saldo = c.monto - c.abonado;
      push({ prio:'critico', area:'cartera', tema:'Cartera', ref:c.pedido,
        titulo:`Cartera vencida de ${cli.nombre || 'cliente'}`,
        mensaje:`Saldo de $${saldo.toLocaleString('es-CO')}, venció el ${c.vence}.`,
        accion:'Cobrar',
        wa:{ tel:cli.telefono, texto:`Hola ${cli.nombre || ''} 👋 te recuerdo el saldo de *$${saldo.toLocaleString('es-CO')}* del pedido *${c.pedido}*. ¿Lo puedes abonar esta semana?` } });
    });

    db.conteos.filter(c => c.estado === 'abierto').forEach(c => {
      const d = c.lineas.filter(l => l.contado != null && l.diferencia !== 0 && !l.motivo);
      if (d.length) push({ prio:'urgente', area:'bodega', tema:'Inventario', ref:c.id,
        titulo:`${d.length} diferencia(s) sin justificar en ${c.id}`,
        mensaje:'Un conteo con diferencias sin motivo no sirve como auditoría.',
        accion:'Investigar' });
    });

    db.garantias.filter(g => !['resuelta','rechazada'].includes(g.estado) && g.vence).forEach(g => {
      const f = dias(hoy(), g.vence);
      if (f >= 0 && f <= 5) push({ prio:'proximo', area:'garantias', tema:'Garantías', ref:g.id,
        titulo:`Garantía ${g.id} vence en ${f} día(s)`,
        mensaje:`Caso de ${g.cliente || 'cliente'} todavía abierto.`, accion:'Avisar al cliente' });
    });

    db.clientes.filter(c => c.tipo === 'mayorista').forEach(c => {
      const ult = this.pedidosDeCliente(c.id).filter(p => p.estado !== 'anulado')
        .map(p => p.creado).sort().pop();
      const d = ult ? dias(ult) : 999;
      if (d > 45) push({ prio:'proximo', area:'clientes', tema:'Reactivación', ref:c.id,
        titulo:`${c.nombre} sin comprar hace ${ult ? d + ' días' : 'nunca'}`,
        mensaje:'Es mayorista: vale la pena reactivarlo antes de que compre en otro lado.',
        accion:'Reactivar',
        wa:{ tel:c.telefono, texto:`Hola ${c.nombre} 👋 llegó mercancía nueva y quiero pasarte la *lista mayorista actualizada*. ¿Te la mando?` } });
    });

    db.avisos.filter(a => a.estado === 'por_avisar').forEach(a => {
      push({ prio:'urgente', area:'inventario', tema:'Reposición', ref:a.sku,
        titulo:`${a.nombre} espera aviso de ${nom(a.sku)}`,
        mensaje:'Pidió que le avisaran cuando entrara y ya hay stock.',
        accion:'Avisarle que llegó',
        wa:{ tel:a.telefono, texto:`Hola ${a.nombre} 👋 ya llegó el *${nom(a.sku)}* que estabas esperando. ¿Te lo separo?` } });
    });

    const peso = { critico:0, urgente:1, proximo:2 };
    return A.sort((a, b) => peso[a.prio] - peso[b.prio]);
  },

  /* ---------- UTILIDADES ---------- */
  auditoria() { return cargar().auditoria; },
  exportar() { return JSON.stringify(cargar(), null, 2); },
  importar(texto) {
    const n = JSON.parse(texto);
    if (!n || typeof n !== 'object') throw new Error('Archivo inválido');
    db = n.version === 2 ? Object.assign(VACIO(), n) : migrar(n);
    guardar();
    return db;
  },
  vaciar() { db = VACIO(); guardar(); }
};

/* ============================================================
   5. SESIÓN Y PERMISOS
   ============================================================ */
const USUARIOS = [
  { clave:'c0m3rc14l', rol:'comercial', nombre:'Comercial' },
  { clave:'g3r3nc14',  rol:'gerencia',  nombre:'Gerencia'  },
  { clave:'b0d3g4',    rol:'bodega',    nombre:'Bodega'    }
];

const PERMISOS = {
  comercial: ['inicio','pipeline','lineas','clientes','inventario','cartera','gestion','garantias','alertas'],
  gerencia:  ['inicio','pipeline','lineas','clientes','inventario','bodega','compras',
              'cartera','finanzas','gestion','garantias','alertas','ajustes'],
  bodega:    ['inicio','pipeline','inventario','bodega','compras','gestion','alertas']
};

const Sesion = {
  USUARIOS,
  entrar(u, c) {
    const a = String(u || '').trim().toLowerCase();
    const b = String(c || '').trim().toLowerCase();
    const x = USUARIOS.find(y => y.clave === a && y.clave === b);
    if (!x) return null;
    sessionStorage.setItem('ef_sesion', JSON.stringify(x));
    return x;
  },
  actual() { try { return JSON.parse(sessionStorage.getItem('ef_sesion') || 'null'); } catch { return null; } },
  salir() { sessionStorage.removeItem('ef_sesion'); },
  rol() { const s = this.actual(); return s ? s.rol : null; },
  puede(area) { return (PERMISOS[this.rol()] || []).includes(area); },
  /* Costos y utilidad: solo gerencia. Precios de venta: todos menos bodega.
     Ocultar en pantalla no basta; en producción esto se refuerza con RLS. */
  veCostos()   { return this.rol() === 'gerencia'; },
  vePrecios()  { return this.rol() !== 'bodega'; },
  veFinanzas() { return this.rol() === 'gerencia'; },
  edita(que) {
    const r = this.rol();
    if (r === 'gerencia') return true;
    if (r === 'comercial') return ['pedidos','clientes','cartera','garantias','cotizacion'].includes(que);
    if (r === 'bodega')    return ['inventario','alistamiento','traslado','conteo','compras'].includes(que);
    return false;
  }
};

global.Datos = Datos;
global.Sesion = Sesion;
})(window);
