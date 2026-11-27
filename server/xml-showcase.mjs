/**
 * Daily XML Showcase Sync Service (Hotels & Package Tours)
 *
 * Business rules:
 * - Hotels: Check XML feeds daily, select 5 cheapest hotels (1 cheapest per country where possible).
 * - Package Tours: Check XML feeds daily, select 4 affordable package tours from 4 distinct countries.
 * - Falls back gracefully to a curated multi-country XML offer pool when live provider credentials
 *   are still in "Beklemede" (pending) mode, and automatically switches to live XML parsing once
 *   live provider feed URLs return valid XML hotel/tour offers.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const XML_HOTEL_OFFER_POOL = [
  // Türkiye
  { id: 'xml-htl-tr-1', country: 'Türkiye', city: 'ANTALYA', name: 'Lara Turquoise Resort & Spa', stars: 5, boardType: 'Her Şey Dahil', nights: 2, price: 2490, provider: 'FUN&SUN (XML)', image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&q=80' },
  { id: 'xml-htl-tr-2', country: 'Türkiye', city: 'BODRUM', name: 'Aspan Marina & Spa Resort', stars: 5, boardType: 'Kahvaltı Dahil', nights: 2, price: 2790, provider: 'Kompas Tour (XML)', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80' },
  // Kazakistan
  { id: 'xml-htl-kz-1', country: 'Kazakistan', city: 'ALMATI', name: 'Tien Shan Grand Palace', stars: 5, boardType: 'Kahvaltı Dahil', nights: 2, price: 2680, provider: 'Kompas Tour (XML)', image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80' },
  { id: 'xml-htl-kz-2', country: 'Kazakistan', city: 'ASTANA', name: 'Astana Skyline Suites', stars: 4, boardType: 'Oda Kahvaltı', nights: 2, price: 2940, provider: 'Selfie Travel (XML)', image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80' },
  // BAE / Dubai
  { id: 'xml-htl-ae-1', country: 'BAE', city: 'DUBAİ', name: 'Marina Pearl Suites Dubai', stars: 5, boardType: 'Oda Kahvaltı', nights: 2, price: 3290, provider: 'FUN&SUN (XML)', image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80' },
  { id: 'xml-htl-ae-2', country: 'BAE', city: 'DUBAİ', name: 'Palm Horizon Luxury Resort', stars: 5, boardType: 'Yarım Pansiyon', nights: 2, price: 4150, provider: 'Kompas Tour (XML)', image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80' },
  // Mısır
  { id: 'xml-htl-eg-1', country: 'Mısır', city: 'ŞARM EL-ŞEYH', name: 'Red Sea Coral Bay Resort', stars: 5, boardType: 'Her Şey Dahil', nights: 2, price: 2840, provider: 'Selfie Travel (XML)', image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80' },
  { id: 'xml-htl-eg-2', country: 'Mısır', city: 'HURGADA', name: 'Sunburst Lagoon All-Inclusive', stars: 5, boardType: 'Her Şey Dahil', nights: 2, price: 3120, provider: 'FUN&SUN (XML)', image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80' },
  // Gürcistan
  { id: 'xml-htl-ge-1', country: 'Gürcistan', city: 'BATUM', name: 'Black Sea Boulevard Hotel', stars: 4, boardType: 'Kahvaltı Dahil', nights: 2, price: 2350, provider: 'Kompas Tour (XML)', image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80' },
  { id: 'xml-htl-ge-2', country: 'Gürcistan', city: 'TİFLİS', name: 'Old Town Terrace Boutique', stars: 4, boardType: 'Oda Kahvaltı', nights: 2, price: 2590, provider: 'Selfie Travel (XML)', image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80' },
  // Azerbaycan
  { id: 'xml-htl-az-1', country: 'Azerbaycan', city: 'BAKÜ', name: 'Caspian Flame View Hotel', stars: 5, boardType: 'Kahvaltı Dahil', nights: 2, price: 3450, provider: 'Selfie Travel (XML)', image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80' },
];

const XML_TOUR_OFFER_POOL = [
  // Türkiye
  { id: 'xml-tour-tr-1', country: 'Türkiye', city: 'TÜRKİYE · ANTALYA', title: 'Antalya Ultra Her Şey Dahil Deniz & Aile Paketi', duration: '5 Gece · 6 Gün', includes: 'Gidiş-Dönüş Uçak · 5★ Resort · Her Şey Dahil', quota: 16, price: 16900, provider: 'FUN&SUN (XML)', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85' },
  { id: 'xml-tour-tr-2', country: 'Türkiye', city: 'TÜRKİYE · KAPADOKYA', title: 'Kapadokya Mağara Otel & Balon Kültür Turu', duration: '3 Gece · 4 Gün', includes: 'Uçak · Butik Taş Otel · Kahvaltı · Bölge Gezileri', quota: 12, price: 18400, provider: 'Kompas Tour (XML)', image: 'https://images.unsplash.com/photo-1641128324972-af3212f0f6bd?auto=format&fit=crop&w=900&q=85' },
  // Kazakistan
  { id: 'xml-tour-kz-1', country: 'Kazakistan', city: 'KAZAKİSTAN · ALMATI', title: 'Almatı, Big Almaty Gölü & Shymbulak Kültür Turu', duration: '4 Gece · 5 Gün', includes: 'Gidiş-Dönüş Uçak · 5★ Otel · Rehberli Şehir & Doğa Turu', quota: 14, price: 21400, provider: 'Kompas Tour (XML)', image: '/images/almaty.jpg' },
  { id: 'xml-tour-kz-2', country: 'Kazakistan', city: 'KAZAKİSTAN · ASTANA', title: 'Astana & Burabay Modern Keşif Paketi', duration: '4 Gece · 5 Gün', includes: 'Uçak · 4★ Merkez Otel · Panoramik Geziler', quota: 10, price: 23800, provider: 'Selfie Travel (XML)', image: '/images/almaty.jpg' },
  // Mısır
  { id: 'xml-tour-eg-1', country: 'Mısır', city: 'MISIR · ŞARM EL-ŞEYH', title: 'Şarm El-Şeyh Kızıldeniz & Mercan Koyu Tatil Paketi', duration: '6 Gece · 7 Gün', includes: 'Charter Uçak · 5★ Resort · Her Şey Dahil', quota: 18, price: 19200, provider: 'Selfie Travel (XML)', image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=85' },
  // BAE
  { id: 'xml-tour-ae-1', country: 'BAE', city: 'BAE · DUBAİ', title: 'Dubai Şehir Keşfi, Çöl Safarisi & Marina Paketi', duration: '4 Gece · 5 Gün', includes: 'Gidiş-Dönüş Uçak · 5★ Şehir Oteli · Kahvaltı', quota: 12, price: 22900, provider: 'FUN&SUN (XML)', image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=85' },
  // Balkanlar / Karadağ
  { id: 'xml-tour-me-1', country: 'Karadağ', city: 'KARADAĞ · BUDVA', title: 'Vizesiz Adriyatik: Budva, Kotor & Balkanlar Turu', duration: '5 Gece · 6 Gün', includes: 'Gidiş-Dönüş Uçak · 4★ Oteller · Panoramik Turlar', quota: 14, price: 24500, provider: 'Kompas Tour (XML)', image: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=900&q=85' },
];

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

function parseXmlOffers(xmlText, providerName) {
  const hotels = [];
  const tours = [];

  const hotelMatches = xmlText.match(/<(hotel|accommodation|stay)\b[\s\S]*?<\/\1>/gi) || [];
  for (let i = 0; i < hotelMatches.length && hotels.length < 40; i++) {
    const block = hotelMatches[i];
    const name = extractTag(block, 'name') || extractTag(block, 'title');
    const city = extractTag(block, 'city') || extractTag(block, 'region') || extractTag(block, 'destination');
    const country = extractTag(block, 'country') || city || 'Diğer';
    const rawPrice = Number((extractTag(block, 'price') || extractTag(block, 'amount')).replace(/[^\d.]/g, ''));
    if (name && city && Number.isFinite(rawPrice) && rawPrice > 0) {
      hotels.push({
        id: `xml-live-h-${i}-${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
        country,
        city: city.toUpperCase(),
        name: name.slice(0, 120),
        stars: Math.min(5, Math.max(3, Number(extractTag(block, 'stars')) || 5)),
        boardType: extractTag(block, 'board') || extractTag(block, 'meal') || 'Kahvaltı Dahil',
        nights: Math.min(14, Math.max(1, Number(extractTag(block, 'nights')) || 2)),
        price: Math.round(rawPrice),
        image: extractTag(block, 'image') || undefined,
        provider: providerName,
      });
    }
  }

  const tourMatches = xmlText.match(/<(tour|package)\b[\s\S]*?<\/\1>/gi) || [];
  for (let i = 0; i < tourMatches.length && tours.length < 40; i++) {
    const block = tourMatches[i];
    const title = extractTag(block, 'title') || extractTag(block, 'name');
    const country = extractTag(block, 'country') || extractTag(block, 'destination') || 'Diğer';
    const city = extractTag(block, 'city') || country;
    const rawPrice = Number((extractTag(block, 'price') || extractTag(block, 'amount')).replace(/[^\d.]/g, ''));
    if (title && Number.isFinite(rawPrice) && rawPrice > 0) {
      tours.push({
        id: `xml-live-t-${i}-${title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
        country,
        city: `${country.toUpperCase()} · ${city.toUpperCase()}`.slice(0, 58),
        title: title.slice(0, 140),
        duration: extractTag(block, 'duration') || '5 Gece · 6 Gün',
        includes: extractTag(block, 'includes') || 'Gidiş-Dönüş Uçak · Otel · Rehberlik',
        quota: Math.min(50, Math.max(2, Number(extractTag(block, 'quota')) || 12)),
        price: Math.round(rawPrice),
        image: extractTag(block, 'image') || undefined,
        provider: providerName,
      });
    }
  }

  return { hotels, tours };
}

function isSafeHttpsUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^\[?::1\]?/.test(h)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Selects the cheapest item per distinct country first (1 per country),
 * sorted globally by price ascending, up to `limit`.
 */
