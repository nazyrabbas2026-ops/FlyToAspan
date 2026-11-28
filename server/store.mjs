import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { decryptPii, encryptPii, isEncryptedPii, resolvePiiKey, scrubSensitiveFields } from './crypto.mjs';

const deriveKey = promisify(scrypt);
const scryptOptions = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const dummySalt = '00000000000000000000000000000000';

export function encryptBookingDetails(details, piiKey) {
  if (!details || typeof details !== 'object' || !piiKey) return details;
  const clone = { ...details };
  if (Array.isArray(clone.passengersDetail)) {
    clone.passengersDetail = clone.passengersDetail.map((p) => ({
      ...p,
      tcOrPassport: p?.tcOrPassport ? encryptPii(String(p.tcOrPassport), piiKey) : p?.tcOrPassport,
    }));
  }
  return clone;
}

export function decryptBookingDetails(details, piiKey) {
  if (!details || typeof details !== 'object' || !piiKey) return details;
  const clone = { ...details };
  if (Array.isArray(clone.passengersDetail)) {
    clone.passengersDetail = clone.passengersDetail.map((p) => ({
      ...p,
      tcOrPassport: p?.tcOrPassport ? decryptPii(String(p.tcOrPassport), piiKey) : p?.tcOrPassport,
    }));
  }
  return clone;
}

export function encryptQuoteMetadata(meta, piiKey) {
  if (!meta || typeof meta !== 'object' || !piiKey) return meta;
  return {
    ...meta,
    tcOrPassport: meta.tcOrPassport ? encryptPii(String(meta.tcOrPassport), piiKey) : meta.tcOrPassport,
  };
}

export function decryptQuoteMetadata(meta, piiKey) {
  if (!meta || typeof meta !== 'object' || !piiKey) return meta;
  return {
    ...meta,
    tcOrPassport: meta.tcOrPassport ? decryptPii(String(meta.tcOrPassport), piiKey) : meta.tcOrPassport,
  };
}

export function migratePlaintextPii(db) {
  const key = db._piiKey;
  if (!key) return { migratedBookings: 0, migratedPassengers: 0, migratedQuotes: 0 };
  let migratedBookings = 0;
  let migratedPassengers = 0;
  let migratedQuotes = 0;

  const bRows = db.prepare('SELECT id, details FROM bookings').all();
  const updBooking = db.prepare('UPDATE bookings SET details = ? WHERE id = ?');
  for (const r of bRows) {
    try {
      const det = JSON.parse(r.details || '{}');
      const needsEnc = Array.isArray(det.passengersDetail) &&
        det.passengersDetail.some((p) => p?.tcOrPassport && !isEncryptedPii(p.tcOrPassport));
      if (needsEnc) {
        updBooking.run(JSON.stringify(encryptBookingDetails(det, key)), r.id);
        migratedBookings++;
      }
    } catch { /* ignore malformed legacy row */ }
  }

  const pRows = db.prepare("SELECT id, tc_or_passport FROM saved_passengers WHERE tc_or_passport != ''").all();
  const updPax = db.prepare('UPDATE saved_passengers SET tc_or_passport = ? WHERE id = ?');
  for (const r of pRows) {
    if (r.tc_or_passport && !isEncryptedPii(r.tc_or_passport)) {
      updPax.run(encryptPii(r.tc_or_passport, key), r.id);
      migratedPassengers++;
    }
  }

  const qRows = db.prepare("SELECT id, metadata FROM crm_quotes WHERE metadata != '{}'").all();
  const updQuote = db.prepare('UPDATE crm_quotes SET metadata = ? WHERE id = ?');
  for (const r of qRows) {
    try {
      const meta = JSON.parse(r.metadata || '{}');
      if (meta.tcOrPassport && !isEncryptedPii(meta.tcOrPassport)) {
        updQuote.run(JSON.stringify(encryptQuoteMetadata(meta, key)), r.id);
        migratedQuotes++;
      }
    } catch { /* ignore */ }
  }

  return { migratedBookings, migratedPassengers, migratedQuotes };
}

