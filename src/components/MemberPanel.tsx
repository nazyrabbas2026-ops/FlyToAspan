import React, { useState } from 'react';
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
  XCircle,
  Plane,
  Award,
  Download,
  Lock,
} from 'lucide-react';
import { formatDisplayDate, formatTRY } from '../data/mockData';
import {
  BookingRecord,
  CorpApproval,
  LangCode,
  SavedPassenger,
  UserProfile,
} from '../types';

interface MemberPanelProps {
  lang?: LangCode;
  user: UserProfile;
  bookings: BookingRecord[];
  onCancelBooking: (id: string) => void;
  onUpdateUser: (next: UserProfile) => void;
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
    stat2faOn: string;
    stat2faStd: string;
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
    stat2faOn: '2FA Aktif',
    stat2faStd: 'Standart',
    statSecSub: '256-Bit SSL & KVKK Korumalı',
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
    stat2faOn: '2FA Enabled',
    stat2faStd: 'Standard',
    statSecSub: '256-Bit SSL & GDPR Protected',
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
    stat2faOn: '2FA Активна',
    stat2faStd: 'Стандарт',
    statSecSub: '256-Bit SSL и защита KVKK',
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
    stat2faOn: '2FA Қосулы',
    stat2faStd: 'Стандартты',
    statSecSub: '256-Бит SSL & KVKK қорғалған',
    recentBookings: 'Соңғы брондауларыңыз',
    viewAll: 'Барлығын көру →',
  },
};

type PanelTab = 'overview' | 'bookings' | 'passengers' | 'corporate' | 'alerts' | 'security';

