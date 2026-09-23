/* Configuracion del sitio. Es el unico archivo que editas a mano. */
/* ============================================================
   ELECTROFUTURO — Configuración
   Lo único que hay que editar para poner el sitio en marcha.
   ============================================================ */
const EF_CONFIG = {
  // Número de WhatsApp que recibe los pedidos (formato internacional, sin + ni espacios)
  WHATSAPP: '573134135751',
  // Supabase: conecta la tienda con el portal admin (pedidos y existencias).
  // Mientras diga TU-PROYECTO, todo funciona en modo local (un solo navegador).
  // Los dos valores salen de Supabase → Project Settings → API.
  // La anon key es pública por diseño: la seguridad está en la clave del negocio.
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU_ANON_KEY',
  // WhatsApp que atiende los cursos (PubliFuturo). Ponlo igual al de arriba
  // si quieres que los informes de academia lleguen tambien a la tienda.
  WHATSAPP_ACADEMIA: '573128422225',
  URL_VERIFICAR: 'https://publifuturo.com/verificar'
};
