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
  const [lang, setLang] = useState<LangCode>('TR');
  const [currency, setCurrency] = useState<CurrencyCode>('TRY');
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
    // 1.5-second 0-100% eased preloader: plays once per browser session, skippable on click/tap
    const DURATION_MS = 1450;
    const HOLD_MS = 140;
    const EXIT_MS = 480;
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

  const handleDeleteBooking = async (id: string) => {
    await api.deleteBooking(id);
    changeRecords((records) => records.filter((record) => record.id !== id));
  };

  return (
    <div className="app-shell">
      {splashStage !== 'done' && (() => {
        // Sequential left-to-right reveal of the full FlyToAspan logo:
        // 0% -> 35%: Eagle crest at the head of the logo appears first
        // 35% -> 75%: "FlyTo" reveals in sequence
        // 75% -> 100%: "Aspan by infinitive travel" completes the full logo
        const logoClipRight = Math.max(0, 100 - splashFloat * 100);

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
            {/* Centered Sequential Logo Reveal (No background glow/lines, pure start-to-finish logo reveal) */}
            <div
              className={`kv-splash-brand-stack ${splashStage === 'exiting' ? 'is-exiting' : ''}`}
              aria-hidden="true"
            >
              <div className="kv-splash-logo-stage">
                <div
                  className="kv-splash-logo-reveal"
                  style={{
                    clipPath: `inset(0 ${logoClipRight.toFixed(2)}% 0 0)`,
                  }}
                >
                  <img
                    src="/images/logo-dark.png"
                    alt="FlyToAspan by Infinitive Travel"
                    className="kv-splash-logo-live"
                  />
                </div>
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
              <h1 className="inner-h1">Hesabım</h1>
              {sessionLoading ? <p role="status">Oturum kontrol ediliyor…</p> : (
                <>
                  <p>Rezervasyonlarınızı görmek için giriş yapın.</p>
                  <button type="button" className="btn-gold-nav" onClick={() => setAuthMode('login')}>Giriş Yap</button>
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
        {page === 'booking-ops' && <BookingOpsPage lang={lang} />}

        <Suspense fallback={<div style={{ padding: '140px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--aspan-text-muted)' }}>FlyToAspan…</div>}>
          {page === 'tour-results' && (
            <TourResultsPage
              lang={lang}
              currency={currency}
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
              currency={currency}
              currentUser={user}
              markup={markup}
              onUpdateMarkup={async (next) => setMarkup((await api.updatePricing(next)).markup)}
              bookings={bookings}
              onAddBooking={(draft) => handleAddBooking(draft, true)}
              onLogout={signOut}
              onUpdateBookingStatus={handleUpdateBookingStatus}
              onDeleteBooking={handleDeleteBooking}
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
