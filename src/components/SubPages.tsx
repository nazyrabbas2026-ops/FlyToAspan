import React, { useMemo, useState } from 'react';
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  Phone,
  MessageCircle,
  Mail,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Download,
  XCircle,
} from 'lucide-react';
import { CAMPAIGNS, CHECKIN_AIRLINES, FAQ_ITEMS, formatDisplayDate, formatPrice } from '../data/mockData';
import { CHECKIN_RULES_BY_LANG } from '../data/checkinRules';
import { PHONE_DISPLAY, PHONE_HREF, WA_HREF } from '../i18n/translations';
import { CurrencyCode, LangCode, SearchTab } from '../types';
import { api, ApiError, apiMessage, type BookingLookup } from '../data/api';
import { openBoardingPassPdf, openBrandedEticketPdf } from '../utils/eticketPdf';
import { localizeXmlText } from '../utils/localizeXmlText';

const CAMPAIGNS_PAGE_I18N: Record<
  Exclude<LangCode, 'TR'>,
  Record<string, { badge: string; title: string; subtitle: string }>
> = {
  EN: {
    'cmp-1': {
      badge: 'DOMESTIC & INTERNATIONAL',
      title: 'Instant 350 TL Discount on Your First Flight',
      subtitle: 'Join FlyToAspan and enjoy instant savings on Istanbul – Almaty, Antalya, and European routes.',
    },
    'cmp-2': {
      badge: 'CENTRAL ASIA OFFER',
      title: '18% Off Direct Flights to Almaty & Astana',
      subtitle: 'Special fares with baggage allowance included across Kazakhstan and Central Asia.',
    },
    'cmp-3': {
      badge: 'EARLY BOOKING',
      title: 'Up to 30% Off Selected 5-Star Hotels',
      subtitle: 'Free cancellation and transparent all-in rates at top resorts in Antalya, Bodrum, and Dubai.',
    },
    'cmp-4': {
      badge: 'PACKAGE TOURS',
      title: '20% Advantage on Flight + Hotel Package Tours in 4 Countries',
      subtitle: 'Curated flight & hotel packages updated daily from XML suppliers.',
    },
  },
  RU: {
    'cmp-1': {
      badge: 'ВНУТРЕННИЕ И МЕЖДУНАРОДНЫЕ',
      title: 'Мгновенная скидка 350 TL на первый перелёт',
      subtitle: 'Зарегистрируйтесь в FlyToAspan и получите скидку на рейсы Стамбул — Алматы, Анталья и Европа.',
    },
    'cmp-2': {
      badge: 'ЦЕНТРАЛЬНАЯ АЗИЯ',
      title: 'Выгода 18% на прямые рейсы в Алматы и Астану',
      subtitle: 'Специальные тарифы с включённым багажом на направления Казахстана.',
    },
    'cmp-3': {
      badge: 'РАННЕЕ БРОНИРОВАНИЕ',
      title: 'Скидки до 30% в избранных отелях 5★',
      subtitle: 'Бесплатная отмена и честные цены в лучших отелях Антальи, Бодрума и Дубая.',
    },
    'cmp-4': {
      badge: 'ПАКЕТНЫЕ ТУРЫ',
      title: 'Выгода 20% на пакетные туры (перелёт + отель) в 4 странах',
      subtitle: 'Готовые туры с ежедневным автоматическим обновлением цен из XML.',
    },
  },
  KK: {
    'cmp-1': {
      badge: 'ІШКІ ЖӘНЕ ХАЛЫҚАРАЛЫҚ',
      title: 'Алғашқы рейсіңізге 350 TL жедел жеңілдік',
      subtitle: 'FlyToAspan мүшесі болыңыз, Ыстамбұл – Алматы, Анталья және Еуропа рейстерінде үнемдеңіз.',
    },
    'cmp-2': {
      badge: 'ОРТАЛЫҚ АЗИЯ ҰСЫНЫСЫ',
      title: 'Алматы мен Астана тікелей рейстерінде 18% тиімділік',
      subtitle: 'Қазақстан бағытына тегін жолжүк кіретін арнайы тарифтер.',
    },
    'cmp-3': {
      badge: 'ЕРТЕ БРОНДАУ',
      title: 'Таңдаулы 5 жұлдызды қонақүйлерде 30% дейін жеңілдік',
      subtitle: 'Анталья, Бодрум және Дубайдың үздік қонақүйлерінде тегін бас тарту мүмкіндігі.',
    },
    'cmp-4': {
      badge: 'ПАКЕТТІК ТУРЛАР',
      title: '4 елдегі ұшақ + қонақүй пакеттік турларына 20% жеңілдік',
      subtitle: 'Күн сайын XML арқылы жаңаратын тиімді ұшақ + қонақүй турлары.',
    },
  },
};

const SUBPAGES_I18N: Record<
  LangCode,
  {
    campEye: string;
    campTitle: string;
    catLabels: Record<'Tümü' | 'Uçak' | 'Otel' | 'Tur', string>;
    codeLbl: string;
    useNow: string;
    ciEye: string;
    ciTitle: string;
    ciSub: string;
    ciSearchPh: string;
    ciSteps: [string, string][];
    ciAll: string;
    ciPopular: string;
    ciTr: string;
    ciNote: string;
    helpEye: string;
    helpTitle: string;
    helpSearchPh: string;
    callCenter: string;
    waSupport: string;
    emailSupport: string;
    opsEye: string;
    opsTitle: string;
    opsSub: string;
    opsCardTitle: string;
    pnrLabel: string;
    pnrPh: string;
    surnameLabel: string;
    surnamePh: string;
    queryBtn: string;
    foundTitle: (pnr: string) => string;
    statusLabel: string;
    supportHint: string;
    notFoundErr: string;
  }
