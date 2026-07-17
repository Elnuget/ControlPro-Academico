import amqp from 'amqplib';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { buildNotification } from './handler.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'controlpro_app',
  password: process.env.DB_PASSWORD || 'controlpro_dev',
  database: process.env.DB_NAME || 'controlpro',
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true
});
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
      await pool.execute(
        `INSERT INTO notifications(id,project_id,type,recipient,message,event_id)
         VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE event_id=VALUES(event_id)`,
        [crypto.randomUUID(), notification.projectId, notification.type, notification.recipient, notification.message, notification.eventId]
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
