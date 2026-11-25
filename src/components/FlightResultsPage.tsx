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
  Tag,
  Sparkles,
  Check,
  UserCheck,
  Info,
  Share2,
  Zap,
  Award,
} from 'lucide-react';
import {
  AIRPORTS,
  DEFAULT_MARKUP,
  FarePackage,
  FlightResult,
  formatDisplayDate,
  formatPrice,
  generateFlights,
  getLiveRatesSnapshot,
} from '../data/mockData';
import { addCalendarDays, toCalendarDate } from '../data/calendarDates';
import { api, apiMessage, type AdminCatalog, type BookingDraft } from '../data/api';
import type { SavedPassengerRecord } from '../types';
import { openBrandedEticketPdf } from '../utils/eticketPdf';
import {
  AdminMarkupConfig,
  BookingRecord,
  CurrencyCode,
  FlightSearchQuery,
  LangCode,
} from '../types';

interface FlightResultsPageProps {
  lang?: LangCode;
  currency?: CurrencyCode;
  markup?: AdminMarkupConfig;
  manualFlights?: AdminCatalog['flights'];
  operatorRules?: AdminCatalog['operators'];
  query: FlightSearchQuery;
  onChangeQuery?: (next: FlightSearchQuery) => void;
  onBackHome: () => void;
  onAddBooking: (draft: BookingDraft) => Promise<BookingRecord>;
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
    sampleFares: 'Örnek uçuş fiyatları',
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
    completeBtn: 'Deneme rezervasyonunu kaydet',
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
    sampleFares: 'Sample flight prices',
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
    completeBtn: 'Save demo booking',
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
    sampleFares: 'Пример тарифов',
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
    seatsLeft: (n) => {
      const mod10 = n % 10;
      const mod100 = n % 100;
      const word = mod10 === 1 && mod100 !== 11
        ? 'место'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'места'
          : 'мест';
      return `Осталось ${n} ${word}`;
    },
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
    sampleFares: 'Үлгі ұшу бағалары',
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

const VALID_COUPONS = new Set(['ASPAN350', 'SKYALA18', 'VIP25', 'OTEL30']);

const CHECKOUT_I18N: Record<
  LangCode,
  {
    backToFlights: string;
    titleDone: string;
    titleForm: string;
    pnrLabel: string;
    lookupHint: string;
    backHome: string;
    selectedFlight: string;
    selectedFlightSub: string;
    outbound: string;
    inbound: string;
    nonStopDirect: string;
    oneStopVia: (city?: string) => string;
    economy: string;
    business: string;
    cabinShort: string;
    checkedShort: string;
    yourPackage: string;
    yourPackageSub: string;
    selectedBadge: string;
    bookingOwner: string;
    bookingOwnerSub: string;
    firstName: string;
    surname: string;
    nameRequiredErr: string;
    addonsTitle: string;
    cancelShieldTitle: string;
    cancelShieldSub: string;
    autoCheckinTitle: string;
    autoCheckinSub: string;
    priceSummary: string;
    usePromoCode: string;
    couponPh: string;
    apply: string;
    couponApplied: (code: string) => string;
    couponInvalid: string;
    flightAndPkg: string;
    adultRow: (n: number) => string;
    childRow: (n: number) => string;
    infantRow: (n: number) => string;
    addonsRow: string;
    couponRow: (code: string) => string;
    sampleTotal: string;
    saving: string;
  }
> = {
  TR: {
    backToFlights: 'Uçuş seçimine dön',
    titleDone: 'Deneme rezervasyonu kaydedildi',
    titleForm: 'Deneme rezervasyonu',
    pnrLabel: 'Rezervasyon kodu (PNR)',
    lookupHint: 'Bilet İşlemleri sayfasında bu kodu ve girdiğiniz soyadını kullanın.',
    backHome: 'Ana sayfaya dön',
    selectedFlight: 'Seçtiğiniz uçuş',
    selectedFlightSub: 'Bilgileri kontrol edin, hatalıysa geri dönebilirsiniz.',
    outbound: 'Gidiş',
    inbound: 'Dönüş',
    nonStopDirect: 'Aktarmasız direkt uçuş',
    oneStopVia: (city) => `1 Aktarma (${city || ''})`,
    economy: 'Ekonomi',
    business: 'Business',
    cabinShort: 'Kabin',
    checkedShort: 'Kayıtlı',
    yourPackage: 'Bilet paketiniz',
    yourPackageSub: 'Bagaj ve esneklik ihtiyacınıza göre paketi buradan değiştirebilirsiniz; fiyat anında güncellenir.',
    selectedBadge: 'Seçili',
    bookingOwner: 'Rezervasyon sahibi',
    bookingOwnerSub: 'Sorgulama sırasında burada yazdığınız soyadını kullanın.',
    firstName: 'Ad',
    surname: 'Soyadı',
    nameRequiredErr: 'Adınızı ve soyadınızı girin.',
    addonsTitle: 'Örnek ek hizmetler',
    cancelShieldTitle: 'Koşulsuz İptal & İade Güvencesi',
    cancelShieldSub: 'İptal güvencesinin örnek fiyata etkisini gösterir.',
    autoCheckinTitle: 'Otomatik Check-In & Koltuk Atama',
    autoCheckinSub: 'Otomatik check-in seçeneğinin örnek fiyatını gösterir.',
    priceSummary: 'Fiyat özeti',
    usePromoCode: 'İndirim kodu kullan',
    couponPh: 'Kupon kodu',
    apply: 'Uygula',
    couponApplied: (code) => `${code} kuponu uygulandı.`,
    couponInvalid: 'Geçersiz veya süresi dolmuş kupon kodu.',
    flightAndPkg: 'Uçuş ve paket',
    adultRow: (n) => `${n} Yetişkin (%100)`,
    childRow: (n) => `${n} Çocuk (%75)`,
    infantRow: (n) => `${n} Bebek (%10)`,
    addonsRow: 'Ek Güvence & Hizmetler',
    couponRow: (code) => `Kupon İndirimi (${code})`,
    sampleTotal: 'Örnek toplam',
    saving: 'Kaydediliyor…',
  },
  EN: {
    backToFlights: 'Back to flights',
    titleDone: 'Demo booking saved',
    titleForm: 'Demo booking',
    pnrLabel: 'Booking code (PNR)',
    lookupHint: 'Use this code and the surname you entered on the Manage Booking page.',
    backHome: 'Back to homepage',
    selectedFlight: 'Selected flight',
    selectedFlightSub: 'Review your flight details; you can go back if anything looks wrong.',
    outbound: 'Outbound',
    inbound: 'Return',
    nonStopDirect: 'Direct non-stop flight',
    oneStopVia: (city) => `1 Stop (${city || ''})`,
    economy: 'Economy',
    business: 'Business',
    cabinShort: 'Cabin',
    checkedShort: 'Checked',
    yourPackage: 'Your fare package',
    yourPackageSub: 'Switch your baggage and flexibility tier here; the price updates instantly.',
    selectedBadge: 'Selected',
    bookingOwner: 'Booking holder',
    bookingOwnerSub: 'Use this surname when looking up your booking.',
    firstName: 'First name',
    surname: 'Last name',
    nameRequiredErr: 'Please enter your first and last name.',
    addonsTitle: 'Sample add-on services',
    cancelShieldTitle: 'Unconditional Cancellation Shield',
    cancelShieldSub: 'Shows the sample price impact of cancellation protection.',
    autoCheckinTitle: 'Auto Check-In & Seat Assignment',
    autoCheckinSub: 'Shows the sample price of automatic check-in.',
    priceSummary: 'Price summary',
    usePromoCode: 'Use a promo code',
    couponPh: 'Promo code',
    apply: 'Apply',
    couponApplied: (code) => `Promo code ${code} applied.`,
    couponInvalid: 'Invalid or expired promo code.',
    flightAndPkg: 'Flight & package',
    adultRow: (n) => `${n} Adult(s) (100%)`,
    childRow: (n) => `${n} Child(ren) (75%)`,
    infantRow: (n) => `${n} Infant(s) (10%)`,
    addonsRow: 'Add-on Services',
    couponRow: (code) => `Promo Discount (${code})`,
    sampleTotal: 'Sample total',
    saving: 'Saving…',
  },
  RU: {
    backToFlights: 'Вернуться к выбору рейсов',
    titleDone: 'Пробное бронирование сохранено',
    titleForm: 'Пробное бронирование',
    pnrLabel: 'Код бронирования (PNR)',
    lookupHint: 'Используйте этот код и указанную фамилию на странице «Мои билеты».',
    backHome: 'На главную',
    selectedFlight: 'Выбранный рейс',
    selectedFlightSub: 'Проверьте данные перелёта; при необходимости можно вернуться назад.',
    outbound: 'Туда',
    inbound: 'Обратно',
    nonStopDirect: 'Прямой рейс без пересадок',
    oneStopVia: (city) => `1 пересадка (${city || ''})`,
    economy: 'Эконом',
    business: 'Бизнес',
    cabinShort: 'Руч. кладь',
    checkedShort: 'Багаж',
    yourPackage: 'Ваш тарифный пакет',
    yourPackageSub: 'Вы можете изменить багаж и гибкость тарифа прямо здесь — цена обновится сразу.',
    selectedBadge: 'Выбран',
    bookingOwner: 'Контактное лицо',
    bookingOwnerSub: 'Укажите эту фамилию при проверке бронирования.',
    firstName: 'Имя',
    surname: 'Фамилия',
    nameRequiredErr: 'Введите имя и фамилию.',
    addonsTitle: 'Примеры доп. услуг',
    cancelShieldTitle: 'Гарантия отмены и возврата',
    cancelShieldSub: 'Показывает влияние услуги защиты от отмены на примерную цену.',
    autoCheckinTitle: 'Авторегистрация и выбор места',
    autoCheckinSub: 'Показывает примерную стоимость авторегистрации.',
    priceSummary: 'Сводка по цене',
    usePromoCode: 'Использовать промокод',
    couponPh: 'Промокод',
    apply: 'Применить',
    couponApplied: (code) => `Промокод ${code} применён.`,
    couponInvalid: 'Недействительный или истёкший промокод.',
    flightAndPkg: 'Перелёт и тариф',
    adultRow: (n) => `${n} взр. (100%)`,
    childRow: (n) => `${n} реб. (75%)`,
    infantRow: (n) => `${n} мл. (10%)`,
    addonsRow: 'Доп. услуги',
    couponRow: (code) => `Скидка по промокоду (${code})`,
    sampleTotal: 'Примерная сумма',
    saving: 'Сохранение…',
  },
  KK: {
    backToFlights: 'Рейс таңдауға оралу',
    titleDone: 'Сынақ брондауы сақталды',
    titleForm: 'Сынақ брондауы',
    pnrLabel: 'Брондау коды (PNR)',
    lookupHint: '«Билеттер» бетінде осы код пен енгізген тегіңізді пайдаланыңыз.',
    backHome: 'Басты бетке оралу',
    selectedFlight: 'Таңдалған рейс',
    selectedFlightSub: 'Деректерді тексеріңіз, қате болса артқа қайта аласыз.',
    outbound: 'Бару',
    inbound: 'Қайту',
    nonStopDirect: 'Тікелей рейс',
    oneStopVia: (city) => `1 ауысып міну (${city || ''})`,
    economy: 'Эконом',
    business: 'Бизнес',
    cabinShort: 'Қол жүгі',
    checkedShort: 'Жолжүк',
    yourPackage: 'Билет пакетіңіз',
    yourPackageSub: 'Жолжүк пен икемділікке қарай пакетті осы жерден өзгерте аласыз; баға бірден жаңарады.',
    selectedBadge: 'Таңдалды',
    bookingOwner: 'Брондау иесі',
    bookingOwnerSub: 'Тексеру кезінде осында жазған тегіңізді қолданыңыз.',
    firstName: 'Аты',
    surname: 'Тегі',
    nameRequiredErr: 'Атыңыз бен тегіңізді енгізіңіз.',
    addonsTitle: 'Үлгі қосымша қызметтер',
    cancelShieldTitle: 'Шартсыз бас тарту және қайтару кепілдігі',
    cancelShieldSub: 'Бас тарту кепілдігінің үлгі бағаға әсерін көрсетеді.',
    autoCheckinTitle: 'Автоматты тіркелу және орын таңдау',
    autoCheckinSub: 'Автоматты тіркелудің үлгі бағасын көрсетеді.',
    priceSummary: 'Баға қорытындысы',
    usePromoCode: 'Жеңілдік кодын қолдану',
    couponPh: 'Купон коды',
    apply: 'Қолдану',
    couponApplied: (code) => `${code} купоны қолданылды.`,
    couponInvalid: 'Жарамсыз немесе мерзімі өткен купон коды.',
    flightAndPkg: 'Рейс және пакет',
    adultRow: (n) => `${n} Ересек (100%)`,
    childRow: (n) => `${n} Бала (75%)`,
    infantRow: (n) => `${n} Сәби (10%)`,
    addonsRow: 'Қосымша қызметтер',
    couponRow: (code) => `Купон жеңілдігі (${code})`,
    sampleTotal: 'Үлгі жиыны',
    saving: 'Сақталуда…',
  },
};

function canReturnAfter(outbound: FlightResult, inbound: FlightResult): boolean {
  return inbound.departureDate > outbound.arrivalDate ||
    (inbound.departureDate === outbound.arrivalDate && inbound.departMinutes > outbound.arriveMinutes);
}

function describeFare({ flight, pkg }: FlightSelection): string {
  return `${flight.airline} · ${flight.flightNumber} · ${pkg.name}`;
}

export const FlightResultsPage: React.FC<FlightResultsPageProps> = ({
  lang = 'TR',
  currency = 'TRY',
  markup = DEFAULT_MARKUP,
  manualFlights = [],
  operatorRules = [],
  query,
  onChangeQuery,
  onBackHome,
  onAddBooking,
}) => {
  const ui = FLIGHT_RESULTS_I18N[lang];
  const co = CHECKOUT_I18N[lang];
  const [loadingStep, setLoadingStep] = useState(0); // 0, 1, 2, then 3 = done
  const [sortBy, setSortBy] = useState<SortKey>('cheapest');
  const [stopFilters, setStopFilters] = useState<number[]>([]);
  const [depSlots, setDepSlots] = useState<number[]>([]);
  const [airlineFilters, setAirlineFilters] = useState<string[]>([]);
  const [baggageOnly, setBaggageOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [outboundChoice, setOutboundChoice] = useState<FlightSelection | null>(null);
  const [bookingChoice, setBookingChoice] = useState<FlightSelection | null>(null);
  const [bookingConfirmedPnr, setBookingConfirmedPnr] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);
  const [pnrCopied, setPnrCopied] = useState(false);
  const [savedPassengers, setSavedPassengers] = useState<SavedPassengerRecord[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    api.savedPassengers(controller.signal)
      .then(({ passengers }) => { if (!controller.signal.aborted) setSavedPassengers(passengers); })
      .catch(() => { /* guest user */ });
    return () => controller.abort();
  }, []);
  const [bookingError, setBookingError] = useState('');
  const [bookingPending, setBookingPending] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [showPromoCodeBox, setShowPromoCodeBox] = useState(false);
  const [addonCancelShield, setAddonCancelShield] = useState(false);
  const [addonAutoCheckin, setAddonAutoCheckin] = useState(false);