> = {
  TR: {
    campEye: 'FLYTOASPAN FIRSATLARI',
    campTitle: 'Güncel Kampanyalar',
    catLabels: { Tümü: 'Tümü', Uçak: 'Uçak', Otel: 'Otel', Tur: 'Paket Tur' },
    codeLbl: 'KOD',
    useNow: 'Hemen Kullan',
    ciEye: 'HIZLI CHECK-IN',
    ciTitle: 'Online Check-In',
    ciSub: 'Havayolunuzu seçin, PNR kodunuz ve soyadınızla doğrudan resmi check-in ekranına geçin.',
    ciSearchPh: 'Havayolu adı veya IATA kodu (örn: THY, Air Astana, KC)...',
    ciSteps: [
      ['1. Havayolunu seç', 'Biletinizdeki havayolunu aşağıdaki listeden bulun.'],
      ['2. PNR ve soyadını gir', '6 haneli rezervasyon kodunuzu ve soyadınızı yazın.'],
      ['3. Biniş kartını al', 'Koltuğunuzu seçip dijital biniş kartınızı indirin.'],
    ],
    ciAll: 'Tümü',
    ciPopular: 'Popüler',
    ciTr: 'Türkiye',
    ciNote: 'Check-in genellikle kalkıştan 24–48 saat önce açılır.',
    helpEye: '7/24 DESTEK MERKEZİ',
    helpTitle: 'Size nasıl yardımcı olabiliriz?',
    helpSearchPh: 'Soru veya konu arayın (iptal, bagaj, paket tur, check-in)...',
    callCenter: '7/24 Çağrı Merkezi',
    waSupport: 'WhatsApp Destek',
    emailSupport: 'E-Posta Destek',
    opsEye: 'REZERVASYON YÖNETİMİ',
    opsTitle: 'Bilet İşlemleri & İptal',
    opsSub: 'Rezervasyonunuzu PNR kodu ve yolcu soyadıyla sorgulayın.',
    opsCardTitle: 'PNR ile Bilet Sorgula',
    pnrLabel: 'PNR / Rezervasyon Kodu *',
    pnrPh: 'Örn: FTA8K4',
    surnameLabel: 'Yolcu Soyadı *',
    surnamePh: 'Örn: YILMAZ',
    queryBtn: 'Biletimi Sorgula',
    foundTitle: (p) => `Rezervasyon Bulundu (${p})`,
    statusLabel: 'Durum',
    supportHint: 'İptal veya tarih değişikliği için 7/24 hattımızdan anında işlem yapabilirsiniz:',
    notFoundErr: 'Bu kod ve soyadla eşleşen rezervasyon bulunamadı.',
  },
  EN: {
    campEye: 'FLYTOASPAN OFFERS',
    campTitle: 'Active Campaigns',
    catLabels: { Tümü: 'All', Uçak: 'Flight', Otel: 'Hotel', Tur: 'Package Tour' },
    codeLbl: 'CODE',
    useNow: 'Use Offer',
    ciEye: 'FAST CHECK-IN',
    ciTitle: 'Online Check-In',
    ciSub: 'Select your airline and proceed directly to the official check-in portal with your PNR code and last name.',
    ciSearchPh: 'Search airline name or IATA code (e.g., Turkish Airlines, Air Astana, KC)...',
    ciSteps: [
      ['1. Select airline', 'Find your operating airline from the directory below.'],
      ['2. Enter PNR & last name', 'Type your 6-character booking code and passenger surname.'],
      ['3. Get boarding pass', 'Choose your seat and download your mobile boarding pass.'],
    ],
    ciAll: 'All',
    ciPopular: 'Popular',
    ciTr: 'Türkiye',
    ciNote: 'Online check-in typically opens 24–48 hours before departure.',
    helpEye: '24/7 SUPPORT CENTER',
    helpTitle: 'How can we help you?',
    helpSearchPh: 'Search questions or topics (refund, baggage, transfer, check-in)...',
    callCenter: '24/7 Call Center',
    waSupport: 'WhatsApp Support',
    emailSupport: 'E-Mail Support',
    opsEye: 'BOOKING MANAGEMENT',
    opsTitle: 'Manage Booking & Cancellation',
    opsSub: 'Look up your reservation with its booking code and the passenger’s surname.',
    opsCardTitle: 'Find Ticket by PNR',
    pnrLabel: 'PNR / Booking Code *',
    pnrPh: 'e.g. FTA8K4',
    surnameLabel: 'Passenger Last Name *',
    surnamePh: 'e.g. YILMAZ',
    queryBtn: 'Find My Booking',
    foundTitle: (p) => `Booking Found (${p})`,
    statusLabel: 'Status',
    supportHint: 'For instant date changes or refunds, contact our 24/7 support desk:',
    notFoundErr: 'No reservation matches this booking code and surname.',
  },
  RU: {
    campEye: 'СПЕЦПРЕДЛОЖЕНИЯ FLYTOASPAN',
    campTitle: 'Актуальные Акции',
    catLabels: { Tümü: 'Все', Uçak: 'Авиа', Otel: 'Отели', Tur: 'Туры' },
    codeLbl: 'КОД',
    useNow: 'Применить',
    ciEye: 'БЫСТРАЯ РЕГИСТРАЦИЯ',
    ciTitle: 'Онлайн Регистрация (Check-In)',
    ciSub: 'Выберите авиакомпанию и перейдите к официальной регистрации по коду PNR и фамилии пассажира.',
    ciSearchPh: 'Название авиакомпании или код IATA (напр. THY, Air Astana, KC)...',
    ciSteps: [
      ['1. Выберите авиакомпанию', 'Найдите перевозчика в списке ниже.'],
      ['2. Введите PNR и фамилию', 'Укажите 6-значный код брони и фамилию латиницей.'],
      ['3. Получите посадочный', 'Выберите место в салоне и скачайте посадочный талон.'],
    ],
    ciAll: 'Все',
    ciPopular: 'Популярные',
    ciTr: 'Турция',
    ciNote: 'Регистрация обычно открывается за 24–48 часов до вылета.',
    helpEye: 'ЦЕНТР ПОДДЕРЖКИ 24/7',
    helpTitle: 'Чем мы можем вам помочь?',
    helpSearchPh: 'Поиск по вопросам (возврат, багаж, трансфер, регистрация)...',
    callCenter: 'Колл-центр 24/7',
    waSupport: 'Поддержка WhatsApp',
    emailSupport: 'Поддержка по E-Mail',
    opsEye: 'УПРАВЛЕНИЕ БРОНИРОВАНИЕМ',
    opsTitle: 'Мои Билеты и Возврат',
    opsSub: 'Найдите бронирование по коду PNR и фамилии пассажира.',
    opsCardTitle: 'Поиск билета по PNR',
    pnrLabel: 'Код бронирования (PNR) *',
    pnrPh: 'Напр.: FTA8K4',
    surnameLabel: 'Фамилия пассажира *',
    surnamePh: 'Напр.: YILMAZ',
    queryBtn: 'Найти билет',
    foundTitle: (p) => `Бронирование найдено (${p})`,
    statusLabel: 'Статус',
    supportHint: 'Для возврата или обмена свяжитесь с нашей круглосуточной линией:',
    notFoundErr: 'Бронирование с таким кодом и фамилией не найдено.',
  },
  KK: {
    campEye: 'FLYTOASPAN НАУҚАНДАРЫ',
    campTitle: 'Белсенді Науқандар',
    catLabels: { Tümü: 'Барлығы', Uçak: 'Ұшақ', Otel: 'Қонақ үй', Tur: 'Турлар' },
    codeLbl: 'КОД',
    useNow: 'Қазір қолдану',
    ciEye: 'ЖЕДЕЛ ТІРКЕЛУ',
    ciTitle: 'Онлайн Тіркелу (Check-In)',
    ciSub: 'Әуе компаниясын таңдап, PNR коды мен тегіңіз арқылы ресми тіркелу бетіне өтіңіз.',
    ciSearchPh: 'Әуе компаниясы атауы немесе IATA коды (мыс: THY, Air Astana, KC)...',
    ciSteps: [
      ['1. Әуе компаниясын таңдаңыз', 'Билетіңіздегі әуе компаниясын төмендегі тізімнен табыңыз.'],
      ['2. PNR және тегіңізді енгізіңіз', '6 таңбалы брондау коды мен тегіңізді жазыңыз.'],
      ['3. Отырғызу талонын алыңыз', 'Орынды таңдап, сандық отырғызу талонын жүктеп алыңыз.'],
    ],
    ciAll: 'Барлығы',
    ciPopular: 'Танымал',
    ciTr: 'Түркия',
    ciNote: 'Онлайн тіркелу әдетте ұшуға 24–48 сағат қалғанда ашылады.',
    helpEye: '24/7 ҚОЛДАУ ОРТАЛЫҒЫ',
    helpTitle: 'Сізге қалай көмектесе аламыз?',
    helpSearchPh: 'Сұрақ немесе тақырып іздеңіз (қайтару, жолжүк, трансфер, check-in)...',
    callCenter: '24/7 Байланыс Орталығы',
    waSupport: 'WhatsApp Қолдау',
    emailSupport: 'E-Mail Қолдау',
    opsEye: 'БРОНДАУДЫ БАСҚАРУ',
    opsTitle: 'Билет Операциялары және Бас Тарту',
    opsSub: 'Брондауды PNR коды және жолаушының тегі арқылы іздеңіз.',
    opsCardTitle: 'PNR арқылы билет тексеру',
    pnrLabel: 'PNR / Брондау коды *',
    pnrPh: 'Мыс: FTA8K4',
    surnameLabel: 'Жолаушының тегі *',
    surnamePh: 'Мыс: YILMAZ',
    queryBtn: 'Билетімді тексеру',
    foundTitle: (p) => `Брондау табылды (${p})`,
    statusLabel: 'Күйі',
    supportHint: 'Қайтару немесе күнді өзгерту үшін 24/7 желімізге хабарласыңыз:',
    notFoundErr: 'Бұл код пен текке сәйкес брондау табылмады.',
  },
};

