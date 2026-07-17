import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

export async function verifyPassword(password, salt, expectedHash) {
  try {
    const expected = Buffer.from(expectedHash, 'hex');
    const derived = await scrypt(String(password || ''), salt, expected.length);
    return expected.length > 0 && crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

