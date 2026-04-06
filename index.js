const express = require('express')
const Database = require('better-sqlite3')

const app = express()
const db = new Database('tareas.db')

app.use(express.json())
app.use(express.static('public'))

// Crear la tabla si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS tareas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    completada INTEGER DEFAULT 0,
    fecha TEXT DEFAULT (datetime('now'))
  )
`)

// Ver todas las tareas
app.get('/tareas', (req, res) => {
  const tareas = db.prepare('SELECT * FROM tareas').all()
  res.json(tareas)
})

// Crear una tarea
app.post('/tareas', (req, res) => {
  const { titulo } = req.body
  const result = db.prepare('INSERT INTO tareas (titulo) VALUES (?)').run(titulo)
  const tarea = db.prepare('SELECT * FROM tareas WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(tarea)
})

// Completar una tarea
app.put('/tareas/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const tarea = db.prepare('SELECT * FROM tareas WHERE id = ?').get(id)
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' })
  db.prepare('UPDATE tareas SET completada = 1 WHERE id = ?').run(id)
  const actualizada = db.prepare('SELECT * FROM tareas WHERE id = ?').get(id)
  res.json(actualizada)
})

// Eliminar una tarea
app.delete('/tareas/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const tarea = db.prepare('SELECT * FROM tareas WHERE id = ?').get(id)
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' })
  db.prepare('DELETE FROM tareas WHERE id = ?').run(id)
  res.json({ mensaje: 'Tarea eliminada' })
})

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html')
})

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000')
})