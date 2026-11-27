import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  Clock,
  Download,
  Plus,
  Trash2,
  TrendingUp,
  AlertTriangle,
  Award,
  FileText,
  MessageCircle,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { AIRPORTS, HOTEL_DEALS, detectCharterFlight, formatDisplayDate, formatPrice, generateFlights } from '../data/mockData';
import { addCalendarDays, toCalendarDate } from '../data/calendarDates';
import { api, apiMessage, type AdminCatalog } from '../data/api';
import { openBrandedEticketPdf } from '../utils/eticketPdf';
import type {
  AdminMarkupConfig,
  AuditLogEntry,
  BookingRecord,
  CrmQuote,
  CrmTask,
  CurrencyCode,
  FinanceEntry,
  LangCode,
  UserProfile,
} from '../types';

type ManagedFlightItem = AdminCatalog['flights'][number];
type ManagedHotelItem = AdminCatalog['hotels'][number];
type ManagedTourItem = AdminCatalog['tours'][number];

interface AdminFinanceCrmSectionProps {
  lang: LangCode;
  currency: CurrencyCode;
  markup: AdminMarkupConfig;
  bookings: BookingRecord[];
  siteUsers?: UserProfile[];
  manualFlights?: ManagedFlightItem[];
  managedHotels?: ManagedHotelItem[];
  managedTours?: ManagedTourItem[];
  onBookingCreated?: (booking: BookingRecord) => void;
  onJumpToBookings: (status?: BookingRecord['status'] | 'ALL') => void;
  onFlash: (msg: string) => void;
  onError: (msg: string) => void;
}

interface XmlQuoteOffer {
  id: string;
  type: 'Uçak' | 'Otel' | 'Tur';
  title: string;
  details: string;
  unitPriceTRY: number;
  totalPriceTRY: number;
  netCostTRY: number;
  providerSource: string;
  airline?: string;
  flightNumber?: string;
  departTime?: string;
  arriveTime?: string;
  duration?: string;
  baggage?: string;
  cabin?: string;
  fromCode?: string;
  toCode?: string;
  isCharter?: boolean;
  badge?: string;
}

type FinanceTab = 'finance' | 'ledger' | 'crm' | 'followup' | 'quotes' | 'customers' | 'audit';

const AUDIT_LABELS: Record<string, string> = {
  'admin:pricing_update': 'Komisyon / Fiyat Güncelleme',
  'admin:fx_override': 'Manuel Döviz Kuru Ayarı',
  'admin:fx_reset': 'Canlı Kura Dönüş',
  'admin:booking_status': 'Rezervasyon Durum Değişikliği',
  'admin:checkin_update': 'Online Check-In & Koltuk Güncelleme',
  'admin:checkin_email_sent': 'Online Check-In & Biniş Kartı Maili Gönderildi',
  'admin:booking_delete': 'Rezervasyon Silme',
  'admin:user_approve': 'Kurumsal Başvuru Onayı',
  'admin:user_permissions': 'Yetki Güncelleme',
  'admin:user_suspended': 'Hesap Askıya Alma',
  'admin:user_active': 'Hesap Aktifleştirme',
  'admin:user_role': 'Rol Değişikliği',
  'admin:user_delete': 'Kullanıcı Silme',
  'admin:org_create': 'Yeni Şirket / Acente',
  'admin:org_update': 'Şirket Güncelleme',
  'admin:org_payment': 'B2B Cari Tahsilat',
  'admin:org_delete': 'Şirket Silme',
  'admin:finance_income': 'Ek Gelir Kaydı',
  'admin:finance_expense': 'Gider Kaydı',
  'admin:finance_delete': 'Finans Kaydı Silme',
  'admin:crm_task_create': 'CRM Görev Ekleme',
  'admin:quote_create': 'Yeni Teklif Oluşturma',
  'admin:quote_convert': 'Teklif → Satış / PNR Dönüşümü',
  'auth:corporate_apply': 'Kurumsal Başvuru',
  'auth:password_reset_request': 'Parola Sıfırlama Talebi',
};

