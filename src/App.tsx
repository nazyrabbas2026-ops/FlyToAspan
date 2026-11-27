import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSearch } from './components/HeroSearch';
import { HomeSections } from './components/HomeSections';
import { Footer } from './components/Footer';
import { FlightResultsPage } from './components/FlightResultsPage';
import { HotelResultsPage, TransferResultsPage } from './components/HotelTransferResults';
import {
  BookingOpsPage,
  CampaignsPage,
  HelpPage,
  OnlineCheckInPage,
} from './components/SubPages';
import { AuthModals } from './components/AuthModals';
import { AdminLoginGate } from './components/AdminLoginGate';
import { DEFAULT_MARKUP, FlightDeal, refreshLiveExchangeRates } from './data/mockData';
import { addCalendarDays, toCalendarDate } from './data/calendarDates';
import { api, apiMessage, type AdminCatalog, type BookingDraft } from './data/api';
import { flightSearchHref, hrefForPage, parseFlightSearch, readSiteRoute } from './data/routes';

const MemberPanel = lazy(() =>
  import('./components/MemberPanel').then((m) => ({ default: m.MemberPanel }))
);
const AdminPanelPage = lazy(() =>
  import('./components/AdminPanelPage').then((m) => ({ default: m.AdminPanelPage }))
);
const LegalPages = lazy(() =>
  import('./components/LegalPages').then((m) => ({ default: m.LegalPages }))
);
const TourResultsPage = lazy(() =>
  import('./components/TourResultsPage').then((m) => ({ default: m.TourResultsPage }))
);
import {
  AdminMarkupConfig,
  BookingRecord,
  CurrencyCode,
  FlightSearchQuery,
  HotelSearchQuery,
  LangCode,
  LegalDocKey,
  PageView,
  SearchTab,
  TransferSearchQuery,
  UserProfile,
} from './types';

