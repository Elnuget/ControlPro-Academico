import amqp from 'amqplib';
import pg from 'pg';
import { buildNotification } from './handler.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const amqpUrl = process.env.AMQP_URL || 'amqp://localhost';

async function start() {
  const connection = await amqp.connect(amqpUrl);
  const channel = await connection.createChannel();
  await channel.assertExchange('controlpro.events', 'topic', { durable: true });
  const queue = await channel.assertQueue('controlpro.alerts', { durable: true });
  await channel.bindQueue(queue.queue, 'controlpro.events', 'progress.recorded');
  channel.prefetch(10);
  console.log(JSON.stringify({ service: 'alert-function', status: 'waiting', queue: queue.queue }));

  await channel.consume(queue.queue, async message => {
    if (!message) return;
    try {
      const event = JSON.parse(message.content.toString('utf8'));
      const notification = buildNotification(event);
      await pool.query(
        `INSERT INTO notifications(project_id,type,recipient,message,event_id)
         VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_id) DO NOTHING`,
        [notification.projectId, notification.type, notification.recipient, notification.message, notification.eventId]
      );
      console.log(JSON.stringify({ service: 'alert-function', eventId: notification.eventId, type: notification.type }));
      channel.ack(message);
    } catch (error) {
      console.error(JSON.stringify({ service: 'alert-function', error: error.message }));
      channel.nack(message, false, false);
    }
  });
}

async function startWithRetry() {
  for (;;) {
    try {
      await start();
      return;
    } catch (error) {
      console.error(JSON.stringify({ service: 'alert-function', dependency: 'rabbitmq', status: 'retrying', error: error.message }));
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

await startWithRetry();
