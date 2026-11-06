const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const path = require('node:path');
require('dotenv').config({ quiet: true });

function createApp({ databasePath = process.env.DB_PATH || 'tareas.db', jwtSecret = process.env.JWT_SECRET, rateLimitMax = 30 } = {}) {
  if (typeof jwtSecret !== 'string' || Buffer.byteLength(jwtSecret) < 32) {
    throw new Error('JWT_SECRET debe contener al menos 32 bytes aleatorios');
  }
  const app = express();
  const db = new Database(databasePath);
  app.locals.db = db;
  app.disable('x-powered-by');
  db.pragma('foreign_keys = ON');
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL,
      completada INTEGER DEFAULT 0, fecha TEXT DEFAULT (datetime('now')),
      user_id INTEGER REFERENCES users(id)
    )`);
    if (!db.prepare('PRAGMA table_info(tareas)').all().some(column => column.name === 'user_id')) {
      // Existing rows stay intact and unowned until the operator explicitly assigns them.
      db.exec('ALTER TABLE tareas ADD COLUMN user_id INTEGER REFERENCES users(id)');
    }
    db.exec('CREATE INDEX IF NOT EXISTS tareas_user_id ON tareas(user_id)');
  })();
  app.use(express.json({ limit: '16kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(['/registro', '/login'], rateLimit({ windowMs: 15 * 60 * 1000, limit: rateLimitMax,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' } }));
  const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const validPassword = (value, minimum = 8) => typeof value === 'string' && value.length >= minimum && Buffer.byteLength(value) <= 72;
  const dummyHash = bcrypt.hashSync('not-a-real-account-password', 12);
  app.post('/registro', async (req, res) => {
    const { email, password } = req.body || {};
    if (!validEmail(email) || !validPassword(password)) return res.status(400).json({ error: 'Email válido y contraseña de al menos 8 caracteres (máximo 72 bytes) requeridos' });
    const hash = await bcrypt.hash(password, 12);
    try {
      db.prepare('INSERT INTO users(email,password) VALUES(?,?)').run(email, hash);
      res.status(201).json({ mensaje: 'Cuenta creada' });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'El email ya existe' });
      throw error;
    }
  });
  app.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!validEmail(email) || !validPassword(password, 1)) return res.status(400).json({ error: 'Email y contraseña válidos requeridos' });
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    const matches = await bcrypt.compare(password, user ? user.password : dummyHash);
    if (!user || !matches) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    res.json({ token: jwt.sign({ id: user.id }, jwtSecret, { algorithm: 'HS256', expiresIn: '1h' }) });
  });
  app.use('/tareas', (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = /^Bearer /i.test(header) ? header.slice(7) : header;
    let decoded;
    try { decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }); }
    catch { return res.status(401).json({ error: 'Token inválido o expirado' }); }
    if (!Number.isSafeInteger(decoded.id) || !db.prepare('SELECT id FROM users WHERE id=?').get(decoded.id)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    req.userId = decoded.id;
    next();
  });
  app.get('/tareas', (req, res) => res.json(db.prepare('SELECT * FROM tareas WHERE user_id=? ORDER BY id').all(req.userId)));
  app.post('/tareas', (req, res) => {
    const { titulo } = req.body || {};
    if (typeof titulo !== 'string' || !titulo.trim() || titulo.length > 500) return res.status(400).json({ error: 'Título de 1–500 caracteres requerido' });
    const result = db.prepare('INSERT INTO tareas(titulo,user_id) VALUES(?,?)').run(titulo.trim(), req.userId);
    res.status(201).json(db.prepare('SELECT * FROM tareas WHERE id=?').get(result.lastInsertRowid));
  });
  app.param('id', (req, res, next, id) => {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return res.status(400).json({ error: 'ID inválido' });
    req.task = db.prepare('SELECT * FROM tareas WHERE id=? AND user_id=?').get(Number(id), req.userId);
    if (!req.task) return res.status(404).json({ error: 'Tarea no encontrada' });
    next();
  });
  app.put('/tareas/:id', (req, res) => {
    db.prepare('UPDATE tareas SET completada=1 WHERE id=? AND user_id=?').run(req.task.id, req.userId);
    res.json({ ...req.task, completada: 1 });
  });
  app.delete('/tareas/:id', (req, res) => {
    db.prepare('DELETE FROM tareas WHERE id=? AND user_id=?').run(req.task.id, req.userId);
    res.json({ mensaje: 'Tarea eliminada' });
  });
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande' });
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  return app;
}
if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close(() => { app.locals.db.close(); });
  });
}
module.exports = { createApp };
