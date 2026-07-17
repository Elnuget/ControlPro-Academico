import test from 'node:test';
import assert from 'node:assert/strict';
import { createToken, verifyToken } from '../src/auth.js';

const user = { email: 'carlos.angulo@udla.edu.ec', name: 'Carlos Angulo', role: 'student' };

test('firma y valida un token vigente', () => {
  const token = createToken(user, 'test-secret', 3600, 1000);
  assert.deepEqual(verifyToken(token, 'test-secret', 1200), {
    sub: user.email, email: user.email, name: user.name, role: user.role,
    iat: 1000, exp: 4600
  });
});

test('rechaza tokens alterados o vencidos', () => {
  const token = createToken(user, 'test-secret', 60, 1000);
  assert.equal(verifyToken(`${token}x`, 'test-secret', 1010), null);
  assert.equal(verifyToken(token, 'test-secret', 1061), null);
});
