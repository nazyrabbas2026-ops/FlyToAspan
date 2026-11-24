import React, { useEffect, useRef, useState } from 'react';
import {
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Phone,
  Check,
  LayoutDashboard,
  LogOut,
  Sliders,
} from 'lucide-react';
import { NavbarIcon } from './NavbarIcon';
import { CURRENCIES } from '../data/mockData';
import { hrefForPage } from '../data/routes';
import { LANGUAGES, PHONE_DISPLAY, TRANSLATIONS } from '../i18n/translations';
import { CurrencyCode, LangCode, PageView, UserProfile } from '../types';

interface NavbarProps {
  currentPage: PageView;
  onNavigate: (page: PageView) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  lang: LangCode;
  onSelectLang: (lang: LangCode) => void;
  currency: CurrencyCode;
  onSelectCurrency: (currency: CurrencyCode) => void;
  user: UserProfile | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onOpenAuth,
  lang,
  onSelectLang,
  currency,
  onSelectCurrency,
  user,
  onLogout,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [curMenuOpen, setCurMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[lang].nav;
  const activeLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
  const activeCur = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
      if (curRef.current && !curRef.current.contains(e.target as Node)) {
        setCurMenuOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleGo = (page: PageView) => {
    onNavigate(page);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const followPage = (event: React.MouseEvent<HTMLAnchorElement>, page: PageView) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    handleGo(page);
  };


  return (
    <>
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
        <defs>
          <filter id="brand-logo-smoothing" colorInterpolationFilters="sRGB" x="-6%" y="-12%" width="112%" height="124%">
            <feGaussianBlur in="SourceGraphic" stdDeviation=".28" result="smoothed" />
            <feComposite in="SourceGraphic" in2="smoothed" operator="arithmetic" k2=".4" k3=".6" result="antialiased" />
            <feComponentTransfer in="antialiased" result="cleanEdge">
              <feFuncA type="linear" slope="1.2" intercept="-.2" />
            </feComponentTransfer>
            <feMorphology in="SourceAlpha" operator="erode" radius=".5" result="interior" />
            <feComposite in="SourceGraphic" in2="interior" operator="in" result="sharp" />
            <feComposite in="cleanEdge" in2="interior" operator="out" result="edge" />
            <feComposite in="sharp" in2="edge" operator="over" />
          </filter>
        </defs>
      </svg>
      <header className="main-header">
        <div className="container">
          <nav className="header-nav" aria-label="Ana menü">
            <div className="header-left">
              <button
                type="button"
                className="brand-logo-btn"
                onClick={() => handleGo('home')}
                aria-label="FlyToAspan Ana Sayfa"
              >
                <img
                  src="/images/logo-dark.png"
                  alt="FlyToAspan by Infinitive Travel"
                  className="brand-logo-img"
                />
              </button>

              <div className="nav-links">
                <a className={`nav-link-item ${currentPage === 'campaigns' ? 'active' : ''}`} href={hrefForPage('campaigns')} onClick={(event) => followPage(event, 'campaigns')}
                >
                  <NavbarIcon name="gift" size={17} />
                  <span>{t.campaigns}</span>
                </a>
                <a className={`nav-link-item ${currentPage === 'checkin' ? 'active' : ''}`} href={hrefForPage('checkin')} onClick={(event) => followPage(event, 'checkin')}
                >
                  <NavbarIcon name="takeoff" size={17} />
                  <span>{t.checkin}</span>
                </a>
                <a className={`nav-link-item ${currentPage === 'help' ? 'active' : ''}`} href={hrefForPage('help')} onClick={(event) => followPage(event, 'help')}
                >
                  <NavbarIcon name="help" size={17} />
                  <span>{t.help}</span>
                </a>
                <a className={`nav-link-item ${currentPage === 'booking-ops' ? 'active' : ''}`} href={hrefForPage('booking-ops')} onClick={(event) => followPage(event, 'booking-ops')}
                >
                  <NavbarIcon name="ticket" size={17} />
                  <span>{t.booking}</span>
                </a>
              </div>
            </div>

            <div className="header-right">
              <span className="header-divider" aria-hidden="true" />
              {user ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div className="lang-dropdown-wrap" ref={userRef}>
                    <button
                      type="button"
                      className="user-pill-btn"
                      onClick={() => setUserMenuOpen((v) => !v)}
                      aria-expanded={userMenuOpen}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <span className="user-avatar-dot">
                        {user.firstName.charAt(0).toUpperCase()}
                        {user.lastName.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ maxWidth: 112, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.firstName}
                      </span>
                      <ChevronDown size={14} />
                    </button>

                    <div
                      className={`lang-dropdown-menu ${userMenuOpen ? 'is-open' : ''}`}
                      style={{ width: 224 }}
                      role="menu"
                      aria-hidden={!userMenuOpen}
                    >
                      <div
                        style={{
                          padding: '8px 10px 10px',
                          borderBottom: '1px solid var(--aspan-border)',
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--aspan-text)' }}>
                          {user.firstName} {user.lastName}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>
                          {user.email}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="lang-opt-btn"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleGo('panel');
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <LayoutDashboard size={15} color="#00A8B5" />
                          {t.myPanel}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="lang-opt-btn"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleGo('booking-ops');
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <NavbarIcon name="ticket" size={15} color="#DDA838" />
                          {t.booking}
                        </span>
                      </button>
                      {(user?.role === 'admin' || Boolean(user?.permissions?.length)) && (<button
                        type="button"
                        className="lang-opt-btn"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleGo('admin');
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Sliders size={15} color="#00A8B5" />
                          {user?.role === 'admin' ? 'Yönetici & Fiyat Paneli' : 'Ekip & Satış Paneli'}
                        </span>
                      </button>)}
                      <div style={{ height: 1, background: 'var(--aspan-border)', margin: '4px 0' }} />
                      <button
                        type="button"
                        className="lang-opt-btn"
                        style={{ color: '#be123c' }}
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <LogOut size={15} />
                          {t.logout}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-ghost-nav"
                    onClick={() => onOpenAuth('login')}
                  >
                    <NavbarIcon name="login" size={17} />
                    <span>{t.login}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-gold-nav"
                    onClick={() => onOpenAuth('register')}
                  >
                    <NavbarIcon name="register" size={17} />
                    <span>{t.register}</span>
                  </button>
                </>
              )}

              {/* Multi-Currency Selector: TRY, USD, EUR, KZT, RUB */}
              <div className="lang-dropdown-wrap" ref={curRef}>
                <button
                  type="button"
                  className="btn-lang-nav"
                  onClick={() => setCurMenuOpen((v) => !v)}
                  aria-expanded={curMenuOpen}
                  title="Para Birimi / Currency"
                >
                  <span style={{ color: 'var(--aspan-gold-bright)', fontWeight: 800 }}>
                    {activeCur.symbol}
                  </span>
                  <span>{activeCur.code}</span>
                  <ChevronDown size={13} />
                </button>

                <div
                  className={`lang-dropdown-menu ${curMenuOpen ? 'is-open' : ''}`}
                  style={{ width: 215 }}
                  role="menu"
                  aria-hidden={!curMenuOpen}
                >
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      role="menuitem"
                      className={`lang-opt-btn ${c.code === currency ? 'active' : ''}`}
                      onClick={() => {
                        onSelectCurrency(c.code);
                        setCurMenuOpen(false);
                      }}
                    >
                      <span>{c.label}</span>
                      {c.code === currency && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4-Language Selector: TR, EN, RU, KK */}
              <div className="lang-dropdown-wrap" ref={langRef}>
                <button
                  type="button"
                  className="btn-lang-nav"
                  onClick={() => setLangMenuOpen((v) => !v)}
                  aria-expanded={langMenuOpen}
                  title="Dil Seç / Select Language"
                >
                  <NavbarIcon name="globe" size={15} color="var(--aspan-sky-light)" />
                  <span>{activeLang.code}</span>
                  <ChevronDown size={13} />
                </button>

                <div
                  className={`lang-dropdown-menu ${langMenuOpen ? 'is-open' : ''}`}
                  role="menu"
                  aria-hidden={!langMenuOpen}
                >
                  {LANGUAGES.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      role="menuitem"
                      className={`lang-opt-btn ${opt.code === lang ? 'active' : ''}`}
                      onClick={() => {
                        onSelectLang(opt.code);
                        setLangMenuOpen(false);
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span>{opt.flag}</span>
                        <span>{opt.nativeName}</span>
                      </span>
                      {opt.code === lang && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mobile-header-actions">
              <button
                type="button"
                className="mobile-quick-pill"
                onClick={() => setDrawerOpen(true)}
                aria-label="Dil ve Para Birimi"
              >
                <span style={{ color: 'var(--aspan-gold-bright)', fontWeight: 800 }}>
                  {activeCur.symbol}
                </span>
                <span>{activeCur.code}</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{activeLang.code}</span>
              </button>
              <button
                type="button"
                className="mobile-menu-btn"
                onClick={() => setDrawerOpen(true)}
                aria-label="Menüyü Aç"
              >
                <Menu size={20} />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="ufn-drawer" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="drawer-head">
                <img
                  src="/images/logo-light.png"
                  alt="FlyToAspan"
                  style={{ height: 34, width: 'auto' }}
                />
                <button
                  type="button"
                  className="drawer-close"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Kapat"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="drawer-nav">
                <a className="drawer-link" href={hrefForPage('campaigns')} onClick={(event) => followPage(event, 'campaigns')}>
                  <span className="drawer-link-left">
                    <NavbarIcon name="gift" size={18} />
                    {t.campaigns}
                  </span>
                  <ChevronRight size={17} />
                </a>
                <a className="drawer-link" href={hrefForPage('checkin')} onClick={(event) => followPage(event, 'checkin')}>
                  <span className="drawer-link-left">
                    <NavbarIcon name="takeoff" size={18} />
                    {t.checkin}
                  </span>
                  <ChevronRight size={17} />
                </a>
                <a className="drawer-link" href={hrefForPage('help')} onClick={(event) => followPage(event, 'help')}>
                  <span className="drawer-link-left">
                    <NavbarIcon name="help" size={18} />
                    {t.help}
                  </span>
                  <ChevronRight size={17} />
                </a>
                <a className="drawer-link" href={hrefForPage('booking-ops')} onClick={(event) => followPage(event, 'booking-ops')}
                >
                  <span className="drawer-link-left">
                    <NavbarIcon name="ticket" size={18} />
                    {t.booking}
                  </span>
                  <ChevronRight size={17} />
                </a>
                {user?.role === 'admin' && (<button
                  type="button"
                  className="drawer-link"
                  onClick={() => handleGo('admin')}
                >
                  <span className="drawer-link-left">
                    <Sliders size={18} />
                    Yönetici &amp; Fiyat Paneli
                  </span>
                  <ChevronRight size={17} />
                </button>)}
              </div>

              {user ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <button
                    type="button"
                    className="btn-gold-nav"
                    style={{ width: '100%', justifyContent: 'center', height: 46, borderRadius: 14 }}
                    onClick={() => handleGo('panel')}
                  >
                    <LayoutDashboard size={17} />
                    {user.firstName} — {t.myPanel}
                  </button>
                  <button
                    type="button"
                    className="drawer-link"
                    style={{ justifyContent: 'center', color: '#be123c', background: 'rgba(225,29,72,0.08)' }}
                    onClick={() => {
                      setDrawerOpen(false);
                      onLogout();
                    }}
                  >
                    <span className="drawer-link-left" style={{ color: '#be123c' }}>
                      <LogOut size={17} color="#be123c" />
                      {t.logout}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="drawer-auth">
                  <button
                    type="button"
                    className="drawer-link"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenAuth('login');
                    }}
                  >
                    {t.login}
                  </button>
                  <button
                    type="button"
                    className="btn-gold-nav"
                    style={{ justifyContent: 'center', height: 46, borderRadius: 14 }}
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenAuth('register');
                    }}
                  >
                    {t.register}
                  </button>
                </div>
              )}

              {/* 4 Language Pills in Drawer */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--aspan-text-muted)', marginBottom: 8 }}>
                  DİL / LANGUAGE / ЯЗЫК / ТІЛ
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {LANGUAGES.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      className={`lang-opt-btn ${opt.code === lang ? 'active' : ''}`}
                      style={{ border: '1px solid var(--aspan-border)' }}
                      onClick={() => onSelectLang(opt.code)}
                    >
                      <span>
                        {opt.flag} {opt.nativeName}
                      </span>
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--aspan-text-muted)', margin: '12px 0 8px' }}>
                  PARA BİRİMİ / CURRENCY
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className={`lang-opt-btn ${c.code === currency ? 'active' : ''}`}
                      style={{ border: '1px solid var(--aspan-border)', width: 'auto', padding: '7px 11px' }}
                      onClick={() => onSelectCurrency(c.code)}
                    >
                      <span>
                        {c.symbol} {c.code}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--aspan-text)',
                  fontWeight: 800,
                  marginBottom: 4,
                }}
              >
                <Phone size={15} color="#00A8B5" />
                <span>{PHONE_DISPLAY}</span>
              </div>
              <div>{t.supportLine}</div>
              <div style={{ marginTop: 8, fontSize: 11 }}>
                INFINITIVE TRAVEL · TÜRSAB &amp; IATA Yetkili Acente
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
