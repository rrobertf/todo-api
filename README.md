# Void Tasks

Aplicación de gestión de tareas con autenticación de usuarios, construida con Node.js, Express y SQLite. Incluye un frontend oscuro y moderno servido desde el mismo servidor.

## Stack

- **Backend**: Node.js + Express
- **Base de datos**: SQLite (better-sqlite3)
- **Autenticación**: JWT + bcrypt
- **Frontend**: HTML/CSS/JS con Tailwind CSS

## Endpoints

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/registro` | Crear cuenta nueva |
| POST | `/login` | Iniciar sesión — devuelve JWT |

### Tareas (requieren token JWT en el header `Authorization`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/tareas` | Listar todas las tareas del usuario |
| POST | `/tareas` | Crear una tarea |
| PUT | `/tareas/:id` | Marcar tarea como completada |
| DELETE | `/tareas/:id` | Eliminar una tarea |

## Cómo correrlo

```bash
npm install
node index.js
```

El servidor corre en `http://localhost:3000` y sirve el frontend automáticamente.

## Autenticación

Incluir el token en cada request a `/tareas`:

```
Authorization: <token>
```
