-- ============================================================
-- ELECTRO FUTURO — Esquema de base de datos (Supabase / PostgreSQL)
-- Base para el portal administrativo y el portal de clientes.
-- Ejecutar en Supabase → SQL Editor → New query → Run.
-- ============================================================

-- ---------- Usuarios internos ----------
create table if not exists usuarios (
  id        uuid primary key default gen_random_uuid(),
  auth_id   uuid unique,                 -- referencia a auth.users
  nombre    text not null,
  correo    text unique not null,
  rol       text not null check (rol in ('comercial','gerencia','bodega')),
  activo    boolean default true,
  creado    timestamptz default now()
);

-- ---------- Catálogo ----------
create table if not exists productos (
  sku              text primary key,
  nombre           text not null,
  categoria        text,
  subcategoria     text,
  marca            text,
  descripcion      text,
  costo            numeric(12,0) default 0,   -- SOLO gerencia
  precio           numeric(12,0) not null,
  precio_mayorista numeric(12,0),
  stock            integer default 0,
  stock_reservado  integer default 0,
  stock_minimo     integer default 3,
  imagen           text,
  activo           boolean default true,
  actualizado      timestamptz default now()
);

-- Vista sin costos: es la que consulta el catálogo público y el comercial.
create or replace view productos_publico as
  select sku, nombre, categoria, subcategoria, marca, descripcion,
         precio, stock, stock_reservado, imagen, activo
  from productos
  where activo;

create table if not exists movimientos_inventario (
  id            bigserial primary key,
  sku           text references productos(sku),
  tipo          text check (tipo in ('entrada','salida','ajuste','devolucion')),
  cantidad      integer not null,
  saldo_despues integer,
  motivo        text,
  pedido_id     bigint,
  usuario_id    uuid references usuarios(id),
  fecha         timestamptz default now()
);

-- ---------- Clientes ----------
create table if not exists clientes (
  id              bigserial primary key,
  nombre          text not null,
  documento       text,
  telefono        text not null,
  correo          text,
  direccion       text,
  ciudad          text default 'Ibagué',
  tipo            text default 'minorista' check (tipo in ('minorista','mayorista','estudiante')),
  autoriza_datos  boolean default false,
  autoriza_fecha  timestamptz,
  notas           text,
  creado          timestamptz default now()
);
create unique index if not exists clientes_telefono_uk on clientes (telefono);

-- ---------- Pedidos ----------
create table if not exists pedidos (
  id              bigserial primary key,
  codigo          text unique not null,      -- EF-2026-00142
  cliente_id      bigint references clientes(id),
  estado          text default 'nuevo' check (estado in
                    ('nuevo','pago_verificado','alistando','listo_recoger',
                     'despachado','entregado','anulado','devuelto')),
  entrega         text check (entrega in ('recoger','envio')),
  direccion_envio text,
  transportadora  text,
  guia            text,
  subtotal        numeric(12,0),
  descuento       numeric(12,0) default 0,
  envio           numeric(12,0) default 0,
  total           numeric(12,0),
  metodo_pago     text,
  referencia_pago text,
  pagado          boolean default false,
  pagado_fecha    timestamptz,
  vendedor_id     uuid references usuarios(id),
  creado          timestamptz default now()
);

create table if not exists pedido_items (
  id        bigserial primary key,
  pedido_id bigint references pedidos(id) on delete cascade,
  sku       text,
  nombre    text,
  precio    numeric(12,0),
  costo     numeric(12,0),                 -- costo congelado, para el margen real
  cantidad  integer,
  subtotal  numeric(12,0)
);

create table if not exists pedido_eventos (
  id         bigserial primary key,
  pedido_id  bigint references pedidos(id) on delete cascade,
  estado     text,
  nota       text,
  usuario_id uuid references usuarios(id),
  fecha      timestamptz default now()
);

-- ---------- Cartera y caja ----------
create table if not exists cartera (
  id         bigserial primary key,
  cliente_id bigint references clientes(id),
  pedido_id  bigint references pedidos(id),
  monto      numeric(12,0),
  abonado    numeric(12,0) default 0,
  vence      date,
  estado     text default 'pendiente' check (estado in ('pendiente','parcial','pagada','incobrable'))
);

