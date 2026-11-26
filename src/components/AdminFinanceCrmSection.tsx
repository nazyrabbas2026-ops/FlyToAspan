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
import { formatDisplayDate, formatPrice } from '../data/mockData';
import { addCalendarDays, toCalendarDate } from '../data/calendarDates';
import { api, apiMessage } from '../data/api';
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

interface AdminFinanceCrmSectionProps {
  lang: LangCode;
  currency: CurrencyCode;
  markup: AdminMarkupConfig;
  bookings: BookingRecord[];
  siteUsers?: UserProfile[];
  onJumpToBookings: (status?: BookingRecord['status'] | 'ALL') => void;
  onFlash: (msg: string) => void;
  onError: (msg: string) => void;
}

type FinanceTab = 'finance' | 'ledger' | 'crm' | 'followup' | 'quotes' | 'customers' | 'audit';

const AUDIT_LABELS: Record<string, string> = {
  'admin:pricing_update': 'Komisyon / Fiyat Güncelleme',
  'admin:fx_override': 'Manuel Döviz Kuru Ayarı',
  'admin:fx_reset': 'Canlı Kura Dönüş',
  'admin:booking_status': 'Rezervasyon Durum Değişikliği',
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
  if (b.type === 'Otel') return 'BookingAgora Hotel XML';
  if (b.type === 'Transfer') return 'Buranus VIP Transfer XML';
  return 'Amadeus GDS (XML)';
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

  // Quote builder form
  const [qCustomer, setQCustomer] = useState('');
  const [qPhone, setQPhone] = useState('');
  const [qType, setQType] = useState<CrmQuote['type']>('Uçak');
  const [qTitle, setQTitle] = useState('');
  const [qDetails, setQDetails] = useState('');
  const [qDate, setQDate] = useState(() => addCalendarDays(toCalendarDate(new Date()), 14));
  const [qPrice, setQPrice] = useState('');

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

  // Product breakdown
  const productTotals = useMemo(() => {
    const flight = confirmedBookings.filter((b) => b.type === 'Uçak').reduce((s, b) => s + b.price, 0);
    const hotel = confirmedBookings.filter((b) => b.type === 'Otel').reduce((s, b) => s + b.price, 0);
    const transfer = confirmedBookings.filter((b) => b.type === 'Transfer').reduce((s, b) => s + b.price, 0);
    const total = Math.max(1, flight + hotel + transfer);
    return {
      flight,
      hotel,
      transfer,
      flightPct: Math.round((flight / total) * 100),
      hotelPct: Math.round((hotel / total) * 100),
      transferPct: Math.round((transfer / total) * 100),
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
      <div className="panel-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                onClick={() => setSubTab(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: active ? 'none' : '1px solid var(--aspan-border)',
                  background: active ? '#0B1E33' : 'var(--aspan-bg-soft)',
                  color: active ? '#fff' : 'var(--aspan-text)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span style={{ background: '#10B981', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
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
                { label: '🚐 VIP Transfer', amount: productTotals.transfer, pct: productTotals.transferPct, color: '#0284C7' },
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
                style={{ width: 220, height: 36, fontSize: 12.5 }}
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
            <FileText size={18} color="#00A8B5" /> Teklif Hazırlama &amp; Satışa Dönüştürme (Quote Builder)
          </strong>
          <p style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 0, marginBottom: 14 }}>
            Müşteriye hızlı fiyat teklifi oluşturun, tek tıkla WhatsApp&apos;tan gönderin; onaylandığında tek tıkla gerçek PNR&apos;lı satışa çevirin.
          </p>

          <form
            className="panel-form-grid"
            style={{ marginBottom: 18 }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || !qCustomer.trim() || !qTitle.trim() || !Number(qPrice)) return;
              setBusy(true);
              onError('');
              try {
                const { quote } = await api.createCrmQuote({
                  customerName: qCustomer.trim(),
                  customerPhone: qPhone.trim(),
                  type: qType,
                  title: qTitle.trim(),
                  details: qDetails.trim(),
                  travelDate: qDate,
                  price: Math.round(Number(qPrice)),
                });
                setQuotes((prev) => [quote, ...prev]);
                setQCustomer('');
                setQPhone('');
                setQTitle('');
                setQDetails('');
                setQPrice('');
                onFlash(`Teklif oluşturuldu: ${quote.quoteNo}`);
              } catch (err) {
                onError(apiMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <input required className="modal-input" placeholder="Müşteri Ad Soyad *" value={qCustomer} onChange={(e) => setQCustomer(e.target.value)} />
            <input className="modal-input" placeholder="Telefon (+90 5xx...)" value={qPhone} onChange={(e) => setQPhone(e.target.value)} />
            <select className="modal-input" value={qType} onChange={(e) => setQType(e.target.value as CrmQuote['type'])}>
              <option value="Uçak">Uçak Bileti</option>
              <option value="Otel">Otel</option>
              <option value="Transfer">VIP Transfer</option>
              <option value="Tur">Tur Paketi</option>
            </select>
            <input required className="modal-input" placeholder="Güzergâh / Paket Başlığı *" value={qTitle} onChange={(e) => setQTitle(e.target.value)} />
            <input className="modal-input" placeholder="Detay (Örn: Air Astana · 2 Yetişkin · 30kg)" value={qDetails} onChange={(e) => setQDetails(e.target.value)} />
            <input required type="date" className="modal-input" value={qDate} onChange={(e) => setQDate(e.target.value)} />
            <input required type="number" min={1} className="modal-input" placeholder="Teklif Tutarı (TL) *" value={qPrice} onChange={(e) => setQPrice(e.target.value)} />
            <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }} disabled={busy}>
              <Plus size={15} /> Teklif Oluştur
            </button>
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
                (q.details ? `• Detay: ${q.details}\n` : '') +
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
                    {q.convertedPnr && (
                      <span className="pkg-pill" style={{ marginLeft: 4, background: 'rgba(16,185,129,0.14)', color: '#047857' }}>
                        ✓ PNR: {q.convertedPnr}
                      </span>
                    )}
                    <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>
                      {q.customerName} · {q.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                      {q.details ? `${q.details} · ` : ''}Tarih: {formatDisplayDate(q.travelDate, lang)} · Oluşturma: {formatTrDateTime(q.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 16, marginRight: 4 }}>{formatPrice(q.price, currency)}</strong>
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
                        style={{ height: 32, fontSize: 12 }}
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          onError('');
                          try {
                            const { quote: upd, booking } = await api.convertCrmQuote(q.id);
                            setQuotes((prev) => prev.map((r) => (r.id === q.id ? upd : r)));
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
