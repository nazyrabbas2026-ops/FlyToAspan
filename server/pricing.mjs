// Authoritative Server-Side Pricing & Rule Precedence Engine for FlyToAspan
// Rule Precedence (clearly ordered & auditable):
//   1. Active Airline / Route Specific Rule (`catalog:rules`) overrides Global Flight Markup
//   2. Active Operator Rule (`catalog:operators`) overrides Global Markup when operator matches
//   3. Global Markup (`settings:markup`: domesticAddTRY, centralAsiaPercent, intlPercent, hotelPercent, transferAddTRY)
//   4. Organization B2B Discount (`organizations.discount_percent`, 0-25%)
//   5. Active Coupon Code (`catalog:coupons`)

export const DEFAULT_MARKUP = {
  domesticAddTRY: 180,
  centralAsiaPercent: 7,
  intlPercent: 5,
  hotelPercent: 8,
  transferAddTRY: 150,
  revision: 0,
};

const DOMESTIC_CODES = new Set([
  'IST', 'SAW', 'ESB', 'ADB', 'AYT', 'TZX', 'BJV', 'DLM', 'ADA', 'GZT', 'KYA', 'ERZ', 'GNY', 'VAN',
]);
const CENTRAL_ASIA_CODES = new Set(['ALA', 'NQZ', 'TAS', 'GYD']);

const DOMESTIC_TEMPLATES = [
  { airline: 'Turkish Airlines', code: 'TK', numBase: 2410, mult: 1.0 },
  { airline: 'Pegasus Airlines', code: 'PC', numBase: 2014, mult: 0.96 },
  { airline: 'AJet', code: 'VF', numBase: 3028, mult: 1.03 },
  { airline: 'SunExpress', code: 'XQ', numBase: 752, mult: 1.08 },
  { airline: 'Turkish Airlines', code: 'TK', numBase: 2422, mult: 1.15 },
  { airline: 'Pegasus Airlines', code: 'PC', numBase: 2038, mult: 1.12 },
  { airline: 'Turkish Airlines', code: 'TK', numBase: 2444, mult: 1.05 },
];

const INTL_TEMPLATES = [
  { airline: 'SCAT Airlines Charter', code: 'DV', numBase: 5240, mult: 0.91, charter: true },
  { airline: 'Air Astana', code: 'KC', numBase: 912, mult: 1.0 },
  { airline: 'Turkish Airlines', code: 'TK', numBase: 350, mult: 1.09 },
  { airline: 'Pegasus Airlines', code: 'PC', numBase: 1580, mult: 0.95 },
  { airline: 'Azerbaijan Airlines', code: 'J2', numBase: 78, mult: 1.04 },
  { airline: 'Lufthansa', code: 'LH', numBase: 1304, mult: 1.24 },
  { airline: 'Turkish Airlines', code: 'TK', numBase: 354, mult: 1.16 },
  { airline: 'Emirates', code: 'EK', numBase: 122, mult: 1.32 },
];

const PACKAGE_DELTAS = {
  eco: 0,
  extra: 680,
  prime: 1290,
  'biz-upgrade': 2850,
  'biz-standard': 0,
  'biz-flex': 1450,
};

