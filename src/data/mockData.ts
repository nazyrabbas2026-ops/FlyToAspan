import { addCalendarDays, fromCalendarDate, toCalendarDate } from './calendarDates';
import { AdminMarkupConfig, CurrencyCode } from '../types';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  label: string;
  rateFromTRY: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'TRY', symbol: '₺', label: 'TRY ₺ — Türk Lirası', rateFromTRY: 1 },
  { code: 'USD', symbol: '$', label: 'USD $ — US Dollar', rateFromTRY: 0.019754 },
  { code: 'EUR', symbol: '€', label: 'EUR € — Euro', rateFromTRY: 0.018109 },
  { code: 'KZT', symbol: '₸', label: 'KZT ₸ — Қазақстан теңгесі', rateFromTRY: 8.988027 },
  { code: 'RUB', symbol: '₽', label: 'RUB ₽ — Российский рубль', rateFromTRY: 1.618745 },
];

let liveRatesMap: Record<CurrencyCode, number> = {
  TRY: 1,
  USD: 0.019754,
  EUR: 0.018109,
  KZT: 8.988027,
  RUB: 1.618745,
};

let liveRatesUpdatedAt: string | null = null;

export function getLiveRatesSnapshot(): {
  rates: Record<CurrencyCode, number>;
  updatedAt: string | null;
} {
  return { rates: { ...liveRatesMap }, updatedAt: liveRatesUpdatedAt };
}

export async function refreshLiveExchangeRates(): Promise<{
  rates: Record<CurrencyCode, number>;
  updatedAt: string;
}> {
  const applyRates = (rates?: Record<string, number>) => {
    if (!rates) return false;
    liveRatesMap = {
      TRY: 1,
      USD: typeof rates.USD === 'number' ? rates.USD : liveRatesMap.USD,
      EUR: typeof rates.EUR === 'number' ? rates.EUR : liveRatesMap.EUR,
      KZT: typeof rates.KZT === 'number' ? rates.KZT : liveRatesMap.KZT,
      RUB: typeof rates.RUB === 'number' ? rates.RUB : liveRatesMap.RUB,
    };
    CURRENCIES.forEach((c) => {
      c.rateFromTRY = liveRatesMap[c.code];
    });
    liveRatesUpdatedAt = new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return true;
  };

  try {
    const localRes = await fetch('/api/fx', { credentials: 'same-origin' });
    if (localRes.ok) {
      const localData = (await localRes.json()) as { rates?: Record<string, number> };
      if (applyRates(localData?.rates)) {
        return { rates: { ...liveRatesMap }, updatedAt: liveRatesUpdatedAt || 'Güncel Merkez Kuru' };
      }
    }
  } catch {
    /* fallback to direct public feed if /api/fx unavailable */
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/TRY');
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number> };
      applyRates(data?.rates);
    }
  } catch {
    /* keep current fallback rates if offline */
  }
  return {
    rates: { ...liveRatesMap },
    updatedAt: liveRatesUpdatedAt || 'Güncel Merkez Kuru',
  };
}

export const DEFAULT_MARKUP: AdminMarkupConfig = {
  domesticAddTRY: 180,
  centralAsiaPercent: 7,
  intlPercent: 5,
  hotelPercent: 8,
  transferAddTRY: 150,
};

export function formatPrice(amountTRY: number, currency: CurrencyCode = 'TRY'): string {
  const rate = liveRatesMap[currency] ?? (CURRENCIES.find((c) => c.code === currency)?.rateFromTRY || 1);
  const converted = Math.round(amountTRY * rate);
  const formatted = new Intl.NumberFormat('tr-TR').format(converted);
  if (currency === 'TRY') return `₺${formatted}`;
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'EUR') return `€${formatted}`;
  if (currency === 'KZT') return `${formatted} ₸`;
  return `${formatted} ₽`;
}

export interface Airport {
  code: string;
  city: string;
  airport: string;
  country: string;
  domestic?: boolean;
  aliases?: string[];
}

export interface FlightDeal {
  id: string;
  region: 'YURT İÇİ' | 'AVRUPA' | 'ORTA ASYA' | 'ORTA DOĞU';
  regionColor: 'teal' | 'gold' | 'violet' | 'emerald';
  fromCity: string;
  fromCode: string;
  toCity: string;
  toCode: string;
  dateLabel: string;
  isoDate: string;
  price: number;
  image: string;
  featured?: boolean;
}

export interface HotelDeal {
  id: string;
  city: string;
  name: string;
  stars: number;
  dates: string;
  nights: number;
  guests: number;
  price: number;
  rating: number;
  boardType: string;
  image: string;
  featured?: boolean;
}

export interface TransferDeal {
  id: string;
  city: string;
  route: string;
  vehicle: string;
  category: string;
  capacity: string;
  baggage: string;
  price: number;
  image: string;
}

export interface Campaign {
  id: string;
  category: 'Uçak' | 'Otel' | 'Tur' | 'Transfer';
  badge: string;
  title: string;
  subtitle: string;
  code: string;
  validUntil: string;
  gradient: string;
  accent: string;
  image: string;
  wide?: boolean;
}

export interface AirlineCheckIn {
  code: string;
  name: string;
  country: 'TR' | 'INTL';
  popular?: boolean;
  url: string;
  color: string;
}

export interface FarePackage {
  id: string;
  name: string;
  cabin: 'ECONOMY' | 'BUSINESS';
  cabinBag: string;
  checkedBag: string;
  refundable: boolean;
  refundText: string;
  changeable: boolean;
  changeText: string;
  meal: string;
  seat: string;
  priceDelta: number;
}

export interface FlightResult {
  id: string;
  airline: string;
  airlineCode: string;
  airlineColor: string;
  flightNumber: string;
  fromCode: string;
  fromCity: string;
  toCode: string;
  toCity: string;
  departTime: string;
  arriveTime: string;
  departureDate: string;
  arrivalDate: string;
  departMinutes: number;
  arriveMinutes: number;
  durationMinutes: number;
  durationLabel: string;
  stops: number;
  stopCity?: string;
  basePrice: number;
  netCostTRY?: number;
  providerSource?: string;
  seatsLeft: number;
  packages: FarePackage[];
}

