import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const ENC_PREFIX = 'enc:v1:';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Cached keys per dbPath so key material is never hardcoded in source or stored in SQLite.
const keyCache = new Map();

function normalizeKeyMaterial(raw) {
  const trimmed = String(raw || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  try {
    const b64 = Buffer.from(trimmed, 'base64');
    if (b64.length === 32 && b64.toString('base64').replace(/=+$/, '') === trimmed.replace(/=+$/, '')) {
      return b64;
    }
  } catch { /* fall through */ }
  return createHash('sha256').update(trimmed).digest();
}

export function resolvePiiKey(dbFilename = process.env.FLYTOASPAN_DB || '.data/flytoaspan.sqlite') {
  const envKey = process.env.FLYTOASPAN_PII_KEY?.trim();
  if (envKey) return normalizeKeyMaterial(envKey);

  const cacheId = String(dbFilename || ':memory:');
  if (keyCache.has(cacheId)) return keyCache.get(cacheId);

  if (cacheId === ':memory:') {
    const ephemeral = randomBytes(32);
    keyCache.set(cacheId, ephemeral);
    return ephemeral;
  }

  // Store separate key file outside the SQLite database file (never inside SQLite or source code).
  const resolvedDb = resolve(cacheId);
  const keyFile = join(dirname(resolvedDb), `.${basename(resolvedDb)}.pii.key`);
  if (existsSync(keyFile)) {
    const stored = readFileSync(keyFile, 'utf8').trim();
    const buf = normalizeKeyMaterial(stored);
    keyCache.set(cacheId, buf);
    return buf;
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY] FLYTOASPAN_PII_KEY env variable is not set; generating isolated local key file outside SQLite.');
  }
  mkdirSync(dirname(keyFile), { recursive: true, mode: 0o700 });
  const generated = randomBytes(32);
  writeFileSync(keyFile, generated.toString('hex'), { mode: 0o600 });
  try { chmodSync(keyFile, 0o600); } catch { /* windows */ }
  keyCache.set(cacheId, generated);
  return generated;
}

export function isEncryptedPii(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

export function encryptPii(plaintext, key) {
  if (typeof plaintext !== 'string' || !plaintext.trim()) return plaintext ?? '';
  if (isEncryptedPii(plaintext)) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptPii(value, key) {
  if (typeof value !== 'string' || !value) return value ?? '';
  if (!isEncryptedPii(value)) return value; // Backward-compatible transparent read for legacy plaintext
  const parts = value.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) return '';
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const ciphertext = Buffer.from(parts[2], 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return '[ŞİFRE ÇÖZÜLEMEDİ]';
  }
}

export function maskDocumentNo(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const clean = value.trim();
  if (clean.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

// Scrub sensitive keys/patterns before writing audit logs or analytics metadata.
const SENSITIVE_KEY_RE = /(password|passwd|secret|token|cookie|card|cvv|cvc|pan|passport|tcOrPassport|tckn|identity|totp)/i;
export function scrubSensitiveFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.slice(0, 20).map(scrubSensitiveFields);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'string') {
      out[k] = v.replace(/\b\d{13,19}\b/g, '[REDACTED_NUM]').slice(0, 240);
    } else if (v && typeof v === 'object') {
      out[k] = scrubSensitiveFields(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ==================== RFC 6238 TOTP (2FA for Admin Accounts) ====================
function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function computeTotpCode(secretBase32, timestampMs = Date.now(), stepSeconds = 30) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secretBase32, code, timestampMs = Date.now(), windowSteps = 1) {
  const normalized = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized) || !secretBase32) return false;
  const given = Buffer.from(normalized, 'utf8');
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const expected = Buffer.from(computeTotpCode(secretBase32, timestampMs + delta * 30_000), 'utf8');
    if (expected.length === given.length && timingSafeEqual(expected, given)) return true;
  }
  return false;
}

export function buildOtpAuthUri({ email, secret, issuer = 'FlyToAspan' }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

// ==================== Encrypted Binary Envelope (for SQLite Backups) ====================
export function encryptBufferEnvelope(plainBuffer, rawKey) {
  const key = Buffer.isBuffer(rawKey) ? rawKey : normalizeKeyMaterial(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const sha256 = createHash('sha256').update(plainBuffer).digest('hex');
  return JSON.stringify({
    format: 'flytoaspan-backup-v1',
    alg: 'aes-256-gcm',
    createdAt: new Date().toISOString(),
    sha256,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  });
}

export function decryptBufferEnvelope(envelopeJson, rawKey) {
  const key = Buffer.isBuffer(rawKey) ? rawKey : normalizeKeyMaterial(rawKey);
  const parsed = JSON.parse(envelopeJson);
  if (parsed?.format !== 'flytoaspan-backup-v1' || parsed?.alg !== 'aes-256-gcm') {
    throw new Error('Geçersiz veya desteklenmeyen yedek dosyası biçimi.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(parsed.data, 'base64')), decipher.final()]);
  const actualHash = createHash('sha256').update(plain).digest('hex');
  if (parsed.sha256 && actualHash !== parsed.sha256) {
    throw new Error('Yedek bütünlük doğrulaması (SHA-256) başarısız.');
  }
  return { plain, meta: { createdAt: parsed.createdAt, sha256: actualHash } };
}
