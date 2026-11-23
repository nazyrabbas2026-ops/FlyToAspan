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
} from 'lucide-react';
import { CAMPAIGNS, CHECKIN_AIRLINES, FAQ_ITEMS, formatDisplayDate } from '../data/mockData';
import { PHONE_DISPLAY, PHONE_HREF, WA_HREF } from '../i18n/translations';
import { BookingRecord, LangCode, SearchTab } from '../types';

const SUBPAGES_I18N: Record<
  LangCode,
  {
    campEye: string;
    campTitle: string;
    catLabels: Record<'Tümü' | 'Uçak' | 'Otel' | 'Transfer', string>;
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
    paxLabel: string;
    statusLabel: string;
    activeTicket: string;
    supportHint: string;
    notFoundErr: string;
  }
> = {
  TR: {
    campEye: 'FLYTOASPAN FIRSATLARI',
    campTitle: 'Güncel Kampanyalar',
    catLabels: { Tümü: 'Tümü', Uçak: 'Uçak', Otel: 'Otel', Transfer: 'Transfer' },
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
    helpSearchPh: 'Soru veya konu arayın (iptal, bagaj, transfer, check-in)...',
    callCenter: '7/24 Çağrı Merkezi',
    waSupport: 'WhatsApp Destek',
    emailSupport: 'E-Posta Destek',
    opsEye: 'REZERVASYON YÖNETİMİ',
    opsTitle: 'Bilet İşlemleri & İptal',
    opsSub: 'PNR kodunuz ve yolcu soyadınızla biletinizi görüntüleyebilir, değişiklik veya iptal talebi oluşturabilirsiniz.',
    opsCardTitle: 'PNR ile Bilet Sorgula',
    pnrLabel: 'PNR / Rezervasyon Kodu *',
    pnrPh: 'Örn: FTA8K4',
    surnameLabel: 'Yolcu Soyadı *',
    surnamePh: 'Örn: YILMAZ',
    queryBtn: 'Biletimi Sorgula',
    foundTitle: (p) => `Rezervasyon Bulundu (${p})`,
    paxLabel: 'Yolcu',
    statusLabel: 'Durum',
    activeTicket: 'Aktif Bilet',
    supportHint: 'İptal veya tarih değişikliği için 7/24 hattımızdan anında işlem yapabilirsiniz:',
    notFoundErr: 'Lütfen en az 5 karakterli geçerli bir PNR kodu ve soyad girin.',
  },
  EN: {
    campEye: 'FLYTOASPAN OFFERS',
    campTitle: 'Active Campaigns',
    catLabels: { Tümü: 'All', Uçak: 'Flight', Otel: 'Hotel', Transfer: 'Transfer' },
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
    opsSub: 'View your ticket, request date changes or submit a cancellation with your PNR code and passenger last name.',
    opsCardTitle: 'Find Ticket by PNR',
    pnrLabel: 'PNR / Booking Code *',
    pnrPh: 'e.g. FTA8K4',
    surnameLabel: 'Passenger Last Name *',
    surnamePh: 'e.g. YILMAZ',
    queryBtn: 'Find My Booking',
    foundTitle: (p) => `Booking Found (${p})`,
    paxLabel: 'Passenger',
    statusLabel: 'Status',
    activeTicket: 'Confirmed Ticket',
    supportHint: 'For instant date changes or refunds, contact our 24/7 support desk:',
    notFoundErr: 'Please enter a valid PNR code (min 5 characters) and surname.',
  },
  RU: {
    campEye: 'СПЕЦПРЕДЛОЖЕНИЯ FLYTOASPAN',
    campTitle: 'Актуальные Акции',
    catLabels: { Tümü: 'Все', Uçak: 'Авиа', Otel: 'Отели', Transfer: 'Трансфер' },
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
    opsSub: 'Проверьте статус билета, оформите обмен или возврат по коду бронирования PNR и фамилии.',
    opsCardTitle: 'Поиск билета по PNR',
    pnrLabel: 'Код бронирования (PNR) *',
    pnrPh: 'Напр.: FTA8K4',
    surnameLabel: 'Фамилия пассажира *',
    surnamePh: 'Напр.: YILMAZ',
    queryBtn: 'Найти билет',
    foundTitle: (p) => `Бронирование найдено (${p})`,
    paxLabel: 'Пассажир',
    statusLabel: 'Статус',
    activeTicket: 'Активный билет',
    supportHint: 'Для возврата или обмена свяжитесь с нашей круглосуточной линией:',
    notFoundErr: 'Пожалуйста, введите корректный код PNR (не менее 5 символов) и фамилию.',
  },
  KK: {
    campEye: 'FLYTOASPAN НАУҚАНДАРЫ',
    campTitle: 'Белсенді Науқандар',
    catLabels: { Tümü: 'Барлығы', Uçak: 'Ұшақ', Otel: 'Қонақ үй', Transfer: 'Трансфер' },
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
    opsSub: 'PNR кодыңыз бен жолаушы тегі арқылы билетті тексеріп, өзгерту немесе қайтару өтінімін жасай аласыз.',
    opsCardTitle: 'PNR арқылы билет тексеру',
    pnrLabel: 'PNR / Брондау коды *',
    pnrPh: 'Мыс: FTA8K4',
    surnameLabel: 'Жолаушының тегі *',
    surnamePh: 'Мыс: YILMAZ',
    queryBtn: 'Билетімді тексеру',
    foundTitle: (p) => `Брондау табылды (${p})`,
    paxLabel: 'Жолаушы',
    statusLabel: 'Күйі',
    activeTicket: 'Белсенді билет',
    supportHint: 'Қайтару немесе күнді өзгерту үшін 24/7 желімізге хабарласыңыз:',
    notFoundErr: 'Кемінде 5 таңбадан тұратын жарамды PNR коды мен тегіңізді енгізіңіз.',
  },
};

