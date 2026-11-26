import React, { useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Compass, Download, MapPin, Users } from 'lucide-react';
import { formatPrice } from '../data/mockData';
import { addCalendarDays, toCalendarDate } from '../data/calendarDates';
import { apiMessage, type AdminCatalog, type BookingDraft } from '../data/api';
import { openBrandedEticketPdf } from '../utils/eticketPdf';
import { resolveCityImage } from '../utils/cityImages';
import type { BookingRecord, CurrencyCode, LangCode } from '../types';

export interface TourPackage {
  id: string;
  city: string;
  title: string;
  duration: string;
  includes: string;
  quota: number;
  priceTRY: number;
  image: string;
}

export const DEFAULT_TOUR_PACKAGES: TourPackage[] = [
  {
    id: 'tour-ala-1',
    city: 'ALMATI & KAZAKİSTAN',
    title: 'Almatı, Big Almaty Gölü & Shymbulak Kültür Turu',
    duration: '4 Gece · 5 Gün',
    includes: 'Uçak Dahil · 5★ Otel · Türkçe Rehber · VIP Transfer',
    quota: 14,
    priceTRY: 24900,
    image: '/images/almaty.jpg',
  },
  {
    id: 'tour-cap-2',
    city: 'KAPADOKYA',
    title: 'Kapadokya Mağara Otel & Gün Doğumu Balon Turu',
    duration: '2 Gece · 3 Gün',
    includes: 'Butik Taş Otel · Kahvaltı · Bölge Gezileri · Transfer',
    quota: 10,
    priceTRY: 9850,
    image: 'https://images.unsplash.com/photo-1641128324972-af3212f0f6bd?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'tour-ayt-3',
    city: 'ANTALYA · BELEK',
    title: 'Antalya Ultra Her Şey Dahil Aile & Deniz Paketi',
    duration: '5 Gece · 6 Gün',
    includes: '5★ Resort · Uçak + Havalimanı VIP Transfer Dahil',
    quota: 18,
    priceTRY: 18400,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'tour-bal-4',
    city: 'BALKANLAR',
    title: 'Vizesiz Balkanlar: Saraybosna, Mostar & Belgrad',
    duration: '6 Gece · 7 Gün',
    includes: 'Gidiş-Dönüş Uçak · 4★ Oteller · Panoramik Şehir Turları',
    quota: 12,
    priceTRY: 21500,
    image: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=900&q=85',
  },
];

interface TourResultsPageProps {
  lang: LangCode;
  currency: CurrencyCode;
  liveTours?: AdminCatalog['tours'];
  onAddBooking: (draft: BookingDraft) => Promise<BookingRecord>;
  onBackHome: () => void;
}

