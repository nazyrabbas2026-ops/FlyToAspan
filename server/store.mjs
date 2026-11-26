import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const scryptOptions = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const dummySalt = '00000000000000000000000000000000';

export function openDatabase(filename = process.env.FLYTOASPAN_DB || '.data/flytoaspan.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
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
  `);
  const safeAlter = (sql) => { try { db.exec(sql); } catch { /* column already exists */ } };
  safeAlter("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  safeAlter('ALTER TABLE users ADD COLUMN organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL');
  safeAlter("ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]'");
  safeAlter('ALTER TABLE bookings ADD COLUMN organization_id TEXT');
  safeAlter('ALTER TABLE bookings ADD COLUMN sold_by_user_id TEXT');
  safeAlter('ALTER TABLE organizations ADD COLUMN used_credit INTEGER NOT NULL DEFAULT 0');
  safeAlter('ALTER TABLE organizations ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0');
  return db;
}

export function writeAuditLog(db, { actorEmail, action, target, ip }) {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_email, action, target, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomBytes(12).toString('hex'), actorEmail || 'system', action, target || '-', ip || 'unknown', Date.now());
}

export function accountProfile(row) {
  let perms = [];
  try { perms = JSON.parse(row.permissions || '[]'); } catch { perms = []; }
  return {
    ...JSON.parse(row.profile),
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status || 'active',
    organizationId: row.organization_id || null,
    permissions: Array.isArray(perms) ? perms : [],
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
    type: row.type,
    amount: row.amount,
    description: row.description,
    pnr: row.pnr || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at,
  };
}

export function savedPassengerRecord(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    tcOrPassport: row.tc_or_passport || '',
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

export function crmQuoteRecord(row) {
  return {
    id: row.id,
    quoteNo: row.quote_no,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || '',
    type: row.type || 'Uçak',
    title: row.title,
    details: row.details || '',
    travelDate: row.travel_date,
    price: row.price,
    status: row.status || 'Taslak',
    convertedPnr: row.converted_pnr || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at,
  };
}

export async function createAccount(db, { email, password, role = 'member', status = 'active', organizationId = null, permissions = [], ...profile }) {
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(password, salt, 64, scryptOptions);
  const id = randomBytes(16).toString('hex');
  const result = db.prepare(`
    INSERT INTO users (id, email, salt, password_hash, role, profile, status, organization_id, permissions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING
  `).run(
    id, email, salt, hash.toString('hex'), role,
    JSON.stringify({ ...profile, miles: 0, createdAt: new Date().toISOString().slice(0, 10) }),
    status, organizationId, JSON.stringify(permissions)
  );
  if (!result.changes) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export async function setAccountPassword(db, userId, newPassword) {
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(newPassword, salt, 64, scryptOptions);
  db.prepare('UPDATE users SET salt = ?, password_hash = ? WHERE id = ?').run(salt, hash.toString('hex'), userId);
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

export function bookingRecord(row) {
  let sellerName;
  if (row.seller_profile) {
    try {
      const p = JSON.parse(row.seller_profile);
      sellerName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || undefined;
    } catch { /* ignore */ }
  }
  return {
    ...JSON.parse(row.details),
    id: row.id,
    pnr: row.pnr,
    status: row.status,
    organizationId: row.organization_id || null,
    soldByUserId: row.sold_by_user_id || null,
    sellerName: sellerName || null,
    sellerEmail: row.seller_email || null,
    organizationName: row.organization_name || null,
    createdAt: row.created_at || Date.now(),
  };
}
