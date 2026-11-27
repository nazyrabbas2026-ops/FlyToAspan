import QRCode from 'qrcode';

/**
 * Transliterate Turkish & accented Latin characters to pure IATA ASCII (A-Z, 0-9).
 * Fixes e.g. "Yusuf Coşkun" -> "COSKUN/YUSUF" (never dropping "Ş").
 */
export function toIataAscii(raw: string): string {
  return String(raw || '')
    .replace(/[Çç]/g, 'C')
    .replace(/[Ğğ]/g, 'G')
    .replace(/[İIıi]/g, 'I')
    .replace(/[Öö]/g, 'O')
    .replace(/[Şş]/g, 'S')
    .replace(/[Üü]/g, 'U')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 /]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toJulianDayOfYear(isoDate?: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '001';
  const [y, m, d] = isoDate.split('-').map(Number);
  const start = Date.UTC(y, 0, 0);
  const current = Date.UTC(y, m - 1, d);
  const day = Math.max(1, Math.min(366, Math.round((current - start) / 86_400_000)));
  return String(day).padStart(3, '0');
}

/**
 * Builds a standards-compliant 60-character IATA Resolution 792 BCBP mandatory block.
 */
export function buildIataBcbpString(input: {
  passenger: string;
  pnr: string;
  fromCode: string;
  toCode: string;
  flightNumber?: string;
  date?: string;
  cabin?: string;
  seat?: string;
  sequenceNo?: string;
}): string {
  const cleanName = toIataAscii(input.passenger);
  const parts = cleanName.split(' ').filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] || 'PASSENGER';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
  const nameField = `${last}/${first}`.slice(0, 20).padEnd(20, ' ');

  const pnrField = toIataAscii(input.pnr).replace(/[^A-Z0-9]/g, '').slice(0, 7).padEnd(7, ' ');
  const fromField = toIataAscii(input.fromCode).replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
  const toField = toIataAscii(input.toCode).replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');

  const fltClean = toIataAscii(input.flightNumber || '').replace(/[^A-Z0-9]/g, '');
  const carrierMatch = fltClean.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  const carrierField = (carrierMatch ? carrierMatch[1] : fltClean.slice(0, 2) || 'FT').padEnd(3, ' ');
  const fltNumField = (carrierMatch ? carrierMatch[2] : fltClean.replace(/^[A-Z]+/, '') || '0001')
    .padStart(4, '0')
    .slice(0, 5)
    .padEnd(5, ' ');

  const julianField = toJulianDayOfYear(input.date);
  const cabinField = /business|biz/i.test(input.cabin || '') ? 'C' : 'Y';
  const firstSeat = toIataAscii((input.seat || '').split(',')[0] || '').replace(/[^A-Z0-9]/g, '');
  const seatField = (firstSeat ? firstSeat.padStart(4, '0') : '0000').slice(-4);
  const seqDigits = String(input.sequenceNo || '1').replace(/\D/g, '') || '1';
  const seqField = seqDigits.padStart(4, '0').slice(-4).padEnd(5, ' ');

  // M = Format Code, 1 = Number of Legs, E = Electronic Ticket Indicator, 1 = Passenger Status, 00 = Field Size
  return `M1${nameField}E${pnrField}${fromField}${toField}${carrierField}${fltNumField}${julianField}${cabinField}${seatField}${seqField}100`;
}

/**
 * Synchronously generates a crisp, 100% scannable 2D QR Code SVG string.
 */
export function generateQrSvg(payload: string, sizePx = 148): string {
  try {
    const qr = QRCode.create(payload || 'FLYTOASPAN', { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const quiet = 2;
    const total = count + quiet * 2;
    const rects: string[] = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1" />`);
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" role="img" aria-label="Boarding Pass 2D QR Barcode"><rect width="100%" height="100%" fill="#FFFFFF"/><g fill="#0B1E33">${rects.join('')}</g></svg>`;
  } catch {
    return '';
  }
}
