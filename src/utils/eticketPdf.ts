import { AIRPORTS, formatDisplayDate, formatPrice, formatTRY } from '../data/mockData';
import type { BookingRecord, CurrencyCode, LangCode } from '../types';
import { buildIataBcbpString, generateQrSvg } from './iataBcbp';

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBarcodeSvg(seed: string): string {
  const bars: string[] = [];
  let x = 0;
  for (let i = 0; i < 44; i++) {
    const code = seed.charCodeAt(i % seed.length) + i * 17;
    const w = (code % 3) + 1.5;
    if (i % 2 === 0 || code % 5 !== 0) {
      bars.push(`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="42" fill="#0B1E33" />`);
    }
    x += w + ((code % 2) + 1.2);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(x)} 42" width="190" height="42" aria-hidden="true">${bars.join('')}</svg>`;
}

function normalizeCityToken(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CITY_ALIASES: Array<{ keywords: string[]; label: string; code: string }> = [
  ...AIRPORTS.map((a) => ({
    keywords: [normalizeCityToken(a.city), a.code.toLowerCase()],
    label: `${a.city} (${a.code})`,
    code: a.code,
  })),
  { keywords: ['almaty', 'almati'], label: 'Almatı (ALA)', code: 'ALA' },
  { keywords: ['istanbul'], label: 'İstanbul (IST)', code: 'IST' },
  { keywords: ['antalya'], label: 'Antalya (AYT)', code: 'AYT' },
  { keywords: ['ankara'], label: 'Ankara (ESB)', code: 'ESB' },
  { keywords: ['izmir'], label: 'İzmir (ADB)', code: 'ADB' },
  { keywords: ['bodrum'], label: 'Bodrum (BJV)', code: 'BJV' },
  { keywords: ['trabzon'], label: 'Trabzon (TZX)', code: 'TZX' },
  { keywords: ['astana', 'nursultan'], label: 'Astana (NQZ)', code: 'NQZ' },
  { keywords: ['shymkent', 'cimkent'], label: 'Çimkent (CIT)', code: 'CIT' },
  { keywords: ['dubai'], label: 'Dubai (DXB)', code: 'DXB' },
  { keywords: ['london', 'londra'], label: 'Londra (LHR)', code: 'LHR' },
  { keywords: ['baku'], label: 'Bakü (GYD)', code: 'GYD' },
  { keywords: ['tashkent', 'taskent'], label: 'Taşkent (TAS)', code: 'TAS' },
  { keywords: ['sharm', 'sarm'], label: 'Şarm El-Şeyh (SSH)', code: 'SSH' },
  { keywords: ['batumi', 'batum'], label: 'Batum (BUS)', code: 'BUS' },
  { keywords: ['paris'], label: 'Paris (CDG)', code: 'CDG' },
  { keywords: ['amsterdam'], label: 'Amsterdam (AMS)', code: 'AMS' },
  { keywords: ['frankfurt'], label: 'Frankfurt (FRA)', code: 'FRA' },
  { keywords: ['doha'], label: 'Doha (DOH)', code: 'DOH' },
];

function resolveRouteEndpoints(booking: BookingRecord): { fromLabel: string; toLabel: string } {
  // 1. Explicit legs
  if (booking.legs && booking.legs.length > 0) {
    const first = booking.legs[0];
    const fromAp = AIRPORTS.find((a) => a.code === first.fromCode);
    const toAp = AIRPORTS.find((a) => a.code === first.toCode);
    return {
      fromLabel: fromAp ? `${fromAp.city} (${fromAp.code})` : first.fromCode,
      toLabel: toAp ? `${toAp.city} (${toAp.code})` : first.toCode,
    };
  }

  // 2. Explicit separator like "İstanbul (IST) → Almatı (ALA)" or "Antalya - Almaty"
  const arrowParts = booking.title
    .split(/\s*(?:→|->|↔|—|–|\/|\s-\s)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (arrowParts.length >= 2) {
    return { fromLabel: arrowParts[0], toLabel: arrowParts[1] };
  }

  // 3. Explicit IATA codes in parentheses e.g. "(AYT)" "(ALA)"
  const iataMatches = Array.from(booking.title.matchAll(/\(([A-Z]{3})\)/g)).map((m) => m[1]);
  if (iataMatches.length >= 2) {
    const fromAp = AIRPORTS.find((a) => a.code === iataMatches[0]);
    const toAp = AIRPORTS.find((a) => a.code === iataMatches[1]);
    return {
      fromLabel: fromAp ? `${fromAp.city} (${fromAp.code})` : iataMatches[0],
      toLabel: toAp ? `${toAp.city} (${toAp.code})` : iataMatches[1],
    };
  }

  // 4. Match known cities/codes in order of appearance in title (handles "ANTALYA ALMATY"!)
  const normTitle = normalizeCityToken(booking.title);
  const hits: Array<{ pos: number; label: string; code: string }> = [];
  const seenCodes = new Set<string>();
  for (const entry of CITY_ALIASES) {
    if (seenCodes.has(entry.code)) continue;
    for (const kw of entry.keywords) {
      if (kw.length < 3) continue;
      const idx = normTitle.indexOf(kw);
      if (idx !== -1) {
        hits.push({ pos: idx, label: entry.label, code: entry.code });
        seenCodes.add(entry.code);
        break;
      }
    }
  }
  hits.sort((a, b) => a.pos - b.pos);
  if (hits.length >= 2) {
    return { fromLabel: hits[0].label, toLabel: hits[1].label };
  }

  // 5. Fallback: split two-word title cleanly ("ANTALYA ALMATY" -> "ANTALYA" / "ALMATY")
  const words = booking.title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 2) {
    return { fromLabel: words[0], toLabel: words[1] };
  }

  return { fromLabel: booking.title, toLabel: '' };
}

function extractTimeRange(booking: BookingRecord): { departTime: string; arriveTime: string } {
  if (booking.departTime || booking.arriveTime) {
    return {
      departTime: booking.departTime || '—',
      arriveTime: booking.arriveTime || '—',
    };
  }
  const combined = `${booking.subtitle} ${booking.title}`;
  const m = combined.match(/(\d{1,2}:\d{2})\s*(?:-|–|—|→|->)\s*(\d{1,2}:\d{2})/);
  if (m) {
    return { departTime: m[1], arriveTime: m[2] };
  }
  return { departTime: '—', arriveTime: '—' };
}

function extractAirlineAndFlight(booking: BookingRecord): { airlineName: string; flightNo: string } {
  const subParts = booking.subtitle.split('·').map((s) => s.trim()).filter(Boolean);
  const flightNoFromSub =
    subParts.find((p) => /^[A-Z0-9]{2}\s?\d{2,4}$/i.test(p)) ||
    (booking.subtitle.match(/\b([A-Z]{2}\s?\d{2,4})\b/)?.[1] ?? '');

  const flightNo = booking.flightNumber || flightNoFromSub;

  if (booking.airline) {
    return { airlineName: booking.airline, flightNo };
  }

  // Clean raw airline text by stripping any embedded time range or flight code
  const rawFirst = (subParts[0] || booking.subtitle || '')
    .replace(/(\d{1,2}:\d{2})\s*(?:-|–|—|→|->)\s*(\d{1,2}:\d{2})/g, '')
    .replace(/\b[A-Z]{2}\s?\d{2,4}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { airlineName: rawFirst || booking.type, flightNo };
}

function extractBaggage(booking: BookingRecord): string {
  if (booking.baggage) return booking.baggage;
  const m = booking.subtitle.match(/(\d+\s*kg(?:\s*[A-Za-zÇĞİÖŞÜçğıöşü]+)?)/i);
  return m ? m[1] : '';
}

function formatGenderLabel(g?: string, lang: LangCode = 'TR'): string {
  if (!g) return '—';
  const low = g.toLowerCase();
  const isMale = low === 'm' || low === 'male' || low === 'erkek' || low === 'bay';
  const isFemale = low === 'f' || low === 'female' || low === 'kadın' || low === 'kadin' || low === 'bayan';
  if (isMale) return lang === 'EN' ? 'Male' : lang === 'RU' ? 'Муж.' : lang === 'KK' ? 'Ер' : 'Erkek';
  if (isFemale) return lang === 'EN' ? 'Female' : lang === 'RU' ? 'Жен.' : lang === 'KK' ? 'Әйел' : 'Kadın';
  return g;
}

export function buildBrandedEticketHtml(
  booking: BookingRecord,
  options: { currency?: CurrencyCode; lang?: LangCode; origin?: string } = {}
): string {
  const currency = options.currency ?? 'TRY';
  const lang = options.lang ?? 'TR';
  const isDemo = booking.demo !== false;
  const docTitle = isDemo
    ? (lang === 'EN'
        ? 'DEMO RESERVATION SUMMARY (NOT AN ISSUED TICKET)'
        : lang === 'RU'
          ? 'ДЕМО-РЕЗЮМЕ БРОНИРОВАНИЯ (НЕ ЯВЛЯЕТСЯ БИЛЕТОМ)'
          : lang === 'KK'
            ? 'ДЕМО БРОНДАУ ҚОРЫТЫНДЫСЫ (НАҚТЫ БИЛЕТ ЕМЕС)'
            : 'DENEME REZERVASYON ÖZETİ (GERÇEK BİLET DEĞİLDİR)')
    : booking.type === 'Uçak'
      ? 'ELEKTRONİK UÇAK BİLETİ & FATURA ÖZETİ'
      : booking.type === 'Otel'
        ? 'OTEL KONAKLAMA VOUCHER & REZERVASYON BELGESİ'
        : booking.type === 'Tur'
          ? 'TUR PAKETİ REZERVASYON VOUCHER'
          : 'VIP HAVALİMANI TRANSFER VOUCHER';

  const statusColor =
    booking.status === 'Onaylandı' || booking.status === 'Tamamlandı'
      ? '#059669'
      : booking.status === 'İptal Talebi'
        ? '#D97706'
        : '#BE123C';

  const locale = lang === 'EN' ? 'en-GB' : lang === 'RU' ? 'ru-RU' : lang === 'KK' ? 'kk-KZ' : 'tr-TR';
  const issuedAt = booking.createdAt
    ? new Date(booking.createdAt).toLocaleString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });

  const travelDateStr =
    formatDisplayDate(booking.date, lang) +
    (booking.returnDate ? ` → ${formatDisplayDate(booking.returnDate, lang)}` : '');

  const eticketNo = booking.eticketNumber || `235-${booking.pnr.replace(/[^A-Z0-9]/g, '').slice(0, 8)}01`;
  const barcodeSvg = buildBarcodeSvg(booking.pnr + eticketNo);
  const originUrl = options.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const logoUrl = originUrl ? `${originUrl}/images/logo-light.png` : '/images/logo-light.png';

  const { fromLabel, toLabel } = resolveRouteEndpoints(booking);
  const { departTime, arriveTime } = extractTimeRange(booking);
  const { airlineName, flightNo } = extractAirlineAndFlight(booking);
  const durationText = booking.duration || '';
  const baggageText = extractBaggage(booking);
  const cabinText =
    booking.cabin ||
    (booking.subtitle.toLowerCase().includes('business') ? 'Business Class' : '');

  const hasExplicitFlightSegment =
    booking.type === 'Uçak' &&
    Boolean((booking.legs && booking.legs.length > 0) || departTime !== '—' || arriveTime !== '—' || flightNo || fromLabel);

  const flightSegmentHtml = hasExplicitFlightSegment
    ? (booking.legs && booking.legs.length > 0
        ? booking.legs.map((leg) => {
            const fromAp = AIRPORTS.find((a) => a.code === leg.fromCode);
            const toAp = AIRPORTS.find((a) => a.code === leg.toCode);
            const legFrom = fromAp ? `${fromAp.city} (${fromAp.code})` : leg.fromCode;
            const legTo = toAp ? `${toAp.city} (${toAp.code})` : leg.toCode;
            const legBag = leg.baggage || baggageText;
            const legDur = leg.duration || durationText;
            const legCabin = leg.cabin || cabinText;
            return `<div style="margin-bottom: 14px; border: 1.5px solid #CBD5E1; border-radius: 14px; overflow: hidden;">
            <div style="background: #0B1E33; color: #fff; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700;">
              <span>✈ ${escapeHtml(leg.direction.toUpperCase())} · ${escapeHtml(leg.airline)}${leg.flightNumber ? ` (${escapeHtml(leg.flightNumber)})` : ''}</span>
              ${legCabin ? `<span style="color: #F2C85C;">${escapeHtml(legCabin)}</span>` : ''}
            </div>
            <div style="padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #F8FAFC;">
              <div>
                <div class="lbl">Kalkış</div>
                <div style="font-size: 26px; font-weight: 900; color: #0B1E33; line-height: 1.1;">${escapeHtml(leg.departTime || '—')}</div>
                <div style="font-size: 13px; font-weight: 700; color: #0369A1; margin-top: 3px;">${escapeHtml(legFrom)} · ${escapeHtml(formatDisplayDate(leg.date, lang))}</div>
              </div>
              <div style="flex: 1; text-align: center; padding: 0 10px;">
                ${legDur ? `<div style="font-size: 11.5px; font-weight: 700; color: #64748B; margin-bottom: 4px;">${escapeHtml(legDur)}</div>` : ''}
                <div style="height: 2px; background: linear-gradient(90deg, #00A8B5, #E0AA36); position: relative;"></div>
                ${legBag ? `<div style="font-size: 11px; color: #047857; font-weight: 700; margin-top: 5px;">Bagaj: ${escapeHtml(legBag)}</div>` : ''}
              </div>
              <div style="text-align: right;">
                <div class="lbl">Varış</div>
                <div style="font-size: 26px; font-weight: 900; color: #0B1E33; line-height: 1.1;">${escapeHtml(leg.arriveTime || '—')}</div>
                <div style="font-size: 13px; font-weight: 700; color: #0369A1; margin-top: 3px;">${escapeHtml(legTo)} · ${escapeHtml(formatDisplayDate(leg.date, lang))}</div>
              </div>
            </div>
          </div>`;
          }).join('')
        : `<div style="margin-bottom: 20px; border: 1.5px solid #CBD5E1; border-radius: 14px; overflow: hidden;">
        <div style="background: #0B1E33; color: #fff; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700;">
          <span>✈ UÇUŞ BİLGİLERİ · ${escapeHtml(airlineName)}${flightNo ? ` (${escapeHtml(flightNo)})` : ''}</span>
          ${cabinText ? `<span style="color: #F2C85C;">${escapeHtml(cabinText)}</span>` : ''}
        </div>
        <div style="padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #F8FAFC;">
          <div>
            <div class="lbl">Kalkış</div>
            <div style="font-size: 26px; font-weight: 900; color: #0B1E33; line-height: 1.1;">${escapeHtml(departTime)}</div>
            <div style="font-size: 13px; font-weight: 700; color: #0369A1; margin-top: 3px;">${escapeHtml(fromLabel)} · ${escapeHtml(formatDisplayDate(booking.date, lang))}</div>
          </div>
          <div style="flex: 1; text-align: center; padding: 0 10px;">
            ${durationText ? `<div style="font-size: 11.5px; font-weight: 700; color: #64748B; margin-bottom: 4px;">${escapeHtml(durationText)}</div>` : ''}
            <div style="height: 2px; background: linear-gradient(90deg, #00A8B5, #E0AA36); position: relative;"></div>
            ${baggageText ? `<div style="font-size: 11px; color: #047857; font-weight: 700; margin-top: 5px;">Bagaj: ${escapeHtml(baggageText)}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <div class="lbl">Varış</div>
            <div style="font-size: 26px; font-weight: 900; color: #0B1E33; line-height: 1.1;">${escapeHtml(arriveTime)}</div>
            <div style="font-size: 13px; font-weight: 700; color: #0369A1; margin-top: 3px;">${escapeHtml(toLabel || fromLabel)} · ${escapeHtml(formatDisplayDate(booking.date, lang))}</div>
          </div>
        </div>
      </div>`)
    : '';

  const passengersDetailHtml =
    booking.passengersDetail && booking.passengersDetail.length > 0
      ? `<div style="margin-bottom: 20px; border: 1px solid #CBD5E1; border-radius: 12px; overflow: hidden;">
          <div style="background: #F1F5F9; padding: 9px 16px; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #334155; border-bottom: 1px solid #E2E8F0;">
            Yolcu Bilgileri (${booking.passengersDetail.length} Kişi)
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #F8FAFC; color: #64748B; text-align: left; border-bottom: 1px solid #E2E8F0;">
                <th style="padding: 8px 12px;">Ad Soyad / Uyruk</th>
                <th style="padding: 8px 12px;">Doğum Tarihi</th>
                <th style="padding: 8px 12px;">Belge Tipi &amp; No</th>
                <th style="padding: 8px 12px;">Geçerlilik</th>
                <th style="padding: 8px 12px;">Cinsiyet / Tip</th>
              </tr>
            </thead>
            <tbody>
              ${booking.passengersDetail
                .map((p) => {
                  const docTypeLbl = p.documentType === 'pasaport' ? 'Pasaport' : p.documentType === 'kimlik' ? 'Kimlik' : 'Belge';
                  const validityParts = [
                    p.passportIssueDate ? `Başl: ${formatDisplayDate(p.passportIssueDate, lang)}` : '',
                    p.passportExpiryDate ? `Bitiş: ${formatDisplayDate(p.passportExpiryDate, lang)}` : '',
                  ].filter(Boolean);
                  return `<tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="padding: 9px 12px; font-weight: 700; color: #0F172A;">
                      ${escapeHtml(p.fullName)}
                      ${p.nationality ? `<div style="font-size: 11px; font-weight: 600; color: #64748B;">${escapeHtml(p.nationality)}</div>` : ''}
                    </td>
                    <td style="padding: 9px 12px; color: #334155;">${p.birthDate ? escapeHtml(formatDisplayDate(p.birthDate, lang)) : '—'}</td>
                    <td style="padding: 9px 12px; color: #334155;">
                      <span style="font-size: 10.5px; font-weight: 800; color: #0369A1;">${escapeHtml(docTypeLbl)}</span><br/>
                      <span style="font-family: ui-monospace, monospace;">${escapeHtml(p.tcOrPassport || '—')}</span>
                    </td>
                    <td style="padding: 9px 12px; color: #334155; font-size: 11.5px;">
                      ${validityParts.length > 0 ? escapeHtml(validityParts.join(' · ')) : '—'}
                      ${p.passportCountry ? `<div style="font-size: 10.5px; color: #64748B;">${escapeHtml(p.passportCountry)}${p.passportIssuer ? ` · ${escapeHtml(p.passportIssuer)}` : ''}</div>` : ''}
                    </td>
                    <td style="padding: 9px 12px; color: #334155;">${escapeHtml(formatGenderLabel(p.gender, lang))} · ${escapeHtml(p.paxType || 'Yetişkin')}</td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>`
      : '';

  const contactParts = [
    booking.contactPhone ? `Tel: ${escapeHtml(booking.contactPhone)}` : '',
    booking.contactEmail ? `E-Posta: ${escapeHtml(booking.contactEmail)}` : '',
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang.toLowerCase())}">
<head>
  <meta charset="UTF-8" />
  <title>FlyToAspan_EBilet_${escapeHtml(booking.pnr)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #F1F5F9;
      color: #0F172A;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #0B1E33;
      color: #fff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 16px rgba(11, 30, 51, 0.25);
    }
    .toolbar button {
      background: linear-gradient(135deg, #F2C85C, #E0AA36);
      color: #0B1E33;
      border: none;
      border-radius: 10px;
      padding: 9px 18px;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
    }
    .toolbar .close-btn {
      background: rgba(255,255,255,0.14);
      color: #fff;
      margin-left: 8px;
    }
    .sheet {
      max-width: 794px;
      margin: 24px auto;
      background: #FFFFFF;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 12px 36px rgba(15, 23, 42, 0.12);
      border: 1px solid #E2E8F0;
    }
    .hero {
      background: linear-gradient(135deg, #0B1E33 0%, #10324F 65%, #0D4B5E 100%);
      color: #FFFFFF;
      padding: 26px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .hero img { height: 42px; width: auto; display: block; }
    .hero-sub { font-size: 11px; letter-spacing: 1.4px; color: #F2C85C; font-weight: 700; margin-top: 6px; }
    .status-pill {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      background: ${statusColor};
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.4px;
    }
    .pnr-band {
      background: #F8FAFC;
      border-bottom: 1px dashed #CBD5E1;
      padding: 20px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .pnr-code {
      font-size: 30px;
      font-weight: 900;
      letter-spacing: 2.5px;
      color: #0B1E33;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748B; font-weight: 700; margin-bottom: 4px; }
    .body { padding: 26px 32px; }
    .route-title { font-size: 22px; font-weight: 800; color: #0B1E33; margin: 0 0 6px; }
    .route-sub { font-size: 13.5px; color: #475569; margin: 0 0 22px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-bottom: 22px;
    }
    .box {
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
      background: #F8FAFC;
    }
    .val { font-size: 14.5px; font-weight: 700; color: #0F172A; }
    .price-box {
      background: linear-gradient(135deg, rgba(0, 168, 181, 0.08), rgba(224, 170, 54, 0.08));
      border: 1.5px solid #00A8B5;
      border-radius: 14px;
      padding: 18px 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 22px;
    }
    .price-main { font-size: 26px; font-weight: 900; color: #0B1E33; }
    .notes {
      padding: 14px 16px;
      border-radius: 12px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      font-size: 12px;
      line-height: 1.55;
      color: #78350F;
    }
    .footer {
      border-top: 1px solid #E2E8F0;
      padding: 16px 32px;
      background: #F8FAFC;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      color: #64748B;
      flex-wrap: wrap;
      gap: 8px;
    }
    @media print {
      body { background: #FFFFFF; }
      .toolbar { display: none !important; }
      .sheet { margin: 0; box-shadow: none; border: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div><strong>FlyToAspan</strong> · E-Bilet &amp; Voucher Önizleme (${escapeHtml(booking.pnr)})</div>
    <div>
      <button type="button" onclick="window.print()">PDF Olarak Kaydet / Yazdır</button>
      <button type="button" class="close-btn" onclick="window.close()">Kapat</button>
    </div>
  </div>

  <div class="sheet">
    <div class="hero">
      <div>
        <img src="${escapeHtml(logoUrl)}" alt="FlyToAspan" onerror="this.style.display='none'" />
        <div class="hero-sub">${escapeHtml(docTitle)}</div>
      </div>
      <div style="text-align: right;">
        <span class="status-pill">${escapeHtml(booking.status.toUpperCase())}</span>
        <div style="font-size: 11.5px; color: #CBD5E1; margin-top: 6px;">Düzenlenme: ${escapeHtml(issuedAt)}</div>
      </div>
    </div>

    <div class="pnr-band">
      <div>
        <div class="lbl">Rezervasyon Kodu (PNR)</div>
        <div class="pnr-code">${escapeHtml(booking.pnr)}</div>
      </div>
      <div>
        <div class="lbl">E-Bilet / Belge No</div>
        <div class="val" style="font-family: ui-monospace, monospace;">${escapeHtml(eticketNo)}</div>
      </div>
      <div style="text-align: right;">
        ${barcodeSvg}
      </div>
    </div>

    <div class="body">
      <h1 class="route-title">${escapeHtml(booking.title)}</h1>
      <p class="route-sub">${escapeHtml(booking.subtitle)}</p>

      ${flightSegmentHtml}
      ${passengersDetailHtml}

      <div class="grid">
        <div class="box">
          <div class="lbl">Yolcu / Rezervasyon Sahibi</div>
          <div class="val">${escapeHtml(booking.passenger)}</div>
          ${contactParts.length > 0 ? `<div style="font-size: 12px; color: #475569; margin-top: 4px;">${contactParts.join(' · ')}</div>` : ''}
        </div>
        <div class="box">
          <div class="lbl">Seyahat / Hizmet Tarihi</div>
          <div class="val">${escapeHtml(travelDateStr)}</div>
        </div>
        <div class="box">
          <div class="lbl">Hizmet Kategorisi${booking.providerSource ? ' / Kaynak' : ''}</div>
          <div class="val">${escapeHtml(booking.type)}${booking.providerSource ? ` · ${escapeHtml(booking.providerSource)}` : ''}</div>
        </div>
        <div class="box">
          <div class="lbl">Satış Kanalı / Acente</div>
          <div class="val">${escapeHtml(booking.organizationName || 'FlyToAspan · Infinitive Travel')}${booking.sellerName ? ` (${escapeHtml(booking.sellerName)})` : ''}</div>
        </div>
      </div>

      <div class="price-box">
        <div>
          <div class="lbl" style="color: #0369A1;">Toplam Ödenen Tutar (Vergi &amp; Hizmet Bedeli Dahil)</div>
          <div style="font-size: 12px; color: #475569;">TL Karşılığı: ₺${escapeHtml(formatTRY(booking.price))}</div>
        </div>
        <div class="price-main">${escapeHtml(formatPrice(booking.price, currency))}</div>
      </div>

      <div class="notes">
        <strong>Önemli Seyahat Bilgilendirmesi:</strong> Dış hat uçuşlarında kalkıştan en az 3 saat, iç hat uçuşlarında en az 2 saat önce havalimanında bulunmanız ve geçerli kimlik/pasaportunuzu yanınızda taşımanız gerekmektedir. Online Check-In ve değişiklik işlemleri için <strong>flytoaspan.com</strong> üzerinden PNR kodunuz ve soyadınızla sorgulama yapabilirsiniz.
      </div>
    </div>

    <div class="footer">
      <div><strong>FlyToAspan by Infinitive Travel</strong> · 7/24 Destek: +90 531 460 61 75</div>
      <div>destek@flytoaspan.com · Türkiye &amp; Kazakistan Seyahat Portalı</div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 350);
    });
  </script>
</body>
</html>`;
}

export function openBrandedEticketPdf(
  booking: BookingRecord,
  options: { currency?: CurrencyCode; lang?: LangCode } = {}
): void {
  const html = buildBrandedEticketHtml(booking, options);
  const win = window.open('', '_blank', 'width=920,height=780');
  if (!win) {
    // Fallback: download standalone printable HTML file if popup blocked
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlyToAspan_EBilet_${booking.pnr}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function buildBoardingPassHtml(
  booking: BookingRecord,
  options: { lang?: LangCode; autoPrint?: boolean } = {}
): string {
  const lang = options.lang ?? 'TR';
  const bp = booking.boardingPass;
  const seat = bp?.seat || booking.assignedSeat || '—';
  const airlinePnr = bp?.airlinePnr || booking.pnr;
  const eticketNo = bp?.eticketNo || booking.eticketNumber || '';
  const firstLeg = booking.legs && booking.legs.length > 0 ? booking.legs[0] : null;
  const routeCodes = booking.title.match(/\(([A-Z]{3})\)/g)?.map((m) => m.slice(1, 4)) || [];
  const fromCode = firstLeg?.fromCode || routeCodes[0] || 'DEP';
  const toCode = firstLeg?.toCode || routeCodes[1] || 'ARR';
  const departTime = booking.departTime || firstLeg?.departTime || '—';
  const arriveTime = booking.arriveTime || firstLeg?.arriveTime || '—';
  const airline = booking.airline || firstLeg?.airline || 'FlyToAspan Flight';
  const flightNo = booking.flightNumber || firstLeg?.flightNumber || '';
  const baggage = booking.baggage || firstLeg?.baggage || '';
  const cabin = booking.cabin || firstLeg?.cabin || 'Economy';
  const seatRows =
    bp?.passengerSeats && bp.passengerSeats.length > 0
      ? bp.passengerSeats
      : [{ fullName: booking.passenger, seat, seqNo: bp?.sequenceNo || '001' }];

  const t = {
    TR: {
      printBtn: 'Biniş Kartını Yazdır / PDF Kaydet',
      closeBtn: 'Kapat',
      docLabel: 'DİJİTAL BİNİŞ KARTI · BOARDING PASS',
      checkedIn: '✓ ONLINE CHECK-IN TAMAMLANDI',
      seat: 'KOLTUK / SEAT',
      boarding: 'BİNİŞ SAATİ',
      gateClose: 'KAPI KAPANIŞ',
      gate: 'KAPI / GATE',
      terminal: 'TERMİNAL',
      zone: 'BİNİŞ GRUBU',
      seq: 'SIRA / SEQ',
      depart: 'KALKIŞ',
      arrive: 'VARIŞ',
      date: 'UÇUŞ TARİHİ',
      airlinePnr: 'HAVAYOLU PNR',
      paxTitle: 'Yolcu & Koltuk Bilgileri',
      paxName: 'Yolcu Adı Soyadı',
      baggage: 'Bagaj Hakkı',
      noteTitle: 'Havalimanı & Biniş Talimatları',
      defaultNote: 'Kayıtlı bagajınız varsa uçuş saatinden en az 2 saat önce Bag-Drop kontuarına uğrayınız. Biniş kapısı kalkıştan 20 dakika önce kapanır. Kimlik/pasaportunuzu yanınızda bulundurunuz.',
      tba: 'Havalimanı Ekranı',
    },
    EN: {
      printBtn: 'Print / Save Boarding Pass PDF',
      closeBtn: 'Close',
      docLabel: 'DIGITAL BOARDING PASS',
      checkedIn: '✓ ONLINE CHECK-IN COMPLETED',
      seat: 'SEAT',
      boarding: 'BOARDING TIME',
      gateClose: 'GATE CLOSES',
      gate: 'GATE',
      terminal: 'TERMINAL',
      zone: 'BOARDING GROUP',
      seq: 'SEQ NO',
      depart: 'DEPARTURE',
      arrive: 'ARRIVAL',
      date: 'FLIGHT DATE',
      airlinePnr: 'AIRLINE PNR',
      paxTitle: 'Passengers & Assigned Seats',
      paxName: 'Passenger Name',
      baggage: 'Baggage Allowance',
      noteTitle: 'Airport & Boarding Instructions',
      defaultNote: 'If you have checked baggage, drop it at the Bag-Drop counter at least 2 hours before departure. Boarding gate closes 20 minutes prior to departure.',
      tba: 'Check Airport Screen',
    },
    RU: {
      printBtn: 'Печать / Сохранить посадочный PDF',
      closeBtn: 'Закрыть',
      docLabel: 'ПОСАДОЧНЫЙ ТАЛОН · BOARDING PASS',
      checkedIn: '✓ ОНЛАЙН-РЕГИСТРАЦИЯ ВЫПОЛНЕНА',
      seat: 'МЕСТО / SEAT',
      boarding: 'ПОСАДКА',
      gateClose: 'ЗАКРЫТИЕ ВЫХОДА',
      gate: 'ВЫХОД / GATE',
      terminal: 'ТЕРМИНАЛ',
      zone: 'ГРУППА ПОСАДКИ',
      seq: 'SEQ №',
      depart: 'ВЫЛЕТ',
      arrive: 'ПРИЛЁТ',
      date: 'ДАТА ВЫЛЕТА',
      airlinePnr: 'PNR АВИАКОМПАНИИ',
      paxTitle: 'Пассажиры и места',
      paxName: 'Пассажир',
      baggage: 'Багаж',
      noteTitle: 'Памятка для аэропорта',
      defaultNote: 'При наличии багажа сдайте его на стойке Bag-Drop за 2 часа до вылета. Посадка закрывается за 20 минут до вылета. Не забудьте паспорт.',
      tba: 'См. табло',
    },
    KK: {
      printBtn: 'Отырғызу талонын басып шығару / PDF',
      closeBtn: 'Жабу',
      docLabel: 'ОТЫРҒЫЗУ ТАЛОНЫ · BOARDING PASS',
      checkedIn: '✓ ОНЛАЙН ТІРКЕУ АЯҚТАЛДЫ',
      seat: 'ОРЫН / SEAT',
      boarding: 'ОТЫРҒЫЗУ',
      gateClose: 'ҚАҚПА ЖАБЫЛУЫ',
      gate: 'ҚАҚПА / GATE',
      terminal: 'ТЕРМИНАЛ',
      zone: 'ОТЫРҒЫЗУ ТОБЫ',
      seq: 'SEQ №',
      depart: 'ҰШУ',
      arrive: 'ҚОНУ',
      date: 'ҰШУ КҮНІ',
      airlinePnr: 'ӘУЕКОМПАНИЯ PNR',
      paxTitle: 'Жолаушылар және орындар',
      paxName: 'Жолаушы',
      baggage: 'Жолжүк',
      noteTitle: 'Әуежай нұсқаулығы',
      defaultNote: 'Тіркелетін жолжүгіңіз болса ұшудан 2 сағат бұрын Bag-Drop тағанына келіңіз. Қақпа ұшуға 20 минут қалғанда жабылады.',
      tba: 'Таблодан қараңыз',
    },
  }[lang];

  const hasOfficialPassFile = Boolean(bp?.officialPassDataUrl);
  const isOfficialPassImage = Boolean(bp?.officialPassDataUrl && /^data:image\//i.test(bp.officialPassDataUrl));

  // If Super Admin uploaded the airline's official boarding pass image (e.g. Pegasus / THY / Air Astana),
  // present ONLY a crisp FlyToAspan confirmation header + the FULL-SIZE official airline boarding pass (never shrunk into a tiny QR box!).
  if (isOfficialPassImage && bp?.officialPassDataUrl) {
    return `<!DOCTYPE html>
<html lang="${escapeHtml(lang.toLowerCase())}">
<head>
  <meta charset="UTF-8" />
  <title>FlyToAspan_BoardingPass_${escapeHtml(airlinePnr)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #EEF2F6; color: #0F172A; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { position: sticky; top: 0; z-index: 10; background: #0B1E33; color: #fff; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .toolbar button, .toolbar a { background: linear-gradient(135deg, #F2C85C, #E0AA36); color: #0B1E33; border: none; border-radius: 10px; padding: 9px 16px; font-weight: 800; font-size: 13px; cursor: pointer; text-decoration: none; display: inline-block; }
    .toolbar .close-btn { background: rgba(255,255,255,0.14); color: #fff; margin-left: 8px; }
    .wrap { max-width: 680px; margin: 20px auto; background: #fff; border-radius: 18px; overflow: hidden; border: 1.5px solid #CBD5E1; box-shadow: 0 14px 36px rgba(11,30,51,0.14); }
    .head { background: linear-gradient(135deg, #0B1E33 0%, #0E4D60 100%); color: #fff; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    .official-wrap { padding: 20px; text-align: center; background: #F8FAFC; }
    .official-img { max-width: 460px; width: 100%; height: auto; border-radius: 14px; border: 1px solid #CBD5E1; box-shadow: 0 10px 28px rgba(15,23,42,0.12); display: block; margin: 0 auto; }
    .foot { padding: 12px 22px; background: #ECFDF5; border-top: 1px solid #A7F3D0; color: #065F46; font-size: 12px; font-weight: 700; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    @media print { .toolbar { display: none; } body { background: #fff; } .wrap { margin: 0; box-shadow: none; border: none; } .official-wrap { background: #fff; padding: 8px 0; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>FlyToAspan · ${escapeHtml(airline)} (${escapeHtml(airlinePnr)})</strong>
    <div>
      <a href="${escapeHtml(bp.officialPassDataUrl)}" download="${escapeHtml(bp.officialPassFileName || `BoardingPass_${airlinePnr}.png`)}">⬇ ${escapeHtml(lang === 'EN' ? 'Download Original' : lang === 'RU' ? 'Скачать оригинал' : lang === 'KK' ? 'Түпнұсқаны жүктеу' : 'Orijinal Dosyayı İndir')}</a>
      <button type="button" style="margin-left:8px;" onclick="window.print()">${escapeHtml(t.printBtn)}</button>
      <button type="button" class="close-btn" onclick="window.close()">${escapeHtml(t.closeBtn)}</button>
    </div>
  </div>
  <div class="wrap">
    <div class="head">
      <div>
        <div style="font-size:10.5px;font-weight:800;letter-spacing:0.1em;color:#F2C85C;">FLYTOASPAN · ${escapeHtml(t.checkedIn)}</div>
        <div style="font-size:17px;font-weight:900;margin-top:3px;">${escapeHtml(booking.title)} · ${escapeHtml(formatDisplayDate(booking.date, lang))}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:#CBD5E1;">PNR / ${escapeHtml(t.seat)}</div>
        <div style="font-size:16px;font-weight:900;color:#F2C85C;">${escapeHtml(airlinePnr)}${seat && seat !== '—' ? ` · ${escapeHtml(seat)}` : ''}</div>
      </div>
    </div>
    <div class="official-wrap">
      <img src="${escapeHtml(bp.officialPassDataUrl)}" alt="Official Airline Boarding Pass" class="official-img" />
    </div>
    <div class="foot">
      <span>✓ ${escapeHtml(lang === 'EN' ? 'Official Airline-Issued Boarding Pass' : lang === 'RU' ? 'Официальный посадочный талон авиакомпании' : lang === 'KK' ? 'Әуекомпанияның ресми отырғызу талоны' : 'Havayolunun Resmi Biniş Kartı (Havalimanı geçerlidir)')}</span>
      <span>FlyToAspan 7/24: +90 531 460 61 75</span>
    </div>
  </div>
  ${options.autoPrint !== false ? '<script>window.addEventListener("load", () => { setTimeout(() => window.print(), 350); });</script>' : ''}
</body>
</html>`;
  }

  const bcbp = bp?.bcbpString || buildIataBcbpString({
    passenger: booking.passenger,
    pnr: airlinePnr,
    fromCode,
    toCode,
    flightNumber: flightNo,
    date: booking.date,
    cabin,
    seat,
    sequenceNo: bp?.sequenceNo || '001',
  });
  const hasOfficialQr = hasOfficialPassFile;
  const qrBlockHtml = generateQrSvg(bcbp, 164);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang.toLowerCase())}">
<head>
  <meta charset="UTF-8" />
  <title>FlyToAspan_BoardingPass_${escapeHtml(airlinePnr)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #EEF2F6; color: #0F172A; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { position: sticky; top: 0; background: #0B1E33; color: #fff; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .toolbar button { background: linear-gradient(135deg, #F2C85C, #E0AA36); color: #0B1E33; border: none; border-radius: 10px; padding: 9px 18px; font-weight: 800; font-size: 13px; cursor: pointer; }
    .toolbar .close-btn { background: rgba(255,255,255,0.14); color: #fff; margin-left: 8px; }
    .pass { max-width: 780px; margin: 24px auto; background: #fff; border-radius: 20px; overflow: hidden; border: 2px solid #0B1E33; box-shadow: 0 18px 40px rgba(11,30,51,0.16); }
    .pass-head { background: linear-gradient(135deg, #0B1E33 0%, #0E4D60 100%); color: #fff; padding: 22px 28px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .pass-body { padding: 24px 28px; }
    .route { display: flex; justify-content: space-between; align-items: center; padding-bottom: 18px; border-bottom: 2px dashed #CBD5E1; }
    .iata { font-size: 38px; font-weight: 900; letter-spacing: 0.04em; color: #0B1E33; line-height: 1; }
    .qr-split { display: grid; grid-template-columns: 200px 1fr; gap: 20px; align-items: center; margin-top: 18px; padding: 16px; border-radius: 16px; border: 1.5px solid #CBD5E1; background: #FFFFFF; }
    .qr-frame { text-align: center; padding: 10px; border-radius: 12px; border: 1px solid #E2E8F0; background: #FFFFFF; }
    .qr-badge { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; }
    .qr-right { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .cell { border-radius: 12px; padding: 12px 14px; border: 1px solid #E2E8F0; background: #F8FAFC; }
    .cell.seat-cell { background: #0B1E33; border-color: #0B1E33; color: #fff; grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; }
    .cell.gate-cell { background: #F0F9FF; border-color: #7DD3FC; }
    .lbl { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; color: #64748B; text-transform: uppercase; }
    .seat-cell .lbl { color: #94A3B8; }
    .val { font-size: 18px; font-weight: 900; margin-top: 3px; color: #0F172A; }
    .seat-cell .val { font-size: 30px; color: #F2C85C; letter-spacing: 0.06em; margin-top: 0; }
    .gate-cell .val { color: #0369A1; }
    .status-ribbon { margin-top: 14px; padding: 9px 14px; border-radius: 10px; background: #ECFDF5; border: 1px solid #6EE7B7; color: #065F46; font-size: 12.5px; font-weight: 800; text-align: center; }
    .timing-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
    .timing-box { padding: 11px 12px; border-radius: 12px; background: #F8FAFC; border: 1px solid #E2E8F0; text-align: center; }
    .meta-strip { margin-top: 12px; padding: 10px 14px; border-radius: 10px; background: #F8FAFC; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; font-size: 12px; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; border: 1px solid #E2E8F0; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #E2E8F0; }
    th { background: #F8FAFC; font-size: 11px; color: #64748B; text-transform: uppercase; }
    .bcbp-bar { margin-top: 14px; padding: 10px 12px; border-radius: 10px; background: #0F172A; color: #CBD5E1; text-align: center; font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: 1.4px; word-break: break-all; }
    .note { margin-top: 14px; padding: 13px 16px; border-radius: 12px; background: #FFFBEB; border: 1px solid #FCD34D; font-size: 12.5px; color: #92400E; line-height: 1.55; }
    @media print { .toolbar { display: none; } body { background: #fff; } .pass { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>FlyToAspan · ${escapeHtml(t.docLabel)} (${escapeHtml(airlinePnr)})</strong>
    <div>
      <button type="button" onclick="window.print()">${escapeHtml(t.printBtn)}</button>
      <button type="button" class="close-btn" onclick="window.close()">${escapeHtml(t.closeBtn)}</button>
    </div>
  </div>
  <div class="pass">
    <div class="pass-head">
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;color:#F2C85C;">${escapeHtml(t.docLabel)}</div>
        <div style="font-size:22px;font-weight:900;margin-top:4px;">${escapeHtml(airline)} ${flightNo ? `· ${escapeHtml(flightNo)}` : ''}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10.5px;color:#CBD5E1;font-weight:700;">${escapeHtml(t.airlinePnr)}</div>
        <div style="font-size:24px;font-weight:900;letter-spacing:2px;color:#F2C85C;">${escapeHtml(airlinePnr)}</div>
        ${eticketNo ? `<div style="font-size:11px;color:#CBD5E1;margin-top:4px;">E-Ticket: ${escapeHtml(eticketNo)}</div>` : ''}
      </div>
    </div>
    <div class="pass-body">
      <div class="route">
        <div>
          <div class="iata">${escapeHtml(fromCode)}</div>
          <div style="font-size:13px;font-weight:700;color:#475569;margin-top:4px;">${escapeHtml(t.depart)}: <strong>${escapeHtml(departTime)}</strong></div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:24px;color:#00A8B5;">✈</div>
          <div style="font-size:12px;font-weight:800;color:#0B1E33;margin-top:2px;">${escapeHtml(formatDisplayDate(booking.date, lang))}</div>
          <div style="font-size:11px;color:#64748B;">${escapeHtml(cabin)}</div>
        </div>
        <div style="text-align:right;">
          <div class="iata">${escapeHtml(toCode)}</div>
          <div style="font-size:13px;font-weight:700;color:#475569;margin-top:4px;">${escapeHtml(t.arrive)}: <strong>${escapeHtml(arriveTime)}</strong></div>
        </div>
      </div>

      <!-- Pegasus-Style Split 2D QR Barcode + Seat / Gate / Terminal -->
      <div class="qr-split">
        <div class="qr-frame">
          ${qrBlockHtml}
          <span class="qr-badge" style="background:${hasOfficialQr ? '#DCFCE7' : '#F1F5F9'};color:${hasOfficialQr ? '#166534' : '#475569'};">
            ${hasOfficialQr ? '✓ Resmi Havayolu Barkodu' : 'IATA 792 2D QR'}
          </span>
        </div>
        <div class="qr-right">
          <div class="cell seat-cell">
            <div>
              <div class="lbl">${escapeHtml(t.seat)}</div>
              <div style="font-size:12px;color:#CBD5E1;margin-top:3px;">${escapeHtml(booking.passenger)}</div>
            </div>
            <div class="val">${escapeHtml(seat)}</div>
          </div>
          <div class="cell gate-cell">
            <div class="lbl" style="color:#0369A1;">${escapeHtml(t.gate)}</div>
            <div class="val">${escapeHtml(bp?.gate || t.tba)}</div>
          </div>
          <div class="cell">
            <div class="lbl">${escapeHtml(t.terminal)}</div>
            <div class="val" style="font-size:15px;">${escapeHtml(bp?.terminal || '—')}</div>
          </div>
        </div>
      </div>

      <div class="status-ribbon">${escapeHtml(t.checkedIn)}</div>

      <div class="timing-row">
        <div class="timing-box">
          <div class="lbl">${escapeHtml(t.boarding)}</div>
          <div class="val" style="color:#065F46;">${escapeHtml(bp?.boardingTime || '—')}</div>
        </div>
        <div class="timing-box">
          <div class="lbl">${escapeHtml(t.gateClose)}</div>
          <div class="val" style="color:#B45309;">${escapeHtml(bp?.gateCloseTime || '—')}</div>
        </div>
        <div class="timing-box">
          <div class="lbl">${escapeHtml(t.depart)}</div>
          <div class="val">${escapeHtml(departTime)}</div>
        </div>
      </div>

      <div class="meta-strip">
        <span><strong>PNR:</strong> ${escapeHtml(airlinePnr)}</span>
        <span><strong>${escapeHtml(t.zone)}:</strong> ${escapeHtml(bp?.boardingGroup || 'Standard')}</span>
        <span><strong>${escapeHtml(t.seq)}:</strong> ${escapeHtml(bp?.sequenceNo || '001')}</span>
        ${baggage ? `<span><strong>${escapeHtml(t.baggage)}:</strong> ${escapeHtml(baggage)}</span>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t.paxName)}</th>
            <th>${escapeHtml(t.seat)}</th>
            <th>${escapeHtml(t.seq)}</th>
          </tr>
        </thead>
        <tbody>
          ${seatRows
            .map(
              (r) => `<tr>
                <td style="font-weight:800;">${escapeHtml(r.fullName)}</td>
                <td><span style="padding:3px 10px;border-radius:6px;background:#0B1E33;color:#F2C85C;font-weight:900;">${escapeHtml(r.seat || seat)}</span></td>
                <td style="font-weight:700;color:#475569;">${escapeHtml(r.seqNo || bp?.sequenceNo || '001')}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>

      <div class="bcbp-bar">${escapeHtml(bcbp)}</div>

      <div class="note">
        <strong>ℹ ${escapeHtml(t.noteTitle)}:</strong> ${escapeHtml(bp?.baggageDropNote || t.defaultNote)}
        ${!hasOfficialQr ? `<div style="margin-top:6px;font-weight:700;">${escapeHtml(
          lang === 'EN'
            ? 'Note: This document is a Check-In Information Summary. For airport security and gate passage, please present the official airline boarding pass (attachment/mobile app) or obtain it at the airline counter.'
            : lang === 'RU'
              ? 'Примечание: данный документ является информационной сводкой регистрации. Для прохода в аэропорту используйте официальный посадочный талон авиакомпании (вложение/приложение) или стойку регистрации.'
              : lang === 'KK'
                ? 'Ескерту: бұл құжат тіркелу туралы ақпараттық түйіндеме болып табылады. Әуежай өткелі үшін әуекомпанияның ресми отырғызу талонын немесе тіркеу тағанын пайдаланыңыз.'
                : 'Bilgilendirme: Bu belge Check-In Bilgilendirme Özetidir. Havalimanı güvenlik ve biniş kapısı geçişlerinde havayolunun resmi biniş kartını (mail eki / havayolu uygulaması) veya havalimanı kontuar çıktısını kullanınız.'
        )}</div>` : ''}
      </div>
    </div>
  </div>
  ${options.autoPrint !== false ? '<script>window.addEventListener("load", () => { setTimeout(() => window.print(), 350); });</script>' : ''}
</body>
</html>`;
}

export function openBoardingPassPdf(
  booking: BookingRecord,
  options: { lang?: LangCode; autoPrint?: boolean } = {}
): void {
  const bp = booking.boardingPass;
  // If Super Admin uploaded the airline's official PDF boarding pass, download/open that exact official PDF directly!
  if (bp?.officialPassDataUrl && /^data:application\/pdf/i.test(bp.officialPassDataUrl)) {
    const a = document.createElement('a');
    a.href = bp.officialPassDataUrl;
    a.download = bp.officialPassFileName || `BoardingPass_${bp.airlinePnr || booking.pnr}.pdf`;
    a.target = '_blank';
    a.click();
    return;
  }
  const html = buildBoardingPassHtml(booking, options);
  const win = window.open('', '_blank', 'width=860,height=780');
  if (!win) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlyToAspan_BoardingPass_${booking.pnr}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function openRawEmailPreview(html: string): void {
  const win = window.open('', '_blank', 'width=720,height=780');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
