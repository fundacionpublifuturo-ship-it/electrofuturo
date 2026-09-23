/* ============================================================
   ELECTRO FUTURO — admin-nube.js
   Conecta el portal de gestión con Supabase sin tocar su código.

   El portal ya sabe trabajar con una base remota: al arrancar pide
   claude.use('db') y, si existe, guarda ahí cada colección. Este
   archivo le entrega esa base, montada sobre Supabase y protegida
   con la clave del negocio. Si no hay Supabase configurado, no hace
   nada y el portal sigue en modo local como siempre.
   ============================================================ */
(function (global) {
  'use strict';
  if (!global.Nube || !Nube.activa()) return;

  const LLAVE = 'ef_clave_negocio';
  let CLAVE = null;

  const DBX = {
    doc(path) {
      return {
        async get() {
          const v = await Nube.rpc('ef_kv_get', { p_clave: CLAVE, p_key: path });
          return { exists: v !== null && v !== undefined, data: () => v };
        },
        set(obj) { return Nube.rpc('ef_kv_set', { p_clave: CLAVE, p_key: path, p_value: obj }); },
        delete() { return Nube.rpc('ef_kv_del', { p_clave: CLAVE, p_key: path }); }
      };
    }
  };

  /* ---------- pantalla de la clave del negocio ---------- */
  function pedirClave(error) {
    return new Promise(resolve => {
      let ov = document.getElementById('ef-clave');
      if (ov) ov.remove();
      ov = document.createElement('div');
      ov.id = 'ef-clave';
      ov.innerHTML = `
        <style>
          #ef-clave{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;
            background:linear-gradient(135deg,#1B2126 0%,#0E93A5 55%,#19C1D6 100%);
            font-family:Inter,system-ui,sans-serif}
          #ef-clave .caja{width:min(400px,100%);background:#fff;border-radius:22px;padding:30px 28px;
            box-shadow:0 30px 70px -28px rgba(27,33,38,.55);animation:efIn .45s cubic-bezier(.22,1,.36,1)}
          @keyframes efIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
          #ef-clave .ic{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;
            background:linear-gradient(135deg,#0E93A5,#19C1D6);color:#fff;margin-bottom:16px;
            box-shadow:0 10px 24px -10px rgba(14,147,165,.8)}
          #ef-clave h2{font-family:Poppins,Inter,sans-serif;font-size:20px;margin:0 0 6px;color:#1B2126;letter-spacing:-.02em}
          #ef-clave p{margin:0 0 18px;color:#6A737B;font-size:13.5px;line-height:1.55}
          #ef-clave label{display:block;font-size:12px;font-weight:600;color:#3B434A;margin-bottom:6px}
          #ef-clave input{width:100%;padding:12px 14px;border:1.5px solid #DFE4E8;border-radius:12px;
            font-size:15px;outline:none;transition:.16s;box-sizing:border-box}
          #ef-clave input:focus{border-color:#0E93A5;box-shadow:0 0 0 3px #E7F8FB}
          #ef-clave .err{background:#FDEAE8;color:#CE2C22;border-radius:10px;padding:9px 12px;
            font-size:12.5px;margin-bottom:14px}
          #ef-clave button{width:100%;margin-top:14px;padding:13px;border:0;border-radius:12px;cursor:pointer;
            font-weight:600;font-size:14px;transition:.16s}
          #ef-clave .pri{background:linear-gradient(135deg,#1B2126,#0E93A5 55%,#19C1D6);color:#fff;
            box-shadow:0 10px 24px -12px rgba(14,147,165,.9)}
          #ef-clave .pri:hover{transform:translateY(-1px);box-shadow:0 14px 30px -12px rgba(14,147,165,1)}
          #ef-clave .sec{background:#F1F4F6;color:#3B434A;margin-top:8px}
          #ef-clave .sec:hover{background:#E7F8FB;color:#0B7C8C}
          #ef-clave small{display:block;margin-top:14px;color:#98A1A9;font-size:11.5px;line-height:1.5;text-align:center}
        </style>
        <div class="caja">
          <div class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/>
            <path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
          <h2>Clave del negocio</h2>
          <p>Conecta este equipo con la base de Electro Futuro. Se pide una sola vez por dispositivo.</p>
          ${error ? `<div class="err">${error}</div>` : ''}
          <label for="ef-clave-in">Clave</label>
          <input type="password" id="ef-clave-in" autocomplete="current-password">
          <button class="pri" id="ef-clave-ok">Conectar</button>
          <button class="sec" id="ef-clave-local">Trabajar sin conexión en este equipo</button>
          <small>Sin conexión, los datos quedan solo en este navegador y no llegan los pedidos de la tienda.</small>
        </div>`;
      document.body.appendChild(ov);
      const inp = ov.querySelector('#ef-clave-in');
      setTimeout(() => inp.focus(), 60);
      const listo = v => { ov.remove(); resolve(v); };
      ov.querySelector('#ef-clave-ok').onclick = () => { if (inp.value.trim()) listo(inp.value.trim()); else inp.focus(); };
      inp.onkeydown = e => { if (e.key === 'Enter') ov.querySelector('#ef-clave-ok').click(); };
      ov.querySelector('#ef-clave-local').onclick = () => listo(null);
    });
  }

  function esperarBody() {
    return document.body ? Promise.resolve()
      : new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  /* Primera conexión: si la nube está vacía y este navegador ya tenía
     datos del portal, se suben para no empezar de cero. */
  async function subirLocalSiVacia() {
    const hay = await Nube.rpc('ef_kv_get', { p_clave: CLAVE, p_key: 'store/config' });
    if (hay) return;
    const local = Nube.leer(Nube.POS, null);
    if (!local) return;
    for (const k of Object.keys(local)) {
      await Nube.rpc('ef_kv_set', { p_clave: CLAVE, p_key: 'store/' + k, p_value: { v: local[k], at: new Date().toISOString() } });
    }
  }

  async function conectar() {
    await esperarBody();
    let intento = localStorage.getItem(LLAVE);
    let error = '';
    for (let i = 0; i < 6; i++) {
      if (!intento) {
        intento = await pedirClave(error);
        if (intento === null) { localStorage.removeItem(LLAVE); return null; }
      }
      try {
        const ok = await Nube.rpc('ef_ok', { p_clave: intento });
        if (ok) {
          CLAVE = intento;
          global.EF_CLAVE = intento;
          localStorage.setItem(LLAVE, intento);
          await subirLocalSiVacia().catch(() => {});
          return DBX;
        }
        error = 'Esa clave no es la del negocio.';
      } catch (e) {
        error = 'No se pudo conectar con la base: ' + e.message + '. Revisa tu internet.';
      }
      localStorage.removeItem(LLAVE);
      intento = null;
    }
    return null;
  }

  let promesa = null;
  global.claude = Object.assign(global.claude || {}, {
    use(nombre) {
      if (nombre !== 'db') return Promise.resolve(null);
      return promesa || (promesa = conectar());
    }
  });

  /* Para cambiar de clave o de negocio desde la consola: EF_olvidarClave() */
  global.EF_olvidarClave = () => { localStorage.removeItem(LLAVE); location.reload(); };
})(window);
