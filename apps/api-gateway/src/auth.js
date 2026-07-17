import crypto from 'node:crypto';

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function signature(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createToken(user, secret, ttlSeconds = 14400, now = Math.floor(Date.now() / 1000)) {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: user.email,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + ttlSeconds
  });
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${signature(unsigned, secret)}`;
}

export function verifyToken(token, secret, now = Math.floor(Date.now() / 1000)) {
  try {
    const [header, payload, providedSignature, extra] = String(token || '').split('.');
    if (!header || !payload || !providedSignature || extra) return null;
    const unsigned = `${header}.${payload}`;
    if (!safeEqual(providedSignature, signature(unsigned, secret))) return null;
    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString());
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decodedHeader.alg !== 'HS256' || decoded.exp <= now || decoded.iat > now + 30) return null;
    return decoded;
  } catch {
    return null;
  }
}