export const TourResultsPage: React.FC<TourResultsPageProps> = ({
  lang,
  currency,
  liveTours,
  onAddBooking,
  onBackHome,
}) => {
  const displayedTours: TourPackage[] = liveTours !== undefined
    ? liveTours
        .filter((t) => t.active)
        .map((t) => ({
          id: t.id,
          city: t.city,
          title: t.title,
          duration: t.duration,
          includes: t.includes || 'Uçak + Otel + Rehberlik + VIP Transfer',
          quota: t.quota,
          priceTRY: t.price,
          image: resolveCityImage(t.city, t.image),
        }))
    : DEFAULT_TOUR_PACKAGES;
  const [selectedTour, setSelectedTour] = useState<TourPackage | null>(null);
  const [guestFirst, setGuestFirst] = useState('');
  const [guestLast, setGuestLast] = useState('');
  const [paxCount, setPaxCount] = useState(2);
  const [tourDate, setTourDate] = useState(() => addCalendarDays(toCalendarDate(new Date()), 20));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<BookingRecord | null>(null);

  const handleBookTour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTour || busy) return;
    setBusy(true);
    setError('');
    try {
      const booking = await onAddBooking({
        type: 'Tur',
        title: selectedTour.title,
        subtitle: `${selectedTour.city} · ${selectedTour.duration} · ${paxCount} Kişi`,
        date: tourDate,
        passenger: `${guestFirst.trim()} ${guestLast.trim()}`,
        lookupSurname: guestLast.trim(),
        price: selectedTour.priceTRY * paxCount,
        idempotencyKey: crypto.randomUUID(),
      });
      setConfirmed(booking);
      setSelectedTour(null);
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <button type="button" className="inner-back-btn" onClick={onBackHome}>
            <ArrowLeft size={15} />
            Ana Sayfaya Dön
          </button>
          <div className="section-eyebrow on-dark">FLYTOASPAN · KÜLTÜR &amp; TATİL TURLARI</div>
          <h1 className="inner-h1">Seçkin Tur Paketleri</h1>
          <p style={{ color: 'rgba(255,255,255,0.78)', maxWidth: 640, marginTop: 6 }}>
            Türkiye, Kazakistan ve vizesiz Balkan rotalarında uçak, otel, rehber ve VIP transfer dahil hazır tur paketleri.
          </p>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container">
          {confirmed && (
            <div className="panel-card" style={{ border: '1.5px solid #10B981', background: 'rgba(16,185,129,0.06)', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span className="status-badge ok"><CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Tur Rezervasyonu Onaylandı</span>
                  <h2 style={{ margin: '8px 0 4px', fontSize: 19 }}>{confirmed.title}</h2>
                  <div style={{ fontSize: 13.5, color: 'var(--aspan-text-muted)' }}>
                    PNR: <strong style={{ color: 'var(--aspan-text)', letterSpacing: 1.5 }}>{confirmed.pnr}</strong> · Yolcu: {confirmed.passenger} · Tutar: <strong>{formatPrice(confirmed.price, currency)}</strong>
                  </div>
                </div>
                <button type="button" className="btn-gold-nav" onClick={() => openBrandedEticketPdf(confirmed, { currency, lang })}>
                  <Download size={15} /> PDF Tur Voucher İndir
                </button>
              </div>
            </div>
          )}

          {selectedTour && (
            <form className="panel-card" onSubmit={handleBookTour} style={{ border: '1.5px solid #00A8B5', marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: 17 }}>Tur Rezervasyonu: {selectedTour.title}</strong>
                <button type="button" className="uf-quick-pill" onClick={() => setSelectedTour(null)}>Vazgeç</button>
              </div>
              {error && <p className="form-action-error" role="alert">{error}</p>}
              <div className="panel-form-grid">
                <input required className="modal-input" placeholder="Adınız *" value={guestFirst} onChange={(e) => setGuestFirst(e.target.value)} />
                <input required className="modal-input" placeholder="Soyadınız *" value={guestLast} onChange={(e) => setGuestLast(e.target.value)} />
                <input required type="date" className="modal-input" value={tourDate} onChange={(e) => setTourDate(e.target.value)} />
                <select className="modal-input" value={paxCount} onChange={(e) => setPaxCount(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n} Kişi ({formatPrice(selectedTour.priceTRY * n, currency)})</option>
                  ))}
                </select>
                <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }} disabled={busy}>
                  {busy ? 'Kaydediliyor...' : 'Tur Rezervasyonunu Tamamla'}
                </button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            {displayedTours.map((tour) => (
              <article key={tour.id} className="panel-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', height: 185, overflow: 'hidden' }}>
                  <img src={tour.image} alt={tour.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', top: 12, left: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(11,30,51,0.85)', color: '#F2C85C', fontSize: 11, fontWeight: 800 }}>
                    <MapPin size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />{tour.city}
                  </span>
                  <span style={{ position: 'absolute', bottom: 12, right: 12, padding: '4px 10px', borderRadius: 999, background: '#10B981', color: '#fff', fontSize: 11, fontWeight: 800 }}>
                    Kalan Kontenjan: {tour.quota}
                  </span>
                </div>
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--aspan-teal-deep)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={13} /> {tour.duration}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--aspan-text)' }}>{tour.title}</h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--aspan-text-muted)', lineHeight: 1.5 }}>{tour.includes}</p>
                  <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--aspan-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>Kişi Başı Başlayan</div>
                      <strong style={{ fontSize: 20, color: 'var(--aspan-text)' }}>{formatPrice(tour.priceTRY, currency)}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn-gold-nav"
                      onClick={() => {
                        setSelectedTour(tour);
                        window.scrollTo({ top: 180, behavior: 'smooth' });
                      }}
                    >
                      <Compass size={14} /> Turu Seç
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
