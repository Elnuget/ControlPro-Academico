import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './swagger.js';
import { createToken, verifyToken } from './auth.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const projectServiceUrl = process.env.PROJECT_SERVICE_URL || 'http://localhost:3001';
const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const jwtSecret = process.env.JWT_SECRET || 'controlpro-local-demo-secret';
const failedLogins = new Map();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  req.requestId = req.header('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'ControlPro Swagger' }));
app.get('/openapi.json', (_req, res) => res.json(openapi));
app.use(express.static(publicDir));

function requireAuth(req, res, next) {
  const [scheme, token] = String(req.header('authorization') || '').split(' ');
  const user = scheme === 'Bearer' ? verifyToken(token, jwtSecret) : null;
  if (!user) return res.status(401).json({ error: 'authentication_required' });
  req.user = user;
  next();
}

app.post('/api/auth/login', async (req, res) => {
  const key = req.ip;
  const attempt = failedLogins.get(key) || { count: 0, blockedUntil: 0 };
  if (attempt.blockedUntil > Date.now()) {
    return res.status(429).json({ error: 'too_many_attempts', retryAfter: Math.ceil((attempt.blockedUntil - Date.now()) / 1000) });
  }
  try {
    const response = await fetch(`${projectServiceUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': req.requestId },
      body: JSON.stringify(req.body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        const count = attempt.count + 1;
        failedLogins.set(key, { count, blockedUntil: count >= 5 ? Date.now() + 60000 : 0 });
      }
      return res.status(response.status).json(data);
    }
    failedLogins.delete(key);
    res.json({ token: createToken(data.user, jwtSecret), expiresIn: 14400, user: data.user });
  } catch (error) {
    console.error(JSON.stringify({ service: 'api-gateway', requestId: req.requestId, dependency: 'project-service', error: error.message }));
    res.status(503).json({ error: 'authentication_service_unavailable' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));
app.use('/api/projects', requireAuth);
app.use('/api/notifications', requireAuth);

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