  const totalPax = query.adults + query.children + query.infants;
  const paxWeight = query.adults + query.children * 0.75 + query.infants * 0.1;
  const calcPaxFare = (unitTRY: number) => Math.round(unitTRY * paxWeight);
  const isRoundTrip = query.tripType === 'roundtrip';
  const outboundFlights = useMemo(() => {
    const generated = generateFlights(query.fromCode, query.toCode, query.departDate, query.cabin, lang, markup, currency);
    const fromObj = AIRPORTS.find((a) => a.code === query.fromCode);
    const toObj = AIRPORTS.find((a) => a.code === query.toCode);
    const eurRateToTRY = Math.round(1 / (getLiveRatesSnapshot().rates.EUR || 0.0181));
    const applyOperatorXmlMarkup = (baseTRY: number, operatorName: string): number => {
      const normOp = operatorName.toLowerCase();
      const rule = operatorRules.find(
        (r) =>
          r.active &&
          r.product.toLowerCase().includes('uçak') &&
          (normOp.includes(r.operator.toLowerCase().replace(/\s*\(xml\)/g, '').trim()) ||
            r.operator.toLowerCase().includes(normOp.replace(/\s*\(xml\)/g, '').trim()))
      );
      if (!rule || rule.markupType === 'NET' || rule.markupValue === 0) return baseTRY;
      if (rule.markupType === 'EUR') return baseTRY + Math.round(rule.markupValue * eurRateToTRY);
      if (rule.markupType === 'TRY') return baseTRY + rule.markupValue;
      if (rule.markupType === 'PERCENT') return Math.round(baseTRY * (1 + rule.markupValue / 100));
      return baseTRY;
    };
    const custom: FlightResult[] = manualFlights
      .filter((mf) => mf.active && mf.fromCode.toUpperCase() === query.fromCode.toUpperCase() && mf.toCode.toUpperCase() === query.toCode.toUpperCase())
      .map((mf) => {
        const [dh = '10', dm = '00'] = mf.departTime.split(':');
        const [ah = '14', am = '00'] = mf.arriveTime.split(':');
        const depMins = Number(dh) * 60 + Number(dm);
        const arrMins = Number(ah) * 60 + Number(am);
        const durMins = arrMins > depMins ? arrMins - depMins : (24 * 60 - depMins + arrMins);
        const nextDay = arrMins < depMins ? 1 : 0;
        const xmlAdjustedPrice = applyOperatorXmlMarkup(mf.priceTRY, mf.operator);
        return {
          id: `manual-${mf.id}`,
          airline: `${mf.airline} (${mf.operator})`,
          airlineCode: mf.airlineCode.toUpperCase(),
          airlineColor: '#00A8B5',
          flightNumber: mf.flightNumber.toUpperCase(),
          fromCode: mf.fromCode.toUpperCase(),
          fromCity: fromObj?.city || mf.fromCode.toUpperCase(),
          toCode: mf.toCode.toUpperCase(),
          toCity: toObj?.city || mf.toCode.toUpperCase(),
          departureDate: query.departDate,
          arrivalDate: addCalendarDays(query.departDate, nextDay),
          departTime: mf.departTime,
          arriveTime: mf.arriveTime,
          departMinutes: depMins,
          arriveMinutes: arrMins,
          durationMinutes: durMins,
          durationLabel: mf.duration || `${Math.floor(durMins / 60)}sa ${durMins % 60}dk`,
          stops: 0,
          seatsLeft: mf.quota,
          basePrice: xmlAdjustedPrice,
          packages: [
            {
              id: `man-eco-${mf.id}`,
              name: `${mf.operator} Blok Koltuk`,
              cabin: 'ECONOMY',
              priceDelta: 0,
              cabinBag: '8 kg kabin bagajı',
              checkedBag: mf.baggage || '20 kg bagaj',
              refundable: false,
              refundText: 'Operatör kuralları',
              changeable: true,
              changeText: 'Operatör koşullarına göre',
              meal: 'Standart ikram',
              seat: 'Standart koltuk',
            },
          ],
        };
      });
    return [...custom, ...generated];
  }, [query.fromCode, query.toCode, query.departDate, query.cabin, lang, markup, currency, manualFlights, operatorRules]);
  const inboundFlights = useMemo(
    () =>
      isRoundTrip
        ? generateFlights(query.toCode, query.fromCode, query.returnDate, query.cabin, lang, markup, currency)
        : [],
    [isRoundTrip, query.toCode, query.fromCode, query.returnDate, query.cabin, lang, markup, currency]
  );
  const allFlights = useMemo(() => {
    if (!isRoundTrip) return outboundFlights;
    if (outboundChoice) return inboundFlights.filter((inbound) => canReturnAfter(outboundChoice.flight, inbound));
    return outboundFlights.filter((outbound) => inboundFlights.some((inbound) => canReturnAfter(outbound, inbound)));
  }, [isRoundTrip, outboundChoice, outboundFlights, inboundFlights]);