function formatTrDateTime(value?: number | string): string {
  if (!value) return '-';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const datePart = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  const hasTime = typeof value === 'number' || (typeof value === 'string' && value.includes('T'));
  if (!hasTime) return datePart;
  const timePart = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function estimateBookingProfit(b: BookingRecord, markup: AdminMarkupConfig): number {
  if (b.status === 'İptal Edildi' || b.status === 'İade Edildi') return 0;
  if (typeof b.profitTRY === 'number' && Number.isFinite(b.profitTRY)) return Math.max(0, b.profitTRY);
  if (typeof b.netCostTRY === 'number' && Number.isFinite(b.netCostTRY)) return Math.max(0, Math.round(b.price - b.netCostTRY));
  if (b.type === 'Transfer') return Math.min(b.price, Math.max(markup.transferAddTRY, Math.round(b.price * 0.1)));
  if (b.type === 'Otel') return Math.round(b.price * (Math.max(5, markup.hotelPercent) / 100));
  const pct = Math.max(6, markup.centralAsiaPercent);
  return Math.max(markup.domesticAddTRY, Math.round(b.price * (pct / 100)));
}

function resolveBookingNetCost(b: BookingRecord, markup: AdminMarkupConfig): number {
  if (typeof b.netCostTRY === 'number' && Number.isFinite(b.netCostTRY)) return b.netCostTRY;
  const estProfit = estimateBookingProfit(b, markup);
  return Math.max(0, Math.round(b.price - estProfit));
}

function resolveProviderSource(b: BookingRecord): string {
  if (b.providerSource) return b.providerSource;
  if (b.demo !== false) return 'Yerel Deneme / Manuel Kayıt';
  return 'Manuel / Tanımsız Kaynak';
}

function parseCarrierAndFlight(subtitle: string): { carrier: string; flightNo: string } {
  const parts = subtitle.split('·').map((s) => s.trim()).filter(Boolean);
  const carrier = parts[0] || subtitle || '-';
  const flightPart = parts.find((p) => /^[A-Z0-9]{2}\s?\d{2,4}$/i.test(p)) || parts[1] || '-';
  return { carrier, flightNo: flightPart };
}

export const AdminFinanceCrmSection: React.FC<AdminFinanceCrmSectionProps> = ({
  lang,
  currency,
  markup,
  bookings,
  siteUsers = [],
  manualFlights = [],
  managedHotels = [],
  managedTours = [],
  onBookingCreated,
  onJumpToBookings,
  onFlash,
  onError,
}) => {
  const [subTab, setSubTab] = useState<FinanceTab>('finance');
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [quotes, setQuotes] = useState<CrmQuote[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  // Detailed Quote Builder form (separate passenger fields + ID/Passport + automatic XML price list)
  const [qFirstName, setQFirstName] = useState('');
  const [qLastName, setQLastName] = useState('');
  const [qBirthDate, setQBirthDate] = useState('1992-05-15');
  const [qDocType, setQDocType] = useState<'kimlik' | 'pasaport'>('pasaport');
  const [qNationality, setQNationality] = useState('Kazakistan');
  const [qPassport, setQPassport] = useState('');
  const [qPassportCountry, setQPassportCountry] = useState('Kazakistan');
  const [qPassportIssue, setQPassportIssue] = useState('');
  const [qPassportExpiry, setQPassportExpiry] = useState('');
  const [qPassportIssuer, setQPassportIssuer] = useState('');
  const [qGender, setQGender] = useState<'F' | 'M'>('F');
  const [qPhone, setQPhone] = useState('');
  const [qEmail, setQEmail] = useState('');
  const [qPaxCount, setQPaxCount] = useState(1);
  const [qType, setQType] = useState<'Uçak' | 'Otel' | 'Tur'>('Uçak');
  const [qFrom, setQFrom] = useState('AYT');
  const [qTo, setQTo] = useState('ALA');
  const [qCabin, setQCabin] = useState<'Ekonomi' | 'Business'>('Ekonomi');
  const [qNights, setQNights] = useState(3);
  const [qDate, setQDate] = useState(() => addCalendarDays(toCalendarDate(new Date()), 14));
  const [selectedXmlOfferId, setSelectedXmlOfferId] = useState('');

  // Automatically pull & sort XML prices (cheapest -> highest) based on service type, route, date & pax
  const xmlOffers = useMemo<XmlQuoteOffer[]>(() => {
    const pax = Math.max(1, Math.min(9, qPaxCount));

    if (qType === 'Uçak') {
      const fromAp = AIRPORTS.find((a) => a.code === qFrom) || AIRPORTS[0];
      const toAp = AIRPORTS.find((a) => a.code === qTo) || AIRPORTS[4];
      const routeTitle = `${fromAp.city} (${fromAp.code}) → ${toAp.city} (${toAp.code})`;
      const offers: XmlQuoteOffer[] = [];

      // 1. Matching active manual/charter XML inventory flights
      manualFlights
        .filter((mf) => mf.active && mf.fromCode.toUpperCase() === qFrom && mf.toCode.toUpperCase() === qTo)
        .forEach((mf) => {
          const unit = Math.round(mf.priceTRY);
          offers.push({
            id: `xml-mf-${mf.id}`,
            type: 'Uçak',
            title: routeTitle,
            details: `${mf.airline} · ${mf.flightNumber} · ${mf.departTime}-${mf.arriveTime} · ${mf.baggage} · ${qCabin} · ${pax} Kişi`,
            unitPriceTRY: unit,
            totalPriceTRY: unit * pax,
            netCostTRY: Math.round(unit * 0.9) * pax,
            providerSource: mf.operator || 'Charter / Blok Koltuk XML',
            airline: mf.airline,
            flightNumber: mf.flightNumber,
            departTime: mf.departTime,
            arriveTime: mf.arriveTime,
            duration: mf.duration,
            baggage: mf.baggage,
            cabin: qCabin,
            fromCode: qFrom,
            toCode: qTo,
            isCharter: true,
            badge: 'CHARTER',
          });
        });

      // 2. Live XML / GDS flight feed
      const generated = generateFlights(qFrom, qTo, qDate, qCabin, lang, markup, currency);
      generated.forEach((f) => {
        const unit = Math.round(f.basePrice);
        const unitNet = Math.round(f.netCostTRY ?? unit * 0.9);
        const bag = f.packages[0]?.checkedBag || '20 kg Bagaj';
        const charterFlag = detectCharterFlight(f);
        offers.push({
          id: `xml-flt-${f.id}`,
          type: 'Uçak',
          title: routeTitle,
          details: `${f.airline} · ${f.flightNumber} · ${f.departTime}-${f.arriveTime} · ${bag} · ${qCabin} · ${pax} Kişi`,
          unitPriceTRY: unit,
          totalPriceTRY: unit * pax,
          netCostTRY: unitNet * pax,
          providerSource: f.providerSource || 'Amadeus GDS XML',
          airline: f.airline,
          flightNumber: f.flightNumber,
          departTime: f.departTime,
          arriveTime: f.arriveTime,
          duration: f.durationLabel,
          baggage: bag,
          cabin: qCabin,
          fromCode: qFrom,
          toCode: qTo,
          isCharter: charterFlag,
          badge: charterFlag ? 'CHARTER' : f.stops === 0 ? 'Direkt' : `${f.stops} Aktarma`,
        });
      });

      return offers.sort((a, b) => a.totalPriceTRY - b.totalPriceTRY);
    }

    if (qType === 'Otel') {
      const sourceHotels = managedHotels.filter((h) => h.active);
      const list = sourceHotels.length > 0
        ? sourceHotels
        : HOTEL_DEALS.map((h) => ({
            id: h.id,
            city: h.city,
            name: h.name,
            stars: h.stars,
            boardType: h.boardType,
            nights: h.nights,
            price: h.price,
            active: true,
          }));
      return list
        .map((h) => {
          const baseNights = Math.max(1, h.nights || 2);
          const perNight = h.price / baseNights;
          const unit = Math.round((perNight * qNights) / 10) * 10;
          return {
            id: `xml-htl-${h.id}`,
            type: 'Otel' as const,
            title: `${h.name} (${h.city})`,
            details: `${h.stars}★ · ${h.boardType} · ${qNights} Gece · ${pax} Kişi`,
            unitPriceTRY: unit,
            totalPriceTRY: unit * pax,
            netCostTRY: Math.round(unit * (1 - Math.max(5, markup.hotelPercent) / 100)) * pax,
            providerSource: (h as ManagedHotelItem).provider || 'Hotelbeds / TBO XML',
            badge: `${h.stars}★ ${h.boardType}`,
          };
        })
        .sort((a, b) => a.totalPriceTRY - b.totalPriceTRY);
    }

    // Paket Tur
    const sourceTours = managedTours.filter((t) => t.active);
    return sourceTours
      .map((t) => {
        const unit = Math.round(t.price);
        return {
          id: `xml-tur-${t.id}`,
          type: 'Tur' as const,
          title: `${t.title} (${t.city})`,
          details: `${t.duration} · ${t.includes || ''} · ${pax} Kişi`,
          unitPriceTRY: unit,
          totalPriceTRY: unit * pax,
          netCostTRY: Math.round(unit * 0.9) * pax,
          providerSource: t.provider || 'SAMO-Tour / Kompas XML',
          duration: t.duration,
          badge: t.city,
        };
      })
      .sort((a, b) => a.totalPriceTRY - b.totalPriceTRY);
  }, [qType, qFrom, qTo, qDate, qCabin, qNights, qPaxCount, manualFlights, managedHotels, managedTours, lang, markup, currency]);

  const selectedXmlOffer = useMemo(
    () => xmlOffers.find((o) => o.id === selectedXmlOfferId) ?? xmlOffers[0] ?? null,
    [xmlOffers, selectedXmlOfferId]
  );
  const isSelectedOfferCharter = Boolean(selectedXmlOffer?.isCharter);
  const effectiveQuoteDocType: 'kimlik' | 'pasaport' = isSelectedOfferCharter ? 'pasaport' : qDocType;

  // Customer 360 & Audit search
  const [custSearch, setCustSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Finance entry form
  const [fType, setFType] = useState<'expense' | 'income'>('expense');
  const [fCategory, setFCategory] = useState('Reklam & Pazarlama');
  const [fTitle, setFTitle] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fDate, setFDate] = useState(() => toCalendarDate(new Date()));

  // Ledger filter
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatus, setLedgerStatus] = useState<'ALL' | BookingRecord['status']>('ALL');

  // CRM task form
  const [tTitle, setTTitle] = useState('');
  const [tCustomer, setTCustomer] = useState('');
  const [tPnr, setTPnr] = useState('');
  const [tDueDate, setTDueDate] = useState(() => addCalendarDays(toCalendarDate(new Date()), 1));
  const [tPriority, setTPriority] = useState<'high' | 'normal' | 'low'>('normal');

  useEffect(() => {
    const controller = new AbortController();
    api.adminFinance(controller.signal)
      .then(({ entries: list }) => { if (!controller.signal.aborted) setEntries(list); })
      .catch(() => { /* ignore */ });
    api.adminCrmTasks(controller.signal)
      .then(({ tasks: list }) => { if (!controller.signal.aborted) setTasks(list); })
      .catch(() => { /* ignore */ });
    api.adminCrmQuotes(controller.signal)
      .then(({ quotes: list }) => { if (!controller.signal.aborted) setQuotes(list); })
      .catch(() => { /* ignore */ });
    api.adminAuditLogs(controller.signal)
      .then(({ logs }) => { if (!controller.signal.aborted) setAuditLogs(logs); })
      .catch(() => { /* ignore */ });
    return () => controller.abort();
  }, []);

  // Customer 360° Directory (aggregated from live bookings + siteUsers)
  const customers360 = useMemo(() => {
    const map = new Map<string, {
      key: string;
      name: string;
      email: string;
      phone: string;
      company: string;
      bookings: BookingRecord[];
      totalSpendTRY: number;
      lastDate: string;
    }>();
    siteUsers.forEach((u) => {
      const name = `${u.firstName} ${u.lastName}`.trim();
      const key = name.toLowerCase();
      map.set(key, {
        key,
        name,
        email: u.email,
        phone: u.phone || '',
        company: u.companyName || '',
        bookings: [],
        totalSpendTRY: 0,
        lastDate: u.createdAt || '',
      });
    });
    bookings.forEach((b) => {
      const cleanName = b.passenger.replace(/\s*\(\+\d+\)$/, '').trim();
      const key = cleanName.toLowerCase();
      const existing = map.get(key) ?? {
        key,
        name: cleanName,
        email: '',
        phone: '',
        company: b.organizationName || '',
        bookings: [],
        totalSpendTRY: 0,
        lastDate: b.date,
      };
      existing.bookings.push(b);
      if (b.status !== 'İptal Edildi' && b.status !== 'İade Edildi') {
        existing.totalSpendTRY += b.price;
      }
      if (b.date > existing.lastDate) existing.lastDate = b.date;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.totalSpendTRY - a.totalSpendTRY || b.bookings.length - a.bookings.length);
  }, [bookings, siteUsers]);

  // Zero-bug accounting metrics (cancelled & refunded excluded from gross/profit)
  const confirmedBookings = useMemo(
    () => bookings.filter((b) => b.status === 'Onaylandı' || b.status === 'Tamamlandı'),
    [bookings]
  );
  const cancelledOrRefunded = useMemo(
    () => bookings.filter((b) => b.status === 'İptal Edildi' || b.status === 'İade Edildi'),
    [bookings]
  );
  const pendingCancellations = useMemo(
    () => bookings.filter((b) => b.status === 'İptal Talebi'),
    [bookings]
  );

  const grossSalesTRY = useMemo(
    () => confirmedBookings.reduce((s, b) => s + b.price, 0),
    [confirmedBookings]
  );
  const totalXmlCostTRY = useMemo(
    () => confirmedBookings.reduce((s, b) => s + resolveBookingNetCost(b, markup), 0),
    [confirmedBookings, markup]
  );
  const netCommissionProfitTRY = useMemo(
    () => confirmedBookings.reduce((s, b) => s + estimateBookingProfit(b, markup), 0),
    [confirmedBookings, markup]
  );
  const manualIncomeTRY = useMemo(
    () => entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0),
    [entries]
  );
  const totalExpensesTRY = useMemo(
    () => entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0),
    [entries]
  );
  const refundLossTRY = useMemo(
    () => cancelledOrRefunded.reduce((s, b) => s + b.price, 0),
    [cancelledOrRefunded]
  );
  const cancelRatePct = bookings.length > 0
    ? Math.round((cancelledOrRefunded.length / bookings.length) * 100)
    : 0;
  const netCashTRY = netCommissionProfitTRY + manualIncomeTRY - totalExpensesTRY;

  // Product breakdown (all 4 products: Flight, Hotel, Transfer, Tour)
  const productTotals = useMemo(() => {
    const flight = confirmedBookings.filter((b) => b.type === 'Uçak').reduce((s, b) => s + b.price, 0);
    const hotel = confirmedBookings.filter((b) => b.type === 'Otel').reduce((s, b) => s + b.price, 0);
    const transfer = confirmedBookings.filter((b) => b.type === 'Transfer').reduce((s, b) => s + b.price, 0);
    const tour = confirmedBookings.filter((b) => b.type === 'Tur').reduce((s, b) => s + b.price, 0);
    const total = Math.max(1, flight + hotel + transfer + tour);
    return {
      flight,
      hotel,
      transfer,
      tour,
      flightPct: Math.round((flight / total) * 100),
      hotelPct: Math.round((hotel / total) * 100),
      transferPct: Math.round((transfer / total) * 100),
      tourPct: Math.round((tour / total) * 100),
    };
  }, [confirmedBookings]);

  // Last 7 days dual-bar chart (Income vs Expense/Refund)
  const last7DaysFinance = useMemo(() => {
    const days: { key: string; label: string; income: number; outflow: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      const label = i === 0 ? 'Bugün' : dt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
      days.push({ key, label, income: 0, outflow: 0 });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    bookings.forEach((b) => {
      const key = b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : b.date?.slice(0, 10);
      const hit = key ? map.get(key) : undefined;
      if (!hit) return;
      if (b.status === 'İptal Edildi' || b.status === 'İade Edildi') hit.outflow += b.price;
      else if (b.status === 'Onaylandı' || b.status === 'Tamamlandı') hit.income += b.price;
    });
    entries.forEach((e) => {
      const hit = map.get(e.entryDate);
      if (!hit) return;
      if (e.type === 'income') hit.income += e.amount;
      else hit.outflow += e.amount;
    });
    return days;
  }, [bookings, entries]);

  // 360° Filtered Ledger
  const filteredLedger = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    return bookings.filter((b) => {
      if (ledgerStatus !== 'ALL' && b.status !== ledgerStatus) return false;
      if (!q) return true;
      const hay = `${b.pnr} ${b.passenger} ${b.title} ${b.subtitle} ${b.providerSource ?? ''} ${b.sellerName ?? ''} ${b.sellerEmail ?? ''} ${b.organizationName ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bookings, ledgerSearch, ledgerStatus]);

  // CRM Agent & Company Leaderboard
  const leaderboard = useMemo(() => {
    const map = new Map<string, {
      key: string;
      seller: string;
      company: string;
      salesCount: number;
      cancelCount: number;
      grossTRY: number;
      profitTRY: number;
    }>();
    bookings.forEach((b) => {
      const seller = b.sellerName || b.sellerEmail || 'Web Direkt (B2C)';
      const company = b.organizationName || 'FlyToAspan.com';
      const key = `${seller}::${company}`;
      const row = map.get(key) ?? {
        key,
        seller,
        company,
        salesCount: 0,
        cancelCount: 0,
        grossTRY: 0,
        profitTRY: 0,
      };
      if (b.status === 'İptal Edildi' || b.status === 'İade Edildi') {
        row.cancelCount += 1;
      } else {
        row.salesCount += 1;
        row.grossTRY += b.price;
        row.profitTRY += estimateBookingProfit(b, markup);
      }
      map.set(key, row);
    });
    return Array.from(map.values()).sort((a, b) => b.grossTRY - a.grossTRY);
  }, [bookings, markup]);

  // Upcoming departures in next 72 hours
  const upcoming72h = useMemo(() => {
    const today = toCalendarDate(new Date());
    const limit = addCalendarDays(today, 3);
    return bookings.filter((b) => b.status === 'Onaylandı' && b.date >= today && b.date <= limit);
  }, [bookings]);

  const openTasksCount = tasks.filter((t) => t.status === 'open').length;
  const followUpBadgeCount = openTasksCount + upcoming72h.length + pendingCancellations.length;

  const handleAddFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !fTitle.trim() || !Number(fAmount)) return;
    setBusy(true);
    onError('');
    try {
      const { entry } = await api.createFinanceEntry({
        type: fType,
        category: fCategory,
        title: fTitle.trim(),
        amount: Math.round(Number(fAmount)),
        entryDate: fDate,
      });
      setEntries((prev) => [entry, ...prev]);
      setFTitle('');
      setFAmount('');
      onFlash(`${fType === 'income' ? 'Gelir' : 'Gider'} kaydı SQLite finans defterine eklendi.`);
    } catch (err) {
      onError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFinance = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteFinanceEntry(id);
      setEntries((prev) => prev.filter((row) => row.id !== id));
      onFlash('Finans kaydı silindi.');
    } catch (err) {
      onError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !tTitle.trim()) return;
    setBusy(true);
    onError('');
    try {
      const { task } = await api.createCrmTask({
        title: tTitle.trim(),
        customerName: tCustomer.trim(),
        pnr: tPnr.trim().toUpperCase(),
        dueDate: tDueDate,
        priority: tPriority,
      });
      setTasks((prev) => [task, ...prev]);
      setTTitle('');
      setTCustomer('');
      setTPnr('');
      onFlash('CRM takip görevi eklendi.');
    } catch (err) {
      onError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleExportLedgerCsv = () => {
    const headers = ['Satis_Tarihi', 'Satan', 'Sirket', 'Yolcu', 'PNR', 'Tip', 'XML_Kaynagi', 'Firma', 'Ucus_No', 'Guzergah', 'Ucus_Tarihi', 'XML_Alis_TRY', 'Satis_TRY', 'Net_Kar_TRY', 'Durum'];
    const rows = filteredLedger.map((b) => {
      const { carrier, flightNo } = parseCarrierAndFlight(b.subtitle);
      return [
        `"${formatTrDateTime(b.createdAt)}"`,
        `"${b.sellerName || b.sellerEmail || 'Web Direkt (B2C)'}"`,
        `"${b.organizationName || 'FlyToAspan.com'}"`,
        `"${b.passenger}"`,
        b.pnr,
        b.type,
        `"${resolveProviderSource(b)}"`,
        `"${carrier}"`,
        `"${flightNo}"`,
        `"${b.title}"`,
        b.date,
        resolveBookingNetCost(b, markup),
        b.price,
        estimateBookingProfit(b, markup),
        b.status,
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlyToAspan_Finans_CRM_Defteri_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onFlash('360° Finans & Satış defteri CSV olarak indirildi.');
  };

  const maxDayVal = Math.max(1, ...last7DaysFinance.map((d) => Math.max(d.income, d.outflow)));
  const maxLeaderGross = Math.max(1, ...leaderboard.map((l) => l.grossTRY));

  return (
    <>
      {/* SUB-TABS NAVIGATION */}
      <div className="panel-card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div className="adm-subtab-bar" role="tablist">
          {(
            [
              { id: 'finance', label: '1. Günlük Finans' },
              { id: 'ledger', label: `2. 360° Satış (${bookings.length})` },
              { id: 'crm', label: `3. Ekip Liderlik` },
              { id: 'followup', label: '4. Takip Listesi', badge: followUpBadgeCount },
              { id: 'quotes', label: `5. Teklifler (${quotes.length})` },
              { id: 'customers', label: `6. Müşteri 360° (${customers360.length})` },
              { id: 'audit', label: '7. Güvenlik & Log' },
            ] as { id: FinanceTab; label: string; badge?: number }[]
          ).map((tab) => {
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`adm-subtab ${active ? 'active' : ''}`}
                onClick={() => setSubTab(tab.id)}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span style={{ background: '#10B981', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11.5, fontWeight: 800 }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================== TAB 1: DAILY FINANCE & P&L CHARTS ==================== */}
      {subTab === 'finance' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div className="panel-stat-card">
              <div className="filter-label">Brüt Satış Hacmi (TTV)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--aspan-text)' }}>{formatPrice(grossSalesTRY, currency)}</div>
              <div style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>● {confirmedBookings.length} Onaylı / Tamamlanan</div>
            </div>
            <div className="panel-stat-card" style={{ border: '1.5px solid rgba(2,132,199,0.3)', background: 'rgba(2,132,199,0.04)' }}>
              <div className="filter-label" style={{ color: '#0369A1' }}>Toplam XML Alış Maliyeti</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0369A1' }}>{formatPrice(totalXmlCostTRY, currency)}</div>
              <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>Tedarikçi net bilet / otel maliyeti</div>
            </div>
            <div className="panel-stat-card" style={{ border: '1.5px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.05)' }}>
              <div className="filter-label" style={{ color: '#047857' }}>Net Kâr (Satış − XML Alış)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#059669' }}>+{formatPrice(netCommissionProfitTRY, currency)}</div>
              <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>Ek gelir: +{formatPrice(manualIncomeTRY, currency)}</div>
            </div>
            <div className="panel-stat-card">
              <div className="filter-label">Operasyonel Giderler</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#D97706' }}>-{formatPrice(totalExpensesTRY, currency)}</div>
              <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>Net Kasa: <strong style={{ color: netCashTRY >= 0 ? '#059669' : '#BE123C' }}>{netCashTRY >= 0 ? '+' : ''}{formatPrice(netCashTRY, currency)}</strong></div>
            </div>
            <div className="panel-stat-card" style={{ border: '1.5px solid rgba(244,63,94,0.35)' }}>
              <div className="filter-label" style={{ color: '#BE123C' }}>İptal &amp; İade Tutarı</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#BE123C' }}>{formatPrice(refundLossTRY, currency)}</div>
              <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>{cancelledOrRefunded.length} kayıt (İptal oranı %{cancelRatePct})</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14, marginBottom: 14 }}>
            {/* Dual-bar 7-day Income vs Outflow Chart */}
            <div className="panel-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <strong style={{ fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <BarChart3 size={16} color="#10B981" /> Son 7 Gün Gelir / Gider &amp; İade Grafiği
                </strong>
                <div style={{ display: 'flex', gap: 10, fontSize: 11.5, fontWeight: 700 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#059669' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: '#10B981' }} /> Gelir
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#BE123C' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: '#F43F5E' }} /> Gider / İade
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 126, paddingTop: 12 }}>
                {last7DaysFinance.map((d, idx) => {
                  const incH = d.income > 0 ? Math.max(10, Math.round((d.income / maxDayVal) * 86)) : 4;
                  const outH = d.outflow > 0 ? Math.max(10, Math.round((d.outflow / maxDayVal) * 86)) : 4;
                  const isToday = idx === last7DaysFinance.length - 1;
                  return (
                    <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
                        <div
                          title={`${d.label} Gelir: ${formatPrice(d.income, currency)}`}
                          style={{ width: 13, height: incH, borderRadius: '4px 4px 1px 1px', background: d.income > 0 ? '#10B981' : '#E2E8F0' }}
                        />
                        <div
                          title={`${d.label} Gider/İade: ${formatPrice(d.outflow, currency)}`}
                          style={{ width: 13, height: outH, borderRadius: '4px 4px 1px 1px', background: d.outflow > 0 ? '#F43F5E' : '#E2E8F0' }}
                        />
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: isToday ? 800 : 600, color: isToday ? '#047857' : 'var(--aspan-text-muted)' }}>
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Product Revenue Breakdown */}
            <div className="panel-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
              <strong style={{ fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={16} color="#00A8B5" /> Ürün Bazlı Ciro Dağılımı
              </strong>
              {[
                { label: '✈ Uçak Bileti', amount: productTotals.flight, pct: productTotals.flightPct, color: '#10B981' },
                { label: '🏨 Otel Konaklama', amount: productTotals.hotel, pct: productTotals.hotelPct, color: '#F59E0B' },
                ...(productTotals.transfer > 0
                  ? [{ label: '🚐 VIP Transfer', amount: productTotals.transfer, pct: productTotals.transferPct, color: '#0284C7' }]
                  : []),
                { label: '🧭 Paket Tur', amount: productTotals.tour, pct: productTotals.tourPct, color: '#7C3AED' },
              ].map((row) => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span>{row.label}</span>
                    <strong>{formatPrice(row.amount, currency)} (%{row.pct})</strong>
                  </div>
                  <div style={{ width: '100%', height: 8, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ width: `${row.pct}%`, height: '100%', background: row.color, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--aspan-border)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--aspan-text-muted)' }}>Net Acente Kasası (Kâr + Ek Gelir - Gider)</span>
                <strong style={{ color: netCashTRY >= 0 ? '#059669' : '#BE123C' }}>
                  {netCashTRY >= 0 ? '+' : ''}{formatPrice(netCashTRY, currency)}
                </strong>
              </div>
            </div>
          </div>

          {/* Manual Income / Expense Ledger */}
          <div className="panel-card">
            <strong style={{ fontSize: 17, display: 'block', marginBottom: 6 }}>
              Gelir &amp; Gider Defteri (Kalıcı SQLite)
            </strong>
            <p style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 0, marginBottom: 12 }}>
              Reklam, GDS/API maliyeti, ofis kirası, personel primi veya ek hizmet gelirlerini buradan işleyebilirsiniz.
            </p>
            <form className="panel-form-grid" onSubmit={handleAddFinance} style={{ marginBottom: 16 }}>
              <select className="modal-input" value={fType} onChange={(e) => setFType(e.target.value as 'expense' | 'income')}>
                <option value="expense">Gider (-)</option>
                <option value="income">Ek Gelir (+)</option>
              </select>
              <select className="modal-input" value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
                <option value="Reklam & Pazarlama">Reklam &amp; Pazarlama</option>
                <option value="GDS / API Ücreti">GDS / API Ücreti</option>
                <option value="Personel & Prim">Personel &amp; Prim</option>
                <option value="Ofis & Sabit Gider">Ofis &amp; Sabit Gider</option>
                <option value="Ek Hizmet Geliri">Ek Hizmet Geliri</option>
                <option value="Diğer">Diğer</option>
              </select>
              <input className="modal-input" required placeholder="Açıklama (Örn: Google Ads Kasım)" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
              <input className="modal-input" required type="number" min={1} placeholder="Tutar (TL)" value={fAmount} onChange={(e) => setFAmount(e.target.value)} />
              <input className="modal-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }} disabled={busy}>
                <Plus size={15} /> Kaydet
              </button>
            </form>

            {entries.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>Henüz manuel gelir veya gider kaydı eklenmedi.</div>
            ) : (
              entries.map((e) => (
                <div
                  key={e.id}
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
                    <span className={`status-badge ${e.type === 'income' ? 'ok' : 'warn'}`}>
                      {e.type === 'income' ? 'Gelir (+)' : 'Gider (-)'}
                    </span>{' '}
                    <span className="pkg-pill">{e.category}</span>{' '}
                    <strong>{e.title}</strong>
                    <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginTop: 2 }}>
                      Tarih: {formatDisplayDate(e.entryDate, lang)} · Ekleyen: {e.createdBy}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong style={{ fontSize: 15, color: e.type === 'income' ? '#059669' : '#BE123C' }}>
                      {e.type === 'income' ? '+' : '-'}{formatPrice(e.amount, currency)}
                    </strong>
                    <button
                      type="button"
                      className="drawer-close"
                      disabled={busy}
                      aria-label={`${e.title} sil`}
                      onClick={() => void handleDeleteFinance(e.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ==================== TAB 2: 360° SALES, FLIGHT & PNR LEDGER ==================== */}
      {subTab === 'ledger' && (
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <strong style={{ fontSize: 17.5 }}>360° Satış, Uçuş No, Havayolu &amp; Ekip Takip Defteri</strong>
              <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                Ne zaman satıldı, kim sattı, hangi şirketten, satın alan yolcu, havayolu, uçuş numarası ve net kâr tek tabloda.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="modal-input"
                style={{ minWidth: 250, width: 270, height: 38, fontSize: 13 }}
                placeholder="PNR, yolcu, uçuş, ekip ara..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />
              <select
                className="modal-input"
                style={{ width: 150, height: 36, fontSize: 12.5 }}
                value={ledgerStatus}
                onChange={(e) => setLedgerStatus(e.target.value as 'ALL' | BookingRecord['status'])}
              >
                <option value="ALL">Tüm Durumlar</option>
                <option value="Onaylandı">Onaylandı</option>
                <option value="Tamamlandı">Tamamlandı</option>
                <option value="İptal Talebi">İptal Talebi</option>
                <option value="İptal Edildi">İptal Edildi</option>
                <option value="İade Edildi">İade Edildi</option>
              </select>
              <button type="button" className="uf-quick-pill" onClick={handleExportLedgerCsv}>
                <Download size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                CSV İndir
              </button>
            </div>
          </div>

          {filteredLedger.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>Eşleşen satış kaydı bulunamadı.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--aspan-border)', color: 'var(--aspan-text-muted)' }}>
                    <th style={{ padding: '8px 8px 8px 0' }}>Satış Tarih / Saat</th>
                    <th style={{ padding: '8px' }}>Satan &amp; Şirket</th>
                    <th style={{ padding: '8px' }}>Satın Alan / PNR</th>
                    <th style={{ padding: '8px' }}>Firma, Uçuş &amp; XML Kaynağı</th>
                    <th style={{ padding: '8px' }}>Güzergâh / Tarih</th>
                    <th style={{ padding: '8px' }}>XML Alış / Satış / Net Kâr</th>
                    <th style={{ padding: '8px 0 8px 8px', textAlign: 'right' }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((b) => {
                    const { carrier, flightNo } = parseCarrierAndFlight(b.subtitle);
                    const netCost = resolveBookingNetCost(b, markup);
                    const profit = estimateBookingProfit(b, markup);
                    const xmlSource = resolveProviderSource(b);
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--aspan-border)' }}>
                        <td style={{ padding: '10px 8px 10px 0', whiteSpace: 'nowrap' }}>
                          <strong>{formatTrDateTime(b.createdAt)}</strong>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <strong>{b.sellerName || b.sellerEmail || 'Web Direkt (B2C)'}</strong>
                          <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>
                            {b.organizationName || 'FlyToAspan.com'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <strong>{b.passenger}</strong>
                          <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>
                            PNR: {b.pnr}{b.eticketNumber ? ` · ${b.eticketNumber}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <strong>{b.airline || carrier}</strong>
                          <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>
                            {b.type === 'Uçak' ? `Uçuş: ${b.flightNumber || flightNo}` : b.type}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', marginTop: 2 }}>
                            🔌 {xmlSource}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <strong>{b.title}</strong>
                          <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>
                            {formatDisplayDate(b.date, lang)}{b.returnDate ? ` → ${formatDisplayDate(b.returnDate, lang)}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>
                            Alış: <strong>{formatPrice(netCost, currency)}</strong>
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--aspan-text)' }}>
                            Satış: {formatPrice(b.price, currency)}
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 800, color: profit > 0 ? '#059669' : '#BE123C' }}>
                            {profit > 0 ? `+${formatPrice(profit, currency)} Net Kâr` : 'Kâr yok'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 0 10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span className={`status-badge ${b.status === 'Onaylandı' || b.status === 'Tamamlandı' ? 'ok' : 'warn'}`}>
                            {b.status}
                          </span>{' '}
                          <button
                            type="button"
                            className="uf-quick-pill"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => openBrandedEticketPdf(b, { currency, lang })}
                          >
                            PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: CRM AGENT & COMPANY LEADERBOARD ==================== */}
      {subTab === 'crm' && (
        <div className="panel-card">
          <strong style={{ fontSize: 17.5, display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Award size={18} color="#E0AA36" /> CRM Ekip &amp; Şirket Satış Liderlik Tablosu
          </strong>
          <p style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 0, marginBottom: 14 }}>
            Hangi ekip üyesi veya alt acente kaç satış yaptı, ne kadar net kâr kazandırdı ve iptal oranı nedir canlı olarak izleyin.
          </p>
          {leaderboard.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>Henüz satış verisi bulunmuyor.</div>
          ) : (
            leaderboard.map((row, idx) => {
              const totalTx = row.salesCount + row.cancelCount;
              const cancelPct = totalTx > 0 ? Math.round((row.cancelCount / totalTx) * 100) : 0;
              const barPct = Math.max(8, Math.round((row.grossTRY / maxLeaderGross) * 100));
              return (
                <div
                  key={row.key}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid var(--aspan-border)',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <span className="pkg-pill">#{idx + 1}</span>{' '}
                      <strong style={{ fontSize: 15 }}>{row.seller}</strong>{' '}
                      <span style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>· {row.company}</span>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginTop: 4 }}>
                        {row.salesCount} Onaylı Satış · {row.cancelCount} İptal/İade (İptal Oranı: %{cancelPct})
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: 16 }}>{formatPrice(row.grossTRY, currency)}</strong>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>
                        Net Kâr: +{formatPrice(row.profitTRY, currency)}
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 7, borderRadius: 999, background: '#E2E8F0', marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${barPct}%`, height: '100%', background: idx === 0 ? '#10B981' : '#00A8B5', borderRadius: 999 }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ==================== TAB 4: CRM FOLLOW-UP & UPCOMING FLIGHTS ==================== */}
      {subTab === 'followup' && (
        <>
          {/* Automatic Operational Alerts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="panel-card" style={{ marginBottom: 0 }}>
              <strong style={{ fontSize: 15.5, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Clock size={16} color="#D97706" /> Gelecek 72 Saat — Uçuşu Yaklaşanlar ({upcoming72h.length})
              </strong>
              {upcoming72h.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>Önümüzdeki 72 saat içinde kalkışı olan onaylı bilet yok.</div>
              ) : (
                upcoming72h.map((b) => (
                  <div key={b.id} style={{ padding: '9px 11px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', marginBottom: 8, fontSize: 12.5 }}>
                    <strong>{b.passenger}</strong> · <span className="uf-airport-code">{b.pnr}</span>
                    <div style={{ color: 'var(--aspan-text-muted)', marginTop: 2 }}>
                      {b.title} · {formatDisplayDate(b.date, lang)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="panel-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <strong style={{ fontSize: 15.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} color="#BE123C" /> Bekleyen İptal Talepleri ({pendingCancellations.length})
                </strong>
                {pendingCancellations.length > 0 && (
                  <button type="button" className="uf-quick-pill" onClick={() => onJumpToBookings('İptal Talebi')}>
                    Tümünü Aç →
                  </button>
                )}
              </div>
              {pendingCancellations.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>Bekleyen iptal veya iade talebi yok.</div>
              ) : (
                pendingCancellations.map((b) => (
                  <div key={b.id} style={{ padding: '9px 11px', borderRadius: 12, background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.3)', marginBottom: 8, fontSize: 12.5 }}>
                    <strong>{b.passenger}</strong> · {formatPrice(b.price, currency)} · {b.pnr}
                    <div style={{ color: 'var(--aspan-text-muted)', marginTop: 2 }}>{b.title}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Persistent CRM Follow-Up Task List */}
          <div className="panel-card">
            <strong style={{ fontSize: 17, display: 'block', marginBottom: 6 }}>
              CRM Müşteri &amp; Kurumsal Takip Görevleri (Kalıcı SQLite)
            </strong>
            <p style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 0, marginBottom: 12 }}>
              Müşteri aramaları, kurumsal teklif takipleri ve check-in hatırlatmalarını görev olarak kaydedin.
            </p>
            <form className="panel-form-grid" onSubmit={handleAddTask} style={{ marginBottom: 16 }}>
              <input className="modal-input" required placeholder="Takip Notu / Görev *" value={tTitle} onChange={(e) => setTTitle(e.target.value)} />
              <input className="modal-input" placeholder="Müşteri / Şirket Adı" value={tCustomer} onChange={(e) => setTCustomer(e.target.value)} />
              <input className="modal-input" placeholder="PNR (Opsiyonel)" value={tPnr} onChange={(e) => setTPnr(e.target.value.toUpperCase())} />
              <input className="modal-input" type="date" value={tDueDate} onChange={(e) => setTDueDate(e.target.value)} />
              <select className="modal-input" value={tPriority} onChange={(e) => setTPriority(e.target.value as 'high' | 'normal' | 'low')}>
                <option value="high">Yüksek Öncelik</option>
                <option value="normal">Normal Öncelik</option>
                <option value="low">Düşük Öncelik</option>
              </select>
              <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }} disabled={busy}>
                <Plus size={15} /> Görev Ekle
              </button>
            </form>

            {tasks.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>Henüz CRM takip görevi yok.</div>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '11px 0',
                    borderBottom: '1px solid var(--aspan-border)',
                    flexWrap: 'wrap',
                    gap: 10,
                    opacity: t.status === 'done' ? 0.55 : 1,
                  }}
                >
                  <div>
                    <span className={`status-badge ${t.status === 'done' ? 'ok' : t.priority === 'high' ? 'warn' : 'ok'}`}>
                      {t.status === 'done' ? '✓ Tamamlandı' : t.priority === 'high' ? 'Acil' : 'Açık'}
                    </span>{' '}
                    {t.pnr && <span className="uf-airport-code">{t.pnr}</span>}{' '}
                    <strong style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</strong>
                    <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginTop: 2 }}>
                      {t.customerName ? `${t.customerName} · ` : ''}Son Tarih: {formatDisplayDate(t.dueDate, lang)} · Sorumlu: {t.assignedTo}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="uf-quick-pill"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const nextStatus = t.status === 'done' ? 'open' : 'done';
                          const { task: updated } = await api.updateCrmTask(t.id, nextStatus);
                          setTasks((prev) => prev.map((row) => (row.id === t.id ? updated : row)));
                        } catch (err) {
                          onError(apiMessage(err));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      {t.status === 'done' ? 'Yeniden Aç' : 'Yapıldı'}
                    </button>
                    <button
                      type="button"
                      className="drawer-close"
                      disabled={busy}
                      aria-label={`${t.title} sil`}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api.deleteCrmTask(t.id);
                          setTasks((prev) => prev.filter((row) => row.id !== t.id));
                        } catch (err) {
                          onError(apiMessage(err));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ==================== TAB 5: CRM QUOTE BUILDER & 1-CLICK CONVERT TO PNR ==================== */}
      {subTab === 'quotes' && (
        <div className="panel-card">
          <strong style={{ fontSize: 17.5, display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <FileText size={18} color="#00A8B5" /> Detaylı Teklif Hazırlama &amp; Otomatik XML Fiyatlandırma
          </strong>
          <p style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 0, marginBottom: 14 }}>
            Yolcunun adı, soyadı, doğum tarihi ve iletişim bilgilerini girin; teklif tutarı elle yazılmaz, XML kaynaklarından en ucuzdan pahalıya otomatik sıralanır.
          </p>

          <form
            style={{ marginBottom: 20 }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || !qFirstName.trim() || !qLastName.trim() || !selectedXmlOffer) return;
              setBusy(true);
              onError('');
              try {
                const fullName = `${qFirstName.trim()} ${qLastName.trim()}`.trim();
                const { quote } = await api.createCrmQuote({
                  customerName: fullName,
                  firstName: qFirstName.trim(),
                  lastName: qLastName.trim(),
                  birthDate: qBirthDate || undefined,
                  documentType: effectiveQuoteDocType,
                  tcOrPassport: qPassport.trim() || undefined,
                  nationality: qNationality || undefined,
                  passportCountry: effectiveQuoteDocType === 'pasaport' ? (qPassportCountry || qNationality) : undefined,
                  passportIssueDate: effectiveQuoteDocType === 'pasaport' && qPassportIssue ? qPassportIssue : undefined,
                  passportExpiryDate: effectiveQuoteDocType === 'pasaport' && qPassportExpiry ? qPassportExpiry : undefined,
                  passportIssuer: effectiveQuoteDocType === 'pasaport' && qPassportIssuer.trim() ? qPassportIssuer.trim() : undefined,
                  gender: qGender,
                  customerEmail: qEmail.trim() || undefined,
                  customerPhone: qPhone.trim(),
                  paxCount: qPaxCount,
                  type: selectedXmlOffer.type,
                  title: selectedXmlOffer.title,
                  details: selectedXmlOffer.details,
                  travelDate: qDate,
                  price: selectedXmlOffer.totalPriceTRY,
                  airline: selectedXmlOffer.airline,
                  flightNumber: selectedXmlOffer.flightNumber,
                  departTime: selectedXmlOffer.departTime,
                  arriveTime: selectedXmlOffer.arriveTime,
                  duration: selectedXmlOffer.duration,
                  baggage: selectedXmlOffer.baggage,
                  cabin: selectedXmlOffer.cabin,
                  fromCode: selectedXmlOffer.fromCode,
                  toCode: selectedXmlOffer.toCode,
                  providerSource: selectedXmlOffer.providerSource,
                  netCostTRY: selectedXmlOffer.netCostTRY,
                });
                setQuotes((prev) => [quote, ...prev]);
                setQFirstName('');
                setQLastName('');
                setQPassport('');
                setQPassportIssue('');
                setQPassportExpiry('');
                setQPassportIssuer('');
                setQPhone('');
                setQEmail('');
                onFlash(`Teklif oluşturuldu: ${quote.quoteNo}`);
              } catch (err) {
                onError(apiMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {/* 1. Detailed Passenger & Contact Fields */}
            <div className="adm-form-box" style={{ marginTop: 0, marginBottom: 14 }}>
              <div className="adm-form-title">1. Yolcu, Belge (Kimlik / Pasaport) &amp; İletişim Bilgileri</div>
              <div className="panel-form-grid">
                <div>
                  <label className="adm-field-lbl">Yolcu Adı *</label>
                  <input required className="modal-input" placeholder="Örn: Jalia" value={qFirstName} onChange={(e) => setQFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="adm-field-lbl">Yolcu Soyadı *</label>
                  <input required className="modal-input" placeholder="Örn: Coşkun" value={qLastName} onChange={(e) => setQLastName(e.target.value)} />
                </div>
                <div>
                  <label className="adm-field-lbl">Doğum Tarihi *</label>
                  <input required type="date" className="modal-input" value={qBirthDate} onChange={(e) => setQBirthDate(e.target.value)} />
                </div>
                <div>
                  <label className="adm-field-lbl">Cinsiyet</label>
                  <select className="modal-input" value={qGender} onChange={(e) => setQGender(e.target.value as 'F' | 'M')}>
                    <option value="F">Kadın</option>
                    <option value="M">Erkek</option>
                  </select>
                </div>
                <div>
                  <label className="adm-field-lbl">Uyruk / Vatandaşlık</label>
                  <select className="modal-input" value={qNationality} onChange={(e) => { setQNationality(e.target.value); setQPassportCountry(e.target.value); }}>
                    <option value="Türkiye">Türkiye</option>
                    <option value="Kazakistan">Kazakistan</option>
                    <option value="Rusya">Rusya</option>
                    <option value="Özbekistan">Özbekistan</option>
                    <option value="Azerbaycan">Azerbaycan</option>
                    <option value="Kırgızistan">Kırgızistan</option>
                    <option value="Almanya">Almanya</option>
                    <option value="İngiltere">İngiltere</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>
                <div>
                  <label className="adm-field-lbl">Belge Tipi{isSelectedOfferCharter ? ' (Charter · Zorunlu)' : ''}</label>
                  <select
                    className="modal-input"
                    value={effectiveQuoteDocType}
                    disabled={isSelectedOfferCharter}
                    onChange={(e) => setQDocType(e.target.value as 'kimlik' | 'pasaport')}
                  >
                    <option value="pasaport">Pasaport</option>
                    {!isSelectedOfferCharter && <option value="kimlik">T.C. Kimlik Kartı</option>}
                  </select>
                </div>
                <div>
                  <label className="adm-field-lbl">
                    {effectiveQuoteDocType === 'pasaport' ? 'Pasaport No' : 'T.C. Kimlik / Kimlik No'}
                    {isSelectedOfferCharter ? ' *' : ''}
                  </label>
                  <input
                    required={isSelectedOfferCharter}
                    minLength={isSelectedOfferCharter ? 5 : undefined}
                    className="modal-input"
                    placeholder={effectiveQuoteDocType === 'pasaport' ? 'Örn: U12345678' : '11111111111'}
                    value={qPassport}
                    onChange={(e) => setQPassport(e.target.value.toUpperCase())}
                  />
                </div>
                {effectiveQuoteDocType === 'pasaport' && (
                  <>
                    <div>
                      <label className="adm-field-lbl">Pasaport Veren Ülke</label>
                      <select className="modal-input" value={qPassportCountry} onChange={(e) => setQPassportCountry(e.target.value)}>
                        <option value="Türkiye">Türkiye</option>
                        <option value="Kazakistan">Kazakistan</option>
                        <option value="Rusya">Rusya</option>
                        <option value="Özbekistan">Özbekistan</option>
                        <option value="Azerbaycan">Azerbaycan</option>
                        <option value="Kırgızistan">Kırgızistan</option>
                        <option value="Almanya">Almanya</option>
                        <option value="İngiltere">İngiltere</option>
                        <option value="Diğer">Diğer</option>
                      </select>
                    </div>
                    <div>
                      <label className="adm-field-lbl">Pasaport Başlangıç Tarihi{isSelectedOfferCharter ? ' *' : ''}</label>
                      <input required={isSelectedOfferCharter} type="date" className="modal-input" value={qPassportIssue} onChange={(e) => setQPassportIssue(e.target.value)} />
                    </div>
                    <div>
                      <label className="adm-field-lbl">Pasaport Bitiş Tarihi{isSelectedOfferCharter ? ' *' : ''}</label>
                      <input required={isSelectedOfferCharter} type="date" min={qDate} className="modal-input" value={qPassportExpiry} onChange={(e) => setQPassportExpiry(e.target.value)} />
                    </div>
                    <div>
                      <label className="adm-field-lbl">Veren Makam (Opsiyonel)</label>
                      <input className="modal-input" placeholder="Örn: MVD RK / NVI" value={qPassportIssuer} onChange={(e) => setQPassportIssuer(e.target.value)} />
                    </div>
                  </>
                )}
                <div>
                  <label className="adm-field-lbl">Yolcu Sayısı</label>
                  <select className="modal-input" value={qPaxCount} onChange={(e) => setQPaxCount(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <option key={n} value={n}>{n} Kişi</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="adm-field-lbl">Telefon (+90 / +7)</label>
                  <input className="modal-input" placeholder="Telefon (+90 5xx...)" value={qPhone} onChange={(e) => setQPhone(e.target.value)} />
                </div>
                <div>
                  <label className="adm-field-lbl">E-Posta</label>
                  <input type="email" className="modal-input" placeholder="yolcu@ornek.com" value={qEmail} onChange={(e) => setQEmail(e.target.value)} />
                </div>
              </div>
            </div>

            {/* 2. Service Criteria & Automatic XML Sorted Price List */}
            <div className="adm-form-box" style={{ marginTop: 0, marginBottom: 14 }}>
              <div className="adm-form-title">2. Hizmet Seçimi &amp; Otomatik XML Fiyat Sıralaması (Ucuzdan Pahalıya)</div>
              <div className="panel-form-grid" style={{ marginBottom: 14 }}>
                <div>
                  <label className="adm-field-lbl">Hizmet Tipi</label>
                  <select
                    className="modal-input"
                    value={qType}
                    onChange={(e) => {
                      setQType(e.target.value as 'Uçak' | 'Otel' | 'Tur');
                      setSelectedXmlOfferId('');
                    }}
                  >
                    <option value="Uçak">✈ Uçak Bileti</option>
                    <option value="Otel">🏨 Otel Konaklama</option>
                    <option value="Tur">🧭 Paket Tur</option>
                  </select>
                </div>
                {qType === 'Uçak' && (
                  <>
                    <div>
                      <label className="adm-field-lbl">Kalkış (Nereden)</label>
                      <select className="modal-input" value={qFrom} onChange={(e) => { setQFrom(e.target.value); setSelectedXmlOfferId(''); }}>
                        {AIRPORTS.map((a) => (
                          <option key={a.code} value={a.code}>{a.city} ({a.code})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="adm-field-lbl">Varış (Nereye)</label>
                      <select className="modal-input" value={qTo} onChange={(e) => { setQTo(e.target.value); setSelectedXmlOfferId(''); }}>
                        {AIRPORTS.filter((a) => a.code !== qFrom).map((a) => (
                          <option key={a.code} value={a.code}>{a.city} ({a.code})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="adm-field-lbl">Kabin Sınıfı</label>
                      <select className="modal-input" value={qCabin} onChange={(e) => { setQCabin(e.target.value as 'Ekonomi' | 'Business'); setSelectedXmlOfferId(''); }}>
                        <option value="Ekonomi">Ekonomi</option>
                        <option value="Business">Business</option>
                      </select>
                    </div>
                  </>
                )}
                {qType === 'Otel' && (
                  <div>
                    <label className="adm-field-lbl">Gece Sayısı</label>
                    <select className="modal-input" value={qNights} onChange={(e) => setQNights(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((n) => (
                        <option key={n} value={n}>{n} Gece</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="adm-field-lbl">Seyahat / Giriş Tarihi *</label>
                  <input required type="date" className="modal-input" value={qDate} onChange={(e) => setQDate(e.target.value)} />
                </div>
              </div>

              {/* Sorted XML Offers List */}
              {xmlOffers.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>Seçilen kriter için XML teklifi bulunamadı.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                  {xmlOffers.map((offer, idx) => {
                    const isSelected = selectedXmlOffer?.id === offer.id;
                    return (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => setSelectedXmlOfferId(offer.id)}
                        style={{
                          textAlign: 'left',
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 12,
                          border: isSelected ? '2px solid #00A8B5' : '1.5px solid #cbd5e1',
                          background: isSelected ? 'rgba(0, 168, 181, 0.08)' : '#ffffff',
                          boxShadow: isSelected ? '0 4px 12px -4px rgba(0, 168, 181, 0.35)' : '0 1px 3px rgba(15, 23, 42, 0.05)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                          transition: 'all 0.14s ease',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                            {idx === 0 && (
                              <span className="status-badge ok" style={{ fontSize: 10.5 }}>
                                ★ En Uygun XML
                              </span>
                            )}
                            <span className="pkg-pill" style={{ fontSize: 11, color: '#0369A1', background: 'rgba(2,132,199,0.1)' }}>
                              🔌 {offer.providerSource}
                            </span>
                            {offer.badge && <span className="pkg-pill" style={{ fontSize: 11 }}>{offer.badge}</span>}
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--aspan-text)' }}>
                            {offer.airline ? `${offer.airline} (${offer.flightNumber}) · ` : ''}{offer.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginTop: 2 }}>
                            {offer.departTime && offer.arriveTime
                              ? `🕒 ${offer.departTime} → ${offer.arriveTime}${offer.duration ? ` (${offer.duration})` : ''}${offer.baggage ? ` · ${offer.baggage}` : ''}`
                              : offer.details}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 16.5, fontWeight: 900, color: '#0B1E33' }}>
                              {formatPrice(offer.totalPriceTRY, currency)}
                            </div>
                            {qPaxCount > 1 && (
                              <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>
                                {formatPrice(offer.unitPriceTRY, currency)} × {qPaxCount}
                              </div>
                            )}
                          </div>
                          <span
                            style={{
                              padding: '6px 12px',
                              borderRadius: 9,
                              fontSize: 12,
                              fontWeight: 800,
                              background: isSelected ? '#0B1E33' : '#f1f5f9',
                              color: isSelected ? '#ffffff' : '#0f172a',
                              border: isSelected ? '1px solid #0B1E33' : '1px solid #94a3b8',
                            }}
                          >
                            {isSelected ? '✓ Seçildi' : 'Seç'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Locked Automatic XML Quote Total & Submit */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(0, 168, 181, 0.08), rgba(224, 170, 54, 0.08))',
                border: '1.5px solid #00A8B5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Otomatik XML Teklif Tutarı (Elle Girilmez)
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--aspan-text)', marginTop: 2 }}>
                  {selectedXmlOffer
                    ? `${selectedXmlOffer.title} · ${selectedXmlOffer.providerSource}`
                    : 'Yukarıdan XML seçeneği seçin'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#0B1E33' }}>
                  {selectedXmlOffer ? formatPrice(selectedXmlOffer.totalPriceTRY, currency) : '—'}
                </div>
                <button
                  type="submit"
                  className="btn-gold-nav"
                  style={{ borderRadius: 12, minHeight: 42, padding: '0 20px', fontSize: 13.5 }}
                  disabled={busy || !selectedXmlOffer}
                >
                  <Plus size={16} /> Teklif Oluştur
                </button>
              </div>
            </div>
          </form>

          {quotes.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>Henüz oluşturulmuş teklif yok.</div>
          ) : (
            quotes.map((q) => {
              const cleanWaPhone = q.customerPhone.replace(/[^\d]/g, '');
              const waText = encodeURIComponent(
                `Merhaba ${q.customerName}, FlyToAspan özel teklifiniz hazırdır:\n` +
                `• Teklif No: ${q.quoteNo}\n` +
                `• Hizmet: ${q.type} — ${q.title}\n` +
                (q.airline ? `• Havayolu / Uçuş: ${q.airline}${q.flightNumber ? ` (${q.flightNumber})` : ''}${q.departTime && q.arriveTime ? ` · ${q.departTime}→${q.arriveTime}` : ''}\n` : '') +
                (q.details ? `• Detay: ${q.details}\n` : '') +
                (q.birthDate ? `• Yolcu Doğum Tarihi: ${formatDisplayDate(q.birthDate, lang)}\n` : '') +
                `• Tarih: ${formatDisplayDate(q.travelDate, lang)}\n` +
                `• Toplam Fiyat: ${formatPrice(q.price, currency)}\n` +
                `Onaylamanız halinde hemen PNR biletinizi düzenleyebiliriz.`
              );
              const waHref = cleanWaPhone ? `https://wa.me/${cleanWaPhone}?text=${waText}` : `https://wa.me/?text=${waText}`;
              return (
                <div
                  key={q.id}
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
                    <span className="uf-airport-code">{q.quoteNo}</span>{' '}
                    <span className="pkg-pill">{q.type}</span>{' '}
                    <span className={`status-badge ${q.status === 'Onaylandı' ? 'ok' : q.status === 'Kaybedildi' ? 'warn' : 'ok'}`}>
                      {q.status}
                    </span>
                    {q.providerSource && (
                      <span className="pkg-pill" style={{ marginLeft: 4, color: '#0369A1', background: 'rgba(2,132,199,0.1)' }}>
                        🔌 {q.providerSource}
                      </span>
                    )}
                    {q.convertedPnr && (
                      <span className="pkg-pill" style={{ marginLeft: 4, background: 'rgba(16,185,129,0.14)', color: '#047857' }}>
                        ✓ PNR: {q.convertedPnr}
                      </span>
                    )}
                    <div style={{ fontWeight: 800, fontSize: 15, marginTop: 5 }}>
                      {q.customerName} · {q.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginTop: 2 }}>
                      {q.details ? `${q.details} · ` : ''}Tarih: {formatDisplayDate(q.travelDate, lang)} · Oluşturma: {formatTrDateTime(q.createdAt)}
                    </div>
                    {(q.birthDate || q.tcOrPassport || q.customerPhone || q.customerEmail) && (
                      <div style={{ fontSize: 11.5, color: 'var(--aspan-text-body)', marginTop: 3 }}>
                        {q.birthDate ? `Doğum: ${formatDisplayDate(q.birthDate, lang)}` : ''}
                        {q.tcOrPassport ? ` · Belge: ${q.tcOrPassport}` : ''}
                        {q.customerPhone ? ` · Tel: ${q.customerPhone}` : ''}
                        {q.customerEmail ? ` · E-Posta: ${q.customerEmail}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 16.5, marginRight: 4 }}>{formatPrice(q.price, currency)}</strong>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="uf-quick-pill"
                      style={{ textDecoration: 'none', color: '#047857', borderColor: '#10B981', background: 'rgba(16,185,129,0.1)' }}
                      onClick={() => {
                        if (q.status === 'Taslak') {
                          void api.updateCrmQuoteStatus(q.id, 'Gönderildi').then(({ quote: upd }) =>
                            setQuotes((prev) => prev.map((r) => (r.id === q.id ? upd : r)))
                          );
                        }
                      }}
                    >
                      <MessageCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      WhatsApp Gönder
                    </a>
                    {!q.convertedPnr && (
                      <button
                        type="button"
                        className="btn-gold-nav"
                        style={{ minHeight: 38, fontSize: 12.5, padding: '0 14px' }}
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          onError('');
                          try {
                            const { quote: upd, booking } = await api.convertCrmQuote(q.id);
                            setQuotes((prev) => prev.map((r) => (r.id === q.id ? upd : r)));
                            onBookingCreated?.(booking);
                            onFlash(`Teklif satışa dönüştürüldü! Yeni PNR: ${booking.pnr}`);
                          } catch (err) {
                            onError(apiMessage(err));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Zap size={13} /> Satışa &amp; PNR&apos;a Dönüştür
                      </button>
                    )}
                    <button
                      type="button"
                      className="drawer-close"
                      disabled={busy}
                      aria-label={`${q.quoteNo} sil`}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api.deleteCrmQuote(q.id);
                          setQuotes((prev) => prev.filter((r) => r.id !== q.id));
                        } catch (err) {
                          onError(apiMessage(err));
                        } finally {
                          setBusy(false);
                        }
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
      )}

      {/* ==================== TAB 6: CUSTOMER 360° CRM DIRECTORY ==================== */}
      {subTab === 'customers' && (
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <strong style={{ fontSize: 17.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Users size={18} color="#00A8B5" /> Müşteri 360° CRM Rehberi
              </strong>
              <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                Her müşterinin toplam harcaması, VIP durumu, iletişim bilgileri ve geçmiş tüm rezervasyonları tek kartta.
              </div>
            </div>
            <input
              className="modal-input"
              style={{ maxWidth: 250, height: 36, fontSize: 12.5 }}
              placeholder="Müşteri adı, e-posta, şirket ara..."
              value={custSearch}
              onChange={(e) => setCustSearch(e.target.value)}
            />
          </div>

          {customers360
            .filter((c) => !custSearch.trim() || `${c.name} ${c.email} ${c.phone} ${c.company}`.toLowerCase().includes(custSearch.trim().toLowerCase()))
            .map((c) => {
              const isVip = c.totalSpendTRY >= 10000 || c.bookings.length >= 2;
              const cleanPhone = c.phone.replace(/[^\d]/g, '');
              return (
                <div
                  key={c.key}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: isVip ? '1.5px solid rgba(224,170,54,0.55)' : '1px solid var(--aspan-border)',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      {isVip && (
                        <span className="pkg-pill" style={{ background: 'rgba(224,170,54,0.18)', color: '#92400E', marginRight: 6 }}>
                          ★ VIP Müşteri
                        </span>
                      )}
                      {c.company && <span className="pkg-pill" style={{ marginRight: 6 }}>{c.company}</span>}
                      <strong style={{ fontSize: 15.5 }}>{c.name}</strong>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginTop: 3 }}>
                        {c.email || 'Misafir alıcı'}{c.phone ? ` · ${c.phone}` : ''} · {c.bookings.length} Rezervasyon
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>Toplam Harcama</div>
                        <strong style={{ fontSize: 16, color: '#059669' }}>{formatPrice(c.totalSpendTRY, currency)}</strong>
                      </div>
                      {cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="uf-quick-pill"
                          style={{ textDecoration: 'none', color: '#047857', borderColor: '#10B981' }}
                        >
                          <MessageCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                  {c.bookings.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--aspan-border)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {c.bookings.slice(0, 5).map((b) => (
                        <span key={b.id} className="pkg-pill" style={{ fontSize: 11 }}>
                          {b.pnr} · {b.title} ({formatDisplayDate(b.date, lang)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ==================== TAB 7: SECURITY & AUDIT LOG VIEWER ==================== */}
      {subTab === 'audit' && (
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <strong style={{ fontSize: 17.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <ShieldCheck size={18} color="#10B981" /> Canlı Güvenlik &amp; Yönetici İşlem Kayıtları (Audit Log)
              </strong>
              <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                Kimin hangi saatte hangi IP adresinden fiyat, kur, onay, iptal veya cari tahsilat işlemi yaptığını şeffaf şekilde izleyin.
              </div>
            </div>
            <input
              className="modal-input"
              style={{ maxWidth: 250, height: 36, fontSize: 12.5 }}
              placeholder="E-posta, işlem veya IP ara..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
            />
          </div>

          {auditLogs.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--aspan-text-muted)' }}>Henüz güvenlik kaydı bulunmuyor.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--aspan-border)', color: 'var(--aspan-text-muted)' }}>
                    <th style={{ padding: '8px 8px 8px 0' }}>Tarih / Saat</th>
                    <th style={{ padding: '8px' }}>İşlemi Yapan</th>
                    <th style={{ padding: '8px' }}>İşlem Türü</th>
                    <th style={{ padding: '8px' }}>Hedef / Detay</th>
                    <th style={{ padding: '8px 0 8px 8px', textAlign: 'right' }}>IP Adresi</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs
                    .filter((l) => !auditSearch.trim() || `${l.actor_email} ${l.action} ${l.target} ${l.ip}`.toLowerCase().includes(auditSearch.trim().toLowerCase()))
                    .map((l) => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--aspan-border)' }}>
                        <td style={{ padding: '9px 8px 9px 0', whiteSpace: 'nowrap' }}>
                          <strong>{formatTrDateTime(l.created_at)}</strong>
                        </td>
                        <td style={{ padding: '9px 8px' }}>{l.actor_email}</td>
                        <td style={{ padding: '9px 8px' }}>
                          <span className="pkg-pill">{AUDIT_LABELS[l.action] ?? l.action}</span>
                        </td>
                        <td style={{ padding: '9px 8px', color: 'var(--aspan-text-muted)' }}>{l.target}</td>
                        <td style={{ padding: '9px 0 9px 8px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>
                          {l.ip}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
};
