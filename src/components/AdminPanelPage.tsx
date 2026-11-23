import React, { useEffect, useMemo, useState } from 'react';
import {
  Sliders,
  TrendingUp,
  Ticket,
  Tag,
  CheckCircle2,
  RotateCcw,
  Plane,
  Building2,
  CarTaxiFront,
  ArrowLeft,
  Lock,
  RefreshCw,
  Globe,
  LogOut,
  LayoutDashboard,
  Users,
  Plug,
  Search,
  Calendar,
  ArrowUpDown,
  Plus,
  Trash2,
  Download,
  Check,
  XCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  CAMPAIGNS,
  DEFAULT_MARKUP,
  HOTEL_DEALS,
  TRANSFER_DEALS,
  formatDisplayDate,
  formatPrice,
  getLiveRatesSnapshot,
  refreshLiveExchangeRates,
} from '../data/mockData';
import {
  AdminMarkupConfig,
  BookingRecord,
  CurrencyCode,
  LangCode,
} from '../types';

interface AdminPanelPageProps {
  lang?: LangCode;
  currency?: CurrencyCode;
  markup: AdminMarkupConfig;
  onUpdateMarkup: (next: AdminMarkupConfig) => void;
  bookings: BookingRecord[];
  onAddBooking: (record: BookingRecord) => void;
  onUpdateBookingStatus: (id: string, status: BookingRecord['status']) => void;
  onDeleteBooking: (id: string) => void;
  onBackHome: () => void;
}

type AdminSection =
  | 'dashboard'
  | 'bookings'
  | 'pricing'
  | 'inventory'
  | 'coupons'
  | 'agents'
  | 'apis';

type BookingSortKey =
  | 'dateDesc'
  | 'dateAsc'
  | 'priceDesc'
  | 'priceAsc'
  | 'paxAsc';

interface StatusVisual {
  label: string;
  desc: string;
  flightState: (dateIso: string) => string;
  border: string;
  bg: string;
  badgeBg: string;
  badgeColor: string;
  dot: string;
}

const STATUS_VISUALS: Record<BookingRecord['status'], StatusVisual> = {
  Onaylandı: {
    label: 'Satıldı · Uçuş Bekliyor',
    desc: 'Bilet kesildi, yolcu henüz uçmadı (Aktif)',
    flightState: (dateIso) => {
      const todayIso = new Date().toISOString().slice(0, 10);
      if (dateIso === todayIso) return '🛫 Bugün Uçuyor!';
      if (dateIso > todayIso) {
        const diff = Math.max(
          1,
          Math.round((new Date(dateIso).getTime() - new Date(todayIso).getTime()) / 86400000)
        );
        return `⏳ Henüz Uçmadı (Uçuşa ${diff} gün var)`;
      }
      return '🛫 Biletlendi · Aktif';
    },
    border: '#10B981',
    bg: 'rgba(16, 185, 129, 0.05)',
    badgeBg: 'rgba(16, 185, 129, 0.16)',
    badgeColor: '#047857',
    dot: '#10B981',
  },
  Tamamlandı: {
    label: 'Uçuş Tamamlandı',
    desc: 'Yolcu uçuşunu/hizmetini gerçekleştirdi',
    flightState: () => '✔️ Uçuş / Hizmet Tamamlandı',
    border: '#0284C7',
    bg: 'rgba(2, 132, 199, 0.05)',
    badgeBg: 'rgba(2, 132, 199, 0.15)',
    badgeColor: '#0369A1',
    dot: '#0284C7',
  },
  'İptal Talebi': {
    label: 'İptal / Değişiklik Talebi',
    desc: 'Müşteri iptal istedi, onayınızı bekliyor',
    flightState: () => '⚠️ Acente İşlemi Bekliyor',
    border: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.07)',
    badgeBg: 'rgba(245, 158, 11, 0.2)',
    badgeColor: '#B45309',
    dot: '#F59E0B',
  },
  'İptal Edildi': {
    label: 'İptal Edildi',
    desc: 'Bilet/PNR iptal edildi (Uçuş kapalı)',
    flightState: () => '❌ PNR İptal Edildi',
    border: '#E11D48',
    bg: 'rgba(225, 29, 72, 0.05)',
    badgeBg: 'rgba(225, 29, 72, 0.14)',
    badgeColor: '#BE123C',
    dot: '#E11D48',
  },
  'İade Edildi': {
    label: 'Ücret İade Edildi',
    desc: 'Bilet iptal edildi ve ücreti karta iade edildi',
    flightState: () => '💸 Müşteri Kartına İade Yapıldı',
    border: '#7C3AED',
    bg: 'rgba(124, 58, 237, 0.05)',
    badgeBg: 'rgba(124, 58, 237, 0.14)',
    badgeColor: '#6D28D9',
    dot: '#7C3AED',
  },
};

