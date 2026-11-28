import { createHash, randomBytes } from 'node:crypto';
import { sendMail } from './mailer.mjs';
import { writeAuditLog } from './store.mjs';

const customerKinds = new Set(['cancel', 'change', 'refund']);
const operatorKinds = new Set(['ticketing_issue', 'schedule_change', 'payment_mismatch']);
const scopes = new Set(['all', 'outbound', 'return']);
const transitions = {
  received: ['in_review', 'rejected'],
  in_review: ['in_review', 'completed', 'rejected'],
};
const hash = (value) => createHash('sha256').update(value).digest('hex');

function serviceRecord(row, admin = false) {
  return {
    id: row.id,
    kind: row.kind,
    scope: row.scope,
    passenger: row.passenger,
    requestedDate: row.requested_date,
    status: row.status,
    feeKurus: row.fee_kurus,
    refundKurus: row.refund_kurus,
    updatedAt: row.updated_at,
    ...(admin ? {
      pnr: row.pnr,
      revision: row.revision,
      reference: row.reference,
      contactedAt: row.contacted_at,
    } : {}),
  };
}

export function createBookingService({ db, normalizeSurname, fail, sendServiceMail = sendMail }) {
  const findBooking = db.prepare('SELECT * FROM bookings WHERE pnr = ? AND surname = ?');
  const requestById = db.prepare(`
    SELECT r.*, b.pnr FROM booking_service_requests r
    JOIN bookings b ON b.id = r.booking_id WHERE r.id = ?
  `);
  const active = db.prepare(`
    SELECT * FROM booking_service_requests
    WHERE booking_id = ? AND kind = ? AND scope = ? AND passenger = ? AND status IN ('received', 'in_review')
  `);
  const claimCode = db.prepare(`
    INSERT INTO booking_service_access (booking_id, code_hash, issued_at, expires_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(booking_id) DO UPDATE SET code_hash = excluded.code_hash, issued_at = excluded.issued_at,
      expires_at = excluded.expires_at, attempts = 0 WHERE booking_service_access.issued_at <= ?
  `);
  const save = db.prepare(`
    INSERT INTO booking_service_requests (id, booking_id, kind, scope, passenger, requested_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING *
  `);
  const startRequest = (booking, kind, scope, passenger, date, now) =>
    save.get(randomBytes(12).toString('hex'), booking.id, kind, scope, passenger, date, now, now) ||
    active.get(booking.id, kind, scope, passenger);

  function money(value) {
    if (value == null) return null;
    if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000) fail(400, 'Tutar geçersiz.');
    return value;
  }

  return async ({ admin, action, method, body, user, ip, access, query }) => {
    const now = Date.now();
    if (!admin) {
      const pnr = typeof body.pnr === 'string' ? body.pnr.trim().toUpperCase() : '';
      const surname = normalizeSurname(body.surname);
      const booking = findBooking.get(pnr, surname);
      const details = booking ? JSON.parse(booking.details) : {};
      if (action === 'access') {
        const to = details.contactEmail;
        if (details.type === 'Uçak' && typeof to === 'string' && to.includes('@')) {
          const code = randomBytes(6).toString('hex').toUpperCase();
          const claimed = claimCode.run(booking.id, hash(code), now, now + 20 * 60_000, now - 60_000);
          if (claimed.changes) {
            await sendServiceMail({
              to,
              subject: 'FlyToAspan · Bilet İşlemleri / Ticket services / Операции с билетом / Билет операциялары',
              html: '<p>Doğrulama kodu / Access code / Код доступа / Кіру коды</p><p><strong>' + code + '</strong></p><p>20 dakika / minutes / минут / минут</p>',
            });
          }
        }
        return { ok: true };
      }

      if (!booking || details.type !== 'Uçak') fail(404, 'Uçuş rezervasyonu bulunamadı.');
      if (!user || booking.owner_id !== user.id) {
        const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
        const stored = db.prepare('SELECT * FROM booking_service_access WHERE booking_id = ? AND expires_at > ?').get(booking.id, now);
        if (!stored || stored.attempts >= 6 || !/^[A-F0-9]{12}$/.test(code)) {
          fail(403, 'E-posta doğrulama kodu gerekli veya süresi dolmuş.');
        }
        if (stored.code_hash !== hash(code)) {
          db.prepare('UPDATE booking_service_access SET attempts = attempts + 1 WHERE booking_id = ?').run(booking.id);
          fail(403, 'E-posta doğrulama kodu geçersiz.');
        }
      }

      const hasReturn = Boolean(details.returnDate || details.legs?.some((leg) => leg.direction === 'Dönüş'));
      const passengerCount = details.passengersDetail?.length || details.passengersList?.length || 1;
      if (action === 'list') {
        const rows = db.prepare('SELECT * FROM booking_service_requests WHERE booking_id = ? ORDER BY created_at DESC, id DESC LIMIT 100').all(booking.id);
        return { requests: rows.map((row) => serviceRecord(row)), hasReturn, passengerCount };
      }
      const { kind, scope, passenger = 0, requestedDate = '' } = body;
      if (!customerKinds.has(kind) || !scopes.has(scope)) fail(400, 'Talep türü veya kapsamı geçersiz.');
      if (scope === 'return' && !hasReturn) fail(400, 'Bu kayıtta dönüş uçuşu yok.');
      if (!Number.isInteger(passenger) || passenger < 0 || passenger > passengerCount) fail(400, 'Yolcu sırası geçersiz.');
      if (requestedDate !== '') {
        const parsedDate = typeof requestedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
          ? new Date(requestedDate) : new Date(NaN);
        if (kind !== 'change' || !Number.isFinite(parsedDate.valueOf()) ||
            parsedDate.toISOString().slice(0, 10) !== requestedDate) fail(400, 'Talep edilen tarih geçersiz.');
      }
      if (booking.status === 'İade Edildi' || (booking.status === 'İptal Edildi' && kind !== 'refund')) {
        fail(409, 'Bu rezervasyon için yeni iptal veya değişiklik talebi açılamaz.');
      }
      const row = startRequest(booking, kind, scope, passenger, requestedDate, now);
      return { request: serviceRecord(row) };
    }

    if (method === 'GET' && action === 'booking-service') {
      const pageRaw = Number(query.get('page'));
      const page = Number.isSafeInteger(pageRaw) ? Math.min(10000, Math.max(1, pageRaw)) : 1;
      const archived = query.get('closed') === '1';
      const rows = db.prepare(`
        SELECT r.*, b.pnr FROM booking_service_requests r JOIN bookings b ON b.id = r.booking_id
        WHERE (r.status IN ('completed', 'rejected')) = ?
        ORDER BY r.updated_at DESC, r.id DESC LIMIT 51 OFFSET ?
      `).all(Number(archived), (page - 1) * 50);
      const canReadReferences = access.operator || access.refunds;
      return {
        requests: rows.slice(0, 50).map((row) => serviceRecord(canReadReferences ? row : {
          ...row, pnr: '••••' + row.pnr.slice(-4), reference: '',
        }, true)),
        hasNext: rows.length > 50,
      };
    }
    if (method === 'POST' && action === 'booking-service') {
      if (!access.operator) fail(403, 'Operasyon kaydı açma yetkiniz yok.');
      const pnr = typeof body.pnr === 'string' ? body.pnr.trim().toUpperCase() : '';
      const booking = db.prepare('SELECT * FROM bookings WHERE pnr = ?').get(pnr);
      if (!booking || JSON.parse(booking.details).type !== 'Uçak') fail(404, 'Uçuş rezervasyonu bulunamadı.');
      if (!operatorKinds.has(body.kind)) fail(400, 'Operasyon kaydı türü geçersiz.');
      const row = startRequest(booking, body.kind, 'all', 0, '', now);
      return { request: serviceRecord({ ...row, pnr }, true) };
    }
    if (method !== 'PATCH' || action === 'booking-service') fail(404, 'İşlem bulunamadı.');
    const row = requestById.get(action);
    if (!row) fail(404, 'Talep bulunamadı.');
    const financial = ['cancel', 'refund', 'payment_mismatch', 'ticketing_issue'].includes(row.kind);
    if (!access.operator && !(access.refunds && financial)) fail(403, 'Bu talebi güncelleme yetkiniz yok.');
    if (row.revision !== body.revision || !transitions[row.status]?.includes(body.status)) {
      fail(409, 'Talep değişmiş veya kapanmış. Listeyi yenileyin.');
    }
    const fee = money(body.feeKurus);
    const refund = money(body.refundKurus);
    if (refund !== null && !financial) fail(400, 'Bu talebe iade tutarı girilemez.');
    const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
    if (reference && !/^[a-zA-Z0-9._/-]{1,64}$/.test(reference)) fail(400, 'İşlem referansı geçersiz.');
    const closing = body.status === 'completed' || body.status === 'rejected';
    if (closing && body.contacted !== true) fail(400, 'Talebi kapatmadan önce yolcuyu bilgilendirin.');
    const contactedAt = closing ? now : null;
    if (body.status === 'completed' && (operatorKinds.has(row.kind) || (refund ?? 0) > 0) && !reference) {
      fail(400, 'Talebi kapatmadan önce sağlayıcı veya POS işlem referansını girin.');
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const updated = db.prepare(`
        UPDATE booking_service_requests SET status = ?, fee_kurus = ?, refund_kurus = ?, reference = ?,
          contacted_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND revision = ?
      `).run(body.status, fee, refund, reference, contactedAt, now, action, body.revision);
      if (!updated.changes) fail(409, 'Talep başka bir oturumda güncellendi.');
      writeAuditLog(db, { actorEmail: user.email, action: 'admin:booking_service:' + body.status, target: row.pnr + ':' + action, ip });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { request: serviceRecord(requestById.get(action), true) };
  };
}
