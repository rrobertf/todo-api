const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Database = require('better-sqlite3');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createApp } = require('../index');
const secret = 'todo-test-only-secret-'.repeat(4);
function setup(t, options = {}) {
  const app = createApp({ databasePath: ':memory:', jwtSecret: secret, ...options });
  t.after(() => app.locals.db.close());
  return app;
}
async function account(app, email) {
  const res = await request(app).post('/registro').send({ email, password: 'a secure passphrase' });
  assert.equal(res.status, 201);
  const login = await request(app).post('/login').send({ email, password: 'a secure passphrase' });
  assert.equal(login.status, 200);
  return login.body.token;
}
test('requires a strong secret and denies unauthenticated tasks', async t => {
  assert.throws(() => createApp({ jwtSecret: 'short', databasePath: ':memory:' }), /JWT_SECRET/);
  const app = setup(t);
  for (const method of ['get', 'post', 'put', 'delete']) {
    assert.equal((await request(app)[method](method === 'put' || method === 'delete' ? '/tareas/1' : '/tareas')).status, 401);
  }
});
test('CRUD isolates tasks between accounts and accepts Bearer and legacy headers', async t => {
  const app = setup(t);
  const first = await account(app, 'first@example.com');
  const second = await account(app, 'second@example.com');
  const added = await request(app).post('/tareas').auth(first, { type: 'bearer' }).send({ titulo: 'Task' });
  assert.equal(added.status, 201);
  const id = added.body.id;
  assert.equal((await request(app).get('/tareas').set('Authorization', first)).body.length, 1);
  assert.deepEqual((await request(app).get('/tareas').set('Authorization', second)).body, []);
  for (const method of ['put', 'delete']) {
    assert.equal((await request(app)[method](`/tareas/${id}`).set('Authorization', second)).status, 404);
  }
  assert.equal((await request(app).put(`/tareas/${id}`).set('Authorization', first)).body.completada, 1);
  assert.equal((await request(app).delete(`/tareas/${id}`).set('Authorization', first)).status, 200);
  assert.deepEqual((await request(app).get('/tareas').set('Authorization', first)).body, []);
});
test('rejects malformed tasks, ids, credentials and duplicate accounts', async t => {
  const app = setup(t);
  const token = await account(app, 'valid@example.com');
  for (const titulo of [null, {}, '', '  ', 'a'.repeat(501)]) {
    assert.equal((await request(app).post('/tareas').set('Authorization', token).send({ titulo })).status, 400);
  }
  for (const id of ['1x', '0', '-1', '9007199254740992']) {
    assert.equal((await request(app).put(`/tareas/${id}`).set('Authorization', token)).status, 400);
  }
  for (const body of [{}, { email: {}, password: 'password' }, { email: 'bad', password: 'password' },
    { email: 'a@example.com', password: 'é'.repeat(37) }, { email: 'a@example.com', password: 'short' }]) {
    assert.equal((await request(app).post('/registro').send(body)).status, 400);
  }
  assert.equal((await request(app).post('/registro').send({ email: 'valid@example.com', password: 'another pass' })).status, 409);
  assert.equal((await request(app).post('/login').send({ email: 'valid@example.com', password: 'wrong' })).status, 401);
  assert.equal((await request(app).get('/tareas').set('Authorization', 'invalid')).status, 401);
});
test('legacy database migration retains every existing task without assigning ownership', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'todo-migration-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'legacy.db');
  const old = new Database(file);
  old.exec("CREATE TABLE tareas(id INTEGER PRIMARY KEY AUTOINCREMENT,titulo TEXT NOT NULL,completada INTEGER DEFAULT 0,fecha TEXT); INSERT INTO tareas VALUES(42,'keep me',1,'2025-01-01')");
  old.close();
  const app = setup(t, { databasePath: file });
  const row = app.locals.db.prepare('SELECT * FROM tareas WHERE id=42').get();
  assert.equal(row.titulo, 'keep me');
  assert.equal(row.completada, 1);
  assert.equal(row.fecha, '2025-01-01');
  assert.equal(row.user_id, null);
  const token = await account(app, 'new@example.com');
  assert.deepEqual((await request(app).get('/tareas').set('Authorization', token)).body, []);
});
test('serves frontend independently of working directory', async t => {
  const app = setup(t);
  assert.match((await request(app).get('/')).text, /Void/);
});