export const MemberPanel: React.FC<MemberPanelProps> = ({
  lang = 'TR',
  user,
  bookings,
  onCancelBooking,
  onUpdateUser,
  onLogout,
  onGoSearch,
}) => {
  const ui = PANEL_I18N[lang];
  const [tab, setTab] = useState<PanelTab>('overview');

  // Saved Passengers state
  const [passengers, setPassengers] = useState<SavedPassenger[]>([
    {
      id: 'pax-1',
      fullName: `${user.firstName} ${user.lastName}`,
      docNumber: 'U24901842',
      birthDate: '1994-05-14',
      nationality: 'Türkiye (TR)',
    },
    {
      id: 'pax-2',
      fullName: 'Aylin Karahan',
      docNumber: 'U18743920',
      birthDate: '1996-09-22',
      nationality: 'Kazakistan (KZ)',
    },
  ]);
  const [newPaxName, setNewPaxName] = useState('');
  const [newPaxDoc, setNewPaxDoc] = useState('');
  const [newPaxBirth, setNewPaxBirth] = useState('');

  // Price Alerts state
  const [alerts, setAlerts] = useState([
    { id: 'al-1', route: 'İstanbul (IST) → Almatı (ALA)', target: 6200, current: 6890 },
    { id: 'al-2', route: 'İstanbul (IST) → Londra (LHR)', target: 4900, current: 5420 },
  ]);
  const [newAlertRoute, setNewAlertRoute] = useState('İstanbul (IST) → Astana (NQZ)');
  const [newAlertTarget, setNewAlertTarget] = useState('6500');

  // Corporate Approval Queue state (UygunFly Corporate Portal style!)
  const [approvals, setApprovals] = useState<CorpApproval[]>([
    {
      id: 'crp-1',
      employee: 'Emre Demir',
      department: 'Satış & İş Geliştirme',
      route: 'IST → ALA (Air Astana · Business)',
      date: '14 Ara 2026',
      amount: 14850,
      status: 'Bekliyor',
    },
    {
      id: 'crp-2',
      employee: 'Aida Nurlanova',
      department: 'Operasyon',
      route: 'ALA → IST (Turkish Airlines · Extra Fly)',
      date: '19 Ara 2026',
      amount: 7620,
      status: 'Bekliyor',
    },
    {
      id: 'crp-3',
      employee: 'Kerem Aydın',
      department: 'Finans',
      route: 'IST → LHR + 2 Gece Otel',
      date: '22 Ara 2026',
      amount: 18400,
      status: 'Onaylandı',
    },
  ]);

  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const flash = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 2600);
  };

  const handleAddPassenger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaxName.trim() || !newPaxDoc.trim()) return;
    setPassengers((prev) => [
      ...prev,
      {
        id: `pax-${Date.now()}`,
        fullName: newPaxName.trim(),
        docNumber: newPaxDoc.trim().toUpperCase(),
        birthDate: newPaxBirth || '1992-01-01',
        nationality: 'Türkiye (TR)',
      },
    ]);
    setNewPaxName('');
    setNewPaxDoc('');
    setNewPaxBirth('');
    flash('Yeni yolcu profili kaydedildi.');
  };

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertRoute.trim()) return;
    setAlerts((prev) => [
      ...prev,
      {
        id: `al-${Date.now()}`,
        route: newAlertRoute,
        target: Number(newAlertTarget) || 5000,
        current: (Number(newAlertTarget) || 5000) + 640,
      },
    ]);
    flash('Fiyat alarmı oluşturuldu! Fiyat düştüğünde WhatsApp ve e-posta ile haber vereceğiz.');
  };

  const activeBookingsCount = bookings.filter((b) => b.status === 'Onaylandı').length;

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="section-eyebrow on-dark">
                {user.accountType === 'corporate' ? ui.corpEye : ui.indEye}
              </div>
              <h1 className="inner-h1">
                {ui.welcome}, {user.firstName} {user.lastName}
              </h1>
              <div className="route-pills">
                <span className="route-pill">{user.email}</span>
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

      <section className="results-workspace">
        <div className="container">
          {savedNotice && (
            <div
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
            {/* Sidebar Navigation */}
            <aside className="panel-sidebar">
              <button
                type="button"
                className={`panel-nav-btn ${tab === 'overview' ? 'active' : ''}`}
                onClick={() => setTab('overview')}
              >
                <LayoutDashboard size={17} />
                {ui.tabOverview}
              </button>
              <button
                type="button"
                className={`panel-nav-btn ${tab === 'bookings' ? 'active' : ''}`}
                onClick={() => setTab('bookings')}
              >
                <Ticket size={17} />
                {ui.tabBookings} ({bookings.length})
              </button>
              <button
                type="button"
                className={`panel-nav-btn ${tab === 'passengers' ? 'active' : ''}`}
                onClick={() => setTab('passengers')}
              >
                <Users size={17} />
                {ui.tabPassengers} ({passengers.length})
              </button>
              <button
                type="button"
                className={`panel-nav-btn ${tab === 'corporate' ? 'active' : ''}`}
                onClick={() => setTab('corporate')}
              >
                <Briefcase size={17} />
                {ui.tabCorporate}
              </button>
              <button
                type="button"
                className={`panel-nav-btn ${tab === 'alerts' ? 'active' : ''}`}
                onClick={() => setTab('alerts')}
              >
                <Bell size={17} />
                {ui.tabAlerts} ({alerts.length})
              </button>
              <button
                type="button"
                className={`panel-nav-btn ${tab === 'security' ? 'active' : ''}`}
                onClick={() => setTab('security')}
              >
                <Shield size={17} />
                {ui.tabSecurity}
              </button>

              <div style={{ borderTop: '1px solid var(--aspan-border)', margin: '12px 0' }} />
              <button
                type="button"
                className="panel-nav-btn"
                style={{ color: '#be123c' }}
                onClick={onLogout}
              >
                <LogOut size={17} />
                {ui.logoutBtn}
              </button>
            </aside>

            {/* Main Panel Workspace */}
            <div>
              {/* 1. OVERVIEW */}
              {tab === 'overview' && (
                <>
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
                        {user.twoFactorEnabled ? ui.stat2faOn : ui.stat2faStd}
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
                        onClick={() => setTab('bookings')}
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="uf-airport-code">{b.pnr}</span>
                            <strong>{b.title}</strong>
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 3 }}>
                            {b.type} · {b.subtitle} · {formatDisplayDate(b.date, lang)}
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
                  <strong style={{ fontSize: 18, display: 'block', marginBottom: 16 }}>
                    Biletlerim &amp; Rezervasyonlarım
                  </strong>
                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        border: '1px solid var(--aspan-border)',
                        marginBottom: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span className="uf-airport-code">{b.pnr}</span>
                          <span className="pkg-pill">{b.type}</span>
                          <span className={`status-badge ${b.status === 'Onaylandı' ? 'ok' : 'warn'}`}>
                            {b.status}
                          </span>
                        </div>
                        <strong style={{ fontSize: 16 }}>{b.title}</strong>
                        <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 3 }}>
                          {b.subtitle} · {formatDisplayDate(b.date, lang)} · {b.passenger}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 18 }}>₺{formatTRY(b.price)}</strong>
                        <button
                          type="button"
                          className="uf-quick-pill"
                          onClick={() => flash(`${b.pnr} e-bilet PDF olarak indiriliyor...`)}
                        >
                          <Download size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          E-Bilet
                        </button>
                        {b.status === 'Onaylandı' && (
                          <button
                            type="button"
                            className="uf-quick-pill"
                            style={{ color: '#be123c', borderColor: 'rgba(225,29,72,0.3)' }}
                            onClick={() => {
                              onCancelBooking(b.id);
                              flash(`${b.pnr} için iptal / iade talebiniz işleme alındı.`);
                            }}
                          >
                            İptal Talebi
                          </button>
                        )}
                      </div>
                    </div>
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
                          <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                            Pasaport / TCKN: {p.docNumber} · Doğum: {p.birthDate} · {p.nationality}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="drawer-close"
                          onClick={() => setPassengers((prev) => prev.filter((x) => x.id !== p.id))}
                          aria-label="Yolcuyu sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form className="panel-card" onSubmit={handleAddPassenger}>
                    <strong style={{ fontSize: 15.5, display: 'block', marginBottom: 12 }}>
                      Yeni Yolcu Ekle
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10 }}>
                      <input
                        required
                        className="modal-input"
                        placeholder="Ad Soyad"
                        value={newPaxName}
                        onChange={(e) => setNewPaxName(e.target.value)}
                      />
                      <input
                        required
                        className="modal-input"
                        placeholder="Pasaport veya TCKN"
                        value={newPaxDoc}
                        onChange={(e) => setNewPaxDoc(e.target.value)}
                      />
                      <input
                        type="date"
                        className="modal-input"
                        value={newPaxBirth}
                        onChange={(e) => setNewPaxBirth(e.target.value)}
                      />
                      <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }}>
                        <Plus size={16} /> Ekle
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* 4. CORPORATE PORTAL (B2B Budget + Manager Approval Queue) */}
              {tab === 'corporate' && (
                <>
                  <div className="panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <span className="pkg-pill">B2B KURUMSAL SEYAHAT</span>
                        <h3 style={{ margin: '8px 0 4px', fontSize: 20 }}>
                          {user.companyName || 'Infinitive Kurumsal Hesap (Demo)'}
                        </h3>
                        <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>
                          Aylık Seyahat Bütçesi: ₺250.000 · Kullanılan: ₺94.200 (%38)
                        </div>
                      </div>
                      <button
                        type="button"
                        className="uf-quick-pill"
                        onClick={() => flash('Aylık departman bazlı kurumsal masraf raporu (Excel/PDF) indiriliyor...')}
                      >
                        <Download size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                        Aylık E-Fatura &amp; Rapor
                      </button>
                    </div>
                    <div
                      style={{
                        height: 10,
                        borderRadius: 99,
                        background: 'var(--aspan-bg-pill)',
                        marginTop: 14,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: '38%',
                          height: '100%',
                          background: 'linear-gradient(90deg, #00A8B5, #38BDF8, #F5CD5E)',
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>

                  <div className="panel-card">
                    <strong style={{ fontSize: 17, display: 'block', marginBottom: 14 }}>
                      Yönetici Onayı Bekleyen Seyahat Talepleri
                    </strong>
                    {approvals.map((ap) => (
                      <div
                        key={ap.id}
                        style={{
                          padding: 14,
                          borderRadius: 14,
                          border: '1px solid var(--aspan-border)',
                          marginBottom: 10,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 14,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <strong>{ap.employee}</strong>{' '}
                          <span style={{ fontSize: 12, color: 'var(--aspan-teal-deep)', fontWeight: 700 }}>
                            · {ap.department}
                          </span>
                          <div style={{ fontSize: 13, color: 'var(--aspan-text-body)', marginTop: 2 }}>
                            {ap.route} · {ap.date}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <strong>₺{formatTRY(ap.amount)}</strong>
                          {ap.status === 'Bekliyor' ? (
                            <>
                              <button
                                type="button"
                                className="uf-quick-pill"
                                style={{ background: 'rgba(16,185,129,0.14)', color: '#047857', borderColor: 'transparent' }}
                                onClick={() => {
                                  setApprovals((prev) =>
                                    prev.map((x) => (x.id === ap.id ? { ...x, status: 'Onaylandı' } : x))
                                  );
                                  flash(`${ap.employee} seyahat talebi onaylandı ve biletlemeye aktarıldı.`);
                                }}
                              >
                                <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Onayla
                              </button>
                              <button
                                type="button"
                                className="uf-quick-pill"
                                style={{ background: 'rgba(225,29,72,0.1)', color: '#be123c', borderColor: 'transparent' }}
                                onClick={() => {
                                  setApprovals((prev) =>
                                    prev.map((x) => (x.id === ap.id ? { ...x, status: 'Reddedildi' } : x))
                                  );
                                  flash(`${ap.employee} talebi reddedildi.`);
                                }}
                              >
                                <XCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Reddet
                              </button>
                            </>
                          ) : (
                            <span className={`status-badge ${ap.status === 'Onaylandı' ? 'ok' : 'bad'}`}>
                              {ap.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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
                          onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== al.id))}
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr auto', gap: 10 }}>
                      <input
                        className="modal-input"
                        value={newAlertRoute}
                        onChange={(e) => setNewAlertRoute(e.target.value)}
                        placeholder="Örn: İstanbul (IST) → Astana (NQZ)"
                      />
                      <input
                        type="number"
                        className="modal-input"
                        value={newAlertTarget}
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

              {/* 6. SECURITY & KVKK */}
              {tab === 'security' && (
                <div className="panel-card">
                  <strong style={{ fontSize: 18, display: 'block', marginBottom: 14 }}>
                    Hesap Güvenliği, 2FA &amp; KVKK Veri Yönetimi
                  </strong>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 16,
                      borderRadius: 14,
                      background: 'var(--aspan-bg-soft)',
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Lock size={20} color="#00A8B5" />
                      <div>
                        <strong>İki Aşamalı Doğrulama (SMS / OTP 2FA)</strong>
                        <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                          Giriş ve bilet iptal işlemlerinde telefonunuza doğrulama kodu gönderilir.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-gold-nav"
                      style={{ height: 38, fontSize: 12.5 }}
                      onClick={() => {
                        const nextVal = !user.twoFactorEnabled;
                        onUpdateUser({ ...user, twoFactorEnabled: nextVal });
                        flash(nextVal ? '2FA başarıyla etkinleştirildi.' : '2FA devre dışı bırakıldı.');
                      }}
                    >
                      {user.twoFactorEnabled ? 'Kapat' : 'Etkinleştir'}
                    </button>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--aspan-text-body)', lineHeight: 1.7 }}>
                    • <strong>KVKK &amp; GDPR Haklarınız:</strong> Kayıtlı kişisel verilerinizi JSON/PDF
                    olarak indirebilir veya hesap silme talebi oluşturabilirsiniz.
                    <br />• <strong>Ödeme Kartı Güvenliği:</strong> Kart bilgileriniz PCI-DSS Level 1
                    sertifikalı ödeme altyapısında token olarak korunur, sunucularımızda saklanmaz.
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="uf-quick-pill"
                      onClick={() => flash('KVKK kişisel veri raporunuz hazırlanarak e-posta adresinize gönderildi.')}
                    >
                      <Download size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                      Verilerimi İndir (KVKK)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
