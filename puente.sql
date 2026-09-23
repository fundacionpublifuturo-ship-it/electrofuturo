-- ============================================================
-- ELECTRO FUTURO — Puente tienda ↔ portal admin (Supabase)
--
-- Qué hace:
--   1. El portal admin guarda TODOS sus datos en la nube, así el
--      computador del local, el celular y cualquier cajero ven lo mismo.
--   2. Los pedidos que entran por la tienda web llegan al portal
--      como "ventas en espera" listas para facturar.
--   3. El stock del portal manda sobre el catálogo de la tienda.
--
-- Seguridad:
--   Las tablas tienen RLS activo y SIN políticas: nadie las lee ni las
--   escribe directo con la clave pública. Todo pasa por funciones que
--   exigen la CLAVE DEL NEGOCIO (guardada cifrada con bcrypt). La tienda
--   solo puede: crear pedidos y leer precio y existencias.
--
-- Cómo usarlo:
--   1. Cambia 'CAMBIA-ESTA-CLAVE' abajo por una clave larga tuya.
--   2. Supabase → SQL Editor → New query → pega todo → Run.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tablas ----------
create table if not exists public.ef_secreto (
  id    int primary key default 1 check (id = 1),
  clave text not null
);

create table if not exists public.ef_kv (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.ef_stock_publico (
  sku        text primary key,
  nombre     text,
  precio     numeric(14,0),
  stock      integer,
  controla   boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.ef_pedidos_web (
  id      uuid primary key default gen_random_uuid(),
  codigo  text unique,
  datos   jsonb not null,
  estado  text not null default 'nuevo' check (estado in ('nuevo','tomado')),
  creado  timestamptz default now(),
  tomado  timestamptz
);

alter table public.ef_secreto       enable row level security;
alter table public.ef_kv            enable row level security;
alter table public.ef_stock_publico enable row level security;
alter table public.ef_pedidos_web   enable row level security;

-- La tienda puede LEER precio y existencias. Nada más.
drop policy if exists stock_lectura_publica on public.ef_stock_publico;
create policy stock_lectura_publica on public.ef_stock_publico
  for select to anon, authenticated using (true);

revoke all on public.ef_secreto, public.ef_kv, public.ef_pedidos_web from anon, authenticated;
revoke insert, update, delete on public.ef_stock_publico from anon, authenticated;
grant select on public.ef_stock_publico to anon, authenticated;

-- ---------- Clave del negocio (CÁMBIALA antes de correr) ----------
insert into public.ef_secreto (id, clave)
values (1, extensions.crypt('CAMBIA-ESTA-CLAVE', extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- ---------- Funciones ----------
create or replace function public.ef_ok(p_clave text) returns boolean
language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from ef_secreto where clave = extensions.crypt(p_clave, clave));
$$;

create or replace function public.ef_kv_get(p_clave text, p_key text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ef_ok(p_clave) then raise exception 'clave incorrecta' using errcode = '28000'; end if;
  return (select value from ef_kv where key = p_key);
end $$;

create or replace function public.ef_kv_set(p_clave text, p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ef_ok(p_clave) then raise exception 'clave incorrecta' using errcode = '28000'; end if;
  insert into ef_kv (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

create or replace function public.ef_kv_del(p_clave text, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ef_ok(p_clave) then raise exception 'clave incorrecta' using errcode = '28000'; end if;
  delete from ef_kv where key = p_key;
end $$;

-- El portal publica precio y existencias de cada referencia
create or replace function public.ef_publicar_stock(p_clave text, p_filas jsonb) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  if not ef_ok(p_clave) then raise exception 'clave incorrecta' using errcode = '28000'; end if;
  insert into ef_stock_publico (sku, nombre, precio, stock, controla, updated_at)
  select f->>'sku', f->>'nombre', (f->>'precio')::numeric, (f->>'stock')::integer,
         coalesce((f->>'controla')::boolean, false), now()
  from jsonb_array_elements(p_filas) f
  where coalesce(f->>'sku','') <> ''
  on conflict (sku) do update set nombre = excluded.nombre, precio = excluded.precio,
    stock = excluded.stock, controla = excluded.controla, updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- La tienda deja un pedido. No requiere clave, pero se valida el tamaño.
create or replace function public.ef_pedido_nuevo(p_datos jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare cod text;
begin
  if p_datos is null or length(p_datos::text) > 30000 then
    raise exception 'pedido inválido';
  end if;
  if jsonb_typeof(p_datos->'items') <> 'array' or jsonb_array_length(p_datos->'items') = 0
     or jsonb_array_length(p_datos->'items') > 150 then
    raise exception 'pedido sin productos';
  end if;
  cod := coalesce(nullif(p_datos->>'codigo',''), 'WEB-' || to_char(now(),'YYMMDDHH24MISS'));
  insert into ef_pedidos_web (codigo, datos) values (cod, p_datos)
  on conflict (codigo) do nothing;
  return cod;
end $$;

-- El portal recoge los pedidos nuevos
create or replace function public.ef_pedidos_pendientes(p_clave text) returns setof ef_pedidos_web
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ef_ok(p_clave) then raise exception 'clave incorrecta' using errcode = '28000'; end if;
  return query select * from ef_pedidos_web where estado = 'nuevo' order by creado;
end $$;

create or replace function public.ef_pedido_tomado(p_clave text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ef_ok(p_clave) then raise exception 'clave incorrecta' using errcode = '28000'; end if;
  update ef_pedidos_web set estado = 'tomado', tomado = now() where id = p_id;
end $$;

-- Permisos: la clave pública solo puede llamar a estas funciones
revoke all on function public.ef_ok(text) from public;
grant execute on function public.ef_ok(text)                           to anon, authenticated;
grant execute on function public.ef_kv_get(text, text)                 to anon, authenticated;
grant execute on function public.ef_kv_set(text, text, jsonb)          to anon, authenticated;
grant execute on function public.ef_kv_del(text, text)                 to anon, authenticated;
grant execute on function public.ef_publicar_stock(text, jsonb)        to anon, authenticated;
grant execute on function public.ef_pedido_nuevo(jsonb)                to anon, authenticated;
grant execute on function public.ef_pedidos_pendientes(text)           to anon, authenticated;
grant execute on function public.ef_pedido_tomado(text, uuid)          to anon, authenticated;

-- Para cambiar la clave más adelante:
--   update public.ef_secreto set clave = extensions.crypt('NUEVA-CLAVE', extensions.gen_salt('bf')) where id = 1;