export function openDatabase(filename = process.env.FLYTOASPAN_DB || '.data/flytoaspan.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db._dbFilename = filename;
  db._piiKey = resolvePiiKey(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
      profile TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      pnr TEXT NOT NULL UNIQUE,
      owner_id TEXT REFERENCES users(id),
      surname TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bookings_owner ON bookings(owner_id, created_at);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      credit_limit INTEGER NOT NULL DEFAULT 0,
      allowed_modules TEXT NOT NULL DEFAULT '["flights","hotels","transfers"]',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      ip TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_logs_time ON audit_logs(created_at DESC);
    CREATE TABLE IF NOT EXISTS finance_entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      amount INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS finance_entries_date ON finance_entries(entry_date DESC, created_at DESC);
    CREATE TABLE IF NOT EXISTS crm_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      pnr TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS crm_tasks_due ON crm_tasks(status, due_date ASC);
    CREATE TABLE IF NOT EXISTS org_ledger (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      pnr TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idempotency_expiry ON idempotency_keys(expires_at);
    CREATE INDEX IF NOT EXISTS org_ledger_org ON org_ledger(organization_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS saved_passengers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      tc_or_passport TEXT NOT NULL DEFAULT '',
      birth_date TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'M',
      phone TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS saved_passengers_user ON saved_passengers(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS price_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      route TEXT NOT NULL,
      target_price INTEGER NOT NULL,
      current_price INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS price_alerts_user ON price_alerts(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS crm_quotes (
      id TEXT PRIMARY KEY,
      quote_no TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'Uçak',
      title TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      travel_date TEXT NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Taslak',
      converted_pnr TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS crm_quotes_time ON crm_quotes(created_at DESC);
    CREATE TABLE IF NOT EXISTS booking_notes (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      author_email TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS booking_notes_bk ON booking_notes(booking_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      page TEXT NOT NULL DEFAULT '',
      product_type TEXT NOT NULL DEFAULT '',
      session_hash TEXT NOT NULL DEFAULT '',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS analytics_events_time ON analytics_events(created_at DESC, event_type);
  `);
  const safeAlter = (sql) => { try { db.exec(sql); } catch { /* column already exists */ } };
  safeAlter("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  safeAlter('ALTER TABLE users ADD COLUMN organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL');
  safeAlter("ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]'");
  safeAlter('ALTER TABLE users ADD COLUMN totp_secret TEXT');
  safeAlter('ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0');
  safeAlter('ALTER TABLE users ADD COLUMN password_changed_at INTEGER');
  safeAlter("ALTER TABLE users ADD COLUMN role_label TEXT NOT NULL DEFAULT ''");
  safeAlter('ALTER TABLE bookings ADD COLUMN organization_id TEXT');
  safeAlter('ALTER TABLE bookings ADD COLUMN sold_by_user_id TEXT');
  safeAlter('ALTER TABLE bookings ADD COLUMN revision INTEGER NOT NULL DEFAULT 1');
  safeAlter('ALTER TABLE organizations ADD COLUMN used_credit INTEGER NOT NULL DEFAULT 0');
  safeAlter('ALTER TABLE organizations ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0');
  safeAlter("ALTER TABLE org_ledger ADD COLUMN booking_id TEXT NOT NULL DEFAULT ''");
  safeAlter("ALTER TABLE org_ledger ADD COLUMN ref_key TEXT");
  safeAlter('CREATE UNIQUE INDEX IF NOT EXISTS org_ledger_ref_unique ON org_ledger(ref_key) WHERE ref_key IS NOT NULL');
  safeAlter("ALTER TABLE crm_quotes ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'");

  migratePlaintextPii(db);
  return db;
}

export function writeAuditLog(db, { actorEmail, action, target, ip }) {
  const safeTarget = String(target || '-')
    .replace(/\b\d{13,19}\b/g, '[REDACTED_NUM]')
    .replace(/(password|token|secret)=[^\s,&]+/gi, '$1=[REDACTED]')
    .slice(0, 220);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_email, action, target, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomBytes(12).toString('hex'), actorEmail || 'system', action, safeTarget, ip || 'unknown', Date.now());
}

export function recordAnalyticsEvent(db, { eventType, page = '', productType = '', sessionHash = '', metadata = {} }) {
  try {
    const safeMeta = scrubSensitiveFields(metadata || {});
    db.prepare(`
      INSERT INTO analytics_events (id, event_type, page, product_type, session_hash, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomBytes(12).toString('hex'),
      String(eventType || 'unknown').slice(0, 48),
      String(page || '').slice(0, 120),
      String(productType || '').slice(0, 32),
      String(sessionHash || '').slice(0, 64),
      JSON.stringify(safeMeta),
      Date.now()
    );
  } catch { /* never break user flow on analytics write */ }
}

export function accountProfile(row) {
  let perms = [];
  try { perms = JSON.parse(row.permissions || '[]'); } catch { perms = []; }
  return {
    ...JSON.parse(row.profile),
    id: row.id,
    email: row.email,
    role: row.role,
    roleLabel: row.role_label || (row.role === 'admin' ? 'Süper Admin' : ''),
    status: row.status || 'active',
    organizationId: row.organization_id || null,
    permissions: Array.isArray(perms) ? perms : [],
    totpEnabled: Boolean(row.totp_enabled),
    registeredAt: row.created_at || Date.now(),
  };
}

export function organizationRecord(row) {
  let modules = ['flights', 'hotels', 'transfers'];
  try { modules = JSON.parse(row.allowed_modules || '[]'); } catch { /* default */ }
  const used = row.used_credit || 0;
  const limit = row.credit_limit || 0;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    creditLimitTRY: limit,
    usedCreditTRY: used,
    remainingCreditTRY: Math.max(0, limit - used),
    discountPercent: row.discount_percent || 0,
    allowedModules: Array.isArray(modules) ? modules : [],
    createdAt: row.created_at,
  };
}

export function orgLedgerRecord(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    bookingId: row.booking_id || '',
    type: row.type,
    amount: row.amount,
    description: row.description,
    pnr: row.pnr || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at,
  };
}

export function savedPassengerRecord(row, piiKey = null) {
  const rawDoc = row.tc_or_passport || '';
  return {
    id: row.id,
    fullName: row.full_name,
    tcOrPassport: piiKey ? decryptPii(rawDoc, piiKey) : rawDoc,
    birthDate: row.birth_date || '',
    gender: row.gender || 'M',
    phone: row.phone || '',
    createdAt: row.created_at,
  };
}

export function priceAlertRecord(row) {
  return {
    id: row.id,
    route: row.route,
    target: row.target_price,
    current: row.current_price,
    createdAt: row.created_at,
  };
}

export function crmQuoteRecord(row, piiKey = null) {
  let meta = {};
  try {
    meta = row.metadata ? JSON.parse(row.metadata) : {};
    if (piiKey) meta = decryptQuoteMetadata(meta, piiKey);
  } catch {
    meta = {};
  }
  return {
    id: row.id,
    quoteNo: row.quote_no,
    customerName: row.customer_name,
    firstName: meta.firstName || undefined,
    lastName: meta.lastName || undefined,
    birthDate: meta.birthDate || undefined,
    documentType: meta.documentType === 'pasaport' ? 'pasaport' : meta.documentType === 'kimlik' ? 'kimlik' : undefined,
    tcOrPassport: meta.tcOrPassport || undefined,
    nationality: meta.nationality || undefined,
    passportCountry: meta.passportCountry || undefined,
    passportIssueDate: meta.passportIssueDate || undefined,
    passportExpiryDate: meta.passportExpiryDate || undefined,
    passportIssuer: meta.passportIssuer || undefined,
    gender: meta.gender || undefined,
    customerEmail: meta.customerEmail || undefined,
    customerPhone: row.customer_phone || '',
    paxCount: meta.paxCount || 1,
    type: row.type || 'Uçak',
    title: row.title,
    details: row.details || '',
    travelDate: row.travel_date,
    price: row.price,
    airline: meta.airline || undefined,
    flightNumber: meta.flightNumber || undefined,
    departTime: meta.departTime || undefined,
    arriveTime: meta.arriveTime || undefined,
    duration: meta.duration || undefined,
    baggage: meta.baggage || undefined,
    cabin: meta.cabin || undefined,
    fromCode: meta.fromCode || undefined,
    toCode: meta.toCode || undefined,
    providerSource: meta.providerSource || undefined,
    netCostTRY: typeof meta.netCostTRY === 'number' ? meta.netCostTRY : undefined,
    status: row.status || 'Taslak',
    convertedPnr: row.converted_pnr || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at,
  };
}

export async function createAccount(db, {
  email,
  password,
  role = 'member',
  roleLabel = '',
  status = 'active',
  organizationId = null,
  permissions = [],
  ...profile
}) {
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(password, salt, 64, scryptOptions);
  const id = randomBytes(16).toString('hex');
  const welcomeMiles =
    typeof profile.miles === 'number'
      ? profile.miles
      : (role === 'member' && profile.accountType === 'individual' ? 2500 : 0);
  const result = db.prepare(`
    INSERT INTO users (id, email, salt, password_hash, role, profile, status, organization_id, permissions, role_label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING
  `).run(
    id, email, salt, hash.toString('hex'), role,
    JSON.stringify({ ...profile, miles: welcomeMiles, createdAt: new Date().toISOString().slice(0, 10) }),
    status, organizationId, JSON.stringify(permissions), roleLabel || ''
  );
  if (!result.changes) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export async function setAccountPassword(db, userId, newPassword) {
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(newPassword, salt, 64, scryptOptions);
  db.prepare('UPDATE users SET salt = ?, password_hash = ?, password_changed_at = ? WHERE id = ?')
    .run(salt, hash.toString('hex'), Date.now(), userId);
}

export async function verifyPassword(row, password) {
  const actual = await deriveKey(password, row?.salt ?? dummySalt, 64, scryptOptions);
  const expected = row ? Buffer.from(row.password_hash, 'hex') : Buffer.alloc(64);
  return timingSafeEqual(actual, expected) && !!row;
}

export function financeEntryRecord(row) {
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    title: row.title,
    amount: row.amount,
    entryDate: row.entry_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function crmTaskRecord(row) {
  return {
    id: row.id,
    title: row.title,
    customerName: row.customer_name || '',
    pnr: row.pnr || '',
    dueDate: row.due_date,
    priority: row.priority || 'normal',
    status: row.status || 'open',
    assignedTo: row.assigned_to || '',
    createdAt: row.created_at,
  };
}

export function deriveLifecycleStates(status, details) {
  const isDemo = details?.demo !== false;
  let paymentStatus = details?.paymentStatus;
  let ticketingStatus = details?.ticketingStatus;
  let refundStatus = details?.refundStatus;

  if (!paymentStatus) {
    if (isDemo) {
      paymentStatus = status === 'İade Edildi' ? 'demo_refunded' : 'demo_unpaid';
    } else {
      paymentStatus = status === 'İade Edildi' ? 'refunded' : 'verified';
    }
  }
  if (!ticketingStatus) {
    if (isDemo) {
      ticketingStatus = status === 'İptal Edildi' || status === 'İade Edildi' ? 'voided' : 'demo_not_ticketed';
    } else {
      ticketingStatus = status === 'İptal Edildi' || status === 'İade Edildi' ? 'voided' : 'ticketed';
    }
  }
  if (!refundStatus) {
    refundStatus = status === 'İade Edildi' ? 'completed' : status === 'İptal Talebi' ? 'requested' : 'none';
  }
  return { paymentStatus, ticketingStatus, refundStatus };
}

export function bookingRecord(row, piiKey = null) {
  let sellerName;
  if (row.seller_profile) {
    try {
      const p = JSON.parse(row.seller_profile);
      sellerName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || undefined;
    } catch { /* ignore */ }
  }
  const rawDetails = JSON.parse(row.details);
  const details = piiKey ? decryptBookingDetails(rawDetails, piiKey) : rawDetails;
  const lifecycle = deriveLifecycleStates(row.status, details);
  return {
    ...details,
    ...lifecycle,
    id: row.id,
    pnr: row.pnr,
    status: row.status,
    revision: row.revision ?? 1,
    organizationId: row.organization_id || null,
    soldByUserId: row.sold_by_user_id || null,
    sellerName: sellerName || null,
    sellerEmail: row.seller_email || null,
    organizationName: row.organization_name || null,
    createdAt: row.created_at || Date.now(),
  };
}
