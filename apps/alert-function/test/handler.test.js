import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotification } from '../src/handler.js';

test('genera alerta de avance', () => {
  const result = buildNotification({ eventId: 'e1', projectId: 'p1', percentage: 70, projectName: 'ControlPro', student: 'Carlos' });
  assert.equal(result.type, 'avance_registrado');
  assert.match(result.message, /70%/);
});

test('genera alerta de finalización', () => {
  const result = buildNotification({ eventId: 'e2', projectId: 'p1', percentage: 100, projectName: 'ControlPro' });
  assert.equal(result.type, 'proyecto_completado');
});

