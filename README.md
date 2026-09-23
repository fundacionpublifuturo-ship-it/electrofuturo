# Electro Futuro — sitio web

Paquete con carpetas. Antes era un solo `index.html` de **1,16 MB**; ahora el HTML
pesa **46 KB** y las 84 fotos se cargan en diferido, solo cuando entran en pantalla.

## Qué cambió

| | Antes | Ahora |
|---|---|---|
| index.html | 1.188 KB | 46 KB |
| Fotos | incrustadas en base64 | 84 archivos `.webp` con `loading="lazy"` |
| CSS / JS | dentro del HTML | archivos aparte, cacheables entre visitas |
| Catálogo | dentro del HTML | `assets/data/productos.json` (77 KB) |

## Estructura

```
electrofuturo/
├── index.html                    página completa
├── assets/
│   ├── css/estilos.css
│   ├── js/config.js              ← lo único que editas a mano
│   ├── js/app.js                 catálogo, filtros, carrito, checkout, asesor
│   ├── js/extras.js              academia, política de datos, carrito flotante
│   ├── js/productos.js           213 referencias (esto es lo que lee la página)
│   ├── data/productos.json       el mismo catálogo, para importar a Supabase
│   └── img/productos/            84 fotos, nombradas con el SKU
│       img/marca/                los 3 logos
│   └── js/datos.js               base compartida: líneas, pipeline, bodega, alertas
│       js/cuenta.js              portal de clientes
├── admin.html                    portal administrativo (Gestión POS)
├── cuenta.html                   portal de clientes
├── api/asistente.js              asesor de IA (función serverless)
├── supabase/puente.sql           conexión tienda ↔ portal en Supabase
└── vercel.json
```

## Portal administrativo (`admin.html`)

Es el aplicativo **PubliFuturo Gestión** con la paleta de la tienda: punto de venta con
factura POS, cierre de caja con informes X y Z, separados y créditos, cuentas mayoristas,
inventario y kardex multiprecio, capturador de inventario físico, clientes y terceros,
facturas y anulaciones, cuentas por cobrar, compras y proveedores, garantías, comisiones,
estados financieros, campañas por WhatsApp, gastos, reportes y exportación a PDF, Excel y Word.

Tiene **sus propios usuarios con PIN**. La primera vez pide crear el usuario de gerencia;
los cajeros y bodega se crean después en Configuración. No se conecta a la DIAN.

Guarda en `localStorage` con la llave `ef_gestion_v1`. Las librerías de PDF, Excel y QR se
cargan desde cdnjs: sin internet la aplicación funciona, pero esas exportaciones no.

## Conectar la tienda con el portal admin (Supabase)

Sin este paso cada navegador guarda su propia base: los pedidos que haga un cliente
desde su celular **no llegan** al portal. Con Supabase todo queda en una sola base.

**Qué hace la conexión**

- Los pedidos de la tienda llegan al portal como **ventas en espera**. En Punto de Venta →
  «Recuperar venta en espera» se cargan con el cliente, los productos y el total; se
  factura con GRABAR (F12) y el stock baja con el flujo normal del portal.
- El portal publica precio y existencias. Una referencia que ya tiene existencias
  cargadas y llega a cero sale **Agotado** en la tienda. Las que nunca se les cargó stock
  siguen como estaban, para no apagar el catálogo mientras haces la carga inicial.
- El portal guarda todos sus datos en la nube: el computador del local, el celular y los
  cajeros ven lo mismo.
- La primera vez que abre el portal, las 213 referencias de la tienda se cargan solas al
  inventario, con su SKU como código.

**Paso a paso**

1. Entra a supabase.com, crea una cuenta y **New project**. Nombre: `electrofuturo`.
   Región: South America (São Paulo). Guarda la contraseña de la base.
2. Abre `supabase/puente.sql`, cambia `CAMBIA-ESTA-CLAVE` por una clave larga tuya
   (es la **clave del negocio**) y copia todo el archivo.
3. En Supabase: **SQL Editor → New query**, pega y **Run**. Debe decir «Success».
4. **Project Settings → API**: copia *Project URL* y la llave *anon public*.
5. En `assets/js/config.js` reemplaza `https://TU-PROYECTO.supabase.co` por la URL y
   `TU_ANON_KEY` por la llave.
6. Sube a GitHub. Vercel despliega solo.
7. Abre `/admin.html`: pide la **clave del negocio** una sola vez por equipo.

**Seguridad.** Las tablas tienen RLS activo sin políticas: con la llave pública nadie las
lee ni las escribe. Todo pasa por funciones que exigen la clave del negocio, guardada
cifrada con bcrypt. La tienda solo puede crear pedidos y leer precio y existencias.

Para cambiar la clave: en SQL Editor corre
`update public.ef_secreto set clave = extensions.crypt('NUEVA', extensions.gen_salt('bf')) where id = 1;`
y en cada equipo abre la consola del navegador y escribe `EF_olvidarClave()`.

## Cobros Pendientes

Módulo del portal con el cuadro de cartera que se llevaba en Excel. Arranca con los
**67 documentos** del `CUADRO_CONSOLIDADO_FER`: $173.841.225 facturados, $44.446.100
abonados y **$129.395.125 por cobrar** de 47 clientes.

**Vista.** Agrupada por cliente, como el Excel, o documento por documento. Filtros por
estado, por riesgo y por origen. Buscador. Edades de la cartera en 1-30, 31-60, 61-90 y +90.

