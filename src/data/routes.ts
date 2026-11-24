import type { FlightSearchQuery, LegalDocKey, PageView } from '../types';

const paths: Record<PageView, string> = {
  home: '/',
  'flight-results': '/ucus-ara',
  'hotel-results': '/',
  'transfer-results': '/',
  campaigns: '/kampanyalar',
  checkin: '/online-check-in',
  help: '/yardim',
  'booking-ops': '/bilet-islemleri',
  panel: '/hesabim',
  admin: '/yonetim',
  legal: '/yasal',
};

const legalDocs: Record<LegalDocKey, string> = {
  terms: 'kullanim-kosullari',
  kvkk: 'kvkk',
  refund: 'iptal-ve-iade',
  commercial: 'ticari-iletisim',
  cookies: 'cerezler',
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
  return `${paths['flight-results']}?${params.toString()}`;
}

export function parseFlightSearch(search: string, fallback: FlightSearchQuery): FlightSearchQuery {
  const p = new URLSearchParams(search);
  const from = p.get('from')?.toUpperCase();
  const to = p.get('to')?.toUpperCase();
  const depart = p.get('depart');
  if (!from || !to || !depart || !/^\d{4}-\d{2}-\d{2}$/.test(depart)) return fallback;
  const ret = p.get('ret');
  const tripType = p.get('type') === 'roundtrip' ? 'roundtrip' : 'oneway';
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
    adults,
    children,
    infants,
    cabin,
  };
}

export function readSiteRoute(pathname: string): { page: PageView; legalDoc: LegalDocKey } {
  const path = pathname.replace(/\/+$/, '') || '/';
  const doc = Object.entries(legalDocs).find(([, slug]) => path === `${paths.legal}/${slug}`);
  if (doc) return { page: 'legal', legalDoc: doc[0] as LegalDocKey };
  const entry = Object.entries(paths).find(([, value]) => value === path);
  return { page: entry ? entry[0] as PageView : 'home', legalDoc: 'terms' };
}
