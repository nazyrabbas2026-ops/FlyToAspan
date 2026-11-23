import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Users,
  Plane,
  ChevronDown,
  ChevronUp,
  Briefcase,
  CheckCircle2,
  Loader2,
  Printer,
  Tag,
  Sparkles,
  Building2,
  Lock,
  CreditCard,
  ShieldCheck,
  Check,
  UserCheck,
} from 'lucide-react';
import {
  AIRPORTS,
  DEFAULT_MARKUP,
  FarePackage,
  FlightResult,
  formatDisplayDate,
  formatPrice,
  generateFlights,
} from '../data/mockData';
import {
  AdminMarkupConfig,
  BookingRecord,
  CurrencyCode,
  FlightSearchQuery,
  LangCode,
  SavedPassenger,
} from '../types';

interface FlightResultsPageProps {
  lang?: LangCode;
  currency?: CurrencyCode;
  markup?: AdminMarkupConfig;
  query: FlightSearchQuery;
  onBackHome: () => void;
  onAddBooking: (record: BookingRecord) => void;
}

const FLIGHT_RESULTS_I18N: Record<
  LangCode,
  {
    steps: [string, string, string];
    paxUnit: string;
    changeSearch: string;
    oneWay: string;
    roundTrip: string;
    sampleFares: string;
    filters: string;
    hide: string;
    show: string;
    clear: string;
    stops: string;
    nonStop: string;
    oneStop: string;
    depTime: string;
    maxPrice: string;
    selectOutbound: string;
    selectReturn: string;
    selectedOutbound: string;
    changeOutbound: string;
    sortCheapest: string;
    sortFastest: string;
    sortEarliestDep: string;
    sortEarliestArr: string;
    flightsUnit: string;
    noConsecutiveTitle: string;
    noFilterTitle: string;
    noConsecutiveSub: string;
    noFilterSub: string;
    bestPriceBadge: string;
    seatsLeft: (n: number) => string;
    nextDay: string;
    startingFrom: string;
    paxTotal: (n: number) => string;
    packagesBtn: string;
    mostEconomic: string;
    vsCheapest: (amt: string) => string;
    selectPackage: string;
    modalTitleDone: string;
    modalTitle: string;
    close: string;
    outboundLbl: string;
    returnLbl: string;
    totalLbl: string;
    goodFlight: (name: string) => string;
    valuedPax: string;
    savedNote: (route: string) => string;
    pnrCodeLbl: string;
    okBtn: string;
    fullNameLbl: string;
    fullNamePh: string;
    emailLbl: string;
    phoneLbl: string;
    demoNote: string;
    completeBtn: string;
  }