export const AIRPORTS: Airport[] = [
  { code: 'IST', city: 'İstanbul', airport: 'İstanbul Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Istanbul', 'Стамбул', 'Ыстамбұл', 'Turkey', 'Турция', 'Түркия'] },
  { code: 'SAW', city: 'İstanbul', airport: 'Sabiha Gökçen Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Istanbul', 'Sabiha Gokcen', 'Стамбул', 'Сабиха Гёкчен', 'Ыстамбұл'] },
  { code: 'ESB', city: 'Ankara', airport: 'Esenboğa Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Анкара', 'Эсенбога', 'Esenboga'] },
  { code: 'ADB', city: 'İzmir', airport: 'Adnan Menderes Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Izmir', 'Измир'] },
  { code: 'AYT', city: 'Antalya', airport: 'Antalya Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Анталья', 'Анталия'] },
  { code: 'TZX', city: 'Trabzon', airport: 'Trabzon Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Трабзон'] },
  { code: 'BJV', city: 'Bodrum', airport: 'Milas-Bodrum Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Бодрум', 'Милас'] },
  { code: 'DLM', city: 'Dalaman', airport: 'Dalaman Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Даламан'] },
  { code: 'ADA', city: 'Adana', airport: 'Çukurova Uluslararası Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Адана', 'Cukurova'] },
  { code: 'GZT', city: 'Gaziantep', airport: 'Gaziantep Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Газиантеп'] },
  { code: 'KYA', city: 'Konya', airport: 'Konya Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Конья'] },
  { code: 'ERZ', city: 'Erzurum', airport: 'Erzurum Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Эрзурум'] },
  { code: 'GNY', city: 'Şanlıurfa', airport: 'GAP Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Sanliurfa', 'Шанлыурфа'] },
  { code: 'VAN', city: 'Van', airport: 'Ferit Melen Havalimanı', country: 'Türkiye', domestic: true, aliases: ['Ван'] },
  { code: 'ALA', city: 'Almatı', airport: 'Almatı Uluslararası Havalimanı', country: 'Kazakistan', aliases: ['Almaty', 'Алматы', 'Kazakhstan', 'Казахстан', 'Қазақстан'] },
  { code: 'NQZ', city: 'Astana', airport: 'Nursultan Nazarbayev Havalimanı', country: 'Kazakistan', aliases: ['Астана', 'Nur-Sultan', 'Нур-Султан', 'Kazakhstan', 'Қазақстан'] },
  { code: 'TAS', city: 'Taşkent', airport: 'Taşkent Uluslararası Havalimanı', country: 'Özbekistan', aliases: ['Tashkent', 'Ташкент', 'Uzbekistan', 'Узбекистан'] },
  { code: 'GYD', city: 'Bakü', airport: 'Haydar Aliyev Havalimanı', country: 'Azerbaycan', aliases: ['Baku', 'Баку', 'Azerbaijan', 'Азербайджан'] },
  { code: 'TBS', city: 'Tiflis', airport: 'Tiflis Uluslararası Havalimanı', country: 'Gürcistan', aliases: ['Tbilisi', 'Тбилиси', 'Georgia', 'Грузия'] },
  { code: 'LHR', city: 'Londra', airport: 'Heathrow Havalimanı', country: 'Birleşik Krallık', aliases: ['London', 'Лондон', 'UK', 'Великобритания'] },
  { code: 'CDG', city: 'Paris', airport: 'Charles de Gaulle Havalimanı', country: 'Fransa', aliases: ['Париж', 'France', 'Франция'] },
  { code: 'AMS', city: 'Amsterdam', airport: 'Schiphol Havalimanı', country: 'Hollanda', aliases: ['Амстердам', 'Netherlands', 'Нидерланды'] },
  { code: 'BER', city: 'Berlin', airport: 'Brandenburg Havalimanı', country: 'Almanya', aliases: ['Берлин', 'Germany', 'Германия'] },
  { code: 'FRA', city: 'Frankfurt', airport: 'Frankfurt Havalimanı', country: 'Almanya', aliases: ['Франкфурт', 'Germany', 'Германия'] },
  { code: 'FCO', city: 'Roma', airport: 'Fiumicino Havalimanı', country: 'İtalya', aliases: ['Rome', 'Рим', 'Italy', 'Италия'] },
  { code: 'BCN', city: 'Barselona', airport: 'El Prat Havalimanı', country: 'İspanya', aliases: ['Barcelona', 'Барселона', 'Spain', 'Испания'] },
  { code: 'VIE', city: 'Viyana', airport: 'Schwechat Havalimanı', country: 'Avusturya', aliases: ['Vienna', 'Вена', 'Austria', 'Австрия'] },
  { code: 'PRG', city: 'Prag', airport: 'Václav Havel Havalimanı', country: 'Çekya', aliases: ['Prague', 'Прага', 'Czechia'] },
  { code: 'DXB', city: 'Dubai', airport: 'Dubai Uluslararası Havalimanı', country: 'BAE', aliases: ['Дубай', 'UAE', 'ОАЭ'] },
  { code: 'JFK', city: 'New York', airport: 'John F. Kennedy Havalimanı', country: 'ABD', aliases: ['Нью-Йорк', 'USA', 'США'] },
  { code: 'ICN', city: 'Seul', airport: 'Incheon Uluslararası Havalimanı', country: 'Güney Kore', aliases: ['Seoul', 'Сеул', 'Korea'] },
  { code: 'HND', city: 'Tokyo', airport: 'Haneda Havalimanı', country: 'Japonya', aliases: ['Токио', 'Japan', 'Япония'] },
];

export const AIRLINE_MARQUEE = [
  'Turkish Airlines',
  'Air Astana',
  'Pegasus',
  'AJet',
  'SunExpress',
  'FlyArystan',
  'Lufthansa',
  'Emirates',
  'Qatar Airways',
  'British Airways',
  'KLM',
  'Air France',
  'Azerbaijan Airlines',
  'Uzbekistan Airways',
  'SCAT Airlines',
  'Swiss',
  'Austrian',
  'Etihad',
];