**Acuerdos de pago.** Al abonar se deja la fecha en que el cliente prometió pagar el resto.
El portal lo recuerda ese día en el tablero y en la pastilla del menú. Si pasa la fecha y el
saldo no bajó, la promesa queda marcada como incumplida y se cuenta contra el cliente.

**Historial de gestión.** Cada llamada, WhatsApp o visita queda con fecha, resultado y qué
dijo el cliente. En la tarjeta se ve hace cuántos días fue la última gestión, o si nunca se
le ha escrito. Al usar el botón de cobrar, el portal pregunta después qué respondió.

**Semáforo de riesgo.** Verde hasta 30 días de mora; amarillo hasta 60 o con una promesa
rota; rojo por encima de 60 o con dos promesas rotas. Se ve en la tarjeta y filtra la lista.

**Cupo de crédito.** El saldo de este cuadro cuenta dentro del cupo del cliente en el punto
de venta. Si va a superarlo, el POS pide autorización de gerencia. Además, al facturar a
crédito a un cliente amarillo el sistema advierte, y a uno rojo exige autorización.

**Envío masivo.** «Enviar a todos, uno por uno» abre WhatsApp cliente por cliente con el
mensaje escrito y va registrando la gestión. También lleva el segmento «Cartera del cuadro»
a Campañas WhatsApp. Los deudores sin número aparecen en un aviso con una pantalla para
cargarlos de una, empezando por los que más deben.

**Recibo de caja.** Cada abono genera un consecutivo RC-0001 y su comprobante en PDF para
enviarle al cliente.

**Proyección de recaudo.** Cuánto vence cada una de las próximas cuatro semanas y cuánto de
eso tiene promesa de pago, contra lo realmente recaudado en el mes.

**Créditos del punto de venta.** Las ventas a crédito del POS aparecen en el mismo cuadro,
marcadas como POS, para no llevar dos carteras.

**Importar.** Sube el `.xlsx` o el `.csv`, o pega las filas de Excel. Reconoce CLIENTE,
#FACTURA, FECHA DE REMISION, FECHA DE CANCELACION, VALOR TOTAL y ABONO en cualquier orden y
omite los repetidos. Exporta a PDF, Excel y Word.

Lo ven gerencia y comercial.

## Portal de clientes (`cuenta.html`)

Se entra con el número de WhatsApp con el que se compró, o se rastrea un pedido solo con su
código. Muestra la línea de tiempo del pedido, el número de guía, repetir pedido, radicar
garantía, editar datos y pedir la eliminación de datos.


## Subirlo

1. Sube **toda la carpeta** al repositorio de GitHub (no solo el `index.html`).
2. En Vercel, el proyecto se despliega solo con cada push.
3. En **Settings → Environment Variables** agrega `ANTHROPIC_API_KEY` para que
   funcione el asesor. Sin esa variable el chat responde con el mensaje de
   respaldo y manda al WhatsApp.

## Probarlo en tu computador

Descomprime la carpeta y **haz doble clic en `index.html`**. Funciona tal cual,
sin servidor: el catálogo va en `assets/js/productos.js` y se carga con una
etiqueta `<script>`, no con `fetch`, justamente para que abra desde la carpeta.

Lo mismo con `admin.html` y `cuenta.html`. Los tres comparten los datos porque el
navegador trata los archivos de una misma carpeta como un mismo origen.

Importante: si arrastras los archivos **desde dentro del ZIP** sin descomprimir,
Windows abre copias temporales sueltas y las rutas a `assets/` se rompen. Extrae
primero.

## Editar

**Teléfono, WhatsApp, Supabase:** `assets/js/config.js`.

**Precios y productos:** `assets/js/productos.js`. Cada referencia tiene
`sku`, `nombre`, `categoria`, `subcategoria`, `marca`, `precio`, `agotado` e
`imagen`.

**Fotos nuevas:** guarda el archivo en `assets/img/productos/` con el nombre del
SKU (`EF-PT-001.webp`) y en el JSON pon
`"imagen": "assets/img/productos/EF-PT-001.webp"`. Faltan las 107 pantallas y las
22 baterías; mientras no tengan foto se muestran con la ficha técnica.

**Cursos:** el arreglo `EF_CURSOS` al principio de `assets/js/extras.js`. Falta el
pénsum del Curso de Software Básico; mientras tanto la ficha muestra un aviso en
lugar de una sección vacía.

**Política de datos:** el texto está al final del `index.html`, dentro del bloque
`efp-overlay`. Hazlo revisar por un abogado antes de publicar.

## El carrito

El carrito estaba roto por una sola línea de CSS:

```css
.nav,.pedido,.ia-panel,.modal-fondo,.toast{z-index:70}
```

Igualaba a 70 el `z-index` de todo. El cajón del carrito (`.pedido`, z-index 100)
quedaba **por debajo de su propio velo oscuro** (`.pedido-fondo`, z-index 90): el
cajón abría detrás del velo y cualquier clic caía en el velo, que lo cerraba de
inmediato. El mismo problema tumbaba el modal de producto y el panel del asesor.
Ahora hay una escalera de superposición explícita.

Además se agregó: botón **Agregar** y **Comprar ahora** en cada tarjeta,
confirmación en el propio botón, **botón flotante** con contador que aparece
cuando hay algo en el carrito, carrito vacío con salida al catálogo, y el arranque
aislado en `try/catch` para que un error de datos no deje la página sin responder
a los clics.

