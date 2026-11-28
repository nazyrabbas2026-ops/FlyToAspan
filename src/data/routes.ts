import type { FlightSearchQuery, HotelSearchQuery, LegalDocKey, PageView, TransferSearchQuery } from '../types';

const paths: Record<PageView, string> = {
  home: '/',
  'flight-results': '/ucus-ara',
  'hotel-results': '/otel-ara',
  'transfer-results': '/transfer-ara',
  'tour-results': '/turlar',
  campaigns: '/kampanyalar',
  checkin: '/online-check-in',
  help: '/yardim',
  'booking-ops': '/bilet-islemleri',
  panel: '/hesabim',
  admin: '/yonetim',
  developer: '/gelistirici',
  legal: '/yasal',
  'not-found': '/404',
};

const legalDocs: Record<LegalDocKey, string> = {
  terms: 'kullanim-kosullari',
  kvkk: 'kvkk',
  refund: 'iptal-ve-iade',
  commercial: 'ticari-iletisim',
  cookies: 'cerezler',
};

const shortLegalAliases: Record<string, LegalDocKey> = {
  '/kvkk': 'kvkk',
  '/gizlilik': 'kvkk',
  '/kullanim-kosullari': 'terms',
  '/cerez-politikasi': 'cookies',
};

export function hrefForPage(page: PageView, doc: LegalDocKey = 'terms'): string {
  return page === 'legal' ? `${paths.legal}/${legalDocs[doc]}` : paths[page];
}

export function flightSearchHref(q: FlightSearchQuery): string {
  const params = new URLSearchParams({
    from: q.fromCode,
    to: q.toCode,
    depart: q.departDate,
    type: q.tripType,
    adults: String(q.adults),
    children: String(q.children),
    infants: String(q.infants),
    cabin: q.cabin,
  });
  if (q.tripType === 'roundtrip' && q.returnDate) params.set('ret', q.returnDate);
  if (q.tripType === 'multicity') {
    if (q.leg2FromCode) params.set('leg2From', q.leg2FromCode);
    if (q.leg2ToCode) params.set('leg2To', q.leg2ToCode);
    if (q.leg2Date) params.set('leg2Date', q.leg2Date);
  }
  return `${paths['flight-results']}?${params.toString()}`;
}

export function hotelSearchHref(q: HotelSearchQuery): string {
  const params = new URLSearchParams({
    dest: q.destination,
    in: q.checkIn,
    out: q.checkOut,
    adults: String(q.adults),
    children: String(q.children),
  });
  return `${paths['hotel-results']}?${params.toString()}`;
}

export function parseHotelSearch(search: string, fallback: HotelSearchQuery): HotelSearchQuery {
  const p = new URLSearchParams(search);
  const dest = p.get('dest')?.trim();
  const checkIn = p.get('in');
  const checkOut = p.get('out');
  if (!dest || !checkIn || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) return fallback;
  return {
    destination: dest,
    checkIn,
    checkOut: checkOut && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkOut >= checkIn ? checkOut : fallback.checkOut,
    adults: Math.min(9, Math.max(1, Number(p.get('adults')) || 2)),
    children: Math.min(6, Math.max(0, Number(p.get('children')) || 0)),
  };
}

export function transferSearchHref(q: TransferSearchQuery): string {
  const params = new URLSearchParams({
    from: q.from,
    to: q.to,
    date: q.date,
    time: q.time,
    adults: String(q.adults),
    children: String(q.children),
  });
  return `${paths['transfer-results']}?${params.toString()}`;
}

export function parseTransferSearch(search: string, fallback: TransferSearchQuery): TransferSearchQuery {
  const p = new URLSearchParams(search);
  const from = p.get('from')?.trim();
  const to = p.get('to')?.trim();
  const date = p.get('date');
  if (!from || !to || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fallback;
  return {
    from,
    to,
    date,
    time: p.get('time')?.trim() || fallback.time,
    adults: Math.min(9, Math.max(1, Number(p.get('adults')) || 2)),
    children: Math.min(6, Math.max(0, Number(p.get('children')) || 0)),
  };
}

export function parseFlightSearch(search: string, fallback: FlightSearchQuery): FlightSearchQuery {
  const p = new URLSearchParams(search);
  const from = p.get('from')?.toUpperCase();
  const to = p.get('to')?.toUpperCase();
  const depart = p.get('depart');
  if (!from || !to || !depart || !/^\d{4}-\d{2}-\d{2}$/.test(depart)) return fallback;
  const ret = p.get('ret');
  const leg2From = p.get('leg2From')?.toUpperCase() || undefined;
  const leg2To = p.get('leg2To')?.toUpperCase() || undefined;
  const leg2DateRaw = p.get('leg2Date');
  const leg2Date = leg2DateRaw && /^\d{4}-\d{2}-\d{2}$/.test(leg2DateRaw) ? leg2DateRaw : undefined;
  const tripType = p.get('type') === 'roundtrip' ? 'roundtrip' : p.get('type') === 'multicity' ? 'multicity' : 'oneway';
  const adults = Math.min(9, Math.max(1, Number(p.get('adults')) || 1));
  const children = Math.min(6, Math.max(0, Number(p.get('children')) || 0));
  const infants = Math.min(adults, Math.max(0, Number(p.get('infants')) || 0));
  const cabin = p.get('cabin') === 'Business' ? 'Business' : 'Ekonomi';
  return {
    tripType,
    fromCode: from,
    toCode: to,
    departDate: depart,
    returnDate: ret && /^\d{4}-\d{2}-\d{2}$/.test(ret) ? ret : fallback.returnDate,
    leg2FromCode: leg2From,
    leg2ToCode: leg2To,
    leg2Date,
    adults,
    children,
    infants,
    cabin,
  };
}

export function readSiteRoute(pathname: string): { page: PageView; legalDoc: LegalDocKey } {
  const path = (pathname.replace(/\/+$/, '') || '/').toLowerCase();
  if (path in shortLegalAliases) {
    return { page: 'legal', legalDoc: shortLegalAliases[path] };
  }
  const doc = Object.entries(legalDocs).find(([, slug]) => path === `${paths.legal}/${slug}`);
  if (doc) return { page: 'legal', legalDoc: doc[0] as LegalDocKey };
  const entry = Object.entries(paths).find(([k, value]) => k !== 'not-found' && value === path);
  if (entry) return { page: entry[0] as PageView, legalDoc: 'terms' };
  return { page: 'not-found', legalDoc: 'terms' };
}