export const CampaignsPage: React.FC<{
  lang?: LangCode;
  onUseCampaign: (tab: SearchTab) => void;
}> = ({ lang = 'TR', onUseCampaign }) => {
  const [cat, setCat] = useState<'Tümü' | 'Uçak' | 'Otel' | 'Transfer'>('Tümü');
  const [copied, setCopied] = useState<string | null>(null);
  const ui = SUBPAGES_I18N[lang];

  const list = cat === 'Tümü' ? CAMPAIGNS : CAMPAIGNS.filter((c) => c.category === cat);

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <div className="section-eyebrow on-dark">{ui.campEye}</div>
          <h1 className="inner-h1">{ui.campTitle}</h1>
          <div className="route-pills" style={{ marginTop: 16 }}>
            {(['Tümü', 'Uçak', 'Otel', 'Transfer'] as const).map((c) => (
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 22 }}>
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
                        c.category === 'Otel' ? 'hotel' : c.category === 'Transfer' ? 'transfer' : 'flight'
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
        </div>
      </section>
    </>
  );
};

export const HelpPage: React.FC<{ lang?: LangCode }> = ({ lang = 'TR' }) => {
  const [q, setQ] = useState('');
  const [openIdx, setOpenIdx] = useState(0);
  const ui = SUBPAGES_I18N[lang];

  const items = FAQ_ITEMS.filter(
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

export const BookingOpsPage: React.FC<{ lang?: LangCode; bookings?: BookingRecord[] }> = ({
  lang = 'TR',
  bookings = [],
}) => {
  const [pnr, setPnr] = useState('');
  const [surname, setSurname] = useState('');
  const [result, setResult] = useState<null | 'found' | 'notfound'>(null);
  const [matchedBooking, setMatchedBooking] = useState<BookingRecord | null>(null);
  const ui = SUBPAGES_I18N[lang];

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPnr = pnr.trim().toUpperCase();
    const found = bookings.find((b) => b.pnr.toUpperCase() === cleanPnr) || null;
    if (found || (cleanPnr.length >= 5 && surname.trim().length >= 2)) {
      setMatchedBooking(found);
      setResult('found');
    } else {
      setMatchedBooking(null);
      setResult('notfound');
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
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
                  className="modal-input"
                  placeholder={ui.pnrPh}
                  value={pnr}
                  onChange={(e) => setPnr(e.target.value.toUpperCase())}
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
                  className="modal-input"
                  placeholder={ui.surnamePh}
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="u4-submit-btn" style={{ width: '100%' }}>
              {ui.queryBtn}
            </button>

            {result === 'found' && (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 14,
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.35)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#047857' }}>
                  <CheckCircle2 size={18} />
                  {ui.foundTitle(pnr)}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--aspan-text-body)' }}>
                  {ui.paxLabel}: <strong>{matchedBooking ? matchedBooking.passenger : surname.toUpperCase()}</strong> ·{' '}
                  {matchedBooking
                    ? `${matchedBooking.title} (${formatDisplayDate(matchedBooking.date, lang)})`
                    : 'İstanbul (IST) → Almatı (ALA)'}{' '}
                  · {ui.statusLabel}: <strong>{matchedBooking ? matchedBooking.status : ui.activeTicket}</strong>.{' '}
                  {ui.supportHint} <strong>{PHONE_DISPLAY}</strong>
                </p>
              </div>
            )}

            {result === 'notfound' && (
              <div
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
                {ui.notFoundErr}
              </div>
            )}
          </form>
        </div>
      </section>
    </>
  );
};
