import React, { useRef, useState } from 'react';
import { Lock, ShieldCheck, ArrowLeft, LogOut } from 'lucide-react';
import { api, apiMessage } from '../data/api';
import { useAdminDomI18n } from '../hooks/useAdminDomI18n';
import type { LangCode, UserProfile } from '../types';

interface AdminLoginGateProps {
  lang?: LangCode;
  onSelectLang?: (next: LangCode) => void;
  sessionLoading: boolean;
  currentUser: UserProfile | null;
  isDedicatedSubdomain: boolean;
  onLoginSuccess: (user: UserProfile) => void;
  onLogout: () => void;
  onBackToSite: () => void;
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({
  lang = 'TR',
  onSelectLang,
  sessionLoading,
  currentUser,
  isDedicatedSubdomain,
  onLoginSuccess,
  onLogout,
  onBackToSite,
}) => {
  const gateRef = useRef<HTMLDivElement | null>(null);
  const [localLang, setLocalLang] = useState<LangCode>(lang);
  const activeLang: LangCode = onSelectLang ? lang : localLang;
  const setGateLang = (next: LangCode) => {
    setLocalLang(next);
    onSelectLang?.(next);
  };
  useAdminDomI18n(gateRef, activeLang);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { user } = await api.login(email, password);
      const allowed = user.role === 'admin' || Boolean(user.permissions && user.permissions.length > 0);
      if (!allowed) {
        setError('Bu hesap bireysel müşteri hesabıdır. Yalnızca yönetici veya onaylı B2B ekip hesapları giriş yapabilir.');
        return;
      }
      onLoginSuccess(user);
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={gateRef}
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 20% 15%, #113452 0%, #0B1E33 55%, #071322 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div className="adm-lang-switch" role="group" aria-label="Portal Language" data-no-i18n="true" style={{ marginBottom: 14 }}>
        {(['TR', 'EN', 'RU', 'KK'] as const).map((code) => (
          <button
            key={code}
            type="button"
            className={`adm-lang-btn ${activeLang === code ? 'active' : ''}`}
            onClick={() => setGateLang(code)}
          >
            {code}
          </button>
        ))}
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          background: '#FFFFFF',
          borderRadius: 24,
          padding: '32px 30px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img
            src="/images/logo-light.png"
            alt="FlyToAspan"
            style={{ height: 42, width: 'auto', margin: '0 auto 12px', display: 'block' }}
          />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 999,
              background: 'rgba(0, 168, 181, 0.12)',
              color: '#0369A1',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.6,
            }}
          >
            <ShieldCheck size={13} /> MERKEZ YÖNETİM &amp; B2B EKİP PORTALI
          </span>
          <h1 style={{ margin: '12px 0 4px', fontSize: 22, fontWeight: 800, color: '#0B1E33' }}>
            Yönetici Portal Girişi
          </h1>
          <p style={{ margin: 0, fontSize: 12.5, color: '#64748B' }}>
            Bağımsız operasyon, finans, CRM ve B2B acente yönetim ekranı
          </p>
        </div>

        {sessionLoading ? (
          <p role="status" style={{ textAlign: 'center', fontSize: 13.5, color: '#64748B', padding: '18px 0' }}>
            Güvenli oturum kontrol ediliyor…
          </p>
        ) : currentUser ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#BE123C',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              <strong>{currentUser.email}</strong> hesabı yönetici veya onaylı ekip yetkisine sahip değil.
            </div>
            <button
              type="button"
              className="uf-pop-done"
              style={{ width: '100%', height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={onLogout}
            >
              <LogOut size={15} /> Çıkış Yap ve Yönetici Hesabıyla Gir
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && (
              <p className="form-action-error" role="alert" style={{ margin: 0 }}>
                {error}
              </p>
            )}
            <div>
              <label htmlFor="admin-portal-email" style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#0F172A' }}>
                Kurumsal / Yönetici E-Posta
              </label>
              <input
                id="admin-portal-email"
                type="email"
                required
                autoComplete="email"
                className="modal-input"
                placeholder="admin@flytoaspan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="admin-portal-pass" style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#0F172A' }}>
                Şifre
              </label>
              <input
                id="admin-portal-pass"
                type="password"
                required
                autoComplete="current-password"
                className="modal-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn-gold-nav"
              style={{ width: '100%', height: 46, justifyContent: 'center', marginTop: 4, fontSize: 14 }}
            >
              <Lock size={15} />
              {busy ? 'Doğrulanıyor...' : 'Yönetim Paneline Giriş Yap'}
            </button>
          </form>
        )}

        {!isDedicatedSubdomain && (
          <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
            <button
              type="button"
              onClick={onBackToSite}
              style={{
                border: 'none',
                background: 'none',
                color: '#0369A1',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowLeft size={14} /> Müşteri Web Sitesine Dön
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>
        FlyToAspan by Infinitive Travel · 256-bit SSL &amp; RBAC Korumalı Yönetim Portalı
      </div>
    </div>
  );
};