export const CampaignsPage: React.FC<{
  lang?: LangCode;
  liveCoupons?: Array<{ id: string; code: string; title: string; category: string; validUntil: string; active: boolean }>;
  onUseCampaign: (tab: SearchTab) => void;
}> = ({ lang = 'TR', liveCoupons, onUseCampaign }) => {
  const [cat, setCat] = useState<'Tümü' | 'Uçak' | 'Otel' | 'Tur'>('Tümü');
  const [copied, setCopied] = useState<string | null>(null);
  const ui = SUBPAGES_I18N[lang];

  const sourceList = liveCoupons !== undefined
    ? liveCoupons
        .filter((c) => c.active && c.category !== 'Transfer')
        .map((c, idx) => {
          const base = CAMPAIGNS.find((m) => m.id === c.id || m.code === c.code) ?? CAMPAIGNS[idx % CAMPAIGNS.length];
          return {
            ...base,
            id: c.id,
            code: c.code,
            title: c.title,
            category: (c.category === 'Otel' || c.category === 'Tur' ? c.category : 'Uçak') as 'Uçak' | 'Otel' | 'Tur',
            validUntil: c.validUntil,
          };
        })
    : CAMPAIGNS.filter((c) => c.category !== 'Transfer');

  const list = (cat === 'Tümü' ? sourceList : sourceList.filter((c) => c.category === cat)).map((c) => {
    if (lang === 'TR') return c;
    const trMap = CAMPAIGNS_PAGE_I18N[lang];
    const baseMatch = CAMPAIGNS.find((m) => m.id === c.id || m.code === c.code);
    const localized = trMap[c.id] || (baseMatch ? trMap[baseMatch.id] : undefined);
    return {
      ...c,
      badge: localized?.badge ?? localizeXmlText(c.badge, lang),
      title: localized?.title ?? localizeXmlText(c.title, lang),
      subtitle: localized?.subtitle ?? localizeXmlText(c.subtitle, lang),
    };
  });

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <div className="section-eyebrow on-dark">{ui.campEye}</div>
          <h1 className="inner-h1">{ui.campTitle}</h1>
          <div className="route-pills" style={{ marginTop: 16 }}>
            {(['Tümü', 'Uçak', 'Otel', 'Tur'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`dest-toggle-btn ${cat === c ? 'active' : ''}`}
                style={{
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: cat === c ? undefined : 'rgba(255,255,255,0.08)',
                }}
                onClick={() => setCat(c)}
              >
                {ui.catLabels[c]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 22 }}>
            {list.map((c) => (
              <div key={c.id} className="ufc-banner" style={{ background: c.gradient, minHeight: 280 }}>
                <img src={c.image} alt={c.title} className="ufc-banner-img" />
                <div className="ufc-banner-content">
                  <span className="ufc-pill">{c.badge}</span>
                  <h3 className="ufc-title">{c.title}</h3>
                  <p className="ufc-sub">{c.subtitle}</p>
                </div>
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <button
                    type="button"
                    className="ufc-code-chip"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      navigator.clipboard?.writeText(c.code).catch(() => {});
                      setCopied(c.code);
                      setTimeout(() => setCopied(null), 1600);
                    }}
                  >
                    <span>{ui.codeLbl}: {c.code}</span>
                    {copied === c.code ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    className="deal-buy-btn"
                    style={{ padding: '10px 18px', fontSize: 13 }}
                    onClick={() =>
                      onUseCampaign(
                        c.category === 'Otel' ? 'hotel' : c.category === 'Tur' ? 'tour' : 'flight'
                      )
                    }
                  >
                    {ui.useNow}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export const OnlineCheckInPage: React.FC<{ lang?: LangCode }> = ({ lang = 'TR' }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'popular' | 'tr'>('all');
  const ui = SUBPAGES_I18N[lang];
  const rules = CHECKIN_RULES_BY_LANG[lang];

  const airlines = useMemo(() => {
    return CHECKIN_AIRLINES.filter((a) => {
      if (filter === 'popular' && !a.popular) return false;
      if (filter === 'tr' && a.country !== 'TR') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, filter]);

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <div className="section-eyebrow on-dark">{ui.ciEye}</div>
          <h1 className="inner-h1">{ui.ciTitle}</h1>
          <p style={{ color: 'rgba(255,255,255,0.78)', maxWidth: 620, margin: '0 0 20px' }}>
            {ui.ciSub}
          </p>

          <div style={{ maxWidth: 480, position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#647d89' }}
            />
            <input
              id="checkin-airline-search"
              name="airlineSearch"
              className="modal-input"
              style={{ paddingLeft: 44, height: 50, borderRadius: 14 }}
              placeholder={ui.ciSearchPh}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container">
          {/* 3 Guide Steps */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 28,
            }}
          >
            {ui.ciSteps.map(([t, d]) => (
              <div key={t} className="filter-card" style={{ position: 'static' }}>
                <strong style={{ color: 'var(--aspan-teal-deep)', fontSize: 15 }}>{t}</strong>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--aspan-text-body)' }}>{d}</p>
              </div>
            ))}
          </div>

          <div className="sort-bar">
            <div className="sort-pills">
              <button
                type="button"
                className={`sort-pill-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                {ui.ciAll} ({CHECKIN_AIRLINES.length})
              </button>
              <button
                type="button"
                className={`sort-pill-btn ${filter === 'popular' ? 'active' : ''}`}
                onClick={() => setFilter('popular')}
              >
                {ui.ciPopular}
              </button>
              <button
                type="button"
                className={`sort-pill-btn ${filter === 'tr' ? 'active' : ''}`}
                onClick={() => setFilter('tr')}
              >
                {ui.ciTr}
              </button>
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', fontWeight: 600 }}>
              {ui.ciNote}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {airlines.map((a) => (
              <a
                key={a.code}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flight-card"
                style={{
                  marginBottom: 0,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="airline-avatar" style={{ background: a.color, width: 40, height: 40 }}>
                    {a.code}
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{a.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>IATA: {a.code}</div>
                  </div>
                </div>
                <ExternalLink size={16} color="#00A8B5" />
              </a>
            ))}
          </div>

          {/* Charter & Regular Online Check-In Rules Section */}
          <div id="checkin-kurallari" style={{ marginTop: 42 }}>
            <div style={{ marginBottom: 20 }}>
              <div className="section-eyebrow" style={{ marginBottom: 6 }}>{rules.eyebrow}</div>
              <h2 className="section-h2" style={{ margin: '0 0 8px' }}>{rules.title}</h2>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--aspan-text-body)', maxWidth: 760 }}>
                {rules.subtitle}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
                gap: 18,
                marginBottom: 24,
              }}
            >
              {/* Charter Rules Card */}
              <div
                className="panel-card"
                style={{
                  border: '1.5px solid rgba(217, 119, 6, 0.38)',
                  background: 'linear-gradient(180deg, rgba(254, 243, 199, 0.35) 0%, #ffffff 32%)',
                  marginBottom: 0,
                }}
              >
                <span
                  className="pkg-pill"
                  style={{
                    background: 'rgba(217, 119, 6, 0.14)',
                    color: '#B45309',
                    fontWeight: 800,
                    marginBottom: 10,
                    display: 'inline-block',
                  }}
                >
                  {rules.charterBadge}
                </span>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--aspan-text)' }}>
                  {rules.charterTitle}
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--aspan-text-muted)', lineHeight: 1.55 }}>
                  {rules.charterLead}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {rules.charterPoints.map((pt) => (
                    <div
                      key={pt.heading}
                      style={{
                        padding: '11px 14px',
                        borderRadius: 12,
                        background: '#ffffff',
                        border: '1px solid rgba(217, 119, 6, 0.2)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 13.5, color: '#92400E', marginBottom: 4 }}>
                        <AlertCircle size={15} />
                        <span>{pt.heading}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.8, color: 'var(--aspan-text-body)', lineHeight: 1.55 }}>
                        {pt.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Regular Rules Card */}
              <div
                className="panel-card"
                style={{
                  border: '1.5px solid rgba(0, 168, 181, 0.35)',
                  background: 'linear-gradient(180deg, rgba(224, 247, 250, 0.38) 0%, #ffffff 32%)',
                  marginBottom: 0,
                }}
              >
                <span
                  className="pkg-pill"
                  style={{
                    background: 'rgba(0, 168, 181, 0.14)',
                    color: '#0F766E',
                    fontWeight: 800,
                    marginBottom: 10,
                    display: 'inline-block',
                  }}
                >
                  {rules.regularBadge}
                </span>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--aspan-text)' }}>
                  {rules.regularTitle}
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--aspan-text-muted)', lineHeight: 1.55 }}>
                  {rules.regularLead}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {rules.regularPoints.map((pt) => (
                    <div
                      key={pt.heading}
                      style={{
                        padding: '11px 14px',
                        borderRadius: 12,
                        background: '#ffffff',
                        border: '1px solid rgba(0, 168, 181, 0.2)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 13.5, color: '#0B5563', marginBottom: 4 }}>
                        <CheckCircle2 size={15} color="#00A8B5" />
                        <span>{pt.heading}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.8, color: 'var(--aspan-text-body)', lineHeight: 1.55 }}>
                        {pt.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Airline-by-Airline Quick Reference Table */}
            <div className="panel-card" style={{ marginBottom: 16 }}>
              <strong style={{ fontSize: 16.5, display: 'block', marginBottom: 4 }}>{rules.tableTitle}</strong>
              <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginBottom: 14 }}>
                {rules.tableSub}
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      {rules.cols.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rules.rows.map((r) => (
                      <tr key={r.code}>
                        <td data-label={rules.cols[0]}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span className="uf-airport-code">{r.code}</span>
                            <strong>{r.airline}</strong>
                          </div>
                        </td>
                        <td data-label={rules.cols[1]}>
                          <span className="status-badge warn">{r.charterOnlineCheckIn}</span>
                        </td>
                        <td data-label={rules.cols[2]} style={{ fontSize: 12.5, fontWeight: 700, color: '#92400E' }}>
                          {r.charterSeatRule}
                        </td>
                        <td data-label={rules.cols[3]}>
                          <span className="status-badge ok">{r.regularOnlineCheckIn}</span>
                        </td>
                        <td data-label={rules.cols[4]} style={{ fontSize: 12.5, color: 'var(--aspan-text-body)' }}>
                          {r.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'var(--aspan-bg-soft)',
                border: '1px solid var(--aspan-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                fontSize: 13,
                color: 'var(--aspan-text-body)',
              }}
            >
              <span style={{ flex: '1 1 320px' }}>{rules.updateBanner}</span>
              <a
                href={WA_HREF}
                target="_blank"
                rel="noreferrer"
                className="btn-wa-pill"
                style={{ whiteSpace: 'nowrap' }}
              >
                <MessageCircle size={15} />
                WhatsApp · {PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

const HELP_FAQS_I18N: Record<LangCode, Array<{ q: string; a: string }>> = {
  TR: FAQ_ITEMS,
  EN: [
    {
      q: 'How can I book a flight ticket on FlyToAspan?',
      a: 'Select your departure and arrival cities, travel dates, and passenger count in the search box and click "Search Flights". Compare baggage & refund rules under "Packages" and complete your reservation securely.',
    },
    {
      q: 'What should I look for when choosing a hotel?',
      a: 'Check board basis (Bed & Breakfast, All Inclusive, etc.), free cancellation rules, location, and guest ratings. FlyToAspan displays transparent total prices with no hidden fees.',
    },
    {
      q: 'How can I cancel or change my flight ticket?',
      a: 'Open "Manage Booking" in the top menu and enter your PNR code and passenger surname to request a cancellation or date change online, or contact our 24/7 support desk.',
    },
    {
      q: 'What is included in Package Tours and how are prices updated?',
      a: 'Package tours bundle round-trip flights and handpicked hotels. Our system scans XML tour operators daily and showcases the best-value packages from 4 different countries.',
    },
    {
      q: 'When does online check-in open for scheduled vs. charter flights?',
      a: 'For regular scheduled flights, online check-in typically opens 24–48 hours before departure. For charter flights (such as Turkish Airlines charter), online check-in may not be available and check-in is handled at the airport counter.',
    },
  ],
  RU: [
    {
      q: 'Как купить авиабилет на FlyToAspan?',
      a: 'Выберите город вылета и прилёта, даты и количество пассажиров в форме поиска и нажмите «Найти билеты». Сравните нормы багажа во вкладке «Тарифы» и оформите бронирование.',
    },
    {
      q: 'На что обратить внимание при выборе отеля?',
      a: 'Проверьте тип питания (завтрак, всё включено), условия бесплатной отмены, расположение и рейтинг гостей. На FlyToAspan всегда указана полная итоговая стоимость.',
    },
    {
      q: 'Как отменить или обменять авиабилет?',
      a: 'Перейдите в раздел «Мои билеты», введите PNR-код и фамилию пассажира для оформления запроса онлайн или свяжитесь со службой поддержки 24/7.',
    },
    {
      q: 'Что входит в пакетные туры и как обновляются цены?',
      a: 'Пакетные туры включают перелёт и проживание в проверенных отелях. Система ежедневно проверяет XML-фиды и автоматически выводит лучшие туры по 4 странам.',
    },
    {
      q: 'Когда открывается онлайн-регистрация на регулярные и чартерные рейсы?',
      a: 'На регулярных рейсах онлайн-регистрация открывается за 24–48 часов до вылета. На чартерных рейсах (например, чартеры THY) регистрация обычно проходит только на стойке в аэропорту.',
    },
  ],
  KK: [
    {
      q: 'FlyToAspan арқылы ұшақ билетін қалай сатып аламын?',
      a: 'Іздеу жолағынан ұшу және қону қалаларын, күнін және жолаушы санын таңдап, «Рейс іздеу» батырмасын басыңыз. «Пакеттер» бөлімінен шарттарды салыстырып, брондауды рәсімдеңіз.',
    },
    {
      q: 'Қонақүй таңдағанда неге мән беру керек?',
      a: 'Тамақтану түрін (таңғы ас, бәрі қосылған), тегін бас тарту шарттарын және орналасуын тексеріңіз. FlyToAspan жасырын төлемсіз толық бағаны көрсетеді.',
    },
    {
      q: 'Билетімді қалай қайтаруға немесе өзгертуге болады?',
      a: '«Билеттер» бетінен PNR кодыңыз бен тегіңізді енгізіп, онлайн өтінім жіберіңіз немесе 24/7 қолдау желісіне хабарласыңыз.',
    },
    {
      q: 'Пакеттік турларға не кіреді және бағалар қалай жаңарады?',
      a: 'Пакеттік турларға ұшақ билеті мен таңдаулы қонақүй кіреді. Жүйе күн сайын XML бағаларын тексеріп, 4 елдің ең тиімді турларын витринаға шығарады.',
    },
    {
      q: 'Тұрақты және чартерлік рейстерде онлайн тіркелу қашан ашылады?',
      a: 'Тұрақты рейстерде онлайн тіркелу ұшуға 24–48 сағат қалғанда ашылады. Чартерлік рейстерде (мысалы, THY charter) тіркелу әуежай тірегінде жүргізіледі.',
    },
  ],
};

export const HelpPage: React.FC<{ lang?: LangCode }> = ({ lang = 'TR' }) => {
  const [q, setQ] = useState('');
  const [openIdx, setOpenIdx] = useState(0);
  const ui = SUBPAGES_I18N[lang];
  const localizedFaqs = HELP_FAQS_I18N[lang] || FAQ_ITEMS;

  const items = localizedFaqs.filter(
    (f) => !q.trim() || f.q.toLowerCase().includes(q.toLowerCase()) || f.a.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <div className="section-eyebrow on-dark">{ui.helpEye}</div>
          <h1 className="inner-h1">{ui.helpTitle}</h1>
          <div style={{ maxWidth: 500, position: 'relative', marginTop: 16 }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#647d89' }}
            />
            <input
              id="help-faq-search"
              name="faqSearch"
              className="modal-input"
              style={{ paddingLeft: 44, height: 50, borderRadius: 14 }}
              placeholder={ui.helpSearchPh}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
            <a href={PHONE_HREF} className="filter-card" style={{ position: 'static' }}>
              <Phone size={22} color="#00A8B5" />
              <h4 style={{ margin: '10px 0 4px' }}>{ui.callCenter}</h4>
              <div style={{ fontWeight: 800, color: 'var(--aspan-teal-deep)' }}>{PHONE_DISPLAY}</div>
            </a>
            <a
              href={WA_HREF}
              target="_blank"
              rel="noreferrer"
              className="filter-card"
              style={{ position: 'static' }}
            >
              <MessageCircle size={22} color="#10B981" />
              <h4 style={{ margin: '10px 0 4px' }}>{ui.waSupport}</h4>
              <div style={{ fontWeight: 800, color: '#059669' }}>{PHONE_DISPLAY}</div>
            </a>
            <a href="mailto:info@flytoaspan.com" className="filter-card" style={{ position: 'static' }}>
              <Mail size={22} color="#DDA838" />
              <h4 style={{ margin: '10px 0 4px' }}>{ui.emailSupport}</h4>
              <div style={{ fontWeight: 800, color: 'var(--aspan-gold-deep)' }}>info@flytoaspan.com</div>
            </a>
          </div>

          <div className="filter-card" style={{ position: 'static', padding: '12px 28px' }}>
            {items.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div key={item.q} className="faq-item">
                  <button
                    type="button"
                    className={`faq-q-btn ${isOpen ? 'open' : ''}`}
                    onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                  >
                    <span>{item.q}</span>
                    <span className="faq-plus">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && <div className="faq-a">{item.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};

export const BookingOpsPage: React.FC<{ lang?: LangCode; currency?: CurrencyCode }> = ({ lang = 'TR', currency = 'TRY' }) => {
  const [pnr, setPnr] = useState('');
  const [surname, setSurname] = useState('');
  const [matchedBooking, setMatchedBooking] = useState<BookingLookup | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelNotice, setCancelNotice] = useState('');
  const ui = SUBPAGES_I18N[lang];

  const ticketUi = {
    TR: {
      passenger: 'Yolcu',
      travelDate: 'Seyahat Tarihi',
      flightTimes: 'Uçuş Saatleri',
      airlineFlight: 'Havayolu / Uçuş',
      baggage: 'Bagaj',
      totalPrice: 'Toplam Tutar',
      downloadPdf: 'Deneme Rezervasyon Özeti (PDF)',
      demoBadge: 'Deneme Kaydı',
      outboundLbl: 'Gidiş Uçuşu',
      returnLbl: 'Dönüş Uçuşu',
      cancelBtn: 'İptal Talebi Oluştur',
      cancelConfirm: 'İptal talebi gönderilsin mi?',
      cancelYes: 'Evet, Gönder',
      cancelSending: 'Gönderiliyor...',
      cancelBack: 'Vazgeç',
      changeBtn: 'Değişiklik Talebi',
      cancelSuccess: '✓ İptal talebiniz başarıyla merkeze iletildi. Operasyon ekibimiz en kısa sürede işleme alacaktır.',
      status: {
        'Onaylandı': 'Onaylandı',
        'Tamamlandı': 'Tamamlandı',
        'İptal Talebi': 'İptal Talebi',
        'İptal Edildi': 'İptal Edildi',
        'İade Edildi': 'İade Edildi',
      } as Record<string, string>,
      waChangeMsg: (code: string, pax: string, title: string, date: string) =>
        `Merhaba FlyToAspan, ${code} PNR kodlu (${pax} · ${title} · ${date}) biletim için değişiklik talebinde bulunmak istiyorum.`,
    },
    EN: {
      passenger: 'Passenger',
      travelDate: 'Travel Date',
      flightTimes: 'Flight Times',
      airlineFlight: 'Airline / Flight',
      baggage: 'Baggage',
      totalPrice: 'Total Price',
      downloadPdf: 'Download Demo Summary (PDF)',
      demoBadge: 'Demo Record',
      outboundLbl: 'Outbound Flight',
      returnLbl: 'Return Flight',
      cancelBtn: 'Request Cancellation',
      cancelConfirm: 'Submit cancellation request?',
      cancelYes: 'Yes, Submit',
      cancelSending: 'Submitting...',
      cancelBack: 'Cancel',
      changeBtn: 'Change Request',
      cancelSuccess: '✓ Your cancellation request has been sent. Our operations team will process it shortly.',
      status: {
        'Onaylandı': 'Confirmed',
        'Tamamlandı': 'Completed',
        'İptal Talebi': 'Cancellation Requested',
        'İptal Edildi': 'Cancelled',
        'İade Edildi': 'Refunded',
      } as Record<string, string>,
      waChangeMsg: (code: string, pax: string, title: string, date: string) =>
        `Hello FlyToAspan, I would like to request a change for my ticket with PNR ${code} (${pax} · ${title} · ${date}).`,
    },
    RU: {
      passenger: 'Пассажир',
      travelDate: 'Дата поездки',
      flightTimes: 'Время вылета',
      airlineFlight: 'Авиакомпания / Рейс',
      baggage: 'Багаж',
      totalPrice: 'Итого',
      downloadPdf: 'Скачать демо-резюме (PDF)',
      demoBadge: 'Демо-запись',
      outboundLbl: 'Рейс туда',
      returnLbl: 'Обратный рейс',
      cancelBtn: 'Запросить отмену',
      cancelConfirm: 'Отправить запрос на отмену?',
      cancelYes: 'Да, отправить',
      cancelSending: 'Отправка...',
      cancelBack: 'Отмена',
      changeBtn: 'Запрос на изменение',
      cancelSuccess: '✓ Ваш запрос на отмену успешно отправлен. Наша служба поддержки обработает его в ближайшее время.',
      status: {
        'Onaylandı': 'Подтверждено',
        'Tamamlandı': 'Завершено',
        'İptal Talebi': 'Запрос на отмену',
        'İptal Edildi': 'Отменено',
        'İade Edildi': 'Возвращено',
      } as Record<string, string>,
      waChangeMsg: (code: string, pax: string, title: string, date: string) =>
        `Здравствуйте, FlyToAspan! Я хочу оформить запрос на изменение билета с кодом PNR ${code} (${pax} · ${title} · ${date}).`,
    },
    KK: {
      passenger: 'Жолаушы',
      travelDate: 'Сапар күні',
      flightTimes: 'Ұшу уақыты',
      airlineFlight: 'Әуекомпания / Рейс',
      baggage: 'Жолжүк',
      totalPrice: 'Жалпы сома',
      downloadPdf: 'Демо түйіндеме жүктеу (PDF)',
      demoBadge: 'Демо жазба',
      outboundLbl: 'Бару рейсі',
      returnLbl: 'Қайту рейсі',
      cancelBtn: 'Болдырмау сұранысы',
      cancelConfirm: 'Болдырмау сұранысын жіберу керек пе?',
      cancelYes: 'Иә, жіберу',
      cancelSending: 'Жіберілуде...',
      cancelBack: 'Бас тарту',
      changeBtn: 'Өзгерту сұранысы',
      cancelSuccess: '✓ Болдырмау сұранысыңыз орталыққа сәтті жіберілді. Операциялық топ жақын арада қарастырады.',
      status: {
        'Onaylandı': 'Расталды',
        'Tamamlandı': 'Аяқталды',
        'İptal Talebi': 'Болдырмау сұранысы',
        'İptal Edildi': 'Болдырылмады',
        'İade Edildi': 'Қайтарылды',
      } as Record<string, string>,
      waChangeMsg: (code: string, pax: string, title: string, date: string) =>
        `Сәлеметсіз бе, FlyToAspan! Мен ${code} PNR коды бар билетімді (${pax} · ${title} · ${date}) өзгертуге өтініш бергім келеді.`,
    },
  }[lang];

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMatchedBooking(null);
    setError('');
    setConfirmCancel(false);
    setCancelNotice('');
    try {
      const { booking } = await api.lookup(pnr, surname);
      setMatchedBooking(booking);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 404 ? ui.notFoundErr : apiMessage(cause));
    } finally {
      setPending(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!matchedBooking || cancelBusy) return;
    setCancelBusy(true);
    setError('');
    setCancelNotice('');
    try {
      const { booking } = await api.lookupCancel(matchedBooking.pnr, surname);
      setMatchedBooking(booking);
      setConfirmCancel(false);
      setCancelNotice(ticketUi.cancelSuccess);
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <div className="section-eyebrow on-dark">{ui.opsEye}</div>
          <h1 className="inner-h1">{ui.opsTitle}</h1>
          <p style={{ color: 'rgba(255,255,255,0.78)', maxWidth: 580, margin: 0 }}>
            {ui.opsSub}
          </p>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container" style={{ maxWidth: 620 }}>
          <form className="filter-card" style={{ position: 'static', padding: 28 }} onSubmit={handleLookup}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <Ticket size={22} color="#00A8B5" />
              <strong style={{ fontSize: 18 }}>{ui.opsCardTitle}</strong>
            </div>

            <div className="panel-form-grid" style={{ marginBottom: 18 }}>
              <div>
                <label
                  htmlFor="pnr-lookup-code"
                  style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 5 }}
                >
                  {ui.pnrLabel}
                </label>
                <input
                  id="pnr-lookup-code"
                  name="pnr"
                  required
                  disabled={pending}
                  minLength={5}
                  maxLength={24}
                  className="modal-input"
                  placeholder={ui.pnrPh}
                  value={pnr}
                  onChange={(e) => {
                    setPnr(e.target.value.toUpperCase());
                    setMatchedBooking(null);
                    setError('');
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="pnr-lookup-surname"
                  style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 5 }}
                >
                  {ui.surnameLabel}
                </label>
                <input
                  id="pnr-lookup-surname"
                  name="surname"
                  autoComplete="family-name"
                  required
                  disabled={pending}
                  maxLength={80}
                  className="modal-input"
                  placeholder={ui.surnamePh}
                  value={surname}
                  onChange={(e) => {
                    setSurname(e.target.value);
                    setMatchedBooking(null);
                    setError('');
                  }}
                />
              </div>
            </div>

            <button type="submit" disabled={pending} className="u4-submit-btn" style={{ width: '100%' }}>
              {ui.queryBtn}
            </button>

            {matchedBooking && (
              <div
                role="status"
                style={{
                  marginTop: 20,
                  padding: 18,
                  borderRadius: 16,
                  background: '#ffffff',
                  border: '1.5px solid rgba(16,185,129,0.4)',
                  boxShadow: '0 8px 24px rgba(4, 17, 29, 0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#047857', fontSize: 15 }}>
                    <CheckCircle2 size={18} />
                    {ui.foundTitle(matchedBooking.pnr)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {matchedBooking.demo !== false && (
                      <span className="pkg-pill" style={{ background: 'rgba(245,158,11,0.16)', color: '#b45309', fontWeight: 800 }}>
                        {ticketUi.demoBadge}
                      </span>
                    )}
                    <span className={`status-badge ${matchedBooking.status === 'Onaylandı' || matchedBooking.status === 'Tamamlandı' ? 'ok' : 'warn'}`}>
                      {ticketUi.status[matchedBooking.status] || matchedBooking.status}
                    </span>
                  </div>
                </div>

                <div style={{ fontWeight: 800, fontSize: 16.5, color: 'var(--aspan-text)', marginBottom: 4 }}>
                  {matchedBooking.title}
                </div>
                {matchedBooking.subtitle && (
                  <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)', marginBottom: 12 }}>
                    {matchedBooking.subtitle}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 10,
                    padding: 12,
                    borderRadius: 12,
                    background: 'var(--aspan-bg-soft)',
                    border: '1px solid var(--aspan-border)',
                    marginBottom: 14,
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--aspan-text-muted)', textTransform: 'uppercase' }}>{ticketUi.passenger}</div>
                    <strong>{matchedBooking.passenger || surname.toUpperCase()}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--aspan-text-muted)', textTransform: 'uppercase' }}>{ticketUi.travelDate}</div>
                    <strong>
                      {formatDisplayDate(matchedBooking.date, lang)}
                      {matchedBooking.returnDate ? ` → ${formatDisplayDate(matchedBooking.returnDate, lang)}` : ''}
                    </strong>
                  </div>
                  {matchedBooking.legs && matchedBooking.legs.length > 0 ? (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {matchedBooking.legs.map((leg, idx) => (
                        <div
                          key={`${leg.direction}-${leg.flightNumber}-${idx}`}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 10,
                            background: '#ffffff',
                            border: '1px solid var(--aspan-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase' }}>
                              {leg.direction === 'Dönüş' ? ticketUi.returnLbl : ticketUi.outboundLbl} · {formatDisplayDate(leg.date, lang)}
                            </div>
                            <strong>
                              {leg.fromCode} → {leg.toCode} · {leg.departTime} → {leg.arriveTime}
                            </strong>
                            <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>
                              {leg.airline} · {leg.flightNumber}{leg.duration ? ` · ${leg.duration}` : ''}
                            </div>
                          </div>
                          {leg.baggage && (
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--aspan-text-body)' }}>
                              🧳 {leg.baggage}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {(matchedBooking.departTime || matchedBooking.arriveTime) && (
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--aspan-text-muted)', textTransform: 'uppercase' }}>{ticketUi.flightTimes}</div>
                          <strong>{matchedBooking.departTime || '--:--'} → {matchedBooking.arriveTime || '--:--'}</strong>
                        </div>
                      )}
                      {(matchedBooking.flightNumber || matchedBooking.airline) && (
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--aspan-text-muted)', textTransform: 'uppercase' }}>{ticketUi.airlineFlight}</div>
                          <strong>{[matchedBooking.airline, matchedBooking.flightNumber].filter(Boolean).join(' · ')}</strong>
                        </div>
                      )}
                      {matchedBooking.baggage && (
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--aspan-text-muted)', textTransform: 'uppercase' }}>{ticketUi.baggage}</div>
                          <strong>{matchedBooking.baggage}</strong>
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--aspan-text-muted)', textTransform: 'uppercase' }}>{ticketUi.totalPrice}</div>
                    <strong style={{ color: 'var(--aspan-teal-deep)', fontSize: 14 }}>{formatPrice(matchedBooking.price, currency)}</strong>
                  </div>
                </div>

                {cancelNotice && (
                  <div className="adm-banner adm-banner-ok" style={{ marginBottom: 12 }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>{cancelNotice}</div>
                  </div>
                )}

                {matchedBooking.checkinStatus === 'completed' && (matchedBooking.boardingPass?.seat || matchedBooking.assignedSeat) && (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: '#ECFDF5',
                      border: '1.5px solid #6EE7B7',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: '#065F46' }}>
                      <strong style={{ display: 'block', fontSize: 13.5 }}>
                        ✓ {lang === 'EN' ? 'Online Check-In Completed · Boarding Pass Ready' : lang === 'RU' ? 'Онлайн-регистрация выполнена · Посадочный готов' : lang === 'KK' ? 'Онлайн тіркеу аяқталды · Отырғызу талоны дайын' : 'Online Check-In Tamamlandı · Biniş Kartınız Hazır'}
                      </strong>
                      <span>
                        {lang === 'EN' ? 'Seat' : lang === 'RU' ? 'Место' : lang === 'KK' ? 'Орын' : 'Koltuk'}:{' '}
                        <strong>{matchedBooking.boardingPass?.seat || matchedBooking.assignedSeat}</strong>
                        {matchedBooking.boardingPass?.boardingTime && ` · ${lang === 'EN' ? 'Boarding' : lang === 'RU' ? 'Посадка' : lang === 'KK' ? 'Отырғызу' : 'Biniş'}: ${matchedBooking.boardingPass.boardingTime}`}
                        {matchedBooking.boardingPass?.terminal && ` · ${matchedBooking.boardingPass.terminal}`}
                        {matchedBooking.boardingPass?.gate && ` · Gate: ${matchedBooking.boardingPass.gate}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-gold-nav"
                      style={{ height: 36, fontSize: 12.5, padding: '0 14px' }}
                      onClick={() => openBoardingPassPdf(matchedBooking, { lang })}
                    >
                      🎫 {lang === 'EN' ? 'Download Boarding Pass (PDF)' : lang === 'RU' ? 'Посадочный талон (PDF)' : lang === 'KK' ? 'Отырғызу талоны (PDF)' : 'Biniş Kartı İndir (PDF)'}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="adm-btn adm-btn-green"
                    style={{ height: 40, padding: '0 16px', fontSize: 13 }}
                    onClick={() => openBrandedEticketPdf(matchedBooking, { currency, lang })}
                  >
                    <Download size={15} /> {ticketUi.downloadPdf}
                  </button>

                  {matchedBooking.status === 'Onaylandı' && !confirmCancel && (
                    <button
                      type="button"
                      className="adm-btn adm-btn-red"
                      style={{ height: 40, padding: '0 16px', fontSize: 13 }}
                      onClick={() => setConfirmCancel(true)}
                    >
                      <XCircle size={15} /> {ticketUi.cancelBtn}
                    </button>
                  )}

                  {matchedBooking.status === 'Onaylandı' && confirmCancel && (
                    <span className="adm-confirm-inline" style={{ padding: '6px 10px' }}>
                      {ticketUi.cancelConfirm}
                      <button
                        type="button"
                        className="adm-btn adm-btn-red-solid"
                        style={{ height: 30, padding: '0 10px' }}
                        disabled={cancelBusy}
                        onClick={() => void handleCancelRequest()}
                      >
                        {cancelBusy ? ticketUi.cancelSending : ticketUi.cancelYes}
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn-ghost"
                        style={{ height: 30, padding: '0 10px' }}
                        onClick={() => setConfirmCancel(false)}
                      >
                        {ticketUi.cancelBack}
                      </button>
                    </span>
                  )}

                  <a
                    href={`${WA_HREF}?text=${encodeURIComponent(
                      ticketUi.waChangeMsg(
                        matchedBooking.pnr,
                        matchedBooking.passenger || surname.toUpperCase(),
                        matchedBooking.title,
                        formatDisplayDate(matchedBooking.date, lang)
                      )
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="adm-btn adm-btn-blue"
                    style={{ height: 40, padding: '0 16px', fontSize: 13, textDecoration: 'none' }}
                  >
                    <MessageCircle size={15} /> {ticketUi.changeBtn}
                  </a>
                </div>

                <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                  {ui.supportHint} <strong>{PHONE_DISPLAY}</strong>
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 14,
                  background: 'rgba(225,29,72,0.08)',
                  color: '#be123c',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={17} />
                {error}
              </div>
            )}
          </form>
        </div>
      </section>
    </>
  );
};
