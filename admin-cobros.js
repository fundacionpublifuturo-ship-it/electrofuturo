/* ============================================================
   ELECTRO FUTURO — admin-cobros.js  ·  v2
   Módulo "Cobros Pendientes": la cartera que se llevaba en Excel,
   dentro del portal, con alertas y con lo que evita que crezca.

   Incluye: acuerdos de pago, historial de gestión por cliente,
   semáforo de riesgo, cupo de crédito, envío masivo de recordatorios,
   recibo de caja en PDF, proyección de recaudo y los créditos del
   punto de venta en el mismo cuadro.
   ============================================================ */
(function (global) {
'use strict';

/* ---------- utilidades ---------- */
const HOY = () => new Date().toLocaleDateString('en-CA');
const dias = (a, b) => Math.round((new Date((b || HOY()) + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const masDias = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const tel = s => String(s || '').replace(/\D/g, '');
const soloNum = s => Number(String(s ?? '').replace(/[^\d-]/g, '')) || 0;
const lunes = f => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toLocaleDateString('en-CA'); };

function vencimiento(c) {
  if (c.vence) return c.vence;
  if (c.remision) return masDias(c.remision, 30);
  return HOY();
}
const saldoDe = c => Math.max(0, (Number(c.valor) || 0) - (Number(c.abono) || 0));
const estadoDe = (c, s, m) => s <= 0 ? 'pagado' : m > 0 ? 'vencido' : m >= -7 ? 'porvencer' : 'aldia';
const EST = { pagado:['Pagado','g'], vencido:['Vencido','r'], porvencer:['Por vencer','y'], aldia:['Al día','b'] };
const edad = d => d <= 0 ? 'Al día' : d <= 30 ? '1-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '+90';

/* ---------- 1. ACUERDOS DE PAGO ---------- */
/* Una promesa se incumple si pasó la fecha y el saldo no bajó desde que se pactó */
function promesa(c) {
  const p = (c.acuerdos || []).filter(x => !x.anulado).slice(-1)[0];
  if (!p) return null;
  const bajo = saldoDe(c) < (p.saldoAlPactar ?? Infinity);
  if (bajo) return Object.assign({}, p, { estado: 'cumplida' });
  if (p.fecha < HOY()) return Object.assign({}, p, { estado: 'incumplida', atraso: dias(p.fecha) });
  return Object.assign({}, p, { estado: p.fecha === HOY() ? 'hoy' : 'vigente', faltan: -dias(p.fecha) });
}
const incumplidas = c => (c.acuerdos || []).filter(x => !x.anulado && x.fecha < HOY()
  && saldoDe(c) >= (x.saldoAlPactar ?? Infinity)).length;

/* ---------- 3. SEMÁFORO DE RIESGO ---------- */
/* Verde: al día o hasta 30 de mora. Amarillo: hasta 60, o una promesa rota.
   Rojo: más de 60 días, o dos promesas rotas. */
function riesgo(mora, rotas) {
  if (mora > 60 || rotas >= 2) return 'rojo';
  if (mora > 30 || rotas >= 1) return 'amarillo';
  return 'verde';
}
const SEM = { verde:['🟢','Verde','g'], amarillo:['🟡','Amarillo','y'], rojo:['🔴','Rojo','r'] };

/* ---------- 8. LOS CRÉDITOS DEL PUNTO DE VENTA, EN EL MISMO CUADRO ---------- */
function desdePOS() {
  if (!Array.isArray(S.credits)) return [];
  return S.credits
    .filter(c => c.tipo !== 'separado' && !['cancelado', 'entregado'].includes(c.status) && creditBalance(c) > 0)
    .map(c => {
      const cli = S.clients.find(x => x.id === c.clientId);
      const v = nextDue(c) || c.firstDue || HOY();
      return { id: 'pos:' + c.id, pos: true, creditId: c.id,
        cliente: (cli && cli.name) || c.clientName || 'Cliente', telefono: (cli && cli.phone) || '',
        factura: c.code, remision: String(c.createdAt || '').slice(0, 10), vence: v,
        valor: c.grandTotal ?? c.total, abono: creditPaid(c), acuerdos: [], gestiones: [], pagos: [] };
    });
}

/* ---------- lista unificada ---------- */
function lista() {
  const propios = (S.cobros || []);
  return propios.concat(desdePOS()).map(c => {
    const v = vencimiento(c), s = saldoDe(c), m = dias(v);
    const rotas = incumplidas(c);
    return Object.assign({}, c, { vence: v, saldo: s, mora: m, estado: estadoDe(c, s, m),
      rotas, riesgo: riesgo(m, rotas), prom: promesa(c) });
  });
}
const abiertos = () => lista().filter(c => c.estado !== 'pagado');
const vencidos = () => lista().filter(c => c.estado === 'vencido');
const promesasHoy = () => lista().filter(c => c.prom && c.prom.estado === 'hoy');
const promesasRotas = () => lista().filter(c => c.prom && c.prom.estado === 'incumplida');
const doc = id => (S.cobros || []).find(x => x.id === id);

/* Saldo de un cliente del portal dentro de este cuadro (alimenta el cupo) */
global.cobrosSaldoCliente = cli => {
  if (!cli) return 0;
  const n = norm(cli.name || cli.nombre), t = tel(cli.phone || cli.telefono);
  return (S.cobros || []).reduce((a, c) =>
    a + ((norm(c.cliente) === n || (t && tel(c.telefono) === t)) ? saldoDe(c) : 0), 0);
};

/* ---------- agrupar por cliente ---------- */
function porCliente(l) {
  const g = {};
  l.forEach(c => {
    const k = norm(c.cliente);
    const x = g[k] || (g[k] = { cliente: c.cliente, telefono: c.telefono || '', items: [], saldo: 0,
      valor: 0, abono: 0, mora: -999, rotas: 0, gestiones: [], prom: null });
    x.items.push(c); x.saldo += c.saldo; x.valor += c.valor; x.abono += c.abono || 0;
    x.rotas += c.rotas;
    if (c.saldo > 0) x.mora = Math.max(x.mora, c.mora);
    if (!x.telefono && c.telefono) x.telefono = c.telefono;
    (c.gestiones || []).forEach(y => x.gestiones.push(Object.assign({ doc: c.factura }, y)));
    if (c.prom && (!x.prom || c.prom.fecha < x.prom.fecha)) x.prom = c.prom;
  });
  return Object.values(g).map(x => {
    /* El cuadro de Excel no trae teléfonos: se busca en la base de clientes */
    if (tel(x.telefono).length < 7) {
      const cli = clienteDelPortal(x.cliente, '');
      if (cli && tel(cli.phone).length >= 7) x.telefono = cli.phone;
    }
    x.sinTelefono = tel(x.telefono).length < 7;
    x.riesgo = riesgo(x.mora, x.rotas);
    x.gestiones.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    x.ultimaGestion = x.gestiones[0] || null;
    x.cupo = clienteCupo(x);
    return x;
  }).sort((a, b) => b.mora - a.mora || b.saldo - a.saldo);
}

/* ---------- 4. CUPO DE CRÉDITO ---------- */
function clienteDelPortal(nombre, telefono) {
  const n = norm(nombre), t = tel(telefono);
  return S.clients.find(c => norm(c.name) === n || (t && tel(c.phone) === t)) || null;
}
function clienteCupo(g) {
  const cli = clienteDelPortal(g.cliente, g.telefono);
  if (!cli || !cli.cupo) return null;
  const usado = clientBalance(cli);
  return { id: cli.id, cupo: cli.cupo, usado, libre: Math.max(0, cli.cupo - usado), excedido: usado > cli.cupo };
}

/* ---------- mensajes ---------- */
function mensajeCobro(g) {
  const ab = g.items.filter(i => i.saldo > 0);
  return `Hola ${g.cliente} 👋 te escribo de *${S.config.biz}*. Tienes un saldo pendiente de *${money(g.saldo)}*:\n\n`
    + ab.map(i => `• ${i.factura || 'Remisión'} · ${money(i.saldo)} · vence ${dmy(i.vence)}${i.mora > 0 ? ` (${i.mora} días de mora)` : ''}`).join('\n')
    + (g.prom && g.prom.estado === 'incumplida'
      ? `\n\nQuedamos en que pagabas el ${dmy(g.prom.fecha)}. ¿Qué pasó?`
      : `\n\n¿Lo podemos coordinar esta semana?`);
}

/* ---------- filtros ---------- */
let coF = { q:'', estado:'', riesgo:'', agrupado:true, fuente:'' };
global.coF = coF;

/* ============================================================
   VISTA
   ============================================================ */
VIEWS.cobros = () => {
  const l = lista();
  const ab = l.filter(c => c.estado !== 'pagado');
  const ven = l.filter(c => c.estado === 'vencido');
  const pv = l.filter(c => c.estado === 'porvencer');
  const mes = HOY().slice(0, 7);
  const recaudado = (S.cobros || []).reduce((a, c) => a + (c.pagos || [])
    .filter(p => String(p.fecha).slice(0, 7) === mes).reduce((s, p) => s + p.monto, 0), 0);
  const edades = ['1-30','31-60','61-90','+90'].map(e =>
    [e, ab.filter(c => edad(c.mora) === e).reduce((a, c) => a + c.saldo, 0)]);
  const dup = posiblesDuplicados();
  const hoyProm = promesasHoy(), rotas = promesasRotas();

  /* ---------- 7. proyección de recaudo ---------- */
  const finSem = masDias(lunes(HOY()), 6);
  const finMes = HOY().slice(0, 8) + '28';
  const espSem = ab.filter(c => c.vence <= finSem).reduce((a, c) => a + c.saldo, 0);
  const espMes = ab.filter(c => c.vence.slice(0, 7) <= mes).reduce((a, c) => a + c.saldo, 0);
  const promSem = hoyProm.concat(l.filter(c => c.prom && c.prom.estado === 'vigente' && c.prom.fecha <= finSem))
    .reduce((a, c) => a + c.saldo, 0);
  const semanas = [0, 1, 2, 3].map(k => {
    const ini = masDias(lunes(HOY()), k * 7), fin = masDias(ini, 6);
    return { ini, fin, v: ab.filter(c => c.vence >= ini && c.vence <= fin).reduce((a, c) => a + c.saldo, 0),
      prom: ab.filter(c => c.prom && c.prom.estado !== 'incumplida' && c.prom.fecha >= ini && c.prom.fecha <= fin)
        .reduce((a, c) => a + c.saldo, 0) };
  });

  let f = l;
  if (coF.estado) f = f.filter(c => c.estado === coF.estado);
  if (coF.riesgo) f = f.filter(c => c.riesgo === coF.riesgo);
  if (coF.fuente === 'pos') f = f.filter(c => c.pos);
  if (coF.fuente === 'cuadro') f = f.filter(c => !c.pos);
  if (coF.q) { const q = norm(coF.q); f = f.filter(c => norm(c.cliente + ' ' + c.factura).includes(q)); }

  const chipProm = p => !p ? '' :
    p.estado === 'incumplida' ? `<span class="chip r" title="Prometió el ${dmy(p.fecha)}">🤝 rota</span>` :
    p.estado === 'hoy' ? `<span class="chip y">🤝 paga hoy</span>` :
    p.estado === 'vigente' ? `<span class="chip b">🤝 ${dmy(p.fecha)}</span>` : '';

  const fila = c => `<tr>
    <td>${SEM[c.riesgo][0]} ${esc(c.cliente)}${c.pos ? ' <span class="chip b">POS</span>' : ''}</td>
    <td class="mono">${esc(c.factura || '—')}</td>
    <td>${dmy(c.remision)}</td><td>${dmy(c.vence)}</td>
    <td class="r">${c.estado === 'pagado' ? '—' : (c.mora > 0 ? `<b style="color:var(--bad)">${c.mora}</b>` : Math.abs(c.mora))}</td>
    <td class="r">${money(c.valor)}</td><td class="r">${c.abono ? money(c.abono) : '—'}</td>
    <td class="r"><b>${money(c.saldo)}</b></td>
    <td><span class="chip ${EST[c.estado][1]}">${EST[c.estado][0]}</span> ${chipProm(c.prom)}</td>
    <td class="r nowrap">${c.saldo > 0 ? `<button class="btn sm primary" onclick="coAbonar('${c.id}')">Abonar</button>` : ''}
      ${c.pos ? '' : `<button class="btn sm" onclick="coEditar('${c.id}')">✏️</button>`}</td></tr>`;

  const grupos = porCliente(f).map(g => {
    const id = norm(g.cliente).replace(/ /g, '_');
    const ab2 = g.items.filter(i => i.saldo > 0);
    const sinGestion = g.ultimaGestion ? dias(String(g.ultimaGestion.fecha).slice(0, 10)) : null;
    return `<div class="card" style="margin-bottom:10px;border-left:3px solid ${
      g.riesgo === 'rojo' ? 'var(--bad)' : g.riesgo === 'amarillo' ? 'var(--warn)' : 'var(--ok)'}">
      <div class="card-h" style="cursor:pointer" onclick="coToggle('${id}')">
        <div style="flex:1;min-width:0">
          <b>${SEM[g.riesgo][0]} ${esc(g.cliente)}</b> ${chipProm(g.prom)}
          ${g.cupo && g.cupo.excedido ? '<span class="chip r">Cupo excedido</span>' : ''}
          <div class="tiny muted">${g.items.length} documento(s) · ${ab2.length} sin pagar
            ${g.mora > 0 ? ` · <b style="color:var(--bad)">${g.mora} días de mora</b>` : ''}
            ${g.rotas ? ` · ${g.rotas} promesa(s) rota(s)` : ''}
            · ${sinGestion === null ? '<b>nunca se le ha escrito</b>' : `última gestión hace ${sinGestion} día(s)`}
            ${g.cupo ? ` · cupo ${money(g.cupo.cupo)}, libre ${money(g.cupo.libre)}` : ''}</div>
        </div>
        <div style="text-align:right"><b style="font-size:16px">${money(g.saldo)}</b>
          <div class="tiny muted">de ${money(g.valor)}</div></div>
        ${g.saldo > 0 ? `<a class="btn sm" style="background:#25D366;color:#04231A;border:0" target="_blank" rel="noopener"
          onclick="event.stopPropagation();coTrasWA('${esc(g.cliente).replace(/'/g,'')}')"
          href="${waLink(g.telefono, mensajeCobro(g))}">💬 Cobrar</a>` : ''}
        <button class="btn sm" onclick="event.stopPropagation();coGestion('${esc(g.cliente).replace(/'/g,'')}')">📝 Gestión</button>
      </div>
      <div id="co_${id}" style="display:none">
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Factura</th><th>Remisión</th><th>Vence</th>
          <th class="r">Mora</th><th class="r">Valor</th><th class="r">Abono</th><th class="r">Saldo</th><th>Estado</th><th></th></tr></thead>
          <tbody>${g.items.sort((a, b) => b.mora - a.mora).map(c => `<tr>
            <td class="mono">${esc(c.factura || '—')}${c.pos ? ' <span class="chip b">POS</span>' : ''}</td>
            <td>${dmy(c.remision)}</td><td>${dmy(c.vence)}</td>
            <td class="r">${c.estado === 'pagado' ? '—' : (c.mora > 0 ? `<b style="color:var(--bad)">${c.mora}</b>` : Math.abs(c.mora))}</td>
            <td class="r">${money(c.valor)}</td><td class="r">${c.abono ? money(c.abono) : '—'}</td>
            <td class="r"><b>${money(c.saldo)}</b></td>
            <td><span class="chip ${EST[c.estado][1]}">${EST[c.estado][0]}</span> ${chipProm(c.prom)}</td>
            <td class="r nowrap">${c.saldo > 0 ? `<button class="btn sm primary" onclick="coAbonar('${c.id}')">Abonar</button>` : ''}
              ${c.pos ? '' : `<button class="btn sm" onclick="coEditar('${c.id}')">✏️</button>`}</td></tr>`).join('')}</tbody></table></div>
        ${g.gestiones.length ? `<div style="padding:10px 16px 14px">
          <div class="tiny muted" style="margin-bottom:6px"><b>Historial de gestión</b></div>
          ${g.gestiones.slice(0, 6).map(x => `<div class="tiny" style="padding:5px 0;border-top:1px solid var(--line-2)">
            ${dmy(String(x.fecha).slice(0, 10))} · <b>${esc(x.tipo)}</b> · ${esc(x.resultado)}
            ${x.nota ? ` — ${esc(x.nota)}` : ''} <span class="muted">${esc(x.usuario || '')}</span></div>`).join('')}
        </div>` : ''}
      </div></div>`;
  }).join('') || '<div class="empty"><span class="em">📭</span><h4>Sin cobros pendientes</h4><p class="tiny">Importa tu cuadro de cartera o agrega un documento a mano.</p></div>';

  return `
  <div class="kpis">
    <div class="kpi ${ven.length ? 'bad' : ''}"><div class="t">💰 Por cobrar</div>
      <div class="v">${money(ab.reduce((a, c) => a + c.saldo, 0))}</div>
      <div class="d">${ab.length} documento(s) de ${new Set(ab.map(c => norm(c.cliente))).size} cliente(s)</div></div>
    <div class="kpi"><div class="t">🔴 Vencido</div><div class="v">${money(ven.reduce((a, c) => a + c.saldo, 0))}</div>
      <div class="d">${ven.length} documento(s) pasados de fecha</div></div>
    <div class="kpi"><div class="t">🤝 Promesas de pago</div><div class="v">${hoyProm.length}</div>
      <div class="d">para hoy${rotas.length ? ` · ${rotas.length} incumplida(s)` : ''}</div></div>
    <div class="kpi"><div class="t">📈 Esperado esta semana</div><div class="v">${money(espSem)}</div>
      <div class="d">${money(promSem)} con promesa de pago</div></div>
    <div class="kpi"><div class="t">✅ Recaudado este mes</div><div class="v">${money(recaudado)}</div>
      <div class="d">de ${money(espMes)} esperados</div></div>
  </div>

  ${hoyProm.length ? `<div class="alertbox b" style="margin-bottom:12px"><span class="em">🤝</span>
    <div><b>Hoy prometieron pagar:</b> ${hoyProm.map(c => `${esc(c.cliente)} (${money(c.saldo)})`).join(', ')}.
    <button class="btn sm" style="margin-left:6px" onclick="coRecordatorios('promesas')">Cobrarles</button></div></div>` : ''}
  ${rotas.length ? `<div class="alertbox r" style="margin-bottom:12px"><span class="em">🚫</span>
    <div><b>${rotas.length} promesa(s) incumplida(s):</b>
      ${rotas.slice(0, 4).map(c => esc(c.cliente)).join(', ')}${rotas.length > 4 ? '…' : ''}.
      Ese cliente ya no debería llevar más a crédito.</div></div>` : ''}

  <div class="row c2" style="align-items:start">
    <div class="card"><div class="card-h"><div><b>Edades de la cartera</b>
      <div class="tiny muted">Cuánto lleva sin cobrarse cada saldo</div></div></div>
      <div style="padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px">
        ${edades.map(([e, v]) => `<div style="background:var(--blue-50);border-radius:12px;padding:11px 13px">
          <div class="tiny muted">${e} días</div><b style="font-size:15px">${money(v)}</b></div>`).join('')}</div></div>
    <div class="card"><div class="card-h"><div><b>Proyección de recaudo</b>
      <div class="tiny muted">Por fecha de vencimiento, cuatro semanas</div></div></div>
      <div style="padding:14px 16px">${semanas.map(s => `<div style="display:flex;justify-content:space-between;
        gap:10px;padding:7px 0;border-bottom:1px solid var(--line-2)">
        <span class="tiny">${dmy(s.ini)} al ${dmy(s.fin)}</span>
        <span><b>${money(s.v)}</b>${s.prom ? ` <span class="tiny muted">· ${money(s.prom)} prometido</span>` : ''}</span>
      </div>`).join('')}</div></div>
  </div>

  ${(() => { const sin = porCliente(ab).filter(x => x.sinTelefono);
      return sin.length ? `<div class="alertbox y" style="margin-bottom:12px"><span class="em">📵</span>
        <div><b>${sin.length} deudor(es) sin WhatsApp cargado</b> por ${money(sin.reduce((a, x) => a + x.saldo, 0))}.
        Sin número no se les puede cobrar desde aquí.
        <button class="btn sm" style="margin-left:6px" onclick="coTelefonos()">Cargar teléfonos</button></div></div>` : ''; })()}

  ${dup.length ? `<div class="alertbox y" style="margin-bottom:12px"><span class="em">⚠️</span>
    <div><b>Posible cliente repetido con el nombre escrito distinto:</b>
      ${dup.slice(0, 4).map(([a, b]) => `«${esc(a)}» y «${esc(b)}»`).join(', ')}.
      <button class="btn sm" style="margin-left:6px" onclick="coUnificar()">Unificar nombres</button></div></div>` : ''}

  <div class="toolbar">
    <div class="search"><input type="text" placeholder="Buscar cliente o factura" value="${esc(coF.q)}"
      oninput="coF.q=this.value;render()"></div>
    <select onchange="coF.estado=this.value;render()" style="max-width:170px">
      <option value="">Todos los estados</option>
      ${Object.entries(EST).map(([k, v]) => `<option value="${k}" ${coF.estado === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
    <select onchange="coF.riesgo=this.value;render()" style="max-width:160px">
      <option value="">Todo riesgo</option>
      ${Object.entries(SEM).map(([k, v]) => `<option value="${k}" ${coF.riesgo === k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select>
    <select onchange="coF.fuente=this.value;render()" style="max-width:170px">
      <option value="">Cuadro y POS</option>
      <option value="cuadro" ${coF.fuente === 'cuadro' ? 'selected' : ''}>Solo el cuadro</option>
      <option value="pos" ${coF.fuente === 'pos' ? 'selected' : ''}>Solo créditos del POS</option></select>
    <button class="btn ${coF.agrupado ? 'primary' : ''}" onclick="coF.agrupado=!coF.agrupado;render()">
      ${coF.agrupado ? '👥 Por cliente' : '📄 Documento por documento'}</button>
    <div class="spacer"></div>
    <button class="btn primary" onclick="coNuevo()">＋ Nuevo cobro</button>
    <button class="btn" onclick="coImportar()">⬆️ Importar cuadro</button>
    <button class="btn" onclick="coRecordatorios()">🔔 Recordatorios</button>
    ${exportBtns('cobros')}
  </div>

  ${coF.agrupado ? grupos : `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Cliente</th><th>Factura</th><th>Remisión</th><th>Vence</th><th class="r">Mora</th>
      <th class="r">Valor</th><th class="r">Abono</th><th class="r">Saldo</th><th>Estado</th><th></th></tr></thead>
    <tbody>${f.length ? f.sort((a, b) => b.mora - a.mora).map(fila).join('')
      : '<tr><td colspan="10" class="tiny muted" style="padding:22px;text-align:center">Sin resultados con este filtro</td></tr>'}</tbody></table></div>`}`;
};

/* ---------- nombres parecidos ---------- */
function posiblesDuplicados() {
  const n = [...new Set((S.cobros || []).map(c => c.cliente))];
  const par = [];
  const sim = (a, b) => {
    const A = norm(a), B = norm(b);
    if (A === B) return 1;
    if (Math.abs(A.length - B.length) > 3) return 0;
    let i = 0; const L = Math.min(A.length, B.length);
    while (i < L && A[i] === B[i]) i++;
    let j = 0;
    while (j < L - i && A[A.length - 1 - j] === B[B.length - 1 - j]) j++;
    return (i + j) / Math.max(A.length, B.length);
  };
  for (let a = 0; a < n.length; a++) for (let b = a + 1; b < n.length; b++)
    if (sim(n[a], n[b]) >= .85) par.push([n[a], n[b]]);
  return par;
}

/* ============================================================
   ACCIONES
   ============================================================ */
global.coToggle = id => { const e = document.getElementById('co_' + id); if (e) e.style.display = e.style.display === 'none' ? '' : 'none'; };
global.coNuevo = () => coEditar(null);

global.coEditar = id => {
  const c = id ? doc(id) : null;
  modal({
    title: c ? 'Cobro · ' + (c.factura || c.cliente) : 'Nuevo cobro pendiente', em: '📒', ok: 'Guardar',
    body: `<div class="row c2">
        <label class="field"><span>Cliente</span><input type="text" name="cliente" value="${esc(c?.cliente || '')}" list="coClientes"></label>
        <label class="field"><span>WhatsApp</span><input type="text" name="telefono" inputmode="numeric" value="${esc(c?.telefono || '')}"></label></div>
      <datalist id="coClientes">${[...new Set((S.cobros || []).map(x => x.cliente))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="row c3">
        <label class="field"><span>N.º factura o remisión</span><input type="text" name="factura" value="${esc(c?.factura || '')}"></label>
        <label class="field"><span>Fecha de remisión</span><input type="date" name="remision" value="${c?.remision || HOY()}"></label>
        <label class="field"><span>Fecha de cancelación</span><input type="date" name="vence" value="${c ? vencimiento(c) : ''}">
          <span class="hint">Vacía = 30 días después de la remisión</span></label></div>
      <div class="row c2">
        <label class="field"><span>Valor total</span>${mnyInput('valor', c?.valor || 0)}</label>
        <label class="field"><span>Abonado</span>${mnyInput('abono', c?.abono || 0)}</label></div>
      <label class="field"><span>Nota</span><input type="text" name="nota" value="${esc(c?.nota || '')}"></label>
      ${c && (c.pagos || []).length ? `<div class="tiny muted" style="margin-top:10px"><b>Abonos</b><br>
        ${c.pagos.map(p => `${dmy(p.fecha)} · ${money(p.monto)} · ${esc(p.metodo || '')}
          ${p.recibo ? `<button class="btn sm" onclick="coRecibo('${c.id}','${p.recibo}')">🧾 ${p.recibo}</button>` : ''}`).join('<br>')}</div>` : ''}`,
    footer: `${c ? `<button class="btn danger" onclick="coBorrar('${c.id}')">🗑️ Eliminar</button>` : ''}
      <div class="spacer"></div><button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="submitModal()">Guardar</button>`,
    onSubmit: f => {
      const nom = String(f.cliente || '').trim();
      if (!nom) return toast('Escribe el nombre del cliente', '⚠️');
      const datos = { cliente: nom, telefono: String(f.telefono || '').trim(), factura: String(f.factura || '').trim(),
        remision: f.remision || '', vence: f.vence || '', valor: soloNum(f.valor), abono: soloNum(f.abono),
        nota: String(f.nota || '').trim() };
      if (c) Object.assign(c, datos);
      else (S.cobros = S.cobros || []).unshift(Object.assign({ id: uid('co'), pagos: [], acuerdos: [], gestiones: [], creado: nowISO() }, datos));
      audit(c ? 'COBRO_EDITAR' : 'COBRO_CREAR', nom + ' ' + (datos.factura || ''));
      save('cobros'); closeModal(); render(); toast('Cobro guardado', '📒');
    }
  });
};

global.coBorrar = id => {
  if (!confirm('¿Eliminar este cobro del cuadro?')) return;
  S.cobros = (S.cobros || []).filter(x => x.id !== id);
  audit('COBRO_ELIMINAR', id); save('cobros'); closeModal(); render(); toast('Cobro eliminado', '🗑️');
};

/* ---------- abonar (con acuerdo de pago y recibo) ---------- */
global.coAbonar = id => {
  if (String(id).startsWith('pos:')) return abonarCredito(String(id).slice(4));
  const c = doc(id); if (!c) return;
  const saldo = saldoDe(c);
  modal({
    title: 'Registrar abono', em: '💵', ok: 'Registrar',
    body: `<div class="alertbox b"><span class="em">📄</span><div><b>${esc(c.cliente)}</b> · ${esc(c.factura || 'sin factura')}<br>
        <span class="tiny">Valor ${money(c.valor)} · abonado ${money(c.abono || 0)} · <b>saldo ${money(saldo)}</b></span></div></div>
      <div class="row c2" style="margin-top:12px">
        <label class="field"><span>Valor del abono</span>${mnyInput('monto', saldo)}</label>
        <label class="field"><span>Fecha</span><input type="date" name="fecha" value="${HOY()}"></label></div>
      <div class="row c2">
        <label class="field"><span>Medio de pago</span><select name="metodo">
          <option>Efectivo</option><option>Transferencia</option><option>Bancolombia</option>
          <option>Nequi</option><option>Daviplata</option><option>Otro</option></select></label>
        <label class="field"><span>¿Entra a la caja del día?</span><select name="caja">
          <option value="no">No, solo descuenta la cartera</option>
          <option value="si">Sí, registrar ingreso en caja</option></select></label></div>
      <div class="alertbox y" style="margin-top:6px"><span class="em">🤝</span>
        <div><b>Acuerdo de pago</b><div class="tiny">¿Para cuándo quedó de pagar el resto? El portal te lo recuerda ese día.</div></div></div>
      <div class="row c2">
        <label class="field"><span>Promete pagar el resto el</span><input type="date" name="promesa" value=""></label>
        <label class="field"><span>Nota</span><input type="text" name="nota" placeholder="Opcional"></label></div>`,
    onSubmit: f => {
      const m = soloNum(f.monto);
      if (m <= 0 && !f.promesa) return toast('Escribe un valor o una fecha de pago', '⚠️');
      const fecha = f.fecha || HOY();
      if (m > 0) {
        const num = consecutivo('RC');
        c.abono = (Number(c.abono) || 0) + m;
        (c.pagos = c.pagos || []).push({ fecha, monto: m, metodo: f.metodo, nota: f.nota || '', recibo: num,
          usuario: (curUser() || {}).nombre || '' });
        if (f.caja === 'si' && Array.isArray(S.cashMoves)) {
          S.cashMoves.unshift({ id: uid('cm'), date: fecha, at: nowISO(), type: 'ingreso',
            concept: 'Abono cartera · ' + c.cliente + (c.factura ? ' ' + c.factura : '') + ' · ' + num,
            amount: m, method: f.metodo, who: (curUser() || {}).nombre || '' });
          save('cashMoves');
        }
        registrarGestion(c.cliente, { tipo: 'Abono', resultado: 'Abonó ' + money(m), nota: f.nota || '', ref: num });
        audit('COBRO_ABONO', c.cliente + ' ' + (c.factura || '') + ' ' + money(m));
      }
      if (f.promesa) {
        (c.acuerdos = c.acuerdos || []).push({ fecha: f.promesa, pactado: HOY(), saldoAlPactar: saldoDe(c),
          usuario: (curUser() || {}).nombre || '', nota: f.nota || '' });
        registrarGestion(c.cliente, { tipo: 'Acuerdo', resultado: 'Prometió pagar el ' + dmy(f.promesa), nota: f.nota || '' });
        audit('COBRO_ACUERDO', c.cliente + ' → ' + f.promesa);
      }
      save('cobros'); closeModal(); render();
      const ult = (c.pagos || []).slice(-1)[0];
      if (m > 0 && ult) {
        toast('Abono registrado · recibo ' + ult.recibo, '💵');
        setTimeout(() => { if (confirm('¿Generar el recibo de caja ' + ult.recibo + ' en PDF?')) coRecibo(c.id, ult.recibo); }, 400);
      } else toast('Acuerdo de pago guardado para el ' + dmy(f.promesa), '🤝');
    }
  });
};

/* ---------- 6. RECIBO DE CAJA EN PDF ---------- */
function consecutivo(pre) {
  S.counters = S.counters || {};
  S.counters[pre] = (S.counters[pre] || 0) + 1;
  save('counters');
  return pre + '-' + String(S.counters[pre]).padStart(4, '0');
}

global.coRecibo = (idDoc, num) => {
  const c = doc(idDoc); if (!c) return;
  const p = (c.pagos || []).find(x => x.recibo === num); if (!p) return;
  DOCS.recibo = () => ({
    title: 'Recibo de caja ' + num, subtitle: dmy(p.fecha) + ' · ' + c.cliente,
    columns: ['Concepto', 'Documento', 'Valor'],
    rows: [['Abono a cartera', c.factura || 'Remisión', p.monto]],
    totals: ['TOTAL RECIBIDO', '', p.monto],
    kpis: [['Medio de pago', p.metodo || '—'], ['Saldo anterior', saldoDe(c) + p.monto],
           ['Saldo actual', saldoDe(c)], ['Recibió', p.usuario || '—']],
    note: 'Recibimos de ' + c.cliente + ' la suma de ' + money(p.monto) + ' por concepto de abono a cartera.'
  });
  exportDoc('recibo', 'pdf');
};

/* ---------- 2. HISTORIAL DE GESTIÓN ---------- */
function registrarGestion(cliente, g) {
  const n = norm(cliente);
  const objetivo = (S.cobros || []).filter(c => norm(c.cliente) === n && saldoDe(c) > 0)[0]
    || (S.cobros || []).find(c => norm(c.cliente) === n);
  if (!objetivo) return;
  (objetivo.gestiones = objetivo.gestiones || []).unshift(Object.assign({
    fecha: nowISO(), usuario: (curUser() || {}).nombre || ''
  }, g));
  save('cobros');
}

const RESULTADOS = ['Promete pagar', 'No contesta', 'Pidió plazo', 'En disputa', 'Abonó', 'Número equivocado', 'Otro'];

global.coGestion = (cliente, sugerido) => {
  const n = norm(cliente);
  const docs = (S.cobros || []).filter(c => norm(c.cliente) === n);
  const hist = docs.flatMap(c => (c.gestiones || []).map(g => Object.assign({ doc: c.factura }, g)))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  modal({
    title: 'Gestión de cobro · ' + cliente, em: '📝', ok: 'Guardar gestión',
    body: `<div class="row c3">
        <label class="field"><span>Medio</span><select name="tipo">
          ${['WhatsApp','Llamada','Visita','Correo','Presencial'].map(x => `<option ${sugerido === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="field"><span>Resultado</span><select name="resultado">
          ${RESULTADOS.map(x => `<option>${x}</option>`).join('')}</select></label>
        <label class="field"><span>Si prometió, ¿para cuándo?</span><input type="date" name="promesa"></label></div>
      <label class="field"><span>Qué dijo</span><input type="text" name="nota" placeholder="Textual, en sus palabras"></label>
      ${hist.length ? `<div style="margin-top:14px"><div class="tiny muted"><b>Historial · ${hist.length} gestión(es)</b></div>
        ${hist.slice(0, 12).map(x => `<div class="tiny" style="padding:6px 0;border-top:1px solid var(--line-2)">
          ${dmy(String(x.fecha).slice(0, 10))} · <b>${esc(x.tipo)}</b> · ${esc(x.resultado)}
          ${x.nota ? ` — «${esc(x.nota)}»` : ''} <span class="muted">${esc(x.usuario || '')}</span></div>`).join('')}</div>`
        : '<div class="tiny muted" style="margin-top:12px">A este cliente todavía no se le ha registrado ninguna gestión.</div>'}`,
    onSubmit: f => {
      registrarGestion(cliente, { tipo: f.tipo, resultado: f.resultado, nota: String(f.nota || '').trim() });
      if (f.promesa) {
        const c = docs.filter(x => saldoDe(x) > 0)[0];
        if (c) {
          (c.acuerdos = c.acuerdos || []).push({ fecha: f.promesa, pactado: HOY(), saldoAlPactar: saldoDe(c),
            usuario: (curUser() || {}).nombre || '', nota: f.nota || '' });
          audit('COBRO_ACUERDO', cliente + ' → ' + f.promesa);
        }
      }
      audit('COBRO_GESTION', cliente + ' · ' + f.resultado);
      save('cobros'); closeModal(); render();
      toast(f.promesa ? 'Gestión y acuerdo guardados' : 'Gestión registrada', '📝');
    }
  });
};

/* Al usar el botón de WhatsApp, ofrece dejarlo registrado */
global.coTrasWA = cliente => setTimeout(() => coGestion(cliente, 'WhatsApp'), 900);

/* ---------- 5. RECORDATORIOS Y ENVÍO MASIVO ---------- */
global.coRecordatorios = (filtro) => {
  let g = porCliente(abiertos());
  if (filtro === 'promesas') g = g.filter(x => x.prom && x.prom.estado === 'hoy');
  else g = g.filter(x => x.mora > -8);
  modal({
    title: 'Recordatorios de cobro', em: '🔔', wide: true,
    body: `<div class="alertbox y"><span class="em">🔔</span><div>${g.length} cliente(s) por contactar hoy.
        Cada botón abre WhatsApp con el mensaje escrito y luego te pregunta qué respondió.</div></div>
      <div class="row c3" style="margin-top:12px">
        <button class="btn primary" onclick="coEnvioMasivo()">🚀 Enviar a todos, uno por uno</button>
        <button class="btn" onclick="coACampanas()">💬 Llevar a Campañas WhatsApp</button>
        <button class="btn" onclick="coPermisoAvisos()">🔔 Activar avisos del navegador</button></div>
      <div style="margin-top:12px">${g.length ? g.map(x => `<div class="sortrow">
          <div style="flex:1;min-width:0"><b>${SEM[x.riesgo][0]} ${esc(x.cliente)}</b>
            <div class="tiny muted">${money(x.saldo)} · ${x.items.filter(i => i.saldo > 0).length} documento(s)
              ${x.mora > 0 ? `· <b style="color:var(--bad)">${x.mora} días de mora</b>` : '· vence pronto'}
              ${x.ultimaGestion ? ` · última gestión ${dmy(String(x.ultimaGestion.fecha).slice(0, 10))}` : ' · nunca contactado'}</div></div>
          <a class="btn sm" style="background:#25D366;color:#04231A" target="_blank" rel="noopener"
             onclick="coTrasWA('${esc(x.cliente).replace(/'/g,'')}')"
             href="${waLink(x.telefono, mensajeCobro(x))}">💬 WhatsApp</a></div>`).join('')
        : '<div class="empty tiny">Nada por recordar hoy</div>'}</div>`,
    footer: `<div class="spacer"></div><button class="btn primary" onclick="closeModal()">Cerrar</button>`
  });
};

/* Abre WhatsApp de a uno, en orden, sin que se pierda ninguno */
let masivo = { cola: [], i: 0 };
global.coEnvioMasivo = () => {
  masivo.cola = porCliente(abiertos()).filter(x => x.mora > -8 && tel(x.telefono).length >= 7);
  masivo.i = 0;
  if (!masivo.cola.length) { closeModal(); return coTelefonos(); }
  coSiguienteEnvio();
};
global.coSiguienteEnvio = () => {
  if (masivo.i >= masivo.cola.length) {
    closeModal(); render();
    return toast('Recorrido terminado: ' + masivo.cola.length + ' cliente(s)', '✅');
  }
  const x = masivo.cola[masivo.i];
  modal({
    title: `Cobro ${masivo.i + 1} de ${masivo.cola.length}`, em: '🚀',
    body: `<div class="alertbox b"><span class="em">${SEM[x.riesgo][0]}</span><div><b>${esc(x.cliente)}</b><br>
        <span class="tiny">${money(x.saldo)} · ${x.mora > 0 ? x.mora + ' días de mora' : 'por vencer'}</span></div></div>
      <div class="field" style="margin-top:12px"><span>Mensaje</span>
        <textarea rows="7" readonly>${esc(mensajeCobro(x))}</textarea></div>`,
    footer: `<button class="btn" onclick="masivo.i++;coSiguienteEnvio()">Saltar</button>
      <div class="spacer"></div>
      <a class="btn primary" style="background:#25D366;color:#04231A" target="_blank" rel="noopener"
         href="${waLink(x.telefono, mensajeCobro(x))}"
         onclick="registrarGestionPub('${esc(x.cliente).replace(/'/g,'')}');setTimeout(()=>{masivo.i++;coSiguienteEnvio()},600)">
         💬 Abrir y seguir</a>`
  });
};
global.masivo = masivo;
global.registrarGestionPub = cliente => registrarGestion(cliente, { tipo: 'WhatsApp', resultado: 'Mensaje enviado', nota: 'Envío masivo' });

global.coACampanas = () => {
  if (typeof W === 'undefined') return toast('El módulo de campañas no está disponible', '⚠️');
  W.step = 3; W.tipo = 'cobro'; W.seg = 'cobros_vencidos'; W.param = '';
  W.msg = 'Hola {nombre} 👋 te escribo de ' + S.config.biz + '. Tienes un saldo pendiente con nosotros. ¿Lo podemos coordinar esta semana?';
  closeModal(); go('campanas');
  toast('Segmento «cartera del cuadro» listo en Campañas', '💬');
};

global.coPermisoAvisos = () => {
  if (!('Notification' in window)) return toast('Este navegador no tiene avisos', '⚠️');
  Notification.requestPermission().then(p => toast(p === 'granted' ? 'Avisos activados' : 'Avisos no autorizados', p === 'granted' ? '🔔' : '🔕'));
};

/* Segmento nuevo en Campañas WhatsApp */
if (typeof SEGMENTOS !== 'undefined' && !SEGMENTOS.some(s => s.id === 'cobros_vencidos')) {
  SEGMENTOS.push({ id:'cobros_vencidos', em:'📒', t:'Cartera del cuadro', d:'Deudores del módulo de Cobros Pendientes' });
  const _seg = global.segClients;
  segClients = function (seg) {
    if (seg === 'cobros_vencidos') {
      return porCliente(abiertos()).filter(g => tel(g.telefono).length >= 7)
        .map(g => clienteDelPortal(g.cliente, g.telefono)
          || { id: 'co_' + norm(g.cliente), name: g.cliente, phone: g.telefono });
    }
    return _seg.apply(this, arguments);
  };
}

global.coTelefonos = () => {
  const sin = porCliente(abiertos()).filter(x => x.sinTelefono).sort((a, b) => b.saldo - a.saldo);
  if (!sin.length) return toast('Todos los deudores tienen WhatsApp', '👌');
  modal({
    title: 'Cargar teléfonos de los deudores', em: '📵', wide: true, ok: 'Guardar',
    body: `<div class="alertbox b"><span class="em">💬</span><div>Empieza por los de arriba: son los que más deben.
        Con el número cargado entran al envío masivo y a las campañas.</div></div>
      <div style="margin-top:12px">${sin.map((x, i) => `<div class="sortrow">
        <div style="flex:1;min-width:0"><b>${SEM[x.riesgo][0]} ${esc(x.cliente)}</b>
          <div class="tiny muted">${money(x.saldo)}${x.mora > 0 ? ` · ${x.mora} días de mora` : ''}</div></div>
        <input type="text" name="t${i}" inputmode="numeric" placeholder="3001234567" style="max-width:170px">
        <input type="hidden" name="n${i}" value="${esc(x.cliente)}"></div>`).join('')}</div>`,
    onSubmit: f => {
      let n = 0;
      Object.keys(f).filter(k => /^t\d+$/.test(k)).forEach(k => {
        const num = tel(f[k]); if (num.length < 7) return;
        const nom = norm(f['n' + k.slice(1)]);
        (S.cobros || []).forEach(c => { if (norm(c.cliente) === nom) { c.telefono = num; } });
        n++;
      });
      if (!n) return toast('No escribiste ningún número', '⚠️');
      audit('COBRO_TELEFONOS', n + ' cliente(s)');
      save('cobros'); closeModal(); render(); toast(n + ' teléfono(s) guardados', '💬');
    }
  });
};

/* ---------- unificar nombres ---------- */
global.coUnificar = () => {
  const dup = posiblesDuplicados();
  if (!dup.length) return toast('No hay nombres parecidos', '👌');
  modal({
    title: 'Unificar nombres de cliente', em: '🧹', ok: 'Unificar',
    body: `<p class="tiny muted">El mismo cliente escrito de dos formas aparece como dos deudores distintos.</p>
      ${dup.map(([a, b], i) => `<div class="sortrow"><div style="flex:1">
        <label style="display:block"><input type="radio" name="d${i}" value="${esc(a)}" checked> ${esc(a)}</label>
        <label style="display:block"><input type="radio" name="d${i}" value="${esc(b)}"> ${esc(b)}</label></div></div>`).join('')}`,
    onSubmit: f => {
      let n = 0;
      dup.forEach((par, i) => {
        const queda = f['d' + i];
        par.forEach(nom => { if (nom !== queda) (S.cobros || []).forEach(c => { if (c.cliente === nom) { c.cliente = queda; n++; } }); });
      });
      audit('COBRO_UNIFICAR', n + ' documento(s)');
      save('cobros'); closeModal(); render(); toast(n + ' documento(s) unificados', '🧹');
    }
  });
};

/* ---------- importar ---------- */
const COLS = [
  ['cliente', /CLIENTE|NOMBRE|DEUDOR/], ['factura', /FACTURA|REMIS|DOCUMENTO|N.?\s?FAC/],
  ['remision', /FECHA DE REMIS|F\.? ?REMIS|FECHA REMIS|EMISION/], ['vence', /CANCELA|VENCE|VENCIMIENTO|PLAZO/],
  ['valor', /VALOR|TOTAL|MONTO/], ['abono', /ABONO|PAGADO|PAGO/]
];
function mapear(filas) {
  if (!filas.length) return [];
  let iCab = filas.findIndex(f => f.some(c => /CLIENTE|DEUDOR/i.test(String(c || ''))));
  if (iCab < 0) iCab = 0;
  const cab = filas[iCab].map(c => norm(c));
  const idx = {};
  COLS.forEach(([k, re]) => { idx[k] = cab.findIndex(c => re.test(c)); });
  if (idx.cliente < 0) return [];
  const fecha = v => {
    if (!v) return '';
    if (v instanceof Date) return v.toLocaleDateString('en-CA');
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (m) { const a = m[3].length === 2 ? '20' + m[3] : m[3]; return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('en-CA');
  };
  const out = [];
  for (let i = iCab + 1; i < filas.length; i++) {
    const f = filas[i];
    const cli = String(f[idx.cliente] ?? '').trim();
    if (!cli || /^TOTAL/i.test(cli)) continue;
    const valor = soloNum(f[idx.valor]);
    if (!valor && idx.factura >= 0 && !String(f[idx.factura] ?? '').trim()) continue;
    out.push({ cliente: cli.replace(/\s+/g, ' ').replace(/\b\w/g, m => m.toUpperCase()),
      factura: idx.factura >= 0 ? String(f[idx.factura] ?? '').trim() : '',
      remision: idx.remision >= 0 ? fecha(f[idx.remision]) : '',
      vence: idx.vence >= 0 ? fecha(f[idx.vence]) : '',
      valor, abono: idx.abono >= 0 ? soloNum(f[idx.abono]) : 0 });
  }
  return out;
}
function guardarImportadas(nuevas, reemplazar) {
  if (!nuevas.length) return toast('No se reconoció ninguna fila. Revisa que estén las columnas CLIENTE y VALOR.', '⚠️');
  if (reemplazar) S.cobros = [];
  const clave = c => norm(c.cliente) + '|' + norm(c.factura) + '|' + c.valor;
  const ya = new Set((S.cobros || []).map(clave));
  let n = 0;
  nuevas.forEach(c => {
    if (ya.has(clave(c))) return;
    (S.cobros = S.cobros || []).push(Object.assign({ id: uid('co'), pagos: [], acuerdos: [], gestiones: [], creado: nowISO() }, c));
    ya.add(clave(c)); n++;
  });
  audit('COBRO_IMPORTAR', n + ' documento(s)');
  save('cobros'); closeModal(); render();
  toast(`${n} documento(s) importados${nuevas.length - n ? ` · ${nuevas.length - n} repetidos se omitieron` : ''}`, '⬆️');
}
global.coImportar = () => {
  modal({
    title: 'Importar cuadro de cartera', em: '⬆️', wide: true, ok: 'Importar',
    body: `<div class="alertbox b"><span class="em">📋</span><div>Sirve tu mismo cuadro de Excel. Reconoce
        <b>CLIENTE</b>, <b>#FACTURA</b>, <b>FECHA DE REMISION</b>, <b>FECHA DE CANCELACION</b>,
        <b>VALOR TOTAL</b> y <b>ABONO</b>, en cualquier orden.</div></div>
      <div class="row c2" style="margin-top:14px">
        <label class="field"><span>Opción 1 · sube el archivo</span><input type="file" id="coFile" accept=".xlsx,.xls,.csv"></label>
        <label class="field"><span>¿Qué hacer con lo que ya está?</span><select name="modo">
          <option value="sumar">Agregar y omitir repetidos</option>
          <option value="reemplazar">Reemplazar todo el cuadro</option></select></label></div>
      <label class="field"><span>Opción 2 · copia las filas en Excel y pégalas aquí</span>
        <textarea name="pegado" rows="7" placeholder="CLIENTE	#FACTURA	FECHA DE REMISION	FECHA DE CANCELACION	VALOR TOTAL	ABONO"></textarea></label>`,
    onSubmit: async f => {
      const reemplazar = f.modo === 'reemplazar';
      const file = document.getElementById('coFile')?.files?.[0];
      if (file) {
        try {
          if (/\.csv$/i.test(file.name)) {
            const txt = await file.text();
            const l0 = txt.split('\n')[0];
            const sep = (l0.match(/;/g) || []).length > (l0.match(/,/g) || []).length ? ';' : ',';
            return guardarImportadas(mapear(txt.split(/\r?\n/).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '')))), reemplazar);
          }
          toast('Leyendo el archivo…', '⏳');
          await libs('xlsx');
          const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
          return guardarImportadas(mapear(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' })), reemplazar);
        } catch (e) { console.error(e); return toast('No se pudo leer el archivo: ' + e.message, '⚠️'); }
      }
      const txt = String(f.pegado || '').trim();
      if (!txt) return toast('Sube el archivo o pega las filas', '⚠️');
      guardarImportadas(mapear(txt.split(/\r?\n/).map(l => l.split('\t'))), reemplazar);
    }
  });
};

/* ---------- exportación ---------- */
DOCS.cobros = () => {
  const l = lista().sort((a, b) => b.mora - a.mora);
  return {
    title: 'Cobros pendientes — cartera', subtitle: 'Corte ' + dmy(HOY()), orientation: 'l',
    columns: ['Riesgo','Cliente','Factura','Remisión','Vence','Días mora','Edad','Valor','Abono','Saldo','Estado','Acuerdo'],
    rows: l.map(c => [SEM[c.riesgo][1], c.cliente, c.factura, dmy(c.remision), dmy(c.vence),
      Math.max(0, c.mora), edad(c.mora), c.valor, c.abono || 0, c.saldo, EST[c.estado][0],
      c.prom ? dmy(c.prom.fecha) + ' (' + c.prom.estado + ')' : '']),
    totals: ['','TOTAL','','','','','', l.reduce((a, c) => a + c.valor, 0),
      l.reduce((a, c) => a + (c.abono || 0), 0), l.reduce((a, c) => a + c.saldo, 0), '', ''],
    kpis: ['1-30','31-60','61-90','+90'].map(e =>
      [e, abiertos().filter(c => edad(c.mora) === e).reduce((a, c) => a + c.saldo, 0)])
  };
};

/* ============================================================
   ALERTAS
   ============================================================ */
const _badges = global.badges;
badges = function (id) {
  if (id === 'cobros') {
    const n = vencidos().length + promesasHoy().length;
    return n ? `<span class="pill alert">${nfmt(n)}</span>` : '';
  }
  return _badges.apply(this, arguments);
};

const _dash = VIEWS.dashboard;
VIEWS.dashboard = function () {
  const ven = vencidos().sort((a, b) => b.mora - a.mora);
  const hoyP = promesasHoy(), rotas = promesasRotas();
  if (!ven.length && !hoyP.length) return _dash.apply(this, arguments);
  const total = ven.reduce((a, c) => a + c.saldo, 0);
  const bloque = `<div class="card" style="margin-bottom:14px;border-left:4px solid var(--bad)">
    <div class="card-h"><div style="flex:1"><b>📒 Cobros pendientes</b>
        <div class="tiny muted">${ven.length} vencido(s) por ${money(total)}
          ${hoyP.length ? ` · ${hoyP.length} prometió pagar hoy` : ''}
          ${rotas.length ? ` · ${rotas.length} promesa(s) rota(s)` : ''}</div></div>
      <button class="btn sm primary" onclick="go('cobros')">Ver cartera</button></div>
    <div>${hoyP.slice(0, 3).map(c => `<div class="sortrow"><span class="em">🤝</span>
        <div style="flex:1;min-width:0"><b>${esc(c.cliente)}</b>
          <div class="tiny muted">Prometió pagar hoy · ${esc(c.factura || 'Remisión')}</div></div>
        <b>${money(c.saldo)}</b><button class="btn sm primary" onclick="coAbonar('${c.id}')">Abonar</button></div>`).join('')}
      ${ven.slice(0, 5).map(c => `<div class="sortrow"><span class="em">${SEM[c.riesgo][0]}</span>
        <div style="flex:1;min-width:0"><b>${esc(c.cliente)}</b>
          <div class="tiny muted">${esc(c.factura || 'Remisión')} · venció hace ${c.mora} días</div></div>
        <b>${money(c.saldo)}</b><button class="btn sm" onclick="coAbonar('${c.id}')">Abonar</button></div>`).join('')}</div></div>`;
  return bloque + _dash.apply(this, arguments);
};

/* ---------- 3. AVISO EN EL PUNTO DE VENTA ---------- */
const _grabar = global.grabarVenta;
if (typeof _grabar === 'function') {
  grabarVenta = function () {
    try {
      const aCredito = (typeof pays !== 'undefined') && pays.some(p => p.method === 'credito');
      if (aCredito && !grabarVenta._ok) {
        const g = porCliente(abiertos()).find(x => norm(x.cliente) === norm(posHdr.clientName));
        if (g && g.riesgo !== 'verde') {
          const txt = `${g.cliente} está en semáforo ${SEM[g.riesgo][1].toLowerCase()}: debe ${money(g.saldo)}`
            + (g.mora > 0 ? ` con ${g.mora} días de mora` : '')
            + (g.rotas ? ` y ${g.rotas} promesa(s) de pago incumplida(s)` : '') + '.';
          if (g.riesgo === 'rojo') {
            return pedirGerencia(txt + ' Venderle a crédito necesita autorización.', () => {
              grabarVenta._ok = true; grabarVenta(); grabarVenta._ok = false;
            });
          }
          if (!confirm(txt + '\n\n¿Aun así le vendes a crédito?')) return;
        }
      }
    } catch (e) { console.warn('Semáforo POS:', e); }
    return _grabar.apply(this, arguments);
  };
}

/* ---------- aviso diario ---------- */
function avisoDelDia() {
  const ven = vencidos(), hoyP = promesasHoy();
  if (!ven.length && !hoyP.length) return;
  const clave = 'ef_cobros_aviso';
  if (localStorage.getItem(clave) === HOY()) return;
  localStorage.setItem(clave, HOY());
  const total = money(ven.reduce((a, c) => a + c.saldo, 0));
  const msg = hoyP.length ? `${hoyP.length} prometieron pagar hoy · ${ven.length} vencidos por ${total}`
                          : `${ven.length} cobro(s) vencido(s) por ${total}`;
  toast(msg, '🔔');
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Electro Futuro · cartera', { body: msg, tag: 'ef-cobros' });
    }
  } catch (e) { }
}

/* ============================================================
   ARRANQUE
   ============================================================ */
function menuDeCobros() {
  const m = S.config.menu || [];
  if (!m.some(x => x.id === 'cobros')) {
    const i = m.findIndex(x => x.id === 'cartera');
    m.splice(i >= 0 ? i + 1 : m.length, 0, { id:'cobros', label:'Cobros Pendientes', em:'🔔', on:true });
    S.config.menu = m; save('config');
  }
}
function semilla() {
  if ((S.cobros || []).length || S.config.cobrosSembrado) return;
  const base = global.EF_COBROS_BASE;
  if (!Array.isArray(base) || !base.length) return;
  S.cobros = base.map(c => Object.assign({ id: uid('co'), pagos: [], acuerdos: [], gestiones: [], creado: nowISO() }, c));
  S.config.cobrosSembrado = nowISO();
  save('cobros', 'config');
  toast(`${base.length} documentos del cuadro de cartera cargados`, '📒');
}
function arrancar() {
  if (!S.cobros) S.cobros = [];
  S.cobros.forEach(c => { c.acuerdos = c.acuerdos || []; c.gestiones = c.gestiones || []; c.pagos = c.pagos || []; });
  menuDeCobros();
  semilla();
  render();
  setTimeout(avisoDelDia, 1200);
  setInterval(avisoDelDia, 3600000);
}
if (global.__efListo) setTimeout(arrancar, 250);
else global.addEventListener('ef:listo', () => setTimeout(arrancar, 250), { once: true });

global.EF_cobros = { lista, abiertos, vencidos, promesasHoy, promesasRotas, porCliente, riesgo, arrancar };
})(window);
