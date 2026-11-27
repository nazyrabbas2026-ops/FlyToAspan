import { LangCode } from '../types';

export interface LanguageOption {
  code: LangCode;
  label: string;
  nativeName: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'TR', label: 'TR', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'EN', label: 'EN', nativeName: 'English', flag: '🇬🇧' },
  { code: 'RU', label: 'RU', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'KK', label: 'KK', nativeName: 'Қазақша', flag: '🇰🇿' },
];

export const PHONE_DISPLAY = '+90 531 460 61 75';
export const PHONE_SHORT = '0531 460 61 75';
export const PHONE_HREF = 'tel:+905314606175';
export const WA_HREF = 'https://wa.me/905314606175';

export interface Dictionary {
  nav: {
    campaigns: string;
    checkin: string;
    help: string;
    booking: string;
    login: string;
    register: string;
    myPanel: string;
    logout: string;
    supportLine: string;
  };
  hero: {
    heroTitle1: string;
    heroTitle2: string;
    heroSub: string;
    promoSerif1: string;
    promoSerif2: string;
    tabFlight: string;
    tabHotel: string;
    tabTransfer: string;
    oneWay: string;
    roundTrip: string;
    from: string;
    to: string;
    cityOrAirport: string;
    cityOrHotel: string;
    airportOrHotel: string;
    depart: string;
    returnLbl: string;
    checkIn: string;
    checkOut: string;
    date: string;
    time: string;
    paxCabin: string;
    adults: string;
    children: string;
    infants: string;
    adultUnit: string;
    childUnit: string;
    passengerUnit: string;
    selectDate: string;
    trust3d: string;
    trustBestPrice: string;
    trustSupport: string;
    searchFlight: string;
    searchHotel: string;
    searchTransfer: string;
    bestPriceBadge: string;
    flightPromoTitle: string;
    flightPromoSub: string;
    hotelPromoTitle: string;
    hotelPromoSub: string;
    transferPromoTitle: string;
    transferPromoSub: string;
    today: string;
    tomorrow: string;
    weekend: string;
    previousMonth: string;
    nextMonth: string;
    invalidDates: string;
    invalidFlightRoute: string;
    done: string;
    paxModalTitle: string;
    paxModalSub: string;
    economy: string;
    business: string;
    months: string[];
    weekdays: string[];
  };
  home: {
    airlinesEyebrow: string;
    campaignsEyebrow: string;
    campaignsTitle: string;
    allCampaigns: string;
    radarBadge: string;
    radarTitle: string;
    radarSub: string;
    livePrice: string;
    dealOfDay: string;
    perPerson: string;
    startingFrom: string;
    buyNow: string;
    quickBuy: string;
    hotelsEyebrow: string;
    hotelsTitle: string;
    hotelsSub: string;
    seeHotels: string;
    inspect: string;
    total: string;
    transfersEyebrow: string;
    transfersTitle: string;
    transfersSub: string;
    fixedPrice: string;
    disclaimer: string;
    whyEyebrow: string;
    whyTitle: string;
    whySub: string;
    destTitle: string;
    destSub: string;
    domestic: string;
    international: string;
    destFoot: string;
    aboutEyebrow: string;
    aboutTitle: string;
    aboutLead: string;
    learnMore: string;
    corpInspect: string;
    boardingPass: string;
    boardingFrom: string;
    boardingTo: string;
    partnersHeading: string;
    faqTitle1: string;
    faqTitle2: string;
    faqCtaTitle: string;
    faqCtaSub: string;
  };
  footer: {
    tagline: string;
    supportLbl: string;
    corporate: string;
    services: string;
    privacy: string;
    rights: string;
    cookieTitle: string;
    cookieText: string;
    reject: string;
    accept: string;
    supportBadge: string;
  };
}

