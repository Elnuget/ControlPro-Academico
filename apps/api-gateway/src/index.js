import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './swagger.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const projectServiceUrl = process.env.PROJECT_SERVICE_URL || 'http://localhost:3001';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  req.requestId = req.header('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'ControlPro Swagger' }));
app.get('/openapi.json', (_req, res) => res.json(openapi));

async function forward(req, res, internalPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${projectServiceUrl}${internalPath}`, {
      method: req.method,
      headers: { 'content-type': 'application/json', 'x-request-id': req.requestId },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      signal: controller.signal
    });
    const body = await response.text();
    res.status(response.status).type(response.headers.get('content-type') || 'application/json').send(body);
  } catch (error) {
    console.error(JSON.stringify({ service: 'api-gateway', requestId: req.requestId, error: error.message }));
    res.status(503).json({ error: 'project_service_unavailable', requestId: req.requestId });
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/health', (req, res) => forward(req, res, '/health'));
app.get('/api/projects', (req, res) => forward(req, res, '/projects'));
app.post('/api/projects', (req, res) => forward(req, res, '/projects'));
app.get('/api/projects/:id', (req, res) => forward(req, res, `/projects/${req.params.id}`));
app.post('/api/projects/:id/progress', (req, res) => forward(req, res, `/projects/${req.params.id}/progress`));
app.get('/api/notifications', (req, res) => forward(req, res, '/notifications'));

app.use((req, res) => res.status(404).json({ error: 'route_not_found', path: req.path }));

app.listen(port, () => console.log(JSON.stringify({ service: 'api-gateway', port, docs: '/docs' })));

