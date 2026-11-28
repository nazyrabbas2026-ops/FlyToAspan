import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api, apiMessage } from '../data/api';
import { PanelMfaForm } from './PanelMfaForm';
import { formatPrice } from '../data/mockData';
import type { CurrencyCode, LangCode, UserProfile } from '../types';

interface AdminAnalyticsSectionProps {
  lang: LangCode;
  currency: CurrencyCode;
  currentUser: UserProfile | null;
  onFlash: (msg: string) => void;
  onError: (msg: string) => void;
  onAccountChanged?: (user: UserProfile) => void;
}

type AnalyticsData = Awaited<ReturnType<typeof api.adminAnalytics>>;

export const AdminAnalyticsSection: React.FC<AdminAnalyticsSectionProps> = ({
  lang,
  currency,
  currentUser,
  onFlash,
  onError,
  onAccountChanged,
}) => {
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const [customFrom, setCustomFrom] = useState(() => new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Security self-service (Password change & TOTP 2FA setup)
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [secBusy, setSecBusy] = useState(false);
  const [totpActive, setTotpActive] = useState(Boolean(currentUser?.totpEnabled));

  const loadAnalytics = async (
    nextRange = range,
    fromVal = customFrom,
    toVal = customTo
  ) => {
    setLoading(true);
    try {
      const res = await api.adminAnalytics({
        range: nextRange,
        ...(nextRange === 'custom' ? { from: fromVal, to: toVal } : {}),
      });
      setData(res);
    } catch (err) {
      onError(apiMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics(range, customFrom, customTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secBusy) return;
    setSecBusy(true);
    onError('');
    try {
      await api.changePassword(curPass, newPass);
      setCurPass('');
      setNewPass('');
      onFlash('Parolanız güncellendi ve diğer açık oturumlar sonlandırıldı.');
    } catch (err) {
      onError(apiMessage(err));
    } finally {
      setSecBusy(false);
    }
  };

  const funnelSteps = data
    ? [
        { label: 'Arama', count: data.funnel.searches, color: '#0284C7' },
        { label: 'Seçim', count: data.funnel.selections, color: '#0EA5E9' },
        { label: 'Yolcu Formu', count: data.funnel.passengerForms, color: '#00A8B5' },
        { label: 'Ödeme Gönderimi', count: data.funnel.checkoutSubmits, color: '#F59E0B' },
        { label: 'Rezervasyon / Biletleme', count: data.funnel.bookingsCreated, color: '#10B981' },
      ]
    : [];
  const maxFunnel = Math.max(1, ...funnelSteps.map((s) => s.count));
  const maxTrend = Math.max(
    1,
    ...(data?.dailyTrend || []).map((d) => Math.max(d.visits, d.bookings, d.errors))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Range Filter Bar */}
      <div className="panel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {(
            [
              { id: 'today', label: 'Bugün' },
              { id: '7d', label: 'Son 7 Gün' },
              { id: '30d', label: 'Bu Ay (30 Gün)' },
              { id: 'custom', label: 'Özel Aralık' },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              className={`sort-pill-btn ${range === r.id ? 'active' : ''}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
          {range === 'custom' && (
            <>
              <input
                type="date"
                className="modal-input"
                style={{ width: 150, height: 36 }}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                type="date"
                className="modal-input"
                style={{ width: 150, height: 36 }}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
              <button
                type="button"
                className="btn-gold-nav"
                style={{ height: 36, fontSize: 12 }}
                onClick={() => void loadAnalytics('custom', customFrom, customTo)}
              >
                Uygula
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          className="uf-quick-pill"
          disabled={loading}
          onClick={() => void loadAnalytics(range, customFrom, customTo)}
        >
          <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
          {loading ? 'Yükleniyor...' : 'Verileri Yenile'}
        </button>
      </div>

      {/* KPI Row: First-Party Members + Live vs Demo Sales + Errors */}
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: 12 }}>
            <div className="panel-stat-card">
              <div className="filter-label"><Users size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Üye &amp; Giriş (1. Parti DB)</div>
              <div style={{ fontSize: 25, fontWeight: 800 }}>
                {data.members.totalUsers} {lang === 'EN' ? 'members' : lang === 'RU' ? 'польз.' : lang === 'KK' ? 'мүше' : 'üye'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                {lang === 'EN' ? 'Logins in period' : lang === 'RU' ? 'Входов за период' : lang === 'KK' ? 'Кезеңдегі кіру' : 'Dönem girişi'}: <strong>{data.members.loginsInPeriod}</strong> · {lang === 'EN' ? 'Active agencies' : lang === 'RU' ? 'Активных агентств' : lang === 'KK' ? 'Белсенді агенттік' : 'Aktif bayi'}: {data.members.activeOrganizations}
              </div>
            </div>

            <div className="panel-stat-card" style={{ border: '1.5px solid rgba(16,185,129,0.4)' }}>
              <div className="filter-label" style={{ color: '#047857' }}>Doğrulanmış Canlı Satış</div>
              <div style={{ fontSize: 25, fontWeight: 800, color: '#059669' }}>
                {formatPrice(data.sales.verifiedLiveVolumeTRY, currency, lang)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                {data.sales.verifiedLiveCount} canlı işlem (tekilleştirilmiş)
              </div>
            </div>

            <div className="panel-stat-card" style={{ border: '1.5px solid rgba(245,158,11,0.45)', background: 'rgba(245,158,11,0.05)' }}>
              <div className="filter-label" style={{ color: '#B45309' }}>🧪 Deneme (Demo) Hacmi</div>
              <div style={{ fontSize: 25, fontWeight: 800, color: '#B45309' }}>
                {formatPrice(data.sales.demoVolumeTRY, currency, lang)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                {data.sales.demoCount} deneme kaydı · İade/İptal: {data.sales.refundedCount}
              </div>
            </div>

            <div className="panel-stat-card" style={{ border: data.health.serverErrors + data.health.clientErrors > 0 ? '1.5px solid rgba(225,29,72,0.4)' : undefined }}>
              <div className="filter-label"><Activity size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Teknik Sağlık &amp; Hatalar</div>
              <div style={{ fontSize: 25, fontWeight: 800, color: data.health.serverErrors > 0 ? '#BE123C' : 'var(--aspan-text)' }}>
                {data.health.serverErrors + data.health.clientErrors} {lang === 'EN' ? 'errors' : lang === 'RU' ? 'ошибок' : lang === 'KK' ? 'қате' : 'hata'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                Sunucu 5xx: {data.health.serverErrors} · İstemci: {data.health.clientErrors} · 429: {data.health.rateLimited}
              </div>
            </div>
          </div>

          {/* Suspicious Traffic Alerts with Explicit Reasons */}
          <div className="panel-card">
            <strong style={{ fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <ShieldAlert size={18} color={data.health.suspiciousAlerts.length > 0 ? '#BE123C' : '#059669'} />
              Şüpheli Trafik ve Güvenlik Sinyalleri
            </strong>
            {data.health.suspiciousAlerts.length === 0 ? (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', color: '#047857', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} />
                Seçilen tarih aralığında olağandışı giriş hatası, hız sınırı patlaması veya sayfa yükü anomalisi tespit edilmedi. (Başarısız giriş: {data.health.authFailures} · Engellenen 429: {data.health.rateLimited})
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.health.suspiciousAlerts.map((al) => (
                  <div
                    key={al.code}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: al.level === 'high' ? 'rgba(225,29,72,0.08)' : 'rgba(245,158,11,0.1)',
                      border: `1px solid ${al.level === 'high' ? 'rgba(225,29,72,0.35)' : 'rgba(245,158,11,0.4)'}`,
                      color: al.level === 'high' ? '#9F1239' : '#92400E',
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span>[{al.code}] {al.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversion Funnel + Combined Visits/Bookings/Errors Trend */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <div className="panel-card" style={{ marginBottom: 0 }}>
              <strong style={{ fontSize: 15.5, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <TrendingUp size={16} color="#00A8B5" /> Dönüşüm Hunisi (Arama → Biletleme)
              </strong>
              <p style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginTop: 0 }}>
                İsteğe bağlı ziyaretçi olayları yalnızca analitik çerezi onaylandığında toplanır; rezervasyonlar sunucuda tekilleştirilir.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {funnelSteps.map((step) => {
                  const pct = Math.round((step.count / maxFunnel) * 100);
                  return (
                    <div key={step.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                        <span>{step.label}</span>
                        <strong>{step.count}</strong>
                      </div>
                      <div style={{ width: '100%', height: 9, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(step.count > 0 ? 6 : 0, pct)}%`, height: '100%', background: step.color, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel-card" style={{ marginBottom: 0 }}>
              <strong style={{ fontSize: 15.5, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <BarChart3 size={16} color="#10B981" /> Ziyaret, İşlem ve Hata Eğilimi
              </strong>
              <div style={{ display: 'flex', gap: 12, fontSize: 11.5, fontWeight: 700, marginBottom: 10 }}>
                <span style={{ color: '#0284C7' }}>■ Ziyaret/Arama</span>
                <span style={{ color: '#10B981' }}>■ Rezervasyon</span>
                <span style={{ color: '#E11D48' }}>■ Hata</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: 130 }}>
                {data.dailyTrend.map((d) => (
                  <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 96 }}>
                      <div title={`${d.date} Ziyaret: ${d.visits}`} style={{ width: 8, height: Math.max(4, Math.round((d.visits / maxTrend) * 90)), background: '#0284C7', borderRadius: 3 }} />
                      <div title={`${d.date} İşlem: ${d.bookings}`} style={{ width: 8, height: Math.max(4, Math.round((d.bookings / maxTrend) * 90)), background: '#10B981', borderRadius: 3 }} />
                      <div title={`${d.date} Hata: ${d.errors}`} style={{ width: 8, height: Math.max(4, Math.round((d.errors / maxTrend) * 90)), background: d.errors > 0 ? '#E11D48' : '#E2E8F0', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--aspan-text-muted)' }}>{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* External Observability Connectors (PostHog / Cloudflare / Sentry) */}
          <div className="panel-card">
            <strong style={{ fontSize: 15.5, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <ShieldCheck size={16} color="#00A8B5" /> Harici Analiz ve İzleme Entegrasyonları (PII Maskeli)
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {[
                {
                  name: 'PostHog (Ürün Hunisi)',
                  configured: data.integrations.posthog.configured,
                  envVar: 'POSTHOG_KEY',
                  desc: 'Yalnızca çerez onayı sonrası anonim olaylar; kimlik/pasaport/kart gönderilmez.',
                },
                {
                  name: 'Cloudflare (WAF / Şüpheli Trafik)',
                  configured: data.integrations.cloudflare.configured,
                  envVar: 'CLOUDFLARE_ZONE_ID + TRUST_PROXY=1',
                  desc: 'DDoS, bot ve IP tabanlı engel verisi; gerçek istemci IP başlığı doğrulanır.',
                },
                {
                  name: 'Sentry (Teknik Hata Takibi)',
                  configured: data.integrations.sentry.configured,
                  envVar: 'SENTRY_DSN',
                  desc: 'Frontend/Backend hatalarını parola, token ve belge numarası temizlenmiş olarak toplar.',
                },
              ].map((svc) => (
                <div key={svc.name} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--aspan-border)', background: 'var(--aspan-bg-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{svc.name}</strong>
                    <span className={`status-badge ${svc.configured ? 'ok' : 'warn'}`}>
                      {svc.configured ? 'Bağlı' : 'Anahtar Bekleniyor'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>{svc.desc}</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#0369A1', marginTop: 6 }}>{svc.envVar}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Account Security: Password Change & Optional TOTP 2FA */}
      <div className="panel-card">
        <strong style={{ fontSize: 15.5, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <KeyRound size={16} color="#D97706" /> Hesap Güvenliği (Parola Değiştirme &amp; 2FA)
        </strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Parola Güncelle (Diğer Oturumları Kapatır)</div>
            <input
              type="password"
              required
              className="modal-input"
              placeholder="Mevcut parola"
              value={curPass}
              onChange={(e) => setCurPass(e.target.value)}
            />
            <input
              type="password"
              required
              minLength={12}
              className="modal-input"
              placeholder="Yeni parola (en az 12 karakter)"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
            <button type="submit" disabled={secBusy} className="btn-gold-nav" style={{ height: 38, justifyContent: 'center' }}>
              Parolayı Güncelle
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              İki Aşamalı Doğrulama (TOTP 2FA):{' '}
              <span className={`status-badge ${totpActive ? 'ok' : 'warn'}`}>
                {totpActive ? 'Aktif' : 'Kapalı'}
              </span>
            </div>
            <PanelMfaForm active={totpActive} onComplete={(user) => {
              setTotpActive(true);
              onAccountChanged?.(user);
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};
