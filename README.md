# ControlPro Académico — arquitectura distribuida

Solución académica de **tres proyectos conectados** basada en el blueprint de ControlPro:

1. `api-gateway`: entrada REST única y documentación Swagger/OpenAPI.
2. `project-service`: proyectos, avances, PostgreSQL, cache Redis y publicación de eventos.
3. `alert-function`: función activada por RabbitMQ que crea alertas asíncronas.

## Ejecutar

```powershell
docker compose up --build -d
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

- Dashboard visual: <http://localhost:3000>
- Swagger: <http://localhost:3000/docs>
- API: <http://localhost:3000/api/projects>
- RabbitMQ Management: <http://localhost:15672>

## Flujo de demostración

1. Abrir Swagger y consultar `GET /api/projects`.
2. Registrar un avance con `POST /api/projects/{id}/progress`.
3. El servicio persiste el avance y publica `progress.recorded`.
4. `alert-function` consume el evento y guarda una notificación.
5. Consultar `GET /api/notifications` para evidenciar el procesamiento.

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
- 6 contenedores ejecutados en la prueba integral.
- Evento `progress.recorded` consumido y convertido en notificación.
- Auditoría NPM sin vulnerabilidades reportadas al momento de la entrega.