  const maxAvailablePrice = useMemo(
    () => (allFlights.length > 0 ? Math.ceil(Math.max(...allFlights.map((f) => f.basePrice)) / 50) * 50 : 10000),
    [allFlights]
  );
  const minAvailablePrice = allFlights.length > 0
    ? Math.floor(Math.min(maxAvailablePrice, ...allFlights.map((flight) => flight.basePrice)) / 50) * 50
    : 0;
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
  const unitLegTotal = bookingLegs.reduce((total, { flight, pkg }) => total + flight.basePrice + pkg.priceDelta, 0);
  const adultSubtotalTRY = Math.round(unitLegTotal * query.adults);
  const childSubtotalTRY = Math.round(unitLegTotal * query.children * 0.75);
  const infantSubtotalTRY = Math.round(unitLegTotal * query.infants * 0.1);
  const rawBookingTotal = adultSubtotalTRY + childSubtotalTRY + infantSubtotalTRY;
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

  const availableAirlines = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>();
    for (const f of allFlights) {
      const existing = map.get(f.airlineCode);
      if (existing) existing.count += 1;
      else map.set(f.airlineCode, { code: f.airlineCode, name: f.airline, count: 1 });
    }
    return Array.from(map.values());
  }, [allFlights]);

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
    if (airlineFilters.length > 0) {
      list = list.filter((f) => airlineFilters.includes(f.airlineCode));
    }
    if (baggageOnly) {
      list = list.filter((f) => f.packages.some((p) => !p.checkedBag.startsWith('0')));
    }
    const sorted = [...list];
    if (sortBy === 'cheapest') sorted.sort((a, b) => a.basePrice - b.basePrice);
    else if (sortBy === 'fastest') sorted.sort((a, b) => a.durationMinutes - b.durationMinutes);
    else if (sortBy === 'earliestDep') sorted.sort((a, b) => a.departMinutes - b.departMinutes);
    else sorted.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate) || a.arriveMinutes - b.arriveMinutes);
    return sorted;
  }, [allFlights, maxPrice, stopFilters, depSlots, airlineFilters, baggageOnly, sortBy]);

  const cheapestId = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((best, cur) => (cur.basePrice < best.basePrice ? cur : best), filtered[0])
      .id;
  }, [filtered]);

  const fastestFlight = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((best, cur) => (cur.durationMinutes < best.durationMinutes ? cur : best), filtered[0]);
  }, [filtered]);

  const cheapestFlight = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((best, cur) => (cur.basePrice < best.basePrice ? cur : best), filtered[0]);
  }, [filtered]);

  const earliestFlight = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((best, cur) => (cur.departMinutes < best.departMinutes ? cur : best), filtered[0]);
  }, [filtered]);

  const flexDates = useMemo(() => {
    const todayIso = toCalendarDate(new Date());
    const activeIso = outboundChoice && isRoundTrip ? query.returnDate : query.departDate;
    const minIso = outboundChoice && isRoundTrip ? query.departDate : todayIso;
    const baseMinPrice = allFlights.length > 0 ? Math.min(...allFlights.map((f) => f.basePrice)) : 1650;
    const offsets = [-3, -2, -1, 0, 1, 2, 3];
    return offsets.map((off) => {
      const iso = addCalendarDays(activeIso, off);
      const disabled = iso < minIso;
      const dayNum = Number(iso.slice(-2)) || 1;
      const factor = off === 0 ? 1 : 0.92 + ((dayNum * 7 + Math.abs(off) * 3) % 19) * 0.012;
      const price = Math.round((baseMinPrice * factor) / 10) * 10;
      return { iso, disabled, price, active: iso === activeIso };
    });
  }, [allFlights, isRoundTrip, outboundChoice, query.departDate, query.returnDate]);

  const minFlexPrice = useMemo(() => {
    const valid = flexDates.filter((d) => !d.disabled);
    return valid.length ? Math.min(...valid.map((d) => d.price)) : 0;
  }, [flexDates]);

  const toggleArr = (arr: number[], val: number, setter: React.Dispatch<React.SetStateAction<number[]>>) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const resetFilters = () => {
    setStopFilters([]);
    setDepSlots([]);
    setAirlineFilters([]);
    setBaggageOnly(false);
    setMaxPrice(maxAvailablePrice);
  };

  const changeLeg = (outbound: FlightSelection | null) => {
    resetFilters();
    setExpandedId(null);
    setOutboundChoice(outbound);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [checkoutIdemKey, setCheckoutIdemKey] = useState<string>(() => crypto.randomUUID());

  const selectFare = (selection: FlightSelection) => {
    if (isRoundTrip && !outboundChoice) {
      changeLeg(selection);
      return;
    }

    setCheckoutIdemKey(crypto.randomUUID());
    setBookingConfirmedPnr(null);
    setBookingError('');
    setBookingChoice(selection);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loadingStep < 3) {
    const steps = ui.steps;
    const pct = loadingStep === 0 ? 34 : loadingStep === 1 ? 71 : 96;
    const currentStepText = steps[Math.min(loadingStep, steps.length - 1)];
    return (
      <div className="loading-screen">
        <div className="gds-luxury-loader">
          <div className="gds-lux-head">
            <span className="gds-lux-eyebrow">
              <Sparkles size={13} />
              FLYTOASPAN LIVE FLIGHT ENGINE
            </span>
            <span className="gds-lux-pct">{pct}%</span>
          </div>

          <div className="gds-lux-route">
            <div className="gds-lux-node">
              <span className="gds-lux-code">{fromAirport.code}</span>
              <span className="gds-lux-city">{fromAirport.city}</span>
            </div>

            <div className="gds-lux-arc-wrap">
              <div className="gds-lux-track">
                <div className="gds-lux-track-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="gds-lux-plane" style={{ left: `${pct}%` }}>
                <Plane size={19} />
              </div>
            </div>

            <div className="gds-lux-node is-right">
              <span className="gds-lux-code">{toAirport.code}</span>
              <span className="gds-lux-city">{toAirport.city}</span>
            </div>
          </div>

          <div className="gds-lux-meta">
            <span>{formatDisplayDate(query.departDate, lang)}{isRoundTrip && query.returnDate ? ` → ${formatDisplayDate(query.returnDate, lang)}` : ''}</span>
            <span>•</span>
            <span>{totalPax} {ui.paxUnit}</span>
            <span>•</span>
            <span>{query.cabin === 'Business' ? co.business : co.economy}</span>
          </div>

          <div className="gds-lux-ticker">
            <Loader2 size={16} className="spin-icon" />
            <span>{currentStepText.replace(/^\d+\.\s*/, '')}</span>
          </div>

          <div className="gds-lux-carriers">
            {['Turkish Airlines', 'Air Astana', 'Pegasus', 'AJet', 'Lufthansa', 'Emirates'].map((air) => (
              <span key={air} className="gds-lux-carrier">{air}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (bookingChoice) {
    const activeFlight = bookingChoice.flight;

    const paxSlots = [
      ...Array.from({ length: query.adults }, (_, i) => ({
        key: `adult-${i}`,
        label: lang === 'EN' ? 'Adult' : lang === 'RU' ? 'Взрослый' : lang === 'KK' ? 'Ересек' : 'Yetişkin',
      })),
      ...Array.from({ length: query.children }, (_, i) => ({
        key: `child-${i}`,
        label: lang === 'EN' ? 'Child (2–11)' : lang === 'RU' ? 'Ребёнок (2–11)' : lang === 'KK' ? 'Бала (2–11)' : 'Çocuk (2–11 Yaş)',
      })),
      ...Array.from({ length: query.infants }, (_, i) => ({
        key: `infant-${i}`,
        label: lang === 'EN' ? 'Infant (0–2)' : lang === 'RU' ? 'Младенец (0–2)' : lang === 'KK' ? 'Сәби (0–2)' : 'Bebek (0–2 Yaş)',
      })),
    ];

    const submitBooking = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (bookingPending) return;
      const fields = new FormData(event.currentTarget);
      const firstName = String(fields.get('firstName_0') || '').trim();
      const lookupSurname = String(fields.get('surname_0') || '').trim();
      if (!firstName || !lookupSurname) {
        setBookingError(co.nameRequiredErr);
        return;
      }
      setBookingPending(true);
      setBookingError('');
      try {
        const firstLeg = bookingLegs[0];
        const booking = await onAddBooking({
          type: 'Uçak',
          title: bookingTitle,
          subtitle: bookingLegs.map(describeFare).join(' / '),
          date: query.departDate,
          returnDate: isRoundTrip ? query.returnDate : undefined,
          passenger: paxSlots.length > 1
            ? `${firstName} ${lookupSurname} (+${paxSlots.length - 1})`
            : `${firstName} ${lookupSurname}`,
          lookupSurname,
          price: bookingTotal,
          departTime: firstLeg?.flight.departTime,
          arriveTime: firstLeg?.flight.arriveTime,
          flightNumber: firstLeg?.flight.flightNumber,
          airline: firstLeg?.flight.airline,
          baggage: firstLeg ? `${firstLeg.pkg.cabinBag} + ${firstLeg.pkg.checkedBag}` : undefined,
          cabin: firstLeg?.pkg.cabin === 'BUSINESS' ? 'Business Class' : 'Ekonomi',
          duration: firstLeg?.flight.durationLabel,
          idempotencyKey: checkoutIdemKey,
        });
        setConfirmedBooking(booking);
        setBookingConfirmedPnr(booking.pnr);
        setPnrCopied(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        setBookingError(apiMessage(error));
      } finally {
        setBookingPending(false);
      }
    };

    const applyCoupon = (raw: string) => {
      const code = raw.trim().toUpperCase();
      if (!code) {
        setAppliedCoupon(null);
        setCouponError('');
        return;
      }
      if (VALID_COUPONS.has(code)) {
        setAppliedCoupon(code);
        setCouponError('');
      } else {
        setAppliedCoupon(null);
        setCouponError(co.couponInvalid);
      }
    };

    const switchLegPackage = (legIdx: number, pkg: FarePackage) => {
      if (outboundChoice && legIdx === 0) {
        setOutboundChoice({ flight: outboundChoice.flight, pkg });
      } else {
        setBookingChoice({ flight: activeFlight, pkg });
      }
    };

    return (
      <div className="uf-checkout-page">
        <div className="uf-checkout-hero">
          <div className="container">
            <button
              type="button"
              className="uf-checkout-back"
              disabled={bookingPending}
              onClick={() => {
                setBookingChoice(null);
                setBookingConfirmedPnr(null);
                setBookingError('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowLeft size={15} />
              {co.backToFlights}
            </button>
            <h1 className="uf-checkout-h1">{bookingConfirmedPnr ? co.titleDone : co.titleForm}</h1>
          </div>
        </div>
        <section className="uf-checkout-workspace">
          <div className="container">
            {bookingConfirmedPnr ? (
              <div className="uf-co-card" role="status">
                <h2 className="uf-co-card-title">{bookingTitle}</h2>
                <p className="uf-co-card-sub">{ui.demoNote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
                  <span>{co.pnrLabel} <strong style={{ fontSize: 18, letterSpacing: 1.5 }}>{bookingConfirmedPnr}</strong></span>
                  <button
                    type="button"
                    className="uf-quick-pill"
                    onClick={() => {
                      void navigator.clipboard?.writeText(bookingConfirmedPnr);
                      setPnrCopied(true);
                    }}
                  >
                    {pnrCopied ? '✓ Kopyalandı' : 'PNR Kopyala'}
                  </button>
                </div>
                <p>{co.lookupHint}</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                  {confirmedBooking && (
                    <button
                      type="button"
                      className="btn-gold-nav"
                      onClick={() => openBrandedEticketPdf(confirmedBooking, { currency, lang })}
                    >
                      📄 PDF E-Bilet / Voucher İndir
                    </button>
                  )}
                  <button type="button" className="uf-quick-pill" onClick={onBackHome}>{co.backHome}</button>
                </div>
              </div>
            ) : (
              <form className="uf-checkout-grid" onSubmit={submitBooking}>
                <div className="uf-checkout-main">
                  <div className="uf-co-card">
                    <div className="uf-co-card-head">
                      <div className="uf-co-icon-box">
                        <Plane size={19} />
                      </div>
                      <div>
                        <h2 className="uf-co-card-title">{co.selectedFlight}</h2>
                        <p className="uf-co-card-sub">
                          {co.selectedFlightSub}
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
                              {legIdx === 0 ? co.outbound : co.inbound}
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
                                ? co.nonStopDirect
                                : co.oneStopVia(flight.stopCity)}
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
                            {pkg.cabin === 'BUSINESS' ? co.business : co.economy}
                          </span>
                          <span className="uf-co-chip gold">
                            <Tag size={12} />
                            {pkg.name}
                          </span>
                          <span className="uf-co-chip">
                            <Briefcase size={12} />
                            {co.cabinShort}: {pkg.cabinBag}
                          </span>
                          <span className="uf-co-chip">
                            <Briefcase size={12} />
                            {co.checkedShort}: {pkg.checkedBag}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="uf-co-card">
                    <div className="uf-co-card-head">
                      <div className="uf-co-icon-box">
                        <Tag size={18} />
                      </div>
                      <div>
                        <h2 className="uf-co-card-title">{co.yourPackage}</h2>
                        <p className="uf-co-card-sub">
                          {co.yourPackageSub}
                        </p>
                      </div>
                    </div>

                    {bookingLegs.map(({ flight: legFlight, pkg: legPkg }, legIdx) => (
                      <div key={`pkg-switch-${legFlight.id}`} style={{ marginTop: legIdx > 0 ? 18 : 0 }}>
                        {bookingLegs.length > 1 && (
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--aspan-text-body)', marginBottom: 8 }}>
                            {legIdx === 0 ? co.outbound : co.inbound} · {legFlight.fromCode} → {legFlight.toCode} ({legFlight.flightNumber})
                          </div>
                        )}
                        <div className="uf-co-pkg-grid">
                          {legFlight.packages.map((p) => {
                            const isSelected = p.id === legPkg.id;
                            const pTotal = calcPaxFare(legFlight.basePrice + p.priceDelta);
                            const diffFromBase = calcPaxFare(p.priceDelta);

                            return (
                              <button
                                key={p.id}
                                type="button"
                                className={`uf-co-pkg-option ${isSelected ? 'is-selected' : ''}`}
                                onClick={() => switchLegPackage(legIdx, p)}
                              >
                                <div className="uf-co-pkg-top">
                                  <strong className="uf-co-pkg-name">{p.name}</strong>
                                  {isSelected ? (
                                    <span className="uf-co-pkg-state selected">
                                      <CheckCircle2 size={12} /> {co.selectedBadge}
                                    </span>
                                  ) : (
                                    <span className="uf-co-pkg-state delta">
                                      +{formatPrice(diffFromBase, currency)}
                                    </span>
                                  )}
                                </div>

                                <div className="uf-co-pkg-tags">
                                  <span className="uf-co-mini-tag">
                                    {p.cabin === 'BUSINESS' ? co.business : co.economy}
                                  </span>
                                  <span className="uf-co-mini-tag">{p.cabinBag}</span>
                                  <span className="uf-co-mini-tag">{p.checkedBag}</span>
                                  <span className="uf-co-mini-tag">{p.refundText}</span>
                                </div>

                                <div className="uf-co-pkg-price">{formatPrice(pTotal, currency)}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="uf-co-card">
                    <div className="uf-co-card-head">
                      <div className="uf-co-icon-box"><UserCheck size={19} /></div>
                      <div>
                        <h2 className="uf-co-card-title">{co.bookingOwner}</h2>
                        <p className="uf-co-card-sub">{co.bookingOwnerSub}</p>
                      </div>
                    </div>

                    {savedPassengers.length > 0 && (
                      <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#047857', marginBottom: 6 }}>
                          ⚡ Kayıtlı Yolcudan 1 Tıkla Doldur:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {savedPassengers.map((sp) => (
                            <button
                              key={sp.id}
                              type="button"
                              className="uf-quick-pill"
                              onClick={() => {
                                const parts = sp.fullName.trim().split(/\s+/);
                                const last = parts.length > 1 ? parts.pop()! : '';
                                const first = parts.join(' ');
                                const setVal = (name: string, val: string) => {
                                  const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
                                  if (el && val) el.value = val;
                                };
                                setVal('firstName_0', first);
                                setVal('surname_0', last);
                                setVal('docNo_0', sp.tcOrPassport);
                                setVal('birthDate_0', sp.birthDate);
                                if (sp.phone) setVal('contactPhone', sp.phone);
                              }}
                            >
                              {sp.fullName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="uf-co-pax-list">
                      {paxSlots.map((slot, idx) => (
                        <div key={slot.key} className="uf-co-pax-box">
                          <div className="uf-co-pax-box-head">
                            <span className="uf-co-pax-badge">
                              {idx + 1}. {ui.paxUnit} ({slot.label})
                            </span>
                            <div style={{ display: 'inline-flex', gap: 10, fontSize: 12.5, fontWeight: 700 }}>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                <input type="radio" name={`gender_${idx}`} value="M" defaultChecked />
                                {lang === 'EN' ? 'Male' : lang === 'RU' ? 'Муж' : lang === 'KK' ? 'Ер' : 'Erkek'}
                              </label>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                <input type="radio" name={`gender_${idx}`} value="F" />
                                {lang === 'EN' ? 'Female' : lang === 'RU' ? 'Жен' : lang === 'KK' ? 'Әйел' : 'Kadın'}
                              </label>
                            </div>
                          </div>

                          <div className="uf-co-form-grid-2">
                            <label className="uf-co-label">{co.firstName} *
                              <input name={`firstName_${idx}`} autoComplete="given-name" className="uf-co-input" required maxLength={64} />
                            </label>
                            <label className="uf-co-label">{co.surname} *
                              <input name={`surname_${idx}`} autoComplete="family-name" className="uf-co-input" required maxLength={64} />
                            </label>
                            <label className="uf-co-label">
                              {lang === 'EN' ? 'ID / Passport No *' : lang === 'RU' ? 'Паспорт / ИИН *' : lang === 'KK' ? 'Төлқұжат / ЖСН *' : 'T.C. Kimlik / Pasaport No *'}
                              <input name={`doc_${idx}`} className="uf-co-input" required maxLength={24} placeholder="TCKN / Pasaport" />
                            </label>
                            <label className="uf-co-label">
                              {lang === 'EN' ? 'Date of Birth *' : lang === 'RU' ? 'Дата рождения *' : lang === 'KK' ? 'Туған күні *' : 'Doğum Tarihi *'}
                              <input name={`dob_${idx}`} type="date" className="uf-co-input" required />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="uf-co-contact-block" style={{ marginTop: 18 }}>
                      <h3 className="uf-co-subhead">
                        {lang === 'EN' ? 'Contact & E-Ticket Delivery' : lang === 'RU' ? 'Контакты для билета' : lang === 'KK' ? 'Байланыс және E-Билет' : 'İletişim & Bilet Bildirim Bilgileri'}
                      </h3>
                      <div className="uf-co-form-grid-2">
                        <label className="uf-co-label">{ui.emailLbl}
                          <input name="contactEmail" type="email" autoComplete="email" className="uf-co-input" required placeholder="ornek@eposta.com" />
                        </label>
                        <label className="uf-co-label">{ui.phoneLbl}
                          <input name="contactPhone" type="tel" autoComplete="tel" className="uf-co-input" required placeholder="+90 5xx xxx xx xx" />
                        </label>
                      </div>
                    </div>
                    <div className="uf-co-addons-block">
                      <h3 className="uf-co-subhead">{co.addonsTitle}</h3>
                      <div className="uf-co-addons-grid">
                        <label className={`uf-co-addon-card ${addonCancelShield ? 'is-checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={addonCancelShield}
                            onChange={(e) => setAddonCancelShield(e.target.checked)}
                          />
                          <div className="uf-co-addon-body">
                            <div className="uf-co-addon-top">
                              <strong>{co.cancelShieldTitle}</strong>
                              <span className="uf-co-addon-price">
                                +{formatPrice(240 * totalPax, currency)}
                              </span>
                            </div>
                            <p>{co.cancelShieldSub}</p>
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
                              <strong>{co.autoCheckinTitle}</strong>
                              <span className="uf-co-addon-price">
                                +{formatPrice(145 * totalPax, currency)}
                              </span>
                            </div>
                            <p>{co.autoCheckinSub}</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <aside className="uf-checkout-aside">
                  <div className="uf-co-card">
                    <h2 className="uf-co-card-title">{co.priceSummary}</h2>
                    <p className="uf-co-card-sub">{ui.demoNote}</p>
                      <div className="uf-cc-promo-wrap">
                        <button
                          type="button"
                          className="uf-cc-promo-link"
                          onClick={() => setShowPromoCodeBox((v) => !v)}
                        >
                          {co.usePromoCode}
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
                                    applyCoupon(code);
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
                                placeholder={co.couponPh}
                                value={couponInput}
                                onChange={(e) => {
                                  setCouponInput(e.target.value.toUpperCase());
                                  if (couponError) setCouponError('');
                                }}
                              />
                              <button
                                type="button"
                                className="pkg-select-sky-btn"
                                style={{ width: 'auto', padding: '0 14px', height: 38 }}
                                onClick={() => applyCoupon(couponInput)}
                              >
                                {co.apply}
                              </button>
                            </div>
                            {couponError && (
                              <div role="alert" style={{ marginTop: 7, fontSize: 12, fontWeight: 700, color: '#be123c' }}>
                                {couponError}
                              </div>
                            )}
                            {appliedCoupon && !couponError && (
                              <div role="status" style={{ marginTop: 7, fontSize: 12, fontWeight: 700, color: '#047857' }}>
                                ✓ {co.couponApplied(appliedCoupon)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Price Summary Breakdown */}
                      <div className="uf-co-price-summary">
                        <div className="uf-co-price-row">
                          <span>{co.adultRow(query.adults)}</span>
                          <strong>{formatPrice(adultSubtotalTRY, currency)}</strong>
                        </div>
                        {query.children > 0 && (
                          <div className="uf-co-price-row">
                            <span>{co.childRow(query.children)}</span>
                            <strong>{formatPrice(childSubtotalTRY, currency)}</strong>
                          </div>
                        )}
                        {query.infants > 0 && (
                          <div className="uf-co-price-row">
                            <span>{co.infantRow(query.infants)}</span>
                            <strong>{formatPrice(infantSubtotalTRY, currency)}</strong>
                          </div>
                        )}
                        {addonsTotalTRY > 0 && (
                          <div className="uf-co-price-row">
                            <span>{co.addonsRow}</span>
                            <strong>+{formatPrice(addonsTotalTRY, currency)}</strong>
                          </div>
                        )}
                        {discountTRY > 0 && (
                          <div className="uf-co-price-row discount">
                            <span>{co.couponRow(appliedCoupon || '')}</span>
                            <strong>−{formatPrice(discountTRY, currency)}</strong>
                          </div>
                        )}
                        <div className="uf-co-price-total">
                          <span>{co.sampleTotal}</span>
                          <strong>{formatPrice(bookingTotal, currency)}</strong>
                        </div>
                      </div>
                    {bookingError && <p className="form-action-error" role="alert">{bookingError}</p>}
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--aspan-text-muted)', marginBottom: 12, cursor: 'pointer' }}>
                      <input type="checkbox" required defaultChecked style={{ marginTop: 2 }} />
                      <span>Kullanım Koşulları, Havayolu Taşıma Kuralları ve KVKK Aydınlatma Metni’ni onaylıyorum.</span>
                    </label>
                    <button type="submit" className="uf-cc-pay-btn" disabled={bookingPending}>
                      <Check size={18} />
                      {bookingPending ? co.saving : ui.completeBtn}
                    </button>
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
            <span className="route-pill">{query.cabin === 'Business' ? co.business : co.economy}</span>
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

              {availableAirlines.length > 1 && (
                <div className="filter-group">
                  <div className="filter-label">
                    {lang === 'EN' ? 'Airlines' : lang === 'RU' ? 'Авиакомпании' : lang === 'KK' ? 'Әуе компаниялары' : 'Havayolları'}
                  </div>
                  {availableAirlines.map((air) => (
                    <label key={air.code} className="filter-check">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={airlineFilters.includes(air.code)}
                          onChange={() =>
                            setAirlineFilters((prev) =>
                              prev.includes(air.code) ? prev.filter((c) => c !== air.code) : [...prev, air.code]
                            )
                          }
                        />
                        {air.name}
                      </span>
                      <span style={{ color: 'var(--aspan-text-muted)', fontSize: 12 }}>{air.count}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="filter-group">
                <label className="filter-check" style={{ marginBottom: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={baggageOnly}
                      onChange={(e) => setBaggageOnly(e.target.checked)}
                    />
                    {lang === 'EN' ? 'Checked baggage included' : lang === 'RU' ? 'С багажом' : lang === 'KK' ? 'Жолжүк кіреді' : 'Kayıtlı bagaj dahil'}
                  </span>
                </label>
              </div>
            </aside>

            {/* Right Results Column */}
            <div>
              {/* ±3 Day Flexible Price Calendar Strip */}
              {onChangeQuery && (
                <div className="flex-price-strip" role="region" aria-label="Esnek tarih fiyatları">
                  {flexDates.map((d) => {
                    const isLowest = !d.disabled && d.price === minFlexPrice;
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        disabled={d.disabled}
                        className={`flex-day-btn ${d.active ? 'is-active' : ''} ${isLowest ? 'is-lowest' : ''}`}
                        onClick={() => {
                          if (outboundChoice && isRoundTrip) {
                            onChangeQuery({ ...query, returnDate: d.iso });
                          } else {
                            const nextRet =
                              isRoundTrip && query.returnDate < d.iso
                                ? addCalendarDays(d.iso, 7)
                                : query.returnDate;
                            onChangeQuery({ ...query, departDate: d.iso, returnDate: nextRet });
                          }
                        }}
                      >
                        <span className="flex-day-date">{formatDisplayDate(d.iso, lang)}</span>
                        <strong className="flex-day-price">
                          {d.disabled ? '—' : formatPrice(calcPaxFare(d.price), currency)}
                        </strong>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Smart 3-Way Summary Strip (Cheapest / Fastest / Earliest) */}
              {cheapestFlight && fastestFlight && (
                <div className="smart-decision-bar">
                  <button
                    type="button"
                    className={`smart-decision-card ${sortBy === 'cheapest' ? 'is-active' : ''}`}
                    onClick={() => setSortBy('cheapest')}
                  >
                    <span className="smart-decision-lbl"><Award size={14} /> {ui.sortCheapest}</span>
                    <strong>{formatPrice(calcPaxFare(cheapestFlight.basePrice), currency)}</strong>
                    <small>{cheapestFlight.durationLabel} · {cheapestFlight.airline}</small>
                  </button>
                  <button
                    type="button"
                    className={`smart-decision-card ${sortBy === 'fastest' ? 'is-active' : ''}`}
                    onClick={() => setSortBy('fastest')}
                  >
                    <span className="smart-decision-lbl"><Zap size={14} /> {ui.sortFastest}</span>
                    <strong>{formatPrice(calcPaxFare(fastestFlight.basePrice), currency)}</strong>
                    <small>{fastestFlight.durationLabel} · {fastestFlight.airline}</small>
                  </button>
                  <button
                    type="button"
                    className={`smart-decision-card ${sortBy === 'earliestDep' ? 'is-active' : ''}`}
                    onClick={() => setSortBy('earliestDep')}
                  >
                    <span className="smart-decision-lbl"><Calendar size={14} /> {ui.sortEarliestDep}</span>
                    <strong>{earliestFlight?.departTime ?? filtered[0]?.departTime}</strong>
                    <small>{filtered.length} {ui.flightsUnit}</small>
                  </button>
                </div>
              )}
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
                        {formatPrice(calcPaxFare(outboundChoice.flight.basePrice + outboundChoice.pkg.priceDelta), currency)}
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
                  const totalBase = calcPaxFare(flight.basePrice);

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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="flight-mini-action"
                              onClick={() => setDetailId(detailId === flight.id ? null : flight.id)}
                              aria-expanded={detailId === flight.id}
                            >
                              <Info size={13} />
                              <span>{lang === 'EN' ? 'Details' : lang === 'RU' ? 'Детали' : lang === 'KK' ? 'Толығырақ' : 'Detay'}</span>
                            </button>
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(
                                `FlyToAspan: ${flight.fromCity} (${flight.fromCode}) → ${flight.toCity} (${flight.toCode}) | ${flight.airline} ${flight.flightNumber} | ${flight.departTime}-${flight.arriveTime} | ${formatPrice(totalBase, currency)}`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flight-mini-action"
                              title="WhatsApp"
                            >
                              <Share2 size={13} />
                              <span>{lang === 'EN' ? 'Share' : lang === 'RU' ? 'Поделиться' : lang === 'KK' ? 'Бөлісу' : 'Paylaş'}</span>
                            </a>
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
                      </div>

                      {detailId === flight.id && (
                        <div className="flight-detail-drawer">
                          <div>
                            <strong>{flight.airline} · {flight.flightNumber}</strong>
                            <span>
                              {flight.airlineCode === 'EK' || flight.airlineCode === 'LH'
                                ? 'Boeing 787-9 Dreamliner'
                                : flight.airlineCode === 'KC'
                                  ? 'Airbus A321LR'
                                  : 'Airbus A321neo'}
                            </span>
                          </div>
                          <div>
                            <strong>{flight.fromCode} → {flight.toCode}</strong>
                            <span>
                              {flight.departTime} ({formatDisplayDate(flight.departureDate, lang)}) → {flight.arriveTime} ({formatDisplayDate(flight.arrivalDate, lang)})
                            </span>
                          </div>
                          <div>
                            <strong>{flight.stops === 0 ? co.nonStopDirect : co.oneStopVia(flight.stopCity)}</strong>
                            <span>
                              {flight.stops === 0
                                ? `${flight.durationLabel} · Terminal 1`
                                : `${flight.stopCity} · ~2h 15m`}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Silky Animated Expandable Fare Package Drawer */}
                      <div
                        className={`packages-collapse-shell ${isExpanded ? 'is-open' : ''}`}
                        aria-hidden={!isExpanded}
                      >
                        <div className="packages-collapse-inner">
                          <div className="packages-drawer">
                            {flight.packages.map((pkg, pkgIdx) => {
                              const pkgTotal = calcPaxFare(flight.basePrice + pkg.priceDelta);
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
                                        : ui.vsCheapest(formatPrice(calcPaxFare(pkg.priceDelta), currency))}
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
