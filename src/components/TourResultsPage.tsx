import React, { useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Compass, Download, MapPin, Users } from 'lucide-react';
import { formatPrice } from '../data/mockData';
import { addCalendarDays, toCalendarDate } from '../data/calendarDates';
import { apiMessage, type AdminCatalog, type BookingDraft } from '../data/api';
import { openBrandedEticketPdf } from '../utils/eticketPdf';
import { resolveCityImage } from '../utils/cityImages';
import { localizeXmlText } from '../utils/localizeXmlText';
import type { BookingRecord, CurrencyCode, LangCode } from '../types';

const TOUR_PAGE_I18N: Record<
  LangCode,
  {
    backHome: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    confirmedBadge: string;
    passengerLbl: string;
    amountLbl: string;
    downloadPdf: string;
    bookingFormTitle: string;
    cancel: string;
    firstNamePh: string;
    lastNamePh: string;
    paxLabel: (n: number) => string;
    saving: string;
    submitBtn: string;
    quotaLeft: string;
    perPersonFrom: string;
    selectBtn: string;
    defaultIncludes: string;
  }
> = {
  TR: {
    backHome: 'Ana Sayfaya Dön',
    eyebrow: 'FLYTOASPAN · KÜLTÜR & TATİL TURLARI',
    title: 'Seçkin Tur Paketleri',
    subtitle: 'Türkiye, Kazakistan, Mısır, Dubai ve Avrupa rotalarında her gün XML ile güncellenen uçak + otel dahil hazır paket turlar.',
    confirmedBadge: 'Tur Rezervasyonu Onaylandı',
    passengerLbl: 'Yolcu',
    amountLbl: 'Tutar',
    downloadPdf: 'PDF Tur Voucher İndir',
    bookingFormTitle: 'Tur Rezervasyonu',
    cancel: 'Vazgeç',
    firstNamePh: 'Adınız *',
    lastNamePh: 'Soyadınız *',
    paxLabel: (n) => `${n} Kişi`,
    saving: 'Kaydediliyor...',
    submitBtn: 'Tur Rezervasyonunu Tamamla',
    quotaLeft: 'Kalan Kontenjan',
    perPersonFrom: 'Kişi Başı Başlayan',
    selectBtn: 'Turu Seç',
    defaultIncludes: 'Uçak + Otel + Rehberlik Dahil',
  },
  EN: {
    backHome: 'Back to Homepage',
    eyebrow: 'FLYTOASPAN · PACKAGE TOURS · DAILY XML',
    title: 'Curated Package Tours',
    subtitle: 'Flight + handpicked hotel holiday packages across Turkey, Kazakhstan, Egypt, Dubai, and Europe — updated daily via XML.',
    confirmedBadge: 'Tour Booking Confirmed',
    passengerLbl: 'Guest',
    amountLbl: 'Total',
    downloadPdf: 'Download Tour Voucher (PDF)',
    bookingFormTitle: 'Tour Reservation',
    cancel: 'Cancel',
    firstNamePh: 'First Name *',
    lastNamePh: 'Last Name *',
    paxLabel: (n) => `${n} ${n === 1 ? 'Guest' : 'Guests'}`,
    saving: 'Saving...',
    submitBtn: 'Complete Tour Booking',
    quotaLeft: 'Seats Left',
    perPersonFrom: 'Per Person From',
    selectBtn: 'Select Tour',
    defaultIncludes: 'Flight + Hotel + Guide Included',
  },
  RU: {
    backHome: 'На главную',
    eyebrow: 'FLYTOASPAN · ПАКЕТНЫЕ ТУРЫ · XML',
    title: 'Выгодные пакетные туры',
    subtitle: 'Готовые туры (перелёт + отель) по Турции, Казахстану, Египту, ОАЭ и Европе с ежедневным обновлением из XML.',
    confirmedBadge: 'Бронирование тура подтверждено',
    passengerLbl: 'Турист',
    amountLbl: 'Сумма',
    downloadPdf: 'Скачать ваучер тура (PDF)',
    bookingFormTitle: 'Бронирование тура',
    cancel: 'Отмена',
    firstNamePh: 'Имя *',
    lastNamePh: 'Фамилия *',
    paxLabel: (n) => `${n} чел.`,
    saving: 'Сохранение...',
    submitBtn: 'Оформить бронирование тура',
    quotaLeft: 'Осталось мест',
    perPersonFrom: 'От за человека',
    selectBtn: 'Выбрать тур',
    defaultIncludes: 'Перелёт + Отель + Гид',
  },
  KK: {
    backHome: 'Басты бетке оралу',
    eyebrow: 'FLYTOASPAN · ПАКЕТТІК ТУРЛАР · XML',
    title: 'Таңдаулы пакеттік турлар',
    subtitle: 'Түркия, Қазақстан, Мысыр, Дубай және Еуропа бағыттарында XML арқылы күн сайын жаңаратын ұшақ + қонақүй турлары.',
    confirmedBadge: 'Тур брондауы расталды',
    passengerLbl: 'Жолаушы',
    amountLbl: 'Сома',
    downloadPdf: 'PDF тур ваучерін жүктеу',
    bookingFormTitle: 'Тур брондау',
    cancel: 'Бас тарту',
    firstNamePh: 'Атыңыз *',
    lastNamePh: 'Тегіңіз *',
    paxLabel: (n) => `${n} адам`,
    saving: 'Сақталуда...',
    submitBtn: 'Тур брондауын аяқтау',
    quotaLeft: 'Қалған орын',
    perPersonFrom: 'Бір адамға бастап',
    selectBtn: 'Турды таңдау',
    defaultIncludes: 'Ұшақ + Қонақүй + Гид',
  },
};

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
    id: 'xml-tour-tr-1',
    city: 'TÜRKİYE · ANTALYA',
    title: 'Antalya Ultra Her Şey Dahil Deniz & Aile Paketi',
    duration: '5 Gece · 6 Gün',
    includes: 'Gidiş-Dönüş Uçak · 5★ Resort · Her Şey Dahil',
    quota: 16,
    priceTRY: 16900,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'xml-tour-eg-1',
    city: 'MISIR · ŞARM EL-ŞEYH',
    title: 'Şarm El-Şeyh Kızıldeniz & Mercan Koyu Tatil Paketi',
    duration: '6 Gece · 7 Gün',
    includes: 'Charter Uçak · 5★ Resort · Her Şey Dahil',
    quota: 18,
    priceTRY: 19200,
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'xml-tour-kz-1',
    city: 'KAZAKİSTAN · ALMATI',
    title: 'Almatı, Big Almaty Gölü & Shymbulak Kültür Turu',
    duration: '4 Gece · 5 Gün',
    includes: 'Gidiş-Dönüş Uçak · 5★ Otel · Rehberli Şehir & Doğa Turu',
    quota: 14,
    priceTRY: 21400,
    image: '/images/almaty.jpg',
  },
  {
    id: 'xml-tour-ae-1',
    city: 'BAE · DUBAİ',
    title: 'Dubai Şehir Keşfi, Çöl Safarisi & Marina Paketi',
    duration: '4 Gece · 5 Gün',
    includes: 'Gidiş-Dönüş Uçak · 5★ Şehir Oteli · Kahvaltı',
    quota: 12,
    priceTRY: 22900,
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=85',
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
  const ui = TOUR_PAGE_I18N[lang];
  const displayedTours: TourPackage[] = liveTours !== undefined
    ? liveTours
        .filter((t) => t.active)
        .map((t) => ({
          id: t.id,
          city: localizeXmlText(t.city, lang),
          title: localizeXmlText(t.title, lang),
          duration: localizeXmlText(t.duration, lang),
          includes: localizeXmlText(t.includes || ui.defaultIncludes, lang),
          quota: t.quota,
          priceTRY: t.price,
          image: resolveCityImage(t.city, t.image),
        }))
    : DEFAULT_TOUR_PACKAGES.map((t) => ({
        ...t,
        city: localizeXmlText(t.city, lang),
        title: localizeXmlText(t.title, lang),
        duration: localizeXmlText(t.duration, lang),
        includes: localizeXmlText(t.includes, lang),
      }));
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
        netCostTRY: Math.round(selectedTour.priceTRY * paxCount * 0.9),
        profitTRY: Math.round(selectedTour.priceTRY * paxCount * 0.1),
        providerSource: 'Yerel Tur Envanteri (Deneme)',
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
            {ui.backHome}
          </button>
          <div className="section-eyebrow on-dark">{ui.eyebrow}</div>
          <h1 className="inner-h1">{ui.title}</h1>
          <p style={{ color: 'rgba(255,255,255,0.78)', maxWidth: 640, marginTop: 6 }}>
            {ui.subtitle}
          </p>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container">
          {confirmed && (
            <div className="panel-card" style={{ border: '1.5px solid #10B981', background: 'rgba(16,185,129,0.06)', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span className="status-badge ok"><CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {ui.confirmedBadge}</span>
                  <h2 style={{ margin: '8px 0 4px', fontSize: 19 }}>{confirmed.title}</h2>
                  <div style={{ fontSize: 13.5, color: 'var(--aspan-text-muted)' }}>
                    PNR: <strong style={{ color: 'var(--aspan-text)', letterSpacing: 1.5 }}>{confirmed.pnr}</strong> · {ui.passengerLbl}: {confirmed.passenger} · {ui.amountLbl}: <strong>{formatPrice(confirmed.price, currency)}</strong>
                  </div>
                </div>
                <button type="button" className="btn-gold-nav" onClick={() => openBrandedEticketPdf(confirmed, { currency, lang })}>
                  <Download size={15} /> {ui.downloadPdf}
                </button>
              </div>
            </div>
          )}

          {selectedTour && (
            <form className="panel-card" onSubmit={handleBookTour} style={{ border: '1.5px solid #00A8B5', marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: 17 }}>{ui.bookingFormTitle}: {selectedTour.title}</strong>
                <button type="button" className="uf-quick-pill" onClick={() => setSelectedTour(null)}>{ui.cancel}</button>
              </div>
              {error && <p className="form-action-error" role="alert">{error}</p>}
              <div className="panel-form-grid">
                <input required className="modal-input" placeholder={ui.firstNamePh} value={guestFirst} onChange={(e) => setGuestFirst(e.target.value)} />
                <input required className="modal-input" placeholder={ui.lastNamePh} value={guestLast} onChange={(e) => setGuestLast(e.target.value)} />
                <input required type="date" className="modal-input" value={tourDate} onChange={(e) => setTourDate(e.target.value)} />
                <select className="modal-input" value={paxCount} onChange={(e) => setPaxCount(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{ui.paxLabel(n)} ({formatPrice(selectedTour.priceTRY * n, currency)})</option>
                  ))}
                </select>
                <button type="submit" className="btn-gold-nav" style={{ borderRadius: 12 }} disabled={busy}>
                  {busy ? ui.saving : ui.submitBtn}
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
                    {ui.quotaLeft}: {tour.quota}
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
                      <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>{ui.perPersonFrom}</div>
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
                      <Compass size={14} /> {ui.selectBtn}
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
