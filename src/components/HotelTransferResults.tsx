import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Users,
  MapPin,
  CheckCircle2,
  Star,
  CarTaxiFront,
  X,
  Printer,
  Tag,
  Plane,
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
    hotelReqTitle: string;
    okBtn: string;
    vipTitle: string;
    paxUnit: string;
    fixedVehiclePrice: string;
    bookTransfer: string;
    transferReqTitle: string;
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
    hotelReqTitle: 'Otel Konaklama Voucher Belgesi',
    okBtn: 'Tamam',
    vipTitle: 'VIP Havalimanı Transfer Seçenekleri',
    paxUnit: 'Yolcu',
    fixedVehiclePrice: 'SABİT ARAÇ FİYATI',
    bookTransfer: 'Transferi Ayırt',
    transferReqTitle: 'VIP Transfer & Karşılama Voucher Belgesi',
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
    hotelReqTitle: 'Hotel Accommodation Voucher',
    okBtn: 'Done',
    vipTitle: 'VIP Airport Transfer Options',
    paxUnit: 'Passengers',
    fixedVehiclePrice: 'FIXED VEHICLE FARE',
    bookTransfer: 'Book Transfer',
    transferReqTitle: 'VIP Transfer & Meet-and-Greet Voucher',
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
    hotelReqTitle: 'Официальный Ваучер Отеля',
    okBtn: 'Готово',
    vipTitle: 'VIP Трансфер из Аэропорта',
    paxUnit: 'пасс.',
    fixedVehiclePrice: 'ФИКСИРОВАННАЯ ЦЕНА ЗА АВТО',
    bookTransfer: 'Забронировать',
    transferReqTitle: 'Ваучер VIP-Трансфера',
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
    hotelReqTitle: 'Қонақ үй Ваучері (Hotel Voucher)',
    okBtn: 'Дайын',
    vipTitle: 'VIP Әуежай Трансфері Опциялары',
    paxUnit: 'жолаушы',
    fixedVehiclePrice: 'ТҰРАҚТЫ КӨЛІК БАҒАСЫ',
    bookTransfer: 'Трансферді брондау',
    transferReqTitle: 'VIP Трансфер Ваучері',
  },
};