> = {
  TR: {
    steps: [
      '1. Kalkış ve varış havalimanı kontenjanları doğrulanıyor',
      '2. 500+ havayolu ve bagaj paketleri (Eco / Extra / Prime / Business) taranıyor',
      '3. En uygun fiyatlı onaylı uçuşlar sıralanıyor',
    ],
    paxUnit: 'Yolcu',
    changeSearch: 'Aramayı değiştir',
    oneWay: 'Tek yön',
    roundTrip: 'Gidiş Dönüş',
    sampleFares: 'Anlık Onaylı Uçuşlar · 3D Secure',
    filters: 'Filtreler',
    hide: 'Gizle',
    show: 'Göster',
    clear: 'Temizle',
    stops: 'Aktarma',
    nonStop: 'Aktarmasız',
    oneStop: '1 Aktarma',
    depTime: 'Kalkış Saati',
    maxPrice: 'En Yüksek Fiyat',
    selectOutbound: '1/2 Gidiş uçuşunu seçin',
    selectReturn: '2/2 Dönüş uçuşunu seçin',
    selectedOutbound: 'Seçilen gidiş:',
    changeOutbound: 'Gidiş uçuşunu değiştir',
    sortCheapest: 'En ucuz',
    sortFastest: 'En hızlı',
    sortEarliestDep: 'En erken kalkış',
    sortEarliestArr: 'En erken varış',
    flightsUnit: 'uçuş',
    noConsecutiveTitle: 'Seçili tarihlerde birbirini takip eden uçuş bulunamadı.',
    noFilterTitle: 'Seçtiğiniz filtrelere uygun uçuş bulunamadı.',
    noConsecutiveSub: 'Aramayı değiştirerek başka bir dönüş tarihi seçebilirsiniz.',
    noFilterSub: 'Filtreleri temizleyerek tüm mevcut seferleri görüntüleyebilirsiniz.',
    bestPriceBadge: 'EN UYGUN FİYAT',
    seatsLeft: (n) => `Son ${n} koltuk`,
    nextDay: 'Ertesi gün',
    startingFrom: 'başlangıç',
    paxTotal: (n) => `${n} yolcu · toplam`,
    packagesBtn: 'Paketler',
    mostEconomic: 'En ekonomik paket',
    vsCheapest: (amt) => `en ucuza göre +${amt}`,
    selectPackage: 'Bu paketi seç',
    modalTitleDone: 'Resmi Elektronik Bilet (E-Ticket) Onaylandı',
    modalTitle: 'Güvenli Yolcu & Biletleme Kaydı',
    close: 'Kapat',
    outboundLbl: 'Gidiş · ',
    returnLbl: 'Dönüş · ',
    totalLbl: 'Toplam',
    goodFlight: (name) => `İyi Uçuşlar, ${name}!`,
    valuedPax: 'Değerli Yolcumuz',
    savedNote: (route) => `${route} uçuşunuz için PNR ve E-Bilet kaydınız oluşturuldu.`,
    pnrCodeLbl: 'RESMİ PNR REZERVASYON KODU',
    okBtn: 'Tamam',
    fullNameLbl: 'Yolcu Adı Soyadı *',
    fullNamePh: 'Ad Soyad',
    emailLbl: 'E-Posta Adresi *',
    phoneLbl: 'Telefon Numarası *',
    demoNote: 'Bilgileriniz 256-Bit SSL, 3D Secure ve IATA/TÜRSAB acente güvencesiyle korunmaktadır.',
    completeBtn: 'Rezervasyonu Onayla ve E-Bilet Oluştur',
  },
  EN: {
    steps: [
      '1. Verifying departure & arrival airport inventory',
      '2. Scanning 500+ airlines & fare packages (Eco / Extra / Prime / Business)',
      '3. Sorting best-value confirmed flights',
    ],
    paxUnit: 'Passenger(s)',
    changeSearch: 'Change search',
    oneWay: 'One Way',
    roundTrip: 'Round Trip',
    sampleFares: 'Live Confirmed Fares · 3D Secure',
    filters: 'Filters',
    hide: 'Hide',
    show: 'Show',
    clear: 'Reset',
    stops: 'Stops',
    nonStop: 'Non-stop',
    oneStop: '1 Stop',
    depTime: 'Departure Time',
    maxPrice: 'Maximum Price',
    selectOutbound: '1/2 Select outbound flight',
    selectReturn: '2/2 Select return flight',
    selectedOutbound: 'Selected outbound:',
    changeOutbound: 'Change outbound flight',
    sortCheapest: 'Cheapest',
    sortFastest: 'Fastest',
    sortEarliestDep: 'Earliest departure',
    sortEarliestArr: 'Earliest arrival',
    flightsUnit: 'flights',
    noConsecutiveTitle: 'No consecutive flights found for the selected dates.',
    noFilterTitle: 'No flights match your selected filters.',
    noConsecutiveSub: 'Change your search to pick another return date.',
    noFilterSub: 'Reset filters to view all available flights.',
    bestPriceBadge: 'BEST PRICE',
    seatsLeft: (n) => `${n} seats left`,
    nextDay: 'Next day',
    startingFrom: 'from',
    paxTotal: (n) => `${n} pax · total`,
    packagesBtn: 'Packages',
    mostEconomic: 'Most economical fare',
    vsCheapest: (amt) => `+${amt} vs cheapest`,
    selectPackage: 'Select package',
    modalTitleDone: 'Official Electronic Ticket (E-Ticket) Confirmed',
    modalTitle: 'Secure Passenger & Ticketing Registration',
    close: 'Close',
    outboundLbl: 'Outbound · ',
    returnLbl: 'Return · ',
    totalLbl: 'Total',
    goodFlight: (name) => `Have a great flight, ${name}!`,
    valuedPax: 'Valued Passenger',
    savedNote: (route) => `Your PNR and E-Ticket record for ${route} has been issued.`,
    pnrCodeLbl: 'OFFICIAL PNR BOOKING CODE',
    okBtn: 'Done',
    fullNameLbl: 'Passenger Full Name *',
    fullNamePh: 'First & Last Name',
    emailLbl: 'E-Mail Address *',
    phoneLbl: 'Phone Number *',
    demoNote: 'Protected by 256-Bit SSL, 3D Secure and IATA/TURSAB accredited agency guarantee.',
    completeBtn: 'Confirm Booking & Issue E-Ticket',
  },
  RU: {
    steps: [
      '1. Проверка расписания и квот аэропортов вылета и прилёта',
      '2. Сканирование 500+ авиакомпаний и тарифов багажа (Eco / Extra / Prime / Business)',
      '3. Сортировка подтверждённых рейсов по лучшей цене',
    ],
    paxUnit: 'пасс.',
    changeSearch: 'Изменить поиск',
    oneWay: 'В одну сторону',
    roundTrip: 'Туда и обратно',
    sampleFares: 'Подтверждённые тарифы · 3D Secure',
    filters: 'Фильтры',
    hide: 'Скрыть',
    show: 'Показать',
    clear: 'Сбросить',
    stops: 'Пересадки',
    nonStop: 'Прямой рейс',
    oneStop: '1 пересадка',
    depTime: 'Время вылета',
    maxPrice: 'Макс. цена',
    selectOutbound: '1/2 Выберите рейс туда',
    selectReturn: '2/2 Выберите обратный рейс',
    selectedOutbound: 'Выбранный рейс туда:',
    changeOutbound: 'Изменить рейс туда',
    sortCheapest: 'Самые дешёвые',
    sortFastest: 'Самые быстрые',
    sortEarliestDep: 'Ранний вылет',
    sortEarliestArr: 'Ранний прилёт',
    flightsUnit: 'рейсов',
    noConsecutiveTitle: 'На выбранные даты подходящих стыковочных рейсов не найдено.',
    noFilterTitle: 'По выбранным фильтрам рейсов не найдено.',
    noConsecutiveSub: 'Измените поиск, чтобы выбрать другую дату возвращения.',
    noFilterSub: 'Сбросьте фильтры, чтобы увидеть все доступные рейсы.',
    bestPriceBadge: 'ЛУЧШАЯ ЦЕНА',
    seatsLeft: (n) => `Осталось ${n} мест`,
    nextDay: 'На след. день',
    startingFrom: 'от',
    paxTotal: (n) => `${n} пасс. · итого`,
    packagesBtn: 'Тарифы',
    mostEconomic: 'Базовый эконом-тариф',
    vsCheapest: (amt) => `+${amt} к базовому`,
    selectPackage: 'Выбрать тариф',
    modalTitleDone: 'Демо-бронирование завершено',
    modalTitle: 'Демо-бронирование',
    close: 'Закрыть',
    outboundLbl: 'Туда · ',
    returnLbl: 'Обратно · ',
    totalLbl: 'Итого',
    goodFlight: (name) => `Приятного полёта, ${name}!`,
    valuedPax: 'Уважаемый пассажир',
    savedNote: (route) => `Ваша демо-бронь по маршруту ${route} сохранена в браузере.`,
    pnrCodeLbl: 'КОД БРОНИРОВАНИЯ (PNR)',
    okBtn: 'Готово',
    fullNameLbl: 'Имя и фамилия пассажира *',
    fullNamePh: 'Имя Фамилия',
    emailLbl: 'Электронная почта *',
    phoneLbl: 'Номер телефона *',
    demoNote: 'В демо-режиме оплата не списывается и реальный билет не выписывается.',
    completeBtn: 'Завершить демо-бронирование',
  },
  KK: {
    steps: [
      '1. Ұшу және қону әуежайларының кестесі тексерілуде',
      '2. 500+ әуе компаниясы мен жолжүк пакеттері (Eco / Extra / Prime / Business) қаралуда',
      '3. Ең тиімді расталған рейстер сұрыпталуда',
    ],
    paxUnit: 'жолаушы',
    changeSearch: 'Іздеуді өзгерту',
    oneWay: 'Бір бағыт',
    roundTrip: 'Бару – Қайту',
    sampleFares: 'Расталған рейстер · 3D Secure',
    filters: 'Сүзгілер',
    hide: 'Жасыру',
    show: 'Көрсету',
    clear: 'Тазалау',
    stops: 'Ауысып міну',
    nonStop: 'Тікелей рейс',
    oneStop: '1 ауысып міну',
    depTime: 'Ұшу уақыты',
    maxPrice: 'Ең жоғары баға',
    selectOutbound: '1/2 Бару рейсін таңдаңыз',
    selectReturn: '2/2 Қайту рейсін таңдаңыз',
    selectedOutbound: 'Таңдалған бару рейсі:',
    changeOutbound: 'Бару рейсін өзгерту',
    sortCheapest: 'Ең арзан',
    sortFastest: 'Ең жылдам',
    sortEarliestDep: 'Ерте ұшу',
    sortEarliestArr: 'Ерте қону',
    flightsUnit: 'рейс',
    noConsecutiveTitle: 'Таңдалған күндерге сәйкес рейстер табылмады.',
    noFilterTitle: 'Таңдалған сүзгілерге сәйкес рейс табылмады.',
    noConsecutiveSub: 'Іздеуді өзгертіп, басқа қайту күнін таңдаңыз.',
    noFilterSub: 'Барлық рейстерді көру үшін сүзгілерді тазалаңыз.',
    bestPriceBadge: 'ЕҢ ТИІМДІ БАҒА',
    seatsLeft: (n) => `Соңғы ${n} орын`,
    nextDay: 'Келесі күні',
    startingFrom: 'бастап',
    paxTotal: (n) => `${n} жолаушы · жиыны`,
    packagesBtn: 'Пакеттер',
    mostEconomic: 'Ең үнемді пакет',
    vsCheapest: (amt) => `ең арзаннан +${amt}`,
    selectPackage: 'Осы пакетті таңдау',
    modalTitleDone: 'Демо брондау аяқталды',
    modalTitle: 'Демо брондау',
    close: 'Жабу',
    outboundLbl: 'Бару · ',
    returnLbl: 'Қайту · ',
    totalLbl: 'Жиыны',
    goodFlight: (name) => `Сапарыңыз сәтті болсын, ${name}!`,
    valuedPax: 'Құрметті жолаушы',
    savedNote: (route) => `${route} бағыты бойынша демо жазбаңыз осы браузерде сақталды.`,
    pnrCodeLbl: 'ДЕМО БРОНДАУ КОДЫ (PNR)',
    okBtn: 'Дайын',
    fullNameLbl: 'Жолаушының аты-жөні *',
    fullNamePh: 'Аты-жөні',
    emailLbl: 'Электрондық пошта *',
    phoneLbl: 'Телефон нөмірі *',
    demoNote: 'Бұл демо режимінде төлем алынбайды және нақты билет рәсімделмейді.',
    completeBtn: 'Демо брондауды аяқтау',
  },
};

type SortKey = 'cheapest' | 'fastest' | 'earliestDep' | 'earliestArr';

type FlightSelection = { flight: FlightResult; pkg: FarePackage };

function canReturnAfter(outbound: FlightResult, inbound: FlightResult): boolean {
  return inbound.departureDate > outbound.arrivalDate ||
    (inbound.departureDate === outbound.arrivalDate && inbound.departMinutes > outbound.arriveMinutes);
}

function describeFare({ flight, pkg }: FlightSelection): string {
  return `${flight.airline} · ${flight.flightNumber} · ${pkg.name}`;
}

const QUICK_SAVED_PAX: SavedPassenger[] = [
  {
    id: 'sp-1',
    fullName: 'Mert Yılmaz',
    docNumber: 'U24901842',
    birthDate: '1994-05-14',
    nationality: 'Türkiye (TR)',
  },
  {
    id: 'sp-2',
    fullName: 'Aylin Karahan',
    docNumber: 'N18743920',
    birthDate: '1996-09-22',
    nationality: 'Kazakistan (KZ)',
  },
  {
    id: 'sp-3',
    fullName: 'Alperen Kaya',
    docNumber: 'U39184710',
    birthDate: '1991-11-08',
    nationality: 'Türkiye (TR)',
  },
];

