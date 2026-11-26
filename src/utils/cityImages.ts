import type { FlightDeal } from '../data/mockData';

const CITY_PHOTO_MAP: Array<{ keys: string[]; image: string; label: string }> = [
  {
    keys: ['ala', 'almati', 'almaty', 'алматы', 'алмата'],
    image: '/images/almaty.jpg',
    label: 'Almatı',
  },
  {
    keys: ['ayt', 'antalya', 'belek', 'lara', 'kemer', 'side', 'alanya', 'анталья', 'анталия'],
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80',
    label: 'Antalya',
  },
  {
    keys: ['ist', 'saw', 'istanbul', 'стамбул', 'ыстамбұл'],
    image: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=80',
    label: 'İstanbul',
  },
  {
    keys: ['adb', 'izmir', 'cesme', 'alacati', 'измир'],
    image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=900&q=80',
    label: 'İzmir',
  },
  {
    keys: ['esb', 'ankara', 'анкара'],
    image: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=900&q=80',
    label: 'Ankara',
  },
  {
    keys: ['tzx', 'trabzon', 'rize', 'karadeniz', 'трабзон'],
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80',
    label: 'Trabzon',
  },
  {
    keys: ['bjv', 'bodrum', 'mugla', 'dlm', 'dalaman', 'fethiye', 'marmaris', 'бодрум'],
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    label: 'Bodrum / Ege',
  },
  {
    keys: ['asr', 'nav', 'kapadokya', 'cappadocia', 'nevsehir', 'kayseri', 'каппадокия'],
    image: 'https://images.unsplash.com/photo-1641128324972-af3212f0f6bd?auto=format&fit=crop&w=900&q=80',
    label: 'Kapadokya',
  },
  {
    keys: ['lhr', 'lgw', 'stn', 'londra', 'london', 'лондон'],
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=900&q=80',
    label: 'Londra',
  },
  {
    keys: ['ams', 'amsterdam', 'амстердам'],
    image: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80',
    label: 'Amsterdam',
  },
  {
    keys: ['cdg', 'ory', 'paris', 'париж'],
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80',
    label: 'Paris',
  },
  {
    keys: ['fco', 'cia', 'roma', 'rome', 'italya', 'рим'],
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=900&q=80',
    label: 'Roma',
  },
  {
    keys: ['dxb', 'auh', 'dubai', 'abu dhabi', 'дубай'],
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=80',
    label: 'Dubai',
  },
  {
    keys: ['nqz', 'astana', 'nur-sultan', 'астана'],
    image: 'https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?auto=format&fit=crop&w=900&q=80',
    label: 'Astana',
  },
  {
    keys: ['gyd', 'baku', 'bakü', 'баку'],
    image: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?auto=format&fit=crop&w=900&q=80',
    label: 'Bakü',
  },
  {
    keys: ['tas', 'taskent', 'tashkent', 'semerkand', 'ташкент'],
    image: 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?auto=format&fit=crop&w=900&q=80',
    label: 'Taşkent',
  },
  {
    keys: ['svo', 'dme', 'vko', 'moskova', 'moscow', 'москва'],
    image: 'https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&w=900&q=80',
    label: 'Moskova',
  },
  {
    keys: ['cai', 'ssh', 'hrg', 'kahire', 'cairo', 'sharm', 'sarm', 'misir', 'каир'],
    image: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&w=900&q=80',
    label: 'Kahire / Mısır',
  },
  {
    keys: ['cmn', 'rak', 'kazablanka', 'casablanca', 'fas', 'marakes'],
    image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=900&q=80',
    label: 'Kazablanka / Fas',
  },
  {
    keys: ['bcn', 'mad', 'barselona', 'barcelona', 'madrid', 'ispanya'],
    image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=900&q=80',
    label: 'Barselona',
  },
  {
    keys: ['ber', 'fra', 'muc', 'berlin', 'frankfurt', 'munih', 'almanya'],
    image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=900&q=80',
    label: 'Berlin / Almanya',
  },
  {
    keys: ['vie', 'viyana', 'vienna', 'prg', 'prag', 'prague', 'balkan', 'saraybosna', 'belgrad'],
    image: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=900&q=80',
    label: 'Viyana / Avrupa',
  },
  {
    keys: ['doh', 'doha', 'katar', 'qatar'],
    image: 'https://images.unsplash.com/photo-1546412414-e1885259563a?auto=format&fit=crop&w=900&q=80',
    label: 'Doha',
  },
];

const DEFAULT_TRAVEL_IMAGE =
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80';

function normalizeToken(input: string): string {
  return input
    .replace(/[İIıi]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function resolveCityImage(cityOrCode: string, customUrl?: string): string {
  const trimmedCustom = (customUrl || '').trim();
  if (trimmedCustom && (trimmedCustom.startsWith('https://') || trimmedCustom.startsWith('/images/'))) {
    return trimmedCustom;
  }
  const norm = normalizeToken(cityOrCode || '');
  if (!norm) return DEFAULT_TRAVEL_IMAGE;
  for (const entry of CITY_PHOTO_MAP) {
    if (entry.keys.some((k) => norm === k || norm.includes(k))) {
      return entry.image;
    }
  }
  return DEFAULT_TRAVEL_IMAGE;
}

export function resolveRegionColor(region: string): FlightDeal['regionColor'] {
  if (region === 'ORTA ASYA') return 'emerald';
  if (region === 'AVRUPA') return 'gold';
  if (region === 'ORTA DOĞU') return 'violet';
  return 'teal';
}