export const HotelResultsPage: React.FC<{
  lang?: LangCode;
  currency?: CurrencyCode;
  markup?: AdminMarkupConfig;
  query: HotelSearchQuery;
  onBackHome: () => void;
  onAddBooking?: (record: BookingRecord) => void;
}> = ({ lang = 'TR', currency = 'TRY', markup = DEFAULT_MARKUP, query, onBackHome, onAddBooking }) => {
  const [selectedHotel, setSelectedHotel] = useState<HotelDeal | null>(null);
  const [guestName, setGuestName] = useState('Mert Yılmaz');
  const [guestDoc, setGuestDoc] = useState('U24901842');
  const [guestPhone, setGuestPhone] = useState('+90 531 460 61 75');
  const [guestEmail, setGuestEmail] = useState('yolcu@flytoaspan.com');
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [confirmedPnr, setConfirmedPnr] = useState<string | null>(null);
  const [confirmedVoucher, setConfirmedVoucher] = useState<string>('');

  const ui = HT_I18N[lang];
  const hotelMult = 1 + (markup.hotelPercent - DEFAULT_MARKUP.hotelPercent) / 100;

  const openHotelModal = (h: HotelDeal) => {
    setSelectedHotel(h);
    setConfirmedPnr(null);
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {HOTEL_DEALS.map((h) => {
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
        <div className="modal-overlay" onClick={() => setSelectedHotel(null)} role="dialog" aria-modal="true">
          <div
            className="modal-card"
            style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong style={{ fontSize: 18 }}>
                {confirmedPnr ? ui.hotelReqTitle : `${selectedHotel.name} — Rezervasyon`}
              </strong>
              <button type="button" className="drawer-close" onClick={() => setSelectedHotel(null)}>
                <X size={16} />
              </button>
            </div>

            {confirmedPnr ? (
              <div>
                <div
                  style={{
                    borderRadius: 16,
                    border: '2px solid var(--aspan-border)',
                    overflow: 'hidden',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #041926 0%, #0A3147 100%)',
                      color: '#ffffff',
                      padding: '15px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: '#7DD3FC', fontWeight: 800 }}>
                        FLYTOASPAN HOTEL VOUCHER · KONAKLAMA BELGESİ
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800 }}>{selectedHotel.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>PNR KODU</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#F5CD5E' }}>{confirmedPnr}</div>
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', fontSize: 12.5 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>VOUCHER NO</div>
                        <strong>{confirmedVoucher}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>GİRİŞ / ÇIKIŞ</div>
                        <strong>
                          {formatDisplayDate(query.checkIn, lang)} → {formatDisplayDate(query.checkOut, lang)}
                        </strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>ÖDENEN TUTAR</div>
                        <strong style={{ color: '#059669' }}>{formatPrice(finalHotelPrice, currency)}</strong>
                      </div>
                    </div>

                    <div style={{ padding: '8px 0', borderTop: '1px dashed var(--aspan-border)' }}>
                      <strong>Misafir:</strong> {guestName} ({guestDoc}) · {query.adults} {ui.adults} ·{' '}
                      {selectedHotel.boardType}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 10,
                        borderTop: '1px dashed var(--aspan-border)',
                        marginTop: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="48" height="48" viewBox="0 0 56 56" aria-label="Otel Voucher QR">
                          <rect width="56" height="56" rx="6" fill="#041926" />
                          <rect x="6" y="6" width="16" height="16" fill="none" stroke="#F5CD5E" strokeWidth="3" />
                          <rect x="34" y="6" width="16" height="16" fill="none" stroke="#19D3E0" strokeWidth="3" />
                          <rect x="6" y="34" width="16" height="16" fill="none" stroke="#19D3E0" strokeWidth="3" />
                          <rect x="26" y="26" width="8" height="8" fill="#F5CD5E" />
                        </svg>
                        <div style={{ fontSize: 11.5 }}>
                          <strong>Resepsiyon Hızlı Giriş QR Kodu</strong>
                          <div>7/24 Acente Destek: +90 531 460 61 75</div>
                        </div>
                      </div>
                      <span className="status-badge ok">ONAYLANDI</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    className="u4-submit-btn"
                    style={{ height: 42, fontSize: 13 }}
                    onClick={() => window.print()}
                  >
                    <Printer size={15} />
                    PDF Voucher Yazdır
                  </button>
                  <button
                    type="button"
                    className="uf-pop-done"
                    style={{ marginTop: 0, height: 42 }}
                    onClick={() => setSelectedHotel(null)}
                  >
                    {ui.okBtn}
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const pnr = 'FTAH' + Math.floor(10 + Math.random() * 89);
                  const vch = `HTL-${Math.floor(100000 + Math.random() * 899999)}`;
                  onAddBooking?.({
                    id: `bk-htl-${Date.now()}`,
                    pnr,
                    eticketNumber: vch,
                    type: 'Otel',
                    title: `${selectedHotel.name} (${selectedHotel.city})`,
                    subtitle: `${selectedHotel.nights} Gece · ${selectedHotel.boardType} · ${query.adults} Yetişkin`,
                    date: query.checkIn,
                    returnDate: query.checkOut,
                    passenger: guestName.trim() || 'Değerli Misafir',
                    price: finalHotelPrice,
                    status: 'Onaylandı',
                  });
                  setConfirmedVoucher(vch);
                  setConfirmedPnr(pnr);
                }}
              >
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

                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label htmlFor="htl-guest-name" style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Konaklayacak Misafir Adı Soyadı *
                    </label>
                    <input
                      id="htl-guest-name"
                      required
                      className="modal-input"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="htl-guest-doc" style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      TCKN / Pasaport No *
                    </label>
                    <input
                      id="htl-guest-doc"
                      required
                      className="modal-input"
                      value={guestDoc}
                      onChange={(e) => setGuestDoc(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label htmlFor="htl-guest-email" style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      E-Posta Adresi *
                    </label>
                    <input
                      id="htl-guest-email"
                      type="email"
                      required
                      className="modal-input"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="htl-guest-phone" style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Telefon Numarası *
                    </label>
                    <input
                      id="htl-guest-phone"
                      required
                      className="modal-input"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                    />
                  </div>
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
                    Otel Kuponu: <strong>OTEL30</strong> (−{formatPrice(300, currency)})
                  </span>
                  <button
                    type="button"
                    className="uf-quick-pill"
                    onClick={() => {
                      setCouponCode('OTEL30');
                      setAppliedDiscount(300);
                    }}
                  >
                    {couponCode === 'OTEL30' ? '✓ Uygulandı' : 'OTEL30 Uygula'}
                  </button>
                </div>

                <button type="submit" className="uf-pop-done" style={{ height: 46, marginTop: 0 }}>
                  Otel Rezervasyonunu Tamamla · {formatPrice(finalHotelPrice, currency)}
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
  onAddBooking?: (record: BookingRecord) => void;
}> = ({ lang = 'TR', currency = 'TRY', markup = DEFAULT_MARKUP, query, onBackHome, onAddBooking }) => {
  const [selectedTr, setSelectedTr] = useState<TransferDeal | null>(null);
  const [paxName, setPaxName] = useState('Mert Yılmaz');
  const [flightCode, setFlightCode] = useState('KC912');
  const [paxPhone, setPaxPhone] = useState('+90 531 460 61 75');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [confirmedPnr, setConfirmedPnr] = useState<string | null>(null);
  const [confirmedVoucher, setConfirmedVoucher] = useState<string>('');

  const ui = HT_I18N[lang];
  const transferDiff = markup.transferAddTRY - DEFAULT_MARKUP.transferAddTRY;

  const openTransferModal = (tr: TransferDeal) => {
    setSelectedTr(tr);
    setConfirmedPnr(null);
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
        <div className="modal-overlay" onClick={() => setSelectedTr(null)} role="dialog" aria-modal="true">
          <div
            className="modal-card"
            style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong style={{ fontSize: 18 }}>
                {confirmedPnr ? ui.transferReqTitle : `${selectedTr.vehicle} — VIP Karşılama`}
              </strong>
              <button type="button" className="drawer-close" onClick={() => setSelectedTr(null)}>
                <X size={16} />
              </button>
            </div>

            {confirmedPnr ? (
              <div>
                <div
                  style={{
                    borderRadius: 16,
                    border: '2px solid var(--aspan-border)',
                    overflow: 'hidden',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #041926 0%, #0A3147 100%)',
                      color: '#ffffff',
                      padding: '15px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: '#7DD3FC', fontWeight: 800 }}>
                        FLYTOASPAN VIP TRANSFER &amp; MEET-AND-GREET VOUCHER
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800 }}>{selectedTr.vehicle}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>PNR KODU</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#F5CD5E' }}>{confirmedPnr}</div>
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', fontSize: 12.5 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>VOUCHER NO</div>
                        <strong>{confirmedVoucher}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>TARİH &amp; SAAT</div>
                        <strong>
                          {formatDisplayDate(query.date, lang)} · {query.time}
                        </strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>SABİT TUTAR</div>
                        <strong style={{ color: '#059669' }}>{formatPrice(finalTrPrice, currency)}</strong>
                      </div>
                    </div>

                    <div style={{ padding: '8px 0', borderTop: '1px dashed var(--aspan-border)' }}>
                      <strong>Karşılama Tabelası:</strong> {paxName} · <strong>Uçuş Takip Kodu:</strong> {flightCode} ·{' '}
                      <strong>Güzergâh:</strong> {query.from} → {query.to}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 10,
                        borderTop: '1px dashed var(--aspan-border)',
                        marginTop: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="48" height="48" viewBox="0 0 56 56" aria-label="VIP Transfer QR">
                          <rect width="56" height="56" rx="6" fill="#041926" />
                          <rect x="6" y="6" width="16" height="16" fill="none" stroke="#F5CD5E" strokeWidth="3" />
                          <rect x="34" y="6" width="16" height="16" fill="none" stroke="#19D3E0" strokeWidth="3" />
                          <rect x="6" y="34" width="16" height="16" fill="none" stroke="#19D3E0" strokeWidth="3" />
                          <rect x="26" y="26" width="8" height="8" fill="#19D3E0" />
                        </svg>
                        <div style={{ fontSize: 11.5 }}>
                          <strong>Şoför &amp; Terminal Çıkışı Karşılama QR</strong>
                          <div>7/24 Operasyon: +90 531 460 61 75</div>
                        </div>
                      </div>
                      <span className="status-badge ok">ONAYLANDI</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    className="u4-submit-btn"
                    style={{ height: 42, fontSize: 13 }}
                    onClick={() => window.print()}
                  >
                    <Printer size={15} />
                    PDF Voucher Yazdır
                  </button>
                  <button
                    type="button"
                    className="uf-pop-done"
                    style={{ marginTop: 0, height: 42 }}
                    onClick={() => setSelectedTr(null)}
                  >
                    {ui.okBtn}
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const pnr = 'FTAT' + Math.floor(10 + Math.random() * 89);
                  const vch = `VIP-${Math.floor(100000 + Math.random() * 899999)}`;
                  onAddBooking?.({
                    id: `bk-trf-${Date.now()}`,
                    pnr,
                    eticketNumber: vch,
                    type: 'Transfer',
                    title: `${query.from} → ${query.to}`,
                    subtitle: `${selectedTr.vehicle} · Uçuş Kodu: ${flightCode || 'TK2410'} · Saat: ${query.time}`,
                    date: query.date,
                    passenger: paxName.trim() || 'VIP Yolcu',
                    price: finalTrPrice,
                    status: 'Onaylandı',
                  });
                  setConfirmedVoucher(vch);
                  setConfirmedPnr(pnr);
                }}
              >
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

                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label htmlFor="trf-pax-name" style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Karşılama Tabelası Yolcu Adı Soyadı *
                    </label>
                    <input
                      id="trf-pax-name"
                      required
                      className="modal-input"
                      value={paxName}
                      onChange={(e) => setPaxName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="trf-flight-code" style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      <Plane size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Uçuş Kodu (Canlı Rötar Takibi) *
                    </label>
                    <input
                      id="trf-flight-code"
                      required
                      className="modal-input"
                      placeholder="Örn: KC912 veya TK2410"
                      value={flightCode}
                      onChange={(e) => setFlightCode(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="trf-pax-phone" style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Yolcu WhatsApp / Cep Telefonu (Şoför İletişimi İçin) *
                  </label>
                  <input
                    id="trf-pax-phone"
                    required
                    className="modal-input"
                    value={paxPhone}
                    onChange={(e) => setPaxPhone(e.target.value)}
                  />
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
                    VIP Transfer Kuponu: <strong>VIP25</strong> (−{formatPrice(250, currency)})
                  </span>
                  <button
                    type="button"
                    className="uf-quick-pill"
                    onClick={() => setAppliedDiscount(250)}
                  >
                    {appliedDiscount > 0 ? '✓ Uygulandı' : 'VIP25 Uygula'}
                  </button>
                </div>

                <button type="submit" className="uf-pop-done" style={{ height: 46, marginTop: 0 }}>
                  VIP Transferi Onayla &amp; Voucher Al · {formatPrice(finalTrPrice, currency)}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
