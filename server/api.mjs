import { createHash, randomBytes } from 'node:crypto';
import {
  accountProfile,
  bookingRecord,
  createAccount,
  crmQuoteRecord,
  crmTaskRecord,
  deriveLifecycleStates,
  encryptBookingDetails,
  encryptQuoteMetadata,
  financeEntryRecord,
  openDatabase,
  orgLedgerRecord,
  organizationRecord,
  priceAlertRecord,
  recordAnalyticsEvent,
  savedPassengerRecord,
  setAccountPassword,
  verifyPassword,
  writeAuditLog,
} from './store.mjs';
import {
  buildOtpAuthUri,
  encryptPii,
  generateTotpSecret,
  verifyTotpCode,
} from './crypto.mjs';
import {
  DEFAULT_MARKUP,
  verifyAndComputeBookingPrice,
} from './pricing.mjs';
import {
  sendBoardingPassEmail,
  sendBookingConfirmationEmail,
  sendCorporateApprovedEmail,
  sendPasswordResetEmail,
} from './mailer.mjs';
import { readXmlShowcaseStatus, runXmlShowcaseSync } from './xml-showcase.mjs';

const VALID_PERMISSIONS = new Set([
  'flights.sell',
  'hotels.sell',
  'transfers.sell',
  'tours.sell',
  'bookings.view_own',
  'bookings.view_org',
  'bookings.view_all',
  'bookings.cancel_request',
  'bookings.manage',
  'refunds.process',
  'finance.view',
  'finance.manage',
  'analytics.view',
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
  hotels: { country: 'optional:60', city: 60, name: 120, stars: 'integer', boardType: 60, nights: 'integer', price: 'integer', image: 'optional:280', provider: 'optional:80', active: 'boolean' },
  transfers: { city: 60, vehicle: 120, route: 140, capacity: 48, baggage: 48, price: 'integer', image: 'optional:280', active: 'boolean' },
  tours: { country: 'optional:60', city: 60, title: 140, duration: 48, includes: 'optional:240', quota: 'integer', price: 'integer', image: 'optional:280', provider: 'optional:80', active: 'boolean' },
  deals: {
    fromCity: 60, fromCode: 8, toCity: 60, toCode: 8,
    region: 24, date: 16, price: 'integer',
    image: 'optional:280', featured: 'boolean', active: 'boolean',
  },
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

async function readJson(req, maxBytes = 16_384) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) fail(415, 'JSON içerik bekleniyor.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) {
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

function publicBookingSummary(rec) {
  const safeBoardingPass = rec.boardingPass
    ? {
        seat: rec.boardingPass.seat,
        passengerSeats: rec.boardingPass.passengerSeats,
        airlinePnr: rec.boardingPass.airlinePnr,
        eticketNo: rec.boardingPass.eticketNo,
        terminal: rec.boardingPass.terminal,
        gate: rec.boardingPass.gate,
        boardingTime: rec.boardingPass.boardingTime,
        gateCloseTime: rec.boardingPass.gateCloseTime,
        boardingGroup: rec.boardingPass.boardingGroup,
        sequenceNo: rec.boardingPass.sequenceNo,
        baggageDropNote: rec.boardingPass.baggageDropNote,
        mobilePassUrl: rec.boardingPass.mobilePassUrl,
        officialQrDataUrl: rec.boardingPass.officialQrDataUrl,
        officialPassDataUrl: rec.boardingPass.officialPassDataUrl,
        officialPassFileName: rec.boardingPass.officialPassFileName,
        officialPassMime: rec.boardingPass.officialPassMime,
        bcbpString: rec.boardingPass.bcbpString,
      }
    : undefined;
  return {
    id: rec.id,
    pnr: rec.pnr,
    status: rec.status,
    paymentStatus: rec.paymentStatus,
    ticketingStatus: rec.ticketingStatus,
    refundStatus: rec.refundStatus,
    type: rec.type,
    title: rec.title,
    subtitle: rec.subtitle,
    date: rec.date,
    returnDate: rec.returnDate,
    passenger: rec.passenger,
    legs: rec.legs,
    price: rec.price,
    demo: rec.demo,
    departTime: rec.departTime,
    arriveTime: rec.arriveTime,
    flightNumber: rec.flightNumber,
    airline: rec.airline,
    baggage: rec.baggage,
    cabin: rec.cabin,
    duration: rec.duration,
    autoCheckin: rec.autoCheckin,
    checkinStatus: rec.checkinStatus,
    assignedSeat: rec.assignedSeat,
    boardingPass: safeBoardingPass,
    createdAt: rec.createdAt,
  };
}

function canViewFullBooking(user, row) {
  if (!user || (user.status && user.status !== 'active')) return false;
  if (user.role === 'admin') return true;
  if (hasPerm(user, 'bookings.view_all')) return true;
  if (row.owner_id === user.id || row.sold_by_user_id === user.id) return true;
  if (hasPerm(user, 'bookings.view_org') && user.organization_id && row.organization_id === user.organization_id) return true;
  return false;
}

function newDemoBooking(db, body, owner, { isAdminManual = false, computedPricing = null } = {}) {
  const type = text(body.type, 10);
  if (!['Uçak', 'Otel', 'Transfer', 'Tur'].includes(type)) fail(400, 'Rezervasyon türü geçersiz.');
  const surname = normalizeSurname(body.lookupSurname);
  const date = isoDate(body.date);
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!isAdminManual && date < todayIso) fail(400, 'Geçmiş tarihli rezervasyon oluşturulamaz.');
  const returnDate = body.returnDate ? isoDate(body.returnDate) : undefined;
  if (returnDate && returnDate < date) fail(400, 'Dönüş tarihi başlangıç tarihinden önce olamaz.');
  const effectivePrice = computedPricing?.price ?? body.price;
  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0 || effectivePrice > 10_000_000) fail(400, 'Tutar geçersiz.');
  const salePrice = Math.round(effectivePrice * 100) / 100;
  const rawNetCost = computedPricing?.netCostTRY !== undefined ? computedPricing.netCostTRY : Number(body.netCostTRY);
  const netCostTRY = Number.isFinite(rawNetCost) && rawNetCost >= 0 && rawNetCost <= 10_000_000
    ? Math.round(rawNetCost * 100) / 100
    : undefined;
  const rawProfit = computedPricing?.profitTRY !== undefined ? computedPricing.profitTRY : Number(body.profitTRY);
  const profitTRY = Number.isFinite(rawProfit) && rawProfit >= -10_000_000 && rawProfit <= 10_000_000
    ? Math.round(rawProfit * 100) / 100
    : (netCostTRY !== undefined ? Math.round((salePrice - netCostTRY) * 100) / 100 : undefined);
  const passengersDetail = Array.isArray(body.passengersDetail)
    ? body.passengersDetail.slice(0, 12).map((p) => {
        const docType = p?.documentType === 'pasaport' ? 'pasaport' : p?.documentType === 'kimlik' ? 'kimlik' : undefined;
        const issueDate = typeof p?.passportIssueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.passportIssueDate.trim())
          ? p.passportIssueDate.trim()
          : undefined;
        const expiryDate = typeof p?.passportExpiryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.passportExpiryDate.trim())
          ? p.passportExpiryDate.trim()
          : undefined;
        if (expiryDate && expiryDate < date) {
          fail(400, 'Pasaport geçerlilik bitiş tarihi seyahat tarihinden önce olamaz.');
        }
        if (issueDate && expiryDate && expiryDate <= issueDate) {
          fail(400, 'Pasaport bitiş tarihi başlangıç tarihinden sonra olmalıdır.');
        }
        return {
          fullName: typeof p?.fullName === 'string' ? p.fullName.trim().slice(0, 120) : '',
          documentType: docType,
          tcOrPassport: typeof p?.tcOrPassport === 'string' ? p.tcOrPassport.trim().slice(0, 32) : undefined,
          nationality: typeof p?.nationality === 'string' ? p.nationality.trim().slice(0, 48) : undefined,
          passportCountry: typeof p?.passportCountry === 'string' ? p.passportCountry.trim().slice(0, 48) : undefined,
          passportIssueDate: issueDate,
          passportExpiryDate: expiryDate,
          passportIssuer: typeof p?.passportIssuer === 'string' ? p.passportIssuer.trim().slice(0, 64) : undefined,
          birthDate: typeof p?.birthDate === 'string' ? p.birthDate.trim().slice(0, 16) : undefined,
          gender: typeof p?.gender === 'string' ? p.gender.trim().slice(0, 12) : undefined,
          paxType: typeof p?.paxType === 'string' ? p.paxType.trim().slice(0, 32) : undefined,
        };
      }).filter((p) => p.fullName)
    : undefined;
  const legs = Array.isArray(body.legs)
    ? body.legs.slice(0, 4).map((l) => ({
        direction: l?.direction === 'Dönüş' ? 'Dönüş' : 'Gidiş',
        fromCode: typeof l?.fromCode === 'string' ? l.fromCode.trim().toUpperCase().slice(0, 8) : '',
        toCode: typeof l?.toCode === 'string' ? l.toCode.trim().toUpperCase().slice(0, 8) : '',
        date: typeof l?.date === 'string' ? l.date.trim().slice(0, 16) : date,
        departTime: typeof l?.departTime === 'string' ? l.departTime.trim().slice(0, 10) : '',
        arriveTime: typeof l?.arriveTime === 'string' ? l.arriveTime.trim().slice(0, 10) : '',
        flightNumber: typeof l?.flightNumber === 'string' ? l.flightNumber.trim().slice(0, 24) : '',
        airline: typeof l?.airline === 'string' ? l.airline.trim().slice(0, 60) : '',
        baggage: typeof l?.baggage === 'string' ? l.baggage.trim().slice(0, 60) : undefined,
        cabin: typeof l?.cabin === 'string' ? l.cabin.trim().slice(0, 32) : undefined,
        duration: typeof l?.duration === 'string' ? l.duration.trim().slice(0, 24) : undefined,
      })).filter((l) => l.fromCode || l.flightNumber)
    : undefined;
  const isCharterFlight =
    type === 'Uçak' &&
    (Boolean(body.isCharter) ||
      /\b(charter|blok koltuk|block seat|samo|kompas|fun&sun|funsun|selfie travel|corendon|freebird|scat|sunday airlines|southwind)\b/i.test(
        `${body.airline || ''} ${body.providerSource || ''} ${body.subtitle || ''}`
      ));

  if (isCharterFlight && passengersDetail && passengersDetail.length > 0) {
    for (const p of passengersDetail) {
      if (p.documentType !== 'pasaport') {
        fail(400, 'Charter uçuşlarda belge tipi olarak Pasaport zorunludur.');
      }
      if (!p.tcOrPassport || p.tcOrPassport.length < 5) {
        fail(400, 'Charter uçuşlarda geçerli Pasaport Numarası girilmesi zorunludur.');
      }
      if (!p.birthDate) {
        fail(400, 'Charter uçuşlarda yolcu doğum tarihi zorunludur.');
      }
      if (!p.passportIssueDate || !p.passportExpiryDate) {
        fail(400, 'Charter uçuşlarda pasaport başlangıç (veriliş) ve bitiş (geçerlilik) tarihi zorunludur.');
      }
      if (!/^[A-Za-z\s'-]+$/.test(p.fullName)) {
        fail(400, 'Charter uçuşlarda yolcu adı ve soyadı pasaporttaki gibi sadece Latin harflerle (A–Z) yazılmalıdır.');
      }
    }
  }

  const autoCheckin = Boolean(body.autoCheckin);
  const rawAutoCheckinFee = Number(body.autoCheckinFeeTRY);
  const autoCheckinFeeTRY = autoCheckin
    ? (Number.isFinite(rawAutoCheckinFee) && rawAutoCheckinFee >= 0 && rawAutoCheckinFee <= 50_000
        ? Math.round(rawAutoCheckinFee)
        : 250)
    : undefined;

  const details = {
    type, date, returnDate,
    title: text(body.title, 160),
    subtitle: text(body.subtitle, 320),
    passenger: text(body.passenger, 150, 2),
    passengersDetail: passengersDetail && passengersDetail.length > 0 ? passengersDetail : undefined,
    legs: legs && legs.length > 0 ? legs : undefined,
    contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail.trim().slice(0, 120) : undefined,
    contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim().slice(0, 40) : undefined,
    providerSource: typeof body.providerSource === 'string' && body.providerSource.trim() ? body.providerSource.trim().slice(0, 80) : undefined,
    netCostTRY,
    profitTRY,
    couponCode: computedPricing?.couponCode || (typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase().slice(0, 32) || undefined : undefined),
    discountTRY: computedPricing?.discountTRY || undefined,
    appliedPricingRule: computedPricing?.appliedRule || undefined,
    price: salePrice,
    departTime: typeof body.departTime === 'string' ? body.departTime.trim().slice(0, 10) : undefined,
    arriveTime: typeof body.arriveTime === 'string' ? body.arriveTime.trim().slice(0, 10) : undefined,
    flightNumber: typeof body.flightNumber === 'string' ? body.flightNumber.trim().slice(0, 24) : undefined,
    airline: typeof body.airline === 'string' ? body.airline.trim().slice(0, 60) : undefined,
    baggage: typeof body.baggage === 'string' ? body.baggage.trim().slice(0, 60) : undefined,
    cabin: typeof body.cabin === 'string' ? body.cabin.trim().slice(0, 32) : undefined,
    duration: typeof body.duration === 'string' ? body.duration.trim().slice(0, 24) : undefined,
    autoCheckin: autoCheckin || undefined,
    autoCheckinFeeTRY,
    checkinStatus: autoCheckin ? 'pending' : undefined,
    paymentStatus: 'demo_unpaid',
    ticketingStatus: 'demo_not_ticketed',
    refundStatus: 'none',
    demo: true,
  };
  const storedDetails = encryptBookingDetails(details, db._piiKey);
  const id = randomBytes(16).toString('hex');
  const status = 'Onaylandı';
  let pnr = generateIataPnr();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      db.prepare(`
        INSERT INTO bookings (id, pnr, owner_id, surname, status, details, created_at, organization_id, sold_by_user_id, revision)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        id, pnr, owner?.id ?? null, surname, status, JSON.stringify(storedDetails), Date.now(),
        owner?.organization_id ?? null, owner?.id ?? null
      );
      return { ...details, id, pnr, status, revision: 1, organizationId: owner?.organization_id ?? null, soldByUserId: owner?.id ?? null };
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
    const isTestIpBucket = process.env.NODE_ENV === 'test' && (key.startsWith('login:') || key.startsWith('register:'));
    const effectiveMax = isTestIpBucket ? max * 5 : max;
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
    } else if (++bucket.count > effectiveMax) {
      recordAnalyticsEvent(db, { eventType: 'rate_limited', page: key.split(':')[0], metadata: { keyPrefix: key.split(':')[0] } });
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

  const enrichAccountProfile = (account) => {
    const profile = accountProfile(account);
    if (account?.organization_id) {
      const org = db.prepare('SELECT discount_percent FROM organizations WHERE id = ?').get(account.organization_id);
      profile.organizationDiscountPercent = Number(org?.discount_percent || 0);
    } else {
      profile.organizationDiscountPercent = 0;
    }
    return profile;
  };

  const stripHouseMargin = (rec, currentUser) => {
    const canSeeMargins = Boolean(
      currentUser && (
        currentUser.role === 'admin' ||
        hasPerm(currentUser, 'finance.view') ||
        hasPerm(currentUser, 'finance.manage') ||
        hasPerm(currentUser, 'analytics.view')
      )
    );
    if (!canSeeMargins) {
      delete rec.netCostTRY;
      delete rec.profitTRY;
    }
    return rec;
  };

  const authenticate = (res, previousToken, account) => {
    const token = randomBytes(32).toString('base64url');
    clearSession(previousToken);
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      digest(token), account.id, Date.now() + sessionLifetime * 1000
    );
    setSessionCookie(res, token, sessionLifetime);
    return enrichAccountProfile(account);
  };

  const readMarkup = () => {
    const found = db.prepare("SELECT value FROM settings WHERE key = 'markup'").get();
    if (!found) return { ...DEFAULT_MARKUP };
    const parsed = JSON.parse(found.value);
    return { ...DEFAULT_MARKUP, ...parsed, revision: parsed.revision ?? 0 };
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
        const staffBookingRoute =
          path === '/api/admin/bookings' ||
          /^\/api\/admin\/bookings\/[a-f0-9]{32}(\/(history|notes))?$/.test(path);
        const staffCatalogRead = method === 'GET' && path === '/api/admin/catalog';
        const staffCatalogWrite = method === 'PUT' && /^\/api\/admin\/catalog\/(rules|coupons|agencies|hotels|transfers|tours|deals|operators|flights|providers)$/.test(path);
        const staffPricingRoute = path === '/api/admin/pricing' && hasPerm(user, 'pricing.edit');
        const staffFxRoute = path === '/api/admin/fx' && hasPerm(user, 'fx.manage');
        const staffApiRoute = (path === '/api/admin/server-info' || path === '/api/admin/providers/test') && hasPerm(user, 'apis.manage');
        const staffXmlShowcaseRoute =
          (path === '/api/admin/xml-showcase/status' || path === '/api/admin/xml-showcase/sync') &&
          (hasPerm(user, 'inventory.manage') || hasPerm(user, 'apis.manage'));
        const staffFinanceRead =
          method === 'GET' &&
          (path === '/api/admin/finance' || path === '/api/admin/crm/tasks' || path === '/api/admin/crm/quotes') &&
          (hasPerm(user, 'finance.view') || hasPerm(user, 'finance.manage') || hasPerm(user, 'analytics.view'));
        const staffFinanceWrite =
          (method === 'POST' || method === 'PATCH' || method === 'DELETE') &&
          (path === '/api/admin/finance' ||
            /^\/api\/admin\/finance\/[a-f0-9]{24}$/.test(path) ||
            /^\/api\/admin\/organizations\/[a-f0-9]{24}\/payment$/.test(path) ||
            path === '/api/admin/crm/tasks' ||
            /^\/api\/admin\/crm\/tasks\/[a-f0-9]{24}$/.test(path) ||
            path === '/api/admin/crm/quotes' ||
            /^\/api\/admin\/crm\/quotes\/[a-f0-9]{24}(\/convert)?$/.test(path)) &&
          hasPerm(user, 'finance.manage');
        const staffAnalyticsRoute =
          method === 'GET' &&
          (path === '/api/admin/analytics' || path === '/api/admin/audit') &&
          (hasPerm(user, 'analytics.view') || hasPerm(user, 'finance.view'));
        const staffAnalyticsUsersRead =
          method === 'GET' &&
          (path === '/api/admin/users' || path === '/api/admin/organizations') &&
          (hasPerm(user, 'analytics.view') || hasPerm(user, 'finance.view'));
        const staffTeamRoute =
          hasPerm(user, 'team.manage') &&
          (path === '/api/admin/users' ||
            /^\/api\/admin\/users\/[a-f0-9]{32}\/(approve|permissions|status)$/.test(path) ||
            path === '/api/admin/organizations' ||
            /^\/api\/admin\/organizations\/[a-f0-9]{24}(\/(ledger|payment))?$/.test(path));
        let allowedStaff = false;
        if (canAccessPanel(user)) {
          if (
            staffBookingRoute ||
            staffCatalogRead ||
            staffPricingRoute ||
            staffFxRoute ||
            staffApiRoute ||
            staffXmlShowcaseRoute ||
            staffFinanceRead ||
            staffFinanceWrite ||
            staffAnalyticsRoute ||
            staffAnalyticsUsersRead ||
            staffTeamRoute
          ) {
            allowedStaff = true;
          }
          if (staffCatalogWrite) {
            const sec = path.split('/')[4];
            if ((sec === 'hotels' || sec === 'transfers' || sec === 'tours' || sec === 'deals') && hasPerm(user, 'inventory.manage')) allowedStaff = true;
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
        send(res, 200, { passengers: rows.map((r) => savedPassengerRecord(r, db._piiKey)) });
      } else if (method === 'POST' && path === '/api/passengers') {
        if (!user) fail(401, 'Oturum açın.');
        const body = await readJson(req);
        const fullName = text(body.fullName, 120, 2);
        const tcOrPassportRaw = typeof body.tcOrPassport === 'string' ? body.tcOrPassport.trim().slice(0, 32) : '';
        const tcOrPassport = tcOrPassportRaw ? encryptPii(tcOrPassportRaw, db._piiKey) : '';
        const birthDate = typeof body.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate) ? body.birthDate : '';
        const gender = body.gender === 'F' ? 'F' : 'M';
        const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : '';
        const id = randomBytes(12).toString('hex');
        db.prepare(`
          INSERT INTO saved_passengers (id, user_id, full_name, tc_or_passport, birth_date, gender, phone, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, user.id, fullName, tcOrPassport, birthDate, gender, phone, Date.now());
        const row = db.prepare('SELECT * FROM saved_passengers WHERE id = ?').get(id);
        send(res, 201, { passenger: savedPassengerRecord(row, db._piiKey) });
      } else if (method === 'GET' && path === '/api/organization/me') {
        if (!user) fail(401, 'Oturum açın.');
        if (!user.organization_id) {
          send(res, 200, { organization: null, ledger: [], team: [] });
          return true;
        }
        const orgRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(user.organization_id);
        const ledgerRows = orgRow
          ? db.prepare('SELECT * FROM org_ledger WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50').all(orgRow.id)
          : [];
        const teamRows = orgRow
          ? db.prepare('SELECT id, email, role, role_label, profile, status, organization_id, permissions FROM users WHERE organization_id = ? ORDER BY rowid DESC').all(orgRow.id)
          : [];
        send(res, 200, {
          organization: orgRow ? organizationRecord(orgRow) : null,
          ledger: ledgerRows.map(orgLedgerRecord),
          team: teamRows.map((t) => ({
            id: t.id,
            email: t.email,
            name: `${JSON.parse(t.profile || '{}').firstName || ''} ${JSON.parse(t.profile || '{}').lastName || ''}`.trim(),
            status: t.status || 'active',
            roleLabel: t.role_label || '',
          })),
        });
      } else if (method === 'POST' && path === '/api/analytics/event') {
        throttle(`analytics:${ip}`, 180);
        const body = await readJson(req, 8192);
        const allowedEvents = new Set(['page_view', 'search', 'select', 'passenger_form', 'checkout_submit', 'checkout_error', 'booking_complete', 'client_error']);
        const eventType = String(body.eventType || '');
        if (!allowedEvents.has(eventType)) fail(400, 'Geçersiz analiz olayı.');
        const sessHash = createHash('sha256').update(`${ip}:${body.sessionId || 'anon'}`).digest('hex').slice(0, 24);
        recordAnalyticsEvent(db, {
          eventType,
          page: typeof body.page === 'string' ? body.page.slice(0, 120) : '',
          productType: typeof body.productType === 'string' ? body.productType.slice(0, 32) : '',
          sessionHash: sessHash,
          metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
        });
        send(res, 202, { ok: true });
      } else if (method === 'POST' && path === '/api/pricing/quote') {
        throttle(`quote:${ip}`, 180);
        const body = await readJson(req);
        const computed = verifyAndComputeBookingPrice(db, body, user, { isAdminManual: false });
        if (computed.rejected) fail(computed.status || 400, computed.message);
        const expiresAt = Date.now() + 15 * 60_000;
        send(res, 200, {
          price: computed.price,
          discountTRY: computed.discountTRY || 0,
          couponCode: computed.couponCode || null,
          appliedRule: computed.appliedRule || '',
          expiresAt,
        });
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
        send(res, 200, { user: user ? enrichAccountProfile(user) : null });
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
        recordAnalyticsEvent(db, {
          eventType: 'user_register',
          page: '/auth/register',
          metadata: { accountId: account.id, method: 'email_registration' },
        });
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
        if (!await verifyPassword(account, password)) {
          recordAnalyticsEvent(db, { eventType: 'auth_failure', page: '/auth/login', metadata: { reason: 'invalid_credentials' } });
          fail(401, 'E-posta veya parola hatalı.');
        }
        if (account.totp_enabled && account.totp_secret) {
          const totpCode = typeof body.totpCode === 'string' ? body.totpCode.trim() : '';
          if (!totpCode) {
            send(res, 401, { requires2fa: true, message: 'İki aşamalı doğrulama (2FA) kodu gerekli.' });
            return true;
          }
          if (!verifyTotpCode(account.totp_secret, totpCode)) {
            recordAnalyticsEvent(db, { eventType: 'auth_failure', page: '/auth/login', metadata: { reason: 'invalid_totp' } });
            fail(401, 'İki aşamalı doğrulama (2FA) kodu geçersiz veya süresi dolmuş.');
          }
        }
        buckets.delete(`login-account:${email}`);
        const agent = req.headers['user-agent'] || '';
        const device = /ipad|tablet|android(?!.*mobile)/i.test(agent) ? 'tablet'
          : /mobile|iphone|android/i.test(agent) ? 'mobile'
            : /windows|macintosh|linux/i.test(agent) ? 'desktop' : 'unknown';
        recordAnalyticsEvent(db, {
          eventType: 'user_login',
          page: '/auth/login',
          metadata: { accountId: account.id, role: account.role, method: account.totp_enabled ? 'password_2fa' : 'password', device },
        });
        send(res, 200, { user: authenticate(res, token, account) });
      } else if (method === 'POST' && path === '/api/auth/logout') {
        clearSession(token);
        setSessionCookie(res, '', 0);
        send(res, 200, { ok: true });
      } else if (method === 'POST' && path === '/api/auth/change-password') {
        if (!user) fail(401, 'Oturum açın.');
        const body = await readJson(req);
        const currentPassword = checkPassword(body.currentPassword, 1);
        const newPassword = checkPassword(body.newPassword, 12);
        if (!await verifyPassword(user, currentPassword)) fail(401, 'Mevcut parola hatalı.');
        await setAccountPassword(db, user.id, newPassword);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
        const refreshed = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        writeAuditLog(db, { actorEmail: user.email, action: 'auth:password_changed', target: user.email, ip });
        send(res, 200, { ok: true, user: authenticate(res, null, refreshed) });
      } else if (method === 'POST' && path === '/api/auth/2fa/setup') {
        if (!user || !canAccessPanel(user)) fail(403, 'İki aşamalı doğrulama (2FA) yalnızca panel hesapları için kullanılabilir.');
        const secret = generateTotpSecret();
        db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(secret, user.id);
        writeAuditLog(db, { actorEmail: user.email, action: 'auth:2fa_setup_started', target: user.email, ip });
        send(res, 200, { secret, otpauthUri: buildOtpAuthUri({ email: user.email, secret }) });
      } else if (method === 'POST' && path === '/api/auth/2fa/enable') {
        if (!user || !canAccessPanel(user)) fail(403, 'Yetkisiz işlem.');
        const body = await readJson(req);
        const fresh = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(user.id);
        if (!fresh?.totp_secret || !verifyTotpCode(fresh.totp_secret, body.code)) {
          fail(400, 'Doğrulama kodu geçersiz. Authenticator uygulamanızdaki 6 haneli kodu girin.');
        }
        db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
        writeAuditLog(db, { actorEmail: user.email, action: 'auth:2fa_enabled', target: user.email, ip });
        send(res, 200, { ok: true, totpEnabled: true });
      } else if (method === 'POST' && path === '/api/auth/2fa/disable') {
        if (!user || !canAccessPanel(user)) fail(403, 'Yetkisiz işlem.');
        const body = await readJson(req);
        const currentPassword = checkPassword(body.password, 1);
        if (!await verifyPassword(user, currentPassword)) fail(401, 'Parola doğrulanamadı.');
        db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(user.id);
        writeAuditLog(db, { actorEmail: user.email, action: 'auth:2fa_disabled', target: user.email, ip });
        send(res, 200, { ok: true, totpEnabled: false });
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
        const rec = bookingRecord(row, db._piiKey);
        const out = canViewFullBooking(user, row)
          ? stripHouseMargin(rec, user)
          : publicBookingSummary(rec);
        send(res, 200, { booking: out });
      } else if (method === 'POST' && path === '/api/bookings/lookup-cancel') {
        throttle(`lookup:${ip}`, 24);
        const body = await readJson(req);
        const pnr = text(body.pnr, 24, 5).toUpperCase();
        const surname = normalizeSurname(body.surname);
        const existingRow = db.prepare('SELECT * FROM bookings WHERE pnr = ? AND surname = ?').get(pnr, surname);
        if (!existingRow) fail(404, 'Bu kod ve soyadla eşleşen rezervasyon bulunamadı.');
        if (existingRow.status !== 'Onaylandı') {
          fail(409, `Bu rezervasyon zaten "${existingRow.status}" durumunda olduğu için yeni iptal talebi oluşturulamaz.`);
        }
        const det = JSON.parse(existingRow.details || '{}');
        det.refundStatus = 'requested';
        const row = db.prepare(`
          UPDATE bookings SET status = 'İptal Talebi', details = ?, revision = revision + 1
          WHERE pnr = ? AND surname = ? AND status = 'Onaylandı'
          RETURNING *
        `).get(JSON.stringify(det), pnr, surname);
        if (!row) fail(409, 'Bu rezervasyon eşzamanlı olarak güncellendi.');
        writeAuditLog(db, { actorEmail: user?.email || `guest:${pnr}`, action: 'public:pnr_cancel_request', target: pnr, ip });
        const rec = bookingRecord(row, db._piiKey);
        const out = canViewFullBooking(user, row)
          ? stripHouseMargin(rec, user)
          : publicBookingSummary(rec);
        send(res, 200, { booking: out });
      } else if (method === 'GET' && path === '/api/bookings') {
        if (!user) fail(401, 'Oturum açın.');
        const rows = db.prepare('SELECT * FROM bookings WHERE owner_id = ? OR sold_by_user_id = ? ORDER BY created_at DESC, id DESC').all(user.id, user.id);
        send(res, 200, { bookings: rows.map((row) => stripHouseMargin(bookingRecord(row, db._piiKey), user)) });
      } else if (method === 'POST' && (path === '/api/bookings' || path === '/api/admin/bookings')) {
        throttle(`create-booking:${user?.id ?? ip}`, 120);
        const body = await readJson(req);
        const isAdminManual = path === '/api/admin/bookings' && user?.role === 'admin';
        const idemKey = typeof body.idempotencyKey === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(body.idempotencyKey)
          ? `${user?.id ?? ip}:${body.idempotencyKey}`
          : null;
        if (idemKey) {
          if (idempotencyCache.has(idemKey)) {
            send(res, 200, { booking: stripHouseMargin({ ...idempotencyCache.get(idemKey).booking }, user), deduplicated: true });
            return true;
          }
          const persisted = db.prepare('SELECT booking_id FROM idempotency_keys WHERE key = ? AND expires_at > ?').get(idemKey, Date.now());
          if (persisted) {
            const existingRow = db.prepare('SELECT * FROM bookings WHERE id = ?').get(persisted.booking_id);
            if (existingRow) {
              const existingBk = bookingRecord(existingRow, db._piiKey);
              idempotencyCache.set(idemKey, { booking: existingBk, until: Date.now() + 10 * 60_000 });
              send(res, 200, { booking: stripHouseMargin({ ...existingBk }, user), deduplicated: true });
              return true;
            }
          }
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
        // Authoritative server-side price validation & rule precedence check
        const priceCheck = verifyAndComputeBookingPrice(db, body, user, { isAdminManual });
        if (priceCheck.expired) {
          send(res, 409, { code: 'PRICE_EXPIRED', message: priceCheck.message });
          return true;
        }
        if (priceCheck.rejected) {
          fail(priceCheck.status || 400, priceCheck.message);
        }
        if (priceCheck.authoritative && body.enforceExpectedPrice && Number.isFinite(Number(body.expectedPrice ?? body.price))) {
          const expected = Math.round(Number(body.expectedPrice ?? body.price));
          if (Math.abs(expected - priceCheck.price) > 2) {
            send(res, 409, {
              code: 'PRICE_CHANGED',
              authoritativePrice: priceCheck.price,
              appliedRule: priceCheck.appliedRule,
              message: `Seçilen hizmetin güncel tutarı ₺${priceCheck.price.toLocaleString('tr-TR')} olarak güncellendi. Yeni tutarı onaylayıp devam edebilirsiniz.`,
            });
            return true;
          }
        }
        const authoritativeSalePrice = priceCheck.price;
        // B2B Organization Credit Limit — atomic conditional deduction (prevents concurrent race overdraw)
        let orgRow = null;
        let debitedCreditAmount = 0;
        if (user && user.role !== 'admin' && user.organization_id) {
          orgRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(user.organization_id);
          if (orgRow && orgRow.status === 'suspended') {
            fail(403, 'Bağlı olduğunuz şirket hesabı askıya alınmıştır.');
          }
          if (orgRow && orgRow.credit_limit > 0) {
            const saleAmount = Math.round(Number(authoritativeSalePrice) || 0);
            if (!Number.isFinite(saleAmount) || saleAmount <= 0) fail(400, 'Tutar geçersiz.');
            const upd = db.prepare(`
              UPDATE organizations
              SET used_credit = used_credit + ?
              WHERE id = ? AND status = 'active' AND (used_credit + ? <= credit_limit)
            `).run(saleAmount, orgRow.id, saleAmount);
            if (!upd.changes) {
              const latest = db.prepare('SELECT credit_limit, used_credit FROM organizations WHERE id = ?').get(orgRow.id);
              const remaining = Math.max(0, (latest?.credit_limit || 0) - (latest?.used_credit || 0));
              fail(402, `Şirket B2B cari kredi limiti yetersiz! Kalan limit: ₺${remaining.toLocaleString('tr-TR')}`);
            }
            debitedCreditAmount = saleAmount;
          }
        }
        let booking;
        try {
          booking = newDemoBooking(db, body, user ?? null, { isAdminManual, computedPricing: priceCheck });
        } catch (err) {
          if (debitedCreditAmount > 0 && orgRow) {
            db.prepare('UPDATE organizations SET used_credit = MAX(0, used_credit - ?) WHERE id = ?').run(debitedCreditAmount, orgRow.id);
          }
          throw err;
        }
        if (debitedCreditAmount > 0 && orgRow) {
          db.prepare(`
            INSERT OR IGNORE INTO org_ledger (id, organization_id, booking_id, ref_key, type, amount, description, pnr, created_by, created_at)
            VALUES (?, ?, ?, ?, 'debit', ?, ?, ?, ?, ?)
          `).run(
            randomBytes(12).toString('hex'),
            orgRow.id,
            booking.id,
            `debit:${booking.id}`,
            debitedCreditAmount,
            `${booking.type} Satışı: ${booking.title} (${booking.passenger})`,
            booking.pnr,
            user.email,
            Date.now()
          );
        }
        if (idemKey) {
          const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
          idempotencyCache.set(idemKey, { booking, until: Date.now() + 10 * 60_000 });
          db.prepare('INSERT OR REPLACE INTO idempotency_keys (key, booking_id, expires_at) VALUES (?, ?, ?)').run(idemKey, booking.id, expiresAt);
          if (Math.random() < 0.02) db.prepare('DELETE FROM idempotency_keys WHERE expires_at <= ?').run(Date.now());
        }
        recordAnalyticsEvent(db, {
          eventType: 'booking_created',
          page: path,
          productType: booking.type,
          metadata: { bookingId: booking.id, demo: booking.demo !== false, price: booking.price },
        });
        if (user?.email) {
          void sendBookingConfirmationEmail({
            to: user.email,
            passenger: booking.passenger,
            pnr: booking.pnr,
            title: booking.title,
            date: booking.date,
            price: booking.price,
            demo: booking.demo !== false,
          });
        }
        send(res, 201, { booking: stripHouseMargin({ ...booking }, user) });
      } else if (method === 'POST' && /^\/api\/bookings\/[a-f0-9]{32}\/cancel$/.test(path)) {
        if (!user) fail(401, 'Oturum açın.');
        const id = path.split('/')[3];
        const existingOwn = db.prepare('SELECT * FROM bookings WHERE id = ? AND (owner_id = ? OR sold_by_user_id = ?) AND status = \'Onaylandı\'').get(id, user.id, user.id);
        if (!existingOwn) fail(404, 'İptal talebine uygun bir rezervasyon bulunamadı.');
        const det = JSON.parse(existingOwn.details || '{}');
        det.refundStatus = 'requested';
        const row = db.prepare(`
          UPDATE bookings SET status = 'İptal Talebi', details = ?, revision = revision + 1
          WHERE id = ? AND (owner_id = ? OR sold_by_user_id = ?) AND status = 'Onaylandı'
          RETURNING *
        `).get(JSON.stringify(det), id, user.id, user.id);
        if (!row) fail(404, 'İptal talebine uygun bir rezervasyon bulunamadı.');
        writeAuditLog(db, { actorEmail: user.email, action: 'member:cancel_request', target: row.pnr, ip });
        send(res, 200, { booking: stripHouseMargin(bookingRecord(row, db._piiKey), user) });
      } else if (method === 'GET' && path === '/api/admin/bookings') {
        const limitParam = Math.min(2000, Math.max(1, Number(url.searchParams.get('limit')) || 500));
        const pageParam = Math.max(1, Number(url.searchParams.get('page')) || 1);
        const offsetParam = (pageParam - 1) * limitParam;
        const qSearch = (url.searchParams.get('q') || '').trim().toLowerCase();
        const typeFilter = (url.searchParams.get('type') || '').trim();
        const statusFilter = (url.searchParams.get('status') || '').trim();
        const fromDate = (url.searchParams.get('from') || '').trim();
        const toDate = (url.searchParams.get('to') || '').trim();

        const selectJoin = `
          SELECT b.*, u.email AS seller_email, u.profile AS seller_profile, o.name AS organization_name
          FROM bookings b
          LEFT JOIN users u ON u.id = COALESCE(b.sold_by_user_id, b.owner_id)
          LEFT JOIN organizations o ON o.id = b.organization_id
        `;
        const whereParts = [];
        const params = [];
        if (user.role === 'admin' || hasPerm(user, 'bookings.view_all') || hasPerm(user, 'finance.view') || hasPerm(user, 'analytics.view')) {
          // full read scope
        } else if (hasPerm(user, 'bookings.view_org') && user.organization_id) {
          whereParts.push('b.organization_id = ?');
          params.push(user.organization_id);
        } else if (hasPerm(user, 'bookings.view_own') || hasPerm(user, 'bookings.manage') || hasPerm(user, 'bookings.cancel_request')) {
          whereParts.push('(b.owner_id = ? OR b.sold_by_user_id = ?)');
          params.push(user.id, user.id);
        } else {
          send(res, 200, { bookings: [], total: 0, page: 1, limit: limitParam, totalPages: 1 });
          return true;
        }
        if (statusFilter && statuses.includes(statusFilter)) {
          whereParts.push('b.status = ?');
          params.push(statusFilter);
        }
        const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
        const allRows = db.prepare(`${selectJoin} ${whereSql} ORDER BY b.created_at DESC, b.id DESC`).all(...params);
        let mapped = allRows.map((row) => stripHouseMargin(bookingRecord(row, db._piiKey), user));
        if (typeFilter && ['Uçak', 'Otel', 'Transfer', 'Tur'].includes(typeFilter)) {
          mapped = mapped.filter((b) => b.type === typeFilter);
        }
        if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
          mapped = mapped.filter((b) => b.date >= fromDate);
        }
        if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
          mapped = mapped.filter((b) => b.date <= toDate);
        }
        if (qSearch) {
          mapped = mapped.filter((b) =>
            `${b.pnr} ${b.passenger} ${b.title} ${b.subtitle} ${b.organizationName || ''} ${b.sellerName || ''} ${b.flightNumber || ''}`
              .toLowerCase()
              .includes(qSearch)
          );
        }
        const total = mapped.length;
        const paged = mapped.slice(offsetParam, offsetParam + limitParam);
        send(res, 200, {
          bookings: paged,
          total,
          page: pageParam,
          limit: limitParam,
          totalPages: Math.max(1, Math.ceil(total / limitParam)),
        });
      } else if (method === 'GET' && /^\/api\/admin\/bookings\/[a-f0-9]{32}\/history$/.test(path)) {
        const id = path.split('/')[4];
        const existingBk = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
        if (!existingBk) fail(404, 'Rezervasyon bulunamadı.');
        if (!canViewFullBooking(user, existingBk)) fail(403, 'Bu rezervasyonun geçmişini görüntüleme yetkiniz yok.');
        const audits = db.prepare(`
          SELECT id, actor_email, action, target, ip, created_at FROM audit_logs
          WHERE target LIKE ? OR target LIKE ?
          ORDER BY created_at DESC LIMIT 60
        `).all(`%${existingBk.pnr}%`, `%${existingBk.id}%`);
        const notes = db.prepare(`
          SELECT id, author_email, note, created_at FROM booking_notes
          WHERE booking_id = ? ORDER BY created_at DESC LIMIT 40
        `).all(existingBk.id);
        const ledger = existingBk.organization_id
          ? db.prepare(`
              SELECT * FROM org_ledger WHERE booking_id = ? OR pnr = ? ORDER BY created_at DESC LIMIT 20
            `).all(existingBk.id, existingBk.pnr).map(orgLedgerRecord)
          : [];
        send(res, 200, { audits, notes, ledger });
      } else if (method === 'POST' && /^\/api\/admin\/bookings\/[a-f0-9]{32}\/notes$/.test(path)) {
        const id = path.split('/')[4];
        const existingBk = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
        if (!existingBk) fail(404, 'Rezervasyon bulunamadı.');
        if (!canViewFullBooking(user, existingBk)) fail(403, 'Bu rezervasyona not ekleme yetkiniz yok.');
        const body = await readJson(req);
        const note = text(body.note, 500, 2);
        const noteId = randomBytes(12).toString('hex');
        db.prepare('INSERT INTO booking_notes (id, booking_id, author_email, note, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(noteId, existingBk.id, user.email, note, Date.now());
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:booking_note', target: existingBk.pnr, ip });
        const row = db.prepare('SELECT id, author_email, note, created_at FROM booking_notes WHERE id = ?').get(noteId);
        send(res, 201, { note: row });
      } else if (method === 'GET' && path === '/api/admin/catalog') {
        const canReadProviders = user.role === 'admin' || hasPerm(user, 'apis.manage');
        const rows = canReadProviders
          ? db.prepare("SELECT key, value FROM settings WHERE key LIKE 'catalog:%'").all()
          : db.prepare("SELECT key, value FROM settings WHERE key LIKE 'catalog:%' AND key != 'catalog:providers'").all();
        const catalog = Object.fromEntries(rows.map(({ key, value }) => [key.slice('catalog:'.length), JSON.parse(value)]));
        send(res, 200, { catalog });
      } else if (method === 'PUT' && /^\/api\/admin\/catalog\/(rules|coupons|agencies|hotels|transfers|tours|deals|operators|flights|providers)$/.test(path)) {
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
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:catalog_update', target: `${section}:rev${entry.revision}`, ip });
        send(res, 200, { entry });
      } else if (method === 'PATCH' && /^\/api\/admin\/bookings\/[a-f0-9]{32}\/checkin$/.test(path)) {
        if (user.role !== 'admin') fail(403, 'Online Check-In kontrol yetkisi yalnızca Süper Admin içindir.');
        const id = path.split('/')[4];
        const existingBk = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
        if (!existingBk) fail(404, 'Rezervasyon bulunamadı.');
        const body = await readJson(req, 3_500_000);
        const nextCheckinStatus = body.checkinStatus === 'completed' ? 'completed' : body.checkinStatus === 'pending' ? 'pending' : null;
        if (!nextCheckinStatus) fail(400, 'Check-in durumu geçersiz.');

        const bpRaw = body.boardingPass && typeof body.boardingPass === 'object' ? body.boardingPass : {};
        const seatRaw = typeof (bpRaw.seat ?? body.assignedSeat) === 'string'
          ? String(bpRaw.seat ?? body.assignedSeat).trim().toUpperCase().slice(0, 24)
          : undefined;
        const details = JSON.parse(existingBk.details || '{}');

        const cleanedPaxSeats = Array.isArray(bpRaw.passengerSeats)
          ? bpRaw.passengerSeats.slice(0, 12).map((ps) => ({
              fullName: typeof ps?.fullName === 'string' ? ps.fullName.trim().slice(0, 120) : '',
              seat: typeof ps?.seat === 'string' ? ps.seat.trim().toUpperCase().slice(0, 12) : '',
              seqNo: typeof ps?.seqNo === 'string' ? ps.seqNo.trim().slice(0, 12) : undefined,
            })).filter((ps) => ps.fullName || ps.seat)
          : undefined;

        const primarySeat =
          seatRaw ||
          (cleanedPaxSeats && cleanedPaxSeats.length > 0 ? cleanedPaxSeats.map((p) => p.seat).filter(Boolean).join(', ') : '') ||
          details.assignedSeat ||
          '';

        const sendEmailFlag = Boolean(body.sendEmail);
        const recipientEmail = (
          typeof body.recipientEmail === 'string' && body.recipientEmail.trim()
            ? body.recipientEmail.trim().slice(0, 120)
            : typeof bpRaw.sentToEmail === 'string' && bpRaw.sentToEmail.trim()
              ? bpRaw.sentToEmail.trim().slice(0, 120)
              : details.contactEmail || ''
        );

        if (sendEmailFlag) {
          if (!primarySeat) fail(400, 'Biniş kartı göndermeden önce en az bir koltuk numarası girmelisiniz.');
          if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
            fail(400, 'Müşteriye bildirim göndermek için geçerli bir e-posta adresi girin.');
          }
        }

        const cleanDataUrl = (val, allowedMimeRe, maxLen) => {
          if (val === '') return undefined;
          if (typeof val !== 'string') return null; // preserve previous
          const trimmed = val.trim();
          if (!trimmed) return undefined;
          if (trimmed.length > maxLen) fail(400, 'Yüklenen biniş kartı dosyası çok büyük (en fazla 2 MB).');
          if (!allowedMimeRe.test(trimmed)) fail(400, 'Desteklenen dosya biçimleri: PNG, JPG, WEBP veya PDF.');
          return trimmed;
        };
        const nextOfficialQr = cleanDataUrl(bpRaw.officialQrDataUrl, /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i, 2_200_000);
        const nextOfficialPass = cleanDataUrl(bpRaw.officialPassDataUrl, /^data:(application\/pdf|image\/(png|jpeg|jpg|webp));base64,[A-Za-z0-9+/=]+$/i, 2_900_000);

        const prevBp = details.boardingPass && typeof details.boardingPass === 'object' ? details.boardingPass : {};
        const nextBoardingPass = {
          ...prevBp,
          seat: primarySeat || prevBp.seat || '',
          passengerSeats: cleanedPaxSeats ?? prevBp.passengerSeats,
          airlinePnr: typeof bpRaw.airlinePnr === 'string' ? bpRaw.airlinePnr.trim().toUpperCase().slice(0, 20) || undefined : prevBp.airlinePnr,
          eticketNo: typeof bpRaw.eticketNo === 'string' ? bpRaw.eticketNo.trim().slice(0, 32) || undefined : prevBp.eticketNo,
          terminal: typeof bpRaw.terminal === 'string' ? bpRaw.terminal.trim().slice(0, 40) || undefined : prevBp.terminal,
          gate: typeof bpRaw.gate === 'string' ? bpRaw.gate.trim().toUpperCase().slice(0, 24) || undefined : prevBp.gate,
          boardingTime: typeof bpRaw.boardingTime === 'string' ? bpRaw.boardingTime.trim().slice(0, 10) || undefined : prevBp.boardingTime,
          gateCloseTime: typeof bpRaw.gateCloseTime === 'string' ? bpRaw.gateCloseTime.trim().slice(0, 10) || undefined : prevBp.gateCloseTime,
          boardingGroup: typeof bpRaw.boardingGroup === 'string' ? bpRaw.boardingGroup.trim().slice(0, 32) || undefined : prevBp.boardingGroup,
          sequenceNo: typeof bpRaw.sequenceNo === 'string' ? bpRaw.sequenceNo.trim().slice(0, 16) || undefined : prevBp.sequenceNo,
          baggageDropNote: typeof bpRaw.baggageDropNote === 'string' ? bpRaw.baggageDropNote.trim().slice(0, 320) || undefined : prevBp.baggageDropNote,
          mobilePassUrl: typeof bpRaw.mobilePassUrl === 'string' ? bpRaw.mobilePassUrl.trim().slice(0, 280) || undefined : prevBp.mobilePassUrl,
          officialQrDataUrl: nextOfficialQr === null ? prevBp.officialQrDataUrl : nextOfficialQr,
          officialPassDataUrl: nextOfficialPass === null ? prevBp.officialPassDataUrl : nextOfficialPass,
          officialPassFileName: typeof bpRaw.officialPassFileName === 'string' ? bpRaw.officialPassFileName.trim().slice(0, 120) || undefined : prevBp.officialPassFileName,
          officialPassMime: typeof bpRaw.officialPassMime === 'string' ? bpRaw.officialPassMime.trim().slice(0, 64) || undefined : prevBp.officialPassMime,
          bcbpString: typeof bpRaw.bcbpString === 'string' ? bpRaw.bcbpString.trim().slice(0, 240) || undefined : prevBp.bcbpString,
          sentToEmail: recipientEmail || prevBp.sentToEmail,
        };

        let emailResult = null;
        if (sendEmailFlag) {
          const firstLeg = Array.isArray(details.legs) && details.legs.length > 0 ? details.legs[0] : null;
          const routeCodes = String(details.title || '').match(/\(([A-Z]{3})\)/g)?.map((m) => m.slice(1, 4)) || [];
          const mailLang = ['TR', 'EN', 'RU', 'KK'].includes(body.lang) ? body.lang : 'TR';
          const mailOut = await sendBoardingPassEmail({
            to: recipientEmail,
            passenger: details.passenger,
            pnr: existingBk.pnr,
            airlinePnr: nextBoardingPass.airlinePnr || existingBk.pnr,
            eticketNo: nextBoardingPass.eticketNo || details.eticketNumber,
            airline: details.airline || firstLeg?.airline,
            flightNumber: details.flightNumber || firstLeg?.flightNumber,
            routeTitle: details.title,
            fromCode: firstLeg?.fromCode || routeCodes[0] || '',
            toCode: firstLeg?.toCode || routeCodes[1] || '',
            date: details.date,
            departTime: details.departTime || firstLeg?.departTime,
            arriveTime: details.arriveTime || firstLeg?.arriveTime,
            baggage: details.baggage || firstLeg?.baggage,
            cabin: details.cabin || firstLeg?.cabin,
            seat: primarySeat,
            passengerSeats: nextBoardingPass.passengerSeats,
            terminal: nextBoardingPass.terminal,
            gate: nextBoardingPass.gate,
            boardingTime: nextBoardingPass.boardingTime,
            gateCloseTime: nextBoardingPass.gateCloseTime,
            boardingGroup: nextBoardingPass.boardingGroup,
            sequenceNo: nextBoardingPass.sequenceNo,
            baggageDropNote: nextBoardingPass.baggageDropNote,
            mobilePassUrl: nextBoardingPass.mobilePassUrl,
            officialQrDataUrl: nextBoardingPass.officialQrDataUrl,
            officialPassDataUrl: nextBoardingPass.officialPassDataUrl,
            officialPassFileName: nextBoardingPass.officialPassFileName,
            bcbpString: nextBoardingPass.bcbpString,
            lang: mailLang,
          });
          if (mailOut.bcbpCode) nextBoardingPass.bcbpString = mailOut.bcbpCode;
          const deliveryStatus = mailOut.sent ? 'sent' : mailOut.skipped === 'no_api_key' ? 'queued_preview' : 'failed';
          nextBoardingPass.sentToEmail = recipientEmail;
          nextBoardingPass.emailSentAt = Date.now();
          nextBoardingPass.emailDeliveryStatus = deliveryStatus;
          emailResult = {
            requested: true,
            sent: Boolean(mailOut.sent),
            status: deliveryStatus,
            to: recipientEmail,
            skipped: mailOut.skipped,
            subject: mailOut.subject,
            previewHtml: mailOut.previewHtml,
          };
        }

        details.autoCheckin = true;
        details.checkinStatus = nextCheckinStatus;
        if (primarySeat) details.assignedSeat = primarySeat;
        if (recipientEmail && !details.contactEmail) details.contactEmail = recipientEmail;
        if (primarySeat || Object.keys(bpRaw).length > 0 || sendEmailFlag) {
          details.boardingPass = nextBoardingPass;
        }

        const row = db.prepare('UPDATE bookings SET details = ? WHERE id = ? RETURNING *').get(JSON.stringify(details), id);
        if (!row) fail(404, 'Rezervasyon güncellenemedi.');
        writeAuditLog(db, {
          actorEmail: user.email,
          action: sendEmailFlag ? 'admin:checkin_email_sent' : 'admin:checkin_update',
          target: `${row.pnr}:${nextCheckinStatus}${primarySeat ? ':' + primarySeat : ''}${sendEmailFlag ? '->' + recipientEmail : ''}`,
          ip,
        });
        send(res, 200, {
          booking: stripHouseMargin(bookingRecord(row, db._piiKey), user),
          email: emailResult || { requested: false, sent: false },
        });
      } else if ((method === 'PATCH' || method === 'DELETE') && /^\/api\/admin\/bookings\/[a-f0-9]{32}$/.test(path)) {
        const id = path.split('/').at(-1);
        const existingBk = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
        if (!existingBk) fail(404, 'Rezervasyon bulunamadı.');
        const sameOrg = Boolean(user.organization_id && existingBk.organization_id === user.organization_id);
        const isOwnBk = existingBk.owner_id === user.id || existingBk.sold_by_user_id === user.id;
        const hasGlobalManage = user.role === 'admin' || hasPerm(user, 'refunds.process') || (hasPerm(user, 'bookings.view_all') && hasPerm(user, 'bookings.manage'));
        if (!hasGlobalManage && !isOwnBk && !(sameOrg && hasPerm(user, 'bookings.view_org'))) {
          fail(403, 'Başka bir şirketin veya kullanıcının rezervasyonuna müdahale edemezsiniz.');
        }
        if (method === 'DELETE') {
          if (user.role !== 'admin') fail(403, 'Kayıt silme yetkisi sadece Süper Admin içindir.');
          db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
          writeAuditLog(db, { actorEmail: user.email, action: 'admin:booking_delete', target: `${existingBk.pnr}:${id}`, ip });
          send(res, 200, { ok: true });
        } else {
          const body = await readJson(req);
          const { status, expectedStatus, expectedRevision } = body;
          if (!statuses.includes(status)) fail(400, 'Rezervasyon durumu geçersiz.');
          const canDirectManage = user.role === 'admin' || hasPerm(user, 'bookings.manage');
          const canRefundOnly = status === 'İade Edildi' && hasPerm(user, 'refunds.process');
          const canCancelReq = status === 'İptal Talebi' && existingBk.status === 'Onaylandı' && (canDirectManage || hasPerm(user, 'bookings.cancel_request'));
          if (!canDirectManage && !canRefundOnly && !canCancelReq) {
            fail(403, 'Bu rezervasyon durumunu değiştirme yetkiniz yok.');
          }
          if (expectedStatus && existingBk.status !== expectedStatus) {
            fail(409, `Bu rezervasyonun durumu başka bir yönetici tarafından "${existingBk.status}" olarak değiştirildi. Lütfen sayfayı yenileyin.`);
          }
          const currentRev = Number(existingBk.revision ?? 1);
          if (expectedRevision !== undefined && Number(expectedRevision) !== currentRev) {
            fail(409, 'Bu rezervasyon başka bir oturumda güncellendi. Lütfen sayfayı yenileyin.');
          }
          if (existingBk.status === status) {
            fail(409, `Bu rezervasyon zaten "${status}" durumunda.`);
          }
          if ((existingBk.status === 'İade Edildi' || existingBk.status === 'İptal Edildi') && status !== existingBk.status && status !== 'İade Edildi') {
            fail(409, `"${existingBk.status}" durumundaki kayıt "${status}" olarak değiştirilemez.`);
          }
          const nextDetails = JSON.parse(existingBk.details || '{}');
          const isDemo = nextDetails.demo !== false;
          if (status === 'İptal Talebi') {
            nextDetails.refundStatus = 'requested';
          } else if (status === 'İptal Edildi') {
            nextDetails.ticketingStatus = 'voided';
            nextDetails.refundStatus = nextDetails.refundStatus === 'completed' ? 'completed' : 'requested';
          } else if (status === 'İade Edildi') {
            nextDetails.ticketingStatus = 'voided';
            nextDetails.paymentStatus = isDemo ? 'demo_refunded' : 'refunded';
            nextDetails.refundStatus = 'completed';
          } else if (status === 'Tamamlandı') {
            if (!isDemo) {
              nextDetails.paymentStatus = 'verified';
              nextDetails.ticketingStatus = 'ticketed';
            }
          }
          const row = db.prepare(`
            UPDATE bookings SET status = ?, details = ?, revision = revision + 1
            WHERE id = ? AND status = ? AND revision = ?
            RETURNING *
          `).get(status, JSON.stringify(nextDetails), id, existingBk.status, currentRev);
          if (!row) fail(409, 'Bu rezervasyon eşzamanlı olarak güncellendi. Lütfen yenileyip tekrar deneyin.');

          // Atomic, idempotent B2B Cari Credit restoration on Cancel/Refund (runs at most ONCE per booking!)
          let refundedCariAmount = 0;
          if ((status === 'İptal Edildi' || status === 'İade Edildi') && existingBk.organization_id) {
            const origDebit = db.prepare(`
              SELECT amount FROM org_ledger
              WHERE organization_id = ? AND type = 'debit' AND (booking_id = ? OR pnr = ?)
              ORDER BY created_at ASC LIMIT 1
            `).get(existingBk.organization_id, existingBk.id, existingBk.pnr);
            if (origDebit && origDebit.amount > 0) {
              const refKey = `refund:${existingBk.id}`;
              const ins = db.prepare(`
                INSERT OR IGNORE INTO org_ledger (id, organization_id, booking_id, ref_key, type, amount, description, pnr, created_by, created_at)
                VALUES (?, ?, ?, ?, 'credit', ?, ?, ?, ?, ?)
              `).run(
                randomBytes(12).toString('hex'),
                existingBk.organization_id,
                existingBk.id,
                refKey,
                origDebit.amount,
                `${status} Cari Limit İadesi (${existingBk.pnr})`,
                existingBk.pnr,
                user.email,
                Date.now()
              );
              if (ins.changes === 1) {
                db.prepare('UPDATE organizations SET used_credit = MAX(0, used_credit - ?) WHERE id = ?')
                  .run(origDebit.amount, existingBk.organization_id);
                refundedCariAmount = origDebit.amount;
              }
            }
          }
          writeAuditLog(db, {
            actorEmail: user.email,
            action: status === 'İade Edildi' ? 'admin:booking_refund' : 'admin:booking_status',
            target: `${row.pnr}:${existingBk.status}->${status}${refundedCariAmount ? `:cari+${refundedCariAmount}` : ''}`,
            ip,
          });
          send(res, 200, { booking: stripHouseMargin(bookingRecord(row, db._piiKey), user), refundedCariAmount });
        }
      } else if (method === 'PATCH' && path === '/api/admin/pricing') {
        const body = await readJson(req);
        const markup = {};
        for (const [key, maximum] of Object.entries(markupLimits)) {
          if (!Number.isInteger(body[key]) || body[key] < 0 || body[key] > maximum) fail(400, 'Fiyat kuralı geçersiz.');
          markup[key] = body[key];
        }
        const saved = db.prepare("SELECT value FROM settings WHERE key = 'markup'").get();
        const currentRev = saved ? (JSON.parse(saved.value).revision ?? 0) : 0;
        if (body.revision !== undefined && body.revision !== currentRev) {
          fail(409, 'Fiyat kuralları başka bir yönetici tarafından güncellendi. Lütfen yenileyip tekrar deneyin.');
        }
        const nextPayload = { ...markup, revision: currentRev + 1 };
        const result = saved
          ? db.prepare("UPDATE settings SET value = ? WHERE key = 'markup' AND value = ?").run(JSON.stringify(nextPayload), saved.value)
          : db.prepare("INSERT INTO settings (key, value) VALUES ('markup', ?) ON CONFLICT(key) DO NOTHING").run(JSON.stringify(nextPayload));
        if (!result.changes) fail(409, 'Fiyat kuralları eşzamanlı olarak güncellendi. Lütfen yenileyip tekrar deneyin.');
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:pricing_update', target: JSON.stringify(markup), ip });
        send(res, 200, { markup: nextPayload });
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
        const rows = (user.role === 'admin' || hasPerm(user, 'analytics.view') || hasPerm(user, 'finance.view'))
          ? db.prepare('SELECT id, email, role, role_label, profile, status, organization_id, permissions, totp_enabled FROM users ORDER BY rowid DESC').all()
          : user.organization_id
            ? db.prepare('SELECT id, email, role, role_label, profile, status, organization_id, permissions, totp_enabled FROM users WHERE organization_id = ? ORDER BY rowid DESC').all(user.organization_id)
            : [];
        send(res, 200, { users: rows.map(accountProfile) });
      } else if (method === 'POST' && /^\/api\/admin\/users\/[a-f0-9]{32}\/revoke-sessions$/.test(path)) {
        if (user.role !== 'admin') fail(403, 'Oturum sonlandırma yetkisi yalnızca Süper Admin içindir.');
        const targetId = path.split('/')[4];
        const targetRow = db.prepare('SELECT email FROM users WHERE id = ?').get(targetId);
        if (!targetRow) fail(404, 'Kullanıcı bulunamadı.');
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:user_sessions_revoked', target: targetRow.email, ip });
        send(res, 200, { ok: true });
      } else if (method === 'POST' && /^\/api\/admin\/users\/[a-f0-9]{32}\/approve$/.test(path)) {
        if (user.role !== 'admin') fail(403, 'Kurumsal başvuru onaylama yetkisi yalnızca Süper Admin içindir.');
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
        const targetRow = db.prepare('SELECT id, role, organization_id FROM users WHERE id = ?').get(targetId);
        if (!targetRow) fail(404, 'Kullanıcı bulunamadı.');
        const body = await readJson(req);
        let permissions = cleanPermissions(body.permissions);
        if (user.role !== 'admin') {
          if (targetRow.role === 'admin' || targetId === user.id || !user.organization_id || targetRow.organization_id !== user.organization_id) {
            fail(403, 'Yalnızca kendi şirketinizdeki ekip üyelerinin yetkilerini düzenleyebilirsiniz.');
          }
          // Non-admin company managers can NEVER escalate beyond their own held permissions
          permissions = permissions.filter((p) => hasPerm(user, p));
        }
        const orgId = user.role !== 'admin' || body.organizationId === undefined ? undefined : (body.organizationId || null);
        const row = orgId === undefined
          ? db.prepare('UPDATE users SET permissions = ? WHERE id = ? RETURNING id, email, role, profile, status, organization_id, permissions').get(JSON.stringify(permissions), targetId)
          : db.prepare('UPDATE users SET permissions = ?, organization_id = ? WHERE id = ? RETURNING id, email, role, profile, status, organization_id, permissions').get(JSON.stringify(permissions), orgId, targetId);
        if (!row) fail(404, 'Kullanıcı bulunamadı.');
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:user_permissions', target: `${row.email}:${permissions.join(',')}`, ip });
        send(res, 200, { user: accountProfile(row) });
      } else if (method === 'PATCH' && /^\/api\/admin\/users\/[a-f0-9]{32}\/status$/.test(path)) {
        const targetId = path.split('/')[4];
        if (targetId === user.id) fail(400, 'Kendi hesabınızı askıya alamazsınız.');
        const targetRow = db.prepare('SELECT id, role, organization_id FROM users WHERE id = ?').get(targetId);
        if (!targetRow) fail(404, 'Kullanıcı bulunamadı.');
        if (user.role !== 'admin' && (targetRow.role === 'admin' || !user.organization_id || targetRow.organization_id !== user.organization_id)) {
          fail(403, 'Yalnızca kendi şirketinizdeki ekip üyelerinin durumunu değiştirebilirsiniz.');
        }
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
        const rows = user.role === 'admin'
          ? db.prepare('SELECT * FROM organizations ORDER BY created_at DESC').all()
          : user.organization_id
            ? db.prepare('SELECT * FROM organizations WHERE id = ?').all(user.organization_id)
            : [];
        send(res, 200, { organizations: rows.map(organizationRecord) });
      } else if (method === 'POST' && path === '/api/admin/organizations') {
        if (user.role !== 'admin') fail(403, 'Yeni şirket oluşturma yetkisi yalnızca Süper Admin içindir.');
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
        if (user.role !== 'admin') fail(403, 'Şirket limit, indirim ve durum düzenleme yetkisi yalnızca Süper Admin içindir.');
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
        if (user.role !== 'admin' && user.organization_id !== orgId) fail(403, 'Başka bir şirketin cari ekstresini görüntüleyemezsiniz.');
        const rows = db.prepare('SELECT * FROM org_ledger WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100').all(orgId);
        send(res, 200, { entries: rows.map(orgLedgerRecord) });
      } else if (method === 'POST' && /^\/api\/admin\/organizations\/[a-f0-9]{24}\/payment$/.test(path)) {
        if (user.role !== 'admin' && !hasPerm(user, 'finance.manage')) fail(403, 'Cari tahsilat işleme yetkisi yalnızca Süper Admin veya Finans Yetkilisi içindir.');
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
        send(res, 200, { quotes: rows.map((r) => crmQuoteRecord(r, db._piiKey)) });
      } else if (method === 'POST' && path === '/api/admin/crm/quotes') {
        const body = await readJson(req);
        const firstName = typeof body.firstName === 'string' ? body.firstName.trim().slice(0, 60) : '';
        const lastName = typeof body.lastName === 'string' ? body.lastName.trim().slice(0, 60) : '';
        const combinedName = `${firstName} ${lastName}`.trim();
        const customerName = text(combinedName || body.customerName, 120, 2);
        const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim().slice(0, 32) : '';
        const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().slice(0, 120) : '';
        const birthDate = typeof body.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate.trim())
          ? body.birthDate.trim()
          : '';
        const documentType = body.documentType === 'pasaport' ? 'pasaport' : body.documentType === 'kimlik' ? 'kimlik' : undefined;
        const tcOrPassport = typeof body.tcOrPassport === 'string' ? body.tcOrPassport.trim().slice(0, 32) : '';
        const nationality = typeof body.nationality === 'string' ? body.nationality.trim().slice(0, 48) : '';
        const passportCountry = typeof body.passportCountry === 'string' ? body.passportCountry.trim().slice(0, 48) : '';
        const passportIssueDate = typeof body.passportIssueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.passportIssueDate.trim())
          ? body.passportIssueDate.trim()
          : '';
        const passportExpiryDate = typeof body.passportExpiryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.passportExpiryDate.trim())
          ? body.passportExpiryDate.trim()
          : '';
        const passportIssuer = typeof body.passportIssuer === 'string' ? body.passportIssuer.trim().slice(0, 64) : '';
        const gender = body.gender === 'F' ? 'F' : body.gender === 'M' ? 'M' : undefined;
        const paxCount = Math.max(1, Math.min(9, Math.round(Number(body.paxCount) || 1)));
        const type = ['Uçak', 'Otel', 'Transfer', 'Tur'].includes(body.type) ? body.type : 'Uçak';
        const title = text(body.title, 160, 2);
        const details = typeof body.details === 'string' ? body.details.trim().slice(0, 240) : '';
        const travelDate = typeof body.travelDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.travelDate)
          ? body.travelDate
          : new Date().toISOString().slice(0, 10);
        if (passportExpiryDate && passportExpiryDate < travelDate) {
          fail(400, 'Pasaport geçerlilik bitiş tarihi seyahat tarihinden önce olamaz.');
        }
        const price = Math.round(Number(body.price));
        if (!Number.isFinite(price) || price <= 0 || price > 50_000_000) fail(400, 'Geçerli bir teklif tutarı girin.');
        const metadata = {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          birthDate: birthDate || undefined,
          documentType,
          tcOrPassport: tcOrPassport || undefined,
          nationality: nationality || undefined,
          passportCountry: passportCountry || undefined,
          passportIssueDate: passportIssueDate || undefined,
          passportExpiryDate: passportExpiryDate || undefined,
          passportIssuer: passportIssuer || undefined,
          gender,
          customerEmail: customerEmail || undefined,
          paxCount,
          airline: typeof body.airline === 'string' ? body.airline.trim().slice(0, 60) : undefined,
          flightNumber: typeof body.flightNumber === 'string' ? body.flightNumber.trim().slice(0, 24) : undefined,
          departTime: typeof body.departTime === 'string' ? body.departTime.trim().slice(0, 10) : undefined,
          arriveTime: typeof body.arriveTime === 'string' ? body.arriveTime.trim().slice(0, 10) : undefined,
          duration: typeof body.duration === 'string' ? body.duration.trim().slice(0, 24) : undefined,
          baggage: typeof body.baggage === 'string' ? body.baggage.trim().slice(0, 60) : undefined,
          cabin: typeof body.cabin === 'string' ? body.cabin.trim().slice(0, 32) : undefined,
          fromCode: typeof body.fromCode === 'string' ? body.fromCode.trim().toUpperCase().slice(0, 8) : undefined,
          toCode: typeof body.toCode === 'string' ? body.toCode.trim().toUpperCase().slice(0, 8) : undefined,
          providerSource: typeof body.providerSource === 'string' ? body.providerSource.trim().slice(0, 80) : undefined,
          netCostTRY: Number.isFinite(Number(body.netCostTRY)) && Number(body.netCostTRY) > 0
            ? Math.round(Number(body.netCostTRY))
            : undefined,
        };
        const storedMeta = encryptQuoteMetadata(metadata, db._piiKey);
        const id = randomBytes(12).toString('hex');
        const quoteNo = `TKF-${randomBytes(3).toString('hex').toUpperCase()}`;
        db.prepare(`
          INSERT INTO crm_quotes (id, quote_no, customer_name, customer_phone, type, title, details, travel_date, price, status, converted_pnr, created_by, created_at, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Taslak', '', ?, ?, ?)
        `).run(id, quoteNo, customerName, customerPhone, type, title, details, travelDate, price, user.email, Date.now(), JSON.stringify(storedMeta));
        const row = db.prepare('SELECT * FROM crm_quotes WHERE id = ?').get(id);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:quote_create', target: `${quoteNo}:${customerName}`, ip });
        send(res, 201, { quote: crmQuoteRecord(row, db._piiKey) });
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
        const parsedQuote = crmQuoteRecord(qRow, db._piiKey);
        const surname = (parsedQuote.lastName || qRow.customer_name.trim().split(/\s+/).at(-1) || qRow.customer_name);
        const legs =
          parsedQuote.type === 'Uçak' && (parsedQuote.fromCode || parsedQuote.flightNumber)
            ? [{
                direction: 'Gidiş',
                fromCode: parsedQuote.fromCode || '',
                toCode: parsedQuote.toCode || '',
                date: qRow.travel_date,
                departTime: parsedQuote.departTime || '',
                arriveTime: parsedQuote.arriveTime || '',
                flightNumber: parsedQuote.flightNumber || '',
                airline: parsedQuote.airline || '',
                baggage: parsedQuote.baggage,
                cabin: parsedQuote.cabin,
                duration: parsedQuote.duration,
              }]
            : undefined;
        const booking = newDemoBooking(db, {
          type: qRow.type,
          title: qRow.title,
          subtitle: qRow.details || `Teklif No: ${qRow.quote_no}`,
          date: qRow.travel_date,
          passenger: qRow.customer_name,
          lookupSurname: surname,
          price: qRow.price,
          contactPhone: parsedQuote.customerPhone || undefined,
          contactEmail: parsedQuote.customerEmail || undefined,
          airline: parsedQuote.airline,
          flightNumber: parsedQuote.flightNumber,
          departTime: parsedQuote.departTime,
          arriveTime: parsedQuote.arriveTime,
          duration: parsedQuote.duration,
          baggage: parsedQuote.baggage,
          cabin: parsedQuote.cabin,
          providerSource: parsedQuote.providerSource,
          netCostTRY: parsedQuote.netCostTRY,
          legs,
          passengersDetail: [{
            fullName: qRow.customer_name,
            documentType: parsedQuote.documentType,
            birthDate: parsedQuote.birthDate,
            tcOrPassport: parsedQuote.tcOrPassport,
            nationality: parsedQuote.nationality,
            passportCountry: parsedQuote.passportCountry,
            passportIssueDate: parsedQuote.passportIssueDate,
            passportExpiryDate: parsedQuote.passportExpiryDate,
            passportIssuer: parsedQuote.passportIssuer,
            gender: parsedQuote.gender,
            paxType: (parsedQuote.paxCount || 1) > 1 ? `Yetişkin (${parsedQuote.paxCount} Kişi)` : 'Yetişkin',
          }],
        }, user);
        const updatedQuote = db.prepare(`
          UPDATE crm_quotes SET status = 'Onaylandı', converted_pnr = ? WHERE id = ? RETURNING *
        `).get(booking.pnr, id);
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:quote_convert', target: `${qRow.quote_no}->${booking.pnr}`, ip });
        send(res, 201, { quote: crmQuoteRecord(updatedQuote), booking: stripHouseMargin({ ...booking }, user) });
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
          const is2xx = probe.status >= 200 && probe.status < 300;
          const isAuthBlocked = probe.status === 401 || probe.status === 403;
          const isNotFound = probe.status === 404;
          const stage = is2xx
            ? 'reachable_unauthenticated'
            : isAuthBlocked
              ? 'auth_required'
              : isNotFound
                ? 'endpoint_not_found'
                : probe.status >= 500
                  ? 'upstream_error'
                  : 'redirect_or_other';
          const message = is2xx
            ? `Uç nokta erişilebilir (HTTP ${probe.status} · ${latencyMs} ms). Not: Kimlik doğrulama ve canlı biletleme tedarikçi testi ayrı doğrulanmalıdır.`
            : isAuthBlocked
              ? `Uç nokta erişilebilir ancak kimlik doğrulama reddedildi (HTTP ${probe.status} · ${latencyMs} ms). API anahtarı / IP Whitelist doğrulanmadı.`
              : isNotFound
                ? `Uç nokta bulunamadı (HTTP 404 · ${latencyMs} ms). Sağlayıcı URL adresini kontrol edin.`
                : `Sunucu beklenen başarı kodunu dönmedi (HTTP ${probe.status} · ${latencyMs} ms).`;
          send(res, 200, {
            ok: is2xx,
            reachable: probe.status > 0 && probe.status < 500,
            authVerified: false,
            liveTransactionVerified: false,
            stage,
            status: probe.status,
            latencyMs,
            message,
          });
        } catch (err) {
          const latencyMs = Date.now() - started;
          send(res, 200, {
            ok: false,
            reachable: false,
            authVerified: false,
            liveTransactionVerified: false,
            stage: 'network_error',
            status: 0,
            latencyMs,
            message: err?.name === 'AbortError'
              ? 'Zaman aşımı (4 sn) — sunucu IP Whitelist veya VPN istiyor olabilir.'
              : 'Bağlantı kurulamadı — URL veya IP Whitelist ayarını kontrol edin.',
          });
        }
      } else if (method === 'GET' && path === '/api/admin/analytics') {
        const range = (url.searchParams.get('range') || '7d').toLowerCase();
        const now = Date.now();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        let sinceMs = startOfToday.getTime() - 6 * 86_400_000;
        let untilMs = now;
        if (range === 'today') {
          sinceMs = startOfToday.getTime();
        } else if (range === '30d' || range === 'month') {
          sinceMs = startOfToday.getTime() - 29 * 86_400_000;
        } else if (range === 'custom') {
          const fromStr = url.searchParams.get('from');
          const toStr = url.searchParams.get('to');
          if (fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr)) sinceMs = new Date(`${fromStr}T00:00:00`).getTime();
          if (toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr)) untilMs = new Date(`${toStr}T23:59:59.999`).getTime();
        }

        const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get()?.c ?? 0;
        const activeOrgs = db.prepare("SELECT COUNT(*) AS c FROM organizations WHERE status = 'active'").get()?.c ?? 0;
        const events = db.prepare('SELECT event_type, page, product_type, metadata, created_at FROM analytics_events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT 5000').all(sinceMs, untilMs);
        const bkRows = db.prepare('SELECT id, pnr, status, details, created_at FROM bookings WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC').all(sinceMs, untilMs);

        const countEv = (t) => events.filter((e) => e.event_type === t).length;
        const seenBookingIds = new Set();
        const salesSummary = {
          demoCount: 0,
          demoVolumeTRY: 0,
          verifiedLiveCount: 0,
          verifiedLiveVolumeTRY: 0,
          refundedCount: 0,
          refundedVolumeTRY: 0,
          byProduct: { Uçak: 0, Otel: 0, Transfer: 0, Tur: 0 },
        };
        for (const r of bkRows) {
          if (seenBookingIds.has(r.id)) continue;
          seenBookingIds.add(r.id);
          const det = JSON.parse(r.details || '{}');
          const price = Number(det.price || 0);
          const isDemo = det.demo !== false;
          if (r.status === 'İade Edildi' || r.status === 'İptal Edildi') {
            salesSummary.refundedCount++;
            salesSummary.refundedVolumeTRY += price;
            continue;
          }
          if (isDemo) {
            salesSummary.demoCount++;
            salesSummary.demoVolumeTRY += price;
          } else {
            salesSummary.verifiedLiveCount++;
            salesSummary.verifiedLiveVolumeTRY += price;
          }
          if (det.type && det.type in salesSummary.byProduct) {
            salesSummary.byProduct[det.type] += price;
          }
        }

        const authFailures = countEv('auth_failure');
        const rateLimited = countEv('rate_limited');
        const clientErrors = countEv('client_error');
        const serverErrors = countEv('server_error');
        const pageCounts = new Map();
        for (const e of events) {
          if (e.page) pageCounts.set(e.page, (pageCounts.get(e.page) || 0) + 1);
        }
        const topPage = [...pageCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
        const suspiciousAlerts = [];
        if (authFailures >= 5) {
          suspiciousAlerts.push({
            level: authFailures >= 15 ? 'high' : 'medium',
            code: 'AUTH_FAILURE_SPIKE',
            reason: `Seçilen aralıkta ${authFailures} başarısız giriş denemesi tespit edildi (olası parola denemesi / brute-force).`,
            count: authFailures,
          });
        }
        if (rateLimited >= 3) {
          suspiciousAlerts.push({
            level: 'high',
            code: 'RATE_LIMIT_BURST',
            reason: `${rateLimited} istek hız sınırı (HTTP 429) tarafından engellendi.`,
            count: rateLimited,
          });
        }
        if (topPage && topPage[1] >= 120) {
          suspiciousAlerts.push({
            level: 'medium',
            code: 'PAGE_LOAD_ANOMALY',
            reason: `"${topPage[0]}" sayfasında olağandışı trafik yoğunluğu (${topPage[1]} olay).`,
            count: topPage[1],
          });
        }

        // Daily trend buckets (up to last 7 days in range)
        const dailyMap = new Map();
        const dayCount = Math.min(14, Math.max(1, Math.ceil((untilMs - sinceMs) / 86_400_000)));
        for (let i = dayCount - 1; i >= 0; i--) {
          const d = new Date(untilMs - i * 86_400_000).toISOString().slice(0, 10);
          dailyMap.set(d, { date: d, visits: 0, bookings: 0, errors: 0 });
        }
        for (const e of events) {
          const d = new Date(e.created_at).toISOString().slice(0, 10);
          const slot = dailyMap.get(d);
          if (!slot) continue;
          if (e.event_type === 'page_view' || e.event_type === 'search') slot.visits++;
          if (e.event_type === 'client_error' || e.event_type === 'server_error') slot.errors++;
        }
        for (const r of bkRows) {
          const d = new Date(r.created_at).toISOString().slice(0, 10);
          const slot = dailyMap.get(d);
          if (slot) slot.bookings++;
        }

        const includeActivity = url.searchParams.get('activity') === '1';
        if (includeActivity && user.role !== 'admin' && !(hasPerm(user, 'bookings.view_all') && hasPerm(user, 'analytics.view'))) {
          fail(403, 'Hesap hareketlerini görme yetkiniz yok.');
        }
        const activity = includeActivity ? {
          accounts: db.prepare(`
            SELECT e.id, e.event_type AS event, e.created_at AS occurredAt,
              json_extract(e.metadata, '$.method') AS method,
              json_extract(e.metadata, '$.device') AS device, u.email
            FROM analytics_events e
            JOIN users u ON u.id = json_extract(e.metadata, '$.accountId')
            WHERE e.event_type IN ('user_login', 'user_register') AND e.created_at BETWEEN ? AND ?
            ORDER BY e.created_at DESC LIMIT 60
          `).all(sinceMs, untilMs),
          journeys: db.prepare(`
            WITH steps AS (
              SELECT substr(session_hash, 1, 10) AS session, created_at AS occurredAt,
                event_type AS step, CASE WHEN product_type IN ('Uçak', 'Otel', 'Transfer', 'Tur') THEN product_type ELSE '' END AS product,
                ROW_NUMBER() OVER (PARTITION BY session_hash ORDER BY created_at DESC, rowid DESC) AS position
              FROM analytics_events
              WHERE session_hash <> '' AND created_at BETWEEN ? AND ?
                AND event_type IN ('search', 'select', 'passenger_form', 'checkout_submit', 'checkout_error', 'booking_complete')
            )
            SELECT session, occurredAt, step, product FROM steps
            WHERE position = 1 ORDER BY occurredAt DESC LIMIT 60
          `).all(sinceMs, untilMs),
        } : undefined;
        send(res, 200, {
          range,
          since: new Date(sinceMs).toISOString(),
          until: new Date(untilMs).toISOString(),
          members: {
            totalUsers,
            activeOrganizations: activeOrgs,
            loginsInPeriod: countEv('user_login'),
          },
          funnel: {
            pageViews: countEv('page_view'),
            searches: countEv('search'),
            selections: countEv('select'),
            passengerForms: countEv('passenger_form'),
            checkoutSubmits: countEv('checkout_submit'),
            bookingsCreated: seenBookingIds.size,
          },
          sales: salesSummary,
          health: {
            clientErrors,
            serverErrors,
            authFailures,
            rateLimited,
            suspiciousAlerts,
          },
          dailyTrend: [...dailyMap.values()],
          activity,
          integrations: {
            posthog: { configured: Boolean(process.env.POSTHOG_KEY?.trim()), host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com', piiBlocked: true },
            cloudflare: { configured: Boolean(process.env.CLOUDFLARE_ZONE_ID?.trim()), trustProxy: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true' },
            sentry: { configured: Boolean(process.env.SENTRY_DSN?.trim()), piiScrubbed: true },
          },
        });
      } else if (method === 'GET' && path === '/api/admin/xml-showcase/status') {
        let status = readXmlShowcaseStatus(db);
        if (!status) {
          const synced = await runXmlShowcaseSync(db, { trigger: 'initial-boot', fetchLive: false });
          status = synced.status;
        }
        const hotelsRow = db.prepare("SELECT value FROM settings WHERE key = 'catalog:hotels'").get();
        const toursRow = db.prepare("SELECT value FROM settings WHERE key = 'catalog:tours'").get();
        const hotels = hotelsRow ? JSON.parse(hotelsRow.value).items : [];
        const tours = toursRow ? JSON.parse(toursRow.value).items : [];
        send(res, 200, { status, hotels, tours });
      } else if (method === 'POST' && path === '/api/admin/xml-showcase/sync') {
        const result = await runXmlShowcaseSync(db, { trigger: 'manual-admin', fetchLive: process.env.NODE_ENV !== 'test' });
        writeAuditLog(db, { actorEmail: user.email, action: 'admin:xml_showcase_sync', target: `hotels:${result.hotels.length},tours:${result.tours.length}`, ip });
        send(res, 200, result);
      } else if (method === 'GET' && path === '/api/admin/audit') {
        const rows = db.prepare('SELECT id, actor_email, action, target, ip, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 150').all();
        send(res, 200, { logs: rows });
      } else {
        fail(404, 'İşlem bulunamadı.');
      }
    } catch (error) {
      if (error instanceof RequestError && error.status === 429) {
        recordAnalyticsEvent(db, { eventType: 'rate_limited', page: path, metadata: { method } });
      }
      if (!(error instanceof RequestError)) {
        recordAnalyticsEvent(db, { eventType: 'server_error', page: path, metadata: { method, name: error?.name || 'Error' } });
        console.error('API error:', method, path, error.name, error.code ?? '');
      }
      if (!res.headersSent && !res.destroyed) {
        send(res, error.status ?? 500, { message: error instanceof RequestError ? error.message : 'Sunucu işlemi tamamlayamadı.' });
      }
    }
    return true;
  };
}
