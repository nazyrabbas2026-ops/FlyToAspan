import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sliders,
  TrendingUp,
  Ticket,
  Tag,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Plane,
  Building2,
  CarTaxiFront,
  ArrowLeft,
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
  KeyRound,
  Copy,
  Ban,
  UserCheck,
  BarChart3,
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
  Organization,
  OrgLedgerEntry,
  StaffPermission,
  UserProfile,
} from '../types';
import { addCalendarDays, toCalendarDate } from '../data/calendarDates';
import { PanelNavigation } from './PanelNavigation';
import { AdminFinanceCrmSection } from './AdminFinanceCrmSection';
import { openBrandedEticketPdf } from '../utils/eticketPdf';
import { api, apiMessage, type AdminCatalog, type AdminCatalogState, type BookingDraft } from '../data/api';

const PERMISSION_OPTIONS: { id: StaffPermission; label: string }[] = [
  { id: 'flights.sell', label: 'Uçak Satışı' },
  { id: 'hotels.sell', label: 'Otel Satışı' },
  { id: 'transfers.sell', label: 'Transfer Satışı' },
  { id: 'tours.sell', label: 'Tur Satışı' },
  { id: 'bookings.view_own', label: 'Kendi Satışlarını Gör' },
  { id: 'bookings.view_org', label: 'Şirket Satışlarını Gör' },
  { id: 'bookings.cancel_request', label: 'İptal Talebi Oluştur' },
  { id: 'bookings.manage', label: 'Doğrudan İptal / İade / Yapıldı' },
  { id: 'flights.manual', label: 'Manuel Uçuş Ekle' },
  { id: 'inventory.manage', label: 'Otel & Transfer Yönet' },
  { id: 'pricing.edit', label: 'Komisyon & XML Fiyat Ayarı' },
  { id: 'fx.manage', label: 'Döviz Kuru Ayarı' },
  { id: 'coupons.manage', label: 'Kupon & Kampanya Yönetimi' },
  { id: 'apis.manage', label: 'API Bağlantı Ayarları' },
  { id: 'team.manage', label: 'Ekip Yönetimi' },
];

const ROLE_PRESETS: { label: string; perms: StaffPermission[] }[] = [
  {
    label: 'Alt Acente / Satış',
    perms: ['flights.sell', 'hotels.sell', 'transfers.sell', 'tours.sell', 'bookings.view_own', 'bookings.cancel_request'],
  },
  {
    label: 'Operasyon Uzmanı',
    perms: ['flights.sell', 'hotels.sell', 'transfers.sell', 'tours.sell', 'bookings.view_org', 'bookings.cancel_request', 'bookings.manage'],
  },
  {
    label: 'Şirket Yöneticisi',
    perms: ['flights.sell', 'hotels.sell', 'transfers.sell', 'tours.sell', 'bookings.view_org', 'bookings.cancel_request', 'bookings.manage', 'inventory.manage', 'flights.manual', 'team.manage'],
  },
];

const MODULE_LABELS: Record<string, string> = {
  flights: 'Uçak',
  hotels: 'Otel',
  transfers: 'Transfer',
  tours: 'Tur',
};

const APPLICANT_TYPE_LABELS: Record<string, string> = {
  agency: 'B2B Alt Acente',
  corporate: 'Kurumsal Şirket',
  sales: 'Satış Temsilcisi',
};

function formatTrDateTime(value?: number | string): string {
  if (!value) return 'Tarih yok';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const datePart = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  const hasTime = typeof value === 'number' || (typeof value === 'string' && value.includes('T'));
  if (!hasTime) return datePart;
  const timePart = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function generateStrongPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  return 'Aspan!' + Array.from(arr, (n) => chars[n % chars.length]).join('').slice(0, 10);
}

interface AdminPanelPageProps {
  lang?: LangCode;
  onSelectLang?: (next: LangCode) => void;
  currency?: CurrencyCode;
  currentUser?: UserProfile | null;
  markup: AdminMarkupConfig;
  onUpdateMarkup: (next: AdminMarkupConfig) => Promise<void>;
  bookings: BookingRecord[];
  onAddBooking: (draft: BookingDraft) => Promise<BookingRecord>;
  onUpdateBookingStatus: (id: string, status: BookingRecord['status']) => Promise<void>;
  onDeleteBooking: (id: string) => Promise<void>;
  onCatalogUpdated?: () => void;
  onLogout: () => void;
  onBackHome: () => void;
}

type AdminSection =
  | 'dashboard'
  | 'bookings'
  | 'finance'
  | 'pricing'
  | 'inventory'
  | 'coupons'
  | 'agents'
  | 'apis';

const ADMIN_SECTIONS = [
  { id: 'dashboard', label: 'Genel bakış', description: 'Kayıt özeti, bekleyen işler ve fiyat bilgileri.', icon: <LayoutDashboard size={18} /> },
  { id: 'bookings', label: 'Rezervasyonlar', description: 'Rezervasyon koduyla arayın, durumları güncelleyin veya rapor alın.', icon: <Ticket size={18} /> },
  { id: 'finance', label: 'Finans & CRM', description: 'Günlük gelir-gider grafikleri, 360° satış/uçuş defteri, ekip liderliği ve CRM takip listesi.', icon: <BarChart3 size={18} /> },
  { id: 'pricing', label: 'Fiyatlandırma', description: 'Hizmet bedellerini ve komisyonları ayarlayıp örnek fiyatları karşılaştırın.', icon: <Sliders size={18} /> },
  { id: 'inventory', label: 'Envanter & Manuel Uçuş', description: 'Otel, VIP transfer ve manuel blok koltuk uçuşlarını yönetin.', icon: <CarTaxiFront size={18} /> },
  { id: 'coupons', label: 'Kampanya ve kuponlar', description: 'Deneme kuponlarını ve paneldeki durumlarını yönetin.', icon: <Tag size={18} /> },
  { id: 'agents', label: 'Bayiler ve üyeler', description: 'Örnek kurumsal hesapları, limitleri ve mil bakiyelerini inceleyin.', icon: <Users size={18} /> },
  { id: 'apis', label: 'Sağlayıcı bağlantıları', description: 'Uçuş, otel ve ödeme bağlantılarının durumunu takip edin.', icon: <Plug size={18} /> },
] satisfies { id: AdminSection; label: string; description: string; icon: React.ReactNode }[];

type BookingSortKey =
  | 'dateDesc'
  | 'dateAsc'
  | 'priceDesc'
  | 'priceAsc'
  | 'paxAsc';

interface StatusVisual {
  label: string;
  desc: string;
  border: string;
  bg: string;
  badgeBg: string;
  badgeColor: string;
  dot: string;
}

const STATUS_VISUALS: Record<BookingRecord['status'], StatusVisual> = {
  Onaylandı: {
    label: 'Onaylandı',
    desc: 'Aktif rezervasyon kayıtları',
    border: '#10B981',
    bg: 'rgba(16, 185, 129, 0.05)',
    badgeBg: 'rgba(16, 185, 129, 0.16)',
    badgeColor: '#047857',
    dot: '#10B981',
  },
  Tamamlandı: {
    label: 'Tamamlandı',
    desc: 'Tamamlandı olarak işaretlenenler',
    border: '#0284C7',
    bg: 'rgba(2, 132, 199, 0.05)',
    badgeBg: 'rgba(2, 132, 199, 0.15)',
    badgeColor: '#0369A1',
    dot: '#0284C7',
  },
  'İptal Talebi': {
    label: 'İptal talebi',
    desc: 'İnceleme bekleyen talepler',
    border: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.07)',
    badgeBg: 'rgba(245, 158, 11, 0.2)',
    badgeColor: '#B45309',
    dot: '#F59E0B',
  },
  'İptal Edildi': {
    label: 'İptal edildi',
    desc: 'İptal olarak işaretlenen kayıtlar',
    border: '#E11D48',
    bg: 'rgba(225, 29, 72, 0.05)',
    badgeBg: 'rgba(225, 29, 72, 0.14)',
    badgeColor: '#BE123C',
    dot: '#E11D48',
  },
  'İade Edildi': {
    label: 'İade edildi',
    desc: 'İade olarak işaretlenen kayıtlar',
    border: '#7C3AED',
    bg: 'rgba(124, 58, 237, 0.05)',
    badgeBg: 'rgba(124, 58, 237, 0.14)',
    badgeColor: '#6D28D9',
    dot: '#7C3AED',
  },
};

const exampleCatalog: AdminCatalog = {
  rules: [
    { id: 'ar-1', carrier: 'Air Astana (KC)', route: 'Türkiye ↔ Kazakistan', rule: '+%7 Komisyon' },
    { id: 'ar-2', carrier: 'Turkish Airlines (TK)', route: 'Tüm Hatlar', rule: '+₺220 Hizmet Bedeli' },
    { id: 'ar-3', carrier: 'Buranus Charter (Corendon / SCAT / Freebird)', route: 'Antalya & Almatı Charter', rule: '+%9 Blok Koltuk Marjı' },
    { id: 'ar-4', carrier: 'Pegasus & AJet (LCC)', route: 'Yurt İçi & Kıbrıs', rule: '+₺160 Sabit Servis' },
  ],
  coupons:
    CAMPAIGNS.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      category: c.category,
      validUntil: c.validUntil,
      active: true,
    })),
  agencies: [
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
  ],
  hotels: HOTEL_DEALS.map((h) => ({
    id: h.id,
    city: h.city,
    name: h.name,
    stars: h.stars,
    boardType: h.boardType,
    nights: h.nights,
    price: h.price,
    active: true,
  })),
  transfers: TRANSFER_DEALS.map((tr) => ({
    id: tr.id,
    city: tr.city,
    vehicle: tr.vehicle,
    route: tr.route,
    capacity: tr.capacity,
    baggage: tr.baggage,
    price: tr.price,
    active: true,
  })),
  tours: [
    { id: 'tour-ala-1', city: 'ALMATI', title: 'Almatı & Shymbulak Kültür Turu', duration: '4 Gece 5 Gün', quota: 14, price: 24900, active: true },
    { id: 'tour-cap-2', city: 'KAPADOKYA', title: 'Kapadokya Mağara Otel & Balon Turu', duration: '2 Gece 3 Gün', quota: 10, price: 9850, active: true },
  ],
  operators: [
    { id: 'op-funsun', operator: 'FUN&SUN (XML)', product: 'Uçak Bileti', markupType: 'NET', markupValue: 0, active: true },
    { id: 'op-kompas', operator: 'Kompas Tour (XML)', product: 'Uçak Bileti', markupType: 'EUR', markupValue: 10, active: true },
    { id: 'op-selfie', operator: 'Selfie Travel (XML)', product: 'Uçak Bileti', markupType: 'EUR', markupValue: 10, active: true },
    { id: 'op-all-tours', operator: 'Tüm Operatörler (XML)', product: 'Tur Paketi', markupType: 'NET', markupValue: 0, active: true },
  ],
  flights: [
    {
      id: 'mf-1',
      airline: 'Air Astana Charter',
      airlineCode: 'KC',
      flightNumber: 'KC918',
      fromCode: 'IST',
      toCode: 'ALA',
      departTime: '09:30',
      arriveTime: '17:00',
      duration: '5s 30dk',
      operator: 'Kompas Tour (XML)',
      baggage: '20 kg Bagaj',
      priceTRY: 6450,
      quota: 12,
      active: true,
    },
  ],
  providers: [
    {
      id: 'prov-funsun',
      name: 'FUN&SUN (SAMO-Tour XML)',
      protocol: 'SAMO XML',
      category: 'Tur Operatörü & Charter',
      apiUrl: 'https://online.funsun.kz/export/default.php?samo_action=api',
      xmlFeedUrl: 'https://online.funsun.kz/export/flights.xml',
      apiKey: '',
      username: 'infinitive_tr',
      password: '',
      agentCode: 'FS-INF-2026',
      docsUrl: 'https://doku.samo.ru/doku.php?id=onlinest:api',
      whitelistIp: '',
      mode: 'Beklemede',
      active: true,
    },
    {
      id: 'prov-kompas',
      name: 'Kompas Tour (SAMO XML)',
      protocol: 'SAMO XML',
      category: 'Tur Operatörü & Charter',
      apiUrl: 'https://online.kompastour.com/export/default.php?samo_action=api',
      xmlFeedUrl: 'https://online.kompastour.com/export/flights.xml',
      apiKey: '',
      username: 'infinitive_kz',
      password: '',
      agentCode: 'KMP-FTA-01',
      docsUrl: 'https://doku.samo.ru/doku.php?id=onlinest:api',
      whitelistIp: '',
      mode: 'Beklemede',
      active: true,
    },
    {
      id: 'prov-selfie',
      name: 'Selfie Travel (XML)',
      protocol: 'XML / SOAP',
      category: 'Tur Operatörü & Charter',
      apiUrl: 'https://online.selfietravel.kz/export/default.php?samo_action=api',
      xmlFeedUrl: '',
      apiKey: '',
      username: '',
      password: '',
      agentCode: 'SLF-FTA-01',
      docsUrl: '',
      whitelistIp: '',
      mode: 'Beklemede',
      active: true,
    },
    {
      id: 'prov-buranus',
      name: 'Buranus B2B & Charter API',
      protocol: 'REST JSON',
      category: 'Uçak & Charter',
      apiUrl: 'https://agent.buranus.com/api/v1',
      xmlFeedUrl: '',
      apiKey: '',
      username: '',
      password: '',
      agentCode: 'INF-6199-TR',
      docsUrl: 'https://agent.buranus.com',
      whitelistIp: '',
      mode: 'Beklemede',
      active: true,
    },
    {
      id: 'prov-amadeus',
      name: 'Amadeus GDS Global Flight API',
      protocol: 'REST JSON',
      category: 'Uçak & GDS',
      apiUrl: 'https://api.amadeus.com/v2/shopping/flight-offers',
      xmlFeedUrl: '',
      apiKey: '',
      username: '',
      password: '',
      agentCode: 'AMA-IST-9021',
      docsUrl: 'https://developers.amadeus.com/self-service',
      whitelistIp: '',
      mode: 'Test / Sandbox',
      active: true,
    },
    {
      id: 'prov-pos',
      name: 'iyzico / PayTR 3D Secure POS',
      protocol: 'POS 3D',
      category: 'Sanal POS',
      apiUrl: 'https://api.iyzipay.com/payment/3dsecure',
      xmlFeedUrl: '',
      apiKey: '',
      username: '',
      password: '',
      agentCode: 'POS-MERCHANT-90531',
      docsUrl: 'https://docs.iyzico.com',
      whitelistIp: '',
      mode: 'Test / Sandbox',
      active: true,
    },
  ],
};

const ADMIN_I18N: Record<'TR' | 'EN' | 'RU', {
  backToSite: string;
  adminEyebrow: string;
  teamEyebrow: string;
  adminTitle: string;
  teamTitle: string;
  addTestBooking: string;
  logout: string;
  navLabel: string;
  sections: Record<AdminSection, { label: string; description: string }>;
  dateQuickLabel: string;
  dateAll: string;
  dateToday: string;
  dateWeek: string;
  dateMonth: string;
  dateUpcoming: string;
  dateReset: string;
  searchLabel: string;
  searchPh: string;
  fromDate: string;
  toDate: string;
  sortBy: string;
  allServices: string;
  statusLabels: Record<BookingRecord['status'], string>;
}> = {
  TR: {
    backToSite: 'Siteye Dön',
    adminEyebrow: 'FLYTOASPAN · MERKEZ YÖNETİM PANELİ',
    teamEyebrow: 'FLYTOASPAN · EKİP PORTALI',
    adminTitle: 'Yönetici paneli',
    teamTitle: 'Ekip & Satış Paneli',
    addTestBooking: 'Deneme rezervasyonu ekle',
    logout: 'Çıkış',
    navLabel: 'Yönetim bölümü',
    sections: {
      dashboard: { label: 'Genel bakış', description: 'Kayıt özeti, bekleyen işler ve fiyat bilgileri.' },
      bookings: { label: 'Rezervasyonlar', description: 'PNR ile arayın, tarih aralığına göre filtreleyin ve durumları güncelleyin.' },
      finance: { label: 'Finans & CRM', description: 'Gelir-gider defteri, CRM teklifleri ve ekip liderliği.' },
      pricing: { label: 'Fiyatlandırma & XML', description: 'Operatör XML kâr kurallarını ve komisyonları yönetin.' },
      inventory: { label: 'Envanter & Manuel Uçuş', description: 'Manuel blok koltuk uçuşları, otel ve VIP transferleri yönetin.' },
      coupons: { label: 'Kampanya ve kuponlar', description: 'Canlı indirim kuponlarını ekleyin, kapatın veya silin.' },
      agents: { label: 'Bayiler ve üyeler', description: 'Alt acente onayları, cari kredi limitleri ve yetki matrisi.' },
      apis: { label: 'Sağlayıcı bağlantıları', description: 'Buranus, Amadeus, otel ve ödeme API durumları.' },
    },
    dateQuickLabel: 'Hızlı Tarih Filtresi:',
    dateAll: 'Tümü',
    dateToday: 'Bugün',
    dateWeek: 'Bu Hafta',
    dateMonth: 'Bu Ay',
    dateUpcoming: 'Gelecek Uçuşlar',
    dateReset: 'Tarihi Sıfırla',
    searchLabel: 'PNR / Yolcu / Rota Ara',
    searchPh: 'Rezervasyon kodu, yolcu veya rota',
    fromDate: 'Başlangıç Tarihi',
    toDate: 'Bitiş Tarihi',
    sortBy: 'Sıralama Ölçütü',
    allServices: 'Tüm Hizmetler',
    statusLabels: {
      Onaylandı: 'Onaylandı',
      Tamamlandı: 'Tamamlandı',
      'İptal Talebi': 'İptal Talebi',
      'İptal Edildi': 'İptal Edildi',
      'İade Edildi': 'İade Edildi',
    },
  },
  EN: {
    backToSite: 'Back to Site',
    adminEyebrow: 'FLYTOASPAN · CENTRAL OPERATIONS PORTAL',
    teamEyebrow: 'FLYTOASPAN · SUB-AGENT PORTAL',
    adminTitle: 'Admin Panel',
    teamTitle: 'Team & Sales Panel',
    addTestBooking: 'Add Test Booking',
    logout: 'Sign Out',
    navLabel: 'Management Menu',
    sections: {
      dashboard: { label: 'Overview', description: 'Sales summary, pending items, FX rates and quick actions.' },
      bookings: { label: 'Bookings', description: 'Search by PNR, filter by date range, update status or download PDF.' },
      finance: { label: 'Finance & CRM', description: 'Income/expense ledger, CRM quotes and sales analytics.' },
      pricing: { label: 'Pricing & XML', description: 'Manage operator XML markup rules (FUN&SUN, Kompas, Selfie) and margins.' },
      inventory: { label: 'Inventory & Flights', description: 'Manage manual charter block-seat flights, hotels and VIP transfers.' },
      coupons: { label: 'Campaigns & Coupons', description: 'Create, toggle or delete live promo codes synced to checkout.' },
      agents: { label: 'Agencies & Team', description: 'B2B agency approvals, credit limits and granular RBAC permissions.' },
      apis: { label: 'Supplier APIs', description: 'Monitor Buranus, Amadeus, hotel and payment gateway connections.' },
    },
    dateQuickLabel: 'Quick Date Filter:',
    dateAll: 'All Dates',
    dateToday: 'Today',
    dateWeek: 'This Week',
    dateMonth: 'This Month',
    dateUpcoming: 'Upcoming Flights',
    dateReset: 'Reset Dates',
    searchLabel: 'Search PNR / Passenger / Route',
    searchPh: 'Booking code, passenger or route',
    fromDate: 'From Date',
    toDate: 'To Date',
    sortBy: 'Sort By',
    allServices: 'All Services',
    statusLabels: {
      Onaylandı: 'Confirmed',
      Tamamlandı: 'Completed',
      'İptal Talebi': 'Cancel Request',
      'İptal Edildi': 'Cancelled',
      'İade Edildi': 'Refunded',
    },
  },
  RU: {
    backToSite: 'На сайт',
    adminEyebrow: 'FLYTOASPAN · ЦЕНТР УПРАВЛЕНИЯ И ОПЕРАЦИЙ',
    teamEyebrow: 'FLYTOASPAN · ПОРТАЛ СУБАГЕНТА',
    adminTitle: 'Панель управления',
    teamTitle: 'Панель продаж',
    addTestBooking: 'Тестовая бронь',
    logout: 'Выход',
    navLabel: 'Разделы панели',
    sections: {
      dashboard: { label: 'Обзор', description: 'Сводка продаж, статусы, курсы валют и быстрые действия.' },
      bookings: { label: 'Бронирования', description: 'Поиск по PNR, фильтр по датам, смена статуса и PDF билет.' },
      finance: { label: 'Финансы и CRM', description: 'Учет доходов/расходов, CRM предложения и аналитика.' },
      pricing: { label: 'Ценообразование XML', description: 'Наценки операторов XML (FUN&SUN, Kompas, Selfie) и комиссии.' },
      inventory: { label: 'Инвентарь и Рейсы', description: 'Ручные чартерные рейсы (блок мест), отели и VIP трансферы.' },
      coupons: { label: 'Акции и купоны', description: 'Управление активными промокодами в реальном времени.' },
      agents: { label: 'Агентства и команда', description: 'Заявки B2B агентств, кредитные лимиты и права доступа.' },
      apis: { label: 'API поставщиков', description: 'Статус подключений Buranus, Amadeus, отелей и оплаты.' },
    },
    dateQuickLabel: 'Быстрый фильтр дат:',
    dateAll: 'Все даты',
    dateToday: 'Сегодня',
    dateWeek: 'Эта неделя',
    dateMonth: 'Этот месяц',
    dateUpcoming: 'Предстоящие',
    dateReset: 'Сбросить даты',
    searchLabel: 'Поиск PNR / Пассажир / Маршрут',
    searchPh: 'Код брони, пассажир или маршрут',
    fromDate: 'Дата с',
    toDate: 'Дата по',
    sortBy: 'Сортировка',
    allServices: 'Все услуги',
    statusLabels: {
      Onaylandı: 'Подтверждено',
      Tamamlandı: 'Завершено',
      'İptal Talebi': 'Запрос отмены',
      'İptal Edildi': 'Отменено',
      'İade Edildi': 'Возвращено',
    },
  },
};

