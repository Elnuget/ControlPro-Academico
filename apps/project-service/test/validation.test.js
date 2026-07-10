import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProgress, validateProject } from '../src/validation.js';

test('acepta un proyecto válido', () => {
  assert.equal(validateProject({ name: 'ControlPro', subject: 'Arquitectura', deadline: '2026-07-30' }).valid, true);
});

test('rechaza porcentajes fuera de rango', () => {
  const result = validateProgress({ percentage: 120, evidence: 'captura' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /percentage/);
});