export function parseRuleExpression(ruleText) {
  const s = String(ruleText || '').trim();
  if (!s) return null;
  if (/^net\b/i.test(s)) return { mode: 'NET', value: 0 };
  const pct = s.match(/([+-]?)\s*%?\s*(\d+(?:[.,]\d+)?)\s*%|%\s*(\d+(?:[.,]\d+)?)/);
  if (pct) {
    const raw = Number((pct[2] || pct[3] || '0').replace(',', '.'));
    const sign = pct[1] === '-' ? -1 : 1;
    if (Number.isFinite(raw)) return { mode: 'PERCENT', value: sign * raw };
  }
  const tryMatch = s.match(/([+-]?)\s*(?:₺|TL|TRY)\s*(\d+(?:[.,]\d+)?)|([+-]?)\s*(\d+(?:[.,]\d+)?)\s*(?:₺|TL|TRY)/i);
  if (tryMatch) {
    const raw = Number((tryMatch[2] || tryMatch[4] || '0').replace(',', '.'));
    const sign = (tryMatch[1] || tryMatch[3]) === '-' ? -1 : 1;
    if (Number.isFinite(raw)) return { mode: 'TRY', value: sign * raw };
  }
  const eurMatch = s.match(/([+-]?)\s*(?:€|EUR)\s*(\d+(?:[.,]\d+)?)|([+-]?)\s*(\d+(?:[.,]\d+)?)\s*(?:€|EUR)/i);
  if (eurMatch) {
    const raw = Number((eurMatch[2] || eurMatch[4] || '0').replace(',', '.'));
    const sign = (eurMatch[1] || eurMatch[3]) === '-' ? -1 : 1;
    if (Number.isFinite(raw)) return { mode: 'EUR', value: sign * raw };
  }
  return null;
}

export function matchAirlineRule(rules, { airline, airlineCode, fromCode, toCode }) {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const hayAirline = `${airline || ''} ${airlineCode || ''}`.toLowerCase();
  const routeKey = fromCode && toCode ? `${fromCode}-${toCode}`.toLowerCase() : '';
  const reverseKey = fromCode && toCode ? `${toCode}-${fromCode}`.toLowerCase() : '';
  for (const r of rules) {
    const carrier = String(r.carrier || '').toLowerCase();
    const route = String(r.route || '').toLowerCase();
    const carrierMatch = !carrier || carrier.includes('tüm') || carrier.includes('all') ||
      (airlineCode && carrier.includes(airlineCode.toLowerCase())) ||
      (airline && (hayAirline.includes(carrier) || carrier.includes(airline.toLowerCase())));
    if (!carrierMatch) continue;
    const routeMatch = !route || route.includes('tüm') || route.includes('all') ||
      (routeKey && (route.includes(routeKey) || route.includes(reverseKey))) ||
      (fromCode && toCode && route.includes(fromCode.toLowerCase()) && route.includes(toCode.toLowerCase())) ||
      (route.includes('yurt içi') && DOMESTIC_CODES.has(fromCode) && DOMESTIC_CODES.has(toCode)) ||
      (route.includes('orta asya') && (CENTRAL_ASIA_CODES.has(fromCode) || CENTRAL_ASIA_CODES.has(toCode)));
    if (!routeMatch) continue;
    const parsed = parseRuleExpression(r.rule);
    if (parsed) {
      return { id: r.id, label: `${r.carrier} (${r.route}): ${r.rule}`, ...parsed };
    }
  }
  return null;
}

export function readServerPricingInputs(db) {
  const mRow = db.prepare("SELECT value FROM settings WHERE key = 'markup'").get();
  const markup = mRow ? { ...DEFAULT_MARKUP, ...JSON.parse(mRow.value) } : { ...DEFAULT_MARKUP };
  const readCat = (sec) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`catalog:${sec}`);
    return row ? (JSON.parse(row.value).items || []) : [];
  };
  return {
    markup,
    rules: readCat('rules'),
    operators: readCat('operators'),
    coupons: readCat('coupons'),
    flights: readCat('flights'),
    hotels: readCat('hotels'),
    transfers: readCat('transfers'),
    tours: readCat('tours'),
  };
}

export function computeCouponDiscount(coupons, code, subtotalTRY, productType) {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) return { appliedCoupon: null, discountTRY: 0 };
  const found = (coupons || []).find((c) => c.active && String(c.code || '').toUpperCase() === cleanCode);
  if (!found) {
    // Also support well-known built-in showcase coupons when catalog:coupons hasn't been customized yet
    const defaults = [
      { code: 'ASPAN350', title: '350 TL İndirim', category: 'Uçak', active: true },
      { code: 'SKYALA18', title: '%18 Avantaj', category: 'Uçak', active: true },
      { code: 'OTEL30', title: '%30 Fırsat', category: 'Otel', active: true },
    ];
    const fallback = (coupons && coupons.length > 0) ? null : defaults.find((d) => d.code === cleanCode);
    if (!fallback) return { appliedCoupon: null, discountTRY: 0, invalidCoupon: true };
    return evaluateCouponRecord(fallback, subtotalTRY, productType);
  }
  return evaluateCouponRecord(found, subtotalTRY, productType);
}

