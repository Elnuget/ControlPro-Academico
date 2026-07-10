export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'ControlPro Académico API',
    version: '1.0.0',
    description: 'API Gateway REST para proyectos, avances y alertas académicas.'
  },
  servers: [{ url: 'http://localhost:3000', description: 'Docker local' }],
  tags: [
    { name: 'Sistema' },
    { name: 'Proyectos' },
    { name: 'Avances' },
    { name: 'Alertas' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Comprueba el API Gateway y el servicio interno',
        responses: { '200': { description: 'Sistema disponible' }, '503': { description: 'Dependencia no disponible' } }
      }
    },
    '/api/projects': {
      get: {
        tags: ['Proyectos'], summary: 'Lista proyectos activos',
        responses: { '200': { description: 'Listado de proyectos' } }
      },
      post: {
        tags: ['Proyectos'], summary: 'Crea un proyecto académico',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NewProject' } } } },
        responses: { '201': { description: 'Proyecto creado' }, '400': { description: 'Datos inválidos' } }
      }
    },
    '/api/projects/{id}': {
      get: {
        tags: ['Proyectos'], summary: 'Obtiene un proyecto y su historial',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Detalle del proyecto' }, '404': { description: 'No encontrado' } }
      }
    },
    '/api/projects/{id}/progress': {
      post: {
        tags: ['Avances'], summary: 'Registra avance y publica progress.recorded en RabbitMQ',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NewProgress' } } } },
        responses: { '201': { description: 'Avance registrado y evento publicado' }, '400': { description: 'Datos inválidos' } }
      }
    },
    '/api/notifications': {
      get: {
        tags: ['Alertas'], summary: 'Lista alertas creadas por la función asíncrona',
        responses: { '200': { description: 'Listado de alertas' } }
      }
    }
  },
  components: {
    schemas: {
      NewProject: {
        type: 'object', required: ['name', 'subject', 'deadline'],
        properties: {
          name: { type: 'string', example: 'Proyecto de Arquitectura' },
          subject: { type: 'string', example: 'Diseño y Arquitectura de Software' },
          student: { type: 'string', example: 'Carlos Angulo' },
          deadline: { type: 'string', format: 'date', example: '2026-07-30' }
        }
      },
      NewProgress: {
        type: 'object', required: ['percentage', 'evidence'],
        properties: {
          percentage: { type: 'integer', minimum: 0, maximum: 100, example: 70 },
          evidence: { type: 'string', example: 'Diagrama C4 y prueba de Swagger completados.' },
          student: { type: 'string', example: 'Carlos Angulo' }
        }
      }
    }
  }
};