export const FlightResultsPage: React.FC<FlightResultsPageProps> = ({
  lang = 'TR',
  currency = 'TRY',
  markup = DEFAULT_MARKUP,
  query,
  onBackHome,
  onAddBooking,
}) => {
  const ui = FLIGHT_RESULTS_I18N[lang];
  const [loadingStep, setLoadingStep] = useState(0); // 0, 1, 2, then 3 = done
  const [sortBy, setSortBy] = useState<SortKey>('cheapest');
  const [stopFilters, setStopFilters] = useState<number[]>([]);
  const [depSlots, setDepSlots] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [outboundChoice, setOutboundChoice] = useState<FlightSelection | null>(null);
  const [bookingChoice, setBookingChoice] = useState<FlightSelection | null>(null);
  const [bookingConfirmedPnr, setBookingConfirmedPnr] = useState<string | null>(null);
  const [bookingEticket, setBookingEticket] = useState<string>('');
  const [passengerEmail, setPassengerEmail] = useState('yolcu@flytoaspan.com');
  const [passengerPhone, setPassengerPhone] = useState('+90 531 460 61 75');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [wantCorpInvoice, setWantCorpInvoice] = useState(false);
  const [invoiceCompany, setInvoiceCompany] = useState('');
  const [invoiceTaxOffice, setInvoiceTaxOffice] = useState('');
  const [invoiceTaxNo, setInvoiceTaxNo] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Full-Page Checkout State (Card Preview, Installments, Protection Add-ons, Promo Toggle)
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('MERT YILMAZ');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [installmentCount, setInstallmentCount] = useState<1 | 3 | 6 | 9>(1);
  const [showPromoCodeBox, setShowPromoCodeBox] = useState(false);
  const [addonCancelShield, setAddonCancelShield] = useState(false);
  const [addonAutoCheckin, setAddonAutoCheckin] = useState(false);
  const [paxGenders, setPaxGenders] = useState<Record<number, 'M' | 'F'>>({ 0: 'M' });

  const totalPax = query.adults + query.children + query.infants;
  const [paxForms, setPaxForms] = useState<SavedPassenger[]>(() =>
    Array.from({ length: Math.max(1, totalPax) }, (_, idx) => ({
      id: `pf-${idx}`,
      fullName: idx === 0 ? 'Mert Yılmaz' : '',
      docNumber: idx === 0 ? 'U24901842' : '',
      birthDate: idx === 0 ? '1994-05-14' : '1995-01-01',
      nationality: 'Türkiye (TR)',
    }))
  );

  useEffect(() => {
    setPaxForms((prev) =>
      Array.from({ length: Math.max(1, totalPax) }, (_, idx) =>
        prev[idx] || {
          id: `pf-${idx}`,
          fullName: '',
          docNumber: '',
          birthDate: '1995-01-01',
          nationality: 'Türkiye (TR)',
        }
      )
    );
  }, [totalPax]);

  const isRoundTrip = query.tripType === 'roundtrip';
  const outboundFlights = useMemo(
    () => generateFlights(query.fromCode, query.toCode, query.departDate, query.cabin, lang, markup),
    [query.fromCode, query.toCode, query.departDate, query.cabin, lang, markup]
  );
  const inboundFlights = useMemo(
    () =>
      isRoundTrip
        ? generateFlights(query.toCode, query.fromCode, query.returnDate, query.cabin, lang, markup)
        : [],
    [isRoundTrip, query.toCode, query.fromCode, query.returnDate, query.cabin, lang, markup]
  );
  const allFlights = useMemo(() => {
    if (!isRoundTrip) return outboundFlights;
    if (outboundChoice) return inboundFlights.filter((inbound) => canReturnAfter(outboundChoice.flight, inbound));
    return outboundFlights.filter((outbound) => inboundFlights.some((inbound) => canReturnAfter(outbound, inbound)));
  }, [isRoundTrip, outboundChoice, outboundFlights, inboundFlights]);

  const maxAvailablePrice = useMemo(
    () => (allFlights.length > 0 ? Math.max(...allFlights.map((f) => f.basePrice)) : 10000),
    [allFlights]
  );
  const minAvailablePrice = Math.min(maxAvailablePrice, ...allFlights.map((flight) => flight.basePrice));
  const [maxPrice, setMaxPrice] = useState<number>(maxAvailablePrice);

  useEffect(() => {
    setMaxPrice(maxAvailablePrice);
  }, [maxAvailablePrice]);

  useEffect(() => {
    setLoadingStep(0);
    const t1 = setTimeout(() => setLoadingStep(1), 420);
    const t2 = setTimeout(() => setLoadingStep(2), 860);
    const t3 = setTimeout(() => setLoadingStep(3), 1250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [query.fromCode, query.toCode, query.departDate, query.returnDate, query.tripType, query.cabin]);

  const fromAirport = AIRPORTS.find((a) => a.code === query.fromCode) || AIRPORTS[0];
  const toAirport = AIRPORTS.find((a) => a.code === query.toCode) || AIRPORTS[4];
  const bookingLegs = bookingChoice ? (outboundChoice ? [outboundChoice, bookingChoice] : [bookingChoice]) : [];
  const rawBookingTotal =
    bookingLegs.reduce((total, { flight, pkg }) => total + flight.basePrice + pkg.priceDelta, 0) *
    totalPax;
  const discountTRY = useMemo(() => {
    if (!appliedCoupon) return 0;
    const code = appliedCoupon.toUpperCase();
    if (code === 'ASPAN350') return 350;
    if (code === 'SKYALA18') return Math.round(rawBookingTotal * 0.18);
    if (code === 'VIP25') return 250;
    if (code === 'OTEL30') return 300;
    return 0;
  }, [appliedCoupon, rawBookingTotal]);
  const addonsTotalTRY =
    ((addonCancelShield ? 240 : 0) + (addonAutoCheckin ? 145 : 0)) * totalPax;
  const bookingTotal = Math.max(250, rawBookingTotal + addonsTotalTRY - discountTRY);
  const bookingTitle = `${fromAirport.city} (${fromAirport.code}) ${isRoundTrip ? '↔' : '→'} ${toAirport.city} (${toAirport.code})`;

  const filtered = useMemo(() => {
    let list = allFlights.filter((f) => f.basePrice <= maxPrice);
    if (stopFilters.length > 0) {
      list = list.filter((f) => stopFilters.includes(f.stops));
    }
    if (depSlots.length > 0) {
      list = list.filter((f) => {
        const slot = Math.floor(f.departMinutes / 360);
        return depSlots.includes(slot);
      });
    }
    const sorted = [...list];
    if (sortBy === 'cheapest') sorted.sort((a, b) => a.basePrice - b.basePrice);
    else if (sortBy === 'fastest') sorted.sort((a, b) => a.durationMinutes - b.durationMinutes);
    else if (sortBy === 'earliestDep') sorted.sort((a, b) => a.departMinutes - b.departMinutes);
    else sorted.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate) || a.arriveMinutes - b.arriveMinutes);
    return sorted;
  }, [allFlights, maxPrice, stopFilters, depSlots, sortBy]);

  const cheapestId = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((best, cur) => (cur.basePrice < best.basePrice ? cur : best), filtered[0])
      .id;
  }, [filtered]);

  const toggleArr = (arr: number[], val: number, setter: React.Dispatch<React.SetStateAction<number[]>>) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const resetFilters = () => {
    setStopFilters([]);
    setDepSlots([]);
    setMaxPrice(maxAvailablePrice);
  };

  const changeLeg = (outbound: FlightSelection | null) => {
    resetFilters();
    setExpandedId(null);
    setOutboundChoice(outbound);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectFare = (selection: FlightSelection) => {
    if (isRoundTrip && !outboundChoice) {
      changeLeg(selection);
      return;
    }

    setBookingConfirmedPnr(null);
    setBookingChoice(selection);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loadingStep < 3) {
    const steps = ui.steps;
    const pct = loadingStep === 0 ? 32 : loadingStep === 1 ? 68 : 96;
    return (
      <div className="loading-screen">
        <div className="loading-box gds-loader-card">
          <div className="gds-loader-top">
            <span className="gds-loader-badge">
              <Sparkles size={13} />
              FLYTOASPAN GDS &amp; NDC FLIGHT ENGINE
            </span>
            <span className="gds-loader-pct">{pct}%</span>
          </div>

          {/* Visual Route Flight Trajectory */}
          <div className="gds-route-visual">
            <div className="gds-airport-node">
              <span className="gds-iata">{fromAirport.code}</span>
              <span className="gds-city">{fromAirport.city}</span>
            </div>

            <div className="gds-flight-track">
              <div className="gds-flight-track-line">
                <div className="gds-flight-track-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="gds-plane-runner" style={{ left: `${pct}%` }}>
                <Plane size={20} />
              </div>
            </div>

            <div className="gds-airport-node" style={{ textAlign: 'right' }}>
              <span className="gds-iata">{toAirport.code}</span>
              <span className="gds-city">{toAirport.city}</span>
            </div>
          </div>

          <p className="gds-loader-meta">
            {formatDisplayDate(query.departDate, lang)}
            {isRoundTrip && query.returnDate ? ` → ${formatDisplayDate(query.returnDate, lang)}` : ''} ·{' '}
            {totalPax} {ui.paxUnit} · {query.cabin}
          </p>

          {/* Animated Progress Bar */}
          <div className="gds-progress-bar">
            <div className="gds-progress-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="loading-steps">
            {steps.map((txt, idx) => {
              const state = loadingStep > idx ? 'done' : loadingStep === idx ? 'active' : '';
              return (
                <div key={txt} className={`loading-step ${state}`}>
                  {state === 'done' ? (
                    <CheckCircle2 size={18} />
                  ) : state === 'active' ? (
                    <Loader2 size={18} className="spin-icon" />
                  ) : (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: '2px solid var(--aspan-border)',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span>{txt}</span>
                </div>
              );
            })}
          </div>

          <div className="gds-airlines-scanned">
            {['Turkish Airlines', 'Air Astana', 'Pegasus', 'AJet', 'SunExpress', 'Lufthansa', 'Emirates'].map(
              (air) => (
                <span key={air} className="gds-airline-pill">
                  {air}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dedicated Full-Page Checkout & E-Ticket View (Görsel 4 Style + FlyToAspan Luxury Upgrades)
  if (bookingChoice) {
    const activeFlight = bookingChoice.flight;
    const activePkg = bookingChoice.pkg;
    const formatCardDisplay = (raw: string) => {
      const digits = raw.replace(/\D/g, '').slice(0, 16);
      if (!digits) return '•••• •••• •••• ••••';
      const padded = digits.padEnd(16, '•');
      return `${padded.slice(0, 4)} ${padded.slice(4, 8)} ${padded.slice(8, 12)} ${padded.slice(12, 16)}`;
    };

    const handleCardNumberChange = (val: string) => {
      const digits = val.replace(/\D/g, '').slice(0, 16);
      const groups = digits.match(/.{1,4}/g) || [];
      setCardNumber(groups.join(' '));
    };

    const handleExpiryChange = (val: string) => {
      const digits = val.replace(/\D/g, '').slice(0, 4);
      if (digits.length >= 3) {
        setCardExpiry(`${digits.slice(0, 2)}/${digits.slice(2, 4)}`);
      } else {
        setCardExpiry(digits);
      }
    };

    return (
      <div className="uf-checkout-page">
        {/* Top Dark-Navy Checkout Progress Hero */}
        <div className="uf-checkout-hero">
          <div className="container">
            <button
              type="button"
              className="uf-checkout-back"
              onClick={() => {
                setBookingChoice(null);
                setBookingConfirmedPnr(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowLeft size={15} />
              <span>Uçuş seçimine dön</span>
            </button>

            <h1 className="uf-checkout-h1">
              {bookingConfirmedPnr
                ? 'Resmi Elektronik Biletiniz (E-Ticket) Onaylandı'
                : 'Yolcu bilgileri ve ödeme'}
            </h1>

            <div className="uf-checkout-steps" role="list" aria-label="Biletleme Adımları">
              <div className="uf-step-pill is-done" role="listitem">
                <span className="uf-step-badge">
                  <Check size={13} strokeWidth={3} />
                </span>
                <span>Uçuş seçildi</span>
              </div>
              <div
                className={`uf-step-pill ${bookingConfirmedPnr ? 'is-done' : 'is-active'}`}
                role="listitem"
              >
                <span className="uf-step-badge">
                  {bookingConfirmedPnr ? <Check size={13} strokeWidth={3} /> : '2'}
                </span>
                <span>Yolcu &amp; ödeme</span>
              </div>
              <div
                className={`uf-step-pill ${bookingConfirmedPnr ? 'is-active' : ''}`}
                role="listitem"
              >
                <span className="uf-step-badge">3</span>
                <span>Bilet</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Checkout Workspace */}
        <section className="uf-checkout-workspace">
          <div className="container">
            {bookingConfirmedPnr ? (
              <div className="uf-eticket-stage">
                <div className="uf-co-card" style={{ maxWidth: 820, margin: '0 auto' }}>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #041926 0%, #0A3147 100%)',
                      color: '#ffffff',
                      padding: '22px 26px',
                      borderRadius: 18,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 14,
                      marginBottom: 20,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#7DD3FC', fontWeight: 800 }}>
                        FLYTOASPAN BY INFINITIVE TRAVEL · IATA OFFICIAL E-TICKET
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{bookingTitle}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.74)', fontWeight: 700 }}>
                        PNR / REZERVASYON KODU
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#F5CD5E', letterSpacing: 2 }}>
                        {bookingConfirmedPnr}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                      gap: 14,
                      paddingBottom: 18,
                      borderBottom: '1px dashed var(--aspan-border)',
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ color: 'var(--aspan-text-muted)', fontSize: 11, fontWeight: 700 }}>
                        E-BİLET NO (ETKT)
                      </div>
                      <strong style={{ fontSize: 15 }}>{bookingEticket}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--aspan-text-muted)', fontSize: 11, fontWeight: 700 }}>
                        BİLET DURUMU
                      </div>
                      <strong style={{ color: '#059669', fontSize: 15 }}>CONFIRMED / ONAYLI</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--aspan-text-muted)', fontSize: 11, fontWeight: 700 }}>
                        ÖDENEN TUTAR
                      </div>
                      <strong style={{ fontSize: 15 }}>
                        {formatPrice(bookingTotal, currency)} ({installmentCount === 1 ? 'Tek Çekim' : `${installmentCount} Taksit`} · 3D Secure)
                      </strong>
                    </div>
                  </div>

                  {/* Passengers List */}
                  <div style={{ marginTop: 18, marginBottom: 18 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--aspan-text-muted)', marginBottom: 8 }}>
                      YOLCU VE KİMLİK / PASAPORT BİLGİLERİ
                    </div>
                    {paxForms.map((pf, idx) => (
                      <div
                        key={pf.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 13.5,
                          padding: '10px 14px',
                          borderRadius: 12,
                          background: 'var(--aspan-bg-soft)',
                          marginBottom: 6,
                        }}
                      >
                        <strong>
                          {idx + 1}. {pf.fullName || ui.valuedPax} ({paxGenders[idx] === 'F' ? 'Bayan' : 'Bay'})
                        </strong>
                        <span style={{ color: 'var(--aspan-text-body)', fontWeight: 700 }}>
                          Belge No: {pf.docNumber || 'U24901842'} · {pf.nationality}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* QR & Barcode Stub */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 16,
                      borderTop: '1px dashed var(--aspan-border)',
                      gap: 16,
                      flexWrap: 'wrap',
                      marginBottom: 22,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <svg width="64" height="64" viewBox="0 0 56 56" aria-label="Biniş QR Kodu">
                        <rect width="56" height="56" rx="8" fill="#041926" />
                        <rect x="6" y="6" width="16" height="16" fill="none" stroke="#F5CD5E" strokeWidth="3" />
                        <rect x="11" y="11" width="6" height="6" fill="#F5CD5E" />
                        <rect x="34" y="6" width="16" height="16" fill="none" stroke="#19D3E0" strokeWidth="3" />
                        <rect x="39" y="11" width="6" height="6" fill="#19D3E0" />
                        <rect x="6" y="34" width="16" height="16" fill="none" stroke="#19D3E0" strokeWidth="3" />
                        <rect x="11" y="39" width="6" height="6" fill="#19D3E0" />
                        <rect x="26" y="26" width="6" height="6" fill="#ffffff" />
                        <rect x="36" y="34" width="5" height="5" fill="#F5CD5E" />
                        <rect x="44" y="42" width="6" height="6" fill="#ffffff" />
                      </svg>
                      <div style={{ fontSize: 12.5, color: 'var(--aspan-text-body)' }}>
                        <strong style={{ display: 'block', fontSize: 14, color: 'var(--aspan-text)' }}>
                          Mobil Biniş &amp; Hızlı Check-In QR Kodu
                        </strong>
                        <div>7/24 VIP Destek Hattı: +90 531 460 61 75</div>
                      </div>
                    </div>

                    <svg width="160" height="40" viewBox="0 0 136 34" aria-hidden="true">
                      {[0, 5, 9, 14, 19, 23, 28, 34, 38, 43, 48, 53, 58, 63, 68, 74, 79, 85, 90, 96, 102, 107, 113, 118, 124, 130].map(
                        (x, idx) => (
                          <rect
                            key={x}
                            x={x}
                            y="0"
                            width={idx % 3 === 0 ? 3 : 1.7}
                            height="34"
                            fill="#072233"
                          />
                        )
                      )}
                    </svg>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <button
                      type="button"
                      className="u4-submit-btn"
                      style={{ height: 48, fontSize: 14 }}
                      onClick={() => window.print()}
                    >
                      <Printer size={17} />
                      <span>PDF E-Bilet Yazdır / İndir</span>
                    </button>
                    <button
                      type="button"
                      className="pkg-select-sky-btn"
                      style={{ height: 48, fontSize: 14 }}
                      onClick={() => {
                        setBookingChoice(null);
                        setBookingConfirmedPnr(null);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <span>Uçuş Listesine Dön</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form
                className="uf-checkout-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const pnr = 'FTA' + Math.random().toString(36).substring(2, 6).toUpperCase();
                  const etkt = `235-${Math.floor(1000000000 + Math.random() * 8999999999)}`;
                  const leadPax = paxForms[0]?.fullName.trim() || ui.valuedPax;
                  onAddBooking({
                    id: `bk-${Date.now()}`,
                    pnr,
                    eticketNumber: etkt,
                    type: 'Uçak',
                    title: bookingTitle,
                    subtitle: bookingLegs
                      .map((leg, index) =>
                        index === 0
                          ? describeFare(leg)
                          : `${ui.returnLbl}${formatDisplayDate(leg.flight.departureDate, lang)}: ${describeFare(leg)}`
                      )
                      .join(' / '),
                    date: query.departDate,
                    returnDate: isRoundTrip ? query.returnDate : undefined,
                    passenger:
                      paxForms.length > 1 ? `${leadPax} (+${paxForms.length - 1})` : leadPax,
                    passengersList: paxForms,
                    couponCode: appliedCoupon || undefined,
                    discountTRY: discountTRY > 0 ? discountTRY : undefined,
                    invoiceCompany: wantCorpInvoice ? invoiceCompany : undefined,
                    invoiceTaxNo: wantCorpInvoice ? invoiceTaxNo : undefined,
                    price: bookingTotal,
                    status: 'Onaylandı',
                  });
                  setBookingEticket(etkt);
                  setBookingConfirmedPnr(pnr);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {/* ================= LEFT COLUMN: FLIGHT SUMMARY, PACKAGE SWITCHER, PASSENGER FORMS ================= */}
                <div className="uf-checkout-main">
                  {/* 1. Seçtiğiniz uçuş */}
                  <div className="uf-co-card">
                    <div className="uf-co-card-head">
                      <div className="uf-co-icon-box">
                        <Plane size={19} />
                      </div>
                      <div>
                        <h2 className="uf-co-card-title">Seçtiğiniz uçuş</h2>
                        <p className="uf-co-card-sub">
                          Bilgileri kontrol edin, hatalıysa geri dönebilirsiniz.
                        </p>
                      </div>
                    </div>

                    {bookingLegs.map(({ flight, pkg }, legIdx) => (
                      <div
                        key={flight.id}
                        className="uf-co-flight-box"
                        style={{ marginTop: legIdx > 0 ? 16 : 0 }}
                      >
                        <div className="uf-co-flight-top">
                          <div className="uf-co-airline-group">
                            <span className="uf-co-dir-pill">
                              <Plane size={12} />
                              {legIdx === 0 ? 'Gidiş' : 'Dönüş'}
                            </span>
                            <span
                              className="uf-co-airline-badge"
                              style={{ background: flight.airlineColor }}
                            >
                              {flight.airlineCode}
                            </span>
                            <strong className="uf-co-airline-name">{flight.airline}</strong>
                            <span className="uf-co-flight-num">{flight.flightNumber}</span>
                          </div>
                          <span className="uf-co-date-tag">
                            <Calendar size={13} />
                            {flight.departureDate.split('-').reverse().join('.')}
                          </span>
                        </div>

                        <div className="uf-co-route-row">
                          <div className="uf-co-endpoint">
                            <div className="uf-co-time">{flight.departTime}</div>
                            <div className="uf-co-iata">{flight.fromCode}</div>
                            <div className="uf-co-city">{flight.fromCity}</div>
                          </div>

                          <div className="uf-co-midline">
                            <div className="uf-co-dur">{flight.durationLabel}</div>
                            <div className="uf-co-track">
                              <span className="uf-co-dot" />
                              <span className="uf-co-line" />
                              <span className="uf-co-dot" />
                            </div>
                            <div className="uf-co-stops">
                              {flight.stops === 0
                                ? 'Aktarmasız direkt uçuş'
                                : `1 Aktarma (${flight.stopCity})`}
                            </div>
                          </div>

                          <div className="uf-co-endpoint is-right">
                            <div className="uf-co-time">{flight.arriveTime}</div>
                            <div className="uf-co-iata">{flight.toCode}</div>
                            <div className="uf-co-city">{flight.toCity}</div>
                          </div>
                        </div>

                        <div className="uf-co-chips-row">
                          <span className="uf-co-chip sky">
                            {pkg.cabin === 'BUSINESS' ? 'Business' : 'Ekonomi'}
                          </span>
                          <span className="uf-co-chip gold">
                            <Tag size={12} />
                            {pkg.name}
                          </span>
                          <span className="uf-co-chip">
                            <Briefcase size={12} />
                            Kabin {pkg.cabinBag.replace(' kabin bagajı', '')}
                          </span>
                          <span className="uf-co-chip">
                            <Briefcase size={12} />
                            Kayıtlı {pkg.checkedBag.replace(' uçak altı bagaj', '')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 2. Bilet paketiniz — Interactive Package Switcher */}
                  <div className="uf-co-card">
                    <div className="uf-co-card-head">
                      <div className="uf-co-icon-box">
                        <Tag size={18} />
                      </div>
                      <div>
                        <h2 className="uf-co-card-title">Bilet paketiniz</h2>
                        <p className="uf-co-card-sub">
                          Bagaj ve esneklik ihtiyacınıza göre paketi buradan değiştirebilirsiniz; fiyat anında güncellenir.
                        </p>
                      </div>
                    </div>

                    <div className="uf-co-pkg-grid">
                      {activeFlight.packages.map((p) => {
                        const isSelected = p.id === activePkg.id;
                        const pTotal = (activeFlight.basePrice + p.priceDelta) * totalPax;
                        const diffFromBase = p.priceDelta * totalPax;

                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`uf-co-pkg-option ${isSelected ? 'is-selected' : ''}`}
                            onClick={() =>
                              setBookingChoice({
                                flight: activeFlight,
                                pkg: p,
                              })
                            }
                          >
                            <div className="uf-co-pkg-top">
                              <strong className="uf-co-pkg-name">{p.name}</strong>
                              {isSelected ? (
                                <span className="uf-co-pkg-state selected">
                                  <CheckCircle2 size={12} /> Seçili
                                </span>
                              ) : (
                                <span className="uf-co-pkg-state delta">
                                  +{formatPrice(diffFromBase, currency)}
                                </span>
                              )}
                            </div>

                            <div className="uf-co-pkg-tags">
                              <span className="uf-co-mini-tag">
                                {p.cabin === 'BUSINESS' ? 'Business' : 'Ekonomi'}
                              </span>
                              <span className="uf-co-mini-tag">
                                Kabin {p.cabinBag.replace(' kabin bagajı', '')}
                              </span>
                              <span className="uf-co-mini-tag">
                                Kayıtlı {p.checkedBag.replace(' uçak altı bagaj', '')}
                              </span>
                              <span className="uf-co-mini-tag">{p.refundText}</span>
                            </div>

                            <div className="uf-co-pkg-price">{formatPrice(pTotal, currency)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Yolcu bilgileri */}
                  <div className="uf-co-card">
                    <div className="uf-co-card-head">
                      <div className="uf-co-icon-box">
                        <UserCheck size={19} />
                      </div>
                      <div>
                        <h2 className="uf-co-card-title">Yolcu bilgileri</h2>
                        <p className="uf-co-card-sub">
                          Kimlik veya pasaportunuzda yer aldığı şekilde eksiksiz doldurunuz.
                        </p>
                      </div>
                    </div>

                    {/* 1-Click Saved Passenger Bar */}
                    <div className="uf-co-saved-bar">
                      <div className="uf-co-saved-label">
                        <Sparkles size={14} />
                        <span>Kayıtlı Yolculardan Tek Tıkla Doldur:</span>
                      </div>
                      <div className="uf-co-saved-pills">
                        {QUICK_SAVED_PAX.map((sp, spIdx) => (
                          <button
                            key={sp.id}
                            type="button"
                            className="uf-quick-pill"
                            onClick={() => {
                              const targetIdx = Math.min(spIdx, paxForms.length - 1);
                              setPaxForms((prev) =>
                                prev.map((item, i) =>
                                  i === targetIdx ? { ...sp, id: item.id } : item
                                )
                              );
                              if (targetIdx === 0) {
                                setCardHolder(sp.fullName.toUpperCase());
                              }
                            }}
                          >
                            ⚡ {sp.fullName} ({sp.docNumber})
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="uf-co-pax-list">
                      {paxForms.map((pf, idx) => {
                        const gender = paxGenders[idx] || 'M';
                        return (
                          <div key={pf.id} className="uf-co-pax-box">
                            <div className="uf-co-pax-box-head">
                              <span className="uf-co-pax-badge">
                                {idx + 1}. {ui.paxUnit} (Yetişkin)
                              </span>
                              <div className="uf-co-gender-pills">
                                <button
                                  type="button"
                                  className={`uf-gender-btn ${gender === 'M' ? 'active' : ''}`}
                                  onClick={() =>
                                    setPaxGenders((prev) => ({ ...prev, [idx]: 'M' }))
                                  }
                                >
                                  Erkek
                                </button>
                                <button
                                  type="button"
                                  className={`uf-gender-btn ${gender === 'F' ? 'active' : ''}`}
                                  onClick={() =>
                                    setPaxGenders((prev) => ({ ...prev, [idx]: 'F' }))
                                  }
                                >
                                  Kadın
                                </button>
                              </div>
                            </div>

                            <div className="uf-co-form-grid-2">
                              <div>
                                <label
                                  htmlFor={`pax-name-${idx}`}
                                  className="uf-co-label"
                                >
                                  {ui.fullNameLbl}
                                </label>
                                <input
                                  id={`pax-name-${idx}`}
                                  name={`paxName-${idx}`}
                                  autoComplete="name"
                                  required
                                  className="uf-co-input"
                                  placeholder={ui.fullNamePh}
                                  value={pf.fullName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPaxForms((prev) =>
                                      prev.map((p, i) => (i === idx ? { ...p, fullName: val } : p))
                                    );
                                  }}
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`pax-doc-${idx}`}
                                  className="uf-co-label"
                                >
                                  T.C. Kimlik No / Pasaport No *
                                </label>
                                <input
                                  id={`pax-doc-${idx}`}
                                  name={`paxDoc-${idx}`}
                                  required
                                  className="uf-co-input"
                                  placeholder="11 Haneli TCKN veya Pasaport No"
                                  value={pf.docNumber}
                                  onChange={(e) => {
                                    const val = e.target.value.toUpperCase();
                                    setPaxForms((prev) =>
                                      prev.map((p, i) => (i === idx ? { ...p, docNumber: val } : p))
                                    );
                                  }}
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`pax-birth-${idx}`}
                                  className="uf-co-label"
                                >
                                  Doğum Tarihi *
                                </label>
                                <input
                                  id={`pax-birth-${idx}`}
                                  name={`paxBirth-${idx}`}
                                  type="date"
                                  required
                                  className="uf-co-input"
                                  value={pf.birthDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPaxForms((prev) =>
                                      prev.map((p, i) => (i === idx ? { ...p, birthDate: val } : p))
                                    );
                                  }}
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`pax-nat-${idx}`}
                                  className="uf-co-label"
                                >
                                  Uyruk / Vatandaşlık
                                </label>
                                <select
                                  id={`pax-nat-${idx}`}
                                  name={`paxNat-${idx}`}
                                  className="uf-co-input"
                                  value={pf.nationality}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPaxForms((prev) =>
                                      prev.map((p, i) => (i === idx ? { ...p, nationality: val } : p))
                                    );
                                  }}
                                >
                                  <option value="Türkiye (TR)">Türkiye (TR)</option>
                                  <option value="Kazakistan (KZ)">Kazakistan (KZ)</option>
                                  <option value="Rusya (RU)">Rusya (RU)</option>
                                  <option value="Avrupa / Diğer">Avrupa / Diğer</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Contact & E-Ticket Delivery */}
                    <div className="uf-co-contact-block">
                      <h3 className="uf-co-subhead">İletişim &amp; E-Bilet Gönderim Bilgileri</h3>
                      <div className="uf-co-form-grid-2">
                        <div>
                          <label htmlFor="checkout-pax-email" className="uf-co-label">
                            {ui.emailLbl}
                          </label>
                          <input
                            id="checkout-pax-email"
                            name="passengerEmail"
                            autoComplete="email"
                            required
                            type="email"
                            className="uf-co-input"
                            placeholder="yolcu@flytoaspan.com"
                            value={passengerEmail}
                            onChange={(e) => setPassengerEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <label htmlFor="checkout-pax-phone" className="uf-co-label">
                            {ui.phoneLbl}
                          </label>
                          <input
                            id="checkout-pax-phone"
                            name="passengerPhone"
                            autoComplete="tel"
                            required
                            className="uf-co-input"
                            value={passengerPhone}
                            onChange={(e) => setPassengerPhone(e.target.value)}
                            placeholder="+90 5xx xxx xx xx"
                          />
                        </div>
                      </div>
                    </div>

                    {/* FlyToAspan Exclusive Protection & Comfort Add-ons */}
                    <div className="uf-co-addons-block">
                      <h3 className="uf-co-subhead">Seyahat Güvencesi &amp; VIP Hizmetler</h3>
                      <div className="uf-co-addons-grid">
                        <label className={`uf-co-addon-card ${addonCancelShield ? 'is-checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={addonCancelShield}
                            onChange={(e) => setAddonCancelShield(e.target.checked)}
                          />
                          <div className="uf-co-addon-body">
                            <div className="uf-co-addon-top">
                              <strong>Koşulsuz İptal &amp; İade Güvencesi</strong>
                              <span className="uf-co-addon-price">
                                +{formatPrice(240 * totalPax, currency)}
                              </span>
                            </div>
                            <p>
                              Uçuşa 2 saat kalaya kadar sebep belirtmeksizin %90 kesintisiz nakit iade hakkı sağlar.
                            </p>
                          </div>
                        </label>

                        <label className={`uf-co-addon-card ${addonAutoCheckin ? 'is-checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={addonAutoCheckin}
                            onChange={(e) => setAddonAutoCheckin(e.target.checked)}
                          />
                          <div className="uf-co-addon-body">
                            <div className="uf-co-addon-top">
                              <strong>Otomatik Check-In &amp; Koltuk Atama</strong>
                              <span className="uf-co-addon-price">
                                +{formatPrice(145 * totalPax, currency)}
                              </span>
                            </div>
                            <p>
                              Uçuşa 24 saat kala online check-in işleminiz otomatik yapılır ve biniş kartınız WhatsApp’a gönderilir.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Corporate E-Invoice Option */}
                    <div style={{ marginTop: 16 }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          fontWeight: 800,
                          color: 'var(--aspan-text)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={wantCorpInvoice}
                          onChange={(e) => setWantCorpInvoice(e.target.checked)}
                        />
                        <Building2 size={15} color="#0284C7" />
                        <span>Kurumsal E-Fatura İstiyorum (Şirket / Acente Faturası)</span>
                      </label>
                      {wantCorpInvoice && (
                        <div className="uf-co-form-grid-3" style={{ marginTop: 10 }}>
                          <input
                            id="inv-company"
                            name="invoiceCompany"
                            className="uf-co-input"
                            placeholder="Şirket Ünvanı *"
                            required={wantCorpInvoice}
                            value={invoiceCompany}
                            onChange={(e) => setInvoiceCompany(e.target.value)}
                          />
                          <input
                            id="inv-tax-office"
                            name="invoiceTaxOffice"
                            className="uf-co-input"
                            placeholder="Vergi Dairesi"
                            value={invoiceTaxOffice}
                            onChange={(e) => setInvoiceTaxOffice(e.target.value)}
                          />
                          <input
                            id="inv-tax-no"
                            name="invoiceTaxNo"
                            className="uf-co-input"
                            placeholder="Vergi Kimlik No *"
                            required={wantCorpInvoice}
                            value={invoiceTaxNo}
                            onChange={(e) => setInvoiceTaxNo(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ================= RIGHT COLUMN: STICKY 3D CARD PAYMENT & SUMMARY ================= */}
                <aside className="uf-checkout-aside">
                  <div className="uf-co-card uf-co-payment-card">
                    <div className="uf-co-card-head">
                      <div className="uf-co-icon-box">
                        <Lock size={18} />
                      </div>
                      <div>
                        <h2 className="uf-co-card-title">Kart bilgileri</h2>
                        <p className="uf-co-card-sub">
                          Ödemeniz 3D Secure ile bankanız tarafından doğrulanır.
                        </p>
                      </div>
                    </div>

                    {/* Visual 3D Dark-Navy & Gold Credit Card Preview */}
                    <div className="uf-cc-visual" aria-hidden="true">
                      <div className="uf-cc-top">
                        <div className="uf-cc-chip">
                          <span className="uf-cc-chip-line" />
                        </div>
                        <span className="uf-cc-brand">FLYTOASPAN 3D SECURE</span>
                      </div>
                      <div className="uf-cc-number">{formatCardDisplay(cardNumber)}</div>
                      <div className="uf-cc-bottom">
                        <div>
                          <div className="uf-cc-lbl">KART SAHİBİ</div>
                          <div className="uf-cc-val">{cardHolder.trim() || 'AD SOYAD'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="uf-cc-lbl">SKT</div>
                          <div className="uf-cc-val">{cardExpiry || 'AA/YY'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Card Input Fields */}
                    <div className="uf-cc-form">
                      <div>
                        <label htmlFor="cc-number" className="uf-co-label">
                          Kart numarası <span className="req-star">*</span>
                        </label>
                        <div className="uf-cc-input-wrap">
                          <CreditCard size={17} className="uf-cc-input-icon" />
                          <input
                            id="cc-number"
                            name="cardNumber"
                            inputMode="numeric"
                            autoComplete="cc-number"
                            className="uf-co-input with-icon"
                            placeholder="0000 0000 0000 0000"
                            value={cardNumber}
                            onChange={(e) => handleCardNumberChange(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="cc-holder" className="uf-co-label">
                          Kart üzerindeki isim <span className="req-star">*</span>
                        </label>
                        <input
                          id="cc-holder"
                          name="cardHolder"
                          autoComplete="cc-name"
                          className="uf-co-input"
                          placeholder="AD SOYAD"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                        />
                      </div>

                      <div className="uf-cc-split-row">
                        <div>
                          <label htmlFor="cc-expiry" className="uf-co-label">
                            Son kullanma <span className="req-star">*</span>
                          </label>
                          <input
                            id="cc-expiry"
                            name="cardExpiry"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            className="uf-co-input"
                            placeholder="AA/YY"
                            value={cardExpiry}
                            onChange={(e) => handleExpiryChange(e.target.value)}
                          />
                        </div>
                        <div>
                          <label htmlFor="cc-cvv" className="uf-co-label">
                            CVV <span className="req-star">*</span>
                          </label>
                          <input
                            id="cc-cvv"
                            name="cardCvv"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            maxLength={4}
                            className="uf-co-input"
                            placeholder="123"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          />
                          <span className="uf-cc-hint">Kartın arkasındaki 3 hane</span>
                        </div>
                      </div>

                      {/* Installment Options */}
                      <div>
                        <span className="uf-co-label">Taksit Seçeneği</span>
                        <div className="uf-cc-installments">
                          {([1, 3, 6, 9] as const).map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              className={`uf-inst-pill ${installmentCount === cnt ? 'active' : ''}`}
                              onClick={() => setInstallmentCount(cnt)}
                            >
                              {cnt === 1 ? 'Tek Çekim' : `${cnt} Taksit`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Collapsible Corporate / Promo Code Link (Görsel 4 Reference) */}
                      <div className="uf-cc-promo-wrap">
                        <button
                          type="button"
                          className="uf-cc-promo-link"
                          onClick={() => setShowPromoCodeBox((v) => !v)}
                        >
                          Kurumsal ödeme veya indirim kupon kodum var
                        </button>

                        {showPromoCodeBox && (
                          <div className="uf-cc-promo-box">
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                              {['ASPAN350', 'SKYALA18'].map((code) => (
                                <button
                                  key={code}
                                  type="button"
                                  className="uf-quick-pill"
                                  style={{ fontSize: 11, padding: '3px 9px' }}
                                  onClick={() => {
                                    setCouponInput(code);
                                    setAppliedCoupon(code);
                                  }}
                                >
                                  ⚡ {code}
                                </button>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                id="checkout-coupon-code"
                                name="couponCode"
                                className="uf-co-input"
                                style={{ height: 38, fontSize: 12.5 }}
                                placeholder="Kupon veya Kurumsal Kod"
                                value={couponInput}
                                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                              />
                              <button
                                type="button"
                                className="pkg-select-sky-btn"
                                style={{ width: 'auto', padding: '0 14px', height: 38 }}
                                onClick={() =>
                                  setAppliedCoupon(couponInput.trim().toUpperCase() || null)
                                }
                              >
                                Uygula
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Price Summary Breakdown */}
                      <div className="uf-co-price-summary">
                        <div className="uf-co-price-row">
                          <span>Uçuş &amp; Paket ({activePkg.name} × {totalPax})</span>
                          <strong>{formatPrice(rawBookingTotal, currency)}</strong>
                        </div>
                        {addonsTotalTRY > 0 && (
                          <div className="uf-co-price-row">
                            <span>Ek Güvence &amp; Hizmetler</span>
                            <strong>+{formatPrice(addonsTotalTRY, currency)}</strong>
                          </div>
                        )}
                        {discountTRY > 0 && (
                          <div className="uf-co-price-row discount">
                            <span>Kupon İndirimi ({appliedCoupon})</span>
                            <strong>−{formatPrice(discountTRY, currency)}</strong>
                          </div>
                        )}
                        <div className="uf-co-price-total">
                          <span>Toplam Ödenecek</span>
                          <strong>{formatPrice(bookingTotal, currency)}</strong>
                        </div>
                      </div>

                      <button type="submit" className="uf-cc-pay-btn">
                        <ShieldCheck size={18} />
                        <span>3D Secure ile Güvenli Öde ({formatPrice(bookingTotal, currency)})</span>
                      </button>

                      <div className="uf-cc-trust-foot">
                        <span>🔒 256-Bit SSL Şifreleme</span>
                        <span>•</span>
                        <span>IATA &amp; TÜRSAB Güvencesi</span>
                      </div>
                    </div>
                  </div>
                </aside>
              </form>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      {/* Compact Dark Route Header */}
      <div className="inner-hero">
        <div className="container">
          <button type="button" className="inner-back-btn" onClick={onBackHome}>
            <ArrowLeft size={15} />
            {ui.changeSearch}
          </button>
          <h1 className="inner-h1">
            {fromAirport.city} ({fromAirport.code}){' '}
            <Plane size={26} style={{ display: 'inline', verticalAlign: 'middle', color: '#F2C85C', margin: '0 8px' }} />{' '}
            {toAirport.city} ({toAirport.code})
          </h1>
          <div className="route-pills">
            <span className="route-pill">
              <Calendar size={14} color="#16CAD6" />
              {formatDisplayDate(query.departDate, lang)}
              {query.tripType === 'roundtrip' && query.returnDate
                ? ` → ${formatDisplayDate(query.returnDate, lang)}`
                : ''}
            </span>
            <span className="route-pill">
              <Users size={14} color="#16CAD6" />
              {totalPax} {ui.paxUnit.toLowerCase()}
            </span>
            <span className="route-pill">{query.cabin}</span>
            <span className="route-pill">
              {query.tripType === 'oneway' ? ui.oneWay : ui.roundTrip}
            </span>
            <span className="route-pill">{ui.sampleFares}</span>
          </div>
        </div>
      </div>

      {/* Results Workspace */}
      <section className="results-workspace">
        <div className="container">
          <div className="results-grid">
            {/* Left Sticky Filter Sidebar (Collapsible on Mobile) */}
            <aside className={`filter-card ${mobileFiltersOpen ? '' : 'mobile-collapsed'}`}>
              <div className="filter-head">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen((v) => !v)}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'var(--aspan-text)',
                    cursor: 'pointer',
                  }}
                >
                  <span>{ui.filters}</span>
                  <span
                    className="mobile-filter-toggle-btn"
                    style={{
                      display: 'none',
                      alignItems: 'center',
                      fontSize: 12,
                      color: 'var(--aspan-teal-deep)',
                      fontWeight: 700,
                    }}
                  >
                    {mobileFiltersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="mobile-filter-toggle-btn"
                    onClick={() => setMobileFiltersOpen((v) => !v)}
                    style={{
                      display: 'none',
                      border: '1px solid var(--aspan-border)',
                      background: 'var(--aspan-bg-soft)',
                      borderRadius: 999,
                      padding: '4px 11px',
                      color: 'var(--aspan-text)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {mobileFiltersOpen ? ui.hide : ui.show}
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--aspan-teal-deep)',
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: 'pointer',
                    }}
                  >
                    {ui.clear}
                  </button>
                </div>
              </div>

              <div className="filter-group">
                <div className="filter-label">{ui.stops}</div>
                {[
                  { val: 0, lbl: ui.nonStop },
                  { val: 1, lbl: ui.oneStop },
                ].map((opt) => (
                  <label key={opt.val} className="filter-check">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input
                        id={`stop-${opt.val}`}
                        name={`stop-${opt.val}`}
                        type="checkbox"
                        checked={stopFilters.includes(opt.val)}
                        onChange={() => toggleArr(stopFilters, opt.val, setStopFilters)}
                      />
                      {opt.lbl}
                    </span>
                    <span style={{ color: 'var(--aspan-text-muted)', fontSize: 12 }}>
                      {allFlights.filter((f) => f.stops === opt.val).length}
                    </span>
                  </label>
                ))}
              </div>

              <div className="filter-group">
                <div className="filter-label">{ui.depTime}</div>
                {[
                  { slot: 0, lbl: '00:00 – 06:00' },
                  { slot: 1, lbl: '06:00 – 12:00' },
                  { slot: 2, lbl: '12:00 – 18:00' },
                  { slot: 3, lbl: '18:00 – 24:00' },
                ].map((s) => (
                  <label key={s.slot} className="filter-check">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input
                        id={`slot-${s.slot}`}
                        name={`slot-${s.slot}`}
                        type="checkbox"
                        checked={depSlots.includes(s.slot)}
                        onChange={() => toggleArr(depSlots, s.slot, setDepSlots)}
                      />
                      {s.lbl}
                    </span>
                    <span style={{ color: 'var(--aspan-text-muted)', fontSize: 12 }}>
                      {allFlights.filter((f) => Math.floor(f.departMinutes / 360) === s.slot).length}
                    </span>
                  </label>
                ))}
              </div>

              <div className="filter-group">
                <div className="filter-label">{ui.maxPrice}</div>
                <input
                  id="max-price-range"
                  name="maxPrice"
                  type="range"
                  min={minAvailablePrice}
                  max={maxAvailablePrice}
                  disabled={allFlights.length === 0}
                  step={50}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#00A8B5' }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    fontWeight: 700,
                    marginTop: 6,
                  }}
                >
                  <span>{allFlights.length > 0 ? formatPrice(minAvailablePrice, currency) : '—'}</span>
                  <span style={{ color: 'var(--aspan-teal-deep)' }}>{formatPrice(maxPrice, currency)}</span>
                </div>
              </div>
            </aside>

            {/* Right Results Column */}
            <div>
              {isRoundTrip && (
                <section className="flight-leg-summary" aria-labelledby="flight-leg-title">
                  <div>
                    <h2 id="flight-leg-title">{outboundChoice ? ui.selectReturn : ui.selectOutbound}</h2>
                    <p>{outboundChoice
                      ? `${toAirport.code} → ${fromAirport.code} · ${formatDisplayDate(query.returnDate, lang)}`
                      : `${fromAirport.code} → ${toAirport.code} · ${formatDisplayDate(query.departDate, lang)}`}</p>
                    {outboundChoice && (
                      <p>
                        {ui.selectedOutbound} {outboundChoice.flight.flightNumber} · {outboundChoice.flight.departTime} ·{' '}
                        {outboundChoice.pkg.name} ·{' '}
                        {formatPrice((outboundChoice.flight.basePrice + outboundChoice.pkg.priceDelta) * totalPax, currency)}
                      </p>
                    )}
                  </div>
                  {outboundChoice && (
                    <button type="button" className="sort-pill-btn" onClick={() => changeLeg(null)}>
                      {ui.changeOutbound}
                    </button>
                  )}
                </section>
              )}
              <div className="sort-bar">
                <div className="sort-pills">
                  {(
                    [
                      ['cheapest', ui.sortCheapest],
                      ['fastest', ui.sortFastest],
                      ['earliestDep', ui.sortEarliestDep],
                      ['earliestArr', ui.sortEarliestArr],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`sort-pill-btn ${sortBy === key ? 'active' : ''}`}
                      onClick={() => setSortBy(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <strong style={{ fontSize: 13.5, color: 'var(--aspan-text-body)' }}>
                  {filtered.length} / {allFlights.length} {ui.flightsUnit}
                </strong>
              </div>

              {filtered.length === 0 ? (
                <div className="filter-card" style={{ textAlign: 'center', padding: 48 }}>
                  <strong>{allFlights.length === 0
                    ? ui.noConsecutiveTitle
                    : ui.noFilterTitle}</strong>
                  <p style={{ color: 'var(--aspan-text-muted)', fontSize: 13.5 }}>
                    {allFlights.length === 0
                      ? ui.noConsecutiveSub
                      : ui.noFilterSub}
                  </p>
                </div>
              ) : (
                filtered.map((flight) => {
                  const isCheapest = flight.id === cheapestId;
                  const isExpanded = expandedId === flight.id;
                  const totalBase = flight.basePrice * totalPax;

                  return (
                    <div
                      key={flight.id}
                      className={`flight-card ${isCheapest ? 'cheapest' : ''}`}
                    >
                      {isCheapest && <span className="flight-cheapest-badge">{ui.bestPriceBadge}</span>}

                      <div className="flight-main-row">
                        {/* 1. Airline */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            className="airline-avatar"
                            style={{ background: flight.airlineColor }}
                          >
                            {flight.airlineCode}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14.5 }}>{flight.airline}</div>
                            <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                              {flight.flightNumber} · {ui.seatsLeft(flight.seatsLeft)}
                            </div>
                          </div>
                        </div>

                        {/* 2. Departure */}
                        <div>
                          <div className="flight-time">{flight.departTime}</div>
                          <div className="flight-airport-sm">
                            {flight.fromCode} · {flight.fromCity}
                          </div>
                        </div>

                        {/* 3. Timeline */}
                        <div className="flight-timeline">
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--aspan-text-muted)' }}>
                            {flight.durationLabel}
                          </div>
                          <div className="flight-line-bar" />
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: flight.stops === 0 ? '#059669' : '#B8841E',
                            }}
                          >
                            {flight.stops === 0 ? ui.nonStop : `${ui.oneStop} (${flight.stopCity})`}
                          </div>
                        </div>

                        {/* 4. Arrival */}
                        <div>
                          <div className="flight-time">{flight.arriveTime}</div>
                          <div className="flight-airport-sm">
                            {flight.toCode} · {flight.toCity}
                            {flight.arrivalDate > flight.departureDate && ` · ${ui.nextDay}`}
                          </div>
                        </div>

                        {/* 5. Price & Expand Packages */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>
                            {ui.startingFrom}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--aspan-text)' }}>
                            {formatPrice(totalBase, currency)}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--aspan-text-muted)',
                              marginBottom: 8,
                            }}
                          >
                            {ui.paxTotal(totalPax)}
                          </div>
                          <button
                            type="button"
                            className={`deal-buy-btn pkg-toggle-btn ${isExpanded ? 'is-open' : ''}`}
                            style={{ padding: '10px 18px', fontSize: 13.5 }}
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedId(isExpanded ? null : flight.id)}
                          >
                            <span>{ui.packagesBtn}</span>
                            <ChevronDown
                              size={16}
                              className={`pkg-chevron-icon ${isExpanded ? 'is-open' : ''}`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Silky Animated Expandable Fare Package Drawer */}
                      <div
                        className={`packages-collapse-shell ${isExpanded ? 'is-open' : ''}`}
                        aria-hidden={!isExpanded}
                      >
                        <div className="packages-collapse-inner">
                          <div className="packages-drawer">
                            {flight.packages.map((pkg, pkgIdx) => {
                              const pkgTotal = (flight.basePrice + pkg.priceDelta) * totalPax;
                              return (
                                <div
                                  key={pkg.id}
                                  className={`pkg-card ${pkg.cabin === 'BUSINESS' ? 'is-business' : ''}`}
                                  style={{ '--pkg-idx': pkgIdx } as React.CSSProperties}
                                >
                                  <div>
                                    <div className="pkg-card-head">
                                      <strong className="pkg-card-title">{pkg.name}</strong>
                                      <span
                                        className={`pkg-pill ${pkg.cabin === 'BUSINESS' ? 'biz' : 'eco'}`}
                                      >
                                        {pkg.cabin}
                                      </span>
                                    </div>

                                    <div className="pkg-specs-list">
                                      <span className="pkg-spec-row">
                                        <Briefcase size={14} color="#0284C7" />
                                        <span>{pkg.cabinBag}</span>
                                      </span>
                                      <span className="pkg-spec-row">
                                        <Briefcase size={14} color="#D97706" />
                                        <span>{pkg.checkedBag}</span>
                                      </span>
                                      <span className="pkg-spec-row">• {pkg.meal}</span>
                                      <span className="pkg-spec-row">• {pkg.seat}</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <span className={`pkg-rule ${pkg.refundable ? 'ok' : 'no'}`}>
                                        {pkg.refundText}
                                      </span>
                                      <span className={`pkg-rule ${pkg.changeable ? 'ok' : 'no'}`}>
                                        {pkg.changeText}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="pkg-card-foot">
                                    <div className="pkg-card-price">
                                      {formatPrice(pkgTotal, currency)}
                                    </div>
                                    <div className="pkg-card-delta">
                                      {pkg.priceDelta === 0
                                        ? ui.mostEconomic
                                        : ui.vsCheapest(formatPrice(pkg.priceDelta * totalPax, currency))}
                                    </div>
                                    <button
                                      type="button"
                                      className="pkg-select-sky-btn"
                                      onClick={() => selectFare({ flight, pkg })}
                                    >
                                      {ui.selectPackage}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