export const AdminPanelPage: React.FC<AdminPanelPageProps> = ({
  lang = 'TR',
  onSelectLang,
  currency = 'TRY',
  currentUser = null,
  markup,
  onUpdateMarkup,
  bookings,
  onAddBooking,
  onUpdateBookingStatus,
  onDeleteBooking,
  onCatalogUpdated,
  onLogout,
  onBackHome,
}) => {
  const [localLang, setLocalLang] = useState<'TR' | 'EN' | 'RU'>(lang === 'EN' || lang === 'RU' ? lang : 'TR');
  const activePanelLang: 'TR' | 'EN' | 'RU' = onSelectLang ? (lang === 'EN' || lang === 'RU' ? lang : 'TR') : localLang;
  const setPanelLang = (next: 'TR' | 'EN' | 'RU') => {
    setLocalLang(next);
    onSelectLang?.(next);
  };
  const ui = ADMIN_I18N[activePanelLang];

  const isSuperAdmin = !currentUser || currentUser.role === 'admin';
  const userPerms = currentUser?.permissions ?? [];
  const canSellFlight = isSuperAdmin || userPerms.includes('flights.sell');
  const canSellHotel = isSuperAdmin || userPerms.includes('hotels.sell');
  const canSellTransfer = isSuperAdmin || userPerms.includes('transfers.sell');
  const canSellTour = isSuperAdmin || userPerms.includes('tours.sell');
  const canSellAny = canSellFlight || canSellHotel || canSellTransfer || canSellTour;
  const canManageBookings = isSuperAdmin || userPerms.includes('bookings.manage');
  const canCancelRequest = isSuperAdmin || canManageBookings || userPerms.includes('bookings.cancel_request');
  const canEditFx = isSuperAdmin || userPerms.includes('fx.manage');
  const canEditPricing = isSuperAdmin || userPerms.includes('pricing.edit');
  const canManageCoupons = isSuperAdmin || userPerms.includes('coupons.manage');
  const canManageApis = isSuperAdmin || userPerms.includes('apis.manage');
  const canManageManualFlights = isSuperAdmin || userPerms.includes('flights.manual');
  const canManageHotelTransfer = isSuperAdmin || userPerms.includes('inventory.manage');
  const canManageInventory = canManageManualFlights || canManageHotelTransfer;
  const canManageTeam = isSuperAdmin || userPerms.includes('team.manage');
  const visibleSections = useMemo(
    () =>
      ADMIN_SECTIONS.filter((item) => {
        if (isSuperAdmin) return true;
        if (item.id === 'dashboard') return true;
        if (item.id === 'bookings') {
          return userPerms.some((p) => p.startsWith('bookings.') || p.endsWith('.sell'));
        }
        if (item.id === 'pricing') return canEditPricing;
        if (item.id === 'inventory') return canManageInventory;
        if (item.id === 'coupons') return canManageCoupons;
        if (item.id === 'agents') return canManageTeam;
        if (item.id === 'apis') return canManageApis;
        return false;
      }),
    [isSuperAdmin, userPerms, canEditPricing, canManageInventory, canManageCoupons, canManageTeam, canManageApis]
  );

  const [section, setSection] = useState<AdminSection>('dashboard');
  const [draft, setDraft] = useState<AdminMarkupConfig>(markup);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<AdminCatalogState | null>(null);
  const airlineRules = catalog?.rules?.items ?? exampleCatalog.rules;
  const operatorRules = catalog?.operators?.items ?? exampleCatalog.operators;
  const manualFlights = catalog?.flights?.items ?? exampleCatalog.flights;
  const coupons = catalog?.coupons?.items ?? exampleCatalog.coupons;
  const managedHotels = catalog?.hotels?.items ?? exampleCatalog.hotels;
  const managedTransfers = catalog?.transfers?.items ?? exampleCatalog.transfers;
  const managedProviders = catalog?.providers?.items ?? exampleCatalog.providers;
  const catalogWritable = catalog !== null && !busy;

  // Inline manual price editing for Operator XML rules
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editOpType, setEditOpType] = useState<'NET' | 'EUR' | 'TRY' | 'PERCENT'>('EUR');
  const [editOpVal, setEditOpVal] = useState('10');

  // Supplier XML / API Hub state
  const providerFormRef = useRef<HTMLDivElement | null>(null);
  const [serverInfo, setServerInfo] = useState<{ outboundIp: string; host: string; protocol: string } | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [providerTestResults, setProviderTestResults] = useState<Record<string, { ok: boolean; message: string; testing?: boolean }>>({});
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [provName, setProvName] = useState('');
  const [provProtocol, setProvProtocol] = useState('SAMO XML');
  const [provCategory, setProvCategory] = useState('Tur Operatörü & Charter');
  const [provMode, setProvMode] = useState('Test / Sandbox');
  const [provApiUrl, setProvApiUrl] = useState('');
  const [provXmlFeedUrl, setProvXmlFeedUrl] = useState('');
  const [provApiKey, setProvApiKey] = useState('');
  const [provUsername, setProvUsername] = useState('');
  const [provPassword, setProvPassword] = useState('');
  const [provAgentCode, setProvAgentCode] = useState('');
  const [provDocsUrl, setProvDocsUrl] = useState('');
  const [provWhitelistIp, setProvWhitelistIp] = useState('');

  // New Operator XML Pricing rule state
  const [newOpName, setNewOpName] = useState('');
  const [newOpProduct, setNewOpProduct] = useState('Uçak Bileti');
  const [newOpMarkupType, setNewOpMarkupType] = useState<'NET' | 'EUR' | 'TRY' | 'PERCENT'>('EUR');
  const [newOpMarkupVal, setNewOpMarkupVal] = useState('10');
  const [newCouponCategory, setNewCouponCategory] = useState<'Uçak' | 'Otel' | 'Transfer' | 'Tur'>('Uçak');
  const [newCouponValidUntil, setNewCouponValidUntil] = useState('31 Aralık 2027');
  const [pendingCatalogDelete, setPendingCatalogDelete] = useState<{ section: keyof AdminCatalog; id: string; label: string } | null>(null);

  // New Manual Flight form state
  const [mfAirline, setMfAirline] = useState('Air Astana');
  const [mfCode, setMfCode] = useState('KC');
  const [mfNumber, setMfNumber] = useState('KC920');
  const [mfFrom, setMfFrom] = useState('IST');
  const [mfTo, setMfTo] = useState('ALA');
  const [mfDate, setMfDate] = useState('');
  const [mfDep, setMfDep] = useState('10:30');
  const [mfArr, setMfArr] = useState('18:00');
  const [mfOperator, setMfOperator] = useState('Kompas Tour (XML)');
  const [mfBaggage, setMfBaggage] = useState('20 kg Bagaj');
  const [mfCurrency, setMfCurrency] = useState<'EUR' | 'USD' | 'TRY'>('EUR');
  const [mfPrice, setMfPrice] = useState('150');
  const [mfQuota, setMfQuota] = useState('10');
  const [fxSnapshot, setFxSnapshot] = useState(() => getLiveRatesSnapshot());
  const [fxLoading, setFxLoading] = useState(false);
  const [fxManualMode, setFxManualMode] = useState(false);
  const [fxUsdInput, setFxUsdInput] = useState(() => (1 / getLiveRatesSnapshot().rates.USD).toFixed(2));
  const [fxEurInput, setFxEurInput] = useState(() => (1 / getLiveRatesSnapshot().rates.EUR).toFixed(2));
  const [fxKztInput, setFxKztInput] = useState(() => getLiveRatesSnapshot().rates.KZT.toFixed(2));
  const [fxRubInput, setFxRubInput] = useState(() => getLiveRatesSnapshot().rates.RUB.toFixed(2));

  // Real SQLite registered users & SaaS Organizations
  const [siteUsers, setSiteUsers] = useState<UserProfile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [approvalDrafts, setApprovalDrafts] = useState<
    Record<string, { password: string; organizationId: string; permissions: StaffPermission[] }>
  >({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPermsDraft, setEditPermsDraft] = useState<StaffPermission[]>([]);
  const [agentsTab, setAgentsTab] = useState<'pending' | 'users' | 'orgs'>('pending');
  const [agentsSearch, setAgentsSearch] = useState('');
  const [openLedgerOrgId, setOpenLedgerOrgId] = useState<string | null>(null);
  const [orgLedgerEntries, setOrgLedgerEntries] = useState<OrgLedgerEntry[]>([]);
  const [payAmountInput, setPayAmountInput] = useState('25000');
  const [payDescInput, setPayDescInput] = useState('Havale / EFT Cari Tahsilat');
  const [editingCariOrgId, setEditingCariOrgId] = useState<string | null>(null);
  const [cariLimitDraft, setCariLimitDraft] = useState('50000');

  // Module 4: Hotel & Transfer new item forms
  const [newTrCity, setNewTrCity] = useState('');
  const [newTrVehicle, setNewTrVehicle] = useState('');
  const [newTrRoute, setNewTrRoute] = useState('');
  const [newTrPrice, setNewTrPrice] = useState('1750');
  const [newHotelCity, setNewHotelCity] = useState('');
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelPrice, setNewHotelPrice] = useState('3200');

  // Module 6: New SaaS Organization form
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState<'agency' | 'corporate' | 'internal'>('agency');
  const [newOrgLimit, setNewOrgLimit] = useState('0');
  const [newOrgModules, setNewOrgModules] = useState<string[]>(['flights', 'hotels', 'transfers']);

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
  const [manSurname, setManSurname] = useState('');
  const [manDate, setManDate] = useState(() => addCalendarDays(toCalendarDate(new Date()), 15));
  const [manPrice, setManPrice] = useState('6890');
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null);

  // Module 3: Airline-Specific Markup Rules
  const [newCarrier, setNewCarrier] = useState('');
  const [newRouteRule, setNewRouteRule] = useState('');

  // Module 5: Coupons Management
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponTitle, setNewCouponTitle] = useState('');

  // Module 6: B2B Agencies & Members Management

  useEffect(() => {
    const controller = new AbortController();
    api.adminCatalog(controller.signal)
      .then(({ catalog }) => { if (!controller.signal.aborted) setCatalog(catalog); })
      .catch(() => { /* staff without catalog access */ });
    if (canManageApis) {
      api.adminServerInfo(controller.signal)
        .then((info) => {
          if (!controller.signal.aborted) {
            setServerInfo(info);
            setProvWhitelistIp((prev) => prev || (info.outboundIp.includes('.') ? info.outboundIp : ''));
          }
        })
        .catch(() => { /* ignore */ });
    }
    if (canManageTeam) {
      api.adminUsers(controller.signal)
        .then(({ users }) => { if (!controller.signal.aborted) setSiteUsers(users); })
        .catch(() => { /* ignore if not ready */ });
      api.adminOrganizations(controller.signal)
        .then(({ organizations: orgs }) => { if (!controller.signal.aborted) setOrganizations(orgs); })
        .catch(() => { /* ignore if not ready */ });
    }
    const refreshBadges = () => {
      if (!canManageTeam || document.visibilityState !== 'visible') return;
      api.adminUsers(controller.signal)
        .then(({ users }) => { if (!controller.signal.aborted) setSiteUsers(users); })
        .catch(() => { /* ignore transient network blip */ });
    };
    const pollId = canManageTeam ? window.setInterval(refreshBadges, 15_000) : null;
    return () => {
      controller.abort();
      if (pollId !== null) window.clearInterval(pollId);
    };
  }, [canManageTeam, canManageApis]);

  const pendingUsers = useMemo(
    () => siteUsers.filter((u) => u.status === 'pending'),
    [siteUsers]
  );
  const managedUsers = useMemo(
    () => siteUsers.filter((u) => u.status !== 'pending'),
    [siteUsers]
  );
  const activeUsersCount = useMemo(
    () => siteUsers.filter((u) => (u.status || 'active') === 'active').length,
    [siteUsers]
  );
  const suspendedUsersCount = useMemo(
    () => siteUsers.filter((u) => u.status === 'suspended').length,
    [siteUsers]
  );
  const last7DaysActivity = useMemo(() => {
    const days: { key: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      const label = i === 0 ? 'Bugün' : dt.toLocaleDateString('tr-TR', { weekday: 'short' });
      days.push({ key, label, count: 0 });
    }
    const dayMap = new Map(days.map((d) => [d.key, d]));
    siteUsers.forEach((u) => {
      const key = u.registeredAt ? new Date(u.registeredAt).toISOString().slice(0, 10) : u.createdAt?.slice(0, 10);
      const hit = key ? dayMap.get(key) : undefined;
      if (hit) hit.count += 1;
    });
    bookings.forEach((b) => {
      const key = b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : b.date?.slice(0, 10);
      const hit = key ? dayMap.get(key) : undefined;
      if (hit) hit.count += 1;
    });
    return days;
  }, [siteUsers, bookings]);

  const getApprovalDraft = (u: UserProfile) => {
    if (approvalDrafts[u.id]) return approvalDrafts[u.id];
    const requestedPerms: StaffPermission[] = [];
    if (u.requestedModules?.length) {
      if (u.requestedModules.includes('flights')) requestedPerms.push('flights.sell');
      if (u.requestedModules.includes('hotels')) requestedPerms.push('hotels.sell');
      if (u.requestedModules.includes('transfers')) requestedPerms.push('transfers.sell');
      if (u.requestedModules.includes('tours')) requestedPerms.push('tours.sell');
      requestedPerms.push('bookings.view_own');
    } else {
      requestedPerms.push('flights.sell', 'hotels.sell', 'transfers.sell', 'bookings.view_own');
    }
    return {
      password: '',
      organizationId: '',
      permissions: requestedPerms,
    };
  };

  const patchApprovalDraft = (
    u: UserProfile,
    patch: Partial<{ password: string; organizationId: string; permissions: StaffPermission[] }>
  ) => {
    setApprovalDrafts((prev) => ({
      ...prev,
      [u.id]: { ...getApprovalDraft(u), ...patch },
    }));
  };

  useEffect(() => {
    refreshLiveExchangeRates().then((res) => {
      setFxSnapshot(res);
      setFxUsdInput((1 / res.rates.USD).toFixed(2));
      setFxEurInput((1 / res.rates.EUR).toFixed(2));
      setFxKztInput(res.rates.KZT.toFixed(2));
      setFxRubInput(res.rates.RUB.toFixed(2));
    });
  }, []);

  const toastTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  const flash = (msg: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setSavedToast(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setSavedToast(null);
      toastTimerRef.current = null;
    }, 3500);
  };

  const handleRefreshRates = async () => {
    setFxLoading(true);
    const res = await refreshLiveExchangeRates();
    setFxSnapshot(res);
    setFxUsdInput((1 / res.rates.USD).toFixed(2));
    setFxEurInput((1 / res.rates.EUR).toFixed(2));
    setFxKztInput(res.rates.KZT.toFixed(2));
    setFxRubInput(res.rates.RUB.toFixed(2));
    setFxLoading(false);
    flash('Kur tablosu yenilendi.');
  };

  const handleSaveManualFx = async (e: React.FormEvent) => {
    e.preventDefault();
    setFxLoading(true);
    setActionError('');
    try {
      await api.updateFx({
        usdTry: Number(fxUsdInput),
        eurTry: Number(fxEurInput),
        tryKzt: Number(fxKztInput),
        tryRub: Number(fxRubInput),
      });
      const res = await refreshLiveExchangeRates();
      setFxSnapshot(res);
      setFxManualMode(true);
      flash('Manuel döviz kurları kaydedildi ve tüm sitede aktif edildi.');
    } catch (error) {
      setActionError(apiMessage(error));
    } finally {
      setFxLoading(false);
    }
  };

  const handleResetFxToLive = async () => {
    setFxLoading(true);
    setActionError('');
    try {
      await api.resetFx();
      const res = await refreshLiveExchangeRates();
      setFxSnapshot(res);
      setFxUsdInput((1 / res.rates.USD).toFixed(2));
      setFxEurInput((1 / res.rates.EUR).toFixed(2));
      setFxKztInput(res.rates.KZT.toFixed(2));
      setFxRubInput(res.rates.RUB.toFixed(2));
      setFxManualMode(false);
      flash('Otomatik canlı merkez kurlarına geri dönüldü.');
    } catch (error) {
      setActionError(apiMessage(error));
    } finally {
      setFxLoading(false);
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

  const currentSectionBase = ADMIN_SECTIONS.find(({ id }) => id === section)!;
  const currentSection = {
    ...currentSectionBase,
    label: ui.sections[section].label,
    description: ui.sections[section].description,
  };

  const applyDatePreset = (preset: 'all' | 'today' | 'week' | 'month' | 'upcoming') => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    if (preset === 'today') {
      const t = fmt(now);
      setDateFrom(t);
      setDateTo(t);
      return;
    }
    if (preset === 'week') {
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      setDateFrom(fmt(now));
      setDateTo(fmt(end));
      return;
    }
    if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(fmt(start));
      setDateTo(fmt(end));
      return;
    }
    setDateFrom(fmt(now));
    setDateTo('');
  };

  const resetBookingFilters = () => {
    setSearchQ('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setSortBy('dateDesc');
  };

  const openBookings = (status: BookingRecord['status'] | 'ALL' = 'ALL', manual = false) => {
    resetBookingFilters();
    setStatusFilter(status);
    setShowManualForm(manual);
    setSection('bookings');
  };

  const sampleDomNet = 1460;
  const sampleDomSale = sampleDomNet + draft.domesticAddTRY;
  const sampleAlaNet = 6345;
  const sampleAlaSale = Math.round(sampleAlaNet * (1 + draft.centralAsiaPercent / 100));
  const sampleEurNet = 5220;
  const sampleEurSale = Math.round(sampleEurNet * (1 + draft.intlPercent / 100));

  const runAction = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (error) {
      setActionError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const saveCatalog = <Section extends keyof AdminCatalog>(
    section: Section,
    items: AdminCatalog[Section],
    message: string,
    afterSave?: () => void,
  ) => {
    if (!catalogWritable || !catalog) return;
    void runAction(async () => {
      const { entry } = await api.updateAdminCatalog(section, catalog[section]?.revision ?? 0, items);
      setCatalog((current) => ({ ...current, [section]: entry }));
      setPendingCatalogDelete(null);
      onCatalogUpdated?.();
      afterSave?.();
      flash(message);
    });
  };

  const saveMarkup = (next: AdminMarkupConfig) => runAction(async () => {
    await onUpdateMarkup(next);
    setDraft(next);
    flash('Deneme fiyat kuralları sunucuya kaydedildi.');
  });

  const handleSaveMarkup = (event: React.FormEvent) => {
    event.preventDefault();
    void saveMarkup(draft);
  };

  const handleResetMarkup = () => void saveMarkup(DEFAULT_MARKUP);

  const handleCreateManualBooking = (event: React.FormEvent) => {
    event.preventDefault();
    void runAction(async () => {
      const booking = await onAddBooking({
        type: manType,
        title: manTitle.trim(),
        subtitle: manSubtitle.trim() || 'Manuel deneme rezervasyonu',
        date: manDate,
        passenger: manPax.trim(),
        lookupSurname: manSurname,
        price: Number(manPrice),
      });
      setManPax('');
      setManSurname('');
      setShowManualForm(false);
      flash('Deneme rezervasyonu kaydedildi. Kod: ' + booking.pnr);
    });
  };

  const handleExportCsv = () => {
    const headers = ['PNR', 'E-Bilet', 'Tip', 'XML_Kaynagi', 'Guzergah', 'Detay', 'Tarih', 'Yolcu', 'XML_Alis_TRY', 'Satis_TRY', 'Net_Kar_TRY', 'Durum'];
    const rows = filteredBookings.map((b) => [
      b.pnr,
      b.eticketNumber || '-',
      b.type,
      `"${b.providerSource || (b.type === 'Otel' ? 'BookingAgora Hotel XML' : b.type === 'Transfer' ? 'Buranus VIP Transfer XML' : 'Amadeus GDS (XML)')}"`,
      `"${b.title}"`,
      `"${b.subtitle}"`,
      b.date,
      `"${b.passenger}"`,
      b.netCostTRY ?? '',
      b.price,
      b.profitTRY ?? (b.netCostTRY !== undefined ? Math.max(0, b.price - b.netCostTRY) : ''),
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

  return (
    <>
      <div className="inner-hero panel-hero">
        <div className="container">
          <div className="panel-hero-row">
            <div>
              <button type="button" className="inner-back-btn" onClick={onBackHome}>
                <ArrowLeft size={15} />
                {ui.backToSite}
              </button>
              <div className="section-eyebrow on-dark">
                {isSuperAdmin ? ui.adminEyebrow : `${ui.teamEyebrow}${currentUser?.companyName ? ` · ${currentUser.companyName}` : ''}`}
              </div>
              <h1 className="inner-h1">{isSuperAdmin ? ui.adminTitle : ui.teamTitle}</h1>
            </div>

            <div className="panel-actions">
              <div className="adm-lang-switch" role="group" aria-label="Panel Language">
                {(['TR', 'EN', 'RU'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`adm-lang-btn ${activePanelLang === code ? 'active' : ''}`}
                    onClick={() => setPanelLang(code)}
                  >
                    {code}
                  </button>
                ))}
              </div>
              {canSellAny && (
                <button
                  type="button"
                  className="btn-gold-nav"
                  onClick={() => openBookings('ALL', true)}
                >
                  <Plus size={16} />
                  {ui.addTestBooking}
                </button>
              )}
              <button
                type="button"
                className="btn-logout-nav"
                onClick={onLogout}
              >
                <LogOut size={15} />
                {ui.logout}
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="results-workspace panel-workspace">
        <div className="container">
          {actionError && <p className="form-action-error" role="alert">{actionError}</p>}
          {savedToast && (
            <div role="status"
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
            <PanelNavigation
              label={ui.navLabel}
              current={section}
              items={visibleSections.map((item) => ({
                ...item,
                label: ui.sections[item.id].label,
                description: ui.sections[item.id].description,
                count:
                  item.id === 'bookings'
                    ? bookings.length
                    : item.id === 'agents' && pendingUsers.length > 0
                      ? pendingUsers.length
                      : undefined,
              }))}
              onSelect={setSection}
            />

            <div className="panel-content">
              <header className="panel-section-heading">
                <span className="panel-section-icon">{currentSection.icon}</span>
                <div>
                  <h2>{currentSection.label}</h2>
                  <p>{currentSection.description}</p>
                </div>
              </header>
              {/* ==================== MODULE 1: DASHBOARD ==================== */}
              {section === 'dashboard' && (
                <>
                  <div className="panel-highlight">
                    <div className="panel-highlight-main">
                      <span className="panel-section-icon"><Ticket size={20} /></span>
                      <div>
                        <h3>İşlem sırası</h3>
                        <p>{countByStatus['İptal Talebi'] > 0
                          ? `${countByStatus['İptal Talebi']} iptal veya değişiklik talebi bekliyor.`
                          : 'Bekleyen iptal veya değişiklik talebi yok.'}</p>
                      </div>
                    </div>
                    <div className="panel-actions">
                      <button type="button" className="uf-quick-pill" onClick={() => openBookings('İptal Talebi')}>
                        İptal taleplerini aç
                      </button>
                      <button type="button" className="uf-quick-pill" onClick={() => openBookings()}>
                        Tüm rezervasyonlar
                      </button>
                    </div>
                  </div>

                  <div className="panel-stat-grid">
                    <div className="panel-stat-card">
                      <div className="filter-label">Rezervasyon toplamı</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--aspan-text)' }}>
                        {formatPrice(totalRevenueTRY, currency)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        Onaylanan ve tamamlanan demo kayıtları
                      </div>
                    </div>

                    <div className="panel-stat-card">
                      <div className="filter-label">Tahmini komisyon</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>
                        +{formatPrice(estimatedProfitTRY, currency)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        Örnek hesap · %9,5 oran
                      </div>
                    </div>

                    <div className="panel-stat-card">
                      <div className="filter-label">Onaylanan rezervasyon</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--aspan-teal-deep)' }}>
                        {countByStatus.Onaylandı}
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
                        Rezervasyon durumları
                      </strong>
                      <span style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        Duruma göre kayıtları açın
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 185px), 1fr))',
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
                            onClick={() => openBookings(st)}
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

                  {/* Live & Manual Currency Exchange Bar — STRICTLY SUPER ADMIN / fx.manage ONLY */}
                  {canEditFx && (
                  <form className="panel-card" onSubmit={handleSaveManualFx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Globe size={20} color="#00A8B5" />
                        <div>
                          <strong style={{ fontSize: 16 }}>
                            Döviz Kurları &amp; Manuel Kur Ayarı
                          </strong>
                          <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                            {fxManualMode ? 'Manuel yönetici kuru aktif' : fxSnapshot.updatedAt ? `Canlı kur · Son güncelleme: ${fxSnapshot.updatedAt}` : 'Canlı kur'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="uf-quick-pill"
                          onClick={handleRefreshRates}
                          disabled={fxLoading}
                        >
                          <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                          {fxLoading ? 'Güncelleniyor...' : 'Canlı Kuru Çek'}
                        </button>
                        <button
                          type="button"
                          className="uf-quick-pill"
                          onClick={handleResetFxToLive}
                          disabled={fxLoading}
                        >
                          Otomatiğe Dön
                        </button>
                        <button type="submit" className="btn-gold-nav" style={{ height: 34, fontSize: 12 }} disabled={fxLoading}>
                          Manuel Kuru Kaydet
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 165px), 1fr))',
                        gap: 10,
                        marginTop: 14,
                      }}
                    >
                      <label style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)', display: 'block' }}>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)', fontWeight: 700, marginBottom: 4 }}>1 USD ($) = ₺ TRY</div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="modal-input"
                          style={{ height: 36, fontWeight: 800 }}
                          value={fxUsdInput}
                          onChange={(e) => setFxUsdInput(e.target.value)}
                        />
                      </label>
                      <label style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)', display: 'block' }}>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)', fontWeight: 700, marginBottom: 4 }}>1 EUR (€) = ₺ TRY</div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="modal-input"
                          style={{ height: 36, fontWeight: 800 }}
                          value={fxEurInput}
                          onChange={(e) => setFxEurInput(e.target.value)}
                        />
                      </label>
                      <label style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)', display: 'block' }}>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)', fontWeight: 700, marginBottom: 4 }}>1 TRY (₺) = ₸ KZT</div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="modal-input"
                          style={{ height: 36, fontWeight: 800 }}
                          value={fxKztInput}
                          onChange={(e) => setFxKztInput(e.target.value)}
                        />
                      </label>
                      <label style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)', display: 'block' }}>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)', fontWeight: 700, marginBottom: 4 }}>1 TRY (₺) = ₽ RUB</div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="modal-input"
                          style={{ height: 36, fontWeight: 800 }}
                          value={fxRubInput}
                          onChange={(e) => setFxRubInput(e.target.value)}
                        />
                      </label>
                    </div>
                  </form>
                  )}

                  {/* Quick Jump Cards — STRICTLY FILTERED BY PERMISSIONS */}
                  <div className="panel-card">
                    <strong style={{ fontSize: 16.5, display: 'block', marginBottom: 12 }}>
                      {isSuperAdmin ? 'Hızlı Yönetici İşlemleri' : 'Hızlı İşlemler'}
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 12 }}>
                      <button
                        type="button"
                        className="drawer-link"
                        onClick={() => setSection('bookings')}
                      >
                        <span>🎫 PNR &amp; Rezervasyonlar</span>
                        <span>→</span>
                      </button>
                      {canEditPricing && (
                        <button
                          type="button"
                          className="drawer-link"
                          onClick={() => setSection('pricing')}
                        >
                          <span>💰 Komisyon &amp; XML Fiyat Ayarla</span>
                          <span>→</span>
                        </button>
                      )}
                      {canManageCoupons && (
                        <button
                          type="button"
                          className="drawer-link"
                          onClick={() => setSection('coupons')}
                        >
                          <span>🎁 Yeni İndirim Kuponu Aç</span>
                          <span>→</span>
                        </button>
                      )}
                      {canManageApis && (
                        <button
                          type="button"
                          className="drawer-link"
                          onClick={() => setSection('apis')}
                        >
                          <span>🔌 Buranus &amp; GDS API Ayarı</span>
                          <span>→</span>
                        </button>
                      )}
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
                          Kayıtları ara ve filtrele
                        </strong>
                        <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                          PNR, yolcu adı, hizmet tipi ve tarih aralığına göre süzebilir; fiyata veya tarihe göre sıralayabilirsiniz.
                        </div>
                      </div>
                      <div className="panel-actions">
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
                          {showManualForm ? 'Formu Kapat' : 'Deneme kaydı ekle'}
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))', gap: 10, marginBottom: 12 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                              Hizmet Tipi
                            </label>
                            <select
                              className="modal-input"
                              value={manType}
                              onChange={(e) => setManType(e.target.value as 'Uçak' | 'Otel' | 'Transfer')}
                            >
                              {canSellFlight && <option value="Uçak">✈️ Uçak Bileti</option>}
                              {canSellHotel && <option value="Otel">🏨 Otel Konaklama</option>}
                              {canSellTransfer && <option value="Transfer">🚘 VIP Transfer</option>}
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
                              placeholder="Ad ve soyad"
                            />
                          </div>
                          <label className="panel-field">
                            <span>Sorgulama soyadı</span>
                            <input
                              className="modal-input"
                              autoComplete="family-name"
                              value={manSurname}
                              onChange={(event) => setManSurname(event.target.value)}
                              required minLength={2} maxLength={80}
                            />
                          </label>
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
                        <button type="submit" disabled={busy} className="u4-submit-btn" style={{ height: 42, fontSize: 13 }}>
                          Deneme kaydını oluştur
                        </button>
                      </form>
                    )}

                    {/* Quick Colorful Date Presets */}
                    <div className="adm-date-bar">
                      <div className="adm-date-presets">
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#0369a1', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Calendar size={14} /> {ui.dateQuickLabel}
                        </span>
                        <button type="button" className={`adm-date-chip ${!dateFrom && !dateTo ? 'active' : ''}`} onClick={() => applyDatePreset('all')}>
                          {ui.dateAll}
                        </button>
                        <button type="button" className="adm-date-chip" onClick={() => applyDatePreset('today')}>
                          🟢 {ui.dateToday}
                        </button>
                        <button type="button" className="adm-date-chip" onClick={() => applyDatePreset('week')}>
                          🔵 {ui.dateWeek}
                        </button>
                        <button type="button" className="adm-date-chip" onClick={() => applyDatePreset('month')}>
                          🟣 {ui.dateMonth}
                        </button>
                        <button type="button" className="adm-date-chip" onClick={() => applyDatePreset('upcoming')}>
                          🟠 {ui.dateUpcoming}
                        </button>
                      </div>
                      {(dateFrom || dateTo) && (
                        <button type="button" className="adm-btn adm-btn-red" style={{ height: 28, fontSize: 11.5 }} onClick={() => applyDatePreset('all')}>
                          ✕ {ui.dateReset}
                        </button>
                      )}
                    </div>

                    {/* Filter, Date Range & Sort Controls */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))',
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
                        <label htmlFor="admin-booking-search" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                          <Search size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {ui.searchLabel}
                        </label>
                        <input
                          id="admin-booking-search"
                          type="search"
                          className="modal-input"
                          placeholder={ui.searchPh}
                          value={searchQ}
                          onChange={(e) => setSearchQ(e.target.value)}
                        />
                      </div>

                      {/* Start Date */}
                      <div>
                        <label htmlFor="admin-booking-from" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                          <Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {ui.fromDate}
                        </label>
                        <input
                          id="admin-booking-from"
                          type="date"
                          className="modal-input"
                          value={dateFrom}
                          max={dateTo || undefined}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>

                      {/* End Date */}
                      <div>
                        <label htmlFor="admin-booking-to" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                          <Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {ui.toDate}
                        </label>
                        <input
                          id="admin-booking-to"
                          type="date"
                          className="modal-input"
                          value={dateTo}
                          min={dateFrom || undefined}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </div>

                      {/* Sort By */}
                      <div>
                        <label htmlFor="admin-booking-sort" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                          <ArrowUpDown size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {ui.sortBy}
                        </label>
                        <select
                          id="admin-booking-sort"
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
                            onClick={resetBookingFilters}
                          >
                            Filtreleri Temizle
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bookings List */}
                    <div role="status" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--aspan-text-muted)', marginBottom: 10 }}>
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
                            className="panel-admin-record"
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
                            <div style={{ flex: '1 1 420px', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span className="uf-airport-code">{b.pnr}</span>
                                <span className="pkg-pill">{b.type}</span>
                                <span
                                  className="pkg-pill"
                                  style={{
                                    background: 'rgba(2, 132, 199, 0.12)',
                                    color: '#0369A1',
                                    border: '1px solid rgba(2, 132, 199, 0.3)',
                                    fontWeight: 800,
                                  }}
                                >
                                  🔌 XML: {b.providerSource || (b.type === 'Otel' ? 'BookingAgora Hotel XML' : b.type === 'Transfer' ? 'Buranus VIP Transfer XML' : 'Amadeus GDS (XML)')}
                                </span>
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
                                <span className="pkg-pill" style={{ background: 'rgba(15, 23, 42, 0.06)', color: 'var(--aspan-text-body)' }}>
                                  {b.organizationName ? `🏢 Kurumsal: ${b.organizationName}` : '👤 Bireysel (B2C)'}
                                  {b.sellerName ? ` · ${b.sellerName}` : ''}
                                </span>
                              </div>
                              <strong style={{ fontSize: 16 }}>{b.title}</strong>
                              <div style={{ fontSize: 12.5, color: 'var(--aspan-text-body)', marginTop: 3 }}>
                                {b.subtitle} · Tarih: <strong>{formatDisplayDate(b.date, lang)}</strong> ({b.date})
                                {b.returnDate && ` · Dönüş / çıkış: ${formatDisplayDate(b.returnDate, lang)}`}
                                {b.invoiceCompany ? ` · Kurumsal Fatura: ${b.invoiceCompany}` : ''}
                              </div>

                              {/* Tam Bilet Detayları */}
                              {(b.airline || b.flightNumber || b.departTime || b.baggage || b.cabin || b.duration) && (
                                <div
                                  style={{
                                    marginTop: 8,
                                    padding: '8px 11px',
                                    borderRadius: 10,
                                    background: 'rgba(255,255,255,0.72)',
                                    border: '1px solid var(--aspan-border)',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '6px 14px',
                                    fontSize: 12,
                                    color: 'var(--aspan-text-body)',
                                  }}
                                >
                                  {b.airline && <span>✈ <strong>Havayolu:</strong> {b.airline}</span>}
                                  {b.flightNumber && <span><strong>Uçuş No:</strong> {b.flightNumber}</span>}
                                  {b.departTime && (
                                    <span>
                                      🕒 <strong>Saat:</strong> {b.departTime}
                                      {b.arriveTime ? ` → ${b.arriveTime}` : ''}
                                    </span>
                                  )}
                                  {b.duration && <span>⏱ <strong>Süre:</strong> {b.duration}</span>}
                                  {b.cabin && <span>💺 <strong>Kabin:</strong> {b.cabin}</span>}
                                  {b.baggage && <span>🧳 <strong>Bagaj:</strong> {b.baggage}</span>}
                                </div>
                              )}

                              {/* Tam Yolcu & İletişim Bilgileri */}
                              <div
                                style={{
                                  marginTop: 8,
                                  padding: '8px 11px',
                                  borderRadius: 10,
                                  background: 'rgba(255,255,255,0.78)',
                                  border: '1px solid var(--aspan-border)',
                                  fontSize: 12,
                                }}
                              >
                                <div style={{ fontWeight: 800, color: 'var(--aspan-text)', marginBottom: 4 }}>
                                  👥 Yolcu Bilgileri ({b.passengersDetail?.length || 1} kişi)
                                </div>
                                {b.passengersDetail && b.passengersDetail.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {b.passengersDetail.map((px, pIdx) => (
                                      <div key={`${b.id}-px-${pIdx}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', color: 'var(--aspan-text-body)' }}>
                                        <span><strong>{pIdx + 1}. {px.fullName}</strong>{px.paxType ? ` (${px.paxType})` : ''}</span>
                                        {px.gender && <span>· {px.gender}</span>}
                                        {px.tcOrPassport && <span>· <strong>TC/Pasaport:</strong> {px.tcOrPassport}</span>}
                                        {px.birthDate && <span>· <strong>Doğum:</strong> {px.birthDate}</span>}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--aspan-text-body)' }}>
                                    <strong>{b.passenger}</strong>
                                  </div>
                                )}
                                {(b.contactPhone || b.contactEmail) && (
                                  <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px dashed var(--aspan-border)', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', color: 'var(--aspan-text-muted)' }}>
                                    {b.contactPhone && <span>📞 <strong>Tel:</strong> {b.contactPhone}</span>}
                                    {b.contactEmail && <span>✉ <strong>E-Posta:</strong> {b.contactEmail}</span>}
                                  </div>
                                )}
                              </div>

                              {/* XML Alış / Satış / Net Kâr Özeti */}
                              {(isSuperAdmin || canManageBookings) && b.netCostTRY !== undefined && (
                                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                                  <span style={{ padding: '3px 9px', borderRadius: 8, background: 'rgba(15,23,42,0.06)', fontWeight: 700 }}>
                                    XML Alış: {formatPrice(b.netCostTRY, currency)}
                                  </span>
                                  <span style={{ padding: '3px 9px', borderRadius: 8, background: 'rgba(2,132,199,0.1)', color: '#0369A1', fontWeight: 700 }}>
                                    Satış: {formatPrice(b.price, currency)}
                                  </span>
                                  <span style={{ padding: '3px 9px', borderRadius: 8, background: 'rgba(16,185,129,0.14)', color: '#047857', fontWeight: 800 }}>
                                    Net Kâr: +{formatPrice(b.profitTRY ?? Math.max(0, b.price - b.netCostTRY), currency)}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="panel-record-actions" style={{ flexWrap: 'wrap', gap: 6 }}>
                              <strong style={{ fontSize: 18, marginRight: 6, color: 'var(--aspan-text)' }}>
                                {formatPrice(b.price, currency)}
                              </strong>

                              {canManageBookings && b.status !== 'Tamamlandı' && (
                                <button
                                  type="button"
                                  className="uf-quick-pill"
                                  disabled={busy}
                                  style={{ background: 'rgba(2,132,199,0.12)', color: '#0369A1', borderColor: '#0284C7' }}
                                  onClick={() => void runAction(async () => {
                                    await onUpdateBookingStatus(b.id, 'Tamamlandı');
                                    flash(`${b.pnr} (${b.type}) yapıldı / tamamlandı olarak işaretlendi.`);
                                  })}
                                >
                                  ✓ Yapıldı
                                </button>
                              )}
                              {!canManageBookings && canCancelRequest && b.status === 'Onaylandı' && (
                                <button
                                  type="button"
                                  className="uf-quick-pill"
                                  disabled={busy}
                                  style={{ background: 'rgba(245,158,11,0.14)', color: '#B45309', borderColor: '#F59E0B' }}
                                  onClick={() => void runAction(async () => {
                                    await onUpdateBookingStatus(b.id, 'İptal Talebi');
                                    flash(`${b.pnr} için merkeze iptal talebi iletildi.`);
                                  })}
                                >
                                  İptal Talebi Oluştur
                                </button>
                              )}
                              <button
                                type="button"
                                className="uf-quick-pill"
                                onClick={() => openBrandedEticketPdf(b, { currency, lang })}
                              >
                                <Download size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                PDF E-Bilet
                              </button>
                              {canManageBookings && b.status !== 'İptal Edildi' && (
                                <button
                                  type="button"
                                  className="uf-quick-pill"
                                  disabled={busy}
                                  style={{ background: 'rgba(225,29,72,0.1)', color: '#be123c', borderColor: '#e11d48' }}
                                  onClick={() => void runAction(async () => {
                                    await onUpdateBookingStatus(b.id, 'İptal Edildi');
                                    flash(`${b.pnr} iptal edildi.`);
                                  })}
                                >
                                  ✕ İptal
                                </button>
                              )}
                              {canManageBookings && b.status !== 'İade Edildi' && (
                                <button
                                  type="button"
                                  className="uf-quick-pill"
                                  disabled={busy}
                                  style={{ background: 'rgba(124,58,237,0.1)', color: '#6d28d9', borderColor: '#7c3aed' }}
                                  onClick={() => void runAction(async () => {
                                    await onUpdateBookingStatus(b.id, 'İade Edildi');
                                    flash(`${b.pnr} iade edildi olarak işaretlendi.`);
                                  })}
                                >
                                  ↺ İade
                                </button>
                              )}

                              {canManageBookings && (
                                <select
                                  aria-label={`${b.pnr} durumunu değiştir`}
                                  value={b.status}
                                  disabled={busy}
                                  onChange={(event) => {
                                    const status = event.target.value as BookingRecord['status'];
                                    void runAction(async () => {
                                      await onUpdateBookingStatus(b.id, status);
                                      flash('Rezervasyon durumu güncellendi.');
                                    });
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
                                  {Object.entries(STATUS_VISUALS).map(([value, status]) => (
                                    <option key={value} value={value}>{status.label}</option>
                                  ))}
                                </select>
                              )}

                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  className="drawer-close"
                                  style={{ background: '#ffffff' }}
                                  title="Kaydı Sil"
                                  aria-label={`${b.pnr} kaydını sil`}
                                  onClick={() => setPendingDeletion(b.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            {pendingDeletion === b.id && (
                              <div className="panel-delete-confirm">
                                <span>{b.pnr} kodlu kayıt bu tarayıcıdan silinsin mi?</span>
                                <div className="panel-actions">
                                  <button type="button" className="uf-quick-pill" onClick={() => setPendingDeletion(null)}>
                                    Vazgeç
                                  </button>
                                  <button
                                    type="button"
                                    className="uf-quick-pill panel-danger-action"
                                    disabled={busy}
                                    onClick={() => void runAction(async () => {
                                      await onDeleteBooking(b.id);
                                      setPendingDeletion(null);
                                      flash('Rezervasyon silindi.');
                                    })}
                                  >
                                    Kaydı sil
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {/* ==================== MODULE 2.5: FINANCE & CRM CENTER ==================== */}
              {section === 'finance' && (
                <AdminFinanceCrmSection
                  lang={lang}
                  currency={currency}
                  markup={draft}
                  bookings={bookings}
                  siteUsers={siteUsers}
                  onJumpToBookings={(st) => openBookings(st ?? 'ALL')}
                  onFlash={flash}
                  onError={setActionError}
                />
              )}

              {/* ==================== MODULE 3: PRICING & MARKUP ENGINE ==================== */}
              {section === 'pricing' && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
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

                      <button type="submit" disabled={busy} className="u4-submit-btn" style={{ width: '100%', marginTop: 18 }}>
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
                            disabled={!catalogWritable}
                            aria-label={ar.carrier + ' kuralını sil'}
                            onClick={() => saveCatalog('rules', airlineRules.filter((row) => row.id !== ar.id), 'Örnek kural silindi.')}
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
                        saveCatalog('rules', [...airlineRules, {
                          id: crypto.randomUUID(),
                          carrier: newCarrier.trim(),
                          route: 'Özel Rota',
                          rule: newRouteRule.trim(),
                        }], 'Örnek havayolu kuralı kaydedildi.', () => {
                          setNewCarrier('');
                          setNewRouteRule('');
                        });
                      }}
                      className="panel-form-grid" style={{ marginTop: 14 }}
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
                      <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }} disabled={!catalogWritable}>
                        <Plus size={15} /> Kural Ekle
                      </button>
                    </form>
                  </div>

                  {/* OPERATOR XML PRICING ENGINE (FUN&SUN, KOMPAS TOUR, SELFIE TRAVEL, NET TOURS) */}
                  <div className="panel-card" style={{ border: '1.5px solid rgba(0,168,181,0.45)' }}>
                    <strong style={{ fontSize: 18, display: 'block', marginBottom: 6 }}>
                      Operatör XML Bazlı Fiyatlandırma &amp; Net Kâr Kuralları
                    </strong>
                    <div className="adm-banner adm-banner-info">
                      <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong>Nasıl Çalışır?</strong> FUN&amp;SUN, Kompas Tour, Selfie Travel ve diğer XML tedarikçilerden gelen bilet ve tur paketlerine ayrı ayrı <strong>NET (+0 €)</strong>, <strong>+Euro (€)</strong>, <strong>+TL (₺)</strong> veya <strong>+Yüzde (%)</strong> kâr kuralı tanımlayın. Aktif kurallar manuel uçuşlara ve XML simülasyonuna anında yansır.
                      </div>
                    </div>

                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Operatör (XML)</th>
                            <th>Ürün Tipi</th>
                            <th>Kâr / Komisyon Kuralı</th>
                            <th>Örnek Geliş → Canlı Satış</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                          </tr>
                        </thead>
                        <tbody>
                          {operatorRules.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--aspan-text-muted)' }}>
                                Henüz operatör XML kuralı eklenmemiş. Aşağıdaki formdan yeni kural ekleyebilirsiniz.
                              </td>
                            </tr>
                          ) : (
                            operatorRules.map((op) => {
                              const eurRate = Math.round(1 / (fxSnapshot.rates.EUR || 0.0181));
                              const isTour = op.product.toLowerCase().includes('tur');
                              const sampleNetEur = isTour ? 500 : 200;
                              const saleEur =
                                op.markupType === 'NET' || op.markupValue === 0
                                  ? sampleNetEur
                                  : op.markupType === 'EUR'
                                    ? sampleNetEur + op.markupValue
                                    : op.markupType === 'PERCENT'
                                      ? Math.round(sampleNetEur * (1 + op.markupValue / 100))
                                      : Math.round(sampleNetEur + op.markupValue / Math.max(1, eurRate));
                              const badgeText =
                                op.markupType === 'NET' || op.markupValue === 0
                                  ? 'NET (+0 € · Kâr Yok)'
                                  : op.markupType === 'EUR'
                                    ? `+${op.markupValue} €`
                                    : op.markupType === 'TRY'
                                      ? `+₺${op.markupValue}`
                                      : `+%${op.markupValue}`;
                              const isConfirming = pendingCatalogDelete?.section === 'operators' && pendingCatalogDelete.id === op.id;

                              return (
                                <tr key={op.id} className={!op.active ? 'is-inactive' : ''}>
                                  <td data-label="Operatör (XML)">
                                    <strong style={{ fontSize: 14 }}>{op.operator}</strong>
                                  </td>
                                  <td data-label="Ürün Tipi">
                                    <span className="pkg-pill">{op.product}</span>
                                  </td>
                                  <td data-label="Kâr Kuralı">
                                    {editingOpId === op.id ? (
                                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <select
                                          className="modal-input"
                                          style={{ height: 34, fontSize: 12, minWidth: 112, padding: '0 8px' }}
                                          value={editOpType}
                                          onChange={(e) => setEditOpType(e.target.value as 'NET' | 'EUR' | 'TRY' | 'PERCENT')}
                                        >
                                          <option value="NET">NET (0 €)</option>
                                          <option value="EUR">+ Euro (€)</option>
                                          <option value="TRY">+ TL (₺)</option>
                                          <option value="PERCENT">+ Yüzde (%)</option>
                                        </select>
                                        <input
                                          className="modal-input"
                                          type="number"
                                          min={0}
                                          disabled={editOpType === 'NET'}
                                          style={{ height: 34, width: 76, fontSize: 12.5, padding: '0 8px' }}
                                          value={editOpType === 'NET' ? '0' : editOpVal}
                                          onChange={(e) => setEditOpVal(e.target.value)}
                                        />
                                      </div>
                                    ) : (
                                      <span className={`status-badge ${op.markupType === 'NET' || op.markupValue === 0 ? 'ok' : 'warn'}`}>
                                        {badgeText}
                                      </span>
                                    )}
                                  </td>
                                  <td data-label="Geliş → Satış">
                                    <span>
                                      <span style={{ color: 'var(--aspan-text-muted)', fontWeight: 600 }}>{sampleNetEur} €</span>{' '}
                                      → <strong style={{ color: 'var(--aspan-teal-deep)' }}>{saleEur} €</strong>{' '}
                                      <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 700 }}>
                                        ({saleEur === sampleNetEur ? 'NET' : `+${saleEur - sampleNetEur} €`})
                                      </span>
                                    </span>
                                  </td>
                                  <td data-label="Durum">
                                    <span className={`status-badge ${op.active ? 'ok' : 'warn'}`}>
                                      {op.active ? '● Aktif' : '○ Pasif'}
                                    </span>
                                  </td>
                                  <td data-label="İşlemler">
                                    <div className="adm-actions">
                                      {editingOpId === op.id ? (
                                        <>
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-green"
                                            disabled={!catalogWritable}
                                            onClick={() => {
                                              const nextVal = editOpType === 'NET' ? 0 : Math.max(0, Math.round(Number(editOpVal) || 0));
                                              saveCatalog(
                                                'operators',
                                                operatorRules.map((r) => (r.id === op.id ? { ...r, markupType: editOpType, markupValue: nextVal } : r)),
                                                `✓ ${op.operator} kuralı (${editOpType === 'NET' ? 'NET 0 €' : `${nextVal} ${editOpType}`}) kaydedildi.`,
                                                () => setEditingOpId(null)
                                              );
                                            }}
                                          >
                                            <Check size={13} /> Kaydet
                                          </button>
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-ghost"
                                            onClick={() => setEditingOpId(null)}
                                          >
                                            Vazgeç
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          className="adm-btn adm-btn-blue"
                                          disabled={!catalogWritable}
                                          onClick={() => {
                                            setEditingOpId(op.id);
                                            setEditOpType(op.markupType);
                                            setEditOpVal(String(op.markupValue));
                                          }}
                                        >
                                          ✎ Fiyat Düzenle
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className={`adm-btn ${op.active ? 'adm-btn-amber' : 'adm-btn-green-soft'}`}
                                        disabled={!catalogWritable}
                                        onClick={() => saveCatalog(
                                          'operators',
                                          operatorRules.map((r) => (r.id === op.id ? { ...r, active: !r.active } : r)),
                                          `${op.operator} XML kuralı ${op.active ? 'pasifleştirildi' : 'aktifleştirildi'}.`
                                        )}
                                      >
                                        {op.active ? 'Pasifleştir' : 'Aktifleştir'}
                                      </button>
                                      {isConfirming ? (
                                        <span className="adm-confirm-inline">
                                          Silinsin mi?
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-red-solid"
                                            style={{ height: 26, padding: '0 8px' }}
                                            disabled={!catalogWritable}
                                            onClick={() => saveCatalog(
                                              'operators',
                                              operatorRules.filter((r) => r.id !== op.id),
                                              `✓ ${op.operator} XML kuralı kalıcı olarak silindi.`
                                            )}
                                          >
                                            Evet, Sil
                                          </button>
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-ghost"
                                            style={{ height: 26, padding: '0 8px' }}
                                            onClick={() => setPendingCatalogDelete(null)}
                                          >
                                            Vazgeç
                                          </button>
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="adm-btn adm-btn-red"
                                          disabled={!catalogWritable}
                                          aria-label={`${op.operator} sil`}
                                          onClick={() => setPendingCatalogDelete({ section: 'operators', id: op.id, label: op.operator })}
                                        >
                                          <Trash2 size={13} /> Sil
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="adm-form-box">
                      <div className="adm-form-title">
                        <Plus size={16} color="#059669" /> Yeni Operatör XML Fiyat Kuralı Ekle
                      </div>
                      <form
                        className="panel-form-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newOpName.trim()) return;
                          saveCatalog(
                            'operators',
                            [
                              ...operatorRules,
                              {
                                id: crypto.randomUUID(),
                                operator: newOpName.trim(),
                                product: newOpProduct,
                                markupType: newOpMarkupType,
                                markupValue: newOpMarkupType === 'NET' ? 0 : Math.max(0, Math.round(Number(newOpMarkupVal) || 0)),
                                active: true,
                              },
                            ],
                            `✓ ${newOpName.trim()} XML kuralı eklendi ve aktif edildi.`,
                            () => {
                              setNewOpName('');
                              setNewOpMarkupVal('10');
                            }
                          );
                        }}
                      >
                        <div>
                          <label className="adm-field-lbl">Operatör Adı (XML)</label>
                          <input className="modal-input" required placeholder="Örn: FUN&SUN, Kompas Tour" value={newOpName} onChange={(e) => setNewOpName(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Ürün Tipi</label>
                          <select className="modal-input" value={newOpProduct} onChange={(e) => setNewOpProduct(e.target.value)}>
                            <option value="Uçak Bileti">Uçak Bileti</option>
                            <option value="Tur Paketi">Tur Paketi</option>
                            <option value="Otel">Otel</option>
                            <option value="Transfer">Transfer</option>
                          </select>
                        </div>
                        <div>
                          <label className="adm-field-lbl">Kâr Tipi</label>
                          <select className="modal-input" value={newOpMarkupType} onChange={(e) => setNewOpMarkupType(e.target.value as 'NET' | 'EUR' | 'TRY' | 'PERCENT')}>
                            <option value="NET">NET (0 € · Kâr Yok)</option>
                            <option value="EUR">+ Euro (€) Ekle</option>
                            <option value="TRY">+ TL (₺) Ekle</option>
                            <option value="PERCENT">+ Yüzde (%) Komisyon</option>
                          </select>
                        </div>
                        <div>
                          <label className="adm-field-lbl">Tutar / Oran</label>
                          <input
                            className="modal-input"
                            type="number"
                            min={0}
                            disabled={newOpMarkupType === 'NET'}
                            placeholder="Örn: 10"
                            value={newOpMarkupType === 'NET' ? '0' : newOpMarkupVal}
                            onChange={(e) => setNewOpMarkupVal(e.target.value)}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button type="submit" className="adm-btn adm-btn-green" style={{ height: 42, width: '100%', fontSize: 13 }} disabled={!catalogWritable}>
                            <Plus size={15} /> XML Kuralı Ekle
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
              )}

              {/* ==================== MODULE 4: INVENTORY (MANUAL FLIGHTS, HOTELS & VIP TRANSFERS) ==================== */}
              {section === 'inventory' && (
                <>
                  {/* MANUAL FLIGHTS / CHARTER BLOCK SEATS */}
                  {canManageManualFlights && (
                  <div className="panel-card" style={{ border: '1.5px solid rgba(16,185,129,0.45)' }}>
                    <strong style={{ fontSize: 18, display: 'block', marginBottom: 6 }}>
                      ✈ Manuel Uçuş &amp; Blok Koltuk Envanteri
                    </strong>
                    <div className="adm-banner adm-banner-ok">
                      <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong>Canlı Site Senkronizasyonu Aktif:</strong> Eklediğiniz aktif charter / blok koltuk uçuşları müşteriler ilgili parkuru (Örn: IST → ALA veya AYT → ALA) arattığında sonuçların en üstünde görünür. Operatör XML kuralı (Örn: Kompas Tour +10 €) otomatik uygulanır.
                      </div>
                    </div>

                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Parkur &amp; Uçuş</th>
                            <th>Havayolu &amp; Saatler</th>
                            <th>Operatör (XML)</th>
                            <th>Bagaj / Koltuk</th>
                            <th>Taban Fiyat</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                          </tr>
                        </thead>
                        <tbody>
                          {manualFlights.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--aspan-text-muted)' }}>
                                Henüz manuel uçuş eklenmemiş. Aşağıdaki formdan yeni uçuş ekleyebilirsiniz.
                              </td>
                            </tr>
                          ) : (
                            manualFlights.map((mf) => {
                              const isConfirming = pendingCatalogDelete?.section === 'flights' && pendingCatalogDelete.id === mf.id;
                              const eurRate = Math.round(1 / (fxSnapshot.rates.EUR || 0.0181));
                              const normOp = mf.operator.toLowerCase();
                              const matchedRule = operatorRules.find(
                                (r) =>
                                  r.active &&
                                  r.product.toLowerCase().includes('uçak') &&
                                  (normOp.includes(r.operator.toLowerCase().replace(/\s*\(xml\)/g, '').trim()) ||
                                    r.operator.toLowerCase().includes(normOp.replace(/\s*\(xml\)/g, '').trim()))
                              );
                              const xmlSaleTRY = !matchedRule || matchedRule.markupType === 'NET' || matchedRule.markupValue === 0
                                ? mf.priceTRY
                                : matchedRule.markupType === 'EUR'
                                  ? mf.priceTRY + Math.round(matchedRule.markupValue * eurRate)
                                  : matchedRule.markupType === 'TRY'
                                    ? mf.priceTRY + matchedRule.markupValue
                                    : Math.round(mf.priceTRY * (1 + matchedRule.markupValue / 100));
                              const xmlDiff = xmlSaleTRY - mf.priceTRY;
                              return (
                                <tr key={mf.id} className={!mf.active ? 'is-inactive' : ''}>
                                  <td data-label="Parkur & Uçuş">
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                      <span className="uf-airport-code">{mf.fromCode} → {mf.toCode}</span>
                                      <span className="pkg-pill">{mf.flightNumber}</span>
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)', marginTop: 3 }}>
                                      {mf.flightDate ? formatDisplayDate(mf.flightDate, lang) : 'Her Gün (Sezonluk)'}
                                    </div>
                                  </td>
                                  <td data-label="Havayolu & Saat">
                                    <div>
                                      <strong>{mf.airline}</strong>
                                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                                        {mf.departTime} → {mf.arriveTime} ({mf.duration})
                                      </div>
                                    </div>
                                  </td>
                                  <td data-label="Operatör (XML)"><span className="pkg-pill">{mf.operator}</span></td>
                                  <td data-label="Bagaj / Koltuk">
                                    <div>
                                      <div>{mf.baggage}</div>
                                      <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 700 }}>{mf.quota} Koltuk</div>
                                    </div>
                                  </td>
                                  <td data-label="Net / XML Satış">
                                    <div>
                                      <strong style={{ fontSize: 15, color: 'var(--aspan-teal-deep)', whiteSpace: 'nowrap' }}>
                                        {formatPrice(xmlSaleTRY, currency)}
                                      </strong>
                                      <div style={{ fontSize: 11, color: xmlDiff > 0 ? '#059669' : 'var(--aspan-text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {xmlDiff > 0
                                          ? `Net ${formatPrice(mf.priceTRY, currency)} + XML`
                                          : 'NET Fiyat (Kâr Yok)'}
                                      </div>
                                    </div>
                                  </td>
                                  <td data-label="Durum">
                                    <span className={`status-badge ${mf.active ? 'ok' : 'warn'}`}>
                                      {mf.active ? '● Satışta' : '○ Pasif'}
                                    </span>
                                  </td>
                                  <td data-label="İşlemler">
                                    <div className="adm-actions">
                                      <button
                                        type="button"
                                        className={`adm-btn ${mf.active ? 'adm-btn-amber' : 'adm-btn-green-soft'}`}
                                        disabled={!catalogWritable}
                                        onClick={() => saveCatalog(
                                          'flights',
                                          manualFlights.map((r) => (r.id === mf.id ? { ...r, active: !r.active } : r)),
                                          `${mf.flightNumber} uçuşu ${mf.active ? 'pasife alındı' : 'satışa açıldı'}.`
                                        )}
                                      >
                                        {mf.active ? 'Pasifleştir' : 'Satışa Aç'}
                                      </button>
                                      {isConfirming ? (
                                        <span className="adm-confirm-inline">
                                          Silinsin mi?
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-red-solid"
                                            style={{ height: 26, padding: '0 8px' }}
                                            disabled={!catalogWritable}
                                            onClick={() => saveCatalog(
                                              'flights',
                                              manualFlights.filter((r) => r.id !== mf.id),
                                              `✓ ${mf.flightNumber} manuel uçuşu silindi ve siteden kaldırıldı.`
                                            )}
                                          >
                                            Evet, Sil
                                          </button>
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-ghost"
                                            style={{ height: 26, padding: '0 8px' }}
                                            onClick={() => setPendingCatalogDelete(null)}
                                          >
                                            Vazgeç
                                          </button>
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="adm-btn adm-btn-red"
                                          disabled={!catalogWritable}
                                          aria-label={`${mf.flightNumber} sil`}
                                          onClick={() => setPendingCatalogDelete({ section: 'flights', id: mf.id, label: mf.flightNumber })}
                                        >
                                          <Trash2 size={13} /> Sil
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="adm-form-box">
                      <div className="adm-form-title">
                        <Plus size={16} color="#059669" /> Yeni Manuel / Charter Uçuş Ekle
                      </div>
                      <form
                        className="panel-form-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!mfAirline.trim() || !mfNumber.trim() || !mfFrom.trim() || !mfTo.trim()) return;
                          const rawNum = Math.max(1, Number(mfPrice) || 0);
                          const eurToTry = 1 / (fxSnapshot.rates.EUR || 0.0181);
                          const usdToTry = 1 / (fxSnapshot.rates.USD || 0.0197);
                          const computedTRY = Math.max(
                            250,
                            Math.round(
                              mfCurrency === 'EUR'
                                ? rawNum * eurToTry
                                : mfCurrency === 'USD'
                                  ? rawNum * usdToTry
                                  : rawNum
                            )
                          );
                          const [dh = '10', dm = '00'] = (mfDep || '10:00').split(':');
                          const [ah = '14', am = '00'] = (mfArr || '14:00').split(':');
                          const depMins = Number(dh) * 60 + Number(dm);
                          const arrMins = Number(ah) * 60 + Number(am);
                          const durMins = arrMins > depMins ? arrMins - depMins : (24 * 60 - depMins + arrMins);
                          const autoDuration = Number.isFinite(durMins) && durMins > 0
                            ? `${Math.floor(durMins / 60)}sa ${durMins % 60}dk`
                            : 'Direkt Charter';
                          saveCatalog(
                            'flights',
                            [
                              ...manualFlights,
                              {
                                id: crypto.randomUUID(),
                                airline: mfAirline.trim(),
                                airlineCode: mfCode.trim().toUpperCase().slice(0, 3) || 'FT',
                                flightNumber: mfNumber.trim().toUpperCase(),
                                fromCode: mfFrom.trim().toUpperCase().slice(0, 3),
                                toCode: mfTo.trim().toUpperCase().slice(0, 3),
                                flightDate: mfDate.trim(),
                                departTime: mfDep.trim() || '10:00',
                                arriveTime: mfArr.trim() || '14:00',
                                duration: autoDuration,
                                operator: mfOperator.trim() || 'Blok Koltuk',
                                baggage: mfBaggage.trim() || '20 kg Bagaj',
                                priceTRY: computedTRY,
                                quota: Math.max(1, Math.round(Number(mfQuota) || 10)),
                                active: true,
                              },
                            ],
                            `✓ ${mfNumber.trim().toUpperCase()} (${mfCurrency === 'TRY' ? `₺${computedTRY.toLocaleString('tr-TR')}` : `${rawNum} ${mfCurrency} ≈ ₺${computedTRY.toLocaleString('tr-TR')}`}) canlı siteye eklendi!`,
                            () => {
                              setMfNumber('');
                            }
                          );
                        }}
                      >
                        <div>
                          <label className="adm-field-lbl">Havayolu</label>
                          <input className="modal-input" required placeholder="Örn: Air Astana" value={mfAirline} onChange={(e) => setMfAirline(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">IATA Kodu</label>
                          <input className="modal-input" required placeholder="KC" value={mfCode} onChange={(e) => setMfCode(e.target.value.toUpperCase())} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Uçuş No</label>
                          <input className="modal-input" required placeholder="Örn: KC920" value={mfNumber} onChange={(e) => setMfNumber(e.target.value.toUpperCase())} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Kalkış (IATA)</label>
                          <input className="modal-input" required placeholder="IST" value={mfFrom} onChange={(e) => setMfFrom(e.target.value.toUpperCase())} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Varış (IATA)</label>
                          <input className="modal-input" required placeholder="ALA" value={mfTo} onChange={(e) => setMfTo(e.target.value.toUpperCase())} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Uçuş Tarihi (Boş = Her Gün)</label>
                          <input className="modal-input" type="date" value={mfDate} onChange={(e) => setMfDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Kalkış Saati</label>
                          <input className="modal-input" required placeholder="10:30" value={mfDep} onChange={(e) => setMfDep(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Varış Saati</label>
                          <input className="modal-input" required placeholder="18:00" value={mfArr} onChange={(e) => setMfArr(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Operatör (XML)</label>
                          <select className="modal-input" value={mfOperator} onChange={(e) => setMfOperator(e.target.value)}>
                            {Array.from(
                              new Set([
                                'FUN&SUN (XML)',
                                'Kompas Tour (XML)',
                                'Selfie Travel (XML)',
                                'Blok Koltuk (Özel)',
                                ...operatorRules.filter((r) => r.product.toLowerCase().includes('uçak')).map((r) => r.operator),
                              ])
                            ).map((opName) => (
                              <option key={opName} value={opName}>{opName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="adm-field-lbl">Bagaj Hakkı</label>
                          <input className="modal-input" placeholder="20 kg Bagaj" value={mfBaggage} onChange={(e) => setMfBaggage(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Para Birimi</label>
                          <select className="modal-input" value={mfCurrency} onChange={(e) => setMfCurrency(e.target.value as 'EUR' | 'USD' | 'TRY')}>
                            <option value="EUR">€ Euro (Canlı Kurdan ₺)</option>
                            <option value="USD">$ Dolar (Canlı Kurdan ₺)</option>
                            <option value="TRY">₺ Türk Lirası</option>
                          </select>
                        </div>
                        <div>
                          <label className="adm-field-lbl">
                            Net Fiyat ({mfCurrency})
                            {mfCurrency !== 'TRY' && Number(mfPrice) > 0 && (
                              <span style={{ color: '#059669', marginLeft: 4 }}>
                                ≈ ₺{Math.round(Number(mfPrice) * (mfCurrency === 'EUR' ? 1 / (fxSnapshot.rates.EUR || 0.0181) : 1 / (fxSnapshot.rates.USD || 0.0197))).toLocaleString('tr-TR')}
                              </span>
                            )}
                          </label>
                          <input className="modal-input" type="number" min={1} required placeholder={mfCurrency === 'TRY' ? '6890' : '150'} value={mfPrice} onChange={(e) => setMfPrice(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Kontenjan (Koltuk)</label>
                          <input className="modal-input" type="number" min={1} placeholder="10" value={mfQuota} onChange={(e) => setMfQuota(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button type="submit" className="adm-btn adm-btn-green" style={{ height: 42, width: '100%', fontSize: 13 }} disabled={!catalogWritable}>
                            <Plus size={15} /> Manuel Uçuş Ekle
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                  )}

                  {canManageHotelTransfer && (
                  <>
                  <div className="panel-card">
                    <strong style={{ fontSize: 18, display: 'block', marginBottom: 10 }}>
                      VIP Havalimanı Transfer Filosu (Canlı Vitrin Yönetimi)
                    </strong>
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Şehir</th>
                            <th>Araç &amp; Güzergâh</th>
                            <th>Kapasite</th>
                            <th>Satış Fiyatı</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                          </tr>
                        </thead>
                        <tbody>
                          {managedTransfers.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--aspan-text-muted)' }}>
                                Kayıtlı transfer bulunmuyor. Aşağıdan yeni VIP transfer ekleyebilirsiniz.
                              </td>
                            </tr>
                          ) : (
                            managedTransfers.map((tr) => {
                              const isConfirming = pendingCatalogDelete?.section === 'transfers' && pendingCatalogDelete.id === tr.id;
                              return (
                                <tr key={tr.id} className={!tr.active ? 'is-inactive' : ''}>
                                  <td data-label="Şehir"><span className="pkg-pill">{tr.city}</span></td>
                                  <td data-label="Araç & Güzergâh">
                                    <div>
                                      <strong>{tr.vehicle}</strong>
                                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>{tr.route}</div>
                                    </div>
                                  </td>
                                  <td data-label="Kapasite" style={{ fontSize: 12.5 }}>{tr.capacity} · {tr.baggage}</td>
                                  <td data-label="Satış Fiyatı">
                                    <strong style={{ fontSize: 15, color: 'var(--aspan-teal-deep)', whiteSpace: 'nowrap' }}>
                                      {formatPrice(tr.price + (draft.transferAddTRY - DEFAULT_MARKUP.transferAddTRY), currency)}
                                    </strong>
                                  </td>
                                  <td data-label="Durum">
                                    <span className={`status-badge ${tr.active ? 'ok' : 'warn'}`}>
                                      {tr.active ? '● Aktif' : '○ Pasif'}
                                    </span>
                                  </td>
                                  <td data-label="İşlemler">
                                    <div className="adm-actions">
                                      <button
                                        type="button"
                                        className="adm-btn adm-btn-blue"
                                        disabled={!catalogWritable}
                                        onClick={() => saveCatalog(
                                          'transfers',
                                          managedTransfers.map((row) => row.id === tr.id ? { ...row, price: row.price + 100 } : row),
                                          `${tr.vehicle} fiyatı +100 ₺ artırıldı.`
                                        )}
                                      >
                                        +100 ₺
                                      </button>
                                      <button
                                        type="button"
                                        className="adm-btn adm-btn-ghost"
                                        disabled={!catalogWritable || tr.price <= 400}
                                        onClick={() => saveCatalog(
                                          'transfers',
                                          managedTransfers.map((row) => row.id === tr.id ? { ...row, price: Math.max(300, row.price - 100) } : row),
                                          `${tr.vehicle} fiyatı -100 ₺ düşürüldü.`
                                        )}
                                      >
                                        -100 ₺
                                      </button>
                                      <button
                                        type="button"
                                        className={`adm-btn ${tr.active ? 'adm-btn-amber' : 'adm-btn-green-soft'}`}
                                        disabled={!catalogWritable}
                                        onClick={() => saveCatalog(
                                          'transfers',
                                          managedTransfers.map((row) => row.id === tr.id ? { ...row, active: !row.active } : row),
                                          `${tr.vehicle} ${tr.active ? 'pasifleştirildi' : 'aktifleştirildi'}.`
                                        )}
                                      >
                                        {tr.active ? 'Pasifleştir' : 'Aktifleştir'}
                                      </button>
                                      {isConfirming ? (
                                        <span className="adm-confirm-inline">
                                          Silinsin mi?
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-red-solid"
                                            style={{ height: 26, padding: '0 8px' }}
                                            disabled={!catalogWritable}
                                            onClick={() => saveCatalog(
                                              'transfers',
                                              managedTransfers.filter((row) => row.id !== tr.id),
                                              `✓ ${tr.vehicle} silindi ve canlı siteden kaldırıldı.`
                                            )}
                                          >
                                            Evet, Sil
                                          </button>
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-ghost"
                                            style={{ height: 26, padding: '0 8px' }}
                                            onClick={() => setPendingCatalogDelete(null)}
                                          >
                                            Vazgeç
                                          </button>
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="adm-btn adm-btn-red"
                                          disabled={!catalogWritable}
                                          aria-label={`${tr.vehicle} sil`}
                                          onClick={() => setPendingCatalogDelete({ section: 'transfers', id: tr.id, label: tr.vehicle })}
                                        >
                                          <Trash2 size={13} /> Sil
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="adm-form-box">
                      <div className="adm-form-title">
                        <Plus size={16} color="#059669" /> Yeni VIP Transfer Ekle
                      </div>
                      <form
                        className="panel-form-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newTrCity.trim() || !newTrVehicle.trim() || !newTrRoute.trim()) return;
                          saveCatalog(
                            'transfers',
                            [
                              ...managedTransfers,
                              {
                                id: crypto.randomUUID(),
                                city: newTrCity.trim().toUpperCase(),
                                vehicle: newTrVehicle.trim(),
                                route: newTrRoute.trim(),
                                capacity: '1–4 Yolcu',
                                baggage: '4 Bavul',
                                price: Math.max(300, Math.round(Number(newTrPrice) || 1500)),
                                active: true,
                              },
                            ],
                            `✓ ${newTrVehicle.trim()} canlı siteye eklendi.`,
                            () => {
                              setNewTrCity('');
                              setNewTrVehicle('');
                              setNewTrRoute('');
                            }
                          );
                        }}
                      >
                        <div>
                          <label className="adm-field-lbl">Şehir</label>
                          <input className="modal-input" required placeholder="Örn: ASTANA" value={newTrCity} onChange={(e) => setNewTrCity(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Araç Modeli</label>
                          <input className="modal-input" required placeholder="Örn: Mercedes V-Class VIP" value={newTrVehicle} onChange={(e) => setNewTrVehicle(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Güzergâh</label>
                          <input className="modal-input" required placeholder="Örn: NQZ → Merkez" value={newTrRoute} onChange={(e) => setNewTrRoute(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Fiyat (₺)</label>
                          <input className="modal-input" type="number" min={300} placeholder="1750" value={newTrPrice} onChange={(e) => setNewTrPrice(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button type="submit" className="adm-btn adm-btn-green" style={{ height: 42, width: '100%', fontSize: 13 }} disabled={!catalogWritable}>
                            <Plus size={15} /> Transfer Ekle
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>

                  <div className="panel-card">
                    <strong style={{ fontSize: 18, display: 'block', marginBottom: 10 }}>
                      Vitrin Otelleri &amp; Konaklama (Canlı Vitrin Yönetimi)
                    </strong>
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Şehir</th>
                            <th>Otel Adı &amp; Yıldız</th>
                            <th>Pansiyon / Gece</th>
                            <th>Satış Fiyatı</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                          </tr>
                        </thead>
                        <tbody>
                          {managedHotels.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--aspan-text-muted)' }}>
                                Kayıtlı otel bulunmuyor. Aşağıdan yeni vitrin oteli ekleyebilirsiniz.
                              </td>
                            </tr>
                          ) : (
                            managedHotels.map((h) => {
                              const isConfirming = pendingCatalogDelete?.section === 'hotels' && pendingCatalogDelete.id === h.id;
                              return (
                                <tr key={h.id} className={!h.active ? 'is-inactive' : ''}>
                                  <td data-label="Şehir"><span className="pkg-pill">{h.city}</span></td>
                                  <td data-label="Otel Adı">
                                    <div>
                                      <strong>{h.name}</strong>
                                      <div style={{ fontSize: 12, color: '#d97706' }}>{'★'.repeat(Math.min(5, Math.max(1, h.stars)))}</div>
                                    </div>
                                  </td>
                                  <td data-label="Pansiyon / Gece" style={{ fontSize: 12.5 }}>{h.boardType} · {h.nights} Gece</td>
                                  <td data-label="Satış Fiyatı">
                                    <strong style={{ fontSize: 15, color: 'var(--aspan-teal-deep)', whiteSpace: 'nowrap' }}>
                                      {formatPrice(Math.round(h.price * (1 + (draft.hotelPercent - DEFAULT_MARKUP.hotelPercent) / 100)), currency)}
                                    </strong>
                                  </td>
                                  <td data-label="Durum">
                                    <span className={`status-badge ${h.active ? 'ok' : 'warn'}`}>
                                      {h.active ? '● Aktif' : '○ Pasif'}
                                    </span>
                                  </td>
                                  <td data-label="İşlemler">
                                    <div className="adm-actions">
                                      <button
                                        type="button"
                                        className="adm-btn adm-btn-blue"
                                        disabled={!catalogWritable}
                                        onClick={() => saveCatalog(
                                          'hotels',
                                          managedHotels.map((row) => row.id === h.id ? { ...row, price: row.price + 250 } : row),
                                          `${h.name} fiyatı +250 ₺ artırıldı.`
                                        )}
                                      >
                                        +250 ₺
                                      </button>
                                      <button
                                        type="button"
                                        className="adm-btn adm-btn-ghost"
                                        disabled={!catalogWritable || h.price <= 750}
                                        onClick={() => saveCatalog(
                                          'hotels',
                                          managedHotels.map((row) => row.id === h.id ? { ...row, price: Math.max(500, row.price - 250) } : row),
                                          `${h.name} fiyatı -250 ₺ düşürüldü.`
                                        )}
                                      >
                                        -250 ₺
                                      </button>
                                      <button
                                        type="button"
                                        className={`adm-btn ${h.active ? 'adm-btn-amber' : 'adm-btn-green-soft'}`}
                                        disabled={!catalogWritable}
                                        onClick={() => saveCatalog(
                                          'hotels',
                                          managedHotels.map((row) => row.id === h.id ? { ...row, active: !row.active } : row),
                                          `${h.name} ${h.active ? 'pasifleştirildi' : 'aktifleştirildi'}.`
                                        )}
                                      >
                                        {h.active ? 'Pasifleştir' : 'Aktifleştir'}
                                      </button>
                                      {isConfirming ? (
                                        <span className="adm-confirm-inline">
                                          Silinsin mi?
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-red-solid"
                                            style={{ height: 26, padding: '0 8px' }}
                                            disabled={!catalogWritable}
                                            onClick={() => saveCatalog(
                                              'hotels',
                                              managedHotels.filter((row) => row.id !== h.id),
                                              `✓ ${h.name} silindi ve canlı siteden kaldırıldı.`
                                            )}
                                          >
                                            Evet, Sil
                                          </button>
                                          <button
                                            type="button"
                                            className="adm-btn adm-btn-ghost"
                                            style={{ height: 26, padding: '0 8px' }}
                                            onClick={() => setPendingCatalogDelete(null)}
                                          >
                                            Vazgeç
                                          </button>
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="adm-btn adm-btn-red"
                                          disabled={!catalogWritable}
                                          aria-label={`${h.name} sil`}
                                          onClick={() => setPendingCatalogDelete({ section: 'hotels', id: h.id, label: h.name })}
                                        >
                                          <Trash2 size={13} /> Sil
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="adm-form-box">
                      <div className="adm-form-title">
                        <Plus size={16} color="#059669" /> Yeni Vitrin Oteli Ekle
                      </div>
                      <form
                        className="panel-form-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newHotelCity.trim() || !newHotelName.trim()) return;
                          saveCatalog(
                            'hotels',
                            [
                              ...managedHotels,
                              {
                                id: crypto.randomUUID(),
                                city: newHotelCity.trim().toUpperCase(),
                                name: newHotelName.trim(),
                                stars: 5,
                                boardType: 'Kahvaltı Dahil',
                                nights: 2,
                                price: Math.max(500, Math.round(Number(newHotelPrice) || 3200)),
                                active: true,
                              },
                            ],
                            `✓ ${newHotelName.trim()} canlı siteye eklendi.`,
                            () => {
                              setNewHotelCity('');
                              setNewHotelName('');
                            }
                          );
                        }}
                      >
                        <div>
                          <label className="adm-field-lbl">Şehir</label>
                          <input className="modal-input" required placeholder="Örn: ANTALYA" value={newHotelCity} onChange={(e) => setNewHotelCity(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Otel Adı</label>
                          <input className="modal-input" required placeholder="Örn: Rixos Premium Belek" value={newHotelName} onChange={(e) => setNewHotelName(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Fiyat (₺)</label>
                          <input className="modal-input" type="number" min={500} placeholder="3200" value={newHotelPrice} onChange={(e) => setNewHotelPrice(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button type="submit" className="adm-btn adm-btn-green" style={{ height: 42, width: '100%', fontSize: 13 }} disabled={!catalogWritable}>
                            <Plus size={15} /> Otel Ekle
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                  </>
                  )}
                </>
              )}

              {/* ==================== MODULE 5: COUPONS & CAMPAIGNS ==================== */}
              {section === 'coupons' && (
                <div className="panel-card">
                  <strong style={{ fontSize: 18, display: 'block', marginBottom: 8 }}>
                    Kampanya &amp; İndirim Kuponu Yönetimi
                  </strong>
                  <div className="adm-banner adm-banner-ok">
                    <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Canlı Senkronizasyon:</strong> Burada eklediğiniz, pasifleştirdiğiniz veya sildiğiniz tüm kuponlar hem ana sayfa kampanya vitrinine hem de <strong>/kampanyalar</strong> sayfasına anında yansır.
                    </div>
                  </div>

                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Kupon Kodu</th>
                          <th>Kategori</th>
                          <th>Kampanya Başlığı</th>
                          <th>Geçerlilik</th>
                          <th>Durum</th>
                          <th>İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coupons.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--aspan-text-muted)' }}>
                              Aktif kupon bulunmuyor. Aşağıdaki formdan yeni kupon oluşturabilirsiniz.
                            </td>
                          </tr>
                        ) : (
                          coupons.map((c) => {
                            const isConfirming = pendingCatalogDelete?.section === 'coupons' && pendingCatalogDelete.id === c.id;
                            return (
                              <tr key={c.id} className={!c.active ? 'is-inactive' : ''}>
                                <td data-label="Kupon Kodu"><span className="uf-airport-code">{c.code}</span></td>
                                <td data-label="Kategori"><span className="pkg-pill">{c.category}</span></td>
                                <td data-label="Kampanya"><strong>{c.title}</strong></td>
                                <td data-label="Geçerlilik" style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>{c.validUntil}</td>
                                <td data-label="Durum">
                                  <span className={`status-badge ${c.active ? 'ok' : 'warn'}`}>
                                    {c.active ? '● Aktif' : '○ Pasif'}
                                  </span>
                                </td>
                                <td data-label="İşlemler">
                                  <div className="adm-actions">
                                    <button
                                      type="button"
                                      className={`adm-btn ${c.active ? 'adm-btn-amber' : 'adm-btn-green-soft'}`}
                                      disabled={!catalogWritable}
                                      onClick={() => saveCatalog(
                                        'coupons',
                                        coupons.map((row) => row.id === c.id ? { ...row, active: !row.active } : row),
                                        `${c.code} kuponu ${c.active ? 'pasifleştirildi' : 'aktifleştirildi'}.`,
                                      )}
                                    >
                                      {c.active ? 'Pasifleştir' : 'Aktifleştir'}
                                    </button>
                                    {isConfirming ? (
                                      <span className="adm-confirm-inline">
                                        Silinsin mi?
                                        <button
                                          type="button"
                                          className="adm-btn adm-btn-red-solid"
                                          style={{ height: 26, padding: '0 8px' }}
                                          disabled={!catalogWritable}
                                          onClick={() => saveCatalog(
                                            'coupons',
                                            coupons.filter((row) => row.id !== c.id),
                                            `✓ ${c.code} kuponu silindi ve canlı siteden kaldırıldı.`
                                          )}
                                        >
                                          Evet, Sil
                                        </button>
                                        <button
                                          type="button"
                                          className="adm-btn adm-btn-ghost"
                                          style={{ height: 26, padding: '0 8px' }}
                                          onClick={() => setPendingCatalogDelete(null)}
                                        >
                                          Vazgeç
                                        </button>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="adm-btn adm-btn-red"
                                        disabled={!catalogWritable}
                                        aria-label={c.code + ' kuponunu sil'}
                                        onClick={() => setPendingCatalogDelete({ section: 'coupons', id: c.id, label: c.code })}
                                      >
                                        <Trash2 size={13} /> Sil
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="adm-form-box">
                    <div className="adm-form-title">
                      <Plus size={16} color="#059669" /> Yeni İndirim Kuponu &amp; Kampanya Oluştur
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newCouponCode.trim() || !newCouponTitle.trim()) return;
                        saveCatalog('coupons', [...coupons, {
                          id: crypto.randomUUID(),
                          code: newCouponCode.trim().toUpperCase(),
                          title: newCouponTitle.trim(),
                          category: newCouponCategory,
                          validUntil: newCouponValidUntil.trim() || '31 Aralık 2027',
                          active: true,
                        }], `✓ ${newCouponCode.trim().toUpperCase()} kuponu canlı siteye eklendi.`, () => {
                          setNewCouponCode('');
                          setNewCouponTitle('');
                        });
                      }}
                      className="panel-form-grid"
                    >
                      <div>
                        <label className="adm-field-lbl">Kupon Kodu</label>
                        <input
                          className="modal-input"
                          required
                          placeholder="Örn: ALMATY500"
                          value={newCouponCode}
                          onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                        />
                      </div>
                      <div>
                        <label className="adm-field-lbl">Kategori</label>
                        <select
                          className="modal-input"
                          value={newCouponCategory}
                          onChange={(e) => setNewCouponCategory(e.target.value as 'Uçak' | 'Otel' | 'Transfer' | 'Tur')}
                        >
                          <option value="Uçak">Uçak</option>
                          <option value="Otel">Otel</option>
                          <option value="Transfer">Transfer</option>
                          <option value="Tur">Tur</option>
                        </select>
                      </div>
                      <div>
                        <label className="adm-field-lbl">Kampanya Başlığı</label>
                        <input
                          className="modal-input"
                          required
                          placeholder="Örn: Almatı Uçuşlarında 500 TL İndirim"
                          value={newCouponTitle}
                          onChange={(e) => setNewCouponTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="adm-field-lbl">Geçerlilik Tarihi</label>
                        <input
                          className="modal-input"
                          placeholder="Örn: 31 Aralık 2027"
                          value={newCouponValidUntil}
                          onChange={(e) => setNewCouponValidUntil(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="submit" className="adm-btn adm-btn-green" style={{ height: 42, width: '100%', fontSize: 13 }} disabled={!catalogWritable}>
                          <Plus size={15} /> Kupon Ekle
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ==================== MODULE 6: SAAS PENDING APPROVALS, USERS & ORGANIZATIONS ==================== */}
              {section === 'agents' && (() => {
                const totalAccounts = Math.max(1, siteUsers.length);
                const activePct = Math.round((activeUsersCount / totalAccounts) * 100);
                const pendingPct = Math.round((pendingUsers.length / totalAccounts) * 100);
                const suspendedPct = Math.max(0, 100 - activePct - pendingPct);
                const maxBar = Math.max(1, ...last7DaysActivity.map((d) => d.count));
                const q = agentsSearch.trim().toLowerCase();
                const filteredPending = pendingUsers.filter((u) =>
                  !q || `${u.firstName} ${u.lastName} ${u.email} ${u.companyName ?? ''}`.toLowerCase().includes(q)
                );
                const filteredManaged = managedUsers.filter((u) =>
                  !q || `${u.firstName} ${u.lastName} ${u.email} ${u.companyName ?? ''}`.toLowerCase().includes(q)
                );
                const filteredOrgs = organizations.filter((o) =>
                  !q || `${o.name} ${o.type}`.toLowerCase().includes(q)
                );

                return (
                <>
                  {/* TOP KPI STATUS PILLS (Çalışıyor / Onay Bekliyor / Askıda) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
                    <button
                      type="button"
                      onClick={() => setAgentsTab('users')}
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: 16,
                        border: '1.5px solid rgba(16, 185, 129, 0.4)',
                        background: 'rgba(16, 185, 129, 0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#047857' }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,0.22)' }} />
                          Çalışıyor (Aktif)
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#065F46', marginTop: 4 }}>{activeUsersCount}</div>
                      </div>
                      <span className="status-badge ok">%{activePct}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAgentsTab('pending')}
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: 16,
                        border: '1.5px solid rgba(245, 158, 11, 0.45)',
                        background: 'rgba(245, 158, 11, 0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#B45309' }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 0 3px rgba(245,158,11,0.22)' }} />
                          Onay Bekliyor
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#92400E', marginTop: 4 }}>{pendingUsers.length}</div>
                      </div>
                      <span className="status-badge warn">{pendingUsers.length > 0 ? 'İncele' : 'Temiz'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAgentsTab('users')}
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: 16,
                        border: '1.5px solid rgba(244, 63, 94, 0.35)',
                        background: 'rgba(244, 63, 94, 0.06)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#BE123C' }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F43F5E' }} />
                          Askıda / Pasif
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#9F1239', marginTop: 4 }}>{suspendedUsersCount}</div>
                      </div>
                      <span className="pkg-pill">{organizations.length} Şirket</span>
                    </button>
                  </div>

                  {/* LIVE SAAS CHARTS ROW (Donut Status Chart + 7-Day Activity Bar Chart) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
                    <div className="panel-card" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <strong style={{ fontSize: 14.5 }}>Hesap &amp; Ekip Durum Grafiği</strong>
                        <span style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>Toplam {siteUsers.length} hesap</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        <svg width="104" height="104" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E2E8F0" strokeWidth="3.8" />
                          <circle
                            cx="18" cy="18" r="15.9" fill="none" stroke="#10B981" strokeWidth="3.8"
                            strokeDasharray={`${activePct} ${100 - activePct}`} strokeDashoffset="25"
                          />
                          {pendingPct > 0 && (
                            <circle
                              cx="18" cy="18" r="15.9" fill="none" stroke="#F59E0B" strokeWidth="3.8"
                              strokeDasharray={`${pendingPct} ${100 - pendingPct}`} strokeDashoffset={25 - activePct}
                            />
                          )}
                          {suspendedPct > 0 && (
                            <circle
                              cx="18" cy="18" r="15.9" fill="none" stroke="#F43F5E" strokeWidth="3.8"
                              strokeDasharray={`${suspendedPct} ${100 - suspendedPct}`} strokeDashoffset={25 - activePct - pendingPct}
                            />
                          )}
                          <text x="18" y="19.8" textAnchor="middle" fill="#0B1E33" fontSize="6.5" fontWeight="800">
                            %{activePct}
                          </text>
                        </svg>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981' }} /> Çalışıyor
                            </span>
                            <strong>{activeUsersCount} (%{activePct})</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F59E0B' }} /> Onay Bekleyen
                            </span>
                            <strong>{pendingUsers.length} (%{pendingPct})</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F43F5E' }} /> Askıda
                            </span>
                            <strong>{suspendedUsersCount} (%{suspendedPct})</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="panel-card" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <strong style={{ fontSize: 14.5 }}>Son 7 Gün Üye &amp; Satış Hareketi</strong>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>Canlı SQLite Verisi</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 96, paddingTop: 10 }}>
                        {last7DaysActivity.map((day, idx) => {
                          const barH = Math.max(10, Math.round((day.count / maxBar) * 68));
                          const isToday = idx === last7DaysActivity.length - 1;
                          return (
                            <div key={day.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: day.count > 0 ? '#047857' : 'var(--aspan-text-muted)' }}>
                                {day.count}
                              </span>
                              <div
                                title={`${day.label}: ${day.count} işlem`}
                                style={{
                                  width: '100%',
                                  maxWidth: 32,
                                  height: barH,
                                  borderRadius: '6px 6px 2px 2px',
                                  background: isToday ? '#10B981' : day.count > 0 ? 'rgba(16, 185, 129, 0.55)' : '#E2E8F0',
                                }}
                              />
                              <span style={{ fontSize: 10.5, fontWeight: isToday ? 800 : 600, color: isToday ? '#047857' : 'var(--aspan-text-muted)' }}>
                                {day.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* SUB-TABS & SEARCH BAR */}
                  <div className="panel-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setAgentsTab('pending')}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: agentsTab === 'pending' ? 'none' : '1px solid var(--aspan-border)',
                          background: agentsTab === 'pending' ? '#0B1E33' : 'var(--aspan-bg-soft)',
                          color: agentsTab === 'pending' ? '#fff' : 'var(--aspan-text)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                        }}
                      >
                        Onay Bekleyenler
                        {pendingUsers.length > 0 && (
                          <span style={{ background: '#10B981', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
                            {pendingUsers.length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAgentsTab('users')}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: agentsTab === 'users' ? 'none' : '1px solid var(--aspan-border)',
                          background: agentsTab === 'users' ? '#0B1E33' : 'var(--aspan-bg-soft)',
                          color: agentsTab === 'users' ? '#fff' : 'var(--aspan-text)',
                        }}
                      >
                        Ekip &amp; Üyeler ({managedUsers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAgentsTab('orgs')}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: agentsTab === 'orgs' ? 'none' : '1px solid var(--aspan-border)',
                          background: agentsTab === 'orgs' ? '#0B1E33' : 'var(--aspan-bg-soft)',
                          color: agentsTab === 'orgs' ? '#fff' : 'var(--aspan-text)',
                        }}
                      >
                        Şirketler &amp; Acenteler ({organizations.length})
                      </button>
                    </div>
                    <input
                      type="text"
                      className="modal-input"
                      style={{ maxWidth: 250, height: 36, fontSize: 12.5 }}
                      placeholder="İsim, şirket veya e-posta ara..."
                      value={agentsSearch}
                      onChange={(e) => setAgentsSearch(e.target.value)}
                    />
                  </div>

                  {/* 1. PENDING CORPORATE APPLICATIONS */}
                  {agentsTab === 'pending' && (
                  <div
                    className="panel-card"
                    style={
                      filteredPending.length > 0
                        ? { border: '1.5px solid #F59E0B', background: 'rgba(245, 158, 11, 0.04)' }
                        : undefined
                    }
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 18 }}>
                        Onay Bekleyen Kurumsal Başvurular
                      </strong>
                      <span className={`status-badge ${filteredPending.length > 0 ? 'warn' : 'ok'}`}>
                        {filteredPending.length > 0 ? `${filteredPending.length} Başvuru Bekliyor` : 'Bekleyen Başvuru Yok'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 0, marginBottom: 14 }}>
                      Siteden kurumsal başvuru yapan kişi ve şirketlere yetki seçip giriş şifresi belirleyerek onaylayabilirsiniz.
                    </p>

                    {filteredPending.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>
                        Yeni kurumsal başvurular geldiğinde burada tarih ve detaylarıyla görünecektir.
                      </div>
                    ) : (
                      filteredPending.map((u) => {
                        const d = getApprovalDraft(u);
                        return (
                          <div
                            key={u.id}
                            style={{
                              padding: 15,
                              borderRadius: 14,
                              border: '1px solid var(--aspan-border)',
                              background: '#fff',
                              marginBottom: 12,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                              <div>
                                <span className="status-badge warn">● Onay Bekliyor</span>{' '}
                                <span className="pkg-pill">{u.companyName || 'Kurumsal Başvuru'}</span>
                                {u.applicantType && (
                                  <span className="pkg-pill" style={{ marginLeft: 4 }}>
                                    {APPLICANT_TYPE_LABELS[u.applicantType] ?? u.applicantType}
                                  </span>
                                )}
                                {u.taxId && (
                                  <span className="pkg-pill" style={{ marginLeft: 4 }}>
                                    Belge/Vergi: {u.taxId}
                                  </span>
                                )}
                                <div style={{ fontWeight: 800, fontSize: 15.5, marginTop: 5 }}>
                                  {u.firstName} {u.lastName}
                                </div>
                                <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                                  {u.email}{u.phone ? ` · ${u.phone}` : ''} ·{' '}
                                  <strong style={{ color: 'var(--aspan-text)' }}>
                                    Başvuru: {formatTrDateTime(u.registeredAt ?? u.createdAt)}
                                  </strong>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="drawer-close"
                                disabled={busy}
                                title="Başvuruyu Reddet ve Sil"
                                aria-label={`${u.email} başvurusunu sil`}
                                onClick={() => void runAction(async () => {
                                  await api.deleteUser(u.id);
                                  setSiteUsers((prev) => prev.filter((row) => row.id !== u.id));
                                  flash(`${u.email} başvurusu reddedildi ve silindi.`);
                                })}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {/* Organization assignment & Role Presets */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 12 }}>
                              <div>
                                <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                                  Bağlanacak Şirket / Acente
                                </label>
                                <select
                                  className="modal-input"
                                  value={d.organizationId}
                                  onChange={(e) => patchApprovalDraft(u, { organizationId: e.target.value })}
                                >
                                  <option value="">
                                    + Yeni Şirket Oluştur ({u.companyName || `${u.firstName} ${u.lastName}`})
                                  </option>
                                  {organizations.map((org) => (
                                    <option key={org.id} value={org.id}>
                                      {org.name} ({org.status === 'active' ? 'Aktif' : 'Askıda'})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                                  Giriş Şifresi Tanımla (En az 12 karakter)
                                </label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <input
                                    type="text"
                                    className="modal-input"
                                    placeholder="Örn: Aspan!7kQ9mX2p"
                                    value={d.password}
                                    onChange={(e) => patchApprovalDraft(u, { password: e.target.value })}
                                  />
                                  <button
                                    type="button"
                                    className="uf-quick-pill"
                                    title="Güçlü Şifre Üret"
                                    onClick={() => patchApprovalDraft(u, { password: generateStrongPassword() })}
                                  >
                                    <KeyRound size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    Üret
                                  </button>
                                  {d.password && (
                                    <button
                                      type="button"
                                      className="uf-quick-pill"
                                      title="Şifreyi Kopyala"
                                      onClick={() => {
                                        void navigator.clipboard?.writeText(d.password);
                                        flash('Şifre panoya kopyalandı.');
                                      }}
                                    >
                                      <Copy size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Role Presets */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--aspan-text-muted)' }}>Hazır Rol Şablonu:</span>
                              {ROLE_PRESETS.map((preset) => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  className="uf-quick-pill"
                                  onClick={() => patchApprovalDraft(u, { permissions: [...preset.perms] })}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>

                            {/* Granular Permission Checkboxes */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                              {PERMISSION_OPTIONS.map((perm) => {
                                const checked = d.permissions.includes(perm.id);
                                return (
                                  <label
                                    key={perm.id}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '5px 10px',
                                      borderRadius: 999,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      border: checked ? '1px solid #10B981' : '1px solid var(--aspan-border)',
                                      background: checked ? 'rgba(16, 185, 129, 0.12)' : 'var(--aspan-bg-soft)',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const next = checked
                                          ? d.permissions.filter((p) => p !== perm.id)
                                          : [...d.permissions, perm.id];
                                        patchApprovalDraft(u, { permissions: next });
                                      }}
                                    />
                                    {perm.label}
                                  </label>
                                );
                              })}
                            </div>

                            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <button
                                type="button"
                                className="btn-gold-nav"
                                disabled={busy || d.password.trim().length < 12}
                                onClick={() => void runAction(async () => {
                                  const { user: approved } = await api.approveUser(u.id, {
                                    password: d.password.trim(),
                                    organizationId: d.organizationId || undefined,
                                    permissions: d.permissions,
                                  });
                                  setSiteUsers((prev) => prev.map((row) => (row.id === u.id ? approved : row)));
                                  const { organizations: refreshedOrgs } = await api.adminOrganizations();
                                  setOrganizations(refreshedOrgs);
                                  flash(`${u.email} onaylandı! Tanımlanan şifre ile giriş yapabilir.`);
                                })}
                              >
                                <UserCheck size={15} /> Onayla &amp; Şifreyi Tanımla
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  )}

                  {/* 2. ACTIVE & SUSPENDED USERS / TEAM MEMBERS */}
                  {agentsTab === 'users' && (
                  <div className="panel-card">
                    <strong style={{ fontSize: 18, display: 'block', marginBottom: 6 }}>
                      Kayıtlı Ekip Üyeleri &amp; Yetki Yönetimi (Canlı Veritabanı)
                    </strong>
                    <p style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 0, marginBottom: 14 }}>
                      Her kullanıcının kayıt tarihini, çalışma durumunu ve yetkilerini görebilir; tek tıkla askıya alabilirsiniz.
                    </p>
                    {filteredManaged.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>Eşleşen kullanıcı bulunamadı.</div>
                    ) : (
                      filteredManaged.map((u) => {
                        const isSelf = currentUser?.id === u.id;
                        const orgName = organizations.find((o) => o.id === u.organizationId)?.name || u.companyName;
                        const isEditing = editingUserId === u.id;
                        const isSuspended = u.status === 'suspended';
                        return (
                          <div
                            key={u.id}
                            style={{
                              padding: 13,
                              borderRadius: 14,
                              border: '1px solid var(--aspan-border)',
                              marginBottom: 9,
                              opacity: isSuspended ? 0.65 : 1,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                              <div>
                                <span
                                  className={`status-badge ${isSuspended ? 'warn' : 'ok'}`}
                                  style={!isSuspended ? { background: 'rgba(16,185,129,0.16)', color: '#047857' } : undefined}
                                >
                                  {isSuspended ? '● Askıda' : '● Çalışıyor'}
                                </span>{' '}
                                <span className="pkg-pill">
                                  {u.role === 'admin' ? 'Süper Yönetici' : u.permissions?.length ? 'Ekip Üyesi' : 'Bireysel Üye'}
                                </span>
                                {orgName && <span className="pkg-pill" style={{ marginLeft: 4 }}>{orgName}</span>}
                                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>
                                  {u.firstName} {u.lastName}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                                  {u.email}{u.phone ? ` · ${u.phone}` : ''} ·{' '}
                                  <strong style={{ color: 'var(--aspan-text)' }}>
                                    Kayıt: {formatTrDateTime(u.registeredAt ?? u.createdAt)}
                                  </strong>
                                </div>
                                {u.role !== 'admin' && u.permissions && u.permissions.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                    {u.permissions.map((perm) => (
                                      <span key={perm} className="pkg-pill" style={{ fontSize: 11 }}>
                                        {PERMISSION_OPTIONS.find((p) => p.id === perm)?.label ?? perm}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {u.role !== 'admin' && (
                                  <button
                                    type="button"
                                    className="uf-quick-pill"
                                    disabled={busy}
                                    onClick={() => {
                                      if (isEditing) {
                                        setEditingUserId(null);
                                      } else {
                                        setEditingUserId(u.id);
                                        setEditPermsDraft([...(u.permissions ?? [])]);
                                      }
                                    }}
                                  >
                                    {isEditing ? 'Kapat' : 'Yetkileri Düzenle'}
                                  </button>
                                )}
                                {!isSelf && (
                                  <>
                                    <button
                                      type="button"
                                      className="uf-quick-pill"
                                      disabled={busy}
                                      onClick={() => void runAction(async () => {
                                        const nextStatus = isSuspended ? 'active' : 'suspended';
                                        const { user: updated } = await api.setUserStatus(u.id, nextStatus);
                                        setSiteUsers((prev) => prev.map((row) => (row.id === u.id ? updated : row)));
                                        flash(`${u.email} ${nextStatus === 'suspended' ? 'askıya alındı ve oturumu sonlandırıldı.' : 'tekrar aktifleştirildi.'}`);
                                      })}
                                    >
                                      <Ban size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                      {isSuspended ? 'Aktifleştir' : 'Askıya Al'}
                                    </button>
                                    <button
                                      type="button"
                                      className="uf-quick-pill"
                                      disabled={busy}
                                      onClick={() => void runAction(async () => {
                                        const nextRole = u.role === 'admin' ? 'member' : 'admin';
                                        const { user: updated } = await api.setUserRole(u.id, nextRole);
                                        setSiteUsers((prev) => prev.map((row) => (row.id === u.id ? updated : row)));
                                        flash(`${u.email} rolü "${nextRole === 'admin' ? 'Yönetici' : 'Üye'}" olarak güncellendi.`);
                                      })}
                                    >
                                      {u.role === 'admin' ? 'Üyeye Düşür' : 'Süper Yönetici Yap'}
                                    </button>
                                    <button
                                      type="button"
                                      className="drawer-close"
                                      disabled={busy}
                                      aria-label={`${u.email} hesabını sil`}
                                      onClick={() => void runAction(async () => {
                                        await api.deleteUser(u.id);
                                        setSiteUsers((prev) => prev.filter((row) => row.id !== u.id));
                                        flash(`${u.email} hesabı silindi.`);
                                      })}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {isEditing && (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--aspan-border)' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                                  {PERMISSION_OPTIONS.map((perm) => {
                                    const checked = editPermsDraft.includes(perm.id);
                                    return (
                                      <label
                                        key={perm.id}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 5,
                                          padding: '4px 9px',
                                          borderRadius: 999,
                                          fontSize: 12,
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          border: checked ? '1px solid #10B981' : '1px solid var(--aspan-border)',
                                          background: checked ? 'rgba(16, 185, 129, 0.12)' : 'var(--aspan-bg-soft)',
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() =>
                                            setEditPermsDraft((prev) =>
                                              checked ? prev.filter((p) => p !== perm.id) : [...prev, perm.id]
                                            )
                                          }
                                        />
                                        {perm.label}
                                      </label>
                                    );
                                  })}
                                </div>
                                <button
                                  type="button"
                                  className="btn-gold-nav"
                                  style={{ height: 34, fontSize: 12.5 }}
                                  disabled={busy}
                                  onClick={() => void runAction(async () => {
                                    const { user: updated } = await api.setUserPermissions(u.id, editPermsDraft);
                                    setSiteUsers((prev) => prev.map((row) => (row.id === u.id ? updated : row)));
                                    setEditingUserId(null);
                                    flash(`${u.email} yetkileri güncellendi.`);
                                  })}
                                >
                                  <Check size={14} /> Yetkileri Kaydet
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  )}

                  {/* 3. SAAS ORGANIZATIONS / B2B AGENCIES (LIVE SQLITE) */}
                  {agentsTab === 'orgs' && (
                  <div className="panel-card">
                    <strong style={{ fontSize: 18, display: 'block', marginBottom: 6 }}>
                      Kayıtlı Şirketler &amp; B2B Alt Acenteler (Canlı SQLite)
                    </strong>
                    <p style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 0, marginBottom: 14 }}>
                      Bir şirketi askıya aldığınızda o şirkete bağlı tüm çalışanların aktif oturumları anında kapatılır.
                    </p>
                    {filteredOrgs.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)', marginBottom: 12 }}>
                        Henüz kayıtlı şirket yok. Aşağıdan yeni şirket ekleyebilir veya bekleyen bir kurumsal başvuruyu onaylayabilirsiniz.
                      </div>
                    ) : (
                      filteredOrgs.map((org) => {
                        const usedPct = org.creditLimitTRY > 0 ? Math.min(100, Math.round((org.usedCreditTRY / org.creditLimitTRY) * 100)) : 0;
                        const ledgerOpen = openLedgerOrgId === org.id;
                        return (
                        <div
                          key={org.id}
                          style={{
                            padding: 14,
                            borderRadius: 14,
                            border: '1px solid var(--aspan-border)',
                            marginBottom: 10,
                            opacity: org.status === 'active' ? 1 : 0.6,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <span className="pkg-pill">
                              {org.type === 'agency' ? 'B2B Alt Acente' : org.type === 'corporate' ? 'Kurumsal Şirket' : 'Merkez Ekip'}
                            </span>{' '}
                            <span className={`status-badge ${org.status === 'active' ? 'ok' : 'warn'}`}>
                              {org.status === 'active' ? '● Çalışıyor' : '● Askıda'}
                            </span>{' '}
                            <span
                              className="pkg-pill"
                              style={{
                                background: org.creditLimitTRY > 0 ? 'rgba(16,185,129,0.14)' : 'rgba(100,116,139,0.12)',
                                color: org.creditLimitTRY > 0 ? '#047857' : '#475569',
                                fontWeight: 800,
                              }}
                            >
                              {org.creditLimitTRY > 0
                                ? `💳 Cari Açık: ${formatPrice(org.creditLimitTRY, currency)}`
                                : '🔒 Cari Kapalı'}
                            </span>
                            {org.discountPercent > 0 && (
                              <span className="pkg-pill" style={{ marginLeft: 4, background: 'rgba(16,185,129,0.12)', color: '#047857' }}>
                                %{org.discountPercent} Özel İndirim
                              </span>
                            )}
                            <div style={{ fontWeight: 800, fontSize: 15.5, marginTop: 4 }}>{org.name}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                              Oluşturulma: <strong style={{ color: 'var(--aspan-text)' }}>{formatTrDateTime(org.createdAt)}</strong> · Modüller:{' '}
                              <strong>{org.allowedModules.map((m) => MODULE_LABELS[m] ?? m).join(', ')}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {org.creditLimitTRY > 0 ? (
                              <div style={{ textAlign: 'right', marginRight: 6 }}>
                                <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>
                                  Kalan: <strong style={{ color: '#059669' }}>{formatPrice(org.remainingCreditTRY, currency)}</strong> / {formatPrice(org.creditLimitTRY, currency)}
                                </div>
                                <div style={{ fontSize: 11, color: org.usedCreditTRY > 0 ? '#D97706' : 'var(--aspan-text-muted)' }}>
                                  Kullanılan Borç: <strong>{formatPrice(org.usedCreditTRY, currency)}</strong> (%{usedPct})
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'right', marginRight: 6, fontSize: 11.5, color: 'var(--aspan-text-muted)', fontWeight: 700 }}>
                                Cari bakiye tanımlı değil
                              </div>
                            )}
                            <button
                              type="button"
                              className="uf-quick-pill"
                              disabled={busy}
                              style={{
                                background: org.creditLimitTRY > 0 ? 'rgba(2,132,199,0.1)' : 'rgba(16,185,129,0.14)',
                                color: org.creditLimitTRY > 0 ? '#0369A1' : '#047857',
                                borderColor: org.creditLimitTRY > 0 ? '#0284C7' : '#10B981',
                              }}
                              onClick={() => {
                                if (editingCariOrgId === org.id) {
                                  setEditingCariOrgId(null);
                                } else {
                                  setEditingCariOrgId(org.id);
                                  setCariLimitDraft(String(org.creditLimitTRY > 0 ? org.creditLimitTRY : 50000));
                                }
                              }}
                            >
                              {editingCariOrgId === org.id
                                ? 'Vazgeç'
                                : org.creditLimitTRY > 0
                                  ? '✎ Cari Limit Düzenle'
                                  : '🔓 Cari Hesap Aç'}
                            </button>
                            {org.creditLimitTRY > 0 && (
                              <button
                                type="button"
                                className="uf-quick-pill"
                                disabled={busy}
                                style={{ background: 'rgba(225,29,72,0.1)', color: '#be123c', borderColor: '#e11d48' }}
                                onClick={() => void runAction(async () => {
                                  const { organization: updated } = await api.updateOrganization(org.id, { creditLimitTRY: 0 });
                                  setOrganizations((prev) => prev.map((row) => (row.id === org.id ? updated : row)));
                                  if (editingCariOrgId === org.id) setEditingCariOrgId(null);
                                  flash(`${org.name} cari hesabı kapatıldı (Limit: ₺0).`);
                                })}
                              >
                                🔒 Cariyi Kapat
                              </button>
                            )}
                            <button
                              type="button"
                              className="uf-quick-pill"
                              disabled={busy}
                              onClick={() => void runAction(async () => {
                                if (ledgerOpen) {
                                  setOpenLedgerOrgId(null);
                                  return;
                                }
                                const { entries } = await api.orgLedger(org.id);
                                setOrgLedgerEntries(entries);
                                setOpenLedgerOrgId(org.id);
                              })}
                            >
                              {ledgerOpen ? 'Ekstreyi Kapat' : 'Cari Ekstre & Tahsilat'}
                            </button>
                            <button
                              type="button"
                              className="uf-quick-pill"
                              disabled={busy}
                              onClick={() => void runAction(async () => {
                                const nextDisc = (org.discountPercent + 2) % 12;
                                const { organization: updated } = await api.updateOrganization(org.id, { discountPercent: nextDisc });
                                setOrganizations((prev) => prev.map((row) => (row.id === org.id ? updated : row)));
                                flash(`${org.name} özel komisyon indirimi %${nextDisc} yapıldı.`);
                              })}
                            >
                              İndirim %{org.discountPercent}
                            </button>
                            <button
                              type="button"
                              className="uf-quick-pill"
                              disabled={busy}
                              onClick={() => void runAction(async () => {
                                const nextStatus = org.status === 'active' ? 'suspended' : 'active';
                                const { organization: updated } = await api.updateOrganization(org.id, { status: nextStatus });
                                setOrganizations((prev) => prev.map((row) => (row.id === org.id ? updated : row)));
                                flash(`${org.name} ${nextStatus === 'suspended' ? 'askıya alındı ve bağlı tüm oturumlar kapatıldı.' : 'aktifleştirildi.'}`);
                              })}
                            >
                              {org.status === 'active' ? 'Askıya Al' : 'Aktifleştir'}
                            </button>
                            <button
                              type="button"
                              className="drawer-close"
                              disabled={busy}
                              aria-label={`${org.name} sil`}
                              onClick={() => void runAction(async () => {
                                await api.deleteOrganization(org.id);
                                setOrganizations((prev) => prev.filter((row) => row.id !== org.id));
                                flash(`${org.name} silindi.`);
                              })}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          </div>

                          {/* Super Admin Inline Cari Limit Editor */}
                          {editingCariOrgId === org.id && (
                            <form
                              style={{
                                marginTop: 10,
                                padding: '10px 12px',
                                borderRadius: 12,
                                background: 'rgba(16,185,129,0.06)',
                                border: '1px solid rgba(16,185,129,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap',
                              }}
                              onSubmit={(e) => {
                                e.preventDefault();
                                const nextLimit = Math.max(0, Math.round(Number(cariLimitDraft) || 0));
                                void runAction(async () => {
                                  const { organization: updated } = await api.updateOrganization(org.id, {
                                    creditLimitTRY: nextLimit,
                                  });
                                  setOrganizations((prev) => prev.map((row) => (row.id === org.id ? updated : row)));
                                  setEditingCariOrgId(null);
                                  flash(
                                    nextLimit > 0
                                      ? `${org.name} cari limiti ₺${nextLimit.toLocaleString('tr-TR')} olarak açıldı / güncellendi.`
                                      : `${org.name} cari hesabı kapatıldı (Limit: ₺0).`
                                  );
                                });
                              }}
                            >
                              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#047857' }}>
                                Cari Bakiye Limiti (TL):
                              </span>
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                className="modal-input"
                                style={{ width: 160, height: 34 }}
                                value={cariLimitDraft}
                                onChange={(e) => setCariLimitDraft(e.target.value)}
                                placeholder="Örn: 50000 (0 = Kapalı)"
                              />
                              <button type="submit" className="btn-gold-nav" style={{ height: 34, fontSize: 12 }} disabled={busy}>
                                ✓ Cari Limiti Kaydet
                              </button>
                            </form>
                          )}

                          {/* Cari Credit Usage Bar */}
                          {org.creditLimitTRY > 0 && (
                            <div style={{ width: '100%', height: 6, borderRadius: 999, background: '#E2E8F0', marginTop: 10, overflow: 'hidden' }}>
                              <div style={{ width: `${usedPct}%`, height: '100%', background: usedPct > 85 ? '#F43F5E' : '#10B981', borderRadius: 999 }} />
                            </div>
                          )}

                          {/* Expandable Cari Ekstre & Payment Form */}
                          {ledgerOpen && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--aspan-border)' }}>
                              <form
                                style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const amt = Math.round(Number(payAmountInput));
                                  if (!amt || amt <= 0) return;
                                  void runAction(async () => {
                                    const { organization: updated, entry } = await api.orgPayment(org.id, {
                                      amount: amt,
                                      description: payDescInput.trim() || 'Cari Tahsilat',
                                    });
                                    setOrganizations((prev) => prev.map((row) => (row.id === org.id ? updated : row)));
                                    setOrgLedgerEntries((prev) => [entry, ...prev]);
                                    flash(`${org.name} hesabına ₺${amt.toLocaleString('tr-TR')} tahsilat işlendi.`);
                                  });
                                }}
                              >
                                <input className="modal-input" style={{ maxWidth: 150, height: 34 }} type="number" min={1} value={payAmountInput} onChange={(e) => setPayAmountInput(e.target.value)} placeholder="Tahsilat (TL)" />
                                <input className="modal-input" style={{ flex: 1, minWidth: 180, height: 34 }} value={payDescInput} onChange={(e) => setPayDescInput(e.target.value)} placeholder="Açıklama (EFT/Havale)" />
                                <button type="submit" className="btn-gold-nav" style={{ height: 34, fontSize: 12 }} disabled={busy}>
                                  + Tahsilat İşle
                                </button>
                              </form>
                              {orgLedgerEntries.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>Bu şirket için henüz cari hareket yok.</div>
                              ) : (
                                orgLedgerEntries.map((le) => (
                                  <div key={le.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--aspan-border)', fontSize: 12 }}>
                                    <div>
                                      <span className={`status-badge ${le.type === 'credit' ? 'ok' : 'warn'}`}>
                                        {le.type === 'credit' ? 'Tahsilat (+)' : 'Satış Borç (-)'}
                                      </span>{' '}
                                      {le.pnr && <span className="uf-airport-code">{le.pnr}</span>}{' '}
                                      <strong>{le.description}</strong>
                                      <span style={{ color: 'var(--aspan-text-muted)', marginLeft: 6 }}>{formatTrDateTime(le.createdAt)}</span>
                                    </div>
                                    <strong style={{ color: le.type === 'credit' ? '#059669' : '#BE123C' }}>
                                      {le.type === 'credit' ? '+' : '-'}{formatPrice(le.amount, currency)}
                                    </strong>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })
                    )}

                    <form
                      className="panel-form-grid"
                      style={{ marginTop: 14 }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newOrgName.trim()) return;
                        void runAction(async () => {
                          const { organization } = await api.createOrganization({
                            name: newOrgName.trim(),
                            type: newOrgType,
                            creditLimitTRY: Math.max(0, Math.round(Number(newOrgLimit) || 0)),
                            allowedModules: newOrgModules,
                          });
                          setOrganizations((prev) => [organization, ...prev]);
                          setNewOrgName('');
                          flash(`${organization.name} şirketi oluşturuldu.`);
                        });
                      }}
                    >
                      <input className="modal-input" placeholder="Şirket / Acente Adı *" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
                      <select className="modal-input" value={newOrgType} onChange={(e) => setNewOrgType(e.target.value as 'agency' | 'corporate' | 'internal')}>
                        <option value="agency">B2B Alt Acente</option>
                        <option value="corporate">Kurumsal Şirket</option>
                        <option value="internal">Merkez Ekip</option>
                      </select>
                      <input className="modal-input" type="number" min={0} placeholder="Cari Limit TL (0 = Cari Kapalı)" value={newOrgLimit} onChange={(e) => setNewOrgLimit(e.target.value)} />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {(['flights', 'hotels', 'transfers', 'tours'] as const).map((mod) => {
                          const checked = newOrgModules.includes(mod);
                          return (
                            <label key={mod} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setNewOrgModules((prev) =>
                                    checked ? prev.filter((m) => m !== mod) : [...prev, mod]
                                  )
                                }
                              />
                              {MODULE_LABELS[mod]}
                            </label>
                          );
                        })}
                      </div>
                      <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }} disabled={busy}>
                        <Plus size={15} /> Şirket Ekle
                      </button>
                    </form>
                  </div>
                  )}
                </>
                );
              })()}

              {/* ==================== MODULE 7: SUPPLIER APIS & XML INTEGRATION HUB ==================== */}
              {section === 'apis' && (
                <>
                  {/* Server Outbound IP Whitelist Banner */}
                  <div className="panel-card" style={{ border: '1.5px solid rgba(214,174,86,0.45)', background: 'linear-gradient(135deg, #061829 0%, #0d2b45 100%)', color: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#f2cf7a', marginBottom: 4 }}>
                          SUNUCU IP WHITELIST BİLGİSİ (XML GÜVENLİK TANIMLAMASI)
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 800 }}>
                          Sunucu Çıkış IP Adresi:{' '}
                          <span style={{ color: '#f2cf7a', fontFamily: 'monospace' }}>
                            {serverInfo?.outboundIp || 'Yükleniyor...'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.76)', marginTop: 4, maxWidth: 680 }}>
                          FUN&amp;SUN, Kompas Tour, Selfie Travel (SAMO XML), Buranus ve BiletBank gibi tedarikçiler XML erişimini açarken sunucunuzun çıkış IP adresini Whitelist&apos;e eklemenizi ister.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-gold-nav"
                        onClick={() => {
                          if (serverInfo?.outboundIp) {
                            void navigator.clipboard?.writeText(serverInfo.outboundIp);
                            flash(`Sunucu IP adresi kopyalandı: ${serverInfo.outboundIp}`);
                          }
                        }}
                      >
                        <Copy size={14} /> IP Adresini Kopyala
                      </button>
                    </div>
                  </div>

                  {/* Persistent Supplier XML/API Connectors */}
                  <div className="panel-card">
                    <strong style={{ fontSize: 18, display: 'block', marginBottom: 6 }}>
                      B2B Tedarikçi XML / API Bağlantıları &amp; Sanal POS Yönetimi
                    </strong>
                    <div className="adm-banner adm-banner-info">
                      <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong>Kalıcı &amp; Güvenli Saklama:</strong> Eklediğiniz tüm XML API URL, Veri Feed/WSDL, API Key, Kullanıcı Adı, Şifre, Acente Kodu, API Dokümantasyonu ve Whitelist IP bilgileri veritabanında saklanır ve halka açık sitede asla görünmez.
                      </div>
                    </div>

                    {managedProviders.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--aspan-text-muted)', fontSize: 13 }}>
                        Henüz kayıtlı XML / API sağlayıcısı yok. Aşağıdaki formdan yeni sağlayıcı ekleyebilirsiniz.
                      </div>
                    ) : (
                      managedProviders.map((prov) => {
                        const isConfirming = pendingCatalogDelete?.section === 'providers' && pendingCatalogDelete.id === prov.id;
                        const revealed = Boolean(revealedSecrets[prov.id]);
                        const testRes = providerTestResults[prov.id];
                        return (
                          <div
                            key={prov.id}
                            style={{
                              padding: 16,
                              borderRadius: 16,
                              border: `1.5px solid ${prov.active ? 'var(--aspan-border)' : '#e2e8f0'}`,
                              background: prov.active ? '#ffffff' : '#f8fafc',
                              opacity: prov.active ? 1 : 0.65,
                              marginBottom: 14,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                  <ShieldCheck size={18} color="#0fa3b1" />
                                  <strong style={{ fontSize: 15.5 }}>{prov.name}</strong>
                                  <span className="pkg-pill">{prov.protocol}</span>
                                  <span className="pkg-pill">{prov.category}</span>
                                  <span className={`status-badge ${prov.mode.includes('Canlı') ? 'ok' : 'warn'}`}>{prov.mode}</span>
                                  <span className={`status-badge ${prov.active ? 'ok' : 'warn'}`}>{prov.active ? '● Aktif' : '○ Pasif'}</span>
                                </div>
                              </div>

                              <div className="adm-actions">
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-blue"
                                  disabled={testRes?.testing}
                                  onClick={() => {
                                    setProviderTestResults((prev) => ({ ...prev, [prov.id]: { ok: false, message: 'Test ediliyor...', testing: true } }));
                                    void api.testProviderConnection(prov.apiUrl)
                                      .then((r) => setProviderTestResults((prev) => ({ ...prev, [prov.id]: { ok: r.ok, message: r.message } })))
                                      .catch((err) => setProviderTestResults((prev) => ({ ...prev, [prov.id]: { ok: false, message: apiMessage(err) } })));
                                  }}
                                >
                                  {testRes?.testing ? 'Test Ediliyor...' : '⚡ Bağlantıyı Test Et'}
                                </button>
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-ghost"
                                  onClick={() => setRevealedSecrets((prev) => ({ ...prev, [prov.id]: !prev[prov.id] }))}
                                >
                                  <KeyRound size={13} /> {revealed ? 'Şifreleri Gizle' : 'Şifreleri Göster'}
                                </button>
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-blue"
                                  disabled={!catalogWritable}
                                  onClick={() => {
                                    setEditingProviderId(prov.id);
                                    setProvName(prov.name);
                                    setProvProtocol(prov.protocol);
                                    setProvCategory(prov.category);
                                    setProvMode(prov.mode);
                                    setProvApiUrl(prov.apiUrl);
                                    setProvXmlFeedUrl(prov.xmlFeedUrl || '');
                                    setProvApiKey(prov.apiKey || '');
                                    setProvUsername(prov.username || '');
                                    setProvPassword(prov.password || '');
                                    setProvAgentCode(prov.agentCode || '');
                                    setProvDocsUrl(prov.docsUrl || '');
                                    setProvWhitelistIp(prov.whitelistIp || serverInfo?.outboundIp || '');
                                    flash(`✎ ${prov.name} bilgileri düzenleme formuna yüklendi — aşağıdan güncelleyip kaydedebilirsiniz.`);
                                    window.setTimeout(() => {
                                      providerFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }, 60);
                                  }}
                                >
                                  ✎ Düzenle
                                </button>
                                <button
                                  type="button"
                                  className={`adm-btn ${prov.active ? 'adm-btn-amber' : 'adm-btn-green-soft'}`}
                                  disabled={!catalogWritable}
                                  onClick={() => saveCatalog(
                                    'providers',
                                    managedProviders.map((r) => (r.id === prov.id ? { ...r, active: !r.active } : r)),
                                    `${prov.name} ${prov.active ? 'pasifleştirildi' : 'aktifleştirildi'}.`
                                  )}
                                >
                                  {prov.active ? 'Pasifleştir' : 'Aktifleştir'}
                                </button>
                                {isConfirming ? (
                                  <span className="adm-confirm-inline">
                                    Silinsin mi?
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-red-solid"
                                      style={{ height: 26, padding: '0 8px' }}
                                      disabled={!catalogWritable}
                                      onClick={() => saveCatalog(
                                        'providers',
                                        managedProviders.filter((r) => r.id !== prov.id),
                                        `✓ ${prov.name} sağlayıcısı silindi.`
                                      )}
                                    >
                                      Evet, Sil
                                    </button>
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-ghost"
                                      style={{ height: 26, padding: '0 8px' }}
                                      onClick={() => setPendingCatalogDelete(null)}
                                    >
                                      Vazgeç
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-red"
                                    disabled={!catalogWritable}
                                    onClick={() => setPendingCatalogDelete({ section: 'providers', id: prov.id, label: prov.name })}
                                  >
                                    <Trash2 size={13} /> Sil
                                  </button>
                                )}
                              </div>
                            </div>

                            {testRes && (
                              <div className={`adm-banner ${testRes.ok ? 'adm-banner-ok' : 'adm-banner-warn'}`} style={{ marginBottom: 12, padding: '8px 12px' }}>
                                <strong>{testRes.ok ? '✓ Bağlantı Başarılı:' : '⚠ Test Sonucu:'}</strong> {testRes.message}
                              </div>
                            )}

                            <div className="panel-form-grid" style={{ gap: 10 }}>
                              <div>
                                <span className="adm-field-lbl">XML / API Erişim URL</span>
                                <div style={{ fontSize: 12.5, fontFamily: 'monospace', wordBreak: 'break-all', padding: '7px 10px', borderRadius: 9, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)' }}>
                                  {prov.apiUrl}
                                </div>
                              </div>
                              {prov.xmlFeedUrl && (
                                <div>
                                  <span className="adm-field-lbl">XML Veri Feed / WSDL Adresi</span>
                                  <div style={{ fontSize: 12.5, fontFamily: 'monospace', wordBreak: 'break-all', padding: '7px 10px', borderRadius: 9, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)' }}>
                                    {prov.xmlFeedUrl}
                                  </div>
                                </div>
                              )}
                              <div>
                                <span className="adm-field-lbl">Acente Kodu / Kullanıcı Adı</span>
                                <div style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 10px', borderRadius: 9, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)' }}>
                                  {prov.agentCode || '—'} {prov.username ? ` · User: ${prov.username}` : ''}
                                </div>
                              </div>
                              <div>
                                <span className="adm-field-lbl">API Key &amp; Şifre</span>
                                <div style={{ fontSize: 12.5, fontFamily: 'monospace', padding: '7px 10px', borderRadius: 9, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)' }}>
                                  Key: {prov.apiKey ? (revealed ? prov.apiKey : '••••••••••••') : 'Girilmedi'} · Pass: {prov.password ? (revealed ? prov.password : '••••••••') : 'Girilmedi'}
                                </div>
                              </div>
                              <div>
                                <span className="adm-field-lbl">Whitelist Sunucu IP &amp; Dokümantasyon</span>
                                <div style={{ fontSize: 12.5, padding: '7px 10px', borderRadius: 9, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span>IP: <strong>{prov.whitelistIp || serverInfo?.outboundIp || 'Tanımlanmadı'}</strong></span>
                                  {prov.docsUrl && (
                                    <a href={prov.docsUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontWeight: 800, textDecoration: 'underline' }}>
                                      📄 API Dokümantasyonu →
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Add / Edit XML & API Supplier Form */}
                    <div
                      ref={providerFormRef}
                      className="adm-form-box"
                      style={editingProviderId ? { borderColor: '#0284c7', background: 'rgba(2,132,199,0.06)', boxShadow: '0 0 0 3px rgba(2,132,199,0.12)' } : undefined}
                    >
                      <div className="adm-form-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Plus size={16} color="#059669" />
                          {editingProviderId ? 'Seçili XML / API Sağlayıcısını Güncelle' : 'Yeni XML / API Sağlayıcısı Ekle'}
                        </span>
                        {editingProviderId && (
                          <button
                            type="button"
                            className="adm-btn adm-btn-ghost"
                            style={{ height: 28 }}
                            onClick={() => {
                              setEditingProviderId(null);
                              setProvName('');
                              setProvApiUrl('');
                              setProvXmlFeedUrl('');
                              setProvApiKey('');
                              setProvUsername('');
                              setProvPassword('');
                              setProvAgentCode('');
                              setProvDocsUrl('');
                            }}
                          >
                            Düzenlemeyi İptal Et
                          </button>
                        )}
                      </div>
                      <form
                        className="panel-form-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!provName.trim() || !provApiUrl.trim()) return;
                          const nextItem = {
                            id: editingProviderId || crypto.randomUUID(),
                            name: provName.trim(),
                            protocol: provProtocol,
                            category: provCategory,
                            mode: provMode,
                            apiUrl: provApiUrl.trim(),
                            xmlFeedUrl: provXmlFeedUrl.trim(),
                            apiKey: provApiKey.trim(),
                            username: provUsername.trim(),
                            password: provPassword.trim(),
                            agentCode: provAgentCode.trim(),
                            docsUrl: provDocsUrl.trim(),
                            whitelistIp: provWhitelistIp.trim(),
                            active: true,
                          };
                          const nextList = editingProviderId
                            ? managedProviders.map((r) => (r.id === editingProviderId ? nextItem : r))
                            : [...managedProviders, nextItem];
                          saveCatalog(
                            'providers',
                            nextList,
                            editingProviderId ? `✓ ${nextItem.name} bilgileri güncellendi.` : `✓ ${nextItem.name} sağlayıcısı eklendi.`,
                            () => {
                              setEditingProviderId(null);
                              setProvName('');
                              setProvApiUrl('');
                              setProvXmlFeedUrl('');
                              setProvApiKey('');
                              setProvUsername('');
                              setProvPassword('');
                              setProvAgentCode('');
                              setProvDocsUrl('');
                            }
                          );
                        }}
                      >
                        <div>
                          <label className="adm-field-lbl">Sağlayıcı Adı *</label>
                          <input className="modal-input" required placeholder="Örn: FUN&SUN, Kompas, Selfie, Amadeus" value={provName} onChange={(e) => setProvName(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Protokol / Tip</label>
                          <select className="modal-input" value={provProtocol} onChange={(e) => setProvProtocol(e.target.value)}>
                            <option value="SAMO XML">SAMO-Tour XML</option>
                            <option value="XML / SOAP">XML / SOAP</option>
                            <option value="REST JSON">REST JSON API</option>
                            <option value="NDC XML">IATA NDC XML</option>
                            <option value="POS 3D">3D Secure POS</option>
                          </select>
                        </div>
                        <div>
                          <label className="adm-field-lbl">Kategori</label>
                          <select className="modal-input" value={provCategory} onChange={(e) => setProvCategory(e.target.value)}>
                            <option value="Tur Operatörü & Charter">Tur Operatörü &amp; Charter</option>
                            <option value="Uçak & GDS">Uçak &amp; GDS</option>
                            <option value="Otel Bedbank">Otel Bedbank</option>
                            <option value="VIP Transfer">VIP Transfer</option>
                            <option value="Sanal POS">Sanal POS</option>
                          </select>
                        </div>
                        <div>
                          <label className="adm-field-lbl">Çalışma Ortamı</label>
                          <select className="modal-input" value={provMode} onChange={(e) => setProvMode(e.target.value)}>
                            <option value="Test / Sandbox">Test / Sandbox</option>
                            <option value="Canlı (Production)">Canlı (Production)</option>
                            <option value="Beklemede">Beklemede</option>
                          </select>
                        </div>
                        <div>
                          <label className="adm-field-lbl">XML / API Erişim URL *</label>
                          <input className="modal-input" required type="url" placeholder="https://online.kompastour.com/export/..." value={provApiUrl} onChange={(e) => setProvApiUrl(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">XML Veri Feed / WSDL Adresi</label>
                          <input className="modal-input" placeholder="https://.../flights.xml (Opsiyonel)" value={provXmlFeedUrl} onChange={(e) => setProvXmlFeedUrl(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">API Key / Bearer Token</label>
                          <input className="modal-input" placeholder="API Anahtarı (Opsiyonel)" value={provApiKey} onChange={(e) => setProvApiKey(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Kullanıcı Adı (Username)</label>
                          <input className="modal-input" placeholder="XML kullanıcı adı" value={provUsername} onChange={(e) => setProvUsername(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Şifre / API Secret</label>
                          <input className="modal-input" type="password" placeholder="XML şifre / secret" value={provPassword} onChange={(e) => setProvPassword(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Acente / Bayi Kodu</label>
                          <input className="modal-input" placeholder="Örn: INF-6199-TR" value={provAgentCode} onChange={(e) => setProvAgentCode(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">API Dokümantasyon Linki</label>
                          <input className="modal-input" placeholder="https://docs... (PDF / Swagger / WSDL)" value={provDocsUrl} onChange={(e) => setProvDocsUrl(e.target.value)} />
                        </div>
                        <div>
                          <label className="adm-field-lbl">Whitelist Sunucu IP</label>
                          <input className="modal-input" placeholder={serverInfo?.outboundIp || 'Sunucu IP adresi'} value={provWhitelistIp} onChange={(e) => setProvWhitelistIp(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button type="submit" className="adm-btn adm-btn-green" style={{ height: 42, width: '100%', fontSize: 13 }} disabled={!catalogWritable}>
                            <Plus size={15} /> {editingProviderId ? 'Sağlayıcıyı Güncelle' : 'Sağlayıcı Ekle'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