export const App: React.FC = () => {
  const isAdminSubdomain =
    typeof window !== 'undefined' && /^(panel|admin)\./i.test(window.location.hostname);
  const [page, updatePage] = useState<PageView>(() =>
    isAdminSubdomain ? 'admin' : readSiteRoute(window.location.pathname).page
  );
  const [lang, setLangState] = useState<LangCode>(() => {
    try {
      const saved = localStorage.getItem('flytoaspan_lang_v1');
      if (saved === 'TR' || saved === 'EN' || saved === 'RU' || saved === 'KK') return saved;
    } catch { /* ignore */ }
    return 'TR';
  });
  const setLang = (next: LangCode) => {
    setLangState(next);
    try { localStorage.setItem('flytoaspan_lang_v1', next); } catch { /* ignore */ }
  };
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    try {
      const saved = localStorage.getItem('flytoaspan_currency_v1');
      if (saved === 'TRY' || saved === 'USD' || saved === 'EUR' || saved === 'KZT' || saved === 'RUB') return saved;
    } catch { /* ignore */ }
    return 'TRY';
  });
  const setCurrency = (next: CurrencyCode) => {
    setCurrencyState(next);
    try { localStorage.setItem('flytoaspan_currency_v1', next); } catch { /* ignore */ }
  };
  const [, setFxVersion] = useState(0);
  const [legalDoc, updateLegalDoc] = useState(() => readSiteRoute(window.location.pathname).legalDoc);
  const [markup, setMarkup] = useState<AdminMarkupConfig>(DEFAULT_MARKUP);
  const [publicCatalog, setPublicCatalog] = useState<Partial<AdminCatalog>>({});
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [activeTab, setActiveTab] = useState<SearchTab>('flight');
  const [initialDate] = useState(() => toCalendarDate(new Date()));
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashFloat, setSplashFloat] = useState(0);
  const isStandaloneAdmin = page === 'admin' || isAdminSubdomain;
  const [splashStage, setSplashStage] = useState<'playing' | 'exiting' | 'done'>(() => {
    try {
      if (isStandaloneAdmin) return 'done';
      return sessionStorage.getItem('flytoaspan_splash_seen') === '1' ? 'done' : 'playing';
    } catch {
      return isStandaloneAdmin ? 'done' : 'playing';
    }
  });

  useEffect(() => {
    refreshLiveExchangeRates().then(() => setFxVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    if (splashStage === 'done') return;
    try {
      sessionStorage.setItem('flytoaspan_splash_seen', '1');
    } catch {
      /* ignore */
    }
    // 1.85-second cinematic 2-stage splash: Eagle Crest soars in first, then FlyToAspan wordmark glides in
    const DURATION_MS = 1850;
    const HOLD_MS = 180;
    const EXIT_MS = 520;
    const startTime = performance.now();
    let rafId = 0;
    let holdTimer: number | undefined;
    let doneTimer: number | undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const d = Math.min(1, Math.max(0, elapsed / DURATION_MS));
      const eased = d < 0.5 ? 2 * d * d : 1 - Math.pow(-2 * d + 2, 2) / 2;
      setSplashFloat(eased);
      setSplashProgress(Math.round(eased * 100));

      if (d < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setSplashFloat(1);
        setSplashProgress(100);
        holdTimer = window.setTimeout(() => {
          setSplashStage('exiting');
          doneTimer = window.setTimeout(() => {
            document.body.style.overflow = prevOverflow;
            setSplashStage('done');
          }, EXIT_MS);
        }, HOLD_MS);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (holdTimer) window.clearTimeout(holdTimer);
      if (doneTimer) window.clearTimeout(doneTimer);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [bookingView, setBookingView] = useState<{ key: string; records: BookingRecord[] } | null>(null);
  const canManage = user?.role === 'admin' || Boolean(user?.permissions && user.permissions.length > 0);
  const bookingKey = user && (page === 'panel' || (page === 'admin' && canManage)) ? user.id + ':' + page : '';
  const bookings = bookingView && bookingView.key === bookingKey ? bookingView.records : [];

  useEffect(() => {
    const controller = new AbortController();
    api.session(controller.signal)
      .then(({ user }) => setUser(user))
      .catch((error) => { if (!controller.signal.aborted) setNotice(apiMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setSessionLoading(false); });
    api.pricing(controller.signal)
      .then(({ markup }) => setMarkup(markup ?? DEFAULT_MARKUP))
      .catch((error) => { if (!controller.signal.aborted) setNotice(apiMessage(error)); });
    api.publicCatalog(controller.signal)
      .then(({ catalog }) => { if (!controller.signal.aborted) setPublicCatalog(catalog ?? {}); })
      .catch(() => { /* fallback to defaults */ });
    return () => controller.abort();
  }, []);

  const refreshPublicCatalog = () => {
    api.publicCatalog()
      .then(({ catalog }) => setPublicCatalog(catalog ?? {}))
      .catch(() => { /* ignore */ });
  };

  useEffect(() => {
    if (!bookingKey) return;
    const controller = new AbortController();
    api.bookings(page === 'admin', controller.signal)
      .then(({ bookings }) => {
        if (!controller.signal.aborted) setBookingView({ key: bookingKey, records: bookings });
      })
      .catch((error) => { if (!controller.signal.aborted) setNotice(apiMessage(error)); });
    return () => controller.abort();
  }, [bookingKey, page]);

  useEffect(() => {
    document.documentElement.lang = lang === 'KK' ? 'kk' : lang.toLowerCase();
    const titles: Record<LangCode, string> = {
      TR: 'FlyToAspan — Uçak Bileti, Otel, Transfer ve Paket Turlar',
      EN: 'FlyToAspan — Flights, Hotels, Transfers & Tour Packages',
      RU: 'FlyToAspan — Авиабилеты, Отели, Трансферы и Туры',
      KK: 'FlyToAspan — Әуе билеттері, Қонақүйлер, Трансфер және Турлар',
    };
    document.title = titles[lang] || titles.TR;
  }, [lang]);

  useEffect(() => {
    const followHistory = () => {
      const route = readSiteRoute(window.location.pathname);
      updatePage(route.page);
      updateLegalDoc(route.legalDoc);
      setNotice('');
    };
    window.addEventListener('popstate', followHistory);
    return () => window.removeEventListener('popstate', followHistory);
  }, []);

  const setPage = (next: PageView, doc: LegalDocKey = legalDoc) => {
    const path = hrefForPage(next, doc);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    if (next === 'legal') updateLegalDoc(doc);
    setNotice('');
    updatePage(next);
  };

  const signOut = async () => {
    try {
      await api.logout();
      setUser(null);
      setBookingView(null);
      setPage('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setNotice(apiMessage(error));
    }
  };

  const [flightQuery, setFlightQuery] = useState<FlightSearchQuery>(() =>
    parseFlightSearch(window.location.search, {
      tripType: 'oneway',
      fromCode: 'IST',
      toCode: 'AYT',
      departDate: addCalendarDays(initialDate, 15),
      returnDate: addCalendarDays(initialDate, 22),
      adults: 1,
      children: 0,
      infants: 0,
      cabin: 'Ekonomi',
    })
  );

  const [hotelQuery, setHotelQuery] = useState<HotelSearchQuery>({
    destination: 'Bodrum',
    checkIn: addCalendarDays(initialDate, 5),
    checkOut: addCalendarDays(initialDate, 7),
    adults: 2,
    children: 0,
  });

  const [transferQuery, setTransferQuery] = useState<TransferSearchQuery>({
    from: 'İstanbul Havalimanı (IST)',
    to: 'Taksim / Şişli',
    date: addCalendarDays(initialDate, 15),
    time: '14:30',
    adults: 2,
    children: 0,
  });

  const openFlightSearch = (q: FlightSearchQuery) => {
    setFlightQuery(q);
    const targetHref = flightSearchHref(q);
    if (window.location.pathname + window.location.search !== targetHref) {
      window.history.pushState(null, '', targetHref);
    }
    setNotice('');
    updatePage('flight-results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectDeal = (deal: FlightDeal) => {
    openFlightSearch({
      ...flightQuery,
      fromCode: deal.fromCode,
      toCode: deal.toCode,
      departDate: deal.isoDate,
      tripType: 'oneway',
    });
  };

  const handleSelectDestinationCode = (code: string) => {
    setActiveTab('flight');
    setFlightQuery((prev) => ({ ...prev, toCode: code }));
    setPage('home');
    setTimeout(() => {
      document.getElementById('search-hero')?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleJumpToTab = (tab: SearchTab) => {
    setActiveTab(tab);
    setPage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeRecords = (update: (records: BookingRecord[]) => BookingRecord[]) =>
    setBookingView((view) => view?.key === bookingKey ? { ...view, records: update(view.records) } : view);

  const handleAddBooking = async (draft: BookingDraft, admin = false) => {
    const { booking } = await api.createBooking(draft, admin);
    if (admin) changeRecords((records) => [booking, ...records]);
    return booking;
  };

  const handleCancelBooking = async (id: string) => {
    const { booking } = await api.cancel(id);
    changeRecords((records) => records.map((record) => record.id === id ? booking : record));
  };

  const handleUpdateBookingStatus = async (id: string, status: BookingRecord['status']) => {
    const { booking } = await api.setStatus(id, status);
    changeRecords((records) => records.map((record) => record.id === id ? booking : record));
  };

  const handleUpdateBookingCheckin = async (id: string, payload: { checkinStatus: 'pending' | 'completed'; assignedSeat?: string }) => {
    const { booking } = await api.updateBookingCheckin(id, payload);
    changeRecords((records) => records.map((record) => record.id === id ? booking : record));
  };

  const handleDeleteBooking = async (id: string) => {
    await api.deleteBooking(id);
    changeRecords((records) => records.filter((record) => record.id !== id));
  };

  return (
    <div className="app-shell">
      {splashStage !== 'done' && (() => {
        // Stage 1 (0% -> 42%): Golden Eagle Crest soars & lifts into place with ambient glow
        const eagleT = Math.min(1, splashFloat / 0.42);
        const eagleEase = 1 - Math.pow(1 - eagleT, 3);
        const eagleY = (1 - eagleEase) * 26;
        const eagleScale = 0.72 + eagleEase * 0.28;

        // Stage 2 (38% -> 96%): "FlyToAspan by Infinitive Travel" wordmark glides in beside the eagle
        const textT = Math.max(0, Math.min(1, (splashFloat - 0.38) / 0.58));
        const textEase = 1 - Math.pow(1 - textT, 3);
        const textClipRight = (1 - textEase) * 68;
        const textX = (1 - textEase) * -14;

        // Stage 3 (68% -> 100%): Subtle golden tagline fades in underneath
        const tagT = Math.max(0, Math.min(1, (splashFloat - 0.68) / 0.32));

        return (
          <div
            id="fta-preloader"
            data-stage={splashStage}
            className={`kv-splash-overlay ${splashStage === 'exiting' ? 'is-exiting' : ''}`}
            role="status"
            aria-live="polite"
            aria-label="FlyToAspan Yükleniyor"
            onClick={() => {
              document.body.style.overflow = '';
              setSplashStage('done');
            }}
            style={{ cursor: 'pointer' }}
            title="Geçmek için dokunun / Click to skip"
          >
            <div
              className={`kv-splash-brand-stack ${splashStage === 'exiting' ? 'is-exiting' : ''}`}
              aria-hidden="true"
            >
              <div className="kv-splash-logo-stage">
                <div
                  className="kv-splash-aura"
                  style={{
                    opacity: eagleEase * 0.95,
                    transform: `translateY(-50%) scale(${(0.65 + eagleEase * 0.45).toFixed(3)})`,
                  }}
                />
                {/* Stage 1: Golden Eagle Crest flies in first */}
                <div
                  className="kv-splash-layer kv-splash-eagle-layer"
                  style={{
                    opacity: eagleEase,
                    transform: `translateY(${eagleY.toFixed(2)}px) scale(${eagleScale.toFixed(3)})`,
                    filter: `drop-shadow(0 0 ${(eagleEase * 16).toFixed(1)}px rgba(245, 205, 94, 0.38))`,
                  }}
                >
                  <img
                    src="/images/logo-dark.png"
                    alt="FlyToAspan Eagle Crest"
                    className="kv-splash-logo-live"
                  />
                </div>
                {/* Stage 2: FlyToAspan wordmark smoothly unveils after the eagle */}
                <div
                  className="kv-splash-layer"
                  style={{
                    opacity: textEase,
                    clipPath: `inset(0 ${textClipRight.toFixed(2)}% 0 32.5%)`,
                    transform: `translateX(${textX.toFixed(2)}px)`,
                  }}
                >
                  <img
                    src="/images/logo-dark.png"
                    alt="FlyToAspan by Infinitive Travel"
                    className="kv-splash-logo-live"
                  />
                </div>
              </div>
              <div
                className="kv-splash-tagline"
                style={{
                  opacity: tagT,
                  transform: `translateY(${((1 - tagT) * 8).toFixed(2)}px)`,
                }}
              >
                TÜRKİYE · KAZAKİSTAN · GLOBAL TRAVEL
              </div>
            </div>

            {/* Bottom 8% Centered Editorial 0-100% Counter */}
            <div className={`kv-splash-counter-wrap ${splashStage === 'exiting' ? 'is-exiting' : ''}`}>
              <div className="kv-splash-counter">
                <span>{splashProgress}</span>
                <sup className="kv-splash-sup">%</sup>
              </div>
              <div className="kv-splash-hairline">
                <div
                  className="kv-splash-hairline-fill"
                  style={{ width: `${splashProgress}%` }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {!isStandaloneAdmin && (
        <Navbar
          currentPage={page}
          onNavigate={setPage}
          onOpenAuth={setAuthMode}
          lang={lang}
          onSelectLang={setLang}
          currency={currency}
          onSelectCurrency={setCurrency}
          user={user}
          onLogout={signOut}
        />
      )}

      <main>
        {notice && <p className="site-action-notice" role="alert">{notice}</p>}
        {page === 'admin' && !canManage && (
          <AdminLoginGate
            lang={lang}
            onSelectLang={setLang}
            sessionLoading={sessionLoading}
            currentUser={user}
            isDedicatedSubdomain={isAdminSubdomain}
            onLoginSuccess={(u) => {
              setBookingView(null);
              setUser(u);
              setPage('admin');
            }}
            onLogout={signOut}
            onBackToSite={() => {
              setPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
        {page === 'panel' && !user && (
          <section className="inner-hero">
            <div className="container">
              <h1 className="inner-h1">
                {lang === 'EN' ? 'My Account' : lang === 'RU' ? 'Личный кабинет' : lang === 'KK' ? 'Жеке кабинет' : 'Hesabım'}
              </h1>
              {sessionLoading ? (
                <p role="status">
                  {lang === 'EN' ? 'Checking session…' : lang === 'RU' ? 'Проверка сессии…' : lang === 'KK' ? 'Сессия тексерілуде…' : 'Oturum kontrol ediliyor…'}
                </p>
              ) : (
                <>
                  <p>
                    {lang === 'EN' ? 'Sign in to view your bookings.' : lang === 'RU' ? 'Войдите, чтобы увидеть свои бронирования.' : lang === 'KK' ? 'Брондауларыңызды көру үшін кіріңіз.' : 'Rezervasyonlarınızı görmek için giriş yapın.'}
                  </p>
                  <button type="button" className="btn-gold-nav" onClick={() => setAuthMode('login')}>
                    {lang === 'EN' ? 'Sign In' : lang === 'RU' ? 'Войти' : lang === 'KK' ? 'Кіру' : 'Giriş Yap'}
                  </button>
                </>
              )}
            </div>
          </section>
        )}
        {page === 'home' && (
          <>
            <HeroSearch
              lang={lang}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              flightQuery={flightQuery}
              onFlightQueryChange={setFlightQuery}
              onSearchFlight={openFlightSearch}
              onSearchHotel={(q) => {
                setHotelQuery(q);
                setPage('hotel-results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onSearchTransfer={(q) => {
                setTransferQuery(q);
                setPage('transfer-results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onSearchTour={() => {
                setPage('tour-results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
            <HomeSections
              lang={lang}
              currency={currency}
              markup={markup}
              liveCatalog={publicCatalog}
              onSelectDeal={handleSelectDeal}
              onSelectHotelCity={(city) => {
                setHotelQuery((prev) => ({ ...prev, destination: city }));
                setPage('hotel-results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onSelectTransferCity={(city) => {
                setTransferQuery((prev) => ({
                  ...prev,
                  from: `${city} Havalimanı`,
                  to: `${city} Şehir Merkezi / Otel`,
                }));
                setPage('transfer-results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onSelectDestinationCode={handleSelectDestinationCode}
              onNavigate={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenAuth={(mode) => {
                if (user) {
                  setPage('panel');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  setAuthMode(mode);
                }
              }}
            />
          </>
        )}

        {page === 'flight-results' && (
          <FlightResultsPage
            lang={lang}
            currency={currency}
            markup={markup}
            isLoggedIn={Boolean(user)}
            manualFlights={publicCatalog.flights}
            operatorRules={publicCatalog.operators}
            liveCoupons={publicCatalog.coupons}
            query={flightQuery}
            onChangeQuery={(next) => {
              setFlightQuery(next);
              window.history.replaceState(null, '', flightSearchHref(next));
            }}
            onBackHome={() => {
              setPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onAddBooking={handleAddBooking}
          />
        )}

        {page === 'hotel-results' && (
          <HotelResultsPage
            lang={lang}
            currency={currency}
            markup={markup}
            liveHotels={publicCatalog.hotels}
            liveCoupons={publicCatalog.coupons}
            query={hotelQuery}
            onAddBooking={handleAddBooking}
            onBackHome={() => {
              setActiveTab('hotel');
              setPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {page === 'transfer-results' && (
          <TransferResultsPage
            lang={lang}
            currency={currency}
            markup={markup}
            liveTransfers={publicCatalog.transfers}
            liveCoupons={publicCatalog.coupons}
            query={transferQuery}
            onAddBooking={handleAddBooking}
            onBackHome={() => {
              setActiveTab('transfer');
              setPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {page === 'campaigns' && (
          <CampaignsPage
            lang={lang}
            liveCoupons={publicCatalog.coupons}
            onUseCampaign={handleJumpToTab}
          />
        )}
        {page === 'checkin' && <OnlineCheckInPage lang={lang} />}
        {page === 'help' && <HelpPage lang={lang} />}
        {page === 'booking-ops' && <BookingOpsPage lang={lang} currency={currency} />}

        <Suspense fallback={<div style={{ padding: '140px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--aspan-text-muted)' }}>FlyToAspan…</div>}>
          {page === 'tour-results' && (
            <TourResultsPage
              lang={lang}
              currency={currency}
              liveTours={publicCatalog.tours}
              onAddBooking={handleAddBooking}
              onBackHome={() => {
                setActiveTab('tour');
                setPage('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {page === 'admin' && canManage && (
            <AdminPanelPage
              lang={lang}
              onSelectLang={setLang}
              currency={currency}
              currentUser={user}
              markup={markup}
              onUpdateMarkup={async (next) => setMarkup((await api.updatePricing(next)).markup)}
              bookings={bookings}
              onAddBooking={(draft) => handleAddBooking(draft, true)}
              onLogout={signOut}
              onUpdateBookingStatus={handleUpdateBookingStatus}
              onUpdateBookingCheckin={handleUpdateBookingCheckin}
              onDeleteBooking={handleDeleteBooking}
              onBookingCreated={(bk) =>
                setBookingView((prev) => ({
                  key: bookingKey,
                  records: [bk, ...(prev?.records ?? []).filter((b) => b.id !== bk.id)],
                }))
              }
              onCatalogUpdated={refreshPublicCatalog}
              onBackHome={() => {
                refreshPublicCatalog();
                setPage('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {page === 'legal' && (
            <LegalPages
              lang={lang}
              activeDoc={legalDoc}
              onSelectDoc={(doc) => setPage('legal', doc)}
              onBackHome={() => {
                setPage('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {page === 'panel' && user && (
            <MemberPanel
              lang={lang}
              user={user}
              bookings={bookings}
              onCancelBooking={handleCancelBooking}
              onLogout={signOut}
              onGoSearch={() => {
                setPage('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </Suspense>
      </main>

      {!isStandaloneAdmin && (
        <Footer
          lang={lang}
          canManage={canManage}
          onNavigate={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onJumpToTab={handleJumpToTab}
          onOpenLegal={(doc) => {
            setPage('legal', doc);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      <AuthModals
        key={authMode ?? 'closed'}
        lang={lang}
        mode={authMode}
        onClose={() => setAuthMode(null)}
        onSwitchMode={setAuthMode}
        onAuthSuccess={(u) => {
          setBookingView(null);
          setUser(u);
          const hasPanelAccess = u.role === 'admin' || Boolean(u.permissions && u.permissions.length > 0);
          setPage(page === 'admin' || hasPanelAccess ? 'admin' : 'panel');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
};

export default App;
