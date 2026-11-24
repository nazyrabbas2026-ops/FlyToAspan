import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Users,
  MapPin,
  Star,
  CarTaxiFront,
  X,
  Tag,
  Building2,
} from 'lucide-react';
import {
  DEFAULT_MARKUP,
  HOTEL_DEALS,
  HotelDeal,
  TRANSFER_DEALS,
  TransferDeal,
  formatDisplayDate,
  formatPrice,
} from '../data/mockData';
import { apiMessage, type BookingDraft } from '../data/api';
import {
  AdminMarkupConfig,
  BookingRecord,
  CurrencyCode,
  HotelSearchQuery,
  LangCode,
  TransferSearchQuery,
} from '../types';

const HT_I18N: Record<
  LangCode,
  {
    changeSearch: string;
    allCities: string;
    hotelsSuffix: string;
    adults: string;
    children: string;
    freeCancel: string;
    nights: string;
    totalPrice: string;
    selectRoom: string;
    okBtn: string;
    vipTitle: string;
    paxUnit: string;
    fixedVehiclePrice: string;
    bookTransfer: string;
  }
> = {
  TR: {
    changeSearch: 'Aramayı değiştir',
    allCities: 'Tüm Şehirler',
    hotelsSuffix: 'Otelleri',
    adults: 'Yetişkin',
    children: 'Çocuk',
    freeCancel: 'Ücretsiz İptal',
    nights: 'Gece',
    totalPrice: 'TOPLAM FİYAT',
    selectRoom: 'Odayı Seç',
    okBtn: 'Tamam',
    vipTitle: 'VIP Havalimanı Transfer Seçenekleri',
    paxUnit: 'Yolcu',
    fixedVehiclePrice: 'SABİT ARAÇ FİYATI',
    bookTransfer: 'Transferi Ayırt',
  },
  EN: {
    changeSearch: 'Change search',
    allCities: 'All Cities',
    hotelsSuffix: 'Hotels',
    adults: 'Adults',
    children: 'Children',
    freeCancel: 'Free Cancellation',
    nights: 'Nights',
    totalPrice: 'TOTAL PRICE',
    selectRoom: 'Select Room',
    okBtn: 'Done',
    vipTitle: 'VIP Airport Transfer Options',
    paxUnit: 'Passengers',
    fixedVehiclePrice: 'FIXED VEHICLE FARE',
    bookTransfer: 'Book Transfer',
  },
  RU: {
    changeSearch: 'Изменить поиск',
    allCities: 'Все города',
    hotelsSuffix: '— Отели',
    adults: 'Взрослых',
    children: 'Детей',
    freeCancel: 'Бесплатная отмена',
    nights: 'ночи',
    totalPrice: 'ИТОГОВАЯ ЦЕНА',
    selectRoom: 'Выбрать номер',
    okBtn: 'Готово',
    vipTitle: 'VIP Трансфер из Аэропорта',
    paxUnit: 'пасс.',
    fixedVehiclePrice: 'ФИКСИРОВАННАЯ ЦЕНА ЗА АВТО',
    bookTransfer: 'Забронировать',
  },
  KK: {
    changeSearch: 'Іздеуді өзгерту',
    allCities: 'Барлық қалалар',
    hotelsSuffix: 'қонақ үйлері',
    adults: 'Ересек',
    children: 'Бала',
    freeCancel: 'Тегін бас тарту',
    nights: 'түн',
    totalPrice: 'ЖАЛПЫ БАҒА',
    selectRoom: 'Бөлмені таңдау',
    okBtn: 'Дайын',
    vipTitle: 'VIP Әуежай Трансфері Опциялары',
    paxUnit: 'жолаушы',
    fixedVehiclePrice: 'ТҰРАҚТЫ КӨЛІК БАҒАСЫ',
    bookTransfer: 'Трансферді брондау',
  },
};

const HT_MODAL_I18N: Record<
  LangCode,
  {
    savedTitle: string;
    closeLbl: string;
    pnrLbl: string;
    lookupHint: string;
    nameErr: string;
    demoNote: string;
    firstName: string;
    surname: string;
    hotelCouponLbl: string;
    applied: string;
    applyCode: (code: string) => string;
    saving: string;
    saveBtn: string;
  }
