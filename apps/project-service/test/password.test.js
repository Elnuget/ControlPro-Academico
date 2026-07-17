import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyPassword } from '../src/password.js';

test('valida una contraseña derivada con scrypt', async () => {
  const salt = 'test-salt';
  const hash = crypto.scryptSync('segura', salt, 64).toString('hex');
  assert.equal(await verifyPassword('segura', salt, hash), true);
  assert.equal(await verifyPassword('incorrecta', salt, hash), false);
});

