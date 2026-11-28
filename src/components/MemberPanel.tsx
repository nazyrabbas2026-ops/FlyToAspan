import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Ticket,
  Users,
  Briefcase,
  Bell,
  Shield,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  Plane,
  Award,
  Download,
  CalendarDays,
  ChevronDown,
  MessageCircle,
} from 'lucide-react';
import { formatDisplayDate, formatTRY } from '../data/mockData';
import { WA_HREF } from '../i18n/translations';
import { api, apiMessage } from '../data/api';
import { openBrandedEticketPdf } from '../utils/eticketPdf';
import { toCalendarDate } from '../data/calendarDates';
import { PanelNavigation } from './PanelNavigation';
import {
  BookingRecord,
  LangCode,
  PriceAlertRecord,
  SavedPassengerRecord,
  UserProfile,
} from '../types';

interface MemberPanelProps {
  lang?: LangCode;
  user: UserProfile;
  bookings: BookingRecord[];
  onCancelBooking: (id: string) => Promise<void>;
  onLogout: () => void;
  onGoSearch: () => void;
}

const PANEL_I18N: Record<
  LangCode,
  {
    corpEye: string;
    indEye: string;
    welcome: string;
    milesLbl: string;
    newSearch: string;
    tabOverview: string;
    tabBookings: string;
    tabPassengers: string;
    tabCorporate: string;
    tabAlerts: string;
    tabSecurity: string;
    logoutBtn: string;
    statActive: string;
    statActiveSub: string;
    statMiles: string;
    statMilesSub: (amt: string) => string;
    statSecurity: string;
    passwordLogin: string;
    statSecSub: string;
    recentBookings: string;
    viewAll: string;
  }
> = {
  TR: {
    corpEye: 'KURUMSAL SEYAHAT PORTALI',
    indEye: 'FLYTOASPAN ÜYE PANELİ',
    welcome: 'Hoş geldiniz',
    milesLbl: 'Aspan Mil',
    newSearch: 'Yeni Uçuş Ara',
    tabOverview: 'Genel Bakış',
    tabBookings: 'Biletlerim',
    tabPassengers: 'Kayıtlı Yolcularım',
    tabCorporate: 'Kurumsal Panel & Onaylar',
    tabAlerts: 'Fiyat Alarmları',
    tabSecurity: 'Güvenlik & KVKK',
    logoutBtn: 'Güvenli Çıkış Yap',
    statActive: 'Aktif Rezervasyon',
    statActiveSub: 'Uçak, Otel ve VIP Transfer',
    statMiles: 'Aspan Mil Bakiyesi',
    statMilesSub: (amt) => `≈ ₺${amt} uçuş indirimi`,
    statSecurity: 'Hesap Güvenliği',
    passwordLogin: 'Parolalı giriş',
    statSecSub: 'Deneme hesabı tercihi',
    recentBookings: 'Son Rezervasyonlarınız',
    viewAll: 'Tümünü gör →',
  },
  EN: {
    corpEye: 'CORPORATE TRAVEL PORTAL',
    indEye: 'FLYTOASPAN MEMBER DASHBOARD',
    welcome: 'Welcome',
    milesLbl: 'Aspan Miles',
    newSearch: 'New Flight Search',
    tabOverview: 'Overview',
    tabBookings: 'My Bookings',
    tabPassengers: 'Saved Passengers',
    tabCorporate: 'Corporate Portal & Approvals',
    tabAlerts: 'Price Alerts',
    tabSecurity: 'Security & Privacy',
    logoutBtn: 'Secure Sign Out',
    statActive: 'Active Bookings',
    statActiveSub: 'Flights, Hotels & VIP Transfers',
    statMiles: 'Aspan Miles Balance',
    statMilesSub: (amt) => `≈ ₺${amt} flight discount`,
    statSecurity: 'Account Security',
    passwordLogin: 'Password sign-in',
    statSecSub: 'Demo account preference',
    recentBookings: 'Your Recent Bookings',
    viewAll: 'View all →',
  },
  RU: {
    corpEye: 'КОРПОРАТИВНЫЙ ПОРТАЛ',
    indEye: 'ЛИЧНЫЙ КАБИНЕТ FLYTOASPAN',
    welcome: 'Добро пожаловать',
    milesLbl: 'Мили Aspan',
    newSearch: 'Новый поиск рейсов',
    tabOverview: 'Обзор',
    tabBookings: 'Мои билеты',
    tabPassengers: 'Сохранённые пассажиры',
    tabCorporate: 'Корпоративный портал',
    tabAlerts: 'Ценовые уведомления',
    tabSecurity: 'Безопасность и KVKK',
    logoutBtn: 'Безопасный выход',
    statActive: 'Активные бронирования',
    statActiveSub: 'Авиа, отели и VIP-трансфер',
    statMiles: 'Баланс миль Aspan',
    statMilesSub: (amt) => `≈ ₺${amt} скидка на перелёт`,
    statSecurity: 'Защита аккаунта',
    passwordLogin: 'Вход с паролем',
    statSecSub: 'Настройка демо-аккаунта',
    recentBookings: 'Последние бронирования',
    viewAll: 'Все бронирования →',
  },
  KK: {
    corpEye: 'КОРПОРАТИВТІК САЯХАТ ПОРТАЛЫ',
    indEye: 'FLYTOASPAN МҮШЕ ПАНЕЛІ',
    welcome: 'Қош келдіңіз',
    milesLbl: 'Aspan Милі',
    newSearch: 'Жаңа рейс іздеу',
    tabOverview: 'Жалпы шолу',
    tabBookings: 'Билеттерім',
    tabPassengers: 'Сақталған жолаушылар',
    tabCorporate: 'Корпоративтік панель',
    tabAlerts: 'Баға хабарламалары',
    tabSecurity: 'Қауіпсіздік & KVKK',
    logoutBtn: 'Қауіпсіз шығу',
    statActive: 'Белсенді брондаулар',
    statActiveSub: 'Ұшақ, Қонақ үй және VIP Трансфер',
    statMiles: 'Aspan Миль балансы',
    statMilesSub: (amt) => `≈ ₺${amt} ұшу жеңілдігі`,
    statSecurity: 'Аккаунт қауіпсіздігі',
    passwordLogin: 'Құпиясөзбен кіру',
    statSecSub: 'Демо аккаунт баптауы',
    recentBookings: 'Соңғы брондауларыңыз',
    viewAll: 'Барлығын көру →',
  },
};

