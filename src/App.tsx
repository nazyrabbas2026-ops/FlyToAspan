import React, { useEffect, useState } from 'react';
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
import { MemberPanel } from './components/MemberPanel';
import { AdminPanelPage } from './components/AdminPanelPage';
import { LegalPages } from './components/LegalPages';
import { FlightDeal, getSavedMarkup, refreshLiveExchangeRates } from './data/mockData';
import { addCalendarDays, toCalendarDate } from './data/calendarDates';
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

const INITIAL_BOOKINGS: BookingRecord[] = [
  {
    id: 'bk-seed-1',
    pnr: 'FTA8K4',
    eticketNumber: '235-8492014811',
    type: 'Uçak',
    title: 'İstanbul (IST) → Almatı (ALA)',
    subtitle: 'Air Astana · KC912 · Prime Fly',
    date: '2026-12-14',
    passenger: 'Mert Yılmaz',
    price: 8180,
    status: 'Onaylandı',
  },
  {
    id: 'bk-seed-2',
    pnr: 'FTAH29',
    eticketNumber: 'HTL-902184',
    type: 'Otel',
    title: 'Tien Shan Grand Palace (Almatı)',
    subtitle: '2 Gece · Kahvaltı Dahil · Deluxe Oda',
    date: '2026-12-14',
    passenger: 'Mert Yılmaz',
    price: 3420,
    status: 'Onaylandı',
  },
  {
    id: 'bk-seed-3',
    pnr: 'FTAT51',
    eticketNumber: 'VIP-304912',
    type: 'Transfer',
    title: 'ALA Havalimanı → Şehir Merkezi VIP',
    subtitle: 'Mercedes-Benz Luxury VIP · Uçuş Takipli',
    date: '2026-11-18',
    passenger: 'Aylin Karahan',
    price: 1890,
    status: 'Tamamlandı',
  },
  {
    id: 'bk-seed-4',
    pnr: 'FTA4M9',
    eticketNumber: '235-8492019920',
    type: 'Uçak',
    title: 'İstanbul (IST) → Londra (LHR)',
    subtitle: 'Turkish Airlines · TK1985 · Extra Fly',
    date: '2026-12-21',
    passenger: 'Emre Demir',
    price: 6120,
    status: 'İptal Talebi',
  },
  {
    id: 'bk-seed-5',
    pnr: 'FTA2R7',
    eticketNumber: '235-8492011104',
    type: 'Uçak',
    title: 'İstanbul (SAW) → Antalya (AYT)',
    subtitle: 'Pegasus Airlines · PC2014 · Eco Fly',
    date: '2026-11-15',
    passenger: 'Kerem Aydın',
    price: 1640,
    status: 'İade Edildi',
  },
];