function evaluateCouponRecord(coupon, subtotalTRY, productType) {
  const cat = String(coupon.category || '').toLowerCase();
  const prod = String(productType || '').toLowerCase();
  if (cat && !cat.includes('tüm') && !cat.includes('all') && prod && !prod.includes(cat) && !cat.includes(prod)) {
    return { appliedCoupon: null, discountTRY: 0, invalidCoupon: true };
  }
  const title = String(coupon.title || '');
  const pctMatch = title.match(/%\s*(\d+)|(\d+)\s*%/);
  if (pctMatch) {
    const pct = Math.min(50, Math.max(1, Number(pctMatch[1] || pctMatch[2])));
    const discountTRY = Math.min(Math.round(subtotalTRY * 0.5), Math.round((subtotalTRY * pct) / 100));
    return { appliedCoupon: coupon.code, discountTRY };
  }
  const tlMatch = title.match(/(\d+(?:[.,]\d+)?)\s*(?:TL|TRY|₺)/i) || String(coupon.code).match(/(\d{2,4})$/);
  if (tlMatch) {
    const raw = Number(String(tlMatch[1]).replace(/\./g, '').replace(',', '.'));
    const discountTRY = Math.min(Math.round(subtotalTRY * 0.5), Math.max(0, Math.round(raw)));
    return { appliedCoupon: coupon.code, discountTRY };
  }
  return { appliedCoupon: coupon.code, discountTRY: Math.min(350, Math.round(subtotalTRY * 0.1)) };
}