type PanelTab = 'overview' | 'bookings' | 'passengers' | 'corporate' | 'alerts' | 'security';

const BOOKING_COPY = {
  TR: {
    section: 'Üye bölümü', next: 'Yaklaşan seyahat', search: 'Kod veya rotayla ara',
    scope: 'Rezervasyon türü', all: 'Tümü', flight: 'Uçak', hotel: 'Otel', transfer: 'Transfer',
    empty: 'Aramaya uygun rezervasyon bulunamadı.', details: 'Rezervasyon detayı',
    demo: 'Deneme rezervasyonları', cancel: 'İptal talebi', confirm: 'Talebi oluştur', back: 'Vazgeç',
    cancellationNote: 'Bu işlem deneme rezervasyonuna iptal talebi ekler.',
  },
  EN: {
    section: 'Member section', next: 'Upcoming trip', search: 'Search by code or route',
    scope: 'Booking type', all: 'All', flight: 'Flight', hotel: 'Hotel', transfer: 'Transfer',
    empty: 'No bookings match your search.', details: 'Booking details',
    demo: 'Demo bookings', cancel: 'Request cancellation', confirm: 'Create request', back: 'Go back',
    cancellationNote: 'This submits a cancellation request for the demo booking.',
  },
  RU: {
    section: 'Раздел кабинета', next: 'Предстоящая поездка', search: 'Поиск по коду или маршруту',
    scope: 'Тип бронирования', all: 'Все', flight: 'Рейс', hotel: 'Отель', transfer: 'Трансфер',
    empty: 'Бронирования не найдены.', details: 'Данные бронирования',
    demo: 'Демо-бронирования', cancel: 'Запросить отмену', confirm: 'Создать запрос', back: 'Назад',
    cancellationNote: 'Будет создан запрос на отмену демо-брони.',
  },
  KK: {
    section: 'Мүше бөлімі', next: 'Алдағы сапар', search: 'Код немесе бағыт бойынша іздеу',
    scope: 'Брондау түрі', all: 'Барлығы', flight: 'Ұшақ', hotel: 'Қонақ үй', transfer: 'Трансфер',
    empty: 'Іздеуге сәйкес брондау табылмады.', details: 'Брондау мәліметтері',
    demo: 'Демо брондаулар', cancel: 'Бас тарту өтініші', confirm: 'Өтініш жасау', back: 'Артқа',
    cancellationNote: 'Демо брондаудан бас тарту өтініші жіберіледі.',
  },
};

