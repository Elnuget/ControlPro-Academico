import crypto from 'node:crypto';
import express from 'express';
import pg from 'pg';
import { createClient } from 'redis';
import amqp from 'amqplib';
import { validateProgress, validateProject } from './validation.js';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3001);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
    res.json({ status: 'ok', service: 'project-service', dependencies: { postgres: 'ok', redis: 'ok', rabbitmq: rabbitChannel ? 'ok' : 'degraded' } });
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});

app.get('/projects', async (_req, res, next) => {
  try {
    const key = 'projects:active';
    const cached = await redis.get(key);
    if (cached) return res.set('x-cache', 'HIT').json(JSON.parse(cached));
    const { rows } = await pool.query('SELECT * FROM projects ORDER BY deadline ASC, created_at DESC');
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
    const { rows } = await pool.query(
      'INSERT INTO projects(name, subject, student, deadline) VALUES($1,$2,$3,$4) RETURNING *',
      [String(name).trim(), String(subject).trim(), student, deadline]
    );
    await redis.del('projects:active');
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

app.get('/projects/:id', async (req, res, next) => {
  try {
    const project = await pool.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
    if (!project.rowCount) return res.status(404).json({ error: 'project_not_found' });
    const updates = await pool.query('SELECT * FROM progress_updates WHERE project_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...project.rows[0], updates: updates.rows });
  } catch (error) { next(error); }
});

app.post('/projects/:id/progress', async (req, res, next) => {
  const validation = validateProgress(req.body);
  if (!validation.valid) return res.status(400).json({ error: 'validation_error', details: validation.errors });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query('SELECT * FROM projects WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!project.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'project_not_found' });
    }
    const student = String(req.body.student || project.rows[0].student).trim();
    const update = await client.query(
      'INSERT INTO progress_updates(project_id, percentage, evidence, student) VALUES($1,$2,$3,$4) RETURNING *',
      [req.params.id, req.body.percentage, String(req.body.evidence).trim(), student]
    );
    const status = req.body.percentage === 100 ? 'completado' : 'en_progreso';
    await client.query('UPDATE projects SET progress=$2,status=$3,updated_at=NOW() WHERE id=$1', [req.params.id, req.body.percentage, status]);
    await client.query('COMMIT');

    const event = {
      eventId: crypto.randomUUID(), type: 'progress.recorded', occurredAt: new Date().toISOString(),
      projectId: req.params.id, projectName: project.rows[0].name, deadline: project.rows[0].deadline,
      percentage: req.body.percentage, evidence: String(req.body.evidence).trim(), student
    };
    rabbitChannel.publish('controlpro.events', 'progress.recorded', Buffer.from(JSON.stringify(event)), {
      persistent: true, contentType: 'application/json', messageId: event.eventId
    });
    await rabbitChannel.waitForConfirms();
    await redis.del('projects:active');
    res.status(201).json({ update: update.rows[0], event: { eventId: event.eventId, status: 'published' } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally { client.release(); }
});

app.get('/notifications', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  } catch (error) { next(error); }
});

app.use((error, req, res, _next) => {
  console.error(JSON.stringify({ service: 'project-service', requestId: req.header('x-request-id'), error: error.message }));
  const invalidId = error.code === '22P02';
  res.status(invalidId ? 400 : 500).json({ error: invalidId ? 'invalid_id' : 'internal_error' });
});

app.listen(port, () => console.log(JSON.stringify({ service: 'project-service', port })));
