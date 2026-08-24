// ============================================================
//  Élan · Perfumería a domicilio — Servidor Node.js + SQLite
//  Listo para desplegar en Render.
//
//  Los perfumes se guardan en el servidor, así que TODAS las
//  personas con el link ven el mismo catálogo. Ya no se usa
//  localStorage para los productos.
//
//  Variables de entorno:
//    PORT      → la asigna Render automáticamente
//    ADMIN_KEY → contraseña del panel de administración
//                (por defecto local: "admin123")
//    DATA_DIR  → carpeta donde se guarda la base de datos.
//                En Render con disco persistente: /var/data
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATS = ['mujeres', 'hombres', 'unisex'];

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'perfumes.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS perfumes (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    brand    TEXT DEFAULT '',
    cat      TEXT DEFAULT 'unisex',
    price    INTEGER DEFAULT 0,
    stock    INTEGER DEFAULT 0,
    img      TEXT DEFAULT '',
    notes    TEXT DEFAULT '',
    details  TEXT DEFAULT ''
  )
`);

// Precargar el inventario original solo la primera vez (tabla vacía)
const total = db.prepare('SELECT COUNT(*) AS n FROM perfumes').get().n;
if (total === 0) {
  const seedFile = path.join(__dirname, 'seed-perfumes.json');
  if (fs.existsSync(seedFile)) {
    const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    const insert = db.prepare(`
      INSERT INTO perfumes (name, brand, cat, price, stock, img, notes, details)
      VALUES (@name, @brand, @cat, @price, @stock, @img, @notes, @details)
    `);
    const insertAll = db.transaction((rows) => {
      for (const r of rows) insert.run({
        name: String(r.name || '').trim(),
        brand: String(r.brand || '').trim(),
        cat: CATS.includes(r.cat) ? r.cat : 'unisex',
        price: Number(r.price) || 0,
        stock: Math.max(0, Number(r.stock) || 0),
        img: String(r.img || '').trim(),
        notes: String(r.notes || '').trim(),
        details: String(r.desc || r.details || '').trim()
      });
    });
    insertAll(seed);
    console.log(`✔ Se precargaron ${seed.length} perfumes desde seed-perfumes.json`);
  }
}

// El límite alto permite subir fotos como base64 desde el panel admin
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------

function rowToJson(r) {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    cat: r.cat,
    price: r.price,
    stock: r.stock,
    img: r.img,
    notes: r.notes,
    desc: r.details
  };
}

function esAdmin(req, res) {
  if (req.get('x-admin-key') !== ADMIN_KEY) {
    res.status(401).json({ error: 'Clave de administrador incorrecta' });
    return false;
  }
  return true;
}

function sanitizeProduct(b) {
  const d = b || {};
  return {
    name: String(d.name || '').trim(),
    brand: String(d.brand || '').trim(),
    cat: CATS.includes(d.cat) ? d.cat : 'unisex',
    price: Math.max(0, Math.round(Number(d.price) || 0)),
    stock: Math.max(0, Math.round(Number(d.stock) || 0)),
    img: String(d.img || '').trim(),
    notes: String(d.notes || '').trim(),
    details: String(d.desc || d.details || '').trim()
  };
}

// ---------- API ----------

// Verificar clave de administrador (para el login del panel)
app.post('/api/auth', (req, res) => {
  const { key } = req.body || {};
  if (key === ADMIN_KEY) return res.json({ ok: true });
  res.status(401).json({ error: 'Clave incorrecta' });
});

// Listar perfumes (público — todos los visitantes ven lo mismo)
app.get('/api/perfumes', (req, res) => {
  const rows = db.prepare('SELECT * FROM perfumes ORDER BY id ASC').all();
  res.json(rows.map(rowToJson));
});

// Agregar perfume (solo admin)
app.post('/api/perfumes', (req, res) => {
  if (!esAdmin(req, res)) return;
  const p = sanitizeProduct(req.body);
  if (!p.name) return res.status(400).json({ error: 'El nombre del perfume es obligatorio' });
  if (!p.img) p.img = 'assets/1.png';

  const info = db.prepare(`
    INSERT INTO perfumes (name, brand, cat, price, stock, img, notes, details)
    VALUES (@name, @brand, @cat, @price, @stock, @img, @notes, @details)
  `).run(p);

  const nuevo = db.prepare('SELECT * FROM perfumes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToJson(nuevo));
});

// Editar perfume (solo admin) — incluye ajustes de stock
app.put('/api/perfumes/:id', (req, res) => {
  if (!esAdmin(req, res)) return;
  const existe = db.prepare('SELECT * FROM perfumes WHERE id = ?').get(req.params.id);
  if (!existe) return res.status(404).json({ error: 'Perfume no encontrado' });

  const p = sanitizeProduct({ ...rowToJson(existe), ...(req.body || {}) });
  if (!p.name) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });

  db.prepare(`
    UPDATE perfumes
    SET name=@name, brand=@brand, cat=@cat, price=@price,
        stock=@stock, img=@img, notes=@notes, details=@details
    WHERE id=@id
  `).run({ ...p, id: existe.id });

  const actualizado = db.prepare('SELECT * FROM perfumes WHERE id = ?').get(existe.id);
  res.json(rowToJson(actualizado));
});

// Eliminar perfume (solo admin)
app.delete('/api/perfumes/:id', (req, res) => {
  if (!esAdmin(req, res)) return;
  const info = db.prepare('DELETE FROM perfumes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Perfume no encontrado' });
  res.json({ ok: true });
});

// Cualquier otra ruta sirve el catálogo
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✔ Élan Perfumería corriendo en http://localhost:${PORT}`);
});