export const CAMPAIGNS: Campaign[] = [
  {
    id: 'cmp-1',
    category: 'Uçak',
    badge: 'YURT İÇİ & YURT DIŞI',
    title: 'İlk Uçuşunuza Özel 350 TL Anında İndirim',
    subtitle: 'FlyToAspan üyesi olun, İstanbul – Almatı, Antalya ve Avrupa uçuşlarında anında avantaj yakalayın.',
    code: 'ASPAN350',
    validUntil: '31 Aralık 2026',
    gradient: 'linear-gradient(135deg, #061D26 0%, #0C3847 55%, #008B99 100%)',
    accent: '#E9BA4A',
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80',
    wide: true,
  },
  {
    id: 'cmp-2',
    category: 'Uçak',
    badge: 'ORTA ASYA FIRSATI',
    title: 'Almatı & Astana Direkt Uçuşlarında %18 Avantaj',
    subtitle: 'Kazakistan’ın gökyüzüne FlyToAspan güvencesiyle, ücretsiz bagaj hakkı dahil özel tarifeler.',
    code: 'SKYALA18',
    validUntil: '15 Ocak 2027',
    gradient: 'linear-gradient(135deg, #071922 0%, #123B49 60%, #9E731A 100%)',
    accent: '#16C7D4',
    image: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1200&q=80',
    wide: true,
  },
  {
    id: 'cmp-3',
    category: 'Otel',
    badge: 'ERKEN REZERVASYON',
    title: 'Seçili 5 Yıldızlı Otellerde %30’a Varan Fırsat',
    subtitle: 'Antalya, Bodrum ve Dubai’nin en sevilen otellerinde ücretsiz iptal ve 9 taksit imkânı.',
    code: 'OTEL30',
    validUntil: '28 Şubat 2027',
    gradient: 'linear-gradient(135deg, #09232E 0%, #0F4756 100%)',
    accent: '#F0C55A',
    image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'cmp-4',
    category: 'Tur',
    badge: 'PAKET TUR FIRSATI',
    title: '4 Ülkede Uçak + Otel Dahil Paket Turlarda %20 Avantaj',
    subtitle: 'Türkiye, Kazakistan, Mısır ve Dubai turlarında her gün XML ile güncellenen en uygun paket fiyatlar.',
    code: 'TUR20',
    validUntil: '31 Ocak 2027',
    gradient: 'linear-gradient(135deg, #0B1F2A 0%, #174656 100%)',
    accent: '#16C7D4',
    image: '/images/almaty.jpg',
  },
];

const FLIGHT_DEAL_TEMPLATES: Array<Omit<FlightDeal, 'isoDate' | 'dateLabel'> & { daysAhead: number }> = [
  {
    id: 'deal-ayt',
    region: 'YURT İÇİ',
    regionColor: 'teal',
    fromCity: 'İstanbul (SAW)',
    fromCode: 'SAW',
    toCity: 'Antalya',
    toCode: 'AYT',
    daysAhead: 15,
    price: 1589,
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80',
    featured: true,
  },
  {
    id: 'deal-adb',
    region: 'YURT İÇİ',
    regionColor: 'teal',
    fromCity: 'İstanbul',
    fromCode: 'IST',
    toCity: 'İzmir',
    toCode: 'ADB',
    daysAhead: 30,
    price: 1745,
    image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'deal-esb',
    region: 'YURT İÇİ',
    regionColor: 'teal',
    fromCity: 'İstanbul',
    fromCode: 'IST',
    toCity: 'Ankara',
    toCode: 'ESB',
    daysAhead: 45,
    price: 2390,
    image: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'deal-tzx',
    region: 'YURT İÇİ',
    regionColor: 'teal',
    fromCity: 'İstanbul',
    fromCode: 'IST',
    toCity: 'Trabzon',
    toCode: 'TZX',
    daysAhead: 30,
    price: 3180,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'deal-ala',
    region: 'ORTA ASYA',
    regionColor: 'emerald',
    fromCity: 'İstanbul',
    fromCode: 'IST',
    toCity: 'Almatı',
    toCode: 'ALA',
    daysAhead: 22,
    price: 6890,
    image: '/images/almaty.jpg',
  },
  {
    id: 'deal-lhr',
    region: 'AVRUPA',
    regionColor: 'gold',
    fromCity: 'İstanbul',
    fromCode: 'IST',
    toCity: 'Londra',
    toCode: 'LHR',
    daysAhead: 15,
    price: 5420,
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'deal-ams',
    region: 'AVRUPA',
    regionColor: 'gold',
    fromCity: 'İstanbul',
    fromCode: 'IST',
    toCity: 'Amsterdam',
    toCode: 'AMS',
    daysAhead: 30,
    price: 5540,
    image: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'deal-cdg',
    region: 'AVRUPA',
    regionColor: 'gold',
    fromCity: 'İstanbul',
    fromCode: 'IST',
    toCity: 'Paris',
    toCode: 'CDG',
    daysAhead: 15,
    price: 6290,
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'deal-fco',
    region: 'AVRUPA',
    regionColor: 'gold',
    fromCity: 'İstanbul',
    fromCode: 'IST',
    toCity: 'Roma',
    toCode: 'FCO',
    daysAhead: 15,
    price: 6980,
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'deal-dxb',
    region: 'ORTA DOĞU',
    regionColor: 'violet',
    fromCity: 'İstanbul',
    fromCode: 'IST',
    toCity: 'Dubai',
    toCode: 'DXB',
    daysAhead: 26,
    price: 7450,
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=700&q=80',
  },
];

const SHORT_MONTHS: Record<'TR' | 'EN' | 'RU' | 'KK', string[]> = {
  TR: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  EN: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  RU: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
  KK: ['Қаң', 'Ақп', 'Нау', 'Сәу', 'Мам', 'Мау', 'Шіл', 'Там', 'Қыр', 'Қаз', 'Қар', 'Жел'],
};

