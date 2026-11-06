# Void Tasks

Aplicación de tareas con Node.js, Express 5, SQLite y frontend HTML/CSS/JS. Implementa registro, login con JWT y tareas separadas por usuario.

## Inicio

Requiere Node.js 22.12+ y npm. Si no hay binario SQLite precompilado para tu plataforma, necesitarás las herramientas de compilación de Node.

```bash
npm ci
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado en `JWT_SECRET` dentro de `.env` (mínimo 32 bytes). No lo publiques. Luego:

```bash
npm start
# http://localhost:3000
npm run dev
npm test
npm audit
```

`PORT` cambia el puerto y `DB_PATH` cambia la ubicación de SQLite (por defecto `tareas.db`, relativa al directorio de ejecución). La interfaz se sirve desde la carpeta del proyecto independientemente del directorio de ejecución.

## API

| Método | Ruta | Cuerpo / función |
|---|---|---|
| POST | `/registro` | `{ "email": "you@example.com", "password": "a long passphrase" }` |
| POST | `/login` | Mismos campos; devuelve `{ "token": "..." }` |
| GET | `/tareas` | Tareas del usuario autenticado |
| POST | `/tareas` | `{ "titulo": "Mi tarea" }` |
| PUT | `/tareas/:id` | Marca completada |
| DELETE | `/tareas/:id` | Elimina una tarea propia |

Las rutas de tareas requieren `Authorization: Bearer <token>`. Se acepta el formato antiguo `Authorization: <token>` por compatibilidad. Una tarea ajena o inexistente devuelve 404. Entradas inválidas: 400; credenciales inválidas: 401; cuenta duplicada: 409; límite de intentos: 429.

Contraseñas nuevas: mínimo 8 caracteres, máximo 72 bytes UTF-8 para evitar truncamiento de bcrypt. Los hashes usan bcrypt con coste 12. JWT HS256 de una hora; el secreto se valida antes de abrir la base. Registro y login comparten un límite de 30 solicitudes por IP cada 15 minutos. Los títulos admiten 1–500 caracteres. Los errores internos no revelan SQL ni detalles del servidor.

El cliente conserva la sesión en `sessionStorage` por pestaña y migra una vez los tokens antiguos de `localStorage`. Cerrar sesión elimina las credenciales del cliente; un JWT copiado continúa válido hasta expirar. Los tokens siguen accesibles a JavaScript: esto no sustituye HTTPS, prevención de XSS, cookies HttpOnly o revocación del lado del servidor. El limitador en memoria es para una sola instancia; un despliegue público necesita configuración de proxy y almacenamiento compartido adecuados. Tailwind y fuentes se cargan desde servicios externos.

## Datos existentes: leer antes de integrar este PR

El repositorio anterior versionaba `tareas.db` y `node_modules`. Ahora se excluyen de Git. **Antes de fusionar o actualizar un checkout antiguo, detén el servidor y copia tu base fuera del repositorio**, incluidos archivos WAL/SHM si existen; o crea una copia consistente con SQLite:

```bash
sqlite3 tareas.db ".backup '../tareas-respaldo.db'"
```

Después de actualizar, conserva/restaura la base en la ubicación elegida por `DB_PATH`. No sustituyas una base personal con un archivo descargado del repositorio. Eliminar el seguimiento no elimina las versiones antiguas del historial de Git.

La migración agrega `user_id` sin borrar ni modificar título, estado o fecha. Las tareas antiguas quedan con propietario NULL y **no se muestran a cuentas nuevas** para evitar exposición de datos. Tras crear la cuenta que corresponda y hacer respaldo, un operador puede revisar y asignar explícitamente las tareas desde SQLite:

```sql
SELECT id, email FROM users;
SELECT id, titulo FROM tareas WHERE user_id IS NULL;
-- Reemplaza 123 y 42 por el usuario y la tarea revisados; no ejecutar sin revisar.
BEGIN;
UPDATE tareas SET user_id = 123 WHERE id = 42 AND user_id IS NULL;
COMMIT;
```

Para volver a la versión anterior, restaura también el respaldo anterior a la migración. Las pruebas usan memoria o bases temporales; nunca la base personal.

## Pruebas

`npm test` cubre CRUD, aislamiento entre cuentas, autenticación obligatoria, validación, compatibilidad de headers, migración de una base antigua y servicio de la interfaz. GitHub Actions ejecuta las pruebas en cada PR.