export function selectCheapestOnePerCountry(items, limit) {
  const sorted = [...items].sort((a, b) => a.price - b.price);
  const picked = [];
  const usedCountries = new Set();

  for (const item of sorted) {
    if (picked.length >= limit) break;
    const countryKey = String(item.country || item.city || '').trim().toLowerCase();
    if (countryKey && !usedCountries.has(countryKey)) {
      usedCountries.add(countryKey);
      picked.push(item);
    }
  }

  // If fewer distinct countries than limit exist, fill remaining slots with next cheapest items
  if (picked.length < limit) {
    const pickedIds = new Set(picked.map((p) => p.id));
    for (const item of sorted) {
      if (picked.length >= limit) break;
      if (!pickedIds.has(item.id)) {
        pickedIds.add(item.id);
        picked.push(item);
      }
    }
  }

  return picked;
}

export function readXmlShowcaseStatus(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'xml_showcase_sync'").get();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export async function runXmlShowcaseSync(db, { trigger = 'auto-daily', fetchLive = true } = {}) {
  const now = Date.now();
  const providerRow = db.prepare("SELECT value FROM settings WHERE key = 'catalog:providers'").get();
  let providers = [];
  if (providerRow) {
    try {
      providers = JSON.parse(providerRow.value)?.items || [];
    } catch {
      providers = [];
    }
  }

  const xmlProviders = providers.filter(
    (p) => p.active && p.mode !== 'Beklemede' && (isSafeHttpsUrl(p.xmlFeedUrl) || isSafeHttpsUrl(p.apiUrl))
  );

  const liveHotels = [];
  const liveTours = [];
  const providerLogs = [];

  if (fetchLive && xmlProviders.length > 0) {
    for (const p of xmlProviders.slice(0, 6)) {
      const targetUrl = isSafeHttpsUrl(p.xmlFeedUrl) ? p.xmlFeedUrl : p.apiUrl;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3500);
        const res = await fetch(targetUrl, {
          headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}`, Accept: 'application/xml, text/xml' } : { Accept: 'application/xml, text/xml' },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const bodyText = await res.text();
          const parsed = parseXmlOffers(bodyText, p.name);
          liveHotels.push(...parsed.hotels);
          liveTours.push(...parsed.tours);
          providerLogs.push({
            provider: p.name,
            ok: true,
            hotelsFound: parsed.hotels.length,
            toursFound: parsed.tours.length,
          });
        } else {
          providerLogs.push({ provider: p.name, ok: false, hotelsFound: 0, toursFound: 0, note: `HTTP ${res.status}` });
        }
      } catch {
        providerLogs.push({ provider: p.name, ok: false, hotelsFound: 0, toursFound: 0, note: 'Bağlantı zaman aşımı / Beklemede' });
      }
    }
  }

  const usedLiveHotels = liveHotels.length >= 5;
  const usedLiveTours = liveTours.length >= 4;

  const hotelPool = usedLiveHotels ? liveHotels : [...liveHotels, ...XML_HOTEL_OFFER_POOL];
  const tourPool = usedLiveTours ? liveTours : [...liveTours, ...XML_TOUR_OFFER_POOL];

  // Select 5 cheapest hotels (1 per country) & 4 cheapest package tours (4 distinct countries)
  const selectedHotels = selectCheapestOnePerCountry(hotelPool, 5).map((h) => ({
    id: h.id,
    country: h.country,
    city: h.city,
    name: h.name,
    stars: h.stars,
    boardType: h.boardType,
    nights: h.nights,
    price: h.price,
    image: h.image || '',
    provider: h.provider || 'XML Otomatik',
    active: true,
  }));

  const selectedTours = selectCheapestOnePerCountry(tourPool, 4).map((t) => ({
    id: t.id,
    country: t.country,
    city: t.city,
    title: t.title,
    duration: t.duration,
    includes: t.includes,
    quota: t.quota,
    price: t.price,
    image: t.image || '',
    provider: t.provider || 'XML Otomatik',
    active: true,
  }));

  // Persist to catalog:hotels and catalog:tours in SQLite
  const saveCatalogSection = (sectionKey, items) => {
    const key = `catalog:${sectionKey}`;
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    const rev = existing ? (JSON.parse(existing.value).revision || 0) : 0;
    const payload = JSON.stringify({ revision: rev + 1, items });
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, payload);
  };

  saveCatalogSection('hotels', selectedHotels);
  saveCatalogSection('tours', selectedTours);

  const status = {
    lastSyncAt: new Date(now).toISOString(),
    nextSyncAt: new Date(now + ONE_DAY_MS).toISOString(),
    lastSyncMs: now,
    trigger,
    autoEnabled: true,
    intervalHours: 24,
    mode: usedLiveHotels || usedLiveTours ? 'live-xml' : 'xml-ready-pool',
    hotelsCount: selectedHotels.length,
    toursCount: selectedTours.length,
    hotelCountries: selectedHotels.map((h) => h.country),
    tourCountries: selectedTours.map((t) => t.country),
    providerLogs,
  };

  db.prepare(`
    INSERT INTO settings (key, value) VALUES ('xml_showcase_sync', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(JSON.stringify(status));

  return { status, hotels: selectedHotels, tours: selectedTours };
}

export function startDailyXmlShowcaseScheduler(db) {
  const checkAndRun = async () => {
    try {
      const current = readXmlShowcaseStatus(db);
      if (!current || !current.lastSyncMs || Date.now() - current.lastSyncMs >= ONE_DAY_MS) {
        await runXmlShowcaseSync(db, { trigger: 'auto-daily', fetchLive: process.env.NODE_ENV !== 'test' });
      }
    } catch (err) {
      console.error('XML daily showcase sync check failed:', err?.message || err);
    }
  };

  // Run initial check asynchronously on boot
  void checkAndRun();

  // Check every hour if 24h elapsed; unref() so tests/shutdown never hang
  const interval = setInterval(() => {
    void checkAndRun();
  }, 60 * 60 * 1000);
  if (typeof interval.unref === 'function') interval.unref();

  return interval;
}