export function formatDisplayDate(
  isoDate: string,
  lang: 'TR' | 'EN' | 'RU' | 'KK' = 'TR'
): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const dt = fromCalendarDate(isoDate);
  const months = SHORT_MONTHS[lang] || SHORT_MONTHS.TR;
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function getFlightDeals(
  lang: 'TR' | 'EN' | 'RU' | 'KK' = 'TR',
  markup: AdminMarkupConfig = DEFAULT_MARKUP
): FlightDeal[] {
  const today = toCalendarDate(new Date());

  return FLIGHT_DEAL_TEMPLATES.map(({ daysAhead, ...deal }) => {
    const isoDate = addCalendarDays(today, daysAhead);
    const dateLabel = formatDisplayDate(isoDate, lang);
    let adjustedPrice = deal.price;
    if (deal.region === 'YURT İÇİ') {
      adjustedPrice = deal.price + (markup.domesticAddTRY - DEFAULT_MARKUP.domesticAddTRY);
    } else if (deal.region === 'ORTA ASYA') {
      const diffPct = markup.centralAsiaPercent - DEFAULT_MARKUP.centralAsiaPercent;
      adjustedPrice = Math.round(deal.price * (1 + diffPct / 100));
    } else {
      const diffPct = markup.intlPercent - DEFAULT_MARKUP.intlPercent;
      adjustedPrice = Math.round(deal.price * (1 + diffPct / 100));
    }
    return { ...deal, price: Math.max(490, adjustedPrice), isoDate, dateLabel };
  });
}

export const HOTEL_DEALS: HotelDeal[] = [
  {
    id: 'htl-bodrum',
    city: 'BODRUM',
    name: 'Aspan Marina & Spa Resort',
    stars: 5,
    dates: '27 Kas - 29 Kas',
    nights: 2,
    guests: 2,
    price: 2490,
    rating: 9.4,
    boardType: 'Kahvaltı Dahil',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80',
    featured: true,
  },
  {
    id: 'htl-trabzon',
    city: 'TRABZON',
    name: 'Quantum Panorama Hotel',
    stars: 4,
    dates: '27 Kas - 29 Kas',
    nights: 2,
    guests: 2,
    price: 2540,
    rating: 9.1,
    boardType: 'Oda Kahvaltı',
    image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 'htl-antalya',
    city: 'ANTALYA',
    name: 'Lara Turquoise Suites',
    stars: 5,
    dates: '27 Kas - 29 Kas',
    nights: 2,
    guests: 2,
    price: 2890,
    rating: 9.5,
    boardType: 'Her Şey Dahil',
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 'htl-almaty',
    city: 'ALMATI',
    name: 'Tien Shan Grand Palace',
    stars: 5,
    dates: '4 Ara - 6 Ara',
    nights: 2,
    guests: 2,
    price: 3420,
    rating: 9.3,
    boardType: 'Kahvaltı Dahil',
    image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 'htl-izmir',
    city: 'İZMİR',
    name: 'Aegean Pearl Boutique Hotel',
    stars: 4,
    dates: '27 Kas - 29 Kas',
    nights: 2,
    guests: 2,
    price: 3180,
    rating: 9.0,
    boardType: 'Oda Kahvaltı',
    image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=500&q=80',
  },
];

export const TRANSFER_DEALS: TransferDeal[] = [
  {
    id: 'trf-ist',
    city: 'İSTANBUL',
    route: 'IST Havalimanı → Taksim / Şişli',
    vehicle: 'Mercedes-Benz S-Class VIP',
    category: 'Özel VIP · Sabit Fiyat',
    capacity: '1–4 Yolcu',
    baggage: '4 Bavul',
    price: 1650,
    image: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'trf-ayt',
    city: 'ANTALYA',
    route: 'AYT Havalimanı → Belek / Lara',
    vehicle: 'VIP SUV Executive',
    category: 'Özel VIP · İkramlı · Wi-Fi',
    capacity: '1–4 Yolcu',
    baggage: '4 Bavul',
    price: 1390,
    image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'trf-bjv',
    city: 'BODRUM',
    route: 'BJV Havalimanı → Yalıkavak / Merkez',
    vehicle: 'Mercedes-Benz E-Class Business',
    category: 'Executive Sedan · Şoförlü',
    capacity: '1–3 Yolcu',
    baggage: '3 Bavul',
    price: 1480,
    image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'trf-ala',
    city: 'ALMATI',
    route: 'ALA Havalimanı → Şehir Merkezi',
    vehicle: 'Mercedes-Benz Luxury VIP',
    category: 'Aile & İş · İsimle Karşılama',
    capacity: '1–6 Yolcu',
    baggage: '6 Bavul',
    price: 1890,
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=700&q=80',
  },
];

export const POPULAR_DOMESTIC = [
  { code: 'ADB', city: 'İzmir' },
  { code: 'ESB', city: 'Ankara' },
  { code: 'AYT', city: 'Antalya' },
  { code: 'ADA', city: 'Adana' },
  { code: 'DLM', city: 'Dalaman' },
  { code: 'BJV', city: 'Bodrum' },
  { code: 'TZX', city: 'Trabzon' },
  { code: 'GZT', city: 'Gaziantep' },
  { code: 'KYA', city: 'Konya' },
  { code: 'ERZ', city: 'Erzurum' },
  { code: 'GNY', city: 'Şanlıurfa' },
  { code: 'VAN', city: 'Van' },
];

export const POPULAR_INTERNATIONAL = [
  { code: 'ALA', city: 'Almatı' },
  { code: 'NQZ', city: 'Astana' },
  { code: 'TAS', city: 'Taşkent' },
  { code: 'GYD', city: 'Bakü' },
  { code: 'LHR', city: 'Londra' },
  { code: 'CDG', city: 'Paris' },
  { code: 'BER', city: 'Berlin' },
  { code: 'FCO', city: 'Roma' },
  { code: 'BCN', city: 'Barselona' },
  { code: 'VIE', city: 'Viyana' },
  { code: 'DXB', city: 'Dubai' },
  { code: 'JFK', city: 'New York' },
];

export const SOLUTION_PARTNERS = [
  'Amadeus',
  'Galileo GDS',
  'Sabre',
  'Turkish Airlines',
  'Air Astana',
  'FUN&SUN',
  'Kompas Tour',
  'Selfie Travel',
  'Hotelbeds',
  'Expedia TAAP',
  'SunExpress',
  'FlyArystan',
];

