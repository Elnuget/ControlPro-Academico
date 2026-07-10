# Guion para explicar el blueprint de ControlPro Académico

Duración sugerida: 4–6 minutos.

## Antes de comenzar

Abre `ControlPro_Academico_Blueprint_Final.drawio` y presenta primero la página **01 - Blueprint final**. Recorre el diagrama de izquierda a derecha. Después cambia a **02 - Flujo registrar avance**.

## Página 1 — Blueprint final

### 1. Presentación — 20 segundos

> Este es el blueprint final de ControlPro Académico. La solución permite crear proyectos, registrar avances y consultar actividad. Aunque el usuario ve una aplicación sencilla, internamente existen tres aplicaciones conectadas y varios componentes de infraestructura.

### 2. Usuario y dashboard — 35 segundos

Señala las dos primeras cajas.

> El recorrido comienza con el estudiante o el docente. Ambos utilizan el dashboard web. La interfaz evita mostrar detalles técnicos: solamente presenta proyectos, porcentaje de avance, fechas y actividad reciente.

### 3. API Gateway — 35 segundos

Señala **Aplicación 01 — API Gateway**.

> El dashboard no conoce directamente los servicios internos. Todas las solicitudes pasan por el API Gateway, que es la única entrada pública. También centraliza Swagger, asigna un identificador a cada petición y controla los tiempos de espera.

### 4. Project Service — 45 segundos

Señala **Aplicación 02 — Project Service**.

> Project Service contiene las reglas del negocio. Valida los datos, crea proyectos, registra avances y controla las transacciones. Esta separación permite cambiar la interfaz sin modificar la lógica académica.

### 5. PostgreSQL y Redis — 40 segundos

Señala las dos bases de datos.

> PostgreSQL conserva proyectos, avances y notificaciones de forma consistente. Redis funciona como caché del tablero durante 60 segundos. Cuando cambia un proyecto, la caché se invalida para no presentar información anterior.

### 6. RabbitMQ y Alert Function — 50 segundos

Sigue las flechas verdes desde Project Service.

> Cuando se registra un avance, Project Service publica el evento `progress.recorded` en RabbitMQ. RabbitMQ conserva el mensaje y lo entrega a Alert Function. Esta tercera aplicación procesa el evento y crea la notificación sin bloquear la respuesta que recibe el usuario.

### 7. Infraestructura y operación — 35 segundos

Señala el recuadro inferior.

> Todo se ejecuta con Docker Compose en seis contenedores. Los health checks permiten conocer el estado de las dependencias, los logs JSON ayudan a seguir las solicitudes y GitHub Actions ejecuta pruebas y construye las imágenes en cada publicación.

### 8. Idea principal — 20 segundos

> La línea azul representa la ruta síncrona que responde al usuario. La línea verde representa la ruta asíncrona. La decisión más importante es que el usuario no debe esperar a que la alerta termine de procesarse.

## Página 2 — Flujo registrar avance

### Paso 1 — Solicitud

> El estudiante indica un porcentaje y una evidencia. El dashboard envía `POST /api/projects/{id}/progress`.

### Paso 2 — Gateway

> El Gateway agrega trazabilidad y reenvía el JSON a Project Service.

### Pasos 3 y 4 — Transacción

> Project Service valida el porcentaje, abre una transacción y bloquea el proyecto con `FOR UPDATE`. PostgreSQL guarda el historial y el nuevo porcentaje como una sola operación.

### Paso 5 — Evento

> Después de confirmar los datos, el servicio publica `progress.recorded` en RabbitMQ.

### Paso 6 — Respuesta

> El dashboard recibe HTTP 201. Para el estudiante, el avance ya fue guardado correctamente.

### Paso 7 — Procesamiento asíncrono

> RabbitMQ entrega el mensaje a Alert Function. La función crea la notificación y confirma el mensaje después de guardarla.

## Cierre — 25 segundos

> En conclusión, ControlPro mantiene una experiencia sencilla para el usuario y una arquitectura desacoplada internamente. API Gateway centraliza la entrada, Project Service protege el negocio y Alert Function procesa eventos. PostgreSQL, Redis y RabbitMQ aportan consistencia, rendimiento y resiliencia.

## Preguntas probables

- **¿Por qué existen tres aplicaciones?** Para separar la entrada pública, las reglas del negocio y el procesamiento asíncrono.
- **¿Por qué usar RabbitMQ?** Para que las alertas no ralenticen el registro del avance y para conservar mensajes durante fallos temporales.
- **¿Por qué Redis?** Para reducir la latencia de las consultas frecuentes del dashboard.
- **¿Cómo se evitan alertas duplicadas?** Cada evento tiene un `event_id` único en PostgreSQL.
- **¿Qué ocurre si Alert Function se detiene?** RabbitMQ conserva el mensaje y puede entregarlo cuando la función vuelva a estar disponible.
- **¿Cómo se ejecuta?** Con `docker compose up --build -d`; el dashboard se abre en `http://localhost:3000/#proyectos`.

## Frase corta para memorizar

> ControlPro muestra una app sencilla, pero por dentro separa la respuesta inmediata del procesamiento de alertas mediante tres aplicaciones y una cola de eventos.