function computeSingleLegBase({ fromCode, toCode, flightNumber, airline, airlineCode, cabin, markup, rules, manualFlights, eurTryRate = 55 }) {
  const fCode = String(fromCode || 'IST').toUpperCase();
  const tCode = String(toCode || 'AYT').toUpperCase();
  const isDomestic = DOMESTIC_CODES.has(fCode) && DOMESTIC_CODES.has(tCode);
  const isCentralAsia = CENTRAL_ASIA_CODES.has(fCode) || CENTRAL_ASIA_CODES.has(tCode);

  // Check manual flight catalog first
  const mf = (manualFlights || []).find((m) =>
    m.active &&
    String(m.flightNumber || '').toUpperCase() === String(flightNumber || '').toUpperCase() &&
    String(m.fromCode || '').toUpperCase() === fCode &&
    String(m.toCode || '').toUpperCase() === tCode
  );
  if (mf) {
    return {
      unitSaleTRY: Number(mf.priceTRY),
      unitNetTRY: Math.round(Number(mf.priceTRY) * 0.9),
      appliedRule: `Manuel Envanter (${mf.flightNumber})`,
    };
  }

  const rawNetFare = isDomestic ? 1460 : isCentralAsia ? 6345 : 5220;
  const matchedAirlineRule = matchAirlineRule(rules, { airline, airlineCode, fromCode: fCode, toCode: tCode });

  let baseFare;
  let appliedRule;
  if (matchedAirlineRule) {
    appliedRule = `Havayolu Kuralı: ${matchedAirlineRule.label}`;
    if (matchedAirlineRule.mode === 'NET') baseFare = rawNetFare;
    else if (matchedAirlineRule.mode === 'TRY') baseFare = Math.max(500, rawNetFare + matchedAirlineRule.value);
    else if (matchedAirlineRule.mode === 'EUR') baseFare = Math.max(500, Math.round(rawNetFare + matchedAirlineRule.value * eurTryRate));
    else baseFare = Math.max(500, Math.round(rawNetFare * (1 + matchedAirlineRule.value / 100)));
  } else if (isDomestic) {
    appliedRule = `Genel Yurtiçi Marj (+₺${markup.domesticAddTRY})`;
    baseFare = rawNetFare + markup.domesticAddTRY;
  } else if (isCentralAsia) {
    appliedRule = `Genel Orta Asya Marj (+%${markup.centralAsiaPercent})`;
    baseFare = Math.round(rawNetFare * (1 + markup.centralAsiaPercent / 100));
  } else {
    appliedRule = `Genel Yurtdışı Marj (+%${markup.intlPercent})`;
    baseFare = Math.round(rawNetFare * (1 + markup.intlPercent / 100));
  }

  const cabinMult = cabin === 'Business' ? 2.4 : 1;
  const isReverse = fCode.localeCompare(tCode) > 0;
  const templates = isDomestic ? DOMESTIC_TEMPLATES : INTL_TEMPLATES;
  const cleanFlt = String(flightNumber || '').toUpperCase();
  const matchedTpl = templates.find((t) => {
    const numA = `${t.code}${String(t.numBase).padStart(t.numBase < 100 ? 3 : 0, '0')}`;
    const numB = `${t.code}${String(t.numBase + 1).padStart(t.numBase < 100 ? 3 : 0, '0')}`;
    return cleanFlt === numA || cleanFlt === numB;
  }) || templates.find((t) => airlineCode && t.code === airlineCode.toUpperCase()) || templates[0];

  const priceFactor = isReverse ? matchedTpl.mult * 1.02 : matchedTpl.mult;
  const unitSaleTRY = Math.round((baseFare * priceFactor * cabinMult) / 10) * 10;
  const unitNetTRY = Math.round((rawNetFare * priceFactor * cabinMult) / 10) * 10;
  return { unitSaleTRY, unitNetTRY: Math.min(unitSaleTRY, unitNetTRY), appliedRule };
}