export const FAQ_ITEMS = [
  {
    q: 'Uçak biletimi FlyToAspan üzerinden nasıl satın alabilirim?',
    a: 'Ana sayfadaki arama kutusundan kalkış ve varış noktalarını, uçuş tarihini ve yolcu sayısını seçerek "Uçuş Ara" butonuna tıklayın. Listelenen uçuşlar arasında aktarma, saat ve fiyat filtrelerini kullanabilir; "Paketler" sekmesinden bagaj ve iade koşullarını karşılaştırarak 3D Secure güvencesiyle biletinizi saniyeler içinde satın alabilirsiniz.',
  },
  {
    q: 'Otel seçerken nelere dikkat etmeliyim?',
    a: 'Otel ararken konaklama tipini (Oda Kahvaltı, Her Şey Dahil vb.), ücretsiz iptal koşullarını, merkeze veya havalimanına uzaklığını ve misafir değerlendirme puanlarını incelemenizi öneririz. FlyToAspan üzerinden tüm otellerde şeffaf toplam fiyat gösterilir, gizli vergi veya ek ücret çıkmaz.',
  },
  {
    q: 'Biletimi nasıl iptal edebilir veya tarih değişikliği yapabilirim?',
    a: 'Üst menüdeki "Bilet İşlemleri" sayfasından PNR kodunuz ve yolcu soyadınızla rezervasyonunuzu sorgulayabilirsiniz. Seçtiğiniz paket kurallarına göre değişiklik veya iptal talebinizi çevrimiçi iletebilir ya da 7/24 çağrı merkezimizden anında destek alabilirsiniz.',
  },
  {
    q: 'Paket turlar neleri kapsar ve fiyatlar nasıl güncellenir?',
    a: 'Paket turlarımız uçak bileti ve seçkin otel konaklamasını tek pakette sunar. Sistemimiz her gün XML tedarikçilerinden güncel fiyatları kontrol ederek farklı ülkelerden en uygun paket turları otomatik olarak vitrine taşır.',
  },
  {
    q: 'Online check-in işlemlerini ne zaman yapabilirim?',
    a: 'Tarifeli (regular) uçuşlarda online check-in genellikle uçuşa 24 ila 48 saat kala açılır. Charter uçuşlarda ise (örneğin THY charter seferleri) online check-in bulunmayabilir ve işlemler havalimanı kontuarında yapılır. Detaylar için "Online Check-In" sayfamızdaki kurallar bölümünü inceleyebilirsiniz.',
  },
];

export const CHECKIN_AIRLINES: AirlineCheckIn[] = [
  { code: 'TK', name: 'Turkish Airlines', country: 'TR', popular: true, url: 'https://www.turkishairlines.com/tr-int/ucak-bileti/rezervasyonu-yonet/', color: '#C8102E' },
  { code: 'PC', name: 'Pegasus Airlines', country: 'TR', popular: true, url: 'https://www.flypgs.com/online-check-in', color: '#F59E0B' },
  { code: 'VF', name: 'AJet', country: 'TR', popular: true, url: 'https://ajet.com/tr', color: '#0284C7' },
  { code: 'XQ', name: 'SunExpress', country: 'TR', popular: true, url: 'https://www.sunexpress.com/tr-tr/check-in/', color: '#EA580C' },
  { code: 'KC', name: 'Air Astana', country: 'INTL', popular: true, url: 'https://airastana.com/global-en', color: '#B8860B' },
  { code: 'FS', name: 'FlyArystan', country: 'INTL', popular: true, url: 'https://flyarystan.com/en', color: '#DC2626' },
  { code: 'DV', name: 'SCAT Airlines', country: 'INTL', url: 'https://www.scat.kz/en/', color: '#0369A1' },
  { code: 'J2', name: 'Azerbaijan Airlines', country: 'INTL', popular: true, url: 'https://www.azal.az/en/', color: '#005BAC' },
  { code: 'HY', name: 'Uzbekistan Airways', country: 'INTL', url: 'https://www.uzairways.com/en', color: '#0284C7' },
  { code: 'LH', name: 'Lufthansa', country: 'INTL', popular: true, url: 'https://www.lufthansa.com/tr/en/online-check-in', color: '#05164D' },
  { code: 'EK', name: 'Emirates', country: 'INTL', popular: true, url: 'https://www.emirates.com/tr/turkish/manage-booking/online-check-in/', color: '#D71921' },
  { code: 'QR', name: 'Qatar Airways', country: 'INTL', popular: true, url: 'https://www.qatarairways.com/en/services-checking-in.html', color: '#5C0632' },
  { code: 'BA', name: 'British Airways', country: 'INTL', url: 'https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_gb', color: '#075AAA' },
  { code: 'AF', name: 'Air France', country: 'INTL', url: 'https://wwws.airfrance.com.tr/check-in', color: '#002157' },
  { code: 'KL', name: 'KLM Royal Dutch', country: 'INTL', url: 'https://www.klm.com.tr/check-in', color: '#00A1DE' },
  { code: 'EY', name: 'Etihad Airways', country: 'INTL', url: 'https://www.etihad.com/en/manage/check-in', color: '#BD8B13' },
  { code: 'LX', name: 'SWISS', country: 'INTL', url: 'https://www.swiss.com/tr/en/fly/check-in/online-check-in', color: '#E10600' },
  { code: 'OS', name: 'Austrian Airlines', country: 'INTL', url: 'https://www.austrian.com/tr/en/online-check-in', color: '#E1251B' },
  { code: 'LO', name: 'LOT Polish Airlines', country: 'INTL', url: 'https://www.lot.com/tr/en/check-in', color: '#112769' },
  { code: 'AZ', name: 'ITA Airways', country: 'INTL', url: 'https://www.ita-airways.com/en_en/fly-ita/check-in.html', color: '#003B71' },
  { code: 'IB', name: 'Iberia', country: 'INTL', url: 'https://www.iberia.com/tr/online-checkin/', color: '#D7192D' },
  { code: 'XC', name: 'Corendon Airlines', country: 'TR', url: 'https://www.corendonairlines.com/tr/online-check-in', color: '#E11D48' },
  { code: 'FH', name: 'Freebird Airlines', country: 'TR', url: 'https://www.freebirdairlines.com/tr', color: '#0EA5E9' },
  { code: 'FZ', name: 'flydubai', country: 'INTL', url: 'https://www.flydubai.com/en/flying-with-us/check-in/online-check-in', color: '#0064A6' },
];

