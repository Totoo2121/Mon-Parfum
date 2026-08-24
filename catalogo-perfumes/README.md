# Élan · Perfumería a domicilio — catálogo compartido

Esta es la versión con **base de datos en el servidor** del catálogo Élan.
Cuando agregás, editás o eliminás un perfume desde el panel, **todas las
personas que tengan el link de Render lo ven al instante** (la página se
actualiza sola cada 30 segundos). Ya no se usa `localStorage` para los
productos: el catálogo es único y compartido.

## Qué se conservó de tu sitio original

- El diseño completo (hero, filtros, carrito de pedido, modal de detalle).
- El pedido por **WhatsApp** (549 261 257-8860) con el total estimado.
- El panel admin con agregar / editar / quitar / control de stock.
- Las 58 imágenes de `assets/` y tus **58 perfumes ya precargados**.
- Tu inventario inicial vive en `seed-perfumes.json` (respaldado en el repo).

## Qué cambió

| Antes | Ahora |
|---|---|
| Productos guardados en `localStorage` (solo vos los veías) | Base de datos **SQLite en el servidor**: todos ven lo mismo |
| Contraseña `123` visible en el código | Clave verificada en el servidor (`ADMIN_KEY`) |
| Imágenes `catalog1.png` rotas (no existían) | Corregidas a `assets/1.png…58.png` reales |
| Email protegido por Cloudflare (script roto) | Email visible: `hola@elanperfumeria.com` |

## Desplegar en Render

1. Subí esta carpeta a tu repositorio de GitHub (podés reemplazar el
   contenido de `Totoo2121/Perfumes`).
2. En Render → **New → Web Service** → conectá el repositorio:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. En **Environment Variables** agregá:
   - `ADMIN_KEY` = tu contraseña de administrador (la que hoy es `123`,
     poné una más segura, ej: `elan2026pedidos`).
4. Deploy. Tu link será tipo `https://perfumes-xxxx.onrender.com`.

**Importante:** antes era un sitio estático (Static Site) — ahora debe ser
**Web Service** porque corre el servidor Node.js.

## ⚠️ Persistencia de datos en el plan Free

El plan Free de Render tiene disco temporal: **los cambios del catálogo
(alta/baja de perfumes, stock, fotos) se pierden cuando Render reinicia
el servicio** y el catálogo vuelve a los 58 perfumes del
`seed-perfumes.json`.

Para que los datos sean **permanentes**:

1. Pasá el servicio al plan **Starter** (~US$7/mes).
2. Agregá un **Disk** (desde US$1/mes) con **Mount Path:** `/var/data`.
3. Agregá la variable de entorno `DATA_DIR` = `/var/data`.

No hay que tocar el código: ya está preparado.

**Alternativa gratis a medias:** después de editar el catálogo en el
panel, podés exportar el estado actual copiando la base desde Render…
es engorroso; el disco persistente es lo recomendado.

## Probar en tu computadora

```bash
npm install
npm start
# Catálogo: http://localhost:3000
# Admin: botón "Administrador" en el pie (o Ctrl+Shift+A)
# Clave por defecto local: admin123
```

## Estructura

```
catalogo-perfumes/
├── server.js            → Servidor Express + API (publicar/editar/borrar)
├── package.json
├── seed-perfumes.json   → Tu inventario inicial (58 perfumes)
├── public/
│   ├── index.html       → Tu diseño completo (catálogo + pedidos + admin)
│   └── assets/          → Tus 58 imágenes
└── data/                → Se crea sola; guarda perfumes.sqlite
```

## API (por si algún día querés otra app encima)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/perfumes` | Público |
| POST | `/api/auth` | Verifica la clave admin |
| POST | `/api/perfumes` | Admin (`x-admin-key`) |
| PUT | `/api/perfumes/:id` | Admin |
| DELETE | `/api/perfumes/:id` | Admin |
