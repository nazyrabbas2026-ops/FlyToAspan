import { createHash, randomBytes } from 'node:crypto';
import {
  accountProfile,
  bookingRecord,
  createAccount,
  crmQuoteRecord,
  crmTaskRecord,
  financeEntryRecord,
  openDatabase,
  orgLedgerRecord,
  organizationRecord,
  priceAlertRecord,
  savedPassengerRecord,
  setAccountPassword,
  verifyPassword,
  writeAuditLog,
} from './store.mjs';
import {
  sendBookingConfirmationEmail,
  sendCorporateApprovedEmail,
  sendPasswordResetEmail,
} from './mailer.mjs';

const VALID_PERMISSIONS = new Set([
  'flights.sell',
  'hotels.sell',
  'transfers.sell',
  'tours.sell',
  'bookings.view_own',
  'bookings.view_org',
  'bookings.cancel_request',
  'bookings.manage',
  'inventory.manage',
  'flights.manual',
  'pricing.edit',
  'fx.manage',
  'coupons.manage',
  'apis.manage',
  'team.manage',
]);
const VALID_MODULES = new Set(['flights', 'hotels', 'transfers', 'tours']);

function cleanPermissions(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((p) => typeof p === 'string' && VALID_PERMISSIONS.has(p)))];
}

function cleanModules(list) {
  if (!Array.isArray(list)) return ['flights', 'hotels', 'transfers'];
  return [...new Set(list.filter((m) => typeof m === 'string' && VALID_MODULES.has(m)))];
}

function hasPerm(user, perm) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  let perms = [];
  try { perms = JSON.parse(user.permissions || '[]'); } catch { perms = []; }
  return Array.isArray(perms) && perms.includes(perm);
}

function canAccessPanel(user) {
  if (!user || (user.status && user.status !== 'active')) return false;
  if (user.role === 'admin') return true;
  let perms = [];
  try { perms = JSON.parse(user.permissions || '[]'); } catch { perms = []; }
  return Array.isArray(perms) && perms.length > 0;
}

const sessionLifetime = 7 * 24 * 60 * 60;
const statuses = ['Onaylandı', 'Tamamlandı', 'İptal Talebi', 'İptal Edildi', 'İade Edildi'];
const markupLimits = { domesticAddTRY: 800, centralAsiaPercent: 25, intlPercent: 25, hotelPercent: 30, transferAddTRY: 1000 };
const catalogFields = {
  rules: { carrier: 100, route: 120, rule: 120 },
  coupons: { code: 30, title: 160, category: 24, validUntil: 48, active: 'boolean' },
  agencies: { name: 120, type: 48, contact: 120, creditLimitTRY: 'integer', miles: 'integer', status: 24 },
  hotels: { city: 60, name: 120, stars: 'integer', boardType: 60, nights: 'integer', price: 'integer', active: 'boolean' },
  transfers: { city: 60, vehicle: 120, route: 140, capacity: 48, baggage: 48, price: 'integer', active: 'boolean' },
  tours: { city: 60, title: 140, duration: 48, quota: 'integer', price: 'integer', active: 'boolean' },
  operators: { operator: 80, product: 32, markupType: 16, markupValue: 'integer', active: 'boolean' },
  flights: {
    airline: 80, airlineCode: 8, flightNumber: 20, fromCode: 8, toCode: 8,
    departTime: 10, arriveTime: 10, duration: 24, operator: 60, baggage: 40,
    flightDate: 'optional:16', priceTRY: 'integer', quota: 'integer', active: 'boolean',
  },
  providers: {
    name: 100, protocol: 24, category: 32, apiUrl: 240,
    xmlFeedUrl: 'optional:240', apiKey: 'optional:180', username: 'optional:100',
    password: 'optional:120', agentCode: 'optional:64', docsUrl: 'optional:240',
    whitelistIp: 'optional:80', mode: 24, active: 'boolean',
  },
};

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new RequestError(status, message);
}

function text(value, maximum, minimum = 1) {
  const clean = typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : '';
  if (clean.length < minimum || clean.length > maximum) fail(400, 'Girilen bilgileri kontrol edin.');
  return clean;
}

export function normalizeSurname(value) {
  return text(value, 80)
    .replace(/[İIıi]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeEmail(value) {
  const email = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Geçerli bir e-posta adresi girin.');
  return email;
}

export function checkPassword(value, minimum = 12) {
  if (typeof value !== 'string' || value.length < minimum || Buffer.byteLength(value) > 256) {
    fail(400, `Parola en az ${minimum} karakter ve en fazla 256 bayt olmalı.`);
  }
  return value;
}

function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Geçerli bir tarih girin.');
  const day = new Date(value);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) fail(400, 'Geçerli bir tarih girin.');
  return value;
}

async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) fail(415, 'JSON içerik bekleniyor.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 16_384) {
      req.resume();
      fail(413, 'İstek çok büyük.');
    }
    chunks.push(chunk);
  }
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (result && typeof result === 'object' && !Array.isArray(result)) return result;
  } catch { /* handled below */ }
  fail(400, 'İstek içeriği okunamadı.');
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sessionToken(req, cookieName) {
  const token = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token ?? '') ? token : null;
}

const PNR_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateIataPnr() {
  const bytes = randomBytes(6);
  let code = 'FT';
  for (let i = 0; i < 6; i++) code += PNR_ALPHABET[bytes[i] % PNR_ALPHABET.length];
  return code;
}