export function verifyAndComputeBookingPrice(db, body, user, { isAdminManual = false } = {}) {
  const inputs = readServerPricingInputs(db);
  const type = body.type;
  const ctx = body.pricingContext && typeof body.pricingContext === 'object' ? body.pricingContext : null;

  let orgDiscountPercent = 0;
  if (user?.organization_id) {
    const org = db.prepare('SELECT discount_percent FROM organizations WHERE id = ?').get(user.organization_id);
    orgDiscountPercent = Math.max(0, Math.min(25, Number(org?.discount_percent || 0)));
  }

  // Case 1: Structured pricingContext (sent by Flight/Hotel/Transfer/Tour checkout UI or /api/pricing/quote)
  if (ctx) {
    if (ctx.expiresAt && Number(ctx.expiresAt) < Date.now()) {
      return { expired: true, message: 'Seçilen teklifin süresi doldu. Güncel fiyat kontrol edilmelidir.' };
    }

    if (type === 'Uçak') {
      const adults = Math.max(1, Math.min(9, Number(ctx.adults) || 1));
      const children = Math.max(0, Math.min(6, Number(ctx.children) || 0));
      const infants = Math.max(0, Math.min(adults, Number(ctx.infants) || 0));
      const paxFactor = adults + children * 0.75 + infants * 0.10;
      const paxCount = adults + children + infants;
      const cabin = ctx.cabin === 'Business' ? 'Business' : 'Ekonomi';

      const legContexts = Array.isArray(ctx.legs) && ctx.legs.length > 0
        ? ctx.legs
        : [{
            fromCode: ctx.fromCode || 'IST',
            toCode: ctx.toCode || 'AYT',
            flightNumber: body.flightNumber || ctx.flightNumber,
            airline: body.airline || ctx.airline,
            airlineCode: ctx.airlineCode,
            packageId: ctx.packageId || 'eco',
          }];

      let perPaxSale = 0;
      let perPaxNet = 0;
      const appliedRules = [];
      for (const leg of legContexts.slice(0, 4)) {
        const res = computeSingleLegBase({
          fromCode: leg.fromCode,
          toCode: leg.toCode,
          flightNumber: leg.flightNumber,
          airline: leg.airline,
          airlineCode: leg.airlineCode,
          cabin,
          markup: inputs.markup,
          rules: inputs.rules,
          manualFlights: inputs.flights,
        });
        const pkgDelta = PACKAGE_DELTAS[leg.packageId || 'eco'] ?? 0;
        perPaxSale += res.unitSaleTRY + pkgDelta;
        perPaxNet += res.unitNetTRY + Math.round(pkgDelta * 0.85);
        appliedRules.push(res.appliedRule);
      }

      const baseSubtotal = Math.round(perPaxSale * paxFactor);
      const netSubtotal = Math.round(perPaxNet * paxFactor);
      const autoCheckinFee = body.autoCheckin ? 250 * paxCount : 0;
      const grossBeforeDiscounts = baseSubtotal + autoCheckinFee;
      const b2bDiscount = orgDiscountPercent > 0 ? Math.round((grossBeforeDiscounts * orgDiscountPercent) / 100) : 0;
      const afterB2b = Math.max(100, grossBeforeDiscounts - b2bDiscount);
      const couponRes = computeCouponDiscount(inputs.coupons, body.couponCode || ctx.couponCode, afterB2b, 'Uçak');
      const finalPrice = Math.max(100, afterB2b - couponRes.discountTRY);

      return {
        authoritative: true,
        price: finalPrice,
        netCostTRY: Math.min(finalPrice, netSubtotal),
        profitTRY: Math.round(finalPrice - Math.min(finalPrice, netSubtotal)),
        appliedRule: [...new Set(appliedRules)].join(' + ') +
          (orgDiscountPercent ? ` · Bayi -%${orgDiscountPercent}` : '') +
          (couponRes.appliedCoupon ? ` · Kupon ${couponRes.appliedCoupon}` : ''),
        discountTRY: b2bDiscount + couponRes.discountTRY,
        couponCode: couponRes.appliedCoupon || undefined,
      };
    }

    if (type === 'Otel') {
      const nights = Math.max(1, Math.min(30, Number(ctx.nights) || 2));
      const rooms = Math.max(1, Math.min(9, Number(ctx.rooms) || 1));
      const matched = inputs.hotels.find((h) => h.id === ctx.itemId || h.name === body.title);
      const rawPerNight = matched ? Number(matched.price) : Math.max(650, Number(ctx.baseNightPriceTRY) || 2200);
      const withMarkup = Math.round(rawPerNight * (1 + inputs.markup.hotelPercent / 100));
      const subtotal = withMarkup * nights * rooms;
      const b2bDiscount = orgDiscountPercent > 0 ? Math.round((subtotal * orgDiscountPercent) / 100) : 0;
      const couponRes = computeCouponDiscount(inputs.coupons, body.couponCode || ctx.couponCode, subtotal - b2bDiscount, 'Otel');
      const finalPrice = Math.max(450, subtotal - b2bDiscount - couponRes.discountTRY);
      const netCost = Math.min(finalPrice, Math.round(rawPerNight * nights * rooms));
      return {
        authoritative: true,
        price: finalPrice,
        netCostTRY: netCost,
        profitTRY: finalPrice - netCost,
        appliedRule: `Otel Marj (+%${inputs.markup.hotelPercent})` + (couponRes.appliedCoupon ? ` · Kupon ${couponRes.appliedCoupon}` : ''),
        discountTRY: b2bDiscount + couponRes.discountTRY,
        couponCode: couponRes.appliedCoupon || undefined,
      };
    }

    if (type === 'Transfer') {
      const matched = inputs.transfers.find((t) => t.id === ctx.itemId);
      const rawBase = matched ? Number(matched.price) : Math.max(450, Number(ctx.basePriceTRY) || 1100);
      const subtotal = rawBase + inputs.markup.transferAddTRY;
      const b2bDiscount = orgDiscountPercent > 0 ? Math.round((subtotal * orgDiscountPercent) / 100) : 0;
      const couponRes = computeCouponDiscount(inputs.coupons, body.couponCode || ctx.couponCode, subtotal - b2bDiscount, 'Transfer');
      const finalPrice = Math.max(300, subtotal - b2bDiscount - couponRes.discountTRY);
      const netCost = Math.min(finalPrice, rawBase);
      return {
        authoritative: true,
        price: finalPrice,
        netCostTRY: netCost,
        profitTRY: finalPrice - netCost,
        appliedRule: `Transfer Marj (+₺${inputs.markup.transferAddTRY})` + (couponRes.appliedCoupon ? ` · Kupon ${couponRes.appliedCoupon}` : ''),
        discountTRY: b2bDiscount + couponRes.discountTRY,
        couponCode: couponRes.appliedCoupon || undefined,
      };
    }

    if (type === 'Tur') {
      const paxCount = Math.max(1, Math.min(12, Number(ctx.paxCount) || 1));
      const matched = inputs.tours.find((t) => t.id === ctx.itemId || t.title === body.title);
      const unitPrice = matched ? Number(matched.price) : Math.max(950, Number(ctx.unitPriceTRY) || 3500);
      const subtotal = unitPrice * paxCount;
      const b2bDiscount = orgDiscountPercent > 0 ? Math.round((subtotal * orgDiscountPercent) / 100) : 0;
      const couponRes = computeCouponDiscount(inputs.coupons, body.couponCode || ctx.couponCode, subtotal - b2bDiscount, 'Tur');
      const finalPrice = Math.max(450, subtotal - b2bDiscount - couponRes.discountTRY);
      const netCost = Math.min(finalPrice, Math.round(subtotal * 0.88));
      return {
        authoritative: true,
        price: finalPrice,
        netCostTRY: netCost,
        profitTRY: finalPrice - netCost,
        appliedRule: 'Tur Katalog Tarifesi' + (couponRes.appliedCoupon ? ` · Kupon ${couponRes.appliedCoupon}` : ''),
        discountTRY: b2bDiscount + couponRes.discountTRY,
        couponCode: couponRes.appliedCoupon || undefined,
      };
    }
  }

  // Case 2: Direct API callers without pricingContext (reject tampered/absurd prices like 1 TL!)
  const submitted = Math.round(Number(body.price) * 100) / 100;
  if (!Number.isFinite(submitted) || submitted <= 0 || submitted > 10_000_000) {
    return { rejected: true, status: 400, message: 'Tutar geçersiz.' };
  }

  if (!isAdminManual) {
    // Parse route codes if Flight to enforce realistic route floor (blocks price: 1 TL tampering!)
    const routeMatches = String(body.title || '').match(/\(([A-Z]{3})\)/g)?.map((m) => m.slice(1, 4)) || [];
    const fromCode = body.legs?.[0]?.fromCode || routeMatches[0] || '';
    const toCode = body.legs?.[0]?.toCode || routeMatches[1] || '';
    const isDom = fromCode && toCode && DOMESTIC_CODES.has(fromCode) && DOMESTIC_CODES.has(toCode);
    const minFloor =
      type === 'Uçak' ? (isDom ? 900 : 1200) :
      type === 'Otel' ? 450 :
      type === 'Transfer' ? 300 :
      450;
    if (submitted < minFloor) {
      return {
        rejected: true,
        status: 400,
        message: `Gönderilen tutar (₺${submitted}) sunucu tarife alt sınırının (₺${minFloor}) altında olduğu için reddedildi.`,
      };
    }
  }

  return {
    authoritative: false,
    price: submitted,
    appliedRule: isAdminManual ? 'Yönetici Manuel Fiyat' : 'Sunucu Tarife Doğrulaması (Standart)',
  };
}