const FARE_PACKAGES_BASE: FarePackage[] = [
  {
    id: 'eco',
    name: 'Eco Fly',
    cabin: 'ECONOMY',
    cabinBag: '8 kg kabin bagajı',
    checkedBag: '15 kg uçak altı bagaj',
    refundable: false,
    refundText: 'İade yok',
    changeable: false,
    changeText: 'Ücretli değişiklik',
    meal: 'İkram satın alınabilir',
    seat: 'Standart koltuk',
    priceDelta: 0,
  },
  {
    id: 'extra',
    name: 'Extra Fly',
    cabin: 'ECONOMY',
    cabinBag: '8 kg kabin bagajı',
    checkedBag: '20 kg uçak altı bagaj',
    refundable: false,
    refundText: 'Kesintili iade',
    changeable: true,
    changeText: 'Değişiklik yapılabilir · ücretsiz',
    meal: 'Sıcak ikram dahil',
    seat: 'Standart koltuk seçimi',
    priceDelta: 680,
  },
  {
    id: 'prime',
    name: 'Prime Fly',
    cabin: 'ECONOMY',
    cabinBag: '8 kg kabin bagajı',
    checkedBag: '25 kg uçak altı bagaj',
    refundable: true,
    refundText: 'İade edilebilir · ₺450',
    changeable: true,
    changeText: 'Değişiklik yapılabilir · ücretsiz',
    meal: 'Özel menü ikramı',
    seat: 'Ön sıra koltuk seçimi',
    priceDelta: 1290,
  },
  {
    id: 'business',
    name: 'Business Class',
    cabin: 'BUSINESS',
    cabinBag: '2 × 8 kg kabin bagajı',
    checkedBag: '35 kg uçak altı bagaj',
    refundable: true,
    refundText: 'Tam kesintisiz iade',
    changeable: true,
    changeText: 'Ücretsiz esnek değişiklik',
    meal: 'Lounge + Business menü',
    seat: 'Geniş Business koltuk',
    priceDelta: 4850,
  },
];

const FARE_PACKAGES_I18N: Record<'TR' | 'EN' | 'RU' | 'KK', FarePackage[]> = {
  TR: FARE_PACKAGES_BASE,
  EN: [
    {
      id: 'eco',
      name: 'Eco Fly',
      cabin: 'ECONOMY',
      cabinBag: '8 kg cabin baggage',
      checkedBag: '15 kg checked baggage',
      refundable: false,
      refundText: 'Non-refundable',
      changeable: false,
      changeText: 'Changes with fee',
      meal: 'Snacks for purchase',
      seat: 'Standard seat',
      priceDelta: 0,
    },
    {
      id: 'extra',
      name: 'Extra Fly',
      cabin: 'ECONOMY',
      cabinBag: '8 kg cabin baggage',
      checkedBag: '20 kg checked baggage',
      refundable: false,
      refundText: 'Partial refund',
      changeable: true,
      changeText: 'Free date change',
      meal: 'Hot meal included',
      seat: 'Standard seat selection',
      priceDelta: 680,
    },
    {
      id: 'prime',
      name: 'Prime Fly',
      cabin: 'ECONOMY',
      cabinBag: '8 kg cabin baggage',
      checkedBag: '25 kg checked baggage',
      refundable: true,
      refundText: 'Refundable · ₺450 fee',
      changeable: true,
      changeText: 'Free date change',
      meal: 'Special menu service',
      seat: 'Front row seat selection',
      priceDelta: 1290,
    },
    {
      id: 'business',
      name: 'Business Class',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 kg cabin baggage',
      checkedBag: '35 kg checked baggage',
      refundable: true,
      refundText: 'Full free refund',
      changeable: true,
      changeText: 'Unlimited free changes',
      meal: 'VIP Lounge + Business dining',
      seat: 'Lie-flat Business seat',
      priceDelta: 4850,
    },
  ],
  RU: [
    {
      id: 'eco',
      name: 'Eco Fly',
      cabin: 'ECONOMY',
      cabinBag: '8 кг ручная кладь',
      checkedBag: '15 кг багаж',
      refundable: false,
      refundText: 'Без возврата',
      changeable: false,
      changeText: 'Обмен с доплатой',
      meal: 'Питание за доплату',
      seat: 'Стандартное место',
      priceDelta: 0,
    },
    {
      id: 'extra',
      name: 'Extra Fly',
      cabin: 'ECONOMY',
      cabinBag: '8 кг ручная кладь',
      checkedBag: '20 кг багаж',
      refundable: false,
      refundText: 'Возврат с удержанием',
      changeable: true,
      changeText: 'Бесплатный обмен',
      meal: 'Горячее питание',
      seat: 'Выбор стандартного места',
      priceDelta: 680,
    },
    {
      id: 'prime',
      name: 'Prime Fly',
      cabin: 'ECONOMY',
      cabinBag: '8 кг ручная кладь',
      checkedBag: '25 кг багаж',
      refundable: true,
      refundText: 'Возвратный · сбор ₺450',
      changeable: true,
      changeText: 'Бесплатный обмен',
      meal: 'Специальное меню',
      seat: 'Передние ряды',
      priceDelta: 1290,
    },
    {
      id: 'business',
      name: 'Business Class',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 кг ручная кладь',
      checkedBag: '35 кг багаж',
      refundable: true,
      refundText: 'Полный возврат без штрафа',
      changeable: true,
      changeText: 'Гибкий бесплатный обмен',
      meal: 'VIP-зал + Бизнес-меню',
      seat: 'Широкое кресло Business',
      priceDelta: 4850,
    },
  ],
  KK: [
    {
      id: 'eco',
      name: 'Eco Fly',
      cabin: 'ECONOMY',
      cabinBag: '8 кг қол жүгі',
      checkedBag: '15 кг жолжүк',
      refundable: false,
      refundText: 'Қайтарылмайды',
      changeable: false,
      changeText: 'Ақылы өзгерту',
      meal: 'Тағам ақылы',
      seat: 'Стандартты орын',
      priceDelta: 0,
    },
    {
      id: 'extra',
      name: 'Extra Fly',
      cabin: 'ECONOMY',
      cabinBag: '8 кг қол жүгі',
      checkedBag: '20 кг жолжүк',
      refundable: false,
      refundText: 'Ішінара қайтару',
      changeable: true,
      changeText: 'Тегін өзгерту',
      meal: 'Ыстық тағам кіреді',
      seat: 'Стандартты орын таңдау',
      priceDelta: 680,
    },
    {
      id: 'prime',
      name: 'Prime Fly',
      cabin: 'ECONOMY',
      cabinBag: '8 кг қол жүгі',
      checkedBag: '25 кг жолжүк',
      refundable: true,
      refundText: 'Қайтарылады · ₺450',
      changeable: true,
      changeText: 'Тегін өзгерту',
      meal: 'Арнайы мәзір',
      seat: 'Алдыңғы қатар орны',
      priceDelta: 1290,
    },
    {
      id: 'business',
      name: 'Business Class',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 кг қол жүгі',
      checkedBag: '35 кг жолжүк',
      refundable: true,
      refundText: 'Толық айыппұлсыз қайтару',
      changeable: true,
      changeText: 'Икемді тегін өзгерту',
      meal: 'VIP Lounge + Бизнес мәзір',
      seat: 'Кең Business креслосы',
      priceDelta: 4850,
    },
  ],
};

