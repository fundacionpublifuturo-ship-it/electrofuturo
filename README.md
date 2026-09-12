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
│   ├── data/productos.json       213 referencias
│   └── img/productos/            84 fotos, nombradas con el SKU
│       img/marca/                los 3 logos
│   └── js/datos.js               base compartida por la tienda y los portales
│       js/admin.js               portal administrativo
│       js/cuenta.js              portal de clientes
├── admin.html                    portal administrativo
├── cuenta.html                   portal de clientes
├── api/asistente.js              asesor de IA (función serverless)
├── supabase/schema.sql           base de datos del portal admin y de clientes
└── vercel.json
```

## Los dos portales

**`admin.html` — portal administrativo.** Tres perfiles, cada uno con una
plataforma distinta. Usuario y contraseña iguales:

| Perfil | Entra con | Qué ve |
|---|---|---|
| Comercial | `c0m3rc14l` | Inicio, pedidos, clientes, inventario sin costos, garantías y cartera |
| Gerencia | `g3r3nc14` | Todo lo anterior más costos, margen, finanzas, auditoría y ajustes |
| Bodega | `b0d3g4` | Solo lo que necesita para alistar: inicio, pedidos e inventario |

Módulos: tablero por perfil, pedidos con línea de tiempo y cambio de estado,
guía de transportadora, aviso al cliente por WhatsApp, clientes con historial,
inventario con kardex y carga masiva por CSV, alertas de stock mínimo, cartera
con abonos, caja con ingresos y egresos, rentabilidad por pedido, garantías,
venta de mostrador y auditoría de cambios.

**`cuenta.html` — portal de clientes.** Se entra con el número de WhatsApp con el
que se compró, o se rastrea un pedido solo con su código. El cliente ve la línea
de tiempo de cada pedido, el número de guía, puede repetir un pedido con un
botón, radicar una garantía, editar sus datos y pedir la eliminación de sus datos.

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

Para probar en tu computador **no basta con abrir el `index.html`**: el catálogo
se carga con `fetch` y el navegador lo bloquea en `file://`. Levanta un servidor
local:

```bash
cd electrofuturo
python3 -m http.server 8000
# abre http://localhost:8000
```

## Editar

**Teléfono, WhatsApp, Supabase:** `assets/js/config.js`.

**Precios y productos:** `assets/data/productos.json`. Cada referencia tiene
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
