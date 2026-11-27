import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Zap,
  Plane,
  ShieldCheck,
  Tag,
  CreditCard,
  PhoneCall,
  Home,
  Globe,
  Building2,
  Briefcase,
  Phone,
  MessageCircle,
  Copy,
  Check,
} from 'lucide-react';
import {
  AIRLINE_MARQUEE,
  CAMPAIGNS,
  FAQ_ITEMS,
  getFlightDeals,
  FlightDeal,
  HOTEL_DEALS,
  POPULAR_DOMESTIC,
  POPULAR_INTERNATIONAL,
  SOLUTION_PARTNERS,
  TRANSFER_DEALS,
  DEFAULT_MARKUP,
  formatDisplayDate,
  formatPrice,
  localizeCityName,
} from '../data/mockData';
import { resolveCityImage, resolveRegionColor } from '../utils/cityImages';
import { localizeXmlText } from '../utils/localizeXmlText';
import { PHONE_DISPLAY, PHONE_HREF, PHONE_SHORT, TRANSLATIONS, WA_HREF } from '../i18n/translations';
import { AdminMarkupConfig, CurrencyCode, LangCode, PageView } from '../types';
import type { AdminCatalog } from '../data/api';

interface HomeSectionsProps {
  lang: LangCode;
  currency?: CurrencyCode;
  markup?: AdminMarkupConfig;
  liveCatalog?: Partial<AdminCatalog>;
  onSelectDeal: (deal: FlightDeal) => void;
  onSelectHotelCity: (city: string) => void;
  onSelectTransferCity: (city: string) => void;
  onSelectDestinationCode: (code: string) => void;
  onNavigate: (page: PageView) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const CONTENT_I18N: Record<
  LangCode,
  {
    license: string;
    codeLbl: string;
    bestPricePill: string;
    nightsLbl: string;
    guestsLbl: string;
    regions: Record<FlightDeal['region'], string>;
    cities: Record<string, string>;
    boardTypes: Record<string, string>;
    campaigns: Record<string, { badge: string; title: string; subtitle: string }>;
    transfers: Record<string, { city: string; route: string; specs: string }>;
    whyCols: Array<{ title: string; desc: string; link: string }>;
    aboutFeatures: Array<{ title: string; desc: string }>;
    boarding: {
      fromLbl: string;
      toLbl: string;
      fromSub: string;
      toSub: string;
      paxLbl: string;
      paxVal: string;
      supLbl: string;
      priceLbl: string;
      priceVal: string;
      lineLbl: string;
    };
    faqs: Array<{ q: string; a: string }>;
  }
> = {
  TR: {
    license: 'FLYTOASPAN BY INFINITIVE TRAVEL • GLOBAL SEYAHAT PLATFORMU',
    codeLbl: 'KOD',
    bestPricePill: 'EN UYGUN FİYAT',
    nightsLbl: 'gece',
    guestsLbl: 'kişi',
    regions: {
      'YURT İÇİ': 'YURT İÇİ',
      AVRUPA: 'AVRUPA',
      'ORTA ASYA': 'ORTA ASYA',
      'ORTA DOĞU': 'ORTA DOĞU',
    },
    cities: {},
    boardTypes: {},
    campaigns: {
      'cmp-1': {
        badge: CAMPAIGNS[0].badge,
        title: CAMPAIGNS[0].title,
        subtitle: CAMPAIGNS[0].subtitle,
      },
      'cmp-2': {
        badge: CAMPAIGNS[1].badge,
        title: CAMPAIGNS[1].title,
        subtitle: CAMPAIGNS[1].subtitle,
      },
      'cmp-3': {
        badge: CAMPAIGNS[2].badge,
        title: CAMPAIGNS[2].title,
        subtitle: CAMPAIGNS[2].subtitle,
      },
      'cmp-4': {
        badge: CAMPAIGNS[3].badge,
        title: CAMPAIGNS[3].title,
        subtitle: CAMPAIGNS[3].subtitle,
      },
    },
    transfers: {},
    whyCols: [
      {
        title: 'Güvenli Alışveriş',
        desc: 'Uçak bileti, otel rezervasyonu ve paket tur işlemleriniz uluslararası güvenlik standartlarıyla koruma altında.',
        link: '3D Secure ile korunur',
      },
      {
        title: 'Avantajlı Fiyatlar',
        desc: '500+ havayolu ve binlerce seçkin oteli anlık tarayarak bütçenize en uygun fırsatları şeffaf biçimde sunuyoruz.',
        link: 'Fırsatları gör',
      },
      {
        title: 'Esnek Ödeme Seçenekleri',
        desc: 'Tüm uçuş, konaklama ve paket tur harcamalarınızda uluslararası kartlar ve Kazakistan bankalarıyla güvenli ödeme yapın.',
        link: 'Fırsatları incele',
      },
      {
        title: '7/24 Çağrı Merkezi',
        desc: `Seyahatinizin her anında yanınızdayız. Bilet değişikliği ve acil destek için 7/24 bize ulaşın: ${PHONE_DISPLAY}`,
        link: 'Hemen ara',
      },
    ],
    aboutFeatures: [
      {
        title: 'Bireysel Seyahatlerde Acente Güvencesi',
        desc: 'Infinitive Travel güvencesiyle Kazakistan, Türkiye, Orta Asya ve Avrupa başta olmak üzere dünya genelinde kesintisiz 7/24 seyahat danışmanlığı sunuyoruz.',
      },
      {
        title: 'Kurumsal Seyahat Portalı',
        desc: 'Şirketiniz için yönetici onay akışları, seyahat politikası & bütçe limitleri ve departman bazlı şeffaf faturalandırma raporlarıyla iş seyahatlerini kolayca yönetin.',
      },
    ],
    boarding: {
      fromLbl: 'NEREDEN',
      toLbl: 'NEREYE',
      fromSub: 'Bulunduğunuz yer',
      toSub: 'Hayalinizdeki yer',
      paxLbl: 'YOLCU',
      paxVal: 'Siz',
      supLbl: 'DESTEK',
      priceLbl: 'FİYAT',
      priceVal: 'En uygun',
      lineLbl: '7/24 HAT',
    },
    faqs: FAQ_ITEMS,
  },
  EN: {
    license: 'FLYTOASPAN BY INFINITIVE TRAVEL • GLOBAL TRAVEL PLATFORM',
    codeLbl: 'CODE',
    bestPricePill: 'BEST PRICE',
    nightsLbl: 'nights',
    guestsLbl: 'guests',
    regions: {
      'YURT İÇİ': 'DOMESTIC',
      AVRUPA: 'EUROPE',
      'ORTA ASYA': 'CENTRAL ASIA',
      'ORTA DOĞU': 'MIDDLE EAST',
    },
    cities: {
      İstanbul: 'Istanbul',
      'İstanbul (SAW)': 'Istanbul (SAW)',
      İzmir: 'Izmir',
      Almatı: 'Almaty',
      Londra: 'London',
      Roma: 'Rome',
      Taşkent: 'Tashkent',
      Bakü: 'Baku',
      Barselona: 'Barcelona',
      Viyana: 'Vienna',
      Şanlıurfa: 'Sanliurfa',
      ALMATI: 'ALMATY',
      İZMİR: 'IZMIR',
    },
    boardTypes: {
      'Kahvaltı Dahil': 'Breakfast Included',
      'Oda Kahvaltı': 'Bed & Breakfast',
      'Her Şey Dahil': 'All Inclusive',
    },
    campaigns: {
      'cmp-1': {
        badge: 'DOMESTIC & INTERNATIONAL',
        title: 'Instant 350 TL Discount on Your First Flight',
        subtitle: 'Join FlyToAspan and enjoy instant savings on flights between Istanbul, Almaty, Antalya, and Europe.',
      },
      'cmp-2': {
        badge: 'CENTRAL ASIA SPECIAL',
        title: '18% Off Direct Flights to Almaty & Astana',
        subtitle: 'Fly to the skies of Kazakhstan with FlyToAspan, including complimentary checked baggage.',
      },
      'cmp-3': {
        badge: 'EARLY BOOKING',
        title: 'Up to 30% Off Selected 5-Star Hotels',
        subtitle: 'Free cancellation and flexible options at top resorts in Antalya, Bodrum, and Dubai.',
      },
      'cmp-4': {
        badge: 'PACKAGE TOUR DEAL',
        title: '20% Off Flight + Hotel Package Tours in 4 Countries',
        subtitle: 'Daily XML-updated package tours across Turkey, Kazakhstan, Egypt, and Dubai.',
      },
    },
    transfers: {},
    whyCols: [
      {
        title: 'Secure Booking',
        desc: 'All flight tickets, hotel reservations, and package tours are protected by 256-bit SSL and 3D Secure standards.',
        link: 'Protected by 3D Secure',
      },
      {
        title: 'Competitive Fares',
        desc: 'We scan 500+ airlines and thousands of handpicked hotels in real time to bring you transparent, best-value fares.',
        link: 'Explore deals',
      },
      {
        title: 'Flexible Payments',
        desc: 'Pay seamlessly with global cards and leading Kazakhstan banks across flights, hotels, and package tours.',
        link: 'View offers',
      },
      {
        title: '24/7 Call Center',
        desc: `We are with you at every step of your trip. Reach us 24/7 for changes and urgent support: ${PHONE_DISPLAY}`,
        link: 'Call now',
      },
    ],
    aboutFeatures: [
      {
        title: 'Trusted Agency Support for Travelers',
        desc: 'Backed by Infinitive Travel, we provide 24/7 travel assistance across Kazakhstan, Turkey, Central Asia, Europe, and worldwide.',
      },
      {
        title: 'Corporate Travel Management Portal',
        desc: 'Streamline business travel with manager approval workflows, policy & budget limits, and department-level billing reports.',
      },
    ],
    boarding: {
      fromLbl: 'FROM',
      toLbl: 'TO',
      fromSub: 'Your current location',
      toSub: 'Your dream destination',
      paxLbl: 'PASSENGER',
      paxVal: 'You',
      supLbl: 'SUPPORT',
      priceLbl: 'FARE',
      priceVal: 'Best price',
      lineLbl: '24/7 LINE',
    },
    faqs: [
      {
        q: 'How can I book a flight ticket on FlyToAspan?',
        a: 'Select your departure and arrival cities, travel dates, and passenger count in the search box above and click "Search Flights". Filter by stops, time, or price, compare baggage & refund rules under "Packages", and complete your purchase in seconds with 3D Secure.',
      },
      {
        q: 'What should I look for when choosing a hotel?',
        a: 'We recommend checking the board basis (Bed & Breakfast, All Inclusive, etc.), free cancellation rules, distance to the center or airport, and guest review scores. FlyToAspan always shows transparent total prices with no hidden fees.',
      },
      {
        q: 'How can I cancel or change my flight ticket?',
        a: 'Visit the "Manage Booking" page in the top navigation and enter your PNR code and surname. You can request changes or cancellations online according to your fare rules or contact our 24/7 call center for instant assistance.',
      },
      {
        q: 'What is included in Package Tours and how are prices updated?',
        a: 'Our package tours combine flights and handpicked hotel stays in one bundle. Our system scans XML tour operators daily and automatically showcases the best-value packages from 4 different countries.',
      },
      {
        q: 'When does online check-in open?',
        a: 'For scheduled (regular) flights, online check-in opens 24–48 hours before departure. For charter flights (e.g., Turkish Airlines charter), online check-in may not be available and check-in is completed at the airport counter. See our Online Check-In page for full rules.',
      },
    ],
  },
  RU: {
    license: 'FLYTOASPAN BY INFINITIVE TRAVEL • МЕЖДУНАРОДНАЯ ПЛАТФОРМА ПУТЕШЕСТВИЙ',
    codeLbl: 'КОД',
    bestPricePill: 'ЛУЧШАЯ ЦЕНА',
    nightsLbl: 'ночи',
    guestsLbl: 'гостя',
    regions: {
      'YURT İÇİ': 'ПО ТУРЦИИ',
      AVRUPA: 'ЕВРОПА',
      'ORTA ASYA': 'ЦЕНТР. АЗИЯ',
      'ORTA DOĞU': 'БЛИЖНИЙ ВОСТОК',
    },
    cities: {
      İstanbul: 'Стамбул',
      'İstanbul (SAW)': 'Стамбул (SAW)',
      Antalya: 'Анталья',
      İzmir: 'Измир',
      Ankara: 'Анкара',
      Trabzon: 'Трабзон',
      Almatı: 'Алматы',
      Astana: 'Астана',
      Taşkent: 'Ташкент',
      Bakü: 'Баку',
      Londra: 'Лондон',
      Amsterdam: 'Амстердам',
      Paris: 'Париж',
      Berlin: 'Берлин',
      Roma: 'Рим',
      Barselona: 'Барселона',
      Viyana: 'Вена',
      Dubai: 'Дубай',
      'New York': 'Нью-Йорк',
      BODRUM: 'БОДРУМ',
      TRABZON: 'ТРАБЗОН',
      ANTALYA: 'АНТАЛЬЯ',
      ALMATI: 'АЛМАТЫ',
      İZMİR: 'ИЗМИР',
    },
    boardTypes: {
      'Kahvaltı Dahil': 'Завтрак включен',
      'Oda Kahvaltı': 'Только завтрак',
      'Her Şey Dahil': 'Все включено',
    },
    campaigns: {
      'cmp-1': {
        badge: 'ВНУТРЕННИЕ И МЕЖДУНАРОДНЫЕ',
        title: 'Скидка 350 TL на ваш первый авиабилет',
        subtitle: 'Зарегистрируйтесь в FlyToAspan и получите мгновенную выгоду на рейсы Стамбул – Алматы, Анталья и Европа.',
      },
      'cmp-2': {
        badge: 'ЦЕНТРАЛЬНАЯ АЗИЯ',
        title: 'Выгода до 18% на прямые рейсы в Алматы и Астану',
        subtitle: 'Специальные тарифы с включенным багажом при поддержке FlyToAspan.',
      },
      'cmp-3': {
        badge: 'РАННЕЕ БРОНИРОВАНИЕ',
        title: 'Скидки до 30% на избранные отели 5★',
        subtitle: 'Бесплатная отмена и выгодные условия в лучших отелях Антальи, Бодрума и Дубая.',
      },
      'cmp-4': {
        badge: 'ПАКЕТНЫЕ ТУРЫ',
        title: 'Выгода 20% на пакетные туры в 4 странах',
        subtitle: 'Перелёт + отель с ежедневным автоматическим обновлением цен из XML.',
      },
    },
    transfers: {},
    whyCols: [
      {
        title: 'Безопасная покупка',
        desc: 'Авиабилеты, бронирование отелей и пакетные туры защищены международными стандартами безопасности 3D Secure.',
        link: 'Защита 3D Secure',
      },
      {
        title: 'Выгодные тарифы',
        desc: 'Сравниваем более 500 авиакомпаний и тысячи отелей в реальном времени без скрытых комиссий.',
        link: 'Смотреть акции',
      },
      {
        title: 'Удобная оплата',
        desc: 'Оплачивайте перелеты, отели и пакетные туры картами международных систем и банков Казахстана (Kaspi, Halyk, Freedom, BCC).',
        link: 'Все акции',
      },
      {
        title: 'Поддержка 24/7',
        desc: `Мы на связи круглосуточно для обмена билетов и срочной помощи: ${PHONE_DISPLAY}`,
        link: 'Позвонить',
      },
    ],
    aboutFeatures: [
      {
        title: 'Надежность и поддержка 24/7',
        desc: 'С поддержкой Infinitive Travel обеспечиваем круглосуточное сопровождение путешественников в Казахстане, Турции, Центральной Азии и Европе.',
      },
      {
        title: 'Корпоративный портал для бизнеса',
        desc: 'Согласование командировок, контроль лимитов бюджета и прозрачная отчетность по отделам в одном кабинете.',
      },
    ],
    boarding: {
      fromLbl: 'ОТКУДА',
      toLbl: 'КУДА',
      fromSub: 'Ваше местоположение',
      toSub: 'Отдых мечты',
      paxLbl: 'ПАССАЖИР',
      paxVal: 'Вы',
      supLbl: 'ПОДДЕРЖКА',
      priceLbl: 'ТАРИФ',
      priceVal: 'Выгодный',
      lineLbl: 'ЛИНИЯ 24/7',
    },
    faqs: [
      {
        q: 'Как купить авиабилет на FlyToAspan?',
        a: 'Выберите город вылета и прилета, дату и количество пассажиров в форме поиска и нажмите «Найти билеты». Используйте фильтры по пересадкам и времени, сравните нормы багажа во вкладке «Пакеты» и оплатите билет через 3D Secure.',
      },
      {
        q: 'На что обратить внимание при выборе отеля?',
        a: 'Рекомендуем проверять тип питания (завтрак, все включено), условия бесплатной отмены, расположение и рейтинг гостей. На FlyToAspan всегда отображается финальная стоимость без скрытых сборов.',
      },
      {
        q: 'Как отменить или обменять авиабилет?',
        a: 'Перейдите в раздел «Мои билеты» в верхнем меню и введите код бронирования (PNR) и фамилию пассажира. Вы можете отправить запрос онлайн или обратиться в нашу службу поддержки 24/7.',
      },
      {
        q: 'Что входит в пакетные туры и как обновляются цены?',
        a: 'Пакетные туры включают перелёт и проживание в проверенных отелях. Система ежедневно проверяет XML-цены и автоматически выводит на витрину лучшие туры по 4 странам.',
      },
      {
        q: 'Когда открывается онлайн-регистрация на рейс?',
        a: 'На регулярных рейсах онлайн-регистрация открывается за 24–48 часов до вылета. На чартерных рейсах (например, чартеры Turkish Airlines) онлайн-регистрация может быть недоступна, а выбор места оплачивается отдельно. Подробности на странице «Онлайн-регистрация».',
      },
    ],
  },
  KK: {
    license: 'FLYTOASPAN BY INFINITIVE TRAVEL • ХАЛЫҚАРАЛЫҚ САЯХАТ ПЛАТФОРМАСЫ',
    codeLbl: 'КОД',
    bestPricePill: 'ЕҢ ТИІМДІ БАҒА',
    nightsLbl: 'түн',
    guestsLbl: 'адам',
    regions: {
      'YURT İÇİ': 'ІШКІ РЕЙСТЕР',
      AVRUPA: 'ЕУРОПА',
      'ORTA ASYA': 'ОРТАЛЫҚ АЗИЯ',
      'ORTA DOĞU': 'ТАЯУ ШЫҒЫС',
    },
    cities: {
      İstanbul: 'Ыстамбұл',
      'İstanbul (SAW)': 'Ыстамбұл (SAW)',
      Antalya: 'Анталия',
      İzmir: 'Измир',
      Ankara: 'Анкара',
      Trabzon: 'Трабзон',
      Almatı: 'Алматы',
      Astana: 'Астана',
      Taşkent: 'Ташкент',
      Bakü: 'Баку',
      Londra: 'Лондон',
      Amsterdam: 'Амстердам',
      Paris: 'Париж',
      Berlin: 'Берлин',
      Roma: 'Рим',
      Barselona: 'Барселона',
      Viyana: 'Вена',
      Dubai: 'Дубай',
      'New York': 'Нью-Йорк',
      BODRUM: 'БОДРУМ',
      TRABZON: 'ТРАБЗОН',
      ANTALYA: 'АНТАЛИЯ',
      ALMATI: 'АЛМАТЫ',
      İZMİR: 'ИЗМИР',
    },
    boardTypes: {
      'Kahvaltı Dahil': 'Таңғы ас кіреді',
      'Oda Kahvaltı': 'Таңғы ас',
      'Her Şey Dahil': 'Бәрі қосылған',
    },
    campaigns: {
      'cmp-1': {
        badge: 'ІШКІ ЖӘНЕ ХАЛЫҚАРАЛЫҚ',
        title: 'Алғашқы ұшуға 350 TL лезде жеңілдік',
        subtitle: 'FlyToAspan мүшесі болыңыз да, Ыстамбұл – Алматы, Анталия және Еуропа рейстерінде тиімді баға алыңыз.',
      },
      'cmp-2': {
        badge: 'ОРТАЛЫҚ АЗИЯ ҰСЫНЫСЫ',
        title: 'Алматы мен Астана тікелей рейстерінде 18% жеңілдік',
        subtitle: 'Тегін жолжүк кіретін арнайы тарифтермен FlyToAspan арқылы саяхаттаңыз.',
      },
      'cmp-3': {
        badge: 'ЕРТЕ БРОНДАУ',
        title: 'Таңдаулы 5 жұлдызды қонақүйлерде 30%-ға дейін жеңілдік',
        subtitle: 'Анталия, Бодрум және Дубайдың үздік қонақүйлерінде тегін бас тарту мүмкіндігі.',
      },
      'cmp-4': {
        badge: 'ПАКЕТТІК ТУРЛАР',
        title: '4 елдегі ұшақ + қонақүй пакеттік турларында 20% тиімділік',
        subtitle: 'XML арқылы күн сайын жаңаратын Түркия, Қазақстан, Мысыр және Дубай турлары.',
      },
    },
    transfers: {},
    whyCols: [
      {
        title: 'Қауіпсіз сатып алу',
        desc: 'Әуе билеті, қонақүй және пакеттік турлар халықаралық 3D Secure қауіпсіздік стандарттарымен қорғалған.',
        link: '3D Secure қорғанысы',
      },
      {
        title: 'Тиімді бағалар',
        desc: '500+ әуе компаниясы мен мыңдаған қонақүйді нақты уақытта салыстырып, ең тиімді бағаны ұсынамыз.',
        link: 'Науқандарды көру',
      },
      {
        title: 'Ыңғайлы төлем тәсілдері',
        desc: 'Ұшу, қонақүй және пакеттік турларды халықаралық карталар мен Қазақстан банктері арқылы қауіпсіз төлеңіз.',
        link: 'Барлық науқандар',
      },
      {
        title: '24/7 Байланыс орталығы',
        desc: `Сапарыңыздың әр сәтінде жаныңыздамыз. Билет өзгерту және жедел қолдау: ${PHONE_DISPLAY}`,
        link: 'Қазір қоңырау шалу',
      },
    ],
    aboutFeatures: [
      {
        title: 'Жеке саяхатта сенімді қолдау',
        desc: 'Infinitive Travel кепілдігімен Қазақстан, Түркия, Орталық Азия және Еуропа бойынша 24/7 үздіксіз қолдау көрсетеміз.',
      },
      {
        title: 'Корпоративтік саяхат порталы',
        desc: 'Компанияңыз үшін басшылық мақұлдауы, бюджет лимиттері және бөлім бойынша ашық есептілікпен іссапарларды оңай басқарыңыз.',
      },
    ],
    boarding: {
      fromLbl: 'ҚАЙДАН',
      toLbl: 'ҚАЙДА',
      fromSub: 'Тұрған жеріңіз',
      toSub: 'Армандағы демалыс',
      paxLbl: 'ЖОЛАУШЫ',
      paxVal: 'Сіз',
      supLbl: 'ҚОЛДАУ',
      priceLbl: 'БАҒА',
      priceVal: 'Ең тиімді',
      lineLbl: '24/7 ЖЕЛІ',
    },
    faqs: [
      {
        q: 'FlyToAspan арқылы ұшақ билетін қалай сатып аламын?',
        a: 'Басты беттегі іздеу жолағынан ұшу және қону қалаларын, күнін және жолаушы санын таңдап, «Рейс іздеу» батырмасын басыңыз. Сүзгілерді қолданып, «Пакеттер» бөлімінен жүк пен қайтару шарттарын салыстырып, 3D Secure арқылы билетті бірнеше секундта рәсімдей аласыз.',
      },
      {
        q: 'Қонақүй таңдағанда неге мән беру керек?',
        a: 'Тамақтану түрін (таңғы ас, бәрі қосылған), тегін бас тарту шарттарын, орталыққа қашықтығын және қонақтардың бағалауын тексеруді ұсынамыз. FlyToAspan барлық қонақүйлерде жасырын төлемсіз толық бағаны көрсетеді.',
      },
      {
        q: 'Билетімді қалай қайтаруға немесе күнін өзгертуге болады?',
        a: 'Жоғарғы мәзірдегі «Билеттер» бетінен PNR кодыңыз бен тегіңізді енгізіп, брондауды тексеріңіз. Тариф ережелеріне сай онлайн өтінім бере аласыз немесе 24/7 қолдау желісіне хабарласа аласыз.',
      },
      {
        q: 'Пакеттік турларға не кіреді және бағалар қалай жаңарады?',
        a: 'Пакеттік турларға әуе билеті және таңдаулы қонақүй кіреді. Жүйе күн сайын XML бағаларын тексеріп, 4 түрлі елдің ең тиімді турларын витринаға автоматты түрде шығарады.',
      },
      {
        q: 'Онлайн тіркелуді (check-in) қашан жасай аламын?',
        a: 'Тұрақты (regular) рейстерде онлайн тіркелу ұшуға 24–48 сағат қалғанда ашылады. Чартерлік рейстерде (мысалы, THY charter) онлайн тіркелу болмауы мүмкін. Толық ережелер «Онлайн тіркелу» бетінде берілген.',
      },
    ],
  },
};

export const HomeSections: React.FC<HomeSectionsProps> = ({
  lang,
  currency = 'TRY',
  markup = DEFAULT_MARKUP,
  liveCatalog,
  onSelectDeal,
  onSelectHotelCity,
  onSelectTransferCity,
  onSelectDestinationCode,
  onNavigate,
  onOpenAuth,
}) => {
  const t = TRANSLATIONS[lang].home;
  const loc = CONTENT_I18N[lang];
  const [leftSlide, setLeftSlide] = useState(0);
  const [rightSlide, setRightSlide] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [destTab, setDestTab] = useState<'domestic' | 'intl'>('domestic');
  const [openFaq, setOpenFaq] = useState<number>(0);

  const liveCampaigns = liveCatalog?.coupons
    ? liveCatalog.coupons
        .filter((c) => c.active)
        .map((c, idx) => {
          const base = CAMPAIGNS.find((m) => m.id === c.id || m.code === c.code) ?? CAMPAIGNS[idx % CAMPAIGNS.length];
          return { ...base, id: c.id, code: c.code, title: c.title, category: c.category as typeof base.category, validUntil: c.validUntil, wide: idx % 2 === 0 };
        })
    : CAMPAIGNS;
  const effectiveCampaigns = liveCampaigns.length > 0 ? liveCampaigns : [];
  const wideCampaigns = effectiveCampaigns.filter((c) => c.wide);
  const sideCampaigns = effectiveCampaigns.filter((c) => !c.wide);
  const curLeft = wideCampaigns.length > 0 ? wideCampaigns[leftSlide % wideCampaigns.length] : effectiveCampaigns[0];
  const curRight = sideCampaigns.length > 0 ? sideCampaigns[rightSlide % sideCampaigns.length] : effectiveCampaigns[0];
  const formatCampaignText = (c?: { badge: string; title: string; subtitle: string }) =>
    c
      ? {
          ...c,
          title: c.title.replace(/350\s*TL/gi, formatPrice(350, currency)),
          subtitle: c.subtitle.replace(/350\s*TL/gi, formatPrice(350, currency)),
        }
      : { badge: '', title: '', subtitle: '' };
  const curLeftText = formatCampaignText(curLeft ? (loc.campaigns[curLeft.id] || curLeft) : undefined);
  const curRightText = formatCampaignText(curRight ? (loc.campaigns[curRight.id] || curRight) : undefined);

  const defaultFlightDeals = getFlightDeals(lang, markup).slice(0, 7);
  const flightDeals: FlightDeal[] = liveCatalog?.deals && liveCatalog.deals.length > 0
    ? liveCatalog.deals
        .filter((d) => d.active)
        .map((d) => ({
          id: d.id,
          region: d.region,
          regionColor: resolveRegionColor(d.region),
          fromCity: d.fromCity,
          fromCode: d.fromCode.toUpperCase(),
          toCity: d.toCity,
          toCode: d.toCode.toUpperCase(),
          isoDate: d.date,
          dateLabel: formatDisplayDate(d.date, lang),
          price: d.price,
          image: resolveCityImage(d.toCode || d.toCity, d.image),
          featured: d.featured,
        }))
    : defaultFlightDeals;
  const featuredDeal = flightDeals.find((d) => d.featured) || flightDeals[0];
  const midDeals = flightDeals.filter((d) => d.id !== featuredDeal?.id).slice(0, 6);

  const hotelMult = 1 + (markup.hotelPercent - DEFAULT_MARKUP.hotelPercent) / 100;
  const activeHotelsList = (liveCatalog?.hotels && liveCatalog.hotels.length > 0
    ? liveCatalog.hotels
        .filter((h) => h.active)
        .map((h, idx) => {
          const base = HOTEL_DEALS.find((m) => m.id === h.id) ?? HOTEL_DEALS[idx % HOTEL_DEALS.length];
          return {
            ...base,
            id: h.id,
            country: h.country,
            city: h.city,
            name: h.name,
            stars: h.stars,
            boardType: h.boardType,
            nights: h.nights,
            image: h.image ? resolveCityImage(h.city, h.image) : (HOTEL_DEALS.find((m) => m.id === h.id)?.image ?? resolveCityImage(h.city)),
            price: Math.max(500, Math.round(h.price * hotelMult)),
          };
        })
    : HOTEL_DEALS.map((h) => ({ ...h, country: undefined as string | undefined, price: Math.max(990, Math.round(h.price * hotelMult)) }))
  ).slice(0, 5);

  const featuredHotel = activeHotelsList[0];
  const otherHotels = activeHotelsList.slice(1, 5);

  const DEFAULT_SHOWCASE_TOURS = [
    { id: 'xml-tour-tr-1', country: 'Türkiye', city: 'TÜRKİYE · ANTALYA', title: 'Antalya Ultra Her Şey Dahil Deniz & Aile Paketi', duration: '5 Gece · 6 Gün', includes: 'Gidiş-Dönüş Uçak · 5★ Resort · Her Şey Dahil', quota: 16, price: 16900, image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85', active: true },
    { id: 'xml-tour-eg-1', country: 'Mısır', city: 'MISIR · ŞARM EL-ŞEYH', title: 'Şarm El-Şeyh Kızıldeniz & Mercan Koyu Tatil Paketi', duration: '6 Gece · 7 Gün', includes: 'Charter Uçak · 5★ Resort · Her Şey Dahil', quota: 18, price: 19200, image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=85', active: true },
    { id: 'xml-tour-kz-1', country: 'Kazakistan', city: 'KAZAKİSTAN · ALMATI', title: 'Almatı, Big Almaty Gölü & Shymbulak Kültür Turu', duration: '4 Gece · 5 Gün', includes: 'Gidiş-Dönüş Uçak · 5★ Otel · Rehberli Tur', quota: 14, price: 21400, image: '/images/almaty.jpg', active: true },
    { id: 'xml-tour-ae-1', country: 'BAE', city: 'BAE · DUBAİ', title: 'Dubai Şehir Keşfi, Çöl Safarisi & Marina Paketi', duration: '4 Gece · 5 Gün', includes: 'Gidiş-Dönüş Uçak · 5★ Şehir Oteli · Kahvaltı', quota: 12, price: 22900, image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=85', active: true },
  ];

  const activeToursList = (liveCatalog?.tours && liveCatalog.tours.length > 0
    ? liveCatalog.tours.filter((tr) => tr.active)
    : DEFAULT_SHOWCASE_TOURS
  ).slice(0, 4);

  const trCity = (name: string) => {
    if (loc.cities[name]) return loc.cities[name];
    const byCity = localizeCityName(name, lang);
    if (byCity !== name) return byCity;
    return localizeXmlText(name, lang);
  };
  const trBoard = (bt: string) => loc.boardTypes[bt] || localizeXmlText(bt, lang);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  return (
    <>
      {/* 1. AIRLINE PARTNER LOGO MARQUEE */}
      <section className="ufb-section">
        <div className="container">
          <div className="ufb-top">
            <span className="section-eyebrow" style={{ marginBottom: 0 }}>
              {t.airlinesEyebrow}
            </span>
            <span className="ufb-license">{loc.license}</span>
          </div>
        </div>
        <div className="marquee-shell">
          <div className="marquee-track">
            {[...AIRLINE_MARQUEE, ...AIRLINE_MARQUEE].map((name, i) => (
              <span key={`${name}-${i}`} className="airline-chip">
                <span className="airline-dot" />
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 2. CAMPAIGNS SLIDER */}
      {curLeft && curRight && (
      <section className="ufc-section">
        <div className="container">
          <div className="section-head-row">
            <div>
              <div className="section-eyebrow">{t.campaignsEyebrow}</div>
              <h2 className="section-h2">{t.campaignsTitle}</h2>
            </div>
            <button
              type="button"
              className="gold-underline-link"
              onClick={() => onNavigate('campaigns')}
            >
              {t.allCampaigns} <ArrowRight size={15} />
            </button>
          </div>

          <div className="ufc-grid">
            <div className="ufc-banner" style={{ background: curLeft.gradient }}>
              <img src={curLeft.image} alt={curLeftText.title} className="ufc-banner-img" />
              <div className="ufc-banner-content">
                <span className="ufc-pill">{curLeftText.badge}</span>
                <h3 className="ufc-title">{curLeftText.title}</h3>
                <p className="ufc-sub">{curLeftText.subtitle}</p>
                <button
                  type="button"
                  className="ufc-code-chip"
                  onClick={() => copyCode(curLeft.code)}
                  style={{ cursor: 'pointer' }}
                >
                  <span>
                    {loc.codeLbl}: {curLeft.code}
                  </span>
                  {copiedCode === curLeft.code ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="ufc-controls">
                <div className="ufc-dots">
                  {wideCampaigns.map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`ufc-dot ${idx === leftSlide ? 'active' : ''}`}
                      onClick={() => setLeftSlide(idx)}
                      aria-label={`Kampanya ${idx + 1}`}
                    />
                  ))}
                </div>
                <div className="ufc-arrows">
                  <button
                    type="button"
                    className="ufc-arrow-btn"
                    onClick={() =>
                      setLeftSlide((p) => (p - 1 + wideCampaigns.length) % wideCampaigns.length)
                    }
                    aria-label="Önceki kampanya"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    className="ufc-arrow-btn"
                    onClick={() => setLeftSlide((p) => (p + 1) % wideCampaigns.length)}
                    aria-label="Sonraki kampanya"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="ufc-banner" style={{ background: curRight.gradient }}>
              <img src={curRight.image} alt={curRightText.title} className="ufc-banner-img" />
              <div className="ufc-banner-content">
                <span className="ufc-pill">{curRightText.badge}</span>
                <h3 className="ufc-title" style={{ fontSize: 22 }}>
                  {curRightText.title}
                </h3>
                <p className="ufc-sub">{curRightText.subtitle}</p>
                <button
                  type="button"
                  className="ufc-code-chip"
                  onClick={() => copyCode(curRight.code)}
                  style={{ cursor: 'pointer' }}
                >
                  <span>
                    {loc.codeLbl}: {curRight.code}
                  </span>
                  {copiedCode === curRight.code ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="ufc-controls">
                <div className="ufc-dots">
                  {sideCampaigns.map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`ufc-dot ${idx === rightSlide ? 'active' : ''}`}
                      onClick={() => setRightSlide(idx)}
                      aria-label={`Fırsat ${idx + 1}`}
                    />
                  ))}
                </div>
                <div className="ufc-arrows">
                  <button
                    type="button"
                    className="ufc-arrow-btn"
                    onClick={() =>
                      setRightSlide((p) => (p - 1 + sideCampaigns.length) % sideCampaigns.length)
                    }
                    aria-label="Önceki"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    className="ufc-arrow-btn"
                    onClick={() => setRightSlide((p) => (p + 1) % sideCampaigns.length)}
                    aria-label="Sonraki"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* 3. FIRSAT RADARI */}
      <section className="ufd-section" id="firsat-radari">
        <div className="container">
          <div className="ufd-header">
            <div>
              <span className="ufd-radar-pill">
                <Zap size={13} />
                {t.radarBadge}
              </span>
              <h2 className="ufd-title">{t.radarTitle}</h2>
              <p className="ufd-sub">{t.radarSub}</p>
            </div>
            <span className="ufd-live-pill">
              <span className="live-dot" />
              {t.livePrice}
            </span>
          </div>

          {featuredDeal && (
          <div className="ufd-bento-top">
            <div className="deal-card featured" onClick={() => onSelectDeal(featuredDeal)}>
              <img
                src={featuredDeal.image}
                alt={trCity(featuredDeal.toCity)}
                className="deal-bg-full"
              />
              <div className="deal-featured-overlay" />
              <div className="deal-ribbon">{t.dealOfDay}</div>

              <div className="deal-featured-body">
                <span className={`deal-region-pill ${featuredDeal.regionColor}`}>
                  {loc.regions[featuredDeal.region]}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 14,
                  }}
                >
                  <div>
                    <div className="deal-from">
                      <Plane size={12} /> {trCity(featuredDeal.fromCity)}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.12 }}>
                      {trCity(featuredDeal.toCity)}
                    </div>
                  </div>
                  <span className="deal-date-pill">{featuredDeal.dateLabel}</span>
                </div>

                <div style={{ marginTop: 18 }}>
                  <div className="deal-kisi">{t.perPerson}</div>
                  <div className="deal-price" style={{ fontSize: 28 }}>
                    {formatPrice(featuredDeal.price, currency)}
                  </div>
                  <div className="deal-from-note">{t.startingFrom}</div>
                </div>

                <button type="button" className="deal-buy-btn full">
                  <Zap size={15} />
                  {t.buyNow}
                </button>
              </div>
            </div>

            <div className="ufd-subgrid-6">
              {midDeals.map((d) => (
                <div key={d.id} className="deal-card" onClick={() => onSelectDeal(d)}>
                  <div className="deal-photo-top">
                    <img src={d.image} alt={trCity(d.toCity)} />
                    <div className="deal-photo-shade" />
                    <span
                      className={`deal-region-pill ${d.regionColor}`}
                      style={{ position: 'relative', zIndex: 2, alignSelf: 'flex-start' }}
                    >
                      {loc.regions[d.region]}
                    </span>
                    <div className="deal-photo-row">
                      <div>
                        <div className="deal-from">
                          <Plane size={11} /> {trCity(d.fromCity)}
                        </div>
                        <div className="deal-city">{trCity(d.toCity)}</div>
                      </div>
                      <span className="deal-date-pill">{d.dateLabel}</span>
                    </div>
                  </div>
                  <div className="deal-bottom">
                    <div>
                      <div className="deal-kisi">{t.perPerson}</div>
                      <div className="deal-price">{formatPrice(d.price, currency)}</div>
                    </div>
                    <button type="button" className="deal-buy-btn">
                      <Zap size={12} />
                      {t.quickBuy}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </section>

      {/* 4. CHEAPEST HOTELS */}
      <section className="hotels-section">
        <div className="container">
          <div className="section-head-row">
            <div>
              <div className="section-eyebrow">{t.hotelsEyebrow}</div>
              <h2 className="section-h2">{t.hotelsTitle}</h2>
            </div>
            <p className="section-sub-right">{t.hotelsSub}</p>
          </div>

          {featuredHotel && (
          <div className="hotels-split">
            <div className="hotel-featured-card">
              <img src={featuredHotel.image} alt={featuredHotel.name} />
              <span className="hotel-top-pill">{loc.bestPricePill}</span>

              <div className="hotel-inset-box">
                <div>
                  <div className="hotel-city-stars">
                    <span>{trCity(featuredHotel.city)}</span>
                    <span className="stars-gold">{'★'.repeat(featuredHotel.stars)}</span>
                  </div>
                  <h3 className="hotel-name">{featuredHotel.name}</h3>
                  <div className="hotel-meta">
                    {featuredHotel.nights} {loc.nightsLbl} · {featuredHotel.guests} {loc.guestsLbl}{' '}
                    · {trBoard(featuredHotel.boardType)}
                  </div>
                </div>
                <div className="hotel-price-col">
                  <div className="hotel-total-lbl">{t.total}</div>
                  <div className="hotel-price-val">{formatPrice(featuredHotel.price, currency)}</div>
                  <button
                    type="button"
                    className="hotel-cta-btn"
                    onClick={() => onSelectHotelCity(featuredHotel.city)}
                  >
                    {t.seeHotels}
                  </button>
                </div>
              </div>
            </div>

            <div className="hotel-list">
              {otherHotels.map((h) => (
                <div
                  key={h.id}
                  className="hotel-list-row"
                  onClick={() => onSelectHotelCity(h.city)}
                >
                  <div className="hotel-list-left">
                    <img src={h.image} alt={h.name} className="hotel-thumb" />
                    <div>
                      <div className="hotel-city-stars">
                        <span>{trCity(h.city)}</span>
                        <span className="stars-gold">{'★'.repeat(h.stars)}</span>
                      </div>
                      <div className="hotel-name" style={{ fontSize: 16 }}>
                        {h.name}
                      </div>
                      <div className="hotel-meta">
                        {h.nights} {loc.nightsLbl} · {h.guests} {loc.guestsLbl} ·{' '}
                        {trBoard(h.boardType)}
                      </div>
                    </div>
                  </div>
                  <div className="hotel-price-col">
                    <div className="hotel-total-lbl">{t.total}</div>
                    <div className="hotel-price-val" style={{ fontSize: 18, marginBottom: 4 }}>
                      {formatPrice(h.price, currency)}
                    </div>
                    <span className="hotel-inspect-link">
                      {t.inspect} <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </section>

      {/* 5. PACKAGE TOURS SHOWCASE (4 COUNTRIES · DAILY XML SYNC) */}
      <section className="transfers-section">
        <div className="container">
          <div className="section-head-row">
            <div>
              <div className="section-eyebrow on-dark">{t.transfersEyebrow}</div>
              <h2 className="section-h2 on-dark">{t.transfersTitle}</h2>
            </div>
            <p className="section-sub-right on-dark">{t.transfersSub}</p>
          </div>

          <div className="transfers-grid">
            {activeToursList.map((tour) => (
              <div
                key={tour.id}
                className="transfer-item"
                onClick={() => onNavigate('tour-results')}
              >
                <div className="transfer-tile">
                  <span className="transfer-city-pill">{localizeXmlText(tour.country ? tour.country.toUpperCase() : tour.city, lang)}</span>
                  <img src={resolveCityImage(tour.city, tour.image)} alt={localizeXmlText(tour.title, lang)} />
                </div>
                <div className="transfer-vehicle">{localizeXmlText(tour.title, lang)}</div>
                <div className="transfer-route">{localizeXmlText(tour.city, lang)} · {localizeXmlText(tour.duration, lang)}</div>
                <div className="transfer-specs">
                  {localizeXmlText(tour.includes || 'Uçak + Seçkin Otel Dahil', lang)}
                </div>
                <div className="transfer-price-line">
                  <span className="transfer-price">
                    {formatPrice(tour.price, currency)}
                  </span>
                  <span className="transfer-total">{t.fixedPrice}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="disclaimer-strip">
        <div className="container">{t.disclaimer}</div>
      </div>

      {/* 6. WHY CHOOSE US */}
      <section className="why-section">
        <div className="container">
          <div className="section-head-row">
            <div>
              <div className="section-eyebrow">{t.whyEyebrow}</div>
              <h2 className="section-h2">{t.whyTitle}</h2>
            </div>
            <p className="section-sub-right">{t.whySub}</p>
          </div>

          <div className="why-grid">
            <div className="why-col">
              <div>
                <div className="why-icon-clean teal">
                  <ShieldCheck size={22} strokeWidth={1.9} />
                </div>
                <h3 className="why-title" style={{ marginTop: 16 }}>
                  {loc.whyCols[0].title}
                </h3>
                <p className="why-desc" style={{ marginTop: 8 }}>
                  {loc.whyCols[0].desc}
                </p>
              </div>
              <button type="button" className="why-link" onClick={() => onNavigate('help')}>
                {loc.whyCols[0].link} <ArrowRight size={14} />
              </button>
            </div>

            <div className="why-col">
              <div>
                <div className="why-icon-clean gold">
                  <Tag size={22} strokeWidth={1.9} />
                </div>
                <h3 className="why-title" style={{ marginTop: 16 }}>
                  {loc.whyCols[1].title}
                </h3>
                <p className="why-desc" style={{ marginTop: 8 }}>
                  {loc.whyCols[1].desc}
                </p>
              </div>
              <button type="button" className="why-link" onClick={() => onNavigate('campaigns')}>
                {loc.whyCols[1].link} <ArrowRight size={14} />
              </button>
            </div>

            <div className="why-col">
              <div>
                <div className="why-icon-clean sky">
                  <CreditCard size={22} strokeWidth={1.9} />
                </div>
                <h3 className="why-title" style={{ marginTop: 16 }}>
                  {loc.whyCols[2].title}
                </h3>
                <p className="why-desc" style={{ marginTop: 8 }}>
                  {loc.whyCols[2].desc}
                </p>
              </div>
              <button type="button" className="why-link" onClick={() => onNavigate('campaigns')}>
                {loc.whyCols[2].link} <ArrowRight size={14} />
              </button>
            </div>

            <div className="why-col">
              <div>
                <div className="why-icon-clean green">
                  <PhoneCall size={22} strokeWidth={1.9} />
                </div>
                <h3 className="why-title" style={{ marginTop: 16 }}>
                  {loc.whyCols[3].title}
                </h3>
                <p className="why-desc" style={{ marginTop: 8 }}>
                  {loc.whyCols[3].desc}
                </p>
              </div>
              <a href={PHONE_HREF} className="why-link">
                {loc.whyCols[3].link} <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 7. POPULAR DESTINATIONS (With Animated Curved Flight Trajectories & Radar Network) */}
      <section className="dest-section">
        {/* Background Animated Flight Arcs, Glowing Waypoints & Radar Rings */}
        <svg
          className="dest-bg-svg"
          viewBox="0 0 1440 520"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="dest-node-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#7DD3FC" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </radialGradient>
            <g id="dest-plane-icon">
              <path
                d="M11 0 L3.5 0 L-1.5 -7.5 L-4 -7.5 L-1.2 0 L-6.5 0 L-8.8 -3.2 L-10.5 -3.2 L-9 0 L-10.5 3.2 L-8.8 3.2 L-6.5 0 L-1.2 0 L-4 7.5 L-1.5 7.5 L3.5 0 Z"
                fill="#FFFFFF"
              />
            </g>
          </defs>

          {/* Subtle Concentric Radar Rings on Right */}
          <g stroke="rgba(125, 211, 252, 0.08)" strokeWidth="1" fill="none">
            <circle cx="1090" cy="260" r="110" />
            <circle cx="1090" cy="260" r="190" />
            <circle cx="1090" cy="260" r="275" />
            <circle cx="1090" cy="260" r="365" />
          </g>

          {/* Sweeping Dashed Flight Arcs */}
          <path
            id="dest-arc-1"
            d="M -40 420 Q 520 30 1160 220"
            fill="none"
            stroke="rgba(186, 230, 253, 0.26)"
            strokeWidth="1.5"
            strokeDasharray="4 7"
          />
          <path
            id="dest-arc-2"
            d="M 1380 95 Q 820 355 240 245"
            fill="none"
            stroke="rgba(186, 230, 253, 0.22)"
            strokeWidth="1.4"
            strokeDasharray="4 7"
          />
          <path
            id="dest-arc-3"
            d="M 180 495 Q 690 120 1460 115"
            fill="none"
            stroke="rgba(245, 205, 94, 0.28)"
            strokeWidth="1.5"
            strokeDasharray="3 8"
          />
          <path
            id="dest-arc-4"
            d="M 80 185 Q 520 -25 990 165"
            fill="none"
            stroke="rgba(125, 211, 252, 0.2)"
            strokeWidth="1.3"
            strokeDasharray="4 7"
          />

          {/* Glowing Waypoint Nodes */}
          {[
            [742, 114],
            [486, 174],
            [264, 240],
            [910, 294],
            [718, 304],
            [1212, 235],
          ].map(([cx, cy], idx) => (
            <g key={idx} transform={`translate(${cx}, ${cy})`}>
              <circle r="11" fill="url(#dest-node-glow)" />
              <circle r="2.8" fill="#FFFFFF" />
            </g>
          ))}

          {/* Animated Airplanes Gliding Along the Arcs */}
          <g>
            <line x1="-38" y1="0" x2="-10" y2="0" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
            <use href="#dest-plane-icon" />
            <animateMotion dur="22s" repeatCount="indefinite" rotate="auto" begin="-5s">
              <mpath href="#dest-arc-1" />
            </animateMotion>
          </g>
          <g>
            <line x1="-36" y1="0" x2="-10" y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth="1.4" />
            <use href="#dest-plane-icon" />
            <animateMotion dur="26s" repeatCount="indefinite" rotate="auto" begin="-12s">
              <mpath href="#dest-arc-2" />
            </animateMotion>
          </g>
          <g>
            <line x1="-36" y1="0" x2="-10" y2="0" stroke="rgba(245,205,94,0.55)" strokeWidth="1.4" />
            <use href="#dest-plane-icon" />
            <animateMotion dur="24s" repeatCount="indefinite" rotate="auto" begin="-8s">
              <mpath href="#dest-arc-3" />
            </animateMotion>
          </g>
        </svg>

        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="section-head-row">
            <div>
              <h2 className="section-h2 on-dark">{t.destTitle}</h2>
              <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.76)', fontSize: 14.5 }}>
                {t.destSub}
              </p>
            </div>

            <div className="dest-toggle">
              <button
                type="button"
                className={`dest-toggle-btn ${destTab === 'domestic' ? 'active' : ''}`}
                onClick={() => setDestTab('domestic')}
              >
                <Home size={15} />
                {t.domestic}
              </button>
              <button
                type="button"
                className={`dest-toggle-btn ${destTab === 'intl' ? 'active' : ''}`}
                onClick={() => setDestTab('intl')}
              >
                <Globe size={15} />
                {t.international}
              </button>
            </div>
          </div>

          <div className="dest-board">
            {(destTab === 'domestic' ? POPULAR_DOMESTIC : POPULAR_INTERNATIONAL).map((item) => (
              <button
                key={item.code}
                type="button"
                className="dest-row"
                onClick={() => onSelectDestinationCode(item.code)}
              >
                <span className="dest-row-left">
                  <span className="dest-iata">{item.code}</span>
                  <span className="dest-city">{trCity(item.city)}</span>
                </span>
                <ArrowRight size={17} className="dest-arrow" />
              </button>
            ))}
          </div>

          <div className="dest-footnote">
            <span style={{ color: 'var(--aspan-sky-light)', marginRight: 6 }}>❖</span>
            {t.destFoot}
          </div>
        </div>
      </section>

      {/* 8. ABOUT & CORPORATE + TILTED BOARDING PASS */}
      <section className="about-section" id="hakkimizda">
        <div className="container">
          <div className="about-grid">
            <div>
              <div className="section-eyebrow">{t.aboutEyebrow}</div>
              <h2 className="about-h2">{t.aboutTitle}</h2>
              <p className="about-lead">{t.aboutLead}</p>

              <div className="about-feature">
                <div className="about-feature-icon">
                  <Building2 size={20} />
                </div>
                <div>
                  <h4>{loc.aboutFeatures[0].title}</h4>
                  <p>{loc.aboutFeatures[0].desc}</p>
                </div>
              </div>

              <div className="about-feature">
                <div className="about-feature-icon">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h4>{loc.aboutFeatures[1].title}</h4>
                  <p>{loc.aboutFeatures[1].desc}</p>
                </div>
              </div>

              <div className="about-actions">
                <button
                  type="button"
                  className="u4-submit-btn"
                  style={{ height: 48, padding: '0 24px', fontSize: 14 }}
                  onClick={() => onNavigate('help')}
                >
                  {t.learnMore} <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="gold-underline-link"
                  style={{ color: 'var(--aspan-teal-deep)' }}
                  onClick={() => onOpenAuth('login')}
                >
                  {t.corpInspect}
                </button>
              </div>
            </div>

            <div className="boarding-stage">
              <div className="boarding-backing" aria-hidden="true" />
              <div className="boarding-card">
                <div className="boarding-top">
                  <span style={{ fontSize: 13.5, letterSpacing: '0.16em' }}>FLYTOASPAN</span>
                  <span style={{ fontSize: 10.5, letterSpacing: '0.14em', opacity: 0.92 }}>
                    {t.boardingPass}
                  </span>
                </div>

                <div className="boarding-body">
                  <div className="boarding-route">
                    <div>
                      <div className="boarding-meta-lbl">{loc.boarding.fromLbl}</div>
                      <div className="boarding-code">{t.boardingFrom}</div>
                      <div className="boarding-loc">{loc.boarding.fromSub}</div>
                    </div>

                    <div className="boarding-plane-line" aria-hidden="true">
                      <span className="boarding-dash-side" />
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#DDA838">
                        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" transform="rotate(90 12 12)" />
                      </svg>
                      <span className="boarding-dash-side" />
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="boarding-meta-lbl">{loc.boarding.toLbl}</div>
                      <div className="boarding-code">{t.boardingTo}</div>
                      <div className="boarding-loc">{loc.boarding.toSub}</div>
                    </div>
                  </div>

                  <div className="boarding-meta-grid">
                    <div>
                      <div className="boarding-meta-lbl">{loc.boarding.paxLbl}</div>
                      <div className="boarding-meta-val">{loc.boarding.paxVal}</div>
                    </div>
                    <div>
                      <div className="boarding-meta-lbl">{loc.boarding.supLbl}</div>
                      <div className="boarding-meta-val">7/24</div>
                    </div>
                    <div>
                      <div className="boarding-meta-lbl">{loc.boarding.priceLbl}</div>
                      <div className="boarding-meta-val">
                        {loc.boarding.priceVal}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="boarding-tear" />

                <div className="boarding-stub">
                  <svg width="196" height="42" viewBox="0 0 196 42" aria-hidden="true">
                    {[
                      0, 3, 7, 10, 15, 18, 21, 26, 29, 34, 38, 41, 45, 50, 53, 57, 62, 65, 69, 74,
                      77, 81, 86, 90, 93, 98, 101, 105, 110, 114, 117, 122, 126, 129, 134, 138, 141,
                      146, 149, 154, 158, 161, 166, 170, 174, 178, 183, 186, 190, 194,
                    ].map((x, idx) => (
                      <rect
                        key={x}
                        x={x}
                        y="0"
                        width={idx % 4 === 0 ? 2.6 : idx % 2 === 0 ? 1.6 : 1}
                        height="42"
                        fill="#0B2233"
                      />
                    ))}
                  </svg>
                  <div style={{ textAlign: 'right' }}>
                    <div className="boarding-phone">{PHONE_SHORT}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. SOLUTION PARTNERS */}
      <section className="partners-section">
        <div className="container">
          <div className="partners-heading">{t.partnersHeading}</div>
        </div>
        <div className="marquee-shell">
          <div className="marquee-track" style={{ animationDuration: '42s' }}>
            {[...SOLUTION_PARTNERS, ...SOLUTION_PARTNERS].map((p, i) => (
              <span key={`${p}-${i}`} className="airline-chip">
                <span className="airline-dot" style={{ background: 'var(--aspan-sky)' }} />
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 10. FAQ ACCORDION */}
      <section className="faq-section">
        <div className="container">
          <div className="faq-grid">
            <div className="faq-sticky">
              <h2 className="faq-big-title">
                {t.faqTitle1}
                <span>{t.faqTitle2}</span>
              </h2>
              <div className="faq-big-qmark" aria-hidden="true">
                ?
              </div>
            </div>

            <div>
              {loc.faqs.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={item.q} className="faq-item">
                    <button
                      type="button"
                      className={`faq-q-btn ${isOpen ? 'open' : ''}`}
                      onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    >
                      <span>{item.q}</span>
                      <span className="faq-plus">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && <div className="faq-a">{item.a}</div>}
                  </div>
                );
              })}

              <div className="faq-cta-bar">
                <div>
                  <div className="faq-cta-title">{t.faqCtaTitle}</div>
                  <div className="faq-cta-sub">{t.faqCtaSub}</div>
                </div>
                <div className="faq-cta-btns">
                  <a href={PHONE_HREF} className="btn-white-pill">
                    <Phone size={15} color="#00A8B5" />
                    {PHONE_DISPLAY}
                  </a>
                  <a href={WA_HREF} target="_blank" rel="noreferrer" className="btn-wa-pill">
                    <MessageCircle size={15} />
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