const BUSINESS_PACKAGES_I18N: Record<'TR' | 'EN' | 'RU' | 'KK', FarePackage[]> = {
  TR: [
    {
      id: 'biz-standard',
      name: 'Business Class',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 kg kabin bagajı',
      checkedBag: '32 kg uçak altı bagaj',
      refundable: true,
      refundText: 'Kesintili iade',
      changeable: true,
      changeText: 'Ücretsiz tarih değişikliği',
      meal: 'Lounge + Business menü',
      seat: 'Geniş Business koltuk',
      priceDelta: 0,
    },
    {
      id: 'biz-flex',
      name: 'Business Flex',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 kg kabin bagajı',
      checkedBag: '40 kg uçak altı bagaj',
      refundable: true,
      refundText: 'Tam kesintisiz iade',
      changeable: true,
      changeText: 'Sınırsız ücretsiz değişiklik',
      meal: 'VIP Lounge + Özel şef menüsü',
      seat: 'Öncelikli Business koltuk + Fast Track',
      priceDelta: 1450,
    },
  ],
  EN: [
    {
      id: 'biz-standard',
      name: 'Business Class',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 kg cabin baggage',
      checkedBag: '32 kg checked baggage',
      refundable: true,
      refundText: 'Partial refund',
      changeable: true,
      changeText: 'Free date change',
      meal: 'Lounge + Business dining',
      seat: 'Lie-flat Business seat',
      priceDelta: 0,
    },
    {
      id: 'biz-flex',
      name: 'Business Flex',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 kg cabin baggage',
      checkedBag: '40 kg checked baggage',
      refundable: true,
      refundText: 'Full free refund',
      changeable: true,
      changeText: 'Unlimited free changes',
      meal: 'VIP Lounge + Signature dining',
      seat: 'Priority Business seat + Fast Track',
      priceDelta: 1450,
    },
  ],
  RU: [
    {
      id: 'biz-standard',
      name: 'Business Class',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 кг ручная кладь',
      checkedBag: '32 кг багаж',
      refundable: true,
      refundText: 'Возврат с удержанием',
      changeable: true,
      changeText: 'Бесплатный обмен даты',
      meal: 'Бизнес-зал + Бизнес-меню',
      seat: 'Широкое кресло Business',
      priceDelta: 0,
    },
    {
      id: 'biz-flex',
      name: 'Business Flex',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 кг ручная кладь',
      checkedBag: '40 кг багаж',
      refundable: true,
      refundText: 'Полный возврат без штрафа',
      changeable: true,
      changeText: 'Гибкий бесплатный обмен',
      meal: 'VIP-зал + Авторское меню',
      seat: 'Приоритетное кресло + Fast Track',
      priceDelta: 1450,
    },
  ],
  KK: [
    {
      id: 'biz-standard',
      name: 'Business Class',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 кг қол жүгі',
      checkedBag: '32 кг жолжүк',
      refundable: true,
      refundText: 'Ішінара қайтару',
      changeable: true,
      changeText: 'Күнді тегін өзгерту',
      meal: 'Бизнес-зал + Бизнес мәзір',
      seat: 'Кең Business креслосы',
      priceDelta: 0,
    },
    {
      id: 'biz-flex',
      name: 'Business Flex',
      cabin: 'BUSINESS',
      cabinBag: '2 × 8 кг қол жүгі',
      checkedBag: '40 кг жолжүк',
      refundable: true,
      refundText: 'Толық айыппұлсыз қайтару',
      changeable: true,
      changeText: 'Шексіз тегін өзгерту',
      meal: 'VIP Lounge + Арнайы мәзір',
      seat: 'Басым Business орны + Fast Track',
      priceDelta: 1450,
    },
  ],
};

const LCC_CODES = new Set(['PC', 'VF', 'XQ']);

