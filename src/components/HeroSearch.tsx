import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plane,
  Building2,
  CarTaxiFront,
  ArrowRight,
  ArrowLeftRight,
  PlaneTakeoff,
  PlaneLanding,
  Calendar,
  Users,
  ShieldCheck,
  Tag,
  Headphones,
  Search,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Star,
  Zap,
  Compass,
} from 'lucide-react';
import { AIRPORTS, Airport } from '../data/mockData';
import { addCalendarDays, fromCalendarDate, toCalendarDate } from '../data/calendarDates';
import { TRANSLATIONS } from '../i18n/translations';
import { HeroFlightMap } from './HeroFlightMap';
import {
  FlightSearchQuery,
  HotelSearchQuery,
  LangCode,
  SearchTab,
  TransferSearchQuery,
} from '../types';

interface HeroSearchProps {
  lang: LangCode;
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  flightQuery: FlightSearchQuery;
  onFlightQueryChange: (next: FlightSearchQuery) => void;
  onSearchFlight: (q: FlightSearchQuery) => void;
  onSearchHotel: (q: HotelSearchQuery) => void;
  onSearchTransfer: (q: TransferSearchQuery) => void;
  onSearchTour?: () => void;
}

type CalendarField = 'depart' | 'return' | 'hotelIn' | 'hotelOut' | 'trDate';

function getMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

const PROMO_IMAGES: Record<SearchTab, string> = {
  flight:
    'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=85',
  hotel:
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=85',
  transfer:
    'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=900&q=85',
  tour:
    '/images/almaty.jpg',
};

// High-altitude commercial aircraft in-flight photography for every destination route
const FLIGHT_DEST_IMAGES: Record<string, string> = {
  IST: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=85',
  SAW: 'https://images.unsplash.com/photo-1529074963764-98f45c47344b?auto=format&fit=crop&w=1000&q=85',
  AYT: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1000&q=85',
  ALA: 'https://images.unsplash.com/photo-1540339832862-474599807836?auto=format&fit=crop&w=1000&q=85',
  NQZ: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1000&q=85',
  LHR: 'https://images.unsplash.com/photo-1529074963764-98f45c47344b?auto=format&fit=crop&w=1000&q=85',
  CDG: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1000&q=85',
  AMS: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=85',
  FCO: 'https://images.unsplash.com/photo-1540339832862-474599807836?auto=format&fit=crop&w=1000&q=85',
  DXB: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1000&q=85',
  ADB: 'https://images.unsplash.com/photo-1529074963764-98f45c47344b?auto=format&fit=crop&w=1000&q=85',
  ESB: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1000&q=85',
  TZX: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=85',
};

