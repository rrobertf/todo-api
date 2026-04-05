# Todo API

API REST desarrollada con Node.js y Express para gestionar una lista de tareas.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /tareas | Ver todas las tareas |
| POST | /tareas | Crear una tarea |
| PUT | /tareas/:id | Marcar tarea como completada |
| DELETE | /tareas/:id | Eliminar una tarea |

## Cómo correrlo
```bash
npm install
node index.js
```

El servidor corre en http://localhost:3000