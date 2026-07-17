# Guion de exposición — ControlPro Académico

Duración sugerida: 7–9 minutos.

## 1. Portada — 20 segundos

“ControlPro Académico es la evolución del blueprint inicial hacia una arquitectura distribuida real. El objetivo fue construir tres aplicaciones conectadas y cubrir los requisitos de microservicios, colas, Gateway, Swagger, datos y despliegue.”

## 2. Problema y objetivo — 35 segundos

“Los proyectos académicos suelen quedar dispersos entre chats, correos y archivos. ControlPro centraliza el avance y la evidencia, pero procesa las alertas por eventos para no hacer lenta la operación principal.”

## 3. Cobertura de la consigna — 30 segundos

“Esta matriz resume el cumplimiento: tres aplicaciones, MySQL con XAMPP, Redis, una función reactiva, RabbitMQ, API Gateway, Swagger, C4, atributos de calidad y CI/CD.”

## 4. Arquitectura general — 55 segundos

“El usuario inicia sesión y recibe un token. El cliente solo conoce el API Gateway. Project Service es dueño de proyectos y avances. MySQL de XAMPP conserva el estado, Redis acelera lecturas y RabbitMQ recibe los eventos. Alert Function consume esos eventos y crea notificaciones.”

## 5. Tres proyectos — 40 segundos

“Cada aplicación tiene una responsabilidad independiente. El Gateway centraliza entrada y documentación; Project Service aplica reglas, datos y publicación; Alert Function representa una Lambda o server function activada por la cola.”

## 6. Flujo principal — 55 segundos

“Al registrar un avance, el servicio valida y abre una transacción. Después publica `progress.recorded`. El cliente recibe HTTP 201 sin esperar la alerta. La función consume el mensaje y persiste una notificación. Esto desacopla y permite absorber picos.”

## 7. Patrones — 35 segundos

“La solución combina API Gateway, microservicios, eventos, server functions, cache-aside e idempotencia. `event_id` es único, por lo que una reentrega de RabbitMQ no genera alertas duplicadas.”

## 8. Swagger — 30 segundos

“Toda la API pública está documentada en `/docs`. Desde allí el profesor puede listar y crear proyectos, consultar detalle, registrar avances y comprobar notificaciones.”

## 9. Datos y mensajería — 40 segundos

“MySQL entrega consistencia y trazabilidad con tablas InnoDB; Redis usa TTL e invalidación; RabbitMQ conserva mensajes durables y solo recibe confirmación cuando la función terminó de guardar.”

## 10. Atributos de calidad — 45 segundos

“El análisis cubre caché, balanceo, índices, redundancia, disponibilidad, concurrencia, latencia y escalabilidad. Por ejemplo, `FOR UPDATE` protege avances simultáneos y los servicios sin estado permiten réplicas.”

## 11. Despliegue y CI/CD — 35 segundos

“Docker Compose levanta cinco contenedores y XAMPP aporta MySQL en el host. GitHub Actions instala, ejecuta las pruebas, valida sintaxis y construye imágenes. Los logs son JSON y el Gateway propaga un identificador de petición.”

## 12. Evidencia — 35 segundos

“La prueba integral valida autenticación, cinco contenedores, MySQL de XAMPP y HTTP 201. Además comprueba que el evento fue publicado y la función creó la notificación.”

## 13. Demostración — 60–90 segundos

1. Mostrar `docker compose ps`.
2. Abrir `http://localhost:3000/docs`.
3. Ejecutar `GET /api/projects`.
4. Usar el ID con `POST /api/projects/{id}/progress`.
5. Ejecutar `GET /api/notifications` y señalar la alerta.

## 14. Cierre — 20 segundos

“ControlPro es una arquitectura pequeña, pero completa y verificable. Se puede evolucionar agregando consumidores, réplicas y servicios administrados sin cambiar el flujo central. El código y la documentación quedan disponibles en el repositorio público.”

## Preguntas probables

- **¿Por qué RabbitMQ?** Porque desacopla la alerta, conserva el trabajo y permite reintentos y consumidores adicionales.
- **¿Por qué Redis?** Para reducir latencia de la consulta frecuente del tablero sin comprometer la base transaccional.
- **¿Cómo se evita duplicar alertas?** La tabla de notificaciones define `event_id` como único.
- **¿Cómo se maneja concurrencia?** El proyecto se consulta con `FOR UPDATE` dentro de una transacción.
- **¿Cómo escalaría?** Con réplicas de Gateway/servicio, más consumidores y dependencias administradas.
