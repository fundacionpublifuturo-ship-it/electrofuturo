/* ============================================================
   ELECTRO FUTURO — datos.js
   Capa de datos compartida por index.html, admin.html y cuenta.html.

   Hoy guarda en localStorage (funciona sin servidor, pero cada
   dispositivo tiene su copia). Para compartir datos entre equipos hay
   que pasar a Supabase: el esquema está en supabase/schema.sql y todas
   las funciones de abajo ya son async, así que solo cambia el cuerpo.
   ============================================================ */
(function (global) {
  'use strict';

  const CLAVE = 'ef_db_v1';

  const VACIO = () => ({
    version: 1,
    inventario: {},      // sku -> {stock, reservado, minimo, costo, precio, activo}
    clientes: [],
    pedidos: [],
    movimientos: [],
    cartera: [],
    caja: [],
    garantias: [],
    auditoria: [],
    seq: { pedido: 0, cliente: 0 }
  });

  let db = null;

  function cargar() {
    if (db) return db;
    try {
      const crudo = localStorage.getItem(CLAVE);
      db = crudo ? Object.assign(VACIO(), JSON.parse(crudo)) : VACIO();
    } catch (e) {
      console.error('Base local corrupta, se reinicia:', e);
      db = VACIO();
    }
    return db;
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(db));
      global.dispatchEvent(new CustomEvent('ef:datos'));
      return true;
    } catch (e) {
      console.error('No se pudo guardar:', e);
      return false;
    }
  }

  const hoy = () => new Date().toISOString();
  const anio = () => new Date().getFullYear();

  function registrar(tabla, accion, detalle, usuario) {
    db.auditoria.unshift({
      fecha: hoy(), tabla, accion, detalle,
      usuario: usuario || (global.Sesion && Sesion.actual() && Sesion.actual().nombre) || 'sistema'
    });
    db.auditoria = db.auditoria.slice(0, 500);
  }

  /* ---------------------------------------------------------- INVENTARIO */
  const ESTADOS = ['nuevo', 'pago_verificado', 'alistando', 'listo_recoger',
                   'despachado', 'entregado', 'anulado', 'devuelto'];

  const ETIQUETA_ESTADO = {
    nuevo: 'Nuevo',
    pago_verificado: 'Pago verificado',
    alistando: 'Alistando',
    listo_recoger: 'Listo para recoger',
    despachado: 'Despachado',
    entregado: 'Entregado',
    anulado: 'Anulado',
    devuelto: 'Devuelto'
  };

  const Datos = {
    ESTADOS, ETIQUETA_ESTADO,

    todo() { return cargar(); },

    /* --- inventario --- */
    inventario() { return cargar().inventario; },

    ficha(sku) { return cargar().inventario[sku] || null; },

    /* Disponible = stock físico menos lo reservado por pedidos abiertos.
       Si el SKU nunca se dio de alta en inventario devuelve null: eso
       significa "sin control de stock", no "agotado". */
    disponible(sku) {
      const f = cargar().inventario[sku];
      if (!f) return null;
      return Math.max(0, (f.stock || 0) - (f.reservado || 0));
    },

    guardarFicha(sku, campos, usuario) {
      cargar();
      const antes = db.inventario[sku];
      const f = Object.assign(
        { stock: 0, reservado: 0, minimo: 3, costo: 0, precio: 0, activo: true },
        antes || {}, campos
      );
      db.inventario[sku] = f;
      if (!antes || antes.stock !== f.stock) {
        db.movimientos.unshift({
          fecha: hoy(), sku, tipo: 'ajuste',
          cantidad: f.stock - ((antes && antes.stock) || 0),
          saldo: f.stock, motivo: antes ? 'Ajuste manual' : 'Alta en inventario',
          usuario: usuario || 'sistema'
        });
      }
      registrar('inventario', antes ? 'editar' : 'crear', sku, usuario);
      guardar();
      return f;
    },

    movimiento(sku, tipo, cantidad, motivo, usuario) {
      cargar();
      const f = db.inventario[sku];
      if (!f) return null;
      f.stock = Math.max(0, f.stock + (tipo === 'entrada' ? cantidad : -cantidad));
      db.movimientos.unshift({
        fecha: hoy(), sku, tipo, cantidad, saldo: f.stock,
        motivo: motivo || '', usuario: usuario || 'sistema'
      });
      db.movimientos = db.movimientos.slice(0, 1000);
      guardar();
      return f;
    },

    kardex(sku) {
      return cargar().movimientos.filter(m => !sku || m.sku === sku);
    },

    alertasStock() {
      cargar();
      return Object.entries(db.inventario)
        .filter(([, f]) => f.activo && (f.stock - f.reservado) <= f.minimo)
        .map(([sku, f]) => ({ sku, ...f, disponible: f.stock - f.reservado }))
        .sort((a, b) => a.disponible - b.disponible);
    },

    /* --- clientes --- */
    clientes() { return cargar().clientes; },

    clientePorTelefono(tel) {
      const t = String(tel || '').replace(/\D/g, '');
      return cargar().clientes.find(c => String(c.telefono).replace(/\D/g, '') === t) || null;
    },

    cliente(id) { return cargar().clientes.find(c => c.id === id) || null; },

    guardarCliente(datos, usuario) {
      cargar();
      let c = datos.id ? db.clientes.find(x => x.id === datos.id) : null;
      if (!c && datos.telefono) c = this.clientePorTelefono(datos.telefono);
      if (c) {
        Object.assign(c, datos, { id: c.id });
        registrar('clientes', 'editar', c.nombre, usuario);
      } else {
        c = Object.assign({
          id: 'C' + (++db.seq.cliente).toString().padStart(4, '0'),
          tipo: 'minorista', ciudad: 'Ibagué', creado: hoy(), notas: ''
        }, datos);
        db.clientes.push(c);
        registrar('clientes', 'crear', c.nombre, usuario);
      }
      guardar();
      return c;
    },

    /* --- pedidos --- */
    pedidos() { return cargar().pedidos; },

    pedido(codigo) { return cargar().pedidos.find(p => p.codigo === codigo) || null; },

    pedidosDeCliente(clienteId) {
      return cargar().pedidos.filter(p => p.clienteId === clienteId);
    },

    crearPedido(datos, usuario) {
      cargar();
      const cliente = this.guardarCliente({
        nombre: datos.cliente.nombre,
        telefono: datos.cliente.telefono,
        correo: datos.cliente.correo,
        ciudad: datos.cliente.ciudad,
        direccion: datos.cliente.direccion,
        autoriza_datos: !!datos.consentimiento,
        autoriza_fecha: datos.consentimiento ? datos.consentimiento.fecha : null
      }, usuario);

      const codigo = `EF-${anio()}-${String(++db.seq.pedido).padStart(5, '0')}`;
      const p = {
        codigo,
        clienteId: cliente.id,
        cliente: { ...datos.cliente },
        items: datos.items.map(i => ({ ...i })),
        entrega: datos.entrega,
        metodoPago: datos.metodoPago || '',
        referenciaPago: datos.referenciaPago || '',
        subtotal: datos.subtotal || 0,
        descuento: datos.descuento || 0,
        envio: datos.envio || 0,
        total: datos.total || 0,
        pagado: !!datos.pagado,
        estado: datos.estado || 'nuevo',
        transportadora: '', guia: '',
        origen: datos.origen || 'web',
        vendedor: usuario || 'web',
        creado: hoy(),
        eventos: [{ fecha: hoy(), estado: datos.estado || 'nuevo',
                    nota: 'Pedido recibido', usuario: usuario || 'web' }],
        consentimiento: datos.consentimiento || null
      };

      // Reserva de stock, solo para los SKU que sí están en inventario
      p.items.forEach(i => {
        const f = db.inventario[i.sku];
        if (f) f.reservado = (f.reservado || 0) + i.qty;
      });

      db.pedidos.unshift(p);

      if (!p.pagado && p.total > 0) {
        db.cartera.push({
          id: 'CT' + codigo, clienteId: cliente.id, pedido: codigo,
          monto: p.total, abonado: 0,
          vence: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10),
          estado: 'pendiente'
        });
      } else if (p.pagado) {
        db.caja.push({
          fecha: hoy().slice(0, 10), tipo: 'ingreso', categoria: 'Venta',
          descripcion: 'Pedido ' + codigo, monto: p.total,
          metodo: p.metodoPago, pedido: codigo, usuario: usuario || 'web'
        });
      }

      registrar('pedidos', 'crear', codigo, usuario);
      guardar();
      return p;
    },

    cambiarEstado(codigo, estado, nota, usuario) {
      cargar();
      const p = db.pedidos.find(x => x.codigo === codigo);
      if (!p || p.estado === estado) return p;
      const anterior = p.estado;
      p.estado = estado;
      p.eventos.push({ fecha: hoy(), estado, nota: nota || '', usuario: usuario || 'sistema' });

      const salida = ['listo_recoger', 'despachado', 'entregado'];
      const yaSalio = salida.includes(anterior);
      const saleAhora = salida.includes(estado);

      p.items.forEach(i => {
        const f = db.inventario[i.sku];
        if (!f) return;
        if (!yaSalio && saleAhora) {
          f.reservado = Math.max(0, (f.reservado || 0) - i.qty);
          f.stock = Math.max(0, (f.stock || 0) - i.qty);
          db.movimientos.unshift({
            fecha: hoy(), sku: i.sku, tipo: 'salida', cantidad: i.qty,
            saldo: f.stock, motivo: 'Pedido ' + codigo, usuario: usuario || 'sistema'
          });
        }
        if (estado === 'anulado') {
          if (yaSalio) {
            f.stock += i.qty;
            db.movimientos.unshift({
              fecha: hoy(), sku: i.sku, tipo: 'devolucion', cantidad: i.qty,
              saldo: f.stock, motivo: 'Anulación ' + codigo, usuario: usuario || 'sistema'
            });
          } else {
            f.reservado = Math.max(0, (f.reservado || 0) - i.qty);
          }
        }
      });

      if (estado === 'anulado') {
        const ct = db.cartera.find(c => c.pedido === codigo);
        if (ct) ct.estado = 'anulada';
      }

      registrar('pedidos', 'estado', `${codigo}: ${anterior} → ${estado}`, usuario);
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
      db.caja.push({
        fecha: hoy().slice(0, 10), tipo: 'ingreso', categoria: 'Venta',
        descripcion: 'Pedido ' + codigo, monto: p.total,
        metodo: p.metodoPago, pedido: codigo, usuario: usuario || 'sistema'
      });
      if (p.estado === 'nuevo') this.cambiarEstado(codigo, 'pago_verificado', 'Pago confirmado', usuario);
      registrar('pedidos', 'pago', codigo, usuario);
      guardar();
      return p;
    },

    /* --- cartera --- */
    cartera() { return cargar().cartera; },

    abonar(carteraId, monto, metodo, usuario) {
      cargar();
      const c = db.cartera.find(x => x.id === carteraId);
      if (!c) return null;
      c.abonado = Math.min(c.monto, (c.abonado || 0) + monto);
      c.estado = c.abonado >= c.monto ? 'pagada' : 'parcial';
      db.caja.push({
        fecha: hoy().slice(0, 10), tipo: 'ingreso', categoria: 'Abono',
        descripcion: 'Abono ' + c.pedido, monto, metodo: metodo || '',
        pedido: c.pedido, usuario: usuario || 'sistema'
      });
      if (c.estado === 'pagada') {
        const p = db.pedidos.find(x => x.codigo === c.pedido);
        if (p) p.pagado = true;
      }
      registrar('cartera', 'abono', c.pedido, usuario);
      guardar();
      return c;
    },

    /* --- caja --- */
    caja() { return cargar().caja; },

    movimientoCaja(m, usuario) {
      cargar();
      db.caja.push(Object.assign({ fecha: hoy().slice(0, 10), usuario: usuario || 'sistema' }, m));
      registrar('caja', m.tipo, m.descripcion, usuario);
      guardar();
    },

    /* --- garantías --- */
    garantias() { return cargar().garantias; },

    radicarGarantia(g, usuario) {
      cargar();
      g.id = 'G' + Date.now().toString(36).toUpperCase();
      g.estado = 'radicada';
      g.creado = hoy();
      db.garantias.unshift(g);
      registrar('garantias', 'radicar', g.id, usuario);
      guardar();
      return g;
    },

    estadoGarantia(id, estado, nota, usuario) {
      cargar();
      const g = db.garantias.find(x => x.id === id);
      if (!g) return null;
      g.estado = estado;
      g.nota = nota || g.nota;
      registrar('garantias', estado, id, usuario);
      guardar();
      return g;
    },

    /* --- utilidades --- */
    auditoria() { return cargar().auditoria; },

    exportar() {
      return JSON.stringify(cargar(), null, 2);
    },

    importar(texto) {
      const nuevo = JSON.parse(texto);
      if (!nuevo || typeof nuevo !== 'object') throw new Error('Archivo inválido');
      db = Object.assign(VACIO(), nuevo);
      guardar();
      return db;
    },

    vaciar() {
      db = VACIO();
      guardar();
    }
  };

  /* ---------------------------------------------------------- SESIÓN */
  /* Usuario y contraseña iguales, en estilo leet, igual que en la
     plataforma de PubliFuturo. No distingue mayúsculas. */
  const USUARIOS = [
    { clave: 'c0m3rc14l', rol: 'comercial', nombre: 'Comercial' },
    { clave: 'g3r3nc14',  rol: 'gerencia',  nombre: 'Gerencia'  },
    { clave: 'b0d3g4',    rol: 'bodega',    nombre: 'Bodega'    }
  ];

  const Sesion = {
    USUARIOS,
    entrar(usuario, contrasena) {
      const u = String(usuario || '').trim().toLowerCase();
      const c = String(contrasena || '').trim().toLowerCase();
      const encontrado = USUARIOS.find(x => x.clave === u && x.clave === c);
      if (!encontrado) return null;
      sessionStorage.setItem('ef_sesion', JSON.stringify(encontrado));
      return encontrado;
    },
    actual() {
      try { return JSON.parse(sessionStorage.getItem('ef_sesion') || 'null'); }
      catch { return null; }
    },
    salir() { sessionStorage.removeItem('ef_sesion'); },
    puede(area) {
      const s = this.actual();
      if (!s) return false;
      const PERMISOS = {
        comercial: ['inicio', 'pedidos', 'clientes', 'inventario', 'cartera', 'garantias'],
        gerencia:  ['inicio', 'pedidos', 'clientes', 'inventario', 'cartera', 'garantias',
                    'finanzas', 'reportes', 'ajustes'],
        bodega:    ['inicio', 'pedidos', 'inventario']
      };
      return (PERMISOS[s.rol] || []).includes(area);
    },
    /* El comercial y bodega NUNCA ven costo ni utilidad. En producción esto
       además se bloquea con RLS en Supabase: ocultarlo solo en pantalla no
       sirve, porque los datos ya viajaron al navegador. */
    veCostos() {
      const s = this.actual();
      return !!s && s.rol === 'gerencia';
    }
  };

  global.Datos = Datos;
  global.Sesion = Sesion;
})(window);
