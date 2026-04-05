const express = require('express')
const app = express()

app.use(express.json())

let tareas = []
let nextId = 1

app.get('/tareas', (req, res) => {
  res.json(tareas)
})

app.post('/tareas', (req, res) => {
  const { titulo } = req.body
  const tarea = { id: nextId++, titulo, completada: false }
  tareas.push(tarea)
  res.status(201).json(tarea)
})

app.put('/tareas/:id', (req, res) => {
  const tarea = tareas.find(t => t.id === parseInt(req.params.id))
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' })
  tarea.completada = true
  res.json(tarea)
})

app.delete('/tareas/:id', (req, res) => {
  const index = tareas.findIndex(t => t.id === parseInt(req.params.id))
  if (index === -1) return res.status(404).json({ error: 'Tarea no encontrada' })
  tareas.splice(index, 1)
  res.json({ mensaje: 'Tarea eliminada' })
})

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000')
})