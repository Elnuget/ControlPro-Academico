# ControlPro Académico

## Propósito

Proyecto académico de Diseño y Arquitectura de Software. Mantener exactamente tres aplicaciones conectadas: `api-gateway`, `project-service` y `alert-function`.

## Arquitectura

- Toda API pública se expone mediante `api-gateway` en el puerto 3000 y se documenta con Swagger.
- `project-service` es dueño de proyectos y avances; usa PostgreSQL, cache-aside con Redis y publica `progress.recorded`.
- `alert-function` consume RabbitMQ y persiste notificaciones de forma idempotente mediante `event_id`.
- PostgreSQL, Redis y RabbitMQ se ejecutan con Docker Compose.

## Verificación obligatoria

Antes de publicar cambios ejecutar:

```powershell
npm install
npm test
npm run check
docker compose config --quiet
docker compose up --build -d
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

Después de la prueba, revisar `docker compose ps` y detener el entorno con `docker compose down` si ya no se necesita.

## Git

- Conservar `.env.example`; nunca confirmar `.env` ni credenciales reales.
- Usar commits pequeños y claros.
- Mantener el repositorio público porque su finalidad es la revisión docente.