export const HeroSearch: React.FC<HeroSearchProps> = ({
  lang,
  activeTab,
  onTabChange,
  flightQuery,
  onFlightQueryChange,
  onSearchFlight,
  onSearchHotel,
  onSearchTransfer,
  onSearchTour,
}) => {
  const t = TRANSLATIONS[lang].hero;
  const widgetRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayIso = toCalendarDate(today);

  const [openPop, setOpenPop] = useState<
    null | 'from' | 'to' | 'pax' | CalendarField
  >(null);
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [calMonth, setCalMonth] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
  const [invalidTab, setInvalidTab] = useState<SearchTab | null>(null);
  const [userChangedDest, setUserChangedDest] = useState(false);
  const [recentSearches, setRecentSearches] = useState<
    Array<{ fromCode: string; toCode: string; departDate: string; tripType: 'oneway' | 'roundtrip' | 'multicity' }>
  >(() => {
    try {
      const raw = localStorage.getItem('flytoaspan_recent_searches_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [hotelQuery, setHotelQuery] = useState<HotelSearchQuery>({
    destination: 'Bodrum, Muğla',
    checkIn: addCalendarDays(todayIso, 5),
    checkOut: addCalendarDays(todayIso, 7),
    adults: 2,
    children: 0,
  });

  const [transferQuery, setTransferQuery] = useState<TransferSearchQuery>({
    from: 'İstanbul Havalimanı (IST)',
    to: 'Taksim / Beşiktaş Otel',
    date: addCalendarDays(todayIso, 15),
    time: '14:30',
    adults: 2,
    children: 0,
  });

  useEffect(() => {
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Close popover whenever clicking or tapping anywhere outside an active field/popover wrapper
      if (!target.closest('.u4-field-wrap')) {
        setOpenPop(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenPop(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!openPop || !widgetRef.current) return;
    const timer = window.setTimeout(() => {
      const pop = widgetRef.current?.querySelector('.uf-popover.is-open') as HTMLElement | null;
      if (!pop) return;
      const rect = pop.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 12) {
        pop.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 40);
    return () => window.clearTimeout(timer);
  }, [openPop]);

  const formatDateLocal = (iso: string): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return '';
    return `${d} ${t.months[m - 1].slice(0, 3)} ${y}`;
  };

  const fromAirport = useMemo(
    () => AIRPORTS.find((a) => a.code === flightQuery.fromCode) || AIRPORTS[0],
    [flightQuery.fromCode]
  );
  const toAirport = useMemo(
    () => AIRPORTS.find((a) => a.code === flightQuery.toCode) || AIRPORTS[4],
    [flightQuery.toCode]
  );

  const matchesAirport = (a: Airport, raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) return true;
    return (
      a.city.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.airport.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q) ||
      Boolean(a.aliases?.some((al) => al.toLowerCase().includes(q)))
    );
  };

  const filteredFrom = useMemo(
    () => AIRPORTS.filter((a) => matchesAirport(a, fromFilter)),
    [fromFilter]
  );

  const filteredTo = useMemo(
    () => AIRPORTS.filter((a) => matchesAirport(a, toFilter)),
    [toFilter]
  );

  const totalPax = flightQuery.adults + flightQuery.children + flightQuery.infants;

  const PROMO_META: Record<
    LangCode,
    {
      flight1: string;
      flight2: string;
      hotel1: string;
      hotel2: string;
      transfer1: string;
      transfer2: string;
      hotelChip: string;
      transferChip: string;
      routeSub: (airport: string) => string;
    }
  > = {
    TR: {
      flight1: '500+ rota',
      flight2: 'Anında bilet',
      hotel1: '5.000+ otel',
      hotel2: 'Gerçek fiyat',
      transfer1: 'Özel VIP',
      transfer2: 'Sabit fiyat',
      hotelChip: '★ 5 Yıldız',
      transferChip: 'VIP Mercedes',
      routeSub: (airport) => `${airport} direkt & aktarmalı en uygun uçuşlar.`,
    },
    EN: {
      flight1: '500+ routes',
      flight2: 'Instant booking',
      hotel1: '5,000+ hotels',
      hotel2: 'Transparent rates',
      transfer1: 'Private VIP',
      transfer2: 'Fixed fare',
      hotelChip: '★ 5 Stars',
      transferChip: 'VIP Mercedes',
      routeSub: (airport) => `Best direct & connecting flights to ${airport}.`,
    },
    RU: {
      flight1: '500+ маршрутов',
      flight2: 'Быстрый подбор',
      hotel1: '5 000+ отелей',
      hotel2: 'Честная цена',
      transfer1: 'Частный VIP',
      transfer2: 'Фикс. тариф',
      hotelChip: '★ 5 звёзд',
      transferChip: 'VIP Mercedes',
      routeSub: (airport) => `Лучшие прямые и стыковочные рейсы: ${airport}.`,
    },
    KK: {
      flight1: '500+ бағыт',
      flight2: 'Жылдам іздеу',
      hotel1: '5 000+ қонақүй',
      hotel2: 'Ашық баға',
      transfer1: 'Жеке VIP',
      transfer2: 'Тұрақты баға',
      hotelChip: '★ 5 жұлдыз',
      transferChip: 'VIP Mercedes',
      routeSub: (airport) => `${airport} бағытындағы ең тиімді тікелей және ауыспалы рейстер.`,
    },
  };
  const pm = PROMO_META[lang];

  const promoContent =
    activeTab === 'flight'
      ? { stat1: pm.flight1, stat2: pm.flight2, title: t.flightPromoTitle, sub: t.flightPromoSub }
      : activeTab === 'hotel'
        ? { stat1: pm.hotel1, stat2: pm.hotel2, title: t.hotelPromoTitle, sub: t.hotelPromoSub }
        : activeTab === 'tour'
          ? {
              stat1: lang === 'EN' ? '4 Countries' : lang === 'RU' ? '4 страны' : lang === 'KK' ? '4 ел' : '4 Ülke · 12+ Rota',
              stat2: lang === 'EN' ? 'All-Inclusive' : lang === 'RU' ? 'Всё включено' : lang === 'KK' ? 'Барлығы кіреді' : 'Uçak + Otel Dahil',
              title: lang === 'EN' ? 'Curated Cultural & Holiday Tours' : lang === 'RU' ? 'Авторские туры и отдых' : lang === 'KK' ? 'Мәдени және демалыс турлары' : 'Seçkin Kültür & Tatil Turları',
              sub: lang === 'EN' ? 'Almaty, Cappadocia, Antalya & Visa-Free Balkans with Turkish guides.' : lang === 'RU' ? 'Алматы, Каппадокия, Анталья и безвизовые Балканы.' : lang === 'KK' ? 'Алматы, Каппадокия, Анталья және визасыз Балқан турлары.' : 'Almatı, Kapadokya, Antalya ve vizesiz Balkanlarda her şey dahil paketler.',
            }
          : { stat1: pm.transfer1, stat2: pm.transfer2, title: t.transferPromoTitle, sub: t.transferPromoSub };

  const handleSwapFlight = () => {
    setUserChangedDest(true);
    onFlightQueryChange({
      ...flightQuery,
      fromCode: flightQuery.toCode,
      toCode: flightQuery.fromCode,
    });
  };

  const handleSwapTransfer = () => {
    setTransferQuery((prev) => ({ ...prev, from: prev.to, to: prev.from }));
  };

  const shiftMonth = (delta: number) => {
    setCalMonth((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const showCalendar = (field: CalendarField, selectedIso: string, minIso = todayIso) => {
    setOpenPop(field);
    const date = fromCalendarDate(selectedIso >= minIso ? selectedIso : minIso);
    setCalMonth({ year: date.getFullYear(), month: date.getMonth() });
  };

  const toggleCalendar = (field: CalendarField, selectedIso: string, minIso = todayIso) => {
    if (openPop === field) setOpenPop(null);
    else showCalendar(field, selectedIso, minIso);
  };

  const defaultReturnDate = addCalendarDays(
    flightQuery.departDate >= todayIso ? flightQuery.departDate : todayIso,
    7
  );
  const minReturnDate = flightQuery.departDate > todayIso ? flightQuery.departDate : todayIso;
  const dayAfterCheckIn = addCalendarDays(hotelQuery.checkIn, 1);
  const minHotelOut = dayAfterCheckIn > todayIso ? dayAfterCheckIn : todayIso;

  const invalidDates = {
    flight: flightQuery.departDate < todayIso ||
      (flightQuery.tripType === 'roundtrip' && flightQuery.returnDate < minReturnDate),
    hotel: hotelQuery.checkIn < todayIso || hotelQuery.checkOut < minHotelOut,
    transfer: transferQuery.date < todayIso,
    tour: false,
  };
  const searchError = activeTab === 'flight' && flightQuery.fromCode === flightQuery.toCode
    ? t.invalidFlightRoute
    : invalidDates[activeTab] ? t.invalidDates : '';

  const handleSearch = () => {
    if (searchError) {
      setInvalidTab(activeTab);
      return;
    }

    if (activeTab === 'flight') {
      const entry = {
        fromCode: flightQuery.fromCode,
        toCode: flightQuery.toCode,
        departDate: flightQuery.departDate,
        tripType: flightQuery.tripType,
      };
      const nextRecent = [
        entry,
        ...recentSearches.filter(
          (r) => !(r.fromCode === entry.fromCode && r.toCode === entry.toCode && r.departDate === entry.departDate)
        ),
      ].slice(0, 3);
      setRecentSearches(nextRecent);
      try {
        localStorage.setItem('flytoaspan_recent_searches_v1', JSON.stringify(nextRecent));
      } catch {
        /* ignore */
      }
      onSearchFlight(flightQuery);
    } else if (activeTab === 'hotel') onSearchHotel(hotelQuery);
    else if (activeTab === 'tour') onSearchTour?.();
    else onSearchTransfer(transferQuery);
  };

  const selectDate = (iso: string) => {
    if (openPop === 'depart') {
      const nextReturn = flightQuery.returnDate >= iso ? flightQuery.returnDate : addCalendarDays(iso, 7);
      onFlightQueryChange({ ...flightQuery, departDate: iso, returnDate: nextReturn });
      if (flightQuery.tripType === 'roundtrip') showCalendar('return', nextReturn, iso);
      else setOpenPop(null);
    } else if (openPop === 'return') {
      onFlightQueryChange({ ...flightQuery, returnDate: iso });
      setOpenPop(null);
    } else if (openPop === 'hotelIn') {
      const minOut = addCalendarDays(iso, 1);
      const checkOut = hotelQuery.checkOut >= minOut ? hotelQuery.checkOut : minOut;
      setHotelQuery((prev) => ({ ...prev, checkIn: iso, checkOut }));
      showCalendar('hotelOut', checkOut, minOut);
    } else if (openPop === 'hotelOut') {
      setHotelQuery((prev) => ({ ...prev, checkOut: iso }));
      setOpenPop(null);
    } else if (openPop === 'trDate') {
      setTransferQuery((prev) => ({ ...prev, date: iso }));
      setOpenPop(null);
    }
  };

  const renderCalendarPopover = (
    title: string,
    selectedIso: string,
    minIso = todayIso,
    isOpen = false
  ) => {
    const nextM = new Date(calMonth.year, calMonth.month + 1, 1);
    const months = [
      { year: calMonth.year, month: calMonth.month },
      { year: nextM.getFullYear(), month: nextM.getMonth() },
    ];
    const monthStart = toCalendarDate(new Date(calMonth.year, calMonth.month, 1));
    const tomorrow = addCalendarDays(todayIso, 1);
    const saturday = addCalendarDays(todayIso, (6 - today.getDay() + 7) % 7);
    const quickDates = [
      { label: t.today, date: todayIso },
      { label: t.tomorrow, date: tomorrow },
      ...(saturday > tomorrow ? [{ label: t.weekend, date: saturday }] : []),
    ].filter(({ date }) => date >= minIso);

    return (
      <div
        className={`uf-popover uf-date-pop ${isOpen ? 'is-open' : ''}`}
        aria-hidden={!isOpen}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="uf-pop-head">
          <span className="uf-pop-title">{title}</span>
          <div className="uf-cal-nav">
            <button
              type="button"
              className="uf-cal-nav-btn"
              aria-label={t.previousMonth}
              disabled={monthStart.slice(0, 7) <= minIso.slice(0, 7)}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="uf-cal-nav-btn" aria-label={t.nextMonth} onClick={() => shiftMonth(1)}>
              <ChevronRight size={16} />
            </button>
            <button type="button" className="uf-cal-nav-btn" onClick={() => setOpenPop(null)}>
              <X size={15} />
            </button>
          </div>
        </div>

        {quickDates.length > 0 && (
          <div className="uf-quick-dates">
            {quickDates.map(({ label, date }) => (
              <button key={date} type="button" className="uf-quick-pill" onClick={() => selectDate(date)}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="uf-months-grid">
          {months.map((m) => {
            const cells = getMonthCells(m.year, m.month);
            return (
              <div key={`${m.year}-${m.month}`}>
                <div className="uf-month-title">
                  {t.months[m.month]} {m.year}
                </div>
                <div className="uf-weekdays">
                  {t.weekdays.map((w) => (
                    <div key={w} className="uf-weekday">
                      {w}
                    </div>
                  ))}
                </div>
                <div className="uf-days-grid">
                  {cells.map((dt, idx) => {
                    if (!dt) return <div key={`empty-${idx}`} />;
                    const iso = toCalendarDate(dt);
                    const disabled = iso < minIso;
                    const isSelected = iso === selectedIso;
                    const isToday = iso === todayIso;
                    const inRange =
                      activeTab === 'flight' &&
                      flightQuery.tripType === 'roundtrip' &&
                      flightQuery.departDate &&
                      flightQuery.returnDate &&
                      iso > flightQuery.departDate &&
                      iso < flightQuery.returnDate;
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={disabled}
                        aria-label={formatDateLocal(iso)}
                        aria-pressed={isSelected}
                        className={`uf-day-btn ${isSelected ? 'selected' : ''} ${
                          isToday ? 'today' : ''
                        } ${inRange ? 'in-range' : ''}`}
                        onClick={() => selectDate(iso)}
                      >
                        {dt.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    );
  };

  const renderAirportOption = (
    a: Airport,
    idx: number,
    onSelect: (code: string) => void
  ) => (
    <button
      key={a.code}
      type="button"
      className="uf-airport-opt"
      style={{ '--i': Math.min(idx, 6) } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(a.code);
        setFromFilter('');
        setToFilter('');
        setOpenPop(null);
      }}
    >
      <div>
        <div className="uf-airport-city">
          {a.city}, {a.country}
        </div>
        <div className="uf-airport-name">{a.airport}</div>
      </div>
      <span className="uf-airport-code">{a.code}</span>
    </button>
  );

  return (
    <section className="hero-section" id="search-hero">
      <h1 className="sr-only">
        {t.heroTitle1} {t.heroTitle2} — FlyToAspan
      </h1>
      <div className="hero-map-band">
        <HeroFlightMap />
      </div>

      {/* Main White Search Widget Card */}
      <div className="container" ref={widgetRef}>
        <div className="u4-card">
          <div className="u4-left">
            {/* TOP TABS: Uçak, Otel, Turlar */}
            <div className="u4-tabs-bar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'flight'}
                className={`u4-tab-btn ${activeTab === 'flight' ? 'active' : ''}`}
                onClick={() => {
                  onTabChange('flight');
                  setOpenPop(null);
                }}
              >
                <Plane size={17} />
                <span>{t.tabFlight}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'hotel'}
                className={`u4-tab-btn ${activeTab === 'hotel' ? 'active' : ''}`}
                onClick={() => {
                  onTabChange('hotel');
                  setOpenPop(null);
                }}
              >
                <Building2 size={17} />
                <span>{t.tabHotel}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'tour'}
                className={`u4-tab-btn ${activeTab === 'tour' ? 'active' : ''}`}
                onClick={() => {
                  onTabChange('tour');
                  setOpenPop(null);
                }}
              >
                <Compass size={17} />
                <span>{lang === 'EN' ? 'Package Tours' : lang === 'RU' ? 'Пакетные туры' : lang === 'KK' ? 'Тур пакеттері' : 'Paket Turlar'}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'transfer'}
                className={`u4-tab-btn ${activeTab === 'transfer' ? 'active' : ''}`}
                onClick={() => {
                  onTabChange('transfer');
                  setOpenPop(null);
                }}
              >
                <CarTaxiFront size={17} />
                <span>{t.tabTransfer}</span>
              </button>
            </div>

            {activeTab === 'tour' && (
              <div className="u4-form-stack" style={{ padding: '8px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div className="u4-field" style={{ cursor: 'default' }}>
                    <span className="u4-label">
                      <MapPin size={13} />{' '}
                      {lang === 'EN' ? 'Countries / Routes' : lang === 'RU' ? 'Страны / Направления' : lang === 'KK' ? 'Елдер / Бағыттар' : 'Bölge / Ülkeler'}
                    </span>
                    <div className="u4-val">
                      {lang === 'EN'
                        ? 'Turkey · Kazakhstan · Egypt · Dubai'
                        : lang === 'RU'
                          ? 'Турция · Казахстан · Египет · Дубай'
                          : lang === 'KK'
                            ? 'Түркия · Қазақстан · Мысыр · Дубай'
                            : 'Türkiye · Kazakistan · Mısır · Dubai'}
                    </div>
                  </div>
                  <div className="u4-field" style={{ cursor: 'default' }}>
                    <span className="u4-label">
                      <Sparkles size={13} />{' '}
                      {lang === 'EN' ? 'Package Includes' : lang === 'RU' ? 'Включено в пакет' : lang === 'KK' ? 'Пакет мазмұны' : 'Paket İçeriği'}
                    </span>
                    <div className="u4-val">
                      {lang === 'EN'
                        ? 'Flight + Handpicked Hotel + Guided Stays'
                        : lang === 'RU'
                          ? 'Перелёт + Отель 5★ + Проживание и гид'
                          : lang === 'KK'
                            ? 'Ұшақ + Таңдаулы қонақүй + Гид қызметі'
                            : 'Uçak + Seçkin Otel + Konaklama & Rehberlik'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= FLIGHT FORM ================= */}
            {activeTab === 'flight' && (
              <div className="u4-form-stack">
                <div className="u4-trip-bar">
                  <button
                    type="button"
                    className={`u4-trip-btn ${flightQuery.tripType === 'oneway' ? 'active' : ''}`}
                    onClick={() =>
                      onFlightQueryChange({ ...flightQuery, tripType: 'oneway' })
                    }
                  >
                    <ArrowRight size={15} />
                    <span>{t.oneWay}</span>
                  </button>
                  <button
                    type="button"
                    className={`u4-trip-btn ${flightQuery.tripType === 'roundtrip' ? 'active' : ''}`}
                    onClick={() =>
                      onFlightQueryChange({
                        ...flightQuery,
                        tripType: 'roundtrip',
                        returnDate: flightQuery.returnDate >= minReturnDate
                          ? flightQuery.returnDate
                          : defaultReturnDate,
                      })
                    }
                  >
                    <ArrowLeftRight size={15} />
                    <span>{t.roundTrip}</span>
                  </button>
                  <button
                    type="button"
                    className={`u4-trip-btn ${flightQuery.tripType === 'multicity' ? 'active' : ''}`}
                    onClick={() =>
                      onFlightQueryChange({
                        ...flightQuery,
                        tripType: 'multicity',
                        leg2FromCode: flightQuery.leg2FromCode || flightQuery.toCode,
                        leg2ToCode: flightQuery.leg2ToCode || (flightQuery.toCode === 'ALA' ? 'NQZ' : 'ALA'),
                        leg2Date: flightQuery.leg2Date || addCalendarDays(flightQuery.departDate, 4),
                      })
                    }
                  >
                    <Compass size={15} />
                    <span>{lang === 'EN' ? 'Multi-City' : lang === 'RU' ? 'Сложный маршрут' : lang === 'KK' ? 'Көп қалалы' : 'Çoklu Uçuş'}</span>
                  </button>
                </div>

                {flightQuery.tripType === 'multicity' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(0, 168, 181, 0.07)',
                      border: '1px dashed rgba(0, 168, 181, 0.45)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--aspan-teal-deep)', marginBottom: 3 }}>
                        {lang === 'EN' ? 'Leg 2 Origin' : lang === 'RU' ? '2-й сегмент: Вылет' : lang === 'KK' ? '2-кезең: Ұшу' : '2. Etap Kalkış'}
                      </div>
                      <select
                        className="modal-input"
                        style={{ height: 34, fontSize: 12 }}
                        value={flightQuery.leg2FromCode || flightQuery.toCode}
                        onChange={(e) => onFlightQueryChange({ ...flightQuery, leg2FromCode: e.target.value })}
                      >
                        {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--aspan-teal-deep)', marginBottom: 3 }}>
                        {lang === 'EN' ? 'Leg 2 Destination' : lang === 'RU' ? '2-й сегмент: Прилёт' : lang === 'KK' ? '2-кезең: Қону' : '2. Etap Varış'}
                      </div>
                      <select
                        className="modal-input"
                        style={{ height: 34, fontSize: 12 }}
                        value={flightQuery.leg2ToCode || 'NQZ'}
                        onChange={(e) => onFlightQueryChange({ ...flightQuery, leg2ToCode: e.target.value })}
                      >
                        {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--aspan-teal-deep)', marginBottom: 3 }}>
                        {lang === 'EN' ? 'Leg 2 Date' : lang === 'RU' ? '2-й сегмент: Дата' : lang === 'KK' ? '2-кезең: Күні' : '2. Etap Tarihi'}
                      </div>
                      <input
                        type="date"
                        className="modal-input"
                        style={{ height: 34, fontSize: 12 }}
                        min={flightQuery.departDate}
                        value={flightQuery.leg2Date || addCalendarDays(flightQuery.departDate, 4)}
                        onChange={(e) => onFlightQueryChange({ ...flightQuery, leg2Date: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="u4-row-route">
                  <div className="u4-field-wrap">
                    <div
                      className={`u4-field ${openPop === 'from' ? 'focused' : ''}`}
                      onClick={() => setOpenPop('from')}
                    >
                      <span className="u4-label">
                        <PlaneTakeoff size={13} />
                        {t.from}
                      </span>
                      <input
                        id="flight-from"
                        name="flightFrom"
                        className="u4-input"
                        value={
                          openPop === 'from'
                            ? fromFilter
                            : `${fromAirport.city} (${fromAirport.code})`
                        }
                        placeholder={t.cityOrAirport}
                        onFocus={() => setOpenPop('from')}
                        onChange={(e) => setFromFilter(e.target.value)}
                      />
                    </div>
                    <div
                      className={`uf-popover uf-airport-pop ${openPop === 'from' ? 'is-open' : ''}`}
                      aria-hidden={openPop !== 'from'}
                    >
                      {filteredFrom.map((a, idx) =>
                        renderAirportOption(a, idx, (code) =>
                          onFlightQueryChange({ ...flightQuery, fromCode: code })
                        )
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="u4-swap-btn"
                    onClick={handleSwapFlight}
                    aria-label="Swap origin and destination"
                  >
                    <ArrowLeftRight size={17} />
                  </button>

                  <div className="u4-field-wrap">
                    <div
                      className={`u4-field ${openPop === 'to' ? 'focused' : ''}`}
                      onClick={() => setOpenPop('to')}
                    >
                      <span className="u4-label">
                        <PlaneLanding size={13} />
                        {t.to}
                      </span>
                      <input
                        id="flight-to"
                        name="flightTo"
                        className="u4-input"
                        value={
                          openPop === 'to'
                            ? toFilter
                            : `${toAirport.city} (${toAirport.code})`
                        }
                        placeholder={t.cityOrAirport}
                        onFocus={() => setOpenPop('to')}
                        onChange={(e) => setToFilter(e.target.value)}
                      />
                    </div>
                    <div
                      className={`uf-popover uf-airport-pop ${openPop === 'to' ? 'is-open' : ''}`}
                      aria-hidden={openPop !== 'to'}
                    >
                      {filteredTo.map((a, idx) =>
                        renderAirportOption(a, idx, (code) => {
                          setUserChangedDest(true);
                          onFlightQueryChange({ ...flightQuery, toCode: code });
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className={flightQuery.tripType === 'roundtrip' ? 'u4-row-3' : 'u4-row-2'}>
                  <div className="u4-field-wrap">
                    <button
                      type="button"
                      className={`u4-field u4-date-field ${openPop === 'depart' ? 'focused' : ''}`}
                      aria-expanded={openPop === 'depart'}
                      onClick={() => toggleCalendar('depart', flightQuery.departDate)}
                    >
                      <span className="u4-label">
                        <Calendar size={13} />
                        {t.depart}
                      </span>
                      <span
                        className={`u4-value-text ${flightQuery.departDate ? '' : 'placeholder'}`}
                      >
                        {flightQuery.departDate
                          ? formatDateLocal(flightQuery.departDate)
                          : t.selectDate}
                      </span>
                    </button>
                    {renderCalendarPopover(
                      t.depart,
                      flightQuery.departDate,
                      todayIso,
                      openPop === 'depart'
                    )}
                  </div>

                  {flightQuery.tripType === 'roundtrip' && (
                    <div className="u4-field-wrap">
                      <button
                        type="button"
                        className={`u4-field u4-date-field ${openPop === 'return' ? 'focused' : ''}`}
                        aria-expanded={openPop === 'return'}
                        onClick={() => toggleCalendar('return', flightQuery.returnDate, minReturnDate)}
                      >
                        <span className="u4-label">
                          <Calendar size={13} />
                          {t.returnLbl}
                        </span>
                        <span
                          className={`u4-value-text ${flightQuery.returnDate ? '' : 'placeholder'}`}
                        >
                          {flightQuery.returnDate
                            ? formatDateLocal(flightQuery.returnDate)
                            : t.selectDate}
                        </span>
                      </button>
                      {renderCalendarPopover(
                        t.returnLbl,
                        flightQuery.returnDate,
                        minReturnDate,
                        openPop === 'return'
                      )}
                    </div>
                  )}

                  <div className="u4-field-wrap">
                    <button
                      type="button"
                      className={`u4-field u4-date-field ${openPop === 'pax' ? 'focused' : ''}`}
                      aria-expanded={openPop === 'pax'}
                      onClick={() => setOpenPop(openPop === 'pax' ? null : 'pax')}
                    >
                      <span className="u4-label">
                        <Users size={13} />
                        {t.paxCabin}
                      </span>
                      <span className="u4-value-text">
                        {totalPax} {t.passengerUnit},{' '}
                        {flightQuery.cabin === 'Ekonomi' ? t.economy : t.business}
                      </span>
                    </button>

                    <div
                      className={`uf-popover uf-pax-pop ${openPop === 'pax' ? 'is-open' : ''}`}
                      aria-hidden={openPop !== 'pax'}
                      onClick={(e) => e.stopPropagation()}
                    >
                        <div className="uf-pop-head" style={{ marginBottom: 4 }}>
                          <div>
                            <div className="uf-pop-title">{t.paxModalTitle}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>
                              {t.paxModalSub}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="uf-cal-nav-btn"
                            onClick={() => setOpenPop(null)}
                          >
                            <X size={15} />
                          </button>
                        </div>

                        <div className="uf-cabin-toggle">
                          <button
                            type="button"
                            className={`uf-cabin-btn ${
                              flightQuery.cabin === 'Ekonomi' ? 'active' : ''
                            }`}
                            onClick={() =>
                              onFlightQueryChange({ ...flightQuery, cabin: 'Ekonomi' })
                            }
                          >
                            {t.economy}
                          </button>
                          <button
                            type="button"
                            className={`uf-cabin-btn ${
                              flightQuery.cabin === 'Business' ? 'active' : ''
                            }`}
                            onClick={() =>
                              onFlightQueryChange({ ...flightQuery, cabin: 'Business' })
                            }
                          >
                            {t.business}
                          </button>
                        </div>

                        <div className="uf-pax-row">
                          <div>
                            <div className="uf-pax-label">{t.adultUnit}</div>
                            <div className="uf-pax-sub">12+</div>
                          </div>
                          <div className="uf-pax-ctrl">
                            <button
                              type="button"
                              className="u4-step-btn"
                              disabled={flightQuery.adults <= 1}
                              onClick={() => {
                                const nextAdults = Math.max(1, flightQuery.adults - 1);
                                onFlightQueryChange({
                                  ...flightQuery,
                                  adults: nextAdults,
                                  infants: Math.min(flightQuery.infants, nextAdults),
                                });
                              }}
                            >
                              −
                            </button>
                            <span className="uf-pax-count">{flightQuery.adults}</span>
                            <button
                              type="button"
                              className="u4-step-btn"
                              disabled={flightQuery.adults >= 9}
                              onClick={() =>
                                onFlightQueryChange({
                                  ...flightQuery,
                                  adults: flightQuery.adults + 1,
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="uf-pax-row">
                          <div>
                            <div className="uf-pax-label">{t.childUnit}</div>
                            <div className="uf-pax-sub">2–11</div>
                          </div>
                          <div className="uf-pax-ctrl">
                            <button
                              type="button"
                              className="u4-step-btn"
                              disabled={flightQuery.children <= 0}
                              onClick={() =>
                                onFlightQueryChange({
                                  ...flightQuery,
                                  children: Math.max(0, flightQuery.children - 1),
                                })
                              }
                            >
                              −
                            </button>
                            <span className="uf-pax-count">{flightQuery.children}</span>
                            <button
                              type="button"
                              className="u4-step-btn"
                              disabled={flightQuery.children >= 6}
                              onClick={() =>
                                onFlightQueryChange({
                                  ...flightQuery,
                                  children: flightQuery.children + 1,
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="uf-pax-row">
                          <div>
                            <div className="uf-pax-label">{t.infants}</div>
                            <div className="uf-pax-sub">0–2</div>
                          </div>
                          <div className="uf-pax-ctrl">
                            <button
                              type="button"
                              className="u4-step-btn"
                              disabled={flightQuery.infants <= 0}
                              onClick={() =>
                                onFlightQueryChange({
                                  ...flightQuery,
                                  infants: Math.max(0, flightQuery.infants - 1),
                                })
                              }
                            >
                              −
                            </button>
                            <span className="uf-pax-count">{flightQuery.infants}</span>
                            <button
                              type="button"
                              className="u4-step-btn"
                              disabled={flightQuery.infants >= flightQuery.adults}
                              onClick={() =>
                                onFlightQueryChange({
                                  ...flightQuery,
                                  infants: flightQuery.infants + 1,
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="uf-pop-done"
                          onClick={() => setOpenPop(null)}
                        >
                          {t.done}
                        </button>
                      </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= HOTEL FORM ================= */}
            {activeTab === 'hotel' && (
              <div className="u4-form-stack">
                <div className="u4-field">
                  <span className="u4-label">
                    <MapPin size={13} />
                    {t.to}
                  </span>
                  <input
                    id="hotel-dest"
                    name="hotelDest"
                    className="u4-input"
                    value={hotelQuery.destination}
                    placeholder={t.cityOrHotel}
                    onChange={(e) =>
                      setHotelQuery((prev) => ({ ...prev, destination: e.target.value }))
                    }
                  />
                </div>

                <div className="u4-row-4">
                  <div className="u4-field-wrap">
                    <button
                      type="button"
                      className={`u4-field u4-date-field ${openPop === 'hotelIn' ? 'focused' : ''}`}
                      aria-expanded={openPop === 'hotelIn'}
                      onClick={() => toggleCalendar('hotelIn', hotelQuery.checkIn)}
                    >
                      <span className="u4-label">
                        <Calendar size={13} />
                        {t.checkIn}
                      </span>
                      <span className="u4-value-text">{formatDateLocal(hotelQuery.checkIn)}</span>
                    </button>
                    {renderCalendarPopover(
                      t.checkIn,
                      hotelQuery.checkIn,
                      todayIso,
                      openPop === 'hotelIn'
                    )}
                  </div>

                  <div className="u4-field-wrap">
                    <button
                      type="button"
                      className={`u4-field u4-date-field ${openPop === 'hotelOut' ? 'focused' : ''}`}
                      aria-expanded={openPop === 'hotelOut'}
                      onClick={() => toggleCalendar('hotelOut', hotelQuery.checkOut, minHotelOut)}
                    >
                      <span className="u4-label">
                        <Calendar size={13} />
                        {t.checkOut}
                      </span>
                      <span className="u4-value-text">{formatDateLocal(hotelQuery.checkOut)}</span>
                    </button>
                    {renderCalendarPopover(
                      t.checkOut,
                      hotelQuery.checkOut,
                      minHotelOut,
                      openPop === 'hotelOut'
                    )}
                  </div>

                  <div className="u4-field">
                    <span className="u4-label">
                      <Users size={13} />
                      {t.adults}
                    </span>
                    <div className="u4-inline-stepper">
                      <button
                        type="button"
                        className="u4-step-btn"
                        disabled={hotelQuery.adults <= 1}
                        onClick={() =>
                          setHotelQuery((p) => ({ ...p, adults: Math.max(1, p.adults - 1) }))
                        }
                      >
                        −
                      </button>
                      <span className="u4-value-text">
                        {hotelQuery.adults} {t.adultUnit}
                      </span>
                      <button
                        type="button"
                        className="u4-step-btn"
                        onClick={() => setHotelQuery((p) => ({ ...p, adults: p.adults + 1 }))}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="u4-field">
                    <span className="u4-label">
                      <Users size={13} />
                      {t.children}
                    </span>
                    <div className="u4-inline-stepper">
                      <button
                        type="button"
                        className="u4-step-btn"
                        disabled={hotelQuery.children <= 0}
                        onClick={() =>
                          setHotelQuery((p) => ({ ...p, children: Math.max(0, p.children - 1) }))
                        }
                      >
                        −
                      </button>
                      <span className="u4-value-text">
                        {hotelQuery.children} {t.childUnit}
                      </span>
                      <button
                        type="button"
                        className="u4-step-btn"
                        onClick={() => setHotelQuery((p) => ({ ...p, children: p.children + 1 }))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TRANSFER FORM ================= */}
            {activeTab === 'transfer' && (
              <div className="u4-form-stack">
                <div className="u4-row-route">
                  <div className="u4-field">
                    <span className="u4-label">
                      <MapPin size={13} />
                      {t.from}
                    </span>
                    <input
                      id="transfer-from"
                      name="transferFrom"
                      className="u4-input"
                      value={transferQuery.from}
                      placeholder={t.airportOrHotel}
                      onChange={(e) =>
                        setTransferQuery((prev) => ({ ...prev, from: e.target.value }))
                      }
                    />
                  </div>

                  <button
                    type="button"
                    className="u4-swap-btn"
                    onClick={handleSwapTransfer}
                    aria-label="Swap transfer route"
                  >
                    <ArrowLeftRight size={17} />
                  </button>

                  <div className="u4-field">
                    <span className="u4-label">
                      <MapPin size={13} />
                      {t.to}
                    </span>
                    <input
                      id="transfer-to"
                      name="transferTo"
                      className="u4-input"
                      value={transferQuery.to}
                      placeholder={t.airportOrHotel}
                      onChange={(e) =>
                        setTransferQuery((prev) => ({ ...prev, to: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="u4-row-4">
                  <div className="u4-field-wrap">
                    <button
                      type="button"
                      className={`u4-field u4-date-field ${openPop === 'trDate' ? 'focused' : ''}`}
                      aria-expanded={openPop === 'trDate'}
                      onClick={() => toggleCalendar('trDate', transferQuery.date)}
                    >
                      <span className="u4-label">
                        <Calendar size={13} />
                        {t.date}
                      </span>
                      <span className="u4-value-text">{formatDateLocal(transferQuery.date)}</span>
                    </button>
                    {renderCalendarPopover(
                      t.date,
                      transferQuery.date,
                      todayIso,
                      openPop === 'trDate'
                    )}
                  </div>

                  <div className="u4-field">
                    <span className="u4-label">
                      <Clock size={13} />
                      {t.time}
                    </span>
                    <input
                      id="transfer-time"
                      name="transferTime"
                      type="time"
                      className="u4-input"
                      value={transferQuery.time}
                      onChange={(e) =>
                        setTransferQuery((prev) => ({ ...prev, time: e.target.value }))
                      }
                    />
                  </div>

                  <div className="u4-field">
                    <span className="u4-label">
                      <Users size={13} />
                      {t.adults}
                    </span>
                    <div className="u4-inline-stepper">
                      <button
                        type="button"
                        className="u4-step-btn"
                        disabled={transferQuery.adults <= 1}
                        onClick={() =>
                          setTransferQuery((p) => ({ ...p, adults: Math.max(1, p.adults - 1) }))
                        }
                      >
                        −
                      </button>
                      <span className="u4-value-text">
                        {transferQuery.adults} {t.adultUnit}
                      </span>
                      <button
                        type="button"
                        className="u4-step-btn"
                        onClick={() => setTransferQuery((p) => ({ ...p, adults: p.adults + 1 }))}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="u4-field">
                    <span className="u4-label">
                      <Users size={13} />
                      {t.children}
                    </span>
                    <div className="u4-inline-stepper">
                      <button
                        type="button"
                        className="u4-step-btn"
                        disabled={transferQuery.children <= 0}
                        onClick={() =>
                          setTransferQuery((p) => ({
                            ...p,
                            children: Math.max(0, p.children - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <span className="u4-value-text">
                        {transferQuery.children} {t.childUnit}
                      </span>
                      <button
                        type="button"
                        className="u4-step-btn"
                        onClick={() =>
                          setTransferQuery((p) => ({ ...p, children: p.children + 1 }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'flight' && recentSearches.length > 0 && (
              <div className="recent-searches-row">
                <span className="recent-searches-lbl">
                  {lang === 'EN' ? 'Recent:' : lang === 'RU' ? 'Недавние:' : lang === 'KK' ? 'Соңғы:' : 'Son aramalar:'}
                </span>
                {recentSearches.map((r) => (
                  <button
                    key={`${r.fromCode}-${r.toCode}-${r.departDate}`}
                    type="button"
                    className="recent-search-chip"
                    onClick={() => {
                      const nextQ: FlightSearchQuery = {
                        ...flightQuery,
                        fromCode: r.fromCode,
                        toCode: r.toCode,
                        departDate: r.departDate >= todayIso ? r.departDate : todayIso,
                        tripType: r.tripType,
                      };
                      onFlightQueryChange(nextQ);
                      onSearchFlight(nextQ);
                    }}
                  >
                    {r.fromCode} → {r.toCode} · {formatDateLocal(r.departDate >= todayIso ? r.departDate : todayIso)}
                  </button>
                ))}
              </div>
            )}
            {invalidTab === activeTab && searchError && (
              <p className="u4-search-error" role="alert">{searchError}</p>
            )}
            {/* Trust badges & Submit button */}
            <div className="u4-footer-strip">
              <div className="u4-trust-list">
                <span className="u4-trust-item">
                  <ShieldCheck size={16} />
                  {t.trust3d}
                </span>
                <span className="u4-trust-item">
                  <Tag size={15} />
                  {t.trustBestPrice}
                </span>
                <span className="u4-trust-item">
                  <Headphones size={15} />
                  {t.trustSupport}
                </span>
              </div>

              <button
                type="button"
                className="u4-submit-btn"
                onClick={handleSearch}
              >
                <Search size={18} />
                <span>
                  {activeTab === 'flight'
                    ? t.searchFlight
                    : activeTab === 'hotel'
                      ? t.searchHotel
                      : activeTab === 'tour'
                        ? (lang === 'EN' ? 'Explore Tours' : lang === 'RU' ? 'Смотреть туры' : lang === 'KK' ? 'Турларды көру' : 'Tur Paketlerini İncele')
                        : t.searchTransfer}
                </span>
              </button>
            </div>
          </div>

          {/* Right Dynamic Visual Promo Card (Animated on Tab & Route Change) */}
          <div
            className="u4-promo-card"
            key={`${activeTab}-${flightQuery.fromCode}-${flightQuery.toCode}`}
          >
            <img
              src={
                activeTab === 'flight' && userChangedDest && FLIGHT_DEST_IMAGES[flightQuery.toCode]
                  ? FLIGHT_DEST_IMAGES[flightQuery.toCode]
                  : PROMO_IMAGES[activeTab]
              }
              alt={promoContent.title}
              className="u4-promo-bg promo-anim-img"
            />
            <div className="u4-promo-overlay" />

            <div className="u4-promo-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="u4-promo-badge">
                <Tag size={13} />
                {t.bestPriceBadge}
              </span>
              <span className="u4-promo-route-chip">
                {activeTab === 'flight' ? (
                  <>
                    {fromAirport.code} <Plane size={11} style={{ margin: '0 3px' }} /> {toAirport.code}
                  </>
                ) : activeTab === 'hotel' ? (
                  <>{pm.hotelChip}</>
                ) : activeTab === 'tour' ? (
                  <>{lang === 'EN' ? '★ Guided Tours' : lang === 'RU' ? '★ Авторские туры' : lang === 'KK' ? '★ Таңдаулы турлар' : '★ Seçkin Turlar'}</>
                ) : (
                  <>{pm.transferChip}</>
                )}
              </span>
            </div>

            <div className="u4-promo-bottom">
              <div className="u4-promo-pills">
                <span className="u4-promo-stat">
                  {activeTab === 'flight' ? (
                    <Plane size={12} />
                  ) : activeTab === 'hotel' ? (
                    <Building2 size={12} />
                  ) : activeTab === 'tour' ? (
                    <Compass size={12} />
                  ) : (
                    <CarTaxiFront size={12} />
                  )}
                  {promoContent.stat1}
                </span>
                <span className="u4-promo-stat">
                  {activeTab === 'flight' ? (
                    <Zap size={12} />
                  ) : activeTab === 'hotel' ? (
                    <Star size={12} />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  {promoContent.stat2}
                </span>
              </div>
              <h5 className="u4-promo-title">
                {activeTab === 'flight' && userChangedDest
                  ? `${fromAirport.city} → ${toAirport.city}`
                  : promoContent.title}
              </h5>
              <p className="u4-promo-sub">
                {activeTab === 'flight' && userChangedDest
                  ? pm.routeSub(toAirport.airport)
                  : promoContent.sub}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