export const App: React.FC = () => {
  const [page, setPage] = useState<PageView>('home');
  const [lang, setLang] = useState<LangCode>('TR');
  const [currency, setCurrency] = useState<CurrencyCode>('TRY');
  const [, setFxVersion] = useState(0);
  const [legalDoc, setLegalDoc] = useState<LegalDocKey>('terms');
  const [markup, setMarkup] = useState<AdminMarkupConfig>(() => getSavedMarkup());
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [activeTab, setActiveTab] = useState<SearchTab>('flight');
  const [initialDate] = useState(() => toCalendarDate(new Date()));
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashFloat, setSplashFloat] = useState(0);
  const [splashStage, setSplashStage] = useState<'playing' | 'exiting' | 'done'>('playing');

  useEffect(() => {
    refreshLiveExchangeRates().then(() => setFxVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    // 3-second 0-100% eased preloader: logo reveals sequentially from head (left) to full logo (right)
    const DURATION_MS = 2500;
    const HOLD_MS = 220;
    const EXIT_MS = 620;
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

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const raw = localStorage.getItem('flytoaspan_user');
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  });

  const [bookings, setBookings] = useState<BookingRecord[]>(() => {
    try {
      const raw = localStorage.getItem('flytoaspan_bookings');
      return raw ? (JSON.parse(raw) as BookingRecord[]) : INITIAL_BOOKINGS;
    } catch {
      return INITIAL_BOOKINGS;
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang === 'KK' ? 'kk' : lang.toLowerCase();
  }, [lang]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem('flytoaspan_user', JSON.stringify(user));
      else localStorage.removeItem('flytoaspan_user');
    } catch {
      /* ignore storage quota errors */
    }
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem('flytoaspan_bookings', JSON.stringify(bookings));
    } catch {
      /* ignore */
    }
  }, [bookings]);

  useEffect(() => {
    try {
      localStorage.setItem('flytoaspan_markup', JSON.stringify(markup));
    } catch {
      /* ignore */
    }
  }, [markup]);

  const [flightQuery, setFlightQuery] = useState<FlightSearchQuery>({
    tripType: 'oneway',
    fromCode: 'IST',
    toCode: 'AYT',
    departDate: addCalendarDays(initialDate, 15),
    returnDate: addCalendarDays(initialDate, 22),
    adults: 1,
    children: 0,
    infants: 0,
    cabin: 'Ekonomi',
  });

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

  const handleSelectDeal = (deal: FlightDeal) => {
    setFlightQuery((prev) => ({
      ...prev,
      fromCode: deal.fromCode,
      toCode: deal.toCode,
      departDate: deal.isoDate,
      tripType: 'oneway',
    }));
    setPage('flight-results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleAddBooking = (record: BookingRecord) => {
    setBookings((prev) => [record, ...prev]);
    if (user) {
      setUser({ ...user, miles: user.miles + Math.round(record.price * 0.15) });
    }
  };

  const handleCancelBooking = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'İptal Talebi' } : b))
    );
  };

  const handleUpdateBookingStatus = (id: string, status: BookingRecord['status']) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  };

  const handleDeleteBooking = (id: string) => {
    setBookings((prev) => prev.filter((b) => b.id !== id));
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

      <Navbar
        currentPage={page}
        onNavigate={setPage}
        onOpenAuth={setAuthMode}
        lang={lang}
        onSelectLang={setLang}
        currency={currency}
        onSelectCurrency={setCurrency}
        user={user}
        onLogout={() => {
          setUser(null);
          setPage('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <main>
        {page === 'home' && (
          <>
            <HeroSearch
              lang={lang}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              flightQuery={flightQuery}
              onFlightQueryChange={setFlightQuery}
              onSearchFlight={(q) => {
                setFlightQuery(q);
                setPage('flight-results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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
            />
            <HomeSections
              lang={lang}
              currency={currency}
              markup={markup}
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
            query={flightQuery}
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
            query={transferQuery}
            onAddBooking={handleAddBooking}
            onBackHome={() => {
              setActiveTab('transfer');
              setPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {page === 'campaigns' && <CampaignsPage lang={lang} onUseCampaign={handleJumpToTab} />}
        {page === 'checkin' && <OnlineCheckInPage lang={lang} />}
        {page === 'help' && <HelpPage lang={lang} />}
        {page === 'booking-ops' && <BookingOpsPage lang={lang} bookings={bookings} />}

        {page === 'admin' && (
          <AdminPanelPage
            lang={lang}
            currency={currency}
            markup={markup}
            onUpdateMarkup={setMarkup}
            bookings={bookings}
            onAddBooking={handleAddBooking}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onDeleteBooking={handleDeleteBooking}
            onBackHome={() => {
              setPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {page === 'legal' && (
          <LegalPages
            lang={lang}
            activeDoc={legalDoc}
            onSelectDoc={setLegalDoc}
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
            onUpdateUser={setUser}
            onLogout={() => {
              setUser(null);
              setPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onGoSearch={() => {
              setPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      <Footer
        lang={lang}
        onNavigate={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onJumpToTab={handleJumpToTab}
        onOpenLegal={(doc) => {
          setLegalDoc(doc);
          setPage('legal');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <AuthModals
        lang={lang}
        mode={authMode}
        onClose={() => setAuthMode(null)}
        onSwitchMode={setAuthMode}
        onAuthSuccess={(u) => {
          setUser(u);
          setPage('panel');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
};

export default App;