export const MemberPanel: React.FC<MemberPanelProps> = ({
  lang = 'TR',
  user,
  bookings,
  onCancelBooking,
  onLogout,
  onGoSearch,
}) => {
  const ui = PANEL_I18N[lang];
  const [tab, setTab] = useState<PanelTab>('overview');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingType, setBookingType] = useState<BookingRecord['type'] | 'ALL'>('ALL');
  const [pendingCancel, setPendingCancel] = useState<string | null>(null);

  const [passengers, setPassengers] = useState<SavedPassengerRecord[]>([]);
  const [newPaxName, setNewPaxName] = useState('');
  const [newPaxDoc, setNewPaxDoc] = useState('');
  const [newPaxBirth, setNewPaxBirth] = useState('');
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Price Alerts state (persisted in SQLite)
  const [alerts, setAlerts] = useState<PriceAlertRecord[]>([]);
  const [newAlertRoute, setNewAlertRoute] = useState('İstanbul (IST) → Astana (NQZ)');
  const [newAlertTarget, setNewAlertTarget] = useState('6500');

  const [realOrg, setRealOrg] = useState<{
    organization: import('../types').Organization | null;
    ledger: import('../types').OrgLedgerEntry[];
    team: Array<{ id: string; email: string; name: string; status: string; roleLabel: string }>;
  }>({ organization: null, ledger: [], team: [] });
  const [orgLoading, setOrgLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api.savedPassengers(controller.signal)
      .then(({ passengers: list }) => { if (!controller.signal.aborted) setPassengers(list); })
      .catch(() => { /* ignore */ });
    api.priceAlerts(controller.signal)
      .then(({ alerts: list }) => { if (!controller.signal.aborted) setAlerts(list); })
      .catch(() => { /* ignore */ });
    if (user.organizationId || user.accountType === 'corporate') {
      setOrgLoading(true);
      api.myOrganization(controller.signal)
        .then((res) => { if (!controller.signal.aborted) setRealOrg(res); })
        .catch(() => { /* ignore */ })
        .finally(() => { if (!controller.signal.aborted) setOrgLoading(false); });
    }
    return () => controller.abort();
  }, [user.id, user.organizationId, user.accountType]);

  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);

  const flash = (msg: string) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setSavedNotice(msg);
    noticeTimerRef.current = window.setTimeout(() => {
      setSavedNotice(null);
      noticeTimerRef.current = null;
    }, 3000);
  };

  const handleAddPassenger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaxName.trim()) return;
    try {
      const { passenger } = await api.addSavedPassenger({
        fullName: newPaxName.trim(),
        tcOrPassport: newPaxDoc.trim(),
        birthDate: newPaxBirth,
      });
      setPassengers((prev) => [passenger, ...prev]);
      setNewPaxName('');
      setNewPaxDoc('');
      setNewPaxBirth('');
      flash('Yolcu veritabanına kaydedildi! Ödeme ekranında 1 tıkla doldurabilirsiniz.');
    } catch (err) {
      flash(apiMessage(err));
    }
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertRoute.trim()) return;
    const target = Number(newAlertTarget) || 5000;
    try {
      const { alert } = await api.addPriceAlert({
        route: newAlertRoute.trim(),
        target,
        current: target + 640,
      });
      setAlerts((prev) => [alert, ...prev]);
      flash('Fiyat alarmı veritabanına kaydedildi.');
    } catch (err) {
      flash(apiMessage(err));
    }
  };

  const activeBookingsCount = bookings.filter((b) => b.status === 'Onaylandı').length;
  const bookingUi = BOOKING_COPY[lang];
  const memberSections: { id: PanelTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: ui.tabOverview, icon: <LayoutDashboard size={18} /> },
    { id: 'bookings', label: ui.tabBookings, icon: <Ticket size={18} />, count: bookings.length },
    { id: 'passengers', label: ui.tabPassengers, icon: <Users size={18} />, count: passengers.length },
    ...(user.accountType === 'corporate'
      ? [{ id: 'corporate' as PanelTab, label: ui.tabCorporate, icon: <Briefcase size={18} /> }]
      : []),
    { id: 'alerts', label: ui.tabAlerts, icon: <Bell size={18} />, count: alerts.length },
    { id: 'security', label: ui.tabSecurity, icon: <Shield size={18} /> },
  ];
  const currentSection = memberSections.find(({ id }) => id === tab) ?? memberSections[0];
  const today = toCalendarDate(new Date());
  const upcomingBooking = bookings
    .filter((booking) => booking.status === 'Onaylandı' && booking.date >= today)
    .sort((first, second) => first.date.localeCompare(second.date))[0];
  const search = bookingSearch.trim().toLowerCase();
  const filteredBookings = bookings.filter((booking) =>
    (bookingType === 'ALL' || booking.type === bookingType) &&
    `${booking.pnr} ${booking.title} ${booking.subtitle}`.toLowerCase().includes(search)
  );
  const bookingTypes = {
    Uçak: bookingUi.flight,
    Otel: bookingUi.hotel,
    Transfer: bookingUi.transfer,
    Tur: lang === 'EN' ? 'Tour' : lang === 'RU' ? 'Тур' : lang === 'KK' ? 'Тур' : 'Tur',
  };
  const dates = (booking: BookingRecord) =>
    formatDisplayDate(booking.date, lang) +
    (booking.returnDate ? ` → ${formatDisplayDate(booking.returnDate, lang)}` : '');

  const openBookings = (code = '') => {
    setBookingSearch(code);
    setBookingType('ALL');
    setTab('bookings');
  };

  return (
    <>
      <div className="inner-hero panel-hero">
        <div className="container">
          <div className="panel-hero-row">
            <div>
              <div className="section-eyebrow on-dark">
                {user.accountType === 'corporate' ? ui.corpEye : ui.indEye}
              </div>
              <h1 className="inner-h1">
                {ui.welcome}, {user.firstName} {user.lastName}
              </h1>
              <div className="route-pills">
                <span className="route-pill">{user.email}</span>
                {user.createdAt && (
                  <span className="route-pill">
                    <CalendarDays size={13} />
                    {formatDisplayDate(user.createdAt, lang)}
                  </span>
                )}
                <span className="route-pill">
                  <Award size={14} color="#F5CD5E" />
                  {formatTRY(user.miles)} {ui.milesLbl}
                </span>
                {user.companyName && <span className="route-pill">{user.companyName}</span>}
              </div>
            </div>

            <button
              type="button"
              className="u4-submit-btn"
              style={{ height: 46, padding: '0 22px', fontSize: 13.5 }}
              onClick={onGoSearch}
            >
              <Plane size={16} />
              {ui.newSearch}
            </button>
          </div>
        </div>
      </div>

      <section className="results-workspace panel-workspace">
        <div className="container">
          {savedNotice && (
            <div role="status"
              style={{
                marginBottom: 18,
                padding: '12px 18px',
                borderRadius: 14,
                background: 'rgba(16, 185, 129, 0.14)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#047857',
                fontWeight: 700,
                fontSize: 13.5,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={18} />
              {savedNotice}
            </div>
          )}

          <div className="panel-layout">
            <PanelNavigation
              label={bookingUi.section}
              current={tab}
              items={memberSections}
              onSelect={setTab}
              action={
                <button type="button" className="panel-nav-btn panel-danger-action" onClick={onLogout}>
                  <LogOut size={17} />
                  <span>{ui.logoutBtn}</span>
                </button>
              }
            />

            <div className="panel-content">
              <header className="panel-section-heading">
                <span className="panel-section-icon">{currentSection.icon}</span>
                <h2>{currentSection.label}</h2>
              </header>
              {/* 1. OVERVIEW */}
              {tab === 'overview' && (
                <>
                  {upcomingBooking && (
                    <div className="panel-highlight">
                      <div className="panel-highlight-main">
                        <span className="panel-section-icon"><CalendarDays size={20} /></span>
                        <div>
                          <h3>{bookingUi.next}</h3>
                          <strong>{upcomingBooking.title}</strong>
                          <p>{dates(upcomingBooking)} · {upcomingBooking.pnr}</p>
                        </div>
                      </div>
                      <button type="button" className="uf-quick-pill" onClick={() => openBookings(upcomingBooking.pnr)}>
                        {bookingUi.details}
                      </button>
                    </div>
                  )}
                  <div className="panel-stat-grid">
                    <div className="panel-stat-card">
                      <div className="filter-label">{ui.statActive}</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--aspan-teal-deep)' }}>
                        {activeBookingsCount}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        {ui.statActiveSub}
                      </div>
                    </div>
                    <div className="panel-stat-card">
                      <div className="filter-label">{ui.statMiles}</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--aspan-gold-deep)' }}>
                        {formatTRY(user.miles)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        {ui.statMilesSub(formatTRY(Math.round(user.miles * 0.25)))}
                      </div>
                    </div>
                    <div className="panel-stat-card">
                      <div className="filter-label">{ui.statSecurity}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                        {ui.passwordLogin}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        {ui.statSecSub}
                      </div>
                    </div>
                  </div>

                  <div className="panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <strong style={{ fontSize: 17 }}>{ui.recentBookings}</strong>
                      <button
                        type="button"
                        onClick={() => openBookings()}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: 'var(--aspan-teal-deep)',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        {ui.viewAll}
                      </button>
                    </div>

                    {bookings.length === 0 && <p className="panel-empty">{bookingUi.empty}</p>}
                    {bookings.slice(0, 3).map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          padding: '14px 0',
                          borderBottom: '1px solid var(--aspan-border)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div className="panel-actions">
                            <span className="uf-airport-code">{b.pnr}</span>
                            <strong>{b.title}</strong>
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 3 }}>
                            {bookingTypes[b.type]} · {b.subtitle} · {dates(b)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className={`status-badge ${b.status === 'Onaylandı' ? 'ok' : 'warn'}`}>
                            {b.status}
                          </span>
                          <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>
                            ₺{formatTRY(b.price)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 2. BOOKINGS */}
              {tab === 'bookings' && (
                <div className="panel-card">
                  <div className="panel-form-grid panel-list-filters">
                    <label className="panel-field">
                      <span>{bookingUi.search}</span>
                      <input
                        className="modal-input"
                        type="search"
                        value={bookingSearch}
                        onChange={(event) => setBookingSearch(event.target.value)}
                      />
                    </label>
                    <label className="panel-field">
                      <span>{bookingUi.scope}</span>
                      <select
                        className="modal-input"
                        value={bookingType}
                        onChange={(event) => setBookingType(event.target.value as typeof bookingType)}
                      >
                        <option value="ALL">{bookingUi.all}</option>
                        {(Object.keys(bookingTypes) as BookingRecord['type'][]).map((type) => (
                          <option value={type} key={type}>{bookingTypes[type]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {filteredBookings.length === 0 && <p className="panel-empty" role="status">{bookingUi.empty}</p>}
                  {filteredBookings.map((b) => (
                    <article key={b.id} className="panel-booking-card">
                      <div>
                        <div className="panel-actions" style={{ marginBottom: 6 }}>
                          <span className="uf-airport-code">{b.pnr}</span>
                          <span className="pkg-pill">{bookingTypes[b.type]}</span>
                          <span className={`status-badge ${b.status === 'Onaylandı' || b.status === 'Tamamlandı' ? 'ok' : 'warn'}`}>
                            {b.status}
                          </span>
                        </div>
                        <strong style={{ fontSize: 16 }}>{b.title}</strong>
                        <p className="panel-record-meta">{dates(b)} · {b.passenger}</p>
                      </div>
                      <div className="panel-record-actions">
                        <strong style={{ fontSize: 18 }}>₺{formatTRY(b.price)}</strong>
                        <button
                          type="button"
                          className="uf-quick-pill"
                          onClick={() => openBrandedEticketPdf(b, { lang })}
                        >
                          <Download size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {b.demo !== false
                            ? (lang === 'EN' ? 'Demo Summary (PDF)' : lang === 'RU' ? 'Демо-резюме (PDF)' : lang === 'KK' ? 'Демо түйіндеме (PDF)' : 'Deneme Özeti (PDF)')
                            : 'PDF E-Bilet'}
                        </button>
                        {b.status === 'Onaylandı' && (
                          <button
                            type="button"
                            className="uf-quick-pill panel-danger-action"
                            disabled={cancelPending} onClick={() => { setPendingCancel(b.id); setCancelError(''); }}
                          >
                            {bookingUi.cancel}
                          </button>
                        )}
                        <a
                          href={`${WA_HREF}?text=${encodeURIComponent(
                            lang === 'EN'
                              ? `Hello FlyToAspan, I would like to request a change for my ticket with PNR ${b.pnr} (${b.passenger} · ${b.title} · ${formatDisplayDate(b.date, lang)}).`
                              : lang === 'RU'
                                ? `Здравствуйте, FlyToAspan! Я хочу оформить запрос на изменение билета с кодом PNR ${b.pnr} (${b.passenger} · ${b.title} · ${formatDisplayDate(b.date, lang)}).`
                                : lang === 'KK'
                                  ? `Сәлеметсіз бе, FlyToAspan! Мен ${b.pnr} PNR коды бар билетімді (${b.passenger} · ${b.title} · ${formatDisplayDate(b.date, lang)}) өзгертуге өтініш бергім келеді.`
                                  : `Merhaba FlyToAspan, ${b.pnr} PNR kodlu (${b.passenger} · ${b.title} · ${formatDisplayDate(b.date, lang)}) biletim için değişiklik talebinde bulunmak istiyorum.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="uf-quick-pill"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            textDecoration: 'none',
                            background: 'rgba(2, 132, 199, 0.1)',
                            color: '#0369A1',
                            borderColor: 'rgba(2, 132, 199, 0.35)',
                          }}
                        >
                          <MessageCircle size={13} />
                          {lang === 'EN' ? 'Change Request' : lang === 'RU' ? 'Запрос на изменение' : lang === 'KK' ? 'Өзгерту сұранысы' : 'Değişiklik Talebi'}
                        </a>
                      </div>
                      <details className="panel-disclosure" open={bookingSearch.trim() === b.pnr}>
                        <summary><ChevronDown size={16} /> {bookingUi.details}</summary>
                        <p className="panel-record-meta">{b.subtitle}</p>
                        {b.eticketNumber && <p className="panel-record-meta">E-Bilet · {b.eticketNumber}</p>}
                      </details>
                      {pendingCancel === b.id && b.status === 'Onaylandı' && (
                        <div className="panel-delete-confirm">
                          <span>{bookingUi.cancellationNote}</span>
                          {cancelError && <p className="form-action-error" role="alert">{cancelError}</p>}
                          <div className="panel-actions">
                            <button type="button" className="uf-quick-pill" disabled={cancelPending} onClick={() => setPendingCancel(null)}>
                              {bookingUi.back}
                            </button>
                            <button
                              type="button"
                              className="uf-quick-pill panel-danger-action"
                              disabled={cancelPending}
                              onClick={async () => {
                                setCancelPending(true);
                                setCancelError('');
                                try {
                                  await onCancelBooking(b.id);
                                  setPendingCancel(null);
                                  flash('İptal talebi kaydedildi.');
                                } catch (error) {
                                  setCancelError(apiMessage(error));
                                } finally {
                                  setCancelPending(false);
                                }
                              }}
                            >
                              {bookingUi.confirm}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {/* 3. SAVED PASSENGERS */}
              {tab === 'passengers' && (
                <>
                  <div className="panel-card">
                    <strong style={{ fontSize: 17, display: 'block', marginBottom: 14 }}>
                      Kayıtlı Yolcular (Hızlı Bilet Doldurma)
                    </strong>
                    {passengers.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 0',
                          borderBottom: '1px solid var(--aspan-border)',
                        }}
                      >
                        <div>
                          <strong>{p.fullName}</strong>
                          {(p.tcOrPassport || p.birthDate) && (
                            <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginTop: 2 }}>
                              {p.tcOrPassport ? `Belge: ${p.tcOrPassport}` : ''}
                              {p.tcOrPassport && p.birthDate ? ' · ' : ''}
                              {p.birthDate ? `Doğum: ${p.birthDate}` : ''}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="drawer-close"
                          onClick={async () => {
                            await api.deleteSavedPassenger(p.id);
                            setPassengers((prev) => prev.filter((x) => x.id !== p.id));
                            flash('Kayıtlı yolcu silindi.');
                          }}
                          aria-label="Yolcuyu sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form className="panel-card" onSubmit={handleAddPassenger}>
                    <strong style={{ fontSize: 15.5, display: 'block', marginBottom: 8 }}>
                      Yeni Yolcu Ekle (Kalıcı SQLite)
                    </strong>
                    <p style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 0 }}>
                      Kaydettiğiniz yolcular bilet satın alma ekranında 1 tıkla otomatik doldurulur.
                    </p>
                    <div className="panel-form-grid">
                      <input
                        required
                        className="modal-input"
                        aria-label="Yolcu adı ve soyadı" placeholder="Ad Soyad *"
                        value={newPaxName}
                        onChange={(e) => setNewPaxName(e.target.value)}
                      />
                      <input
                        className="modal-input"
                        aria-label="TC Kimlik veya Pasaport No" placeholder="TC Kimlik / Pasaport No"
                        value={newPaxDoc}
                        onChange={(e) => setNewPaxDoc(e.target.value)}
                      />
                      <input
                        className="modal-input"
                        type="date"
                        aria-label="Doğum Tarihi"
                        value={newPaxBirth}
                        onChange={(e) => setNewPaxBirth(e.target.value)}
                      />
                      <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }}>
                        <Plus size={16} /> Kaydet
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* 4. CORPORATE PORTAL (Real B2B Organization Limit & Ledger) */}
              {tab === 'corporate' && (
                <>
                  {orgLoading ? (
                    <div className="panel-card" role="status">
                      {lang === 'EN' ? 'Loading corporate details…' : lang === 'RU' ? 'Загрузка корпоративных данных…' : lang === 'KK' ? 'Корпоративтік деректер жүктелуде…' : 'Kurumsal hesap bilgileri yükleniyor…'}
                    </div>
                  ) : !realOrg.organization ? (
                    <div className="panel-card">
                      <span className="pkg-pill">B2B KURUMSAL SEYAHAT</span>
                      <h3 style={{ margin: '10px 0 6px', fontSize: 19 }}>
                        {lang === 'EN' ? 'No Corporate Organization Linked Yet' : lang === 'RU' ? 'Корпоративная организация ещё не привязана' : lang === 'KK' ? 'Корпоративтік ұйым әлі байланыстырылмаған' : 'Hesabınıza Tanımlı Kurumsal Şirket Bulunmuyor'}
                      </h3>
                      <p style={{ fontSize: 13.5, color: 'var(--aspan-text-muted)', margin: 0 }}>
                        {lang === 'EN'
                          ? 'Once your corporate/agency application is approved by an administrator, your real credit limit, discount rate, and account ledger will appear here.'
                          : lang === 'RU'
                            ? 'После одобрения корпоративной заявки администратором здесь появятся ваш реальный лимит, скидка и выписка.'
                            : lang === 'KK'
                              ? 'Корпоративтік өтініміңіз әкімші растағаннан кейін нақты лимит, жеңілдік және қозғалыстар осында көрінеді.'
                              : 'Kurumsal / bayi başvurunuz yönetici tarafından onaylandığında gerçek cari limitiniz, indirim oranınız ve hesap hareketleriniz burada görüntülenecektir.'}
                      </p>
                    </div>
                  ) : (() => {
                    const org = realOrg.organization;
                    const pct = org.creditLimitTRY > 0 ? Math.min(100, Math.round((org.usedCreditTRY / org.creditLimitTRY) * 100)) : 0;
                    return (
                      <>
                        <div className="panel-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                              <span className="pkg-pill">{org.type} · {org.status === 'active' ? 'Aktif' : 'Askıda'}</span>
                              <h3 style={{ margin: '8px 0 4px', fontSize: 20 }}>{org.name}</h3>
                              <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>
                                Cari Limit: <strong>₺{formatTRY(org.creditLimitTRY)}</strong> · Kullanılan: <strong>₺{formatTRY(org.usedCreditTRY)}</strong> (%{pct}) · Kalan: <strong style={{ color: '#059669' }}>₺{formatTRY(org.remainingCreditTRY)}</strong>
                                {org.discountPercent > 0 ? ` · Kurumsal İndirim: %${org.discountPercent}` : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ height: 10, borderRadius: 99, background: 'var(--aspan-bg-pill)', marginTop: 14, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #00A8B5, #38BDF8, #F5CD5E)', borderRadius: 99 }} />
                          </div>
                        </div>

                        <div className="panel-card">
                          <strong style={{ fontSize: 17, display: 'block', marginBottom: 12 }}>
                            Cari Hesap Hareketleri ({realOrg.ledger.length})
                          </strong>
                          {realOrg.ledger.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--aspan-text-muted)', margin: 0 }}>
                              Henüz bu şirket için kayıtlı cari hareket bulunmuyor.
                            </p>
                          ) : (
                            realOrg.ledger.map((row) => (
                              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--aspan-border)', gap: 10, flexWrap: 'wrap' }}>
                                <div>
                                  <span className={`status-badge ${row.type === 'credit' ? 'ok' : 'warn'}`}>
                                    {row.type === 'credit' ? 'İade / Tahsilat (+)' : 'Satış Borcu (−)'}
                                  </span>{' '}
                                  {row.pnr && <span className="uf-airport-code">{row.pnr}</span>}{' '}
                                  <strong>{row.description}</strong>
                                </div>
                                <strong style={{ color: row.type === 'credit' ? '#059669' : '#be123c' }}>
                                  {row.type === 'credit' ? '+' : '−'}₺{formatTRY(row.amount)}
                                </strong>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}

              {/* 5. PRICE ALERTS */}
              {tab === 'alerts' && (
                <>
                  <div className="panel-card">
                    <strong style={{ fontSize: 17, display: 'block', marginBottom: 14 }}>
                      Aktif Fiyat Alarmları
                    </strong>
                    {alerts.map((al) => (
                      <div
                        key={al.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 0',
                          borderBottom: '1px solid var(--aspan-border)',
                        }}
                      >
                        <div>
                          <strong>{al.route}</strong>
                          <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                            Güncel: ₺{formatTRY(al.current)} · Hedefiniz:{' '}
                            <strong style={{ color: 'var(--aspan-teal-deep)' }}>
                              ₺{formatTRY(al.target)}
                            </strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="drawer-close"
                          onClick={async () => {
                            await api.deletePriceAlert(al.id);
                            setAlerts((prev) => prev.filter((x) => x.id !== al.id));
                            flash('Fiyat alarmı silindi.');
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form className="panel-card" onSubmit={handleAddAlert}>
                    <strong style={{ fontSize: 15.5, display: 'block', marginBottom: 12 }}>
                      Yeni Fiyat Alarmı Kur
                    </strong>
                    <div className="panel-form-grid">
                      <input
                        className="modal-input"
                        aria-label="Fiyat takibi rotası" value={newAlertRoute}
                        onChange={(e) => setNewAlertRoute(e.target.value)}
                        placeholder="Örn: İstanbul (IST) → Astana (NQZ)"
                      />
                      <input
                        type="number"
                        className="modal-input"
                        aria-label="Hedef fiyat" value={newAlertTarget}
                        onChange={(e) => setNewAlertTarget(e.target.value)}
                        placeholder="Hedef Fiyat (TL)"
                      />
                      <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }}>
                        <Bell size={15} /> Kur
                      </button>
                    </div>
                  </form>
                </>
              )}

              {tab === 'security' && (
                <div className="panel-card">
                  <h3>Hesap güvenliği</h3>
                  <p>Oturumunuz sunucuda doğrulanır. Ortak cihazlarda işiniz bitince çıkış yapın.</p>
                  <p>İki aşamalı doğrulama ve parola sıfırlama henüz kullanıma açık değil.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
