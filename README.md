# ControlPro Académico — arquitectura distribuida

Solución académica de **tres proyectos conectados** basada en el blueprint de ControlPro:

1. `api-gateway`: entrada REST única y documentación Swagger/OpenAPI.
2. `project-service`: proyectos, avances, MySQL/MariaDB de XAMPP, caché Redis y publicación de eventos.
3. `alert-function`: función activada por RabbitMQ que crea alertas asíncronas.

## Ejecutar

```powershell
Get-Content -Raw infra\mysql\init.sql | & "C:\xampp\mysql\bin\mysql.exe" -u root
docker compose up --build -d
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

MySQL debe estar iniciado desde el panel de XAMPP. Las aplicaciones Docker acceden a la base local por `host.docker.internal:3306` con un usuario dedicado.

- Dashboard visual: <http://localhost:3000>
- Swagger: <http://localhost:3000/docs>
- API: <http://localhost:3000/api/projects>
- RabbitMQ Management: <http://localhost:15672>

### Acceso al dashboard

- Correo: `carlos.angulo@udla.edu.ec`
- Contraseña de demostración: `ControlPro2026!`

El usuario se almacena en MySQL con contraseña derivada mediante `scrypt`. El API Gateway firma tokens Bearer con expiración de cuatro horas, protege las rutas de proyectos y alertas, y limita los intentos fallidos. Para un entorno distinto, cambie el usuario semilla de `infra/mysql/init.sql` y configure un `JWT_SECRET` propio en `.env`.

## Flujo de demostración

1. Iniciar sesión en el dashboard o ejecutar `POST /api/auth/login` desde Swagger.
2. En Swagger, usar **Authorize** con el token y consultar `GET /api/projects`.
3. Registrar un avance con `POST /api/projects/{id}/progress`.
4. El servicio persiste el avance y publica `progress.recorded`.
5. `alert-function` consume el evento y guarda una notificación.
6. Consultar `GET /api/notifications` para evidenciar el procesamiento.

## Verificación local

```powershell
npm install
npm test
npm run check
docker compose config --quiet
```

Los diagramas C4 y de despliegue están en `docs/architecture.md`.

## Entregables académicos

- [Informe de arquitectura](docs/deliverables/Angulo_Carlos_ControlPro_Arquitectura_Distribuida.pdf)
- [Presentación para clase](docs/deliverables/Angulo_Carlos_ControlPro_Presentacion.pptx)
- [Blueprint editable](docs/deliverables/ControlPro_Academico_Blueprint_v1.drawio)
- [Blueprint final de arquitectura y flujo](docs/deliverables/ControlPro_Academico_Blueprint_Final.drawio)
- [Guion de exposición](docs/deliverables/Guion_Exposicion_ControlPro.md)
- [Guion para explicar el blueprint](docs/deliverables/Guion_Blueprint_ControlPro.md)

## Estado verificado

- 4 pruebas unitarias aprobadas.
- 3 aplicaciones construidas como imágenes Docker.
- 5 contenedores ejecutados en la prueba integral más MySQL/MariaDB en XAMPP.
- Evento `progress.recorded` consumido y convertido en notificación.
- Auditoría NPM sin vulnerabilidades reportadas al momento de la entrega.