> = {
  TR: {
    savedTitle: 'Deneme rezervasyonu kaydedildi',
    closeLbl: 'Kapat',
    pnrLbl: 'Rezervasyon kodu (PNR)',
    lookupHint: 'Bilet İşlemleri sayfasında bu kodu ve girdiğiniz soyadını kullanın.',
    nameErr: 'Adınızı ve soyadınızı girin.',
    demoNote: 'Deneme fiyatıdır. Ödeme alınmaz ve sağlayıcıya rezervasyon gönderilmez.',
    firstName: 'Ad',
    surname: 'Soyadı',
    hotelCouponLbl: 'Otel Kuponu:',
    applied: '✓ Uygulandı',
    applyCode: (c) => `${c} Uygula`,
    saving: 'Kaydediliyor…',
    saveBtn: 'Deneme rezervasyonunu kaydet',
  },
  EN: {
    savedTitle: 'Demo booking saved',
    closeLbl: 'Close',
    pnrLbl: 'Booking code (PNR)',
    lookupHint: 'Use this code and the surname you entered on the Manage Booking page.',
    nameErr: 'Please enter your first and last name.',
    demoNote: 'Sample price only. No payment is charged and no booking is sent to a supplier.',
    firstName: 'First name',
    surname: 'Last name',
    hotelCouponLbl: 'Hotel Promo:',
    applied: '✓ Applied',
    applyCode: (c) => `Apply ${c}`,
    saving: 'Saving…',
    saveBtn: 'Save demo booking',
  },
  RU: {
    savedTitle: 'Пробное бронирование сохранено',
    closeLbl: 'Закрыть',
    pnrLbl: 'Код бронирования (PNR)',
    lookupHint: 'Используйте этот код и фамилию на странице «Мои билеты».',
    nameErr: 'Введите имя и фамилию.',
    demoNote: 'Примерная цена. Оплата не списывается, бронь поставщику не отправляется.',
    firstName: 'Имя',
    surname: 'Фамилия',
    hotelCouponLbl: 'Промокод отеля:',
    applied: '✓ Применено',
    applyCode: (c) => `Применить ${c}`,
    saving: 'Сохранение…',
    saveBtn: 'Сохранить пробную бронь',
  },
  KK: {
    savedTitle: 'Сынақ брондауы сақталды',
    closeLbl: 'Жабу',
    pnrLbl: 'Брондау коды (PNR)',
    lookupHint: '«Билеттер» бетінде осы код пен енгізген тегіңізді пайдаланыңыз.',
    nameErr: 'Атыңыз бен тегіңізді енгізіңіз.',
    demoNote: 'Үлгі баға. Төлем алынбайды және жеткізушіге брондау жіберілмейді.',
    firstName: 'Аты',
    surname: 'Тегі',
    hotelCouponLbl: 'Қонақүй купоны:',
    applied: '✓ Қолданылды',
    applyCode: (c) => `${c} қолдану`,
    saving: 'Сақталуда…',
    saveBtn: 'Сынақ брондауын сақтау',
  },
};