export const TRANSLATIONS: Record<LangCode, Dictionary> = {
  TR: {
    nav: {
      campaigns: 'Kampanyalar',
      checkin: 'Online Check-In',
      help: 'Yardım',
      booking: 'Bilet İşlemleri',
      login: 'Giriş Yap',
      register: 'Kayıt Ol',
      myPanel: 'Hesabım',
      logout: 'Güvenli Çıkış',
      supportLine: '7/24 destek hattı',
    },
    hero: {
      heroTitle1: 'Dünyaya Açılan',
      heroTitle2: 'Yolculuğunuz',
      heroSub: '500+ rotada en uygun uçuşları keşfedin',
      promoSerif1: 'Yeni rotalar,',
      promoSerif2: 'yeni keşifler',
      tabFlight: 'Uçak',
      tabHotel: 'Otel',
      tabTransfer: 'Transfer',
      oneWay: 'Tek Yön',
      roundTrip: 'Gidiş Dönüş',
      from: 'NEREDEN',
      to: 'NEREYE',
      cityOrAirport: 'Şehir veya havalimanı',
      cityOrHotel: 'Şehir, bölge veya otel',
      airportOrHotel: 'Havalimanı veya otel',
      depart: 'GİDİŞ',
      returnLbl: 'DÖNÜŞ',
      checkIn: 'GİRİŞ',
      checkOut: 'ÇIKIŞ',
      date: 'TARİH',
      time: 'SAAT',
      paxCabin: 'YOLCU VE KABİN',
      adults: 'YETİŞKİN',
      children: 'ÇOCUK',
      infants: 'Bebek',
      adultUnit: 'Yetişkin',
      childUnit: 'Çocuk',
      passengerUnit: 'Yolcu',
      selectDate: 'Tarih seçin',
      trust3d: '3D Secure güvenli ödeme',
      trustBestPrice: 'En uygun fiyat',
      trustSupport: '7/24 destek',
      searchFlight: 'Uçuş Ara',
      searchHotel: 'Otel Ara',
      searchTransfer: 'Transfer Ara',
      bestPriceBadge: 'En Uygun Fiyat',
      flightPromoTitle: 'Yurt içi & yurt dışı uçuşlar',
      flightPromoSub: 'En uygun fiyat garantisiyle yüzlerce rota.',
      hotelPromoTitle: 'Tatilin kalbi otellerde',
      hotelPromoSub: 'Binlerce seçkin otelde anında onaylı fiyatlar.',
      transferPromoTitle: 'Kapıdan kapıya konfor',
      transferPromoSub: 'Uçuş takipli özel havalimanı transferi.',
      today: 'Bugün',
      tomorrow: 'Yarın',
      weekend: 'Hafta sonu',
      previousMonth: 'Önceki ay',
      nextMonth: 'Sonraki ay',
      invalidDates: 'Lütfen geçerli seyahat tarihleri seçin.',
      invalidFlightRoute: 'Kalkış ve varış havalimanları farklı olmalı.',
      done: 'Tamam',
      paxModalTitle: 'Yolcu ve Kabin Seçimi',
      paxModalSub: 'Kişi sayısını ve kabin sınıfını belirleyin',
      economy: 'Ekonomi',
      business: 'Business',
      months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
      weekdays: ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'],
    },
    home: {
      airlinesEyebrow: 'HAVAYOLLARI',
      campaignsEyebrow: 'KAMPANYALAR',
      campaignsTitle: 'Güncel fırsatlar',
      allCampaigns: 'Tüm kampanyalar',
      radarBadge: 'FIRSAT RADARI',
      radarTitle: 'Fırsat Uçuşlar',
      radarSub: 'Tarihiniz esnekse kazanan sizsiniz: rotaları her gün gerçekten arıyor, en ucuz günü buluyoruz. Karta dokunun, koltuğunuz dakikalar içinde sizin.',
      livePrice: 'Canlı fiyat',
      dealOfDay: 'GÜNÜN FIRSATI',
      perPerson: 'KİŞİ BAŞI',
      startingFrom: '’den başlayan fiyatlarla',
      buyNow: 'Hemen Satın Al',
      quickBuy: 'Hemen Al',
      hotelsEyebrow: 'KONAKLAMA · XML GÜNLÜK VİTRİN',
      hotelsTitle: 'Şu An En Uygun Oteller',
      hotelsSub: 'Sistem her gün XML fiyatlarını tarayarak farklı ülkelerden en uygun 5 oteli vitrine otomatik olarak aktarır.',
      seeHotels: 'Otelleri gör',
      inspect: 'İncele',
      total: 'TOPLAM',
      transfersEyebrow: 'PAKET TURLAR · XML GÜNLÜK VİTRİN',
      transfersTitle: '4 Ülkeden En Uygun Paket Turlar',
      transfersSub: 'Her gün XML tedarikçilerinden taranan, uçak ve otel dahil en avantajlı 4 ülke paket turu.',
      fixedPrice: 'PAKET FİYAT',
      disclaimer: 'Fiyatlar canlı aramadan alınır; rezervasyon anındaki güncel fiyat ve müsaitlik geçerlidir.',
      whyEyebrow: 'NEDEN FLYTOASPAN?',
      whyTitle: 'Seyahatinizi güvenle planlayın',
      whySub: 'Arama motorundan ödemeye, uçak biletinden otel ve paket turlara, 7/24 desteğe kadar her adım tek çatı altında.',
      destTitle: 'Popüler uçuş noktaları',
      destSub: "Bir şehre dokunun, arama kutusundaki 'Nereye' alanına anında eklensin.",
      domestic: 'Yurt İçi',
      international: 'Yurt Dışı',
      destFoot: 'Seçtiğiniz şehir varış noktası olarak eklenir; kalkış ve tarihi siz belirlersiniz.',
      aboutEyebrow: 'FLYTOASPAN HAKKINDA',
      aboutTitle: 'Seyahatlerinizde Güvenilir ve Etkili Çözüm Ortağınız',
      aboutLead: 'Infinitive Travel güvencesiyle uçak bileti, otel rezervasyonu ve paket turlar tek çatı altında.',
      learnMore: 'Daha Fazlasını Öğrenin',
      corpInspect: 'Kurumsal paneli inceleyin',
      boardingPass: 'BİNİŞ KARTI',
      boardingFrom: 'EV',
      boardingTo: 'TATİL',
      partnersHeading: 'ÇÖZÜM ORTAKLARIMIZ',
      faqTitle1: 'Sıkça Sorulan',
      faqTitle2: 'Sorular',
      faqCtaTitle: 'Aradığınız cevabı bulamadınız mı?',
      faqCtaSub: 'Seyahat danışmanlarımız 7 gün 24 saat yanınızda.',
    },
    footer: {
      tagline: 'Uçak bileti, otel konaklama ve paket turlar tek aramada.',
      supportLbl: '7/24 DESTEK HATTI',
      corporate: 'Kurumsal',
      services: 'Hizmetlerimiz',
      privacy: 'Gizlilik ve Güvenlik',
      rights: '© 2026 FlyToAspan by Infinitive Travel · Tüm hakları saklıdır.',
      cookieTitle: 'Çerez tercihleri',
      cookieText: 'FlyToAspan deneyiminizi iyileştirmek ve en uygun uçuş fiyatlarını anlık sunabilmek için çerezler kullanıyoruz.',
      reject: 'Reddet',
      accept: 'Kabul Et',
      supportBadge: '7/24 Destek',
    },
  },
  EN: {
    nav: {
      campaigns: 'Deals',
      checkin: 'Online Check-In',
      help: 'Help',
      booking: 'Manage Booking',
      login: 'Sign In',
      register: 'Sign Up',
      myPanel: 'My Account',
      logout: 'Sign Out',
      supportLine: '24/7 support line',
    },
    hero: {
      heroTitle1: 'Your Journey',
      heroTitle2: 'To The World',
      heroSub: 'Discover the best fares across 500+ global routes',
      promoSerif1: 'New routes,',
      promoSerif2: 'new discoveries',
      tabFlight: 'Flights',
      tabHotel: 'Hotels',
      tabTransfer: 'Transfer',
      oneWay: 'One Way',
      roundTrip: 'Round Trip',
      from: 'FROM',
      to: 'TO',
      cityOrAirport: 'City or airport',
      cityOrHotel: 'City, region or hotel',
      airportOrHotel: 'Airport or hotel',
      depart: 'DEPARTURE',
      returnLbl: 'RETURN',
      checkIn: 'CHECK-IN',
      checkOut: 'CHECK-OUT',
      date: 'DATE',
      time: 'TIME',
      paxCabin: 'PASSENGERS & CABIN',
      adults: 'ADULTS',
      children: 'CHILDREN',
      infants: 'Infant',
      adultUnit: 'Adult',
      childUnit: 'Child',
      passengerUnit: 'Passenger',
      selectDate: 'Select date',
      trust3d: '3D Secure payment',
      trustBestPrice: 'Best price guarantee',
      trustSupport: '24/7 support',
      searchFlight: 'Search Flights',
      searchHotel: 'Search Hotels',
      searchTransfer: 'Search Transfer',
      bestPriceBadge: 'Best Price',
      flightPromoTitle: 'Domestic & global flights',
      flightPromoSub: 'Hundreds of routes with best price guarantee.',
      hotelPromoTitle: 'Handpicked hotels',
      hotelPromoSub: 'Instant confirmation at top rated hotels.',
      transferPromoTitle: 'Door-to-door comfort',
      transferPromoSub: 'Private VIP airport transfers at fixed prices.',
      today: 'Today',
      tomorrow: 'Tomorrow',
      weekend: 'Weekend',
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      invalidDates: 'Please choose valid travel dates.',
      invalidFlightRoute: 'Choose different departure and arrival airports.',
      done: 'Done',
      paxModalTitle: 'Passengers & Cabin',
      paxModalSub: 'Choose travelers and cabin class',
      economy: 'Economy',
      business: 'Business',
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    },
    home: {
      airlinesEyebrow: 'AIRLINES',
      campaignsEyebrow: 'DEALS & OFFERS',
      campaignsTitle: 'Latest promotions',
      allCampaigns: 'All deals',
      radarBadge: 'DEAL RADAR',
      radarTitle: 'Featured Flight Deals',
      radarSub: 'Flexible dates win: we scan routes daily to find the lowest fares. Tap a card and book your seat in minutes.',
      livePrice: 'Live fares',
      dealOfDay: 'DEAL OF THE DAY',
      perPerson: 'PER PERSON',
      startingFrom: 'starting from',
      buyNow: 'Book Now',
      quickBuy: 'Book',
      hotelsEyebrow: 'ACCOMMODATION · DAILY XML',
      hotelsTitle: 'Best Value Hotels Right Now',
      hotelsSub: 'Updated daily from XML feeds — the 5 best-value hotels across countries, 1 per destination.',
      seeHotels: 'View hotels',
      inspect: 'Inspect',
      total: 'TOTAL',
      transfersEyebrow: 'PACKAGE TOURS · DAILY XML',
      transfersTitle: 'Top Package Tours From 4 Countries',
      transfersSub: 'Automatically selected daily from XML tour operators with flights and hotel included.',
      fixedPrice: 'PACKAGE PRICE',
      disclaimer: 'Prices are fetched live; final availability and pricing apply at checkout.',
      whyEyebrow: 'WHY FLYTOASPAN?',
      whyTitle: 'Plan your journey with confidence',
      whySub: 'From flight search to hotels, package tours, secure payment and 24/7 support under one roof.',
      destTitle: 'Popular destinations',
      destSub: 'Tap any city to instantly fill the destination field above.',
      domestic: 'Domestic',
      international: 'International',
      destFoot: 'Selected city fills your destination; choose departure and dates as you wish.',
      aboutEyebrow: 'ABOUT FLYTOASPAN',
      aboutTitle: 'Your Trusted Travel Partner Across Eurasia & Beyond',
      aboutLead: 'Backed by Infinitive Travel: flights, hotels and package tours in one seamless platform.',
      learnMore: 'Learn More',
      corpInspect: 'Explore corporate portal',
      boardingPass: 'BOARDING PASS',
      boardingFrom: 'HOME',
      boardingTo: 'SKY',
      partnersHeading: 'OUR SOLUTION PARTNERS',
      faqTitle1: 'Frequently Asked',
      faqTitle2: 'Questions',
      faqCtaTitle: 'Still have questions?',
      faqCtaSub: 'Our travel advisors are available 24/7.',
    },
    footer: {
      tagline: 'Flights, hotel accommodation and package tours in a single search.',
      supportLbl: '24/7 SUPPORT LINE',
      corporate: 'Corporate',
      services: 'Services',
      privacy: 'Privacy & Security',
      rights: '© 2026 FlyToAspan by Infinitive Travel · All rights reserved.',
      cookieTitle: 'Cookie preferences',
      cookieText: 'We use cookies to improve your FlyToAspan experience and display live flight fares.',
      reject: 'Decline',
      accept: 'Accept',
      supportBadge: '24/7 Support',
    },
  },
  RU: {
    nav: {
      campaigns: 'Акции',
      checkin: 'Онлайн-регистрация',
      help: 'Помощь',
      booking: 'Мои билеты',
      login: 'Войти',
      register: 'Регистрация',
      myPanel: 'Кабинет',
      logout: 'Выйти',
      supportLine: 'Поддержка 24/7',
    },
    hero: {
      heroTitle1: 'Путешествие',
      heroTitle2: 'в Весь Мир',
      heroSub: 'Лучшие авиабилеты по более чем 500 направлениям',
      promoSerif1: 'Новые маршруты,',
      promoSerif2: 'новые открытия',
      tabFlight: 'Авиабилеты',
      tabHotel: 'Отели',
      tabTransfer: 'Трансфер',
      oneWay: 'В одну сторону',
      roundTrip: 'Туда и обратно',
      from: 'ОТКУДА',
      to: 'КУДА',
      cityOrAirport: 'Город или аэропорт',
      cityOrHotel: 'Город, район или отель',
      airportOrHotel: 'Аэропорт или отель',
      depart: 'ВЫЛЕТ',
      returnLbl: 'ОБРАТНО',
      checkIn: 'ЗАЕЗД',
      checkOut: 'ВЫЕЗД',
      date: 'ДАТА',
      time: 'ВРЕМЯ',
      paxCabin: 'ПАССАЖИРЫ И КЛАСС',
      adults: 'ВЗРОСЛЫЕ',
      children: 'ДЕТИ',
      infants: 'Младенец',
      adultUnit: 'Взр.',
      childUnit: 'Реб.',
      passengerUnit: 'Пасс.',
      selectDate: 'Выберите дату',
      trust3d: 'Безопасная оплата 3D Secure',
      trustBestPrice: 'Лучшие цены',
      trustSupport: 'Поддержка 24/7',
      searchFlight: 'Найти билеты',
      searchHotel: 'Найти отели',
      searchTransfer: 'Найти трансфер',
      bestPriceBadge: 'Лучшая цена',
      flightPromoTitle: 'Внутренние и международные рейсы',
      flightPromoSub: 'Сотни направлений с гарантией лучшей цены.',
      hotelPromoTitle: 'Лучшие отели мира',
      hotelPromoSub: 'Мгновенное подтверждение и честные цены.',
      transferPromoTitle: 'Комфорт от двери до двери',
      transferPromoSub: 'VIP-трансфер из аэропорта по фиксированной цене.',
      today: 'Сегодня',
      tomorrow: 'Завтра',
      weekend: 'Выходные',
      previousMonth: 'Предыдущий месяц',
      nextMonth: 'Следующий месяц',
      invalidDates: 'Выберите допустимые даты поездки.',
      invalidFlightRoute: 'Выберите разные аэропорты вылета и прилёта.',
      done: 'Готово',
      paxModalTitle: 'Пассажиры и класс',
      paxModalSub: 'Выберите количество пассажиров и класс',
      economy: 'Эконом',
      business: 'Бизнес',
      months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
      weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    },
    home: {
      airlinesEyebrow: 'АВИАКОМПАНИИ',
      campaignsEyebrow: 'АКЦИИ И СКИДКИ',
      campaignsTitle: 'Актуальные предложения',
      allCampaigns: 'Все акции',
      radarBadge: 'РАДАР ЦЕН',
      radarTitle: 'Выгодные авиабилеты',
      radarSub: 'Ежедневно ищем минимальные тарифы по популярным направлениям. Нажмите на карточку и забронируйте за минуту.',
      livePrice: 'Онлайн-цены',
      dealOfDay: 'ПРЕДЛОЖЕНИЕ ДНЯ',
      perPerson: 'ЗА ЧЕЛОВЕКА',
      startingFrom: 'минимальный тариф',
      buyNow: 'Купить сейчас',
      quickBuy: 'Купить',
      hotelsEyebrow: 'ПРОЖИВАНИЕ · XML ВИТРИНА',
      hotelsTitle: 'Лучшие цены на отели',
      hotelsSub: 'Ежедневное обновление из XML — 5 самых выгодных отелей по разным странам.',
      seeHotels: 'Смотреть отели',
      inspect: 'Подробнее',
      total: 'ИТОГО',
      transfersEyebrow: 'ПАКЕТНЫЕ ТУРЫ · XML ВИТРИНА',
      transfersTitle: 'Выгодные пакетные туры из 4 стран',
      transfersSub: 'Ежедневный автоматический отбор лучших туров (перелёт + отель) из XML-фидов.',
      fixedPrice: 'ЗА ПАКЕТ',
      disclaimer: 'Цены обновляются в реальном времени; итоговая стоимость подтверждается при бронировании.',
      whyEyebrow: 'ПОЧЕМУ FLYTOASPAN?',
      whyTitle: 'Планируйте поездки с уверенностью',
      whySub: 'Авиабилеты, отели, пакетные туры и круглосуточная поддержка в одном сервисе.',
      destTitle: 'Популярные направления',
      destSub: 'Нажмите на город, чтобы подставить его в поле «Куда».',
      domestic: 'По Турции',
      international: 'Международные',
      destFoot: 'Выбранный город добавится как пункт назначения; даты выбираете вы.',
      aboutEyebrow: 'О FLYTOASPAN',
      aboutTitle: 'Ваш надежный партнер в деловых и личных поездках',
      aboutLead: 'При поддержке Infinitive Travel: авиабилеты, отели и пакетные туры на одной платформе.',
      learnMore: 'Узнать больше',
      corpInspect: 'Корпоративный кабинет',
      boardingPass: 'ПОСАДОЧНЫЙ ТАЛОН',
      boardingFrom: 'ДОМ',
      boardingTo: 'ОТПУСК',
      partnersHeading: 'НАШИ ПАРТНЕРЫ',
      faqTitle1: 'Частые',
      faqTitle2: 'Вопросы',
      faqCtaTitle: 'Не нашли ответ на свой вопрос?',
      faqCtaSub: 'Наши специалисты на связи 24/7.',
    },
    footer: {
      tagline: 'Авиабилеты, проживание в отелях и пакетные туры в одном поиске.',
      supportLbl: 'ПОДДЕРЖКА 24/7',
      corporate: 'О компании',
      services: 'Услуги',
      privacy: 'Безопасность и данные',
      rights: '© 2026 FlyToAspan by Infinitive Travel · Все права защищены.',
      cookieTitle: 'Настройки cookie',
      cookieText: 'Мы используем файлы cookie для улучшения работы сервиса и показа актуальных тарифов.',
      reject: 'Отклонить',
      accept: 'Принять',
      supportBadge: 'Поддержка 24/7',
    },
  },
  KK: {
    nav: {
      campaigns: 'Науқандар',
      checkin: 'Онлайн тіркелу',
      help: 'Көмек',
      booking: 'Билеттер',
      login: 'Кіру',
      register: 'Тіркелу',
      myPanel: 'Кабинет',
      logout: 'Шығу',
      supportLine: '24/7 қолдау желісі',
    },
    hero: {
      heroTitle1: 'Әлемге Ашылар',
      heroTitle2: 'Сапарыңыз',
      heroSub: '500+ бағыт бойынша ең тиімді рейстерді ашыңыз',
      promoSerif1: 'Жаңа бағыттар,',
      promoSerif2: 'жаңа ашылулар',
      tabFlight: 'Ұшақ',
      tabHotel: 'Қонақүй',
      tabTransfer: 'Трансфер',
      oneWay: 'Бір бағыт',
      roundTrip: 'Бару-қайту',
      from: 'ҚАЙДАН',
      to: 'ҚАЙДА',
      cityOrAirport: 'Қала немесе әуежай',
      cityOrHotel: 'Қала, аймақ немесе қонақүй',
      airportOrHotel: 'Әуежай немесе қонақүй',
      depart: 'ҰШУ КҮНІ',
      returnLbl: 'ҚАЙТУ КҮНІ',
      checkIn: 'КІРУ',
      checkOut: 'ШЫҒУ',
      date: 'КҮНІ',
      time: 'УАҚЫТЫ',
      paxCabin: 'ЖОЛАУШЫ ЖӘНЕ КЛАСС',
      adults: 'ЕРЕСЕКТЕР',
      children: 'БАЛАЛАР',
      infants: 'Нәресте',
      adultUnit: 'Ересек',
      childUnit: 'Бала',
      passengerUnit: 'Жолаушы',
      selectDate: 'Күнді таңдаңыз',
      trust3d: '3D Secure қауіпсіз төлем',
      trustBestPrice: 'Ең тиімді баға',
      trustSupport: '24/7 қолдау',
      searchFlight: 'Рейс іздеу',
      searchHotel: 'Қонақүй іздеу',
      searchTransfer: 'Трансфер іздеу',
      bestPriceBadge: 'Ең тиімді баға',
      flightPromoTitle: 'Ішкі және халықаралық рейстер',
      flightPromoSub: 'Жүздеген бағыт бойынша ең тиімді бағалар.',
      hotelPromoTitle: 'Таңдаулы қонақүйлер',
      hotelPromoSub: 'Мыңдаған қонақүйде лезде расталатын бағалар.',
      transferPromoTitle: 'Есіктен есікке жайлылық',
      transferPromoSub: 'Рейсті бақылайтын жеке VIP әуежай трансфері.',
      today: 'Бүгін',
      tomorrow: 'Ертең',
      weekend: 'Демалыс',
      previousMonth: 'Алдыңғы ай',
      nextMonth: 'Келесі ай',
      invalidDates: 'Сапар күндерін дұрыс таңдаңыз.',
      invalidFlightRoute: 'Ұшу және келу әуежайлары әртүрлі болуы керек.',
      done: 'Дайын',
      paxModalTitle: 'Жолаушылар және класс',
      paxModalSub: 'Жолаушылар санын және класын таңдаңыз',
      economy: 'Эконом',
      business: 'Бизнес',
      months: ['Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым', 'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан'],
      weekdays: ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жк'],
    },
    home: {
      airlinesEyebrow: 'ӘУЕ КОМПАНИЯЛАРЫ',
      campaignsEyebrow: 'НАУҚАНДАР',
      campaignsTitle: 'Тиімді ұсыныстар',
      allCampaigns: 'Барлық науқандар',
      radarBadge: 'БАҒА РАДАРЫ',
      radarTitle: 'Тиімді рейстер',
      radarSub: 'Бағыттарды күн сайын тексереміз, ең арзан күнді табамыз. Картаны басып, билетіңізді бір минутта алыңыз.',
      livePrice: 'Тікелей баға',
      dealOfDay: 'КҮН ҰСЫНЫСЫ',
      perPerson: 'БІР АДАМҒА',
      startingFrom: 'бастапқы баға',
      buyNow: 'Қазір сатып алу',
      quickBuy: 'Алу',
      hotelsEyebrow: 'ҚОНАҚҮЙЛЕР · XML КҮНДЕЛІКТІ',
      hotelsTitle: 'Қазіргі ең тиімді қонақүйлер',
      hotelsSub: 'XML жүйесі күн сайын жаңартып, әр елден ең тиімді 5 қонақүйді автоматты түрде витринаға шығарады.',
      seeHotels: 'Қонақүйлерді көру',
      inspect: 'Қарау',
      total: 'БАРЛЫҒЫ',
      transfersEyebrow: 'ПАКЕТТІК ТУРЛАР · XML КҮНДЕЛІКТІ',
      transfersTitle: '4 Елден Ең Тиімді Пакеттік Турлар',
      transfersSub: 'Күн сайын XML бағаларынан автоматты іріктелетін 4 елдің ұшақ пен қонақүй кіретін турлары.',
      fixedPrice: 'ПАКЕТ БАҒАСЫ',
      disclaimer: 'Бағалар нақты уақытта жаңартылады; брондау сәтіндегі тариф жарамды.',
      whyEyebrow: 'НЕГЕ FLYTOASPAN?',
      whyTitle: 'Сапарыңызды сенімді жоспарлаңыз',
      whySub: 'Ұшақ билеті, қонақүй, пакеттік турлар және 24/7 қолдау — барлығы бір платформада.',
      destTitle: 'Танымал бағыттар',
      destSub: 'Қаланы басыңыз — жоғарғы іздеу өрісіне лезде қосылады.',
      domestic: 'Түркия ішінде',
      international: 'Халықаралық',
      destFoot: 'Таңдалған қала бару нүктесі ретінде қосылады; күндерді өзіңіз таңдайсыз.',
      aboutEyebrow: 'FLYTOASPAN ТУРАЛЫ',
      aboutTitle: 'Сапарларыңыздағы сенімді әрі тиімді серіктесіңіз',
      aboutLead: 'Infinitive Travel кепілдігімен әуе билеті, қонақүй және пакеттік турлар бір жүйеде.',
      learnMore: 'Толығырақ білу',
      corpInspect: 'Корпоративтік панель',
      boardingPass: 'ОТЫРҒЫЗУ ТАЛОНЫ',
      boardingFrom: 'ҮЙ',
      boardingTo: 'АСПАН',
      partnersHeading: 'СЕРІКТЕСТЕРІМІЗ',
      faqTitle1: 'Жиі қойылатын',
      faqTitle2: 'сұрақтар',
      faqCtaTitle: 'Іздеген жауабыңызды таппадыңыз ба?',
      faqCtaSub: 'Саяхат кеңесшілеріміз 24/7 байланыста.',
    },
    footer: {
      tagline: 'Әуе билеті, қонақүй және пакеттік турлар бір іздеуде.',
      supportLbl: '24/7 ҚОЛДАУ ЖЕЛІСІ',
      corporate: 'Компания',
      services: 'Қызметтер',
      privacy: 'Құпиялылық және қауіпсіздік',
      rights: '© 2026 FlyToAspan by Infinitive Travel · Барлық құқықтар қорғалған.',
      cookieTitle: 'Cookie баптаулары',
      cookieText: 'FlyToAspan қызметін жақсарту және нақты бағаларды көрсету үшін cookie файлдарын қолданамыз.',
      reject: 'Бас тарту',
      accept: 'Қабылдау',
      supportBadge: '24/7 Қолдау',
    },
  },
};