export const AdminPanelPage: React.FC<AdminPanelPageProps> = ({
  lang = 'TR',
  currency = 'TRY',
  markup,
  onUpdateMarkup,
  bookings,
  onAddBooking,
  onUpdateBookingStatus,
  onDeleteBooking,
  onBackHome,
}) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('flytoaspan_admin_auth') === '1';
    } catch {
      return false;
    }
  });
  const [adminEmail, setAdminEmail] = useState('admin@flytoaspan.com');
  const [adminPass, setAdminPass] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [section, setSection] = useState<AdminSection>('dashboard');
  const [draft, setDraft] = useState<AdminMarkupConfig>(markup);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [fxSnapshot, setFxSnapshot] = useState(() => getLiveRatesSnapshot());
  const [fxLoading, setFxLoading] = useState(false);

  // Module 2: Bookings Filter, Date Range, Sort & Manual PNR Form
  const [searchQ, setSearchQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Uçak' | 'Otel' | 'Transfer'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingRecord['status']>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<BookingSortKey>('dateDesc');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manType, setManType] = useState<'Uçak' | 'Otel' | 'Transfer'>('Uçak');
  const [manTitle, setManTitle] = useState('İstanbul (IST) → Almatı (ALA)');
  const [manSubtitle, setManSubtitle] = useState('Air Astana · KC912 · Prime Fly');
  const [manPax, setManPax] = useState('');
  const [manDate, setManDate] = useState('2026-12-18');
  const [manPrice, setManPrice] = useState('6890');

  // Module 3: Airline-Specific Markup Rules
  const [airlineRules, setAirlineRules] = useState([
    { id: 'ar-1', carrier: 'Air Astana (KC)', route: 'Türkiye ↔ Kazakistan', rule: '+%7 Komisyon', active: true },
    { id: 'ar-2', carrier: 'Turkish Airlines (TK)', route: 'Tüm Hatlar', rule: '+₺220 Hizmet Bedeli', active: true },
    { id: 'ar-3', carrier: 'Buranus Charter (Corendon / SCAT / Freebird)', route: 'Antalya & Almatı Charter', rule: '+%9 Blok Koltuk Marjı', active: true },
    { id: 'ar-4', carrier: 'Pegasus & AJet (LCC)', route: 'Yurt İçi & Kıbrıs', rule: '+₺160 Sabit Servis', active: true },
  ]);
  const [newCarrier, setNewCarrier] = useState('');
  const [newRouteRule, setNewRouteRule] = useState('');

  // Module 5: Coupons Management
  const [coupons, setCoupons] = useState(() =>
    CAMPAIGNS.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      category: c.category,
      validUntil: c.validUntil,
      active: true,
    }))
  );
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponTitle, setNewCouponTitle] = useState('');

  // Module 6: B2B Agencies & Members Management
  const [agencies, setAgencies] = useState([
    {
      id: 'ag-1',
      name: 'Infinitive Travel Holding A.Ş. (Merkez)',
      type: 'Kurumsal B2B',
      contact: 'Alperen Kaya · +90 531 460 61 75',
      creditLimitTRY: 500000,
      miles: 48500,
      status: 'Aktif',
    },
    {
      id: 'ag-2',
      name: 'Astana Sky Turizm Ltd. (Kazakistan Partner)',
      type: 'B2B Alt Acente',
      contact: 'Aida Nurlanova · +7 701 555 44 33',
      creditLimitTRY: 250000,
      miles: 31200,
      status: 'Aktif',
    },
    {
      id: 'ag-3',
      name: 'Mert Yılmaz (Bireysel VIP Üye)',
      type: 'Bireysel B2C',
      contact: 'uye@flytoaspan.com',
      creditLimitTRY: 0,
      miles: 12450,
      status: 'Aktif',
    },
  ]);

  // Module 7: Supplier APIs (Buranus, Amadeus, BookingAgora, iyzico)
  const [apiConnectors, setApiConnectors] = useState([
    {
      id: 'api-buranus',
      name: 'Buranus B2B & Charter API (agent.buranus.com)',
      desc: 'Tarifeli + Charter uçuşlar, otel ve VIP havalimanı transfer tedarik bağlantısı',
      endpoint: 'https://agent.buranus.com/api/v1',
      agentCode: 'INF-6199-TR',
      mode: 'Hazır (API Anahtarı Bekleniyor)',
      enabled: true,
    },
    {
      id: 'api-amadeus',
      name: 'Amadeus GDS Global Flight API',
      desc: '500+ uluslararası tarifeli havayolu anlık koltuk ve PNR biletleme servisi',
      endpoint: 'https://api.amadeus.com/v2/shopping/flight-offers',
      agentCode: 'AMA-IST-9021',
      mode: 'Test Modu Aktif',
      enabled: true,
    },
    {
      id: 'api-agora',
      name: 'BookingAgora / BiletBank B2B XML',
      desc: 'Türkiye yerel konsolidatör THY, Pegasus, AJet, Air Astana NDC bağlantısı',
      endpoint: 'https://xml.bookingagora.com/service',
      agentCode: 'AGORA-FTA-01',
      mode: 'Test Modu Aktif',
      enabled: true,
    },
    {
      id: 'api-pos',
      name: 'iyzico / PayTR 3D Secure Sanal POS',
      desc: 'Visa, Mastercard, Troy, Kaspi & Mir 3D Secure tahsilat ve otomatik iade',
      endpoint: 'https://api.iyzipay.com/payment/3dsecure',
      agentCode: 'POS-MERCHANT-90531',
      mode: '3D Secure Simülasyon Aktif',
      enabled: true,
    },
  ]);

  useEffect(() => {
    refreshLiveExchangeRates().then((res) => setFxSnapshot(res));
  }, []);

  const flash = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 3200);
  };

  const handleRefreshRates = async () => {
    setFxLoading(true);
    const res = await refreshLiveExchangeRates();
    setFxSnapshot(res);
    setFxLoading(false);
    flash('Canlı döviz kurları uluslararası kur servisinden (TRY/USD/EUR/KZT/RUB) güncellendi!');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMail = adminEmail.trim().toLowerCase();
    const cleanPass = adminPass.trim();
    if (
      (cleanMail === 'admin@flytoaspan.com' || cleanMail === 'alperen') &&
      (cleanPass === 'Aspan2026!' || cleanPass === '123456')
    ) {
      setIsUnlocked(true);
      setLoginError(null);
      try {
        sessionStorage.setItem('flytoaspan_admin_auth', '1');
      } catch {
        /* ignore */
      }
    } else {
      setLoginError('Hatalı yönetici e-postası veya şifre. (E-posta: admin@flytoaspan.com / Şifre: Aspan2026!)');
    }
  };

  // Filtered & Sorted Bookings
  const filteredBookings = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const list = bookings.filter((b) => {
      if (typeFilter !== 'ALL' && b.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (dateFrom && b.date < dateFrom) return false;
      if (dateTo && b.date > dateTo) return false;
      if (q) {
        const hay = `${b.pnr} ${b.title} ${b.subtitle} ${b.passenger} ${b.eticketNumber || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === 'dateDesc') sorted.sort((a, b) => b.date.localeCompare(a.date));
    else if (sortBy === 'dateAsc') sorted.sort((a, b) => a.date.localeCompare(b.date));
    else if (sortBy === 'priceDesc') sorted.sort((a, b) => b.price - a.price);
    else if (sortBy === 'priceAsc') sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === 'paxAsc') sorted.sort((a, b) => a.passenger.localeCompare(b.passenger));
    return sorted;
  }, [bookings, searchQ, typeFilter, statusFilter, dateFrom, dateTo, sortBy]);

  const totalRevenueTRY = bookings
    .filter((b) => b.status === 'Onaylandı' || b.status === 'Tamamlandı')
    .reduce((sum, b) => sum + b.price, 0);
  const refundedTotalTRY = bookings
    .filter((b) => b.status === 'İade Edildi')
    .reduce((sum, b) => sum + b.price, 0);
  const estimatedProfitTRY = Math.round(totalRevenueTRY * 0.095);

  const countByStatus = useMemo(() => {
    return {
      Onaylandı: bookings.filter((b) => b.status === 'Onaylandı').length,
      Tamamlandı: bookings.filter((b) => b.status === 'Tamamlandı').length,
      'İptal Talebi': bookings.filter((b) => b.status === 'İptal Talebi').length,
      'İptal Edildi': bookings.filter((b) => b.status === 'İptal Edildi').length,
      'İade Edildi': bookings.filter((b) => b.status === 'İade Edildi').length,
    };
  }, [bookings]);

  const sampleDomNet = 1460;
  const sampleDomSale = sampleDomNet + draft.domesticAddTRY;
  const sampleAlaNet = 6345;
  const sampleAlaSale = Math.round(sampleAlaNet * (1 + draft.centralAsiaPercent / 100));
  const sampleEurNet = 5220;
  const sampleEurSale = Math.round(sampleEurNet * (1 + draft.intlPercent / 100));

  const handleSaveMarkup = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateMarkup(draft);
    flash('Fiyat ve komisyon kuralları kaydedildi! Sitedeki tüm uçuş, otel ve transfer fiyatları güncellendi.');
  };

  const handleResetMarkup = () => {
    setDraft(DEFAULT_MARKUP);
    onUpdateMarkup(DEFAULT_MARKUP);
    flash('Varsayılan acente komisyon oranlarına dönüldü.');
  };

  const handleCreateManualBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const pnr = 'FTA' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const etkt = `235-${Math.floor(1000000000 + Math.random() * 8999999999)}`;
    onAddBooking({
      id: `bk-man-${Date.now()}`,
      pnr,
      eticketNumber: etkt,
      type: manType,
      title: manTitle.trim() || 'İstanbul (IST) → Almatı (ALA)',
      subtitle: manSubtitle.trim() || 'Manuel Acente Biletlemesi',
      date: manDate || '2026-12-18',
      passenger: manPax.trim() || 'Acente Misafiri',
      price: Math.max(250, Number(manPrice) || 4500),
      status: 'Onaylandı',
    });
    setManPax('');
    setShowManualForm(false);
    flash(`Yeni manuel rezervasyon oluşturuldu! PNR: ${pnr} · E-Bilet: ${etkt}`);
  };

  const handleExportCsv = () => {
    const headers = ['PNR', 'E-Bilet', 'Tip', 'Guzergah', 'Detay', 'Tarih', 'Yolcu', 'Tutar_TRY', 'Durum'];
    const rows = filteredBookings.map((b) => [
      b.pnr,
      b.eticketNumber || '-',
      b.type,
      `"${b.title}"`,
      `"${b.subtitle}"`,
      b.date,
      `"${b.passenger}"`,
      b.price,
      b.status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FlyToAspan_Rezervasyon_Raporu_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    flash('Filtrelenen rezervasyon listesi Excel / CSV dosyası olarak indirildi.');
  };

  if (!isUnlocked) {
    return (
      <>
        <div className="inner-hero">
          <div className="container">
            <button type="button" className="inner-back-btn" onClick={onBackHome}>
              <ArrowLeft size={15} />
              Ana Sayfaya Dön
            </button>
            <div className="section-eyebrow on-dark">GÜVENLİ YÖNETİCİ GİRİŞİ</div>
            <h1 className="inner-h1">FlyToAspan Süper-Admin &amp; Acente Kontrol Merkezi</h1>
          </div>
        </div>

        <section className="results-workspace">
          <div className="container" style={{ maxWidth: 460 }}>
            <form className="panel-card" onSubmit={handleAdminLogin}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'var(--aspan-teal-soft)',
                    color: 'var(--aspan-teal-deep)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Lock size={20} />
                </div>
                <div>
                  <strong style={{ fontSize: 18, display: 'block' }}>Tam Yetkili Yönetici Girişi</strong>
                  <span style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                    Fiyat, PNR, B2B Bayi ve API Kontrol Paneli
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label
                    htmlFor="admin-login-email"
                    style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}
                  >
                    Yönetici E-Posta
                  </label>
                  <input
                    id="admin-login-email"
                    name="adminEmail"
                    type="email"
                    required
                    className="modal-input"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-login-pass"
                    style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}
                  >
                    Yönetici Parolası
                  </label>
                  <input
                    id="admin-login-pass"
                    name="adminPassword"
                    type="password"
                    required
                    className="modal-input"
                    placeholder="Aspan2026! veya 123456"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                  />
                </div>

                {loginError && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'rgba(225,29,72,0.1)',
                      color: '#be123c',
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    {loginError}
                  </div>
                )}

                <button type="submit" className="u4-submit-btn" style={{ width: '100%' }}>
                  Yönetici Paneline Giriş Yap
                </button>

                <button
                  type="button"
                  className="uf-quick-pill"
                  style={{ textAlign: 'center', padding: '9px 12px' }}
                  onClick={() => {
                    setIsUnlocked(true);
                    try {
                      sessionStorage.setItem('flytoaspan_admin_auth', '1');
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                  Tek Tıkla Yönetici Girişi (Hızlı Test)
                </button>
              </div>
            </form>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <button type="button" className="inner-back-btn" onClick={onBackHome}>
                <ArrowLeft size={15} />
                Siteye Dön
              </button>
              <div className="section-eyebrow on-dark">
                FLYTOASPAN BY INFINITIVE TRAVEL · SÜPER-ADMİN KONTROL MERKEZİ
              </div>
              <h1 className="inner-h1">Tam Yetkili Acente &amp; OTA Yönetim Paneli</h1>
              <div className="route-pills">
                <span className="route-pill">Yönetici: admin@flytoaspan.com</span>
                <span className="route-pill">Yetki: Tam Yetki (Super Admin)</span>
                <span className="route-pill">Canlı Kur: 1 $ ≈ ₺{(1 / fxSnapshot.rates.USD).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-gold-nav"
                onClick={() => {
                  setSection('bookings');
                  setShowManualForm(true);
                }}
              >
                <Plus size={16} />
                Manuel Bilet / PNR Kes
              </button>
              <button
                type="button"
                className="btn-logout-nav"
                onClick={() => {
                  sessionStorage.removeItem('flytoaspan_admin_auth');
                  setIsUnlocked(false);
                }}
              >
                <LogOut size={15} />
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container">
          {savedToast && (
            <div
              style={{
                marginBottom: 18,
                padding: '13px 18px',
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
              {savedToast}
            </div>
          )}

          <div className="panel-layout">
            {/* Left 7-Module Super-Admin Sidebar */}
            <aside className="panel-sidebar">
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--aspan-text-muted)', padding: '4px 10px 8px', letterSpacing: '0.06em' }}>
                YÖNETİM MODÜLLERİ (7 YETKİ)
              </div>

              <button
                type="button"
                className={`panel-nav-btn ${section === 'dashboard' ? 'active' : ''}`}
                onClick={() => setSection('dashboard')}
              >
                <LayoutDashboard size={17} />
                1. Genel Bakış &amp; Ciro
              </button>

              <button
                type="button"
                className={`panel-nav-btn ${section === 'bookings' ? 'active' : ''}`}
                onClick={() => setSection('bookings')}
              >
                <Ticket size={17} />
                2. Bilet &amp; PNR Yönetimi ({bookings.length})
              </button>

              <button
                type="button"
                className={`panel-nav-btn ${section === 'pricing' ? 'active' : ''}`}
                onClick={() => setSection('pricing')}
              >
                <Sliders size={17} />
                3. Fiyat &amp; Kâr Marjı (Markup)
              </button>

              <button
                type="button"
                className={`panel-nav-btn ${section === 'inventory' ? 'active' : ''}`}
                onClick={() => setSection('inventory')}
              >
                <CarTaxiFront size={17} />
                4. Otel &amp; VIP Transfer Vitrini
              </button>

              <button
                type="button"
                className={`panel-nav-btn ${section === 'coupons' ? 'active' : ''}`}
                onClick={() => setSection('coupons')}
              >
                <Tag size={17} />
                5. Kampanya &amp; Kuponlar ({coupons.length})
              </button>

              <button
                type="button"
                className={`panel-nav-btn ${section === 'agents' ? 'active' : ''}`}
                onClick={() => setSection('agents')}
              >
                <Users size={17} />
                6. B2B Bayiler &amp; Üyeler
              </button>

              <button
                type="button"
                className={`panel-nav-btn ${section === 'apis' ? 'active' : ''}`}
                onClick={() => setSection('apis')}
              >
                <Plug size={17} />
                7. API (Buranus/GDS) &amp; POS
              </button>

              <div style={{ borderTop: '1px solid var(--aspan-border)', margin: '12px 0' }} />

              <button
                type="button"
                className="panel-nav-btn"
                onClick={handleExportCsv}
                style={{ color: 'var(--aspan-teal-deep)' }}
              >
                <Download size={17} />
                Excel / CSV Rapor İndir
              </button>
            </aside>

            {/* Right Main Admin Workspace */}
            <div>
              {/* ==================== MODULE 1: DASHBOARD ==================== */}
              {section === 'dashboard' && (
                <>
                  <div className="panel-stat-grid">
                    <div className="panel-stat-card">
                      <div className="filter-label">Toplam Satış Cirosu</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--aspan-text)' }}>
                        {formatPrice(totalRevenueTRY, currency)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        B2C Online + Kurumsal B2B
                      </div>
                    </div>

                    <div className="panel-stat-card">
                      <div className="filter-label">Net Acente Kârı (Markup)</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>
                        +{formatPrice(estimatedProfitTRY, currency)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        Ortalama Kâr Marjı: %9.5
                      </div>
                    </div>

                    <div className="panel-stat-card">
                      <div className="filter-label">Aktif PNR / Bilet Durumu</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--aspan-teal-deep)' }}>
                        {countByStatus.Onaylandı} Uçuş Bekliyor
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        Tamamlanan: {countByStatus.Tamamlandı} · İade: {formatPrice(refundedTotalTRY, currency)}
                      </div>
                    </div>
                  </div>

                  {/* 5 Color-Coded Ticket Status Legend & Quick Filter Cards */}
                  <div className="panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <strong style={{ fontSize: 16.5 }}>
                        Bilet &amp; Uçuş Durum Özeti (Renk Kodlu Hızlı Kontrol)
                      </strong>
                      <span style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        Kutulara tıklayarak ilgili biletleri hemen listeleyebilirsiniz
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {(
                        [
                          'Onaylandı',
                          'Tamamlandı',
                          'İptal Talebi',
                          'İptal Edildi',
                          'İade Edildi',
                        ] as BookingRecord['status'][]
                      ).map((st) => {
                        const vis = STATUS_VISUALS[st];
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              setStatusFilter(st);
                              setSection('bookings');
                            }}
                            style={{
                              textAlign: 'left',
                              padding: '12px 14px',
                              borderRadius: 14,
                              border: `1.5px solid ${vis.border}`,
                              borderLeft: `6px solid ${vis.border}`,
                              background: vis.bg,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: vis.badgeColor,
                                }}
                              >
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: vis.dot,
                                    display: 'inline-block',
                                  }}
                                />
                                {vis.label}
                              </span>
                              <strong style={{ fontSize: 18, color: vis.badgeColor }}>
                                {countByStatus[st]}
                              </strong>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--aspan-text-body)', marginTop: 4 }}>
                              {vis.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Currency Exchange Bar */}
                  <div className="panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Globe size={20} color="#00A8B5" />
                        <div>
                          <strong style={{ fontSize: 16 }}>
                            Canlı Merkez Bankası &amp; Global Döviz Kurları
                          </strong>
                          <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                            Son Senkronizasyon: {fxSnapshot.updatedAt || 'Canlı'} · Üst menüdeki para birimi seçici bu kurları kullanır.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="uf-quick-pill"
                        onClick={handleRefreshRates}
                        disabled={fxLoading}
                      >
                        <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                        {fxLoading ? 'Güncelleniyor...' : 'Kurları Şimdi Güncelle'}
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
                        gap: 10,
                        marginTop: 14,
                      }}
                    >
                      <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)', fontWeight: 700 }}>USD / TRY</div>
                        <strong style={{ fontSize: 16 }}>1 $ ≈ ₺{(1 / fxSnapshot.rates.USD).toFixed(2)}</strong>
                      </div>
                      <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)', fontWeight: 700 }}>EUR / TRY</div>
                        <strong style={{ fontSize: 16 }}>1 € ≈ ₺{(1 / fxSnapshot.rates.EUR).toFixed(2)}</strong>
                      </div>
                      <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)', fontWeight: 700 }}>TRY / KZT (Tenge)</div>
                        <strong style={{ fontSize: 16 }}>1 ₺ ≈ {fxSnapshot.rates.KZT.toFixed(2)} ₸</strong>
                      </div>
                      <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)', fontWeight: 700 }}>TRY / RUB (Ruble)</div>
                        <strong style={{ fontSize: 16 }}>1 ₺ ≈ {fxSnapshot.rates.RUB.toFixed(2)} ₽</strong>
                      </div>
                    </div>
                  </div>

                  {/* Quick Jump Cards */}
                  <div className="panel-card">
                    <strong style={{ fontSize: 16.5, display: 'block', marginBottom: 12 }}>
                      Hızlı Yönetici İşlemleri
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                      <button
                        type="button"
                        className="drawer-link"
                        onClick={() => setSection('bookings')}
                      >
                        <span>🎫 PNR &amp; Tarih Sıralama</span>
                        <span>→</span>
                      </button>
                      <button
                        type="button"
                        className="drawer-link"
                        onClick={() => setSection('pricing')}
                      >
                        <span>💰 Komisyon &amp; Kâr Ayarla</span>
                        <span>→</span>
                      </button>
                      <button
                        type="button"
                        className="drawer-link"
                        onClick={() => setSection('coupons')}
                      >
                        <span>🎁 Yeni İndirim Kuponu Aç</span>
                        <span>→</span>
                      </button>
                      <button
                        type="button"
                        className="drawer-link"
                        onClick={() => setSection('apis')}
                      >
                        <span>🔌 Buranus &amp; GDS API Ayarı</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ==================== MODULE 2: BOOKINGS (SORTING + DATE FILTER + CRUD) ==================== */}
              {section === 'bookings' && (
                <>
                  <div className="panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                      <div>
                        <strong style={{ fontSize: 18 }}>
                          Tüm Rezervasyonlar, Tarih Filtreleme &amp; Sıralama
                        </strong>
                        <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                          PNR, yolcu adı, hizmet tipi ve tarih aralığına göre süzebilir; fiyata veya tarihe göre sıralayabilirsiniz.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="uf-quick-pill"
                          onClick={handleExportCsv}
                        >
                          <Download size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                          CSV İndir
                        </button>
                        <button
                          type="button"
                          className="btn-gold-nav"
                          style={{ height: 38, fontSize: 12.5 }}
                          onClick={() => setShowManualForm((v) => !v)}
                        >
                          <Plus size={14} />
                          {showManualForm ? 'Formu Kapat' : 'Manuel PNR Ekle'}
                        </button>
                      </div>
                    </div>

                    {/* Manual Booking Form */}
                    {showManualForm && (
                      <form
                        onSubmit={handleCreateManualBooking}
                        style={{
                          padding: 16,
                          borderRadius: 16,
                          background: 'var(--aspan-sky-soft)',
                          border: '1px solid var(--aspan-border)',
                          marginBottom: 18,
                        }}
                      >
                        <strong style={{ fontSize: 14.5, display: 'block', marginBottom: 10 }}>
                          + Telefon / WhatsApp Müşterisi İçin Manuel Rezervasyon (PNR) Oluştur
                        </strong>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10, marginBottom: 12 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                              Hizmet Tipi
                            </label>
                            <select
                              className="modal-input"
                              value={manType}
                              onChange={(e) => setManType(e.target.value as 'Uçak' | 'Otel' | 'Transfer')}
                            >
                              <option value="Uçak">✈️ Uçak Bileti</option>
                              <option value="Otel">🏨 Otel Konaklama</option>
                              <option value="Transfer">🚘 VIP Transfer</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                              Rota / Otel / Güzergâh *
                            </label>
                            <input
                              required
                              className="modal-input"
                              value={manTitle}
                              onChange={(e) => setManTitle(e.target.value)}
                              placeholder="İstanbul (IST) → Almatı (ALA)"
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                              Havayolu / Paket Detayı
                            </label>
                            <input
                              className="modal-input"
                              value={manSubtitle}
                              onChange={(e) => setManSubtitle(e.target.value)}
                              placeholder="Air Astana · KC912"
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                              Yolcu Adı Soyadı *
                            </label>
                            <input
                              required
                              className="modal-input"
                              value={manPax}
                              onChange={(e) => setManPax(e.target.value)}
                              placeholder="Örn: Timur Bekmurat"
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                              Uçuş / Giriş Tarihi *
                            </label>
                            <input
                              type="date"
                              required
                              className="modal-input"
                              value={manDate}
                              onChange={(e) => setManDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                              Toplam Tutar (TL) *
                            </label>
                            <input
                              type="number"
                              required
                              className="modal-input"
                              value={manPrice}
                              onChange={(e) => setManPrice(e.target.value)}
                            />
                          </div>
                        </div>
                        <button type="submit" className="u4-submit-btn" style={{ height: 42, fontSize: 13 }}>
                          PNR ve E-Bilet Oluştur
                        </button>
                      </form>
                    )}

                    {/* Filter, Date Range & Sort Controls */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                        gap: 10,
                        padding: 14,
                        borderRadius: 16,
                        background: 'var(--aspan-bg-soft)',
                        border: '1px solid var(--aspan-border)',
                        marginBottom: 14,
                      }}
                    >
                      {/* Search */}
                      <div style={{ position: 'relative' }}>
                        <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                          <Search size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          PNR / Yolcu / Rota Ara
                        </label>
                        <input
                          className="modal-input"
                          placeholder="FTA8K4, Almatı, Mert..."
                          value={searchQ}
                          onChange={(e) => setSearchQ(e.target.value)}
                        />
                      </div>

                      {/* Start Date */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                          <Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          Başlangıç Tarihi
                        </label>
                        <input
                          type="date"
                          className="modal-input"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>

                      {/* End Date */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                          <Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          Bitiş Tarihi
                        </label>
                        <input
                          type="date"
                          className="modal-input"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </div>

                      {/* Sort By */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                          <ArrowUpDown size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          Sıralama Ölçütü
                        </label>
                        <select
                          className="modal-input"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as BookingSortKey)}
                        >
                          <option value="dateDesc">Tarih: En Yeni → En Eski</option>
                          <option value="dateAsc">Tarih: En Eski → En Yeni</option>
                          <option value="priceDesc">Tutar: En Yüksek → En Düşük</option>
                          <option value="priceAsc">Tutar: En Düşük → En Yüksek</option>
                          <option value="paxAsc">Yolcu Adı: A → Z</option>
                        </select>
                      </div>
                    </div>

                    {/* Pill Filters for Type & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(['ALL', 'Uçak', 'Otel', 'Transfer'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={`sort-pill-btn ${typeFilter === t ? 'active' : ''}`}
                            onClick={() => setTypeFilter(t)}
                          >
                            {t === 'ALL' ? 'Tüm Hizmetler' : t}
                          </button>
                        ))}
                      </div>

                      {/* Color-Coded Status Filter Buttons */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`sort-pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
                          onClick={() => setStatusFilter('ALL')}
                        >
                          Tüm Durumlar ({bookings.length})
                        </button>
                        {(
                          [
                            'Onaylandı',
                            'Tamamlandı',
                            'İptal Talebi',
                            'İptal Edildi',
                            'İade Edildi',
                          ] as BookingRecord['status'][]
                        ).map((st) => {
                          const vis = STATUS_VISUALS[st];
                          const isActive = statusFilter === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setStatusFilter(st)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 999,
                                border: `1.5px solid ${vis.border}`,
                                background: isActive ? vis.border : vis.bg,
                                color: isActive ? '#ffffff' : vis.badgeColor,
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: isActive ? '#ffffff' : vis.dot,
                                }}
                              />
                              {vis.label} ({countByStatus[st]})
                            </button>
                          );
                        })}
                        {(searchQ || dateFrom || dateTo || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
                          <button
                            type="button"
                            className="uf-quick-pill"
                            onClick={() => {
                              setSearchQ('');
                              setDateFrom('');
                              setDateTo('');
                              setTypeFilter('ALL');
                              setStatusFilter('ALL');
                            }}
                          >
                            Filtreleri Temizle
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bookings List */}
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--aspan-text-muted)', marginBottom: 10 }}>
                      Gösterilen: {filteredBookings.length} / {bookings.length} kayıt
                    </div>

                    {filteredBookings.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 36, color: 'var(--aspan-text-muted)' }}>
                        Seçilen tarih veya arama kriterlerine uygun rezervasyon bulunamadı.
                      </div>
                    ) : (
                      filteredBookings.map((b) => {
                        const vis = STATUS_VISUALS[b.status] || STATUS_VISUALS.Onaylandı;
                        return (
                          <div
                            key={b.id}
                            style={{
                              padding: '15px 18px',
                              borderRadius: 16,
                              border: `1.5px solid ${vis.border}`,
                              borderLeft: `7px solid ${vis.border}`,
                              background: vis.bg,
                              marginBottom: 12,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 14,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span className="uf-airport-code">{b.pnr}</span>
                                <span className="pkg-pill">{b.type}</span>
                                {b.eticketNumber && <span className="pkg-pill">ETKT: {b.eticketNumber}</span>}
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 11px',
                                    borderRadius: 999,
                                    background: vis.badgeBg,
                                    color: vis.badgeColor,
                                    fontWeight: 800,
                                    fontSize: 11.5,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      background: vis.dot,
                                    }}
                                  />
                                  {vis.label}
                                </span>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: vis.badgeColor,
                                  }}
                                >
                                  {vis.flightState(b.date)}
                                </span>
                              </div>
                              <strong style={{ fontSize: 16 }}>{b.title}</strong>
                              <div style={{ fontSize: 12.5, color: 'var(--aspan-text-body)', marginTop: 3 }}>
                                {b.subtitle} · Tarih: <strong>{formatDisplayDate(b.date, lang)}</strong> ({b.date}) · Yolcu:{' '}
                                <strong>{b.passenger}</strong>
                                {b.invoiceCompany ? ` · Kurumsal Fatura: ${b.invoiceCompany}` : ''}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: 18, marginRight: 6, color: 'var(--aspan-text)' }}>
                                {formatPrice(b.price, currency)}
                              </strong>

                              <select
                                aria-label={`${b.pnr} durumunu değiştir`}
                                value={b.status}
                                onChange={(e) => {
                                  const nextSt = e.target.value as BookingRecord['status'];
                                  onUpdateBookingStatus(b.id, nextSt);
                                  flash(`${b.pnr} bilet durumu "${STATUS_VISUALS[nextSt].label}" olarak güncellendi.`);
                                }}
                                style={{
                                  height: 36,
                                  padding: '0 10px',
                                  borderRadius: 10,
                                  border: `1.5px solid ${vis.border}`,
                                  background: '#ffffff',
                                  color: vis.badgeColor,
                                  fontWeight: 800,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="Onaylandı">🟢 Satıldı · Uçuş Bekliyor</option>
                                <option value="Tamamlandı">🔵 Uçuş Tamamlandı (Uçtu)</option>
                                <option value="İptal Talebi">🟠 İptal / Değişiklik Talebi</option>
                                <option value="İptal Edildi">🔴 İptal Edildi (Void)</option>
                                <option value="İade Edildi">🟣 Ücret İade Edildi</option>
                              </select>

                              <button
                                type="button"
                                className="drawer-close"
                                style={{ background: '#ffffff' }}
                                title="Kaydı Sil"
                                onClick={() => {
                                  onDeleteBooking(b.id);
                                  flash(`${b.pnr} kaydı listeden silindi.`);
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {/* ==================== MODULE 3: PRICING & MARKUP ENGINE ==================== */}
              {section === 'pricing' && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                      gap: 18,
                      marginBottom: 18,
                    }}
                  >
                    <form className="panel-card" style={{ marginBottom: 0 }} onSubmit={handleSaveMarkup}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Sliders size={20} color="#00A8B5" />
                          <strong style={{ fontSize: 17.5 }}>Genel Komisyon &amp; Kâr Marjı Motoru</strong>
                        </div>
                        <button type="button" className="uf-quick-pill" onClick={handleResetMarkup}>
                          <RotateCcw size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          Sıfırla
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label
                            htmlFor="adm-dom-fee"
                            style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}
                          >
                            <span>
                              <Plane size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                              Yurt İçi Uçuş Sabit Hizmet Bedeli (+TL)
                            </span>
                            <strong style={{ color: 'var(--aspan-teal-deep)' }}>
                              +{formatPrice(draft.domesticAddTRY, currency)}
                            </strong>
                          </label>
                          <input
                            id="adm-dom-fee"
                            type="range"
                            min={0}
                            max={800}
                            step={20}
                            value={draft.domesticAddTRY}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, domesticAddTRY: Number(e.target.value) }))
                            }
                            style={{ width: '100%', accentColor: '#00A8B5' }}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="adm-ca-pct"
                            style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}
                          >
                            <span>
                              <Plane size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                              Orta Asya (Almatı / Astana / Taşkent) Kâr (+%)
                            </span>
                            <strong style={{ color: 'var(--aspan-teal-deep)' }}>
                              +%{draft.centralAsiaPercent}
                            </strong>
                          </label>
                          <input
                            id="adm-ca-pct"
                            type="range"
                            min={0}
                            max={25}
                            step={1}
                            value={draft.centralAsiaPercent}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, centralAsiaPercent: Number(e.target.value) }))
                            }
                            style={{ width: '100%', accentColor: '#00A8B5' }}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="adm-intl-pct"
                            style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}
                          >
                            <span>
                              <Plane size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                              Avrupa &amp; Yurt Dışı Uçuş Kâr Oranı (+%)
                            </span>
                            <strong style={{ color: 'var(--aspan-teal-deep)' }}>
                              +%{draft.intlPercent}
                            </strong>
                          </label>
                          <input
                            id="adm-intl-pct"
                            type="range"
                            min={0}
                            max={25}
                            step={1}
                            value={draft.intlPercent}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, intlPercent: Number(e.target.value) }))
                            }
                            style={{ width: '100%', accentColor: '#00A8B5' }}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="adm-hotel-pct"
                            style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}
                          >
                            <span>
                              <Building2 size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                              Otel Konaklama Komisyon Oranı (+%)
                            </span>
                            <strong style={{ color: 'var(--aspan-teal-deep)' }}>
                              +%{draft.hotelPercent}
                            </strong>
                          </label>
                          <input
                            id="adm-hotel-pct"
                            type="range"
                            min={0}
                            max={30}
                            step={1}
                            value={draft.hotelPercent}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, hotelPercent: Number(e.target.value) }))
                            }
                            style={{ width: '100%', accentColor: '#00A8B5' }}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="adm-trf-fee"
                            style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}
                          >
                            <span>
                              <CarTaxiFront size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                              VIP Transfer Sabit Hizmet Bedeli (+TL)
                            </span>
                            <strong style={{ color: 'var(--aspan-teal-deep)' }}>
                              +{formatPrice(draft.transferAddTRY, currency)}
                            </strong>
                          </label>
                          <input
                            id="adm-trf-fee"
                            type="range"
                            min={0}
                            max={1000}
                            step={25}
                            value={draft.transferAddTRY}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, transferAddTRY: Number(e.target.value) }))
                            }
                            style={{ width: '100%', accentColor: '#00A8B5' }}
                          />
                        </div>
                      </div>

                      <button type="submit" className="u4-submit-btn" style={{ width: '100%', marginTop: 18 }}>
                        Kuralları Kaydet ve Tüm Siteye Uygula
                      </button>
                    </form>

                    {/* Live Simulation */}
                    <div className="panel-card" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <TrendingUp size={20} color="#DDA838" />
                        <strong style={{ fontSize: 17 }}>Canlı API Geliş → Müşteri Satış Simülasyonu</strong>
                      </div>
                      {[
                        {
                          route: 'İstanbul (IST) → Antalya (AYT)',
                          cat: 'Yurt İçi',
                          net: sampleDomNet,
                          sale: sampleDomSale,
                        },
                        {
                          route: 'İstanbul (IST) → Almatı (ALA)',
                          cat: 'Orta Asya',
                          net: sampleAlaNet,
                          sale: sampleAlaSale,
                        },
                        {
                          route: 'İstanbul (IST) → Londra (LHR)',
                          cat: 'Avrupa',
                          net: sampleEurNet,
                          sale: sampleEurSale,
                        },
                      ].map((row) => (
                        <div
                          key={row.route}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 14,
                            background: 'var(--aspan-bg-soft)',
                            border: '1px solid var(--aspan-border)',
                            marginBottom: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 10,
                          }}
                        >
                          <div>
                            <span className="pkg-pill">{row.cat}</span>
                            <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>{row.route}</div>
                            <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                              API Net: {formatPrice(row.net, currency)} · Kârınız:{' '}
                              <strong style={{ color: '#059669' }}>
                                +{formatPrice(row.sale - row.net, currency)}
                              </strong>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10.5, color: 'var(--aspan-text-muted)', fontWeight: 700 }}>
                              SİTEDEKİ SATIŞ FİYATI
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--aspan-teal-deep)' }}>
                              {formatPrice(row.sale, currency)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Airline-Specific Rules */}
                  <div className="panel-card">
                    <strong style={{ fontSize: 17, display: 'block', marginBottom: 12 }}>
                      Havayolu &amp; Charter Tedarikçi Bazlı Özel Komisyon Kuralları
                    </strong>
                    {airlineRules.map((ar) => (
                      <div
                        key={ar.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0',
                          borderBottom: '1px solid var(--aspan-border)',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div>
                          <strong>{ar.carrier}</strong> ·{' '}
                          <span style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>{ar.route}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="status-badge ok">{ar.rule}</span>
                          <button
                            type="button"
                            className="drawer-close"
                            onClick={() => setAirlineRules((prev) => prev.filter((x) => x.id !== ar.id))}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newCarrier.trim() || !newRouteRule.trim()) return;
                        setAirlineRules((prev) => [
                          ...prev,
                          {
                            id: `ar-${Date.now()}`,
                            carrier: newCarrier.trim(),
                            route: 'Özel Rota',
                            rule: newRouteRule.trim(),
                            active: true,
                          },
                        ]);
                        setNewCarrier('');
                        setNewRouteRule('');
                        flash('Yeni havayolu komisyon kuralı eklendi.');
                      }}
                      style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr auto', gap: 10, marginTop: 14 }}
                    >
                      <input
                        className="modal-input"
                        placeholder="Havayolu (Örn: FlyArystan / Emirates)"
                        value={newCarrier}
                        onChange={(e) => setNewCarrier(e.target.value)}
                      />
                      <input
                        className="modal-input"
                        placeholder="Kural (Örn: +%8 veya +350 TL)"
                        value={newRouteRule}
                        onChange={(e) => setNewRouteRule(e.target.value)}
                      />
                      <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }}>
                        <Plus size={15} /> Kural Ekle
                      </button>
                    </form>
                  </div>
                </>
              )}

              {/* ==================== MODULE 4: INVENTORY (HOTELS & VIP TRANSFERS) ==================== */}
              {section === 'inventory' && (
                <>
                  <div className="panel-card">
                    <strong style={{ fontSize: 17.5, display: 'block', marginBottom: 12 }}>
                      VIP Havalimanı Transfer Filosu &amp; Sabit Güzergâh Fiyatları
                    </strong>
                    {TRANSFER_DEALS.map((tr) => (
                      <div
                        key={tr.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 0',
                          borderBottom: '1px solid var(--aspan-border)',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <div>
                          <span className="pkg-pill">{tr.city}</span>{' '}
                          <strong>{tr.vehicle}</strong>
                          <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 2 }}>
                            {tr.route} · {tr.capacity} · {tr.baggage}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>Güncel Satış</div>
                          <strong style={{ fontSize: 17, color: 'var(--aspan-teal-deep)' }}>
                            {formatPrice(tr.price + (draft.transferAddTRY - DEFAULT_MARKUP.transferAddTRY), currency)}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="panel-card">
                    <strong style={{ fontSize: 17.5, display: 'block', marginBottom: 12 }}>
                      Vitrin Otelleri &amp; Konaklama Paketleri
                    </strong>
                    {HOTEL_DEALS.map((h) => (
                      <div
                        key={h.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 0',
                          borderBottom: '1px solid var(--aspan-border)',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <div>
                          <span className="pkg-pill">{h.city}</span>{' '}
                          <strong>{h.name}</strong> ({'★'.repeat(h.stars)})
                          <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 2 }}>
                            {h.boardType} · {h.nights} Gece · Puan: {h.rating}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>Komisyon Dahil</div>
                          <strong style={{ fontSize: 17 }}>
                            {formatPrice(
                              Math.round(h.price * (1 + (draft.hotelPercent - DEFAULT_MARKUP.hotelPercent) / 100)),
                              currency
                            )}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ==================== MODULE 5: COUPONS & CAMPAIGNS ==================== */}
              {section === 'coupons' && (
                <div className="panel-card">
                  <strong style={{ fontSize: 18, display: 'block', marginBottom: 14 }}>
                    Kampanya &amp; İndirim Kuponu Yönetimi
                  </strong>

                  {coupons.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid var(--aspan-border)',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div>
                        <span className="uf-airport-code">{c.code}</span>{' '}
                        <span className="pkg-pill">{c.category}</span>{' '}
                        <strong>{c.title}</strong>
                        <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginTop: 2 }}>
                          Geçerlilik: {c.validUntil}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          className={`status-badge ${c.active ? 'ok' : 'warn'}`}
                          style={{ border: 'none', cursor: 'pointer' }}
                          onClick={() => {
                            setCoupons((prev) =>
                              prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x))
                            );
                            flash(`${c.code} kupon durumu güncellendi.`);
                          }}
                        >
                          {c.active ? 'Aktif (Kapat)' : 'Pasif (Aç)'}
                        </button>
                        <button
                          type="button"
                          className="drawer-close"
                          onClick={() => setCoupons((prev) => prev.filter((x) => x.id !== c.id))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newCouponCode.trim() || !newCouponTitle.trim()) return;
                      setCoupons((prev) => [
                        ...prev,
                        {
                          id: `cp-${Date.now()}`,
                          code: newCouponCode.trim().toUpperCase(),
                          title: newCouponTitle.trim(),
                          category: 'Uçak',
                          validUntil: '31 Aralık 2027',
                          active: true,
                        },
                      ]);
                      setNewCouponCode('');
                      setNewCouponTitle('');
                      flash('Yeni indirim kuponu oluşturuldu!');
                    }}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr auto', gap: 10, marginTop: 16 }}
                  >
                    <input
                      className="modal-input"
                      placeholder="Kupon Kodu (Örn: ALMATY500)"
                      value={newCouponCode}
                      onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                    />
                    <input
                      className="modal-input"
                      placeholder="Kampanya Başlığı (Örn: Almatı Uçuşlarında 500 TL İndirim)"
                      value={newCouponTitle}
                      onChange={(e) => setNewCouponTitle(e.target.value)}
                    />
                    <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }}>
                      <Plus size={15} /> Kupon Ekle
                    </button>
                  </form>
                </div>
              )}

              {/* ==================== MODULE 6: B2B AGENCIES & MEMBERS ==================== */}
              {section === 'agents' && (
                <div className="panel-card">
                  <strong style={{ fontSize: 18, display: 'block', marginBottom: 14 }}>
                    B2B Alt Acenteler, Kurumsal Şirketler &amp; Cari Kredi Limitleri
                  </strong>
                  {agencies.map((ag) => (
                    <div
                      key={ag.id}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        border: '1px solid var(--aspan-border)',
                        marginBottom: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <span className="pkg-pill">{ag.type}</span>{' '}
                        <span className="status-badge ok">{ag.status}</span>
                        <div style={{ fontWeight: 800, fontSize: 15.5, marginTop: 4 }}>{ag.name}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                          {ag.contact} · Aspan Mil: <strong>{ag.miles} Mil</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'right', marginRight: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>B2B Cari Kredi Limiti</div>
                          <strong style={{ fontSize: 16, color: 'var(--aspan-teal-deep)' }}>
                            {formatPrice(ag.creditLimitTRY, currency)}
                          </strong>
                        </div>
                        <button
                          type="button"
                          className="uf-quick-pill"
                          onClick={() => {
                            setAgencies((prev) =>
                              prev.map((x) =>
                                x.id === ag.id
                                  ? { ...x, creditLimitTRY: x.creditLimitTRY + 50000, miles: x.miles + 5000 }
                                  : x
                              )
                            );
                            flash(`${ag.name} cari limiti +50.000 TL ve +5.000 Mil artırıldı.`);
                          }}
                        >
                          +50.000 TL Limit &amp; Mil Ekle
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ==================== MODULE 7: SUPPLIER APIS (BURANUS / GDS / POS) ==================== */}
              {section === 'apis' && (
                <div className="panel-card">
                  <strong style={{ fontSize: 18, display: 'block', marginBottom: 6 }}>
                    B2B Tedarikçi API Bağlantıları (Buranus, Amadeus, BookingAgora) &amp; Sanal POS
                  </strong>
                  <p style={{ fontSize: 13, color: 'var(--aspan-text-muted)', marginTop: 0, marginBottom: 16 }}>
                    Acente sözleşmelerinizi tamamladığınızda API anahtarlarını buradan girerek canlı biletlemeye
                    geçebilirsiniz.
                  </p>

                  {apiConnectors.map((api) => (
                    <div
                      key={api.id}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        border: '1px solid var(--aspan-border)',
                        background: 'var(--aspan-bg-soft)',
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShieldCheck size={18} color="#00A8B5" />
                            <strong style={{ fontSize: 15.5 }}>{api.name}</strong>
                            <span className="status-badge ok">{api.mode}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--aspan-text-body)', marginTop: 4 }}>
                            {api.desc}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="uf-quick-pill"
                          onClick={() => flash(`${api.name} bağlantı testi başarılı (Ping: 42ms).`)}
                        >
                          Bağlantıyı Test Et
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, marginTop: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                            API Endpoint URL
                          </label>
                          <input
                            className="modal-input"
                            value={api.endpoint}
                            onChange={(e) => {
                              const val = e.target.value;
                              setApiConnectors((prev) =>
                                prev.map((x) => (x.id === api.id ? { ...x, endpoint: val } : x))
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                            Acente Kodu / API Key
                          </label>
                          <input
                            className="modal-input"
                            value={api.agentCode}
                            onChange={(e) => {
                              const val = e.target.value;
                              setApiConnectors((prev) =>
                                prev.map((x) => (x.id === api.id ? { ...x, agentCode: val } : x))
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