function resolveClientIp(req) {
  const trustProxy = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
  if (trustProxy) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim().slice(0, 64);
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim().slice(0, 64);
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function newDemoBooking(db, body, owner) {
  const type = text(body.type, 10);
  if (!['Uçak', 'Otel', 'Transfer', 'Tur'].includes(type)) fail(400, 'Rezervasyon türü geçersiz.');
  const surname = normalizeSurname(body.lookupSurname);
  const date = isoDate(body.date);
  const returnDate = body.returnDate ? isoDate(body.returnDate) : undefined;
  if (returnDate && returnDate < date) fail(400, 'Dönüş tarihi başlangıç tarihinden önce olamaz.');
  if (!Number.isFinite(body.price) || body.price < 0 || body.price > 10_000_000) fail(400, 'Tutar geçersiz.');
  const salePrice = Math.round(body.price * 100) / 100;
  const rawNetCost = Number(body.netCostTRY);
  const netCostTRY = Number.isFinite(rawNetCost) && rawNetCost >= 0 && rawNetCost <= 10_000_000
    ? Math.round(rawNetCost * 100) / 100
    : undefined;
  const rawProfit = Number(body.profitTRY);
  const profitTRY = Number.isFinite(rawProfit) && rawProfit >= -10_000_000 && rawProfit <= 10_000_000
    ? Math.round(rawProfit * 100) / 100
    : (netCostTRY !== undefined ? Math.round((salePrice - netCostTRY) * 100) / 100 : undefined);
  const passengersDetail = Array.isArray(body.passengersDetail)
    ? body.passengersDetail.slice(0, 12).map((p) => ({
        fullName: typeof p?.fullName === 'string' ? p.fullName.trim().slice(0, 120) : '',
        tcOrPassport: typeof p?.tcOrPassport === 'string' ? p.tcOrPassport.trim().slice(0, 32) : undefined,
        birthDate: typeof p?.birthDate === 'string' ? p.birthDate.trim().slice(0, 16) : undefined,
        gender: typeof p?.gender === 'string' ? p.gender.trim().slice(0, 12) : undefined,
        paxType: typeof p?.paxType === 'string' ? p.paxType.trim().slice(0, 32) : undefined,
      })).filter((p) => p.fullName)
    : undefined;
  const details = {
    type, date, returnDate,
    title: text(body.title, 160),
    subtitle: text(body.subtitle, 320),
    passenger: text(body.passenger, 150, 2),
    passengersDetail: passengersDetail && passengersDetail.length > 0 ? passengersDetail : undefined,
    contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail.trim().slice(0, 120) : undefined,
    contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim().slice(0, 40) : undefined,
    providerSource: typeof body.providerSource === 'string' ? body.providerSource.trim().slice(0, 80) : undefined,
    netCostTRY,
    profitTRY,
    price: salePrice,
    departTime: typeof body.departTime === 'string' ? body.departTime.trim().slice(0, 10) : undefined,
    arriveTime: typeof body.arriveTime === 'string' ? body.arriveTime.trim().slice(0, 10) : undefined,
    flightNumber: typeof body.flightNumber === 'string' ? body.flightNumber.trim().slice(0, 24) : undefined,
    airline: typeof body.airline === 'string' ? body.airline.trim().slice(0, 60) : undefined,
    baggage: typeof body.baggage === 'string' ? body.baggage.trim().slice(0, 60) : undefined,
    cabin: typeof body.cabin === 'string' ? body.cabin.trim().slice(0, 32) : undefined,
    duration: typeof body.duration === 'string' ? body.duration.trim().slice(0, 24) : undefined,
    demo: true,
  };
  const id = randomBytes(16).toString('hex');
  const status = 'Onaylandı';
  let pnr = generateIataPnr();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      db.prepare(`
        INSERT INTO bookings (id, pnr, owner_id, surname, status, details, created_at, organization_id, sold_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, pnr, owner?.id ?? null, surname, status, JSON.stringify(details), Date.now(),
        owner?.organization_id ?? null, owner?.id ?? null
      );
      return { ...details, id, pnr, status, organizationId: owner?.organization_id ?? null, soldByUserId: owner?.id ?? null };
    } catch (err) {
      if (attempt < 4 && String(err?.message || '').includes('UNIQUE')) {
        pnr = generateIataPnr();
        continue;
      }
      throw err;
    }
  }
  fail(500, 'PNR oluşturulamadı.');
}

function validateCatalogItems(section, items) {
  if (!Array.isArray(items) || items.length > 45) fail(400, 'En fazla 45 örnek kayıt kaydedebilirsiniz.');
  const ids = new Set();
  const couponCodes = new Set();
  return items.map((item) => {
    if (!item || typeof item !== 'object') fail(400, 'Kayıt geçersiz.');
    const id = text(item.id, 48);
    if (ids.has(id)) fail(400, 'Aynı kayıt iki kez eklenemez.');
    ids.add(id);
    const cleaned = { id };
    for (const [key, rule] of Object.entries(catalogFields[section])) {
      const value = item[key];
      if (typeof rule === 'number') {
        cleaned[key] = text(value, rule);
      } else if (typeof rule === 'string' && rule.startsWith('optional:')) {
        const maxLen = Number(rule.slice('optional:'.length)) || 32;
        cleaned[key] = typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
      } else {
        const valid = rule === 'boolean' ? typeof value === 'boolean' :
          Number.isInteger(value) && value >= 0 && value <= 100_000_000;
        if (!valid) fail(400, 'Kayıt geçersiz.');
        cleaned[key] = value;
      }
    }
    if (section === 'coupons') {
      const code = cleaned.code.toUpperCase();
      if (!/^[A-Z0-9_-]+$/.test(code) || couponCodes.has(code)) fail(400, 'Kupon kodu geçersiz veya zaten kayıtlı.');
      couponCodes.add(code);
      cleaned.code = code;
    }
    return cleaned;
  });
}

export function createApi({ db = openDatabase(), publicOrigin = process.env.FLYTOASPAN_ORIGIN } = {}) {
  const origin = publicOrigin ? new URL(publicOrigin) : null;
  if (origin && publicOrigin !== origin.origin) throw new Error('FLYTOASPAN_ORIGIN yalnızca şema, alan adı ve port içermeli.');
  const secureCookie = origin?.protocol === 'https:';
  if (origin && !secureCookie && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    throw new Error('Dış erişim için HTTPS adresi gerekli.');
  }
  const cookieName = secureCookie ? '__Host-flytoaspan_session' : 'flytoaspan_session';
  const buckets = new Map();
  const idempotencyCache = new Map();
  let nextSweep = 0;

  const throttle = (key, max, period = 15 * 60_000) => {
    const now = Date.now();
    if (now >= nextSweep) {
      for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id);
      for (const [ik, item] of idempotencyCache) if (item.until <= now) idempotencyCache.delete(ik);
      nextSweep = now + 60_000;
    }
    const bucket = buckets.get(key);
    if (!bucket || bucket.until <= now) {
      if (buckets.size >= 20_000) fail(429, 'Çok fazla istek var. Biraz sonra tekrar deneyin.');
      buckets.set(key, { count: 1, until: now + period });
    } else if (++bucket.count > max) {
      fail(429, 'Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.');
    }
  };

  const getSessionUser = (token) => token && db.prepare(`
    SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE token_hash = ? AND expires_at > ?
  `).get(digest(token), Date.now());

  const setSessionCookie = (res, token, age) => res.setHeader(
    'Set-Cookie',
    `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secureCookie ? '; Secure' : ''}`
  );

  const clearSession = (token) => {
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
  };

  const authenticate = (res, previousToken, account) => {
    const token = randomBytes(32).toString('base64url');
    clearSession(previousToken);
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      digest(token), account.id, Date.now() + sessionLifetime * 1000
    );
    setSessionCookie(res, token, sessionLifetime);
    return accountProfile(account);
  };

  const readMarkup = () => {
    const found = db.prepare("SELECT value FROM settings WHERE key = 'markup'").get();
    return found ? JSON.parse(found.value) : null;
  };

  let fxCache = {
    rates: { TRY: 1, USD: 0.019754, EUR: 0.018109, KZT: 8.988027, RUB: 1.618745 },
    updatedAt: null,
    expiresAt: 0,
  };

  const readFxOverride = () => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'fx_override'").get();
    return row ? JSON.parse(row.value) : null;
  };

  const readFxRates = async (ignoreOverride = false) => {
    if (!ignoreOverride) {
      const override = readFxOverride();
      if (override) return { rates: override.rates, updatedAt: override.updatedAt, manual: true };
    }
    const now = Date.now();
    if (fxCache.expiresAt > now) return { rates: fxCache.rates, updatedAt: fxCache.updatedAt, manual: false };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch('https://open.er-api.com/v6/latest/TRY', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data?.rates) {
          fxCache = {
            rates: {
              TRY: 1,
              USD: typeof data.rates.USD === 'number' ? data.rates.USD : fxCache.rates.USD,
              EUR: typeof data.rates.EUR === 'number' ? data.rates.EUR : fxCache.rates.EUR,
              KZT: typeof data.rates.KZT === 'number' ? data.rates.KZT : fxCache.rates.KZT,
              RUB: typeof data.rates.RUB === 'number' ? data.rates.RUB : fxCache.rates.RUB,
            },
            updatedAt: new Date().toISOString(),
            expiresAt: now + 30 * 60_000,
          };
        }
      }
    } catch {
      fxCache.expiresAt = now + 5 * 60_000;
    }
    return { rates: fxCache.rates, updatedAt: fxCache.updatedAt, manual: false };
  };

  return async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;
    const method = req.method;
    const path = url.pathname;
    const ip = resolveClientIp(req);
    try {
      const trustProxy = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
      const reqProto = trustProxy && req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      if (method !== 'GET' && req.headers.origin !== (origin?.origin ?? `${reqProto}://${req.headers.host}`)) {
        fail(403, 'İstek kaynağı doğrulanamadı.');
      }
      const token = sessionToken(req, cookieName);
      const user = getSessionUser(token);
      if (path.startsWith('/api/admin/')) {
        const isSuperAdmin = user?.role === 'admin' && (user.status || 'active') === 'active';
        const staffBookingRoute = path === '/api/admin/bookings' || /^\/api\/admin\/bookings\/[a-f0-9]{32}$/.test(path);
        const staffCatalogRead = method === 'GET' && path === '/api/admin/catalog';
        const staffCatalogWrite = method === 'PUT' && /^\/api\/admin\/catalog\/(rules|coupons|agencies|hotels|transfers|tours|operators|flights|providers)$/.test(path);
        const staffPricingRoute = path === '/api/admin/pricing' && hasPerm(user, 'pricing.edit');
        const staffFxRoute = path === '/api/admin/fx' && hasPerm(user, 'fx.manage');
        const staffApiRoute = (path === '/api/admin/server-info' || path === '/api/admin/providers/test') && hasPerm(user, 'apis.manage');
        const staffTeamRoute =
          hasPerm(user, 'team.manage') &&
          (path === '/api/admin/users' ||
            /^\/api\/admin\/users\/[a-f0-9]{32}\/(approve|permissions|status)$/.test(path) ||
            path === '/api/admin/organizations' ||
            /^\/api\/admin\/organizations\/[a-f0-9]{24}(\/(ledger|payment))?$/.test(path));
        let allowedStaff = false;
        if (canAccessPanel(user)) {
          if (staffBookingRoute || staffCatalogRead || staffPricingRoute || staffFxRoute || staffApiRoute || staffTeamRoute) allowedStaff = true;
          if (staffCatalogWrite) {
            const sec = path.split('/')[4];
            if ((sec === 'hotels' || sec === 'transfers' || sec === 'tours') && hasPerm(user, 'inventory.manage')) allowedStaff = true;
            if (sec === 'flights' && hasPerm(user, 'flights.manual')) allowedStaff = true;
            if ((sec === 'rules' || sec === 'operators') && hasPerm(user, 'pricing.edit')) allowedStaff = true;
            if (sec === 'coupons' && hasPerm(user, 'coupons.manage')) allowedStaff = true;
            if (sec === 'providers' && hasPerm(user, 'apis.manage')) allowedStaff = true;
          }
        }
        if (!isSuperAdmin && !allowedStaff) {
          fail(user ? 403 : 401, 'Bu işlem için yönetici veya ilgili ekip yetkisi gerekiyor.');
        }
      }

      if (method === 'GET' && path === '/api/passengers') {
        if (!user) fail(401, 'Oturum açın.');
        const rows = db.prepare('SELECT * FROM saved_passengers WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
        send(res, 200, { passengers: rows.map(savedPassengerRecord) });
      } else if (method === 'POST' && path === '/api/passengers') {
        if (!user) fail(401, 'Oturum açın.');
        const body = await readJson(req);
        const fullName = text(body.fullName, 120, 2);
        const tcOrPassport = typeof body.tcOrPassport === 'string' ? body.tcOrPassport.trim().slice(0, 32) : '';
        const birthDate = typeof body.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate) ? body.birthDate : '';
        const gender = body.gender === 'F' ? 'F' : 'M';
        const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : '';
        const id = randomBytes(12).toString('hex');
        db.prepare(`
          INSERT INTO saved_passengers (id, user_id, full_name, tc_or_passport, birth_date, gender, phone, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, user.id, fullName, tcOrPassport, birthDate, gender, phone, Date.now());
        const row = db.prepare('SELECT * FROM saved_passengers WHERE id = ?').get(id);
        send(res, 201, { passenger: savedPassengerRecord(row) });
      } else if (method === 'DELETE' && /^\/api\/passengers\/[a-f0-9]{24}$/.test(path)) {
        if (!user) fail(401, 'Oturum açın.');
        const id = path.split('/').at(-1);
        db.prepare('DELETE FROM saved_passengers WHERE id = ? AND user_id = ?').run(id, user.id);
        send(res, 200, { ok: true });
      } else if (method === 'GET' && path === '/api/alerts') {
        if (!user) fail(401, 'Oturum açın.');
        const rows = db.prepare('SELECT * FROM price_alerts WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
        send(res, 200, { alerts: rows.map(priceAlertRecord) });
      } else if (method === 'POST' && path === '/api/alerts') {
        if (!user) fail(401, 'Oturum açın.');
        const body = await readJson(req);
        const route = text(body.route, 140, 3);
        const target = Math.max(200, Math.min(5_000_000, Math.round(Number(body.target) || 5000)));
        const current = Math.max(200, Math.min(5_000_000, Math.round(Number(body.current) || target + 640)));
        const id = randomBytes(12).toString('hex');
        db.prepare(`
          INSERT INTO price_alerts (id, user_id, route, target_price, current_price, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, user.id, route, target, current, Date.now());
        const row = db.prepare('SELECT * FROM price_alerts WHERE id = ?').get(id);
        send(res, 201, { alert: priceAlertRecord(row) });
      } else if (method === 'DELETE' && /^\/api\/alerts\/[a-f0-9]{24}$/.test(path)) {
        if (!user) fail(401, 'Oturum açın.');
        const id = path.split('/').at(-1);
        db.prepare('DELETE FROM price_alerts WHERE id = ? AND user_id = ?').run(id, user.id);
        send(res, 200, { ok: true });
      } else if (method === 'GET' && path === '/api/health') {
        send(res, 200, { ok: true, status: 'healthy', timestamp: new Date().toISOString() });
      } else if (method === 'GET' && path === '/api/session') {
        send(res, 200, { user: user ? accountProfile(user) : null });
      } else if (method === 'POST' && path === '/api/auth/register') {
        throttle(`register:${ip}`, 10);
        const body = await readJson(req);
        const accountType = body.accountType === 'corporate' ? 'corporate' : 'individual';
        const isCorpPending = accountType === 'corporate';
        const password = isCorpPending
          ? randomBytes(24).toString('hex')
          : checkPassword(body.password);
        const requestedModules = Array.isArray(body.requestedModules)
          ? body.requestedModules.filter((m) => VALID_MODULES.has(m))
          : [];
        const applicantType = ['agency', 'corporate', 'sales'].includes(body.applicantType)
          ? body.applicantType
          : undefined;
        const taxId = typeof body.taxId === 'string' && body.taxId.trim()
          ? body.taxId.trim().slice(0, 40)
          : undefined;
        const account = await createAccount(db, {
          email: normalizeEmail(body.email),
          password,
          status: isCorpPending ? 'pending' : 'active',
          firstName: text(body.firstName, 60),
          lastName: text(body.lastName, 80, 2),
          phone: text(body.phone, 32, 5),
          accountType,
          companyName: accountType === 'corporate' ? text(body.companyName, 120) : undefined,
          applicantType: isCorpPending ? applicantType : undefined,
          taxId: isCorpPending ? taxId : undefined,
          requestedModules: isCorpPending && requestedModules.length ? requestedModules : undefined,
        });
        if (!account) fail(409, 'Bu e-posta adresiyle bir hesap zaten var.');
        if (isCorpPending) {
          writeAuditLog(db, { actorEmail: account.email, action: 'auth:corporate_apply', target: body.companyName || account.email, ip });
          send(res, 201, {
            pending: true,
            user: null,
            message: 'Kurumsal başvurunuz alındı! Yöneticimiz onaylayıp giriş şifrenizi belirledikten sonra hesabınız aktif edilecektir.',
          });
        } else {
          send(res, 201, { user: authenticate(res, token, account) });
        }
      } else if (method === 'POST' && path === '/api/auth/login') {
        throttle(`login:${ip}`, 36);
        const body = await readJson(req);
        const email = normalizeEmail(body.email);
        const password = checkPassword(body.password, 1);
        throttle(`login-account:${email}`, 8);
        const account = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (account?.status === 'pending') fail(403, 'Kurumsal başvurunuz yönetici onayı bekliyor. Onaylandıktan sonra şifrenizle giriş yapabilirsiniz.');
        if (account?.status === 'suspended') fail(403, 'Hesabınız yönetici tarafından askıya alınmıştır.');
        if (account?.organization_id) {
          const org = db.prepare('SELECT status FROM organizations WHERE id = ?').get(account.organization_id);
          if (org && org.status === 'suspended') fail(403, 'Bağlı olduğunuz şirket hesabı askıya alınmıştır.');
        }
        if (!await verifyPassword(account, password)) fail(401, 'E-posta veya parola hatalı.');
        buckets.delete(`login-account:${email}`);
        send(res, 200, { user: authenticate(res, token, account) });
      } else if (method === 'POST' && path === '/api/auth/logout') {
        clearSession(token);
        setSessionCookie(res, '', 0);
        send(res, 200, { ok: true });
      } else if (method === 'POST' && path === '/api/auth/password-reset-request') {
        throttle(`pwd-reset:${ip}`, 6);
        const body = await readJson(req);
        const email = normalizeEmail(body.email);
        writeAuditLog(db, { actorEmail: email, action: 'auth:password_reset_request', target: email, ip });
        void sendPasswordResetEmail({ to: email });
        send(res, 200, {
          ok: true,
          message: 'E-posta adresiniz sistemde kayıtlıysa parola sıfırlama bağlantısı gönderilecektir.',
        });
      } else if (method === 'GET' && path === '/api/pricing') {
        send(res, 200, { markup: readMarkup() });
      } else if (method === 'GET' && path === '/api/catalog') {
        const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'catalog:%' AND key != 'catalog:providers'").all();
        const catalog = Object.fromEntries(rows.map(({ key, value }) => [key.slice('catalog:'.length), JSON.parse(value).items]));
        if (!('operators' in catalog)) {
          catalog.operators = [
            { id: 'op-funsun', operator: 'FUN&SUN (XML)', product: 'Uçak Bileti', markupType: 'NET', markupValue: 0, active: true },
            { id: 'op-kompas', operator: 'Kompas Tour (XML)', product: 'Uçak Bileti', markupType: 'EUR', markupValue: 10, active: true },
            { id: 'op-selfie', operator: 'Selfie Travel (XML)', product: 'Uçak Bileti', markupType: 'EUR', markupValue: 10, active: true },
            { id: 'op-tours-net', operator: 'Tüm Operatörler (XML)', product: 'Tur Paketi', markupType: 'NET', markupValue: 0, active: true },
          ];
        }
        if (!('flights' in catalog)) {
          catalog.flights = [
            {
              id: 'mf-kc918',
              airline: 'Air Astana Charter',
              airlineCode: 'KC',
              flightNumber: 'KC918',
              fromCode: 'IST',
              toCode: 'ALA',
              departTime: '22:45',
              arriveTime: '06:15',
              duration: '5sa 30dk',
              operator: 'Kompas Tour (XML)',
              baggage: '20 kg Bagaj',
              priceTRY: 6450,
              quota: 12,
              active: true,
            },
          ];
        }
        send(res, 200, { catalog });
      } else if (method === 'GET' && path === '/api/fx') {
        send(res, 200, await readFxRates());
      } else if (method === 'POST' && path === '/api/bookings/lookup') {
        throttle(`lookup:${ip}`, 24);
        const body = await readJson(req);
        const pnr = text(body.pnr, 24, 5).toUpperCase();
        const surname = normalizeSurname(body.surname);
        const row = db.prepare('SELECT * FROM bookings WHERE pnr = ? AND surname = ?').get(pnr, surname);
        if (!row) fail(404, 'Bu kod ve soyadla eşleşen rezervasyon bulunamadı.');
        send(res, 200, { booking: bookingRecord(row) });
      } else if (method === 'POST' && path === '/api/bookings/lookup-cancel') {
        throttle(`lookup:${ip}`, 24);
        const body = await readJson(req);
        const pnr = text(body.pnr, 24, 5).toUpperCase();
        const surname = normalizeSurname(body.surname);
        const row = db.prepare(`
          UPDATE bookings SET status = 'İptal Talebi'
          WHERE pnr = ? AND surname = ? AND status = 'Onaylandı'
          RETURNING *
        `).get(pnr, surname);
        if (!row) {
          const exists = db.prepare('SELECT status FROM bookings WHERE pnr = ? AND surname = ?').get(pnr, surname);
          if (!exists) fail(404, 'Bu kod ve soyadla eşleşen rezervasyon bulunamadı.');
          fail(409, `Bu rezervasyon zaten "${exists.status}" durumunda olduğu için yeni iptal talebi oluşturulamaz.`);
        }
        writeAuditLog(db, { actorEmail: user?.email || `guest:${pnr}`, action: 'public:pnr_cancel_request', target: pnr, ip });
        send(res, 200, { booking: bookingRecord(row) });
      } else if (method === 'GET' && path === '/api/bookings') {
        if (!user) fail(401, 'Oturum açın.');
        const rows = db.prepare('SELECT * FROM bookings WHERE owner_id = ? OR sold_by_user_id = ? ORDER BY created_at DESC, id DESC').all(user.id, user.id);
        send(res, 200, { bookings: rows.map(bookingRecord) });
      } else if (method === 'POST' && (path === '/api/bookings' || path === '/api/admin/bookings')) {
        throttle(`create-booking:${user?.id ?? ip}`, 120);
        const body = await readJson(req);
        const idemKey = typeof body.idempotencyKey === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(body.idempotencyKey)
          ? `${user?.id ?? ip}:${body.idempotencyKey}`
          : null;
        if (idemKey && idempotencyCache.has(idemKey)) {
          send(res, 200, { booking: idempotencyCache.get(idemKey).booking, deduplicated: true });
          return true;
        }
        // Enforce granular .sell permissions for staff/sub-agent accounts (B2C members with [] perms can buy freely)
        if (user && user.role !== 'admin' && canAccessPanel(user)) {
          const sellPermByType = {
            Uçak: 'flights.sell',
            Otel: 'hotels.sell',
            Transfer: 'transfers.sell',
            Tur: 'tours.sell',
          };
          const neededSellPerm = sellPermByType[body.type];
          if (neededSellPerm && !hasPerm(user, neededSellPerm)) {
            fail(403, `${body.type} satışı yapma yetkiniz bulunmuyor (${neededSellPerm}).`);
          }
        }
        // B2B Organization Credit Limit check & auto-deduction
        let orgRow = null;
        if (user && user.role !== 'admin' && user.organization_id) {
          orgRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(user.organization_id);
          if (orgRow && orgRow.status === 'suspended') {
            fail(403, 'Bağlı olduğunuz şirket hesabı askıya alınmıştır.');
          }
          if (orgRow && orgRow.credit_limit > 0) {
            const saleAmount = Math.round(Number(body.price) || 0);
            if ((orgRow.used_credit || 0) + saleAmount > orgRow.credit_limit) {
              fail(402, `Şirket B2B cari kredi limiti yetersiz! Kalan limit: ₺${Math.max(0, orgRow.credit_limit - (orgRow.used_credit || 0)).toLocaleString('tr-TR')}`);
            }
          }
        }
        const booking = newDemoBooking(db, body, user ?? null);
        if (orgRow && orgRow.credit_limit > 0) {
          const debitAmt = Math.round(booking.price);
          db.prepare('UPDATE organizations SET used_credit = used_credit + ? WHERE id = ?').run(debitAmt, orgRow.id);
          db.prepare(`
            INSERT INTO org_ledger (id, organization_id, type, amount, description, pnr, created_by, created_at)
            VALUES (?, ?, 'debit', ?, ?, ?, ?, ?)
          `).run(
            randomBytes(12).toString('hex'),
            orgRow.id,
            debitAmt,
            `${booking.type} Satışı: ${booking.title} (${booking.passenger})`,
            booking.pnr,
            user.email,
            Date.now()
          );
        }
        if (idemKey) {
          idempotencyCache.set(idemKey, { booking, until: Date.now() + 10 * 60_000 });
        }
        if (user?.email) {
          void sendBookingConfirmationEmail({
            to: user.email,
            passenger: booking.passenger,
            pnr: booking.pnr,
            title: booking.title,
            date: booking.date,
            price: booking.price,
          });
        }
        send(res, 201, { booking });
      } else if (method === 'POST' && /^\/api\/bookings\/[a-f0-9]{32}\/cancel$/.test(path)) {
        if (!user) fail(401, 'Oturum açın.');
        const id = path.split('/')[3];
        const row = db.prepare(`
          UPDATE bookings SET status = 'İptal Talebi' WHERE id = ? AND (owner_id = ? OR sold_by_user_id = ?) AND status = 'Onaylandı'
          RETURNING *
        `).get(id, user.id, user.id);
        if (!row) fail(404, 'İptal talebine uygun bir rezervasyon bulunamadı.');
        send(res, 200, { booking: bookingRecord(row) });
      } else if (method === 'GET' && path === '/api/admin/bookings') {
        const limitParam = Math.min(2000, Math.max(1, Number(url.searchParams.get('limit')) || 500));
        const selectJoin = `
          SELECT b.*, u.email AS seller_email, u.profile AS seller_profile, o.name AS organization_name
          FROM bookings b
          LEFT JOIN users u ON u.id = COALESCE(b.sold_by_user_id, b.owner_id)
          LEFT JOIN organizations o ON o.id = b.organization_id
        `;
        let rows;
        if (user.role === 'admin') {
          rows = db.prepare(`${selectJoin} ORDER BY b.created_at DESC, b.id DESC LIMIT ?`).all(limitParam);
        } else if (hasPerm(user, 'bookings.view_org') && user.organization_id) {
          rows = db.prepare(`${selectJoin} WHERE b.organization_id = ? ORDER BY b.created_at DESC, b.id DESC LIMIT ?`).all(user.organization_id, limitParam);
        } else if (hasPerm(user, 'bookings.view_own') || hasPerm(user, 'bookings.manage') || hasPerm(user, 'bookings.cancel_request')) {
          rows = db.prepare(`${selectJoin} WHERE b.owner_id = ? OR b.sold_by_user_id = ? ORDER BY b.created_at DESC, b.id DESC LIMIT ?`).all(user.id, user.id, limitParam);
        } else {
          rows = [];
        }
        send(res, 200, { bookings: rows.map(bookingRecord) });
      } else if (method === 'GET' && path === '/api/admin/catalog') {
        const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'catalog:%'").all();
        const catalog = Object.fromEntries(rows.map(({ key, value }) => [key.slice('catalog:'.length), JSON.parse(value)]));
        send(res, 200, { catalog });
      } else if (method === 'PUT' && /^\/api\/admin\/catalog\/(rules|coupons|agencies|hotels|transfers|tours|operators|flights|providers)$/.test(path)) {
        const section = path.split('/')[4];
        const key = 'catalog:' + section;
        const body = await readJson(req);
        const items = validateCatalogItems(section, body.items);
        const saved = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        const revision = saved ? JSON.parse(saved.value).revision : 0;
        if (body.revision !== revision) fail(409, 'Bu liste başka bir yerde güncellendi. Paneli yenileyip tekrar deneyin.');
        const entry = { revision: revision + 1, items };
        const result = saved
          ? db.prepare('UPDATE settings SET value = ? WHERE key = ? AND value = ?').run(JSON.stringify(entry), key, saved.value)
          : db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING').run(key, JSON.stringify(entry));
        if (!result.changes) fail(409, 'Bu liste başka bir yerde güncellendi. Paneli yenileyip tekrar deneyin.');
        send(res, 200, { entry });
      } else if ((method === 'PATCH' || method === 'DELETE') && /^\/api\/admin\/bookings\/[a-f0-9]{32}$/.test(path)) {
        const id = path.split('/').at(-1);
        const existingBk = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
        if (!existingBk) fail(404, 'Rezervasyon bulunamadı.');
        const sameOrg = Boolean(user.organization_id && existingBk.organization_id === user.organization_id);
        const isOwnBk = existingBk.owner_id === user.id || existingBk.sold_by_user_id === user.id;
        if (user.role !== 'admin' && !isOwnBk && !(sameOrg && hasPerm(user, 'bookings.view_org'))) {
          fail(403, 'Başka bir şirketin veya kullanıcının rezervasyonuna müdahale edemezsiniz.');
        }
        if (method === 'DELETE') {
          if (user.role !== 'admin') fail(403, 'Kayıt silme yetkisi sadece Süper Admin içindir.');
          db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
          writeAuditLog(db, { actorEmail: user.email, action: 'admin:booking_delete', target: id, ip });
          send(res, 200, { ok: true });
        } else {
          const { status } = await readJson(req);
          if (!statuses.includes(status)) fail(400, 'Rezervasyon durumu geçersiz.');
          const canDirectManage = user.role === 'admin' || hasPerm(user, 'bookings.manage');
          const canCancelReq = status === 'İptal Talebi' && existingBk.status === 'Onaylandı' && (canDirectManage || hasPerm(user, 'bookings.cancel_request'));
          if (!canDirectManage && !canCancelReq) {
            fail(403, 'Bu rezervasyon durumunu değiştirme yetkiniz yok.');
          }
          const row = db.prepare('UPDATE bookings SET status = ? WHERE id = ? RETURNING *').get(status, id);
          writeAuditLog(db, { actorEmail: user.email, action: 'admin:booking_status', target: `${row.pnr}:${status}`, ip });
          send(res, 200, { booking: bookingRecord(row) });
        }
      } else if (method === 'PATCH' && path === '/api/admin/pricing') {
        const body = await readJson(req);
        const markup = {};
        for (const [key, maximum] of Object.entries(markupLimits)) {
          if (!Number.isInteger(body[key]) || body[key] < 0 || body[key] > maximum) fail(400, 'Fiyat kuralı geçersiz.');
          markup[key] = body[key];
        }
        db.prepare(`
          INSERT INTO settings (key, value) VALUES ('markup', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(JSON.stringify(markup));
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:pricing_update', target: JSON.stringify(markup), ip });
        send(res, 200, { markup });
      } else if (method === 'PATCH' && path === '/api/admin/fx') {
        const body = await readJson(req);
        const usdTry = Number(body.usdTry);
        const eurTry = Number(body.eurTry);
        const tryKzt = Number(body.tryKzt);
        const tryRub = Number(body.tryRub);
        if (![usdTry, eurTry, tryKzt, tryRub].every((v) => Number.isFinite(v) && v > 0 && v < 10_000)) {
          fail(400, 'Geçerli pozitif döviz kuru değerleri girin.');
        }
        const entry = {
          rates: { TRY: 1, USD: 1 / usdTry, EUR: 1 / eurTry, KZT: tryKzt, RUB: tryRub },
          updatedAt: new Date().toISOString(),
        };
        db.prepare(`
          INSERT INTO settings (key, value) VALUES ('fx_override', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(JSON.stringify(entry));
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:fx_override', target: `USD=${usdTry},EUR=${eurTry},KZT=${tryKzt},RUB=${tryRub}`, ip });
        send(res, 200, { ...entry, manual: true });
      } else if (method === 'DELETE' && path === '/api/admin/fx') {
        db.prepare("DELETE FROM settings WHERE key = 'fx_override'").run();
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:fx_reset', target: 'live', ip });
        send(res, 200, await readFxRates(true));
      } else if (method === 'GET' && path === '/api/admin/users') {
        const rows = db.prepare('SELECT id, email, role, profile, status, organization_id, permissions FROM users ORDER BY rowid DESC').all();
        send(res, 200, { users: rows.map(accountProfile) });
      } else if (method === 'POST' && /^\/api\/admin\/users\/[a-f0-9]{32}\/approve$/.test(path)) {
        const targetId = path.split('/')[4];
        const targetRow = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
        if (!targetRow) fail(404, 'Kullanıcı bulunamadı.');
        const body = await readJson(req);
        const password = checkPassword(body.password, 12);
        const permissions = cleanPermissions(body.permissions);
        let orgId = body.organizationId ? text(body.organizationId, 64) : null;
        if (!orgId) {
          const prof = JSON.parse(targetRow.profile || '{}');
          const orgName = text(body.organizationName || prof.companyName || `${prof.firstName || 'Kurumsal'} Acente`, 120);
          orgId = randomBytes(12).toString('hex');
          db.prepare(`
            INSERT INTO organizations (id, name, type, status, credit_limit, allowed_modules, created_at)
            VALUES (?, ?, ?, 'active', ?, ?, ?)
          `).run(orgId, orgName, 'Kurumsal B2B', 0, JSON.stringify(['flights', 'hotels', 'transfers']), Date.now());
        }
        await setAccountPassword(db, targetId, password);
        const row = db.prepare(`
          UPDATE users SET status = 'active', organization_id = ?, permissions = ?
          WHERE id = ? RETURNING id, email, role, profile, status, organization_id, permissions
        `).get(orgId, JSON.stringify(permissions), targetId);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:user_approve', target: `${row.email}:${permissions.join(',')}`, ip });
        const approvedProfile = accountProfile(row);
        void sendCorporateApprovedEmail({
          to: approvedProfile.email,
          firstName: approvedProfile.firstName,
          companyName: approvedProfile.companyName,
          password,
          loginUrl: origin ? `${origin.origin}/yonetim` : 'https://flytoaspan.com/yonetim',
        });
        send(res, 200, { user: approvedProfile });
      } else if (method === 'PATCH' && /^\/api\/admin\/users\/[a-f0-9]{32}\/permissions$/.test(path)) {
        const targetId = path.split('/')[4];
        const body = await readJson(req);
        const permissions = cleanPermissions(body.permissions);
        const orgId = body.organizationId === undefined ? undefined : (body.organizationId || null);
        const row = orgId === undefined
          ? db.prepare('UPDATE users SET permissions = ? WHERE id = ? RETURNING id, email, role, profile, status, organization_id, permissions').get(JSON.stringify(permissions), targetId)
          : db.prepare('UPDATE users SET permissions = ?, organization_id = ? WHERE id = ? RETURNING id, email, role, profile, status, organization_id, permissions').get(JSON.stringify(permissions), orgId, targetId);
        if (!row) fail(404, 'Kullanıcı bulunamadı.');
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:user_permissions', target: `${row.email}:${permissions.join(',')}`, ip });
        send(res, 200, { user: accountProfile(row) });
      } else if (method === 'PATCH' && /^\/api\/admin\/users\/[a-f0-9]{32}\/status$/.test(path)) {
        const targetId = path.split('/')[4];
        if (targetId === user.id) fail(400, 'Kendi hesabınızı askıya alamazsınız.');
        const { status } = await readJson(req);
        if (status !== 'active' && status !== 'suspended') fail(400, 'Geçersiz hesap durumu.');
        const row = db.prepare('UPDATE users SET status = ? WHERE id = ? RETURNING id, email, role, profile, status, organization_id, permissions').get(status, targetId);
        if (!row) fail(404, 'Kullanıcı bulunamadı.');
        if (status === 'suspended') {
          db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
        }
        writeAuditLog(db, { actorEmail: user.email, action: `admin:user_${status}`, target: row.email, ip });
        send(res, 200, { user: accountProfile(row) });
      } else if (method === 'GET' && path === '/api/admin/organizations') {
        const rows = db.prepare('SELECT * FROM organizations ORDER BY created_at DESC').all();
        send(res, 200, { organizations: rows.map(organizationRecord) });
      } else if (method === 'POST' && path === '/api/admin/organizations') {
        const body = await readJson(req);
        const id = randomBytes(12).toString('hex');
        const name = text(body.name, 120);
        const type = text(body.type || 'B2B Alt Acente', 48);
        const creditLimit = Math.max(0, Math.min(100_000_000, Math.round(Number(body.creditLimitTRY) || 0)));
        const modules = cleanModules(body.allowedModules);
        db.prepare(`
          INSERT INTO organizations (id, name, type, status, credit_limit, allowed_modules, created_at)
          VALUES (?, ?, ?, 'active', ?, ?, ?)
        `).run(id, name, type, creditLimit, JSON.stringify(modules), Date.now());
        const row = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:org_create', target: name, ip });
        send(res, 201, { organization: organizationRecord(row) });
      } else if (method === 'PATCH' && /^\/api\/admin\/organizations\/[a-f0-9]{24}$/.test(path)) {
        const orgId = path.split('/')[4];
        const existing = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
        if (!existing) fail(404, 'Şirket bulunamadı.');
        const body = await readJson(req);
        const nextStatus = body.status === 'suspended' ? 'suspended' : body.status === 'active' ? 'active' : existing.status;
        const nextCredit = body.creditLimitTRY !== undefined
          ? Math.max(0, Math.min(100_000_000, Math.round(Number(body.creditLimitTRY) || 0)))
          : existing.credit_limit;
        const nextModules = body.allowedModules ? JSON.stringify(cleanModules(body.allowedModules)) : existing.allowed_modules;
        const nextDiscount = body.discountPercent !== undefined
          ? Math.max(0, Math.min(25, Math.round(Number(body.discountPercent) || 0)))
          : (existing.discount_percent || 0);
        const row = db.prepare(`
          UPDATE organizations SET status = ?, credit_limit = ?, allowed_modules = ?, discount_percent = ?
          WHERE id = ? RETURNING *
        `).get(nextStatus, nextCredit, nextModules, nextDiscount, orgId);
        if (nextStatus === 'suspended') {
          db.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?)').run(orgId);
        }
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:org_update', target: `${row.name}:${nextStatus}`, ip });
        send(res, 200, { organization: organizationRecord(row) });
      } else if (method === 'GET' && /^\/api\/admin\/organizations\/[a-f0-9]{24}\/ledger$/.test(path)) {
        const orgId = path.split('/')[4];
        const rows = db.prepare('SELECT * FROM org_ledger WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100').all(orgId);
        send(res, 200, { entries: rows.map(orgLedgerRecord) });
      } else if (method === 'POST' && /^\/api\/admin\/organizations\/[a-f0-9]{24}\/payment$/.test(path)) {
        const orgId = path.split('/')[4];
        const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
        if (!org) fail(404, 'Şirket bulunamadı.');
        const body = await readJson(req);
        const amount = Math.round(Number(body.amount));
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) fail(400, 'Geçerli bir tahsilat tutarı girin.');
        const description = text(body.description || 'Cari Hesap Tahsilatı', 160);
        db.prepare('UPDATE organizations SET used_credit = MAX(0, used_credit - ?) WHERE id = ?').run(amount, orgId);
        const entryId = randomBytes(12).toString('hex');
        db.prepare(`
          INSERT INTO org_ledger (id, organization_id, type, amount, description, pnr, created_by, created_at)
          VALUES (?, ?, 'credit', ?, ?, '', ?, ?)
        `).run(entryId, orgId, amount, description, user.email, Date.now());
        const updatedOrg = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
        const entryRow = db.prepare('SELECT * FROM org_ledger WHERE id = ?').get(entryId);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:org_payment', target: `${org.name}:${amount}`, ip });
        send(res, 201, { organization: organizationRecord(updatedOrg), entry: orgLedgerRecord(entryRow) });
      } else if (method === 'DELETE' && /^\/api\/admin\/organizations\/[a-f0-9]{24}$/.test(path)) {
        const orgId = path.split('/')[4];
        const existing = db.prepare('SELECT name FROM organizations WHERE id = ?').get(orgId);
        if (!existing) fail(404, 'Şirket bulunamadı.');
        db.prepare('DELETE FROM organizations WHERE id = ?').run(orgId);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:org_delete', target: existing.name, ip });
        send(res, 200, { ok: true });
      } else if (method === 'PATCH' && /^\/api\/admin\/users\/[a-f0-9]{32}\/role$/.test(path)) {
        const targetId = path.split('/')[4];
        if (targetId === user.id) fail(400, 'Kendi yönetici yetkinizi değiştiremezsiniz.');
        const { role } = await readJson(req);
        if (role !== 'member' && role !== 'admin') fail(400, 'Geçersiz kullanıcı rolü.');
        const row = db.prepare('UPDATE users SET role = ? WHERE id = ? RETURNING id, email, role, profile, status, organization_id, permissions').get(role, targetId);
        if (!row) fail(404, 'Kullanıcı bulunamadı.');
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:user_role', target: `${row.email}:${role}`, ip });
        send(res, 200, { user: accountProfile(row) });
      } else if (method === 'DELETE' && /^\/api\/admin\/users\/[a-f0-9]{32}$/.test(path)) {
        const targetId = path.split('/')[4];
        if (targetId === user.id) fail(400, 'Kendi hesabınızı silemezsiniz.');
        const row = db.prepare('SELECT email FROM users WHERE id = ?').get(targetId);
        if (!row) fail(404, 'Kullanıcı bulunamadı.');
        db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:user_delete', target: row.email, ip });
        send(res, 200, { ok: true });
      } else if (method === 'GET' && path === '/api/admin/finance') {
        const rows = db.prepare('SELECT * FROM finance_entries ORDER BY entry_date DESC, created_at DESC LIMIT 200').all();
        send(res, 200, { entries: rows.map(financeEntryRecord) });
      } else if (method === 'POST' && path === '/api/admin/finance') {
        const body = await readJson(req);
        const type = body.type === 'income' ? 'income' : body.type === 'expense' ? 'expense' : null;
        if (!type) fail(400, 'Kayıt türü gelir veya gider olmalıdır.');
        const category = text(body.category || 'Diğer', 48);
        const title = text(body.title, 140);
        const amount = Math.round(Number(body.amount));
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) fail(400, 'Geçerli bir tutar girin.');
        const entryDate = typeof body.entryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.entryDate)
          ? body.entryDate
          : new Date().toISOString().slice(0, 10);
        const id = randomBytes(12).toString('hex');
        db.prepare(`
          INSERT INTO finance_entries (id, type, category, title, amount, entry_date, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, type, category, title, amount, entryDate, user.email, Date.now());
        const row = db.prepare('SELECT * FROM finance_entries WHERE id = ?').get(id);
        writeAuditLog(db, { actorEmail: user.email, action: `admin:finance_${type}`, target: `${title}:${amount}`, ip });
        send(res, 201, { entry: financeEntryRecord(row) });
      } else if (method === 'DELETE' && /^\/api\/admin\/finance\/[a-f0-9]{24}$/.test(path)) {
        const id = path.split('/').at(-1);
        const existing = db.prepare('SELECT title FROM finance_entries WHERE id = ?').get(id);
        if (!existing) fail(404, 'Finans kaydı bulunamadı.');
        db.prepare('DELETE FROM finance_entries WHERE id = ?').run(id);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:finance_delete', target: existing.title, ip });
        send(res, 200, { ok: true });
      } else if (method === 'GET' && path === '/api/admin/crm/tasks') {
        const rows = db.prepare('SELECT * FROM crm_tasks ORDER BY status ASC, due_date ASC, created_at DESC LIMIT 200').all();
        send(res, 200, { tasks: rows.map(crmTaskRecord) });
      } else if (method === 'POST' && path === '/api/admin/crm/tasks') {
        const body = await readJson(req);
        const title = text(body.title, 160);
        const customerName = typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 100) : '';
        const pnr = typeof body.pnr === 'string' ? body.pnr.trim().toUpperCase().slice(0, 12) : '';
        const dueDate = typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)
          ? body.dueDate
          : new Date().toISOString().slice(0, 10);
        const priority = ['high', 'normal', 'low'].includes(body.priority) ? body.priority : 'normal';
        const assignedTo = typeof body.assignedTo === 'string' && body.assignedTo.trim()
          ? body.assignedTo.trim().slice(0, 100)
          : user.email;
        const id = randomBytes(12).toString('hex');
        db.prepare(`
          INSERT INTO crm_tasks (id, title, customer_name, pnr, due_date, priority, status, assigned_to, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)
        `).run(id, title, customerName, pnr, dueDate, priority, assignedTo, Date.now());
        const row = db.prepare('SELECT * FROM crm_tasks WHERE id = ?').get(id);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:crm_task_create', target: title, ip });
        send(res, 201, { task: crmTaskRecord(row) });
      } else if (method === 'PATCH' && /^\/api\/admin\/crm\/tasks\/[a-f0-9]{24}$/.test(path)) {
        const id = path.split('/').at(-1);
        const body = await readJson(req);
        const status = body.status === 'done' ? 'done' : 'open';
        const row = db.prepare('UPDATE crm_tasks SET status = ? WHERE id = ? RETURNING *').get(status, id);
        if (!row) fail(404, 'CRM görevi bulunamadı.');
        send(res, 200, { task: crmTaskRecord(row) });
      } else if (method === 'DELETE' && /^\/api\/admin\/crm\/tasks\/[a-f0-9]{24}$/.test(path)) {
        const id = path.split('/').at(-1);
        const existing = db.prepare('SELECT title FROM crm_tasks WHERE id = ?').get(id);
        if (!existing) fail(404, 'CRM görevi bulunamadı.');
        db.prepare('DELETE FROM crm_tasks WHERE id = ?').run(id);
        send(res, 200, { ok: true });
      } else if (method === 'GET' && path === '/api/admin/crm/quotes') {
        const rows = db.prepare('SELECT * FROM crm_quotes ORDER BY created_at DESC LIMIT 200').all();
        send(res, 200, { quotes: rows.map(crmQuoteRecord) });
      } else if (method === 'POST' && path === '/api/admin/crm/quotes') {
        const body = await readJson(req);
        const customerName = text(body.customerName, 120, 2);
        const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim().slice(0, 32) : '';
        const type = ['Uçak', 'Otel', 'Transfer', 'Tur'].includes(body.type) ? body.type : 'Uçak';
        const title = text(body.title, 160, 2);
        const details = typeof body.details === 'string' ? body.details.trim().slice(0, 240) : '';
        const travelDate = typeof body.travelDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.travelDate)
          ? body.travelDate
          : new Date().toISOString().slice(0, 10);
        const price = Math.round(Number(body.price));
        if (!Number.isFinite(price) || price <= 0 || price > 50_000_000) fail(400, 'Geçerli bir teklif tutarı girin.');
        const id = randomBytes(12).toString('hex');
        const quoteNo = `TKF-${randomBytes(3).toString('hex').toUpperCase()}`;
        db.prepare(`
          INSERT INTO crm_quotes (id, quote_no, customer_name, customer_phone, type, title, details, travel_date, price, status, converted_pnr, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Taslak', '', ?, ?)
        `).run(id, quoteNo, customerName, customerPhone, type, title, details, travelDate, price, user.email, Date.now());
        const row = db.prepare('SELECT * FROM crm_quotes WHERE id = ?').get(id);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:quote_create', target: `${quoteNo}:${customerName}`, ip });
        send(res, 201, { quote: crmQuoteRecord(row) });
      } else if (method === 'PATCH' && /^\/api\/admin\/crm\/quotes\/[a-f0-9]{24}$/.test(path)) {
        const id = path.split('/').at(-1);
        const body = await readJson(req);
        const validQuoteStatuses = ['Taslak', 'Gönderildi', 'Onaylandı', 'Kaybedildi'];
        if (!validQuoteStatuses.includes(body.status)) fail(400, 'Geçersiz teklif durumu.');
        const row = db.prepare('UPDATE crm_quotes SET status = ? WHERE id = ? RETURNING *').get(body.status, id);
        if (!row) fail(404, 'Teklif bulunamadı.');
        send(res, 200, { quote: crmQuoteRecord(row) });
      } else if (method === 'POST' && /^\/api\/admin\/crm\/quotes\/[a-f0-9]{24}\/convert$/.test(path)) {
        const id = path.split('/')[5];
        const qRow = db.prepare('SELECT * FROM crm_quotes WHERE id = ?').get(id);
        if (!qRow) fail(404, 'Teklif bulunamadı.');
        if (qRow.converted_pnr) fail(409, `Bu teklif zaten satışa dönüştürülmüş (PNR: ${qRow.converted_pnr}).`);
        const surname = qRow.customer_name.trim().split(/\s+/).at(-1) || qRow.customer_name;
        const booking = newDemoBooking(db, {
          type: qRow.type,
          title: qRow.title,
          subtitle: qRow.details || `Teklif No: ${qRow.quote_no}`,
          date: qRow.travel_date,
          passenger: qRow.customer_name,
          lookupSurname: surname,
          price: qRow.price,
        }, user);
        const updatedQuote = db.prepare(`
          UPDATE crm_quotes SET status = 'Onaylandı', converted_pnr = ? WHERE id = ? RETURNING *
        `).get(booking.pnr, id);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:quote_convert', target: `${qRow.quote_no}->${booking.pnr}`, ip });
        send(res, 201, { quote: crmQuoteRecord(updatedQuote), booking });
      } else if (method === 'DELETE' && /^\/api\/admin\/crm\/quotes\/[a-f0-9]{24}$/.test(path)) {
        const id = path.split('/').at(-1);
        db.prepare('DELETE FROM crm_quotes WHERE id = ?').run(id);
        send(res, 200, { ok: true });
      } else if (method === 'GET' && path === '/api/admin/server-info') {
        let outboundIp = process.env.FLYTOASPAN_PUBLIC_IP || '';
        if (!outboundIp) {
          try {
            const ctrl = new AbortController();
            const tmr = setTimeout(() => ctrl.abort(), 2500);
            const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
            clearTimeout(tmr);
            if (r.ok) {
              const d = await r.json();
              if (typeof d?.ip === 'string') outboundIp = d.ip;
            }
          } catch { /* fallback below */ }
        }
        send(res, 200, {
          outboundIp: outboundIp || 'Sunucu IP (Render Outbound IP listesini kontrol edin)',
          host: req.headers.host || 'flytoaspan.onrender.com',
          protocol: 'HTTPS / TLS 1.3',
        });
      } else if (method === 'POST' && path === '/api/admin/providers/test') {
        const body = await readJson(req);
        const rawUrl = text(body.url, 240, 8);
        let parsed;
        try { parsed = new URL(rawUrl); } catch { fail(400, 'Geçerli bir HTTPS adresi girin.'); }
        if (parsed.protocol !== 'https:') fail(400, 'Güvenlik gereği yalnızca HTTPS adresleri test edilebilir.');
        const hostLower = parsed.hostname.toLowerCase();
        if (
          hostLower === 'localhost' ||
          hostLower.endsWith('.local') ||
          /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^\[?::1\]?/.test(hostLower)
        ) {
          fail(400, 'Yerel veya özel ağ adresleri test edilemez.');
        }
        const started = Date.now();
        try {
          const ctrl = new AbortController();
          const tmr = setTimeout(() => ctrl.abort(), 4000);
          const probe = await fetch(parsed.toString(), { method: 'HEAD', redirect: 'manual', signal: ctrl.signal });
          clearTimeout(tmr);
          const latencyMs = Date.now() - started;
          send(res, 200, {
            ok: probe.status < 500,
            status: probe.status,
            latencyMs,
            message: `Sunucu yanıt verdi (HTTP ${probe.status} · ${latencyMs} ms).`,
          });
        } catch (err) {
          const latencyMs = Date.now() - started;
          send(res, 200, {
            ok: false,
            status: 0,
            latencyMs,
            message: err?.name === 'AbortError'
              ? 'Zaman aşımı (4 sn) — sunucu IP Whitelist veya VPN istiyor olabilir.'
              : 'Bağlantı kurulamadı — URL veya IP Whitelist ayarını kontrol edin.',
          });
        }
      } else if (method === 'GET' && path === '/api/admin/audit') {
        const rows = db.prepare('SELECT id, actor_email, action, target, ip, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 150').all();
        send(res, 200, { logs: rows });
      } else {
        fail(404, 'İşlem bulunamadı.');
      }
    } catch (error) {
      if (!(error instanceof RequestError)) {
        console.error('API error:', method, path, error.name, error.code ?? '');
      }
      if (!res.headersSent && !res.destroyed) {
        send(res, error.status ?? 500, { message: error instanceof RequestError ? error.message : 'Sunucu işlemi tamamlayamadı.' });
      }
    }
    return true;
  };
}