export function generateFlights(
  fromCode: string,
  toCode: string,
  departureDate: string,
  cabin: 'Ekonomi' | 'Business',
  lang: 'TR' | 'EN' | 'RU' | 'KK' = 'TR',
  markup: AdminMarkupConfig = DEFAULT_MARKUP,
  currency: CurrencyCode = 'TRY'
): FlightResult[] {
  const fromObj = AIRPORTS.find((a) => a.code === fromCode) || AIRPORTS[0];
  const toObj = AIRPORTS.find((a) => a.code === toCode) || AIRPORTS[4];
  const isDomestic = Boolean(fromObj.domestic && toObj.domestic);
  const isCentralAsia = ['ALA', 'NQZ', 'TAS', 'GYD'].includes(toCode) || ['ALA', 'NQZ', 'TAS', 'GYD'].includes(fromCode);

  const rawNetFare = isDomestic ? 1460 : isCentralAsia ? 6345 : 5220;
  const baseFare = isDomestic
    ? rawNetFare + markup.domesticAddTRY
    : isCentralAsia
      ? Math.round(rawNetFare * (1 + markup.centralAsiaPercent / 100))
      : Math.round(rawNetFare * (1 + markup.intlPercent / 100));
  const cabinMult = cabin === 'Business' ? 2.4 : 1;
  const isReverseDirection = fromCode.localeCompare(toCode) > 0;
  const routeShiftMinutes = isReverseDirection ? 35 : 0;

  const rawTemplates = isDomestic
    ? [
        { airline: 'Turkish Airlines', code: 'TK', color: '#C8102E', numBase: 2410, dep: '06:35', dur: 80, stops: 0, mult: 1.0 },
        { airline: 'Pegasus Airlines', code: 'PC', color: '#D97706', numBase: 2014, dep: '08:15', dur: 85, stops: 0, mult: 0.96 },
        { airline: 'AJet', code: 'VF', color: '#0284C7', numBase: 3028, dep: '10:40', dur: 80, stops: 0, mult: 1.03 },
        { airline: 'SunExpress', code: 'XQ', color: '#EA580C', numBase: 752, dep: '13:20', dur: 85, stops: 0, mult: 1.08 },
        { airline: 'Turkish Airlines', code: 'TK', color: '#C8102E', numBase: 2422, dep: '16:50', dur: 80, stops: 0, mult: 1.15 },
        { airline: 'Pegasus Airlines', code: 'PC', color: '#D97706', numBase: 2038, dep: '19:30', dur: 195, stops: 1, stopCity: 'ESB', mult: 1.12 },
        { airline: 'Turkish Airlines', code: 'TK', color: '#C8102E', numBase: 2444, dep: '22:15', dur: 85, stops: 0, mult: 1.05 },
      ]
    : [
        { airline: 'Air Astana', code: 'KC', color: '#B8860B', numBase: 912, dep: '01:45', dur: 315, stops: 0, mult: 1.0 },
        { airline: 'Turkish Airlines', code: 'TK', color: '#C8102E', numBase: 350, dep: '07:20', dur: 310, stops: 0, mult: 1.09 },
        { airline: 'Pegasus Airlines', code: 'PC', color: '#D97706', numBase: 1580, dep: '11:05', dur: 325, stops: 0, mult: 0.95 },
        { airline: 'Azerbaijan Airlines', code: 'J2', color: '#005BAC', numBase: 78, dep: '14:15', dur: 465, stops: 1, stopCity: 'GYD', mult: 1.04 },
        { airline: 'Lufthansa', code: 'LH', color: '#05164D', numBase: 1304, dep: '17:40', dur: 490, stops: 1, stopCity: 'FRA', mult: 1.24 },
        { airline: 'Turkish Airlines', code: 'TK', color: '#C8102E', numBase: 354, dep: '21:10', dur: 305, stops: 0, mult: 1.16 },
        { airline: 'Emirates', code: 'EK', color: '#D71921', numBase: 122, dep: '23:30', dur: 530, stops: 1, stopCity: 'DXB', mult: 1.32 },
      ];

  const templates = cabin === 'Business'
    ? rawTemplates.filter((t) => !LCC_CODES.has(t.code))
    : rawTemplates;

  const feeFormatted = formatPrice(450, currency);
  const basePackages = (
    cabin === 'Business'
      ? BUSINESS_PACKAGES_I18N[lang] || BUSINESS_PACKAGES_I18N.TR
      : FARE_PACKAGES_I18N[lang] || FARE_PACKAGES_BASE
  ).map((pkg) => ({
    ...pkg,
    refundText: pkg.refundText.replace('₺450', feeFormatted),
  }));

  const durUnits: Record<'TR' | 'EN' | 'RU' | 'KK', [string, string]> = {
    TR: ['sa', 'dk'],
    EN: ['h', 'm'],
    RU: ['ч', 'м'],
    KK: ['сағ', 'м'],
  };
  const [hUnit, mUnit] = durUnits[lang] || durUnits.TR;

  return templates.map((t, idx) => {
    const [dh, dm] = t.dep.split(':').map(Number);
    const minutesPerDay = 24 * 60;
    const rawDepMin = dh * 60 + dm + routeShiftMinutes + (isReverseDirection ? (idx % 3) * 10 : 0);
    const depMin = rawDepMin % minutesPerDay;
    const depH = String(Math.floor(depMin / 60)).padStart(2, '0');
    const depM = String(depMin % 60).padStart(2, '0');
    const dur = t.dur + (isReverseDirection ? (idx % 2 === 0 ? 5 : -5) : 0);
    const arrivalTotal = depMin + dur;
    const arrMin = arrivalTotal % minutesPerDay;
    const ah = String(Math.floor(arrMin / 60)).padStart(2, '0');
    const am = String(arrMin % 60).padStart(2, '0');
    const durH = Math.floor(dur / 60);
    const durM = dur % 60;
    const priceFactor = isReverseDirection ? t.mult * 1.02 : t.mult;
    const price = Math.round((baseFare * priceFactor * cabinMult) / 10) * 10;
    const netCost = Math.round((rawNetFare * priceFactor * cabinMult) / 10) * 10;
    const providerSource = isDomestic
      ? 'BookingAgora / BiletBank B2B XML'
      : isCentralAsia
        ? 'Buranus B2B & Charter XML'
        : 'Amadeus GDS (XML)';
    const flightNum = `${t.code}${String(t.numBase + (isReverseDirection ? 1 : 0)).padStart(t.numBase < 100 ? 3 : 0, '0')}`;

    const packages = cabin === 'Business' || !LCC_CODES.has(t.code)
      ? basePackages
      : basePackages.filter((pkg) => pkg.cabin !== 'BUSINESS');

    return {
      id: `flt-${idx}-${fromCode}-${toCode}-${departureDate}`,
      airline: t.airline,
      airlineCode: t.code,
      airlineColor: t.color,
      flightNumber: flightNum,
      fromCode: fromObj.code,
      fromCity: fromObj.city,
      toCode: toObj.code,
      toCity: toObj.city,
      departTime: `${depH}:${depM}`,
      arriveTime: `${ah}:${am}`,
      departureDate,
      arrivalDate: addCalendarDays(departureDate, Math.floor(arrivalTotal / minutesPerDay)),
      departMinutes: depMin,
      arriveMinutes: arrMin,
      durationMinutes: dur,
      durationLabel: `${durH}${hUnit} ${durM}${mUnit}`,
      stops: t.stops,
      stopCity: t.stopCity,
      basePrice: price,
      netCostTRY: Math.min(price, netCost),
      providerSource,
      seatsLeft: 2 + ((idx * 3 + (isReverseDirection ? 2 : 0)) % 7),
      packages,
    };
  });
}

export function formatTRY(val: number): string {
  return new Intl.NumberFormat('tr-TR').format(val);
}