export const HotelResultsPage: React.FC<{
  lang?: LangCode;
  currency?: CurrencyCode;
  markup?: AdminMarkupConfig;
  query: HotelSearchQuery;
  onBackHome: () => void;
  onAddBooking: (draft: BookingDraft) => Promise<BookingRecord>;
}> = ({ lang = 'TR', currency = 'TRY', markup = DEFAULT_MARKUP, query, onBackHome, onAddBooking }) => {
  const [selectedHotel, setSelectedHotel] = useState<HotelDeal | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [confirmedPnr, setConfirmedPnr] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [bookingPending, setBookingPending] = useState(false);

  const ui = HT_I18N[lang];
  const mu = HT_MODAL_I18N[lang];
  const hotelMult = 1 + (markup.hotelPercent - DEFAULT_MARKUP.hotelPercent) / 100;

  const normalizeCity = (val: string) =>
    val.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const destToken = normalizeCity(query.destination.split(',')[0] || '');
  const matchedHotels = destToken
    ? HOTEL_DEALS.filter(
        (h) => normalizeCity(h.city).includes(destToken) || normalizeCity(h.name).includes(destToken)
      )
    : HOTEL_DEALS;
  const displayedHotels = matchedHotels.length > 0 ? matchedHotels : HOTEL_DEALS;
  const isFallbackHotels = Boolean(destToken) && matchedHotels.length === 0;
  const fallbackNote: Record<LangCode, string> = {
    TR: `"${query.destination}" için birebir otel bulunamadı; öne çıkan diğer seçkin otellerimiz listeleniyor.`,
    EN: `No exact hotel match found for "${query.destination}"; showing our other featured hotels.`,
    RU: `Точных совпадений для «${query.destination}» не найдено — показаны другие популярные отели.`,
    KK: `«${query.destination}» бойынша дәл сәйкестік табылмады; басқа таңдаулы қонақүйлер көрсетілуде.`,
  };

  const openHotelModal = (h: HotelDeal) => {
    setSelectedHotel(h);
    setConfirmedPnr(null);
    setBookingError('');
    setAppliedDiscount(0);
    setCouponCode('');
  };

  const baseHotelPrice = selectedHotel
    ? Math.max(990, Math.round(selectedHotel.price * hotelMult))
    : 0;
  const finalHotelPrice = Math.max(490, baseHotelPrice - appliedDiscount);

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <button type="button" className="inner-back-btn" onClick={onBackHome}>
            <ArrowLeft size={15} />
            {ui.changeSearch}
          </button>
          <h1 className="inner-h1">
            {query.destination || ui.allCities} {ui.hotelsSuffix}
          </h1>
          <div className="route-pills">
            <span className="route-pill">
              <Calendar size={14} color="#16CAD6" />
              {formatDisplayDate(query.checkIn, lang)} → {formatDisplayDate(query.checkOut, lang)}
            </span>
            <span className="route-pill">
              <Users size={14} color="#16CAD6" />
              {query.adults} {ui.adults}
              {query.children > 0 ? `, ${query.children} ${ui.children}` : ''}
            </span>
          </div>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container">
          {isFallbackHotels && (
            <div
              role="status"
              style={{
                marginBottom: 18,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'var(--aspan-teal-soft)',
                color: 'var(--aspan-teal-deep)',
                fontSize: 13.5,
                fontWeight: 700,
              }}
            >
              {fallbackNote[lang]}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 20 }}>
            {displayedHotels.map((h) => {
              const adjPrice = Math.max(990, Math.round(h.price * hotelMult));
              return (
                <div key={h.id} className="flight-card" style={{ marginBottom: 0 }}>
                  <img
                    src={h.image}
                    alt={h.name}
                    style={{ width: '100%', height: 210, objectFit: 'cover' }}
                  />
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span className="hotel-city-stars">
                        {h.city} <span className="stars-gold">{'★'.repeat(h.stars)}</span>
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 8,
                          background: 'var(--aspan-teal-soft)',
                          color: 'var(--aspan-teal-deep)',
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      >
                        <Star size={12} fill="currentColor" />
                        {h.rating}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>{h.name}</h3>
                    <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginBottom: 16 }}>
                      {h.boardType} · {ui.freeCancel} · {h.nights} {ui.nights}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--aspan-text-muted)' }}>
                          {ui.totalPrice}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>
                          {formatPrice(adjPrice, currency)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="u4-submit-btn"
                        style={{ height: 42, padding: '0 18px', fontSize: 13 }}
                        onClick={() => openHotelModal(h)}
                      >
                        {ui.selectRoom}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {selectedHotel && (
        <div className="modal-overlay" onClick={() => { if (!bookingPending) setSelectedHotel(null); }} role="dialog" aria-modal="true">
          <div
            className="modal-card"
            style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong style={{ fontSize: 18 }}>
                {confirmedPnr ? mu.savedTitle : selectedHotel.name}
              </strong>
              <button type="button" className="drawer-close" aria-label={mu.closeLbl} disabled={bookingPending} onClick={() => setSelectedHotel(null)}>
                <X size={16} />
              </button>
            </div>

            {confirmedPnr ? (
              <div className="flight-booking-summary" role="status">
                <p>{mu.pnrLbl} <strong>{confirmedPnr}</strong></p>
                <p>{mu.lookupHint}</p>
                <button type="button" className="uf-pop-done" onClick={() => setSelectedHotel(null)}>{ui.okBtn}</button>
              </div>
            ) : (
              <form onSubmit={async (event) => {
                event.preventDefault();
                if (bookingPending) return;
                const fields = new FormData(event.currentTarget);
                const firstName = String(fields.get('firstName')).trim();
                const lookupSurname = String(fields.get('surname')).trim();
                if (!firstName || !lookupSurname) {
                  setBookingError(mu.nameErr);
                  return;
                }
                setBookingPending(true);
                setBookingError('');
                try {
                  const { pnr } = await onAddBooking({
                  type: 'Otel',
                  title: selectedHotel.name,
                  subtitle: selectedHotel.city,
                  date: query.checkIn,
                  returnDate: query.checkOut,
                  price: finalHotelPrice,
                    passenger: firstName + ' ' + lookupSurname,
                    lookupSurname,
                  });
                  setConfirmedPnr(pnr);
                } catch (error) {
                  setBookingError(apiMessage(error));
                } finally {
                  setBookingPending(false);
                }
              }}>
                <div className="flight-booking-summary" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>
                        <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                        {selectedHotel.name} ({selectedHotel.city})
                      </strong>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        {formatDisplayDate(query.checkIn, lang)} → {formatDisplayDate(query.checkOut, lang)} ·{' '}
                        {selectedHotel.boardType}
                      </div>
                    </div>
                    <strong style={{ fontSize: 18, color: 'var(--aspan-teal-deep)' }}>
                      {formatPrice(finalHotelPrice, currency)}
                    </strong>
                  </div>
                </div>

                <p>{mu.demoNote}</p>
                <div className="uf-co-form-grid-2" style={{ marginBottom: 12 }}>
                  <label className="uf-co-label">{mu.firstName}
                    <input name="firstName" autoComplete="given-name" className="modal-input" required maxLength={64} />
                  </label>
                  <label className="uf-co-label">{mu.surname}
                    <input name="surname" autoComplete="family-name" className="modal-input" required maxLength={64} />
                  </label>
                </div>

                <div
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: '1px dashed var(--aspan-teal)',
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    <Tag size={13} color="#00A8B5" style={{ verticalAlign: 'middle', marginRight: 5 }} />
                    {mu.hotelCouponLbl} <strong>OTEL30</strong> (−{formatPrice(300, currency)})
                  </span>
                  <button
                    type="button"
                    className="uf-quick-pill"
                    onClick={() => {
                      setCouponCode('OTEL30');
                      setAppliedDiscount(300);
                    }}
                  >
                    {couponCode === 'OTEL30' ? mu.applied : mu.applyCode('OTEL30')}
                  </button>
                </div>

                {bookingError && <p className="form-action-error" role="alert">{bookingError}</p>}
                <button type="submit" className="uf-pop-done" disabled={bookingPending} style={{ height: 46, marginTop: 0 }}>
                  {bookingPending ? mu.saving : mu.saveBtn}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const TransferResultsPage: React.FC<{
  lang?: LangCode;
  currency?: CurrencyCode;
  markup?: AdminMarkupConfig;
  query: TransferSearchQuery;
  onBackHome: () => void;
  onAddBooking: (draft: BookingDraft) => Promise<BookingRecord>;
}> = ({ lang = 'TR', currency = 'TRY', markup = DEFAULT_MARKUP, query, onBackHome, onAddBooking }) => {
  const [selectedTr, setSelectedTr] = useState<TransferDeal | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [confirmedPnr, setConfirmedPnr] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [bookingPending, setBookingPending] = useState(false);

  const ui = HT_I18N[lang];
  const mu = HT_MODAL_I18N[lang];
  const transferDiff = markup.transferAddTRY - DEFAULT_MARKUP.transferAddTRY;

  const openTransferModal = (tr: TransferDeal) => {
    setSelectedTr(tr);
    setConfirmedPnr(null);
    setBookingError('');
    setAppliedDiscount(0);
  };

  const baseTrPrice = selectedTr ? Math.max(490, selectedTr.price + transferDiff) : 0;
  const finalTrPrice = Math.max(350, baseTrPrice - appliedDiscount);

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <button type="button" className="inner-back-btn" onClick={onBackHome}>
            <ArrowLeft size={15} />
            {ui.changeSearch}
          </button>
          <h1 className="inner-h1">{ui.vipTitle}</h1>
          <div className="route-pills">
            <span className="route-pill">
              <MapPin size={14} color="#16CAD6" />
              {query.from} → {query.to}
            </span>
            <span className="route-pill">
              <Calendar size={14} color="#16CAD6" />
              {formatDisplayDate(query.date, lang)} · {query.time}
            </span>
            <span className="route-pill">
              <Users size={14} color="#16CAD6" />
              {query.adults + query.children} {ui.paxUnit}
            </span>
          </div>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {TRANSFER_DEALS.map((tr) => {
              const adjPrice = Math.max(490, tr.price + transferDiff);
              return (
                <div key={tr.id} className="flight-card" style={{ marginBottom: 0 }}>
                  <img
                    src={tr.image}
                    alt={tr.vehicle}
                    style={{ width: '100%', height: 190, objectFit: 'cover' }}
                  />
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--aspan-teal-deep)', fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                      <CarTaxiFront size={15} />
                      {tr.city} VIP TRANSFER
                    </div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>{tr.vehicle}</h3>
                    <div style={{ fontSize: 12.5, color: 'var(--aspan-text-body)', marginBottom: 6 }}>
                      {tr.route}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)', marginBottom: 16 }}>
                      {tr.capacity} · {tr.baggage} · {tr.category}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--aspan-text-muted)' }}>
                          {ui.fixedVehiclePrice}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>
                          {formatPrice(adjPrice, currency)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="u4-submit-btn"
                        style={{ height: 42, padding: '0 18px', fontSize: 13 }}
                        onClick={() => openTransferModal(tr)}
                      >
                        {ui.bookTransfer}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {selectedTr && (
        <div className="modal-overlay" onClick={() => { if (!bookingPending) setSelectedTr(null); }} role="dialog" aria-modal="true">
          <div
            className="modal-card"
            style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong style={{ fontSize: 18 }}>
                {confirmedPnr ? mu.savedTitle : selectedTr.vehicle}
              </strong>
              <button type="button" className="drawer-close" aria-label={mu.closeLbl} disabled={bookingPending} onClick={() => setSelectedTr(null)}>
                <X size={16} />
              </button>
            </div>

            {confirmedPnr ? (
              <div className="flight-booking-summary" role="status">
                <p>{mu.pnrLbl} <strong>{confirmedPnr}</strong></p>
                <p>{mu.lookupHint}</p>
                <button type="button" className="uf-pop-done" onClick={() => setSelectedTr(null)}>{ui.okBtn}</button>
              </div>
            ) : (
              <form onSubmit={async (event) => {
                event.preventDefault();
                if (bookingPending) return;
                const fields = new FormData(event.currentTarget);
                const firstName = String(fields.get('firstName')).trim();
                const lookupSurname = String(fields.get('surname')).trim();
                if (!firstName || !lookupSurname) {
                  setBookingError(mu.nameErr);
                  return;
                }
                setBookingPending(true);
                setBookingError('');
                try {
                  const { pnr } = await onAddBooking({
                  type: 'Transfer',
                  title: query.from + ' → ' + query.to,
                  subtitle: selectedTr.vehicle + ' · ' + query.time,
                  date: query.date,
                  price: finalTrPrice,
                    passenger: firstName + ' ' + lookupSurname,
                    lookupSurname,
                  });
                  setConfirmedPnr(pnr);
                } catch (error) {
                  setBookingError(apiMessage(error));
                } finally {
                  setBookingPending(false);
                }
              }}>
                <div className="flight-booking-summary" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>
                        <CarTaxiFront size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                        {selectedTr.vehicle} ({selectedTr.city})
                      </strong>
                      <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                        {query.from} → {query.to} · {formatDisplayDate(query.date, lang)} {query.time}
                      </div>
                    </div>
                    <strong style={{ fontSize: 18, color: 'var(--aspan-teal-deep)' }}>
                      {formatPrice(finalTrPrice, currency)}
                    </strong>
                  </div>
                </div>

                <p>{mu.demoNote}</p>
                <div className="uf-co-form-grid-2" style={{ marginBottom: 12 }}>
                  <label className="uf-co-label">{mu.firstName}
                    <input name="firstName" autoComplete="given-name" className="modal-input" required maxLength={64} />
                  </label>
                  <label className="uf-co-label">{mu.surname}
                    <input name="surname" autoComplete="family-name" className="modal-input" required maxLength={64} />
                  </label>
                </div>

                <div
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: '1px dashed var(--aspan-teal)',
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    <Tag size={13} color="#00A8B5" style={{ verticalAlign: 'middle', marginRight: 5 }} />
                    VIP Transfer: <strong>VIP25</strong> (−{formatPrice(250, currency)})
                  </span>
                  <button
                    type="button"
                    className="uf-quick-pill"
                    onClick={() => setAppliedDiscount(250)}
                  >
                    {appliedDiscount > 0 ? mu.applied : mu.applyCode('VIP25')}
                  </button>
                </div>

                {bookingError && <p className="form-action-error" role="alert">{bookingError}</p>}
                <button type="submit" className="uf-pop-done" disabled={bookingPending} style={{ height: 46, marginTop: 0 }}>
                  {bookingPending ? mu.saving : mu.saveBtn}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