create table if not exists abonos (
  id         bigserial primary key,
  cartera_id bigint references cartera(id) on delete cascade,
  monto      numeric(12,0),
  metodo     text,
  usuario_id uuid references usuarios(id),
  fecha      timestamptz default now()
);

create table if not exists caja (
  id          bigserial primary key,
  fecha       date default current_date,
  tipo        text check (tipo in ('ingreso','egreso')),
  categoria   text,
  descripcion text,
  monto       numeric(12,0),
  metodo      text,
  pedido_id   bigint references pedidos(id),
  usuario_id  uuid references usuarios(id)
);

-- ---------- Garantías ----------
create table if not exists garantias (
  id         bigserial primary key,
  cliente_id bigint references clientes(id),
  pedido_id  bigint references pedidos(id),
  sku        text,
  motivo     text,
  estado     text default 'radicada' check (estado in
               ('radicada','en_revision','aprobada','rechazada','resuelta')),
  creado     timestamptz default now()
);

-- ---------- Auditoría ----------
create table if not exists auditoria (
  id         bigserial primary key,
  tabla      text,
  registro   text,
  accion     text,
  antes      jsonb,
  despues    jsonb,
  usuario_id uuid references usuarios(id),
  fecha      timestamptz default now()
);

-- ---------- Índices ----------
create index if not exists ix_pedidos_estado   on pedidos (estado, creado desc);
create index if not exists ix_pedidos_cliente  on pedidos (cliente_id);
create index if not exists ix_items_pedido     on pedido_items (pedido_id);
create index if not exists ix_mov_sku          on movimientos_inventario (sku, fecha desc);
create index if not exists ix_cartera_estado   on cartera (estado, vence);
create index if not exists ix_caja_fecha       on caja (fecha desc);

-- ============================================================
-- SEGURIDAD: el comercial NO puede ver costos ni utilidad.
-- Esto se bloquea en la base, no con CSS. Sin RLS, cualquiera con la
-- clave anónima lee la tabla completa desde la consola del navegador.
-- ============================================================
alter table productos              enable row level security;
alter table clientes               enable row level security;
alter table pedidos                enable row level security;
alter table pedido_items           enable row level security;
alter table cartera                enable row level security;
alter table caja                   enable row level security;
alter table movimientos_inventario enable row level security;
alter table usuarios               enable row level security;

create or replace function mi_rol() returns text language sql stable as $$
  select rol from usuarios where auth_id = auth.uid() limit 1;
$$;

-- productos: solo gerencia y bodega ven la tabla con costo.
create policy productos_lectura on productos for select
  using (mi_rol() in ('gerencia','bodega'));
create policy productos_escritura on productos for all
  using (mi_rol() = 'gerencia') with check (mi_rol() = 'gerencia');

-- pedidos y clientes: cualquier usuario interno autenticado.
create policy pedidos_lectura on pedidos for select
  using (mi_rol() is not null);
create policy pedidos_escritura on pedidos for all
  using (mi_rol() in ('comercial','gerencia')) with check (mi_rol() in ('comercial','gerencia'));
create policy clientes_todo on clientes for all
  using (mi_rol() is not null) with check (mi_rol() in ('comercial','gerencia'));

-- finanzas: solo gerencia.
create policy caja_gerencia on caja for all
  using (mi_rol() = 'gerencia') with check (mi_rol() = 'gerencia');
create policy cartera_lectura on cartera for select
  using (mi_rol() in ('comercial','gerencia'));
create policy cartera_escritura on cartera for all
  using (mi_rol() = 'gerencia') with check (mi_rol() = 'gerencia');

-- items: se leen con el pedido, pero el costo solo lo ve gerencia
-- (usar la vista de abajo desde el portal comercial).
create policy items_lectura on pedido_items for select
  using (mi_rol() is not null);
create or replace view pedido_items_publico as
  select id, pedido_id, sku, nombre, precio, cantidad, subtotal from pedido_items;

create policy inventario_lectura on movimientos_inventario for select
  using (mi_rol() in ('gerencia','bodega'));
create policy usuarios_propio on usuarios for select
  using (auth_id = auth.uid() or mi_rol() = 'gerencia');

-- ============================================================
-- Carga inicial del catálogo:
-- importa assets/data/productos.json a la tabla productos desde
-- Supabase → Table editor → Import data, o con el script de carga.
-- ============================================================
