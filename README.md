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
│       js/admin-ui.js            iconos, tablas, estados y gráficas SVG
│       js/admin.js               cascarón, tablero, pipeline y portal de línea
│       js/admin-mod.js           módulos y paneles de detalle
│       js/cuenta.js              portal de clientes
├── admin.html                    portal administrativo
├── cuenta.html                   portal de clientes
├── api/asistente.js              asesor de IA (función serverless)
├── supabase/schema.sql           base de datos del portal admin y de clientes
└── vercel.json
```

## Los dos portales

**`admin.html` — portal administrativo.** Tres perfiles, cada uno con una plataforma
distinta. Usuario y contraseña iguales:

| Perfil | Entra con | Qué ve |
|---|---|---|
| Comercial | `c0m3rc14l` | Inicio, pipeline, líneas, clientes, inventario, cartera, garantías y alertas. **Sin costos ni utilidad** |
| Gerencia | `g3r3nc14` | Todo, más bodega, compras, finanzas, reglas y auditoría |
| Bodega | `b0d3g4` | Inicio, pipeline, inventario, bodega, compras y alertas. **Sin precios de venta** |

El menú, los indicadores y las columnas cambian con el perfil: no se ocultan con CSS,
no se dibujan.

### Arquitectura

Hay **un solo componente de portal**, parametrizado por el arreglo `LINEAS` de
`assets/js/datos.js`. Añadir una categoría es añadir un objeto a ese arreglo, nunca
escribir una pantalla nueva. Cada línea trae su código corto y su color, que se usan en
todo el sistema: borde de la tarjeta, fondo tenue y chip del código.

| Código | Línea | Código | Línea |
|---|---|---|---|
| ACC | Accesorios | HER | Herramientas y repuestos |
| CAB | Cargadores y cables | PNT | Pantallas |
| AUD | Audio, diademas y parlantes | BAT | Baterías |
| PWB | Power banks y tomacorrientes | COM | Computación |
| RLJ | Relojes inteligentes | STC | Servicio técnico |

Cada línea abre las mismas pestañas —Operación, Pipeline, Inventario, Movimientos,
Clientes, Rentabilidad y Alertas— más las suyas: compatibilidad por modelo en PNT y BAT,
órdenes de servicio en STC, especificaciones en COM.

### Pipeline

Un solo embudo de siete etapas: cotización → confirmado → separado → en alistamiento →
listo para entrega → despachado → entregado y pagado. Más una etapa lateral de anulación
con motivo obligatorio, que alimenta el informe de pérdidas.

El pipeline de cada línea es **ese mismo embudo filtrado**, no una copia: lo que muevas
en un lado se mueve en el otro. Arriba hay un filtro rápido de mostrador contra mayorista,
porque el negocio tiene esas dos velocidades.

### Bodega

- **Ubicaciones** — bodega, estante, nivel y caja por referencia, con buscador que responde
  «dónde está el SKU».
- **Alistamiento** — la lista sale ordenada **por ubicación**, no por orden de captura, para
  recorrer la bodega una sola vez. Cada línea se marca al recogerla y el faltante queda registrado.
- **Traslados** — entre bodega y local, con estado en tránsito y confirmación de recepción.
- **Conteo cíclico** — el sistema propone qué contar (primero las clase A, luego lo que lleva
  más tiempo sin contarse), registra diferencias y exige motivo antes de cerrar.
- **Seriales** — para relojes y power banks de gama alta, registro en la entrada y en la salida.

### Compras

Punto de reorden calculado con la venta diaria promedio de 90 días y el tiempo de entrega
del proveedor. La sugerencia sale **agrupada por proveedor**, con el mensaje de WhatsApp ya
armado, y se convierte en orden de compra que al recibirse suma inventario y registra el egreso.

### Precios por escala

Cada referencia puede tener sus propias escalas (1-11 / 12-49 / 50-99 / 100+) o usar las
generales de Ajustes. Al armar un pedido el sistema aplica la escala solo y muestra el
descuento logrado.

### Motor de alertas

Una función central recorre los datos y devuelve alertas con prioridad, mensaje, **acción
recomendada** y el botón de WhatsApp con el texto listo. Cubre: stock en cero de clase A,
stock bajo el mínimo, pedido pagado sin despachar más de dos días, alistamiento estancado,
cotización sin respuesta, cartera vencida, referencia sin rotación, diferencia de inventario
sin justificar, garantía por vencer, mayorista sin comprar hace más de 45 días y margen por
debajo del mínimo.

**`cuenta.html` — portal de clientes.** Se entra con el número de WhatsApp con el que se
compró, o se rastrea un pedido solo con su código. El cliente ve la línea de tiempo del
pedido, el número de guía, puede repetir un pedido con un botón, radicar una garantía,
editar sus datos y pedir la eliminación de sus datos.

## Cómo se conecta el stock con la tienda

El inventario del portal manda sobre el catálogo público. Al confirmar un pedido
se **reserva** la cantidad; al pasar a *listo para recoger* o *despachado* se
descuenta de verdad; al anular se libera. Un producto queda **Agotado** en la
tienda cuando su disponible llega a cero.

Las referencias que todavía no se han dado de alta en inventario **no** entran en
ese control: siguen mostrándose como hasta ahora. Así puedes ir cargando el stock
por partes sin que las otras 200 referencias aparezcan agotadas.

### Límite que hay que tener claro

Hoy los datos viven en el `localStorage` del navegador. Funciona sin servidor y
sirve para operar y probar el flujo completo, pero **cada dispositivo tiene su
propia copia**: lo que registres en el computador del local no se ve en tu
celular. Para compartirlos hay que crear el proyecto en Supabase, correr
`supabase/schema.sql` y cambiar el cuerpo de las funciones de
`assets/js/datos.js`, que ya están escritas con ese cambio en mente. Mientras
tanto, en Ajustes hay **Descargar respaldo** y **Restaurar respaldo**.

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

## Base de datos

`supabase/schema.sql` deja lista la base para el portal administrativo y el de
clientes: productos con stock y costo, clientes, pedidos con línea de tiempo,
inventario con kardex, cartera, caja, garantías y auditoría.

Trae las políticas de seguridad (RLS) que impiden que el usuario comercial vea
costos y utilidad. Eso no se puede resolver ocultando columnas en la pantalla:
sin RLS, cualquiera con la clave anónima lee la tabla completa desde la consola
del navegador.
