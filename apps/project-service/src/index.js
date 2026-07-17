import crypto from 'node:crypto';
import express from 'express';
import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import amqp from 'amqplib';
import { validateProgress, validateProject } from './validation.js';
import { verifyPassword } from './password.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'controlpro_app',
  password: process.env.DB_PASSWORD || 'controlpro_dev',
  database: process.env.DB_NAME || 'controlpro',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', error => console.error(JSON.stringify({ service: 'project-service', dependency: 'redis', error: error.message })));
await redis.connect();

let rabbitChannel;
async function connectRabbit() {
  const connection = await amqp.connect(process.env.AMQP_URL || 'amqp://localhost');
  connection.on('close', () => { rabbitChannel = undefined; setTimeout(() => connectRabbit().catch(() => {}), 3000); });
  rabbitChannel = await connection.createConfirmChannel();
  await rabbitChannel.assertExchange('controlpro.events', 'topic', { durable: true });
}

async function connectRabbitWithRetry() {
  for (;;) {
    try {
      await connectRabbit();
      return;
    } catch (error) {
      console.error(JSON.stringify({ service: 'project-service', dependency: 'rabbitmq', status: 'retrying', error: error.message }));
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
await connectRabbitWithRetry();

app.use(express.json({ limit: '256kb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ok', service: 'project-service', dependencies: { mysql: 'ok', redis: 'ok', rabbitmq: rabbitChannel ? 'ok' : 'degraded' } });
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});

app.post('/auth/verify', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const [users] = await pool.execute(
      'SELECT id,email,name,role,password_hash,password_salt FROM users WHERE email=? AND status=? LIMIT 1',
      [email, 'activo']
    );
    const user = users[0];
    if (!user || !await verifyPassword(req.body?.password, user.password_salt, user.password_hash)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) { next(error); }
});

app.get('/projects', async (_req, res, next) => {
  try {
    const key = 'projects:active';
    const cached = await redis.get(key);
    if (cached) return res.set('x-cache', 'HIT').json(JSON.parse(cached));
    const [rows] = await pool.query('SELECT * FROM projects ORDER BY deadline ASC, created_at DESC');
    await redis.set(key, JSON.stringify(rows), { EX: 60 });
    res.set('x-cache', 'MISS').json(rows);
  } catch (error) { next(error); }
});

app.post('/projects', async (req, res, next) => {
  const validation = validateProject(req.body);
  if (!validation.valid) return res.status(400).json({ error: 'validation_error', details: validation.errors });
  try {
    const { name, subject, deadline } = req.body;
    const student = String(req.body.student || 'Carlos Angulo').trim();
    const id = crypto.randomUUID();
    await pool.execute(
      'INSERT INTO projects(id,name,subject,student,deadline) VALUES(?,?,?,?,?)',
      [id, String(name).trim(), String(subject).trim(), student, deadline]
    );
    const [[created]] = await pool.execute('SELECT * FROM projects WHERE id=?', [id]);
    await redis.del('projects:active');
    res.status(201).json(created);
  } catch (error) { next(error); }
});

app.get('/projects/:id', async (req, res, next) => {
  try {
    const [projects] = await pool.execute('SELECT * FROM projects WHERE id=?', [req.params.id]);
    if (!projects.length) return res.status(404).json({ error: 'project_not_found' });
    const [updates] = await pool.execute('SELECT * FROM progress_updates WHERE project_id=? ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...projects[0], updates });
  } catch (error) { next(error); }
});

app.post('/projects/:id/progress', async (req, res, next) => {
  const validation = validateProgress(req.body);
  if (!validation.valid) return res.status(400).json({ error: 'validation_error', details: validation.errors });
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();
    const [projects] = await client.execute('SELECT * FROM projects WHERE id=? FOR UPDATE', [req.params.id]);
    if (!projects.length) {
      await client.rollback();
      return res.status(404).json({ error: 'project_not_found' });
    }
    const student = String(req.body.student || projects[0].student).trim();
    const updateId = crypto.randomUUID();
    await client.execute(
      'INSERT INTO progress_updates(id,project_id,percentage,evidence,student) VALUES(?,?,?,?,?)',
      [updateId, req.params.id, req.body.percentage, String(req.body.evidence).trim(), student]
    );
    const status = req.body.percentage === 100 ? 'completado' : 'en_progreso';
    await client.execute('UPDATE projects SET progress=?,status=?,updated_at=NOW() WHERE id=?', [req.body.percentage, status, req.params.id]);
    await client.commit();
    const [[update]] = await pool.execute('SELECT * FROM progress_updates WHERE id=?', [updateId]);

    const event = {
      eventId: crypto.randomUUID(), type: 'progress.recorded', occurredAt: new Date().toISOString(),
      projectId: req.params.id, projectName: projects[0].name, deadline: projects[0].deadline,
      percentage: req.body.percentage, evidence: String(req.body.evidence).trim(), student
    };
    rabbitChannel.publish('controlpro.events', 'progress.recorded', Buffer.from(JSON.stringify(event)), {
      persistent: true, contentType: 'application/json', messageId: event.eventId
    });
    await rabbitChannel.waitForConfirms();
    await redis.del('projects:active');
    res.status(201).json({ update, event: { eventId: event.eventId, status: 'published' } });
  } catch (error) {
    await client.rollback().catch(() => {});
    next(error);
  } finally { client.release(); }
});

app.get('/notifications', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  } catch (error) { next(error); }
});

app.use((error, req, res, _next) => {
  console.error(JSON.stringify({ service: 'project-service', requestId: req.header('x-request-id'), error: error.message }));
  const invalidId = error.code === 'ER_TRUNCATED_WRONG_VALUE';
  res.status(invalidId ? 400 : 500).json({ error: invalidId ? 'invalid_id' : 'internal_error' });
});

app.listen(port, () => console.log(JSON.stringify({ service: 'project-service', port })));
