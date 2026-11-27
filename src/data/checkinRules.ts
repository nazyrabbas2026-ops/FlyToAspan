import type { LangCode } from '../types';

export interface AirlineCheckinRuleRow {
  code: string;
  airline: string;
  charterOnlineCheckIn: string;
  charterSeatRule: string;
  regularOnlineCheckIn: string;
  regularSeatRule: string;
  notes: string;
}

export interface CheckinRulesContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  charterBadge: string;
  charterTitle: string;
  charterLead: string;
  charterPoints: Array<{ heading: string; detail: string }>;
  regularBadge: string;
  regularTitle: string;
  regularLead: string;
  regularPoints: Array<{ heading: string; detail: string }>;
  tableTitle: string;
  tableSub: string;
  cols: [string, string, string, string, string];
  rows: AirlineCheckinRuleRow[];
  updateBanner: string;
}

export const CHECKIN_RULES_BY_LANG: Record<LangCode, CheckinRulesContent> = {
  TR: {
    eyebrow: 'ÖNEMLİ BİLGİLENDİRME · CHECK-IN KURALLARI',
    title: 'Charter ve Regular (Tarifeli) Uçuşlarda Online Check-In Kuralları',
    subtitle:
      'Biletinizin charter (tur operatörü / özel sefer) veya regular (tarifeli) olmasına göre online check-in ve koltuk seçimi kuralları farklılık gösterir.',
    charterBadge: 'CHARTER UÇUŞLAR',
    charterTitle: 'Charter (Özel / Tur Operatörü) Sefer Kuralları',
    charterLead:
      'Tur operatörleri tarafından kiralanan charter seferlerde online check-in ve ücretsiz koltuk seçimi çoğu havayolunda kapalıdır.',
    charterPoints: [
      {
        heading: 'Turkish Airlines (THY) Charter Seferleri',
        detail:
          'THY charter uçuşlarında online check-in bulunmamaktadır. Check-in ve biniş kartı işlemleri yalnızca havalimanı kontuarında pasaport ile yapılır; koltuk seçimi ücretlidir.',
      },
      {
        heading: 'Koltuk Seçimi & Yan Yana Oturma',
        detail:
          'Charter uçuşlarda standart koltuklar havalimanı kontuarında sistem tarafından atanır. Ön sıra, acil çıkış veya özel koltuk seçimleri havayoluna göre ücretlidir.',
      },
      {
        heading: 'Havalimanı Kontuar Saati',
        detail:
          'Uluslararası charter seferlerde check-in kontuarları genellikle kalkıştan 3 saat önce açılır ve 60 dakika kala kapanır.',
      },
      {
        heading: 'Bilet & PNR Bilgisi',
        detail:
          'Charter biletler genellikle uçuştan 24–48 saat önce kesilerek tarafınıza iletilir; kontuarda pasaportunuzla doğrudan işlem yapabilirsiniz.',
      },
    ],
    regularBadge: 'REGULAR (TARİFELİ) UÇUŞLAR',
    regularTitle: 'Tarifeli (Regular) Sefer Kuralları',
    regularLead:
      'Havayollarının düzenli tarifeli seferlerinde PNR kodunuz ve soyadınızla kalkıştan 24–48 saat önce online check-in yapabilirsiniz.',
    regularPoints: [
      {
        heading: 'Online Check-In Açılış & Kapanış',
        detail:
          'Çoğu tarifeli havayolunda online check-in uçuştan 24 ila 48 saat önce açılır, iç hatlarda 45–60 dakika, dış hatlarda 60–90 dakika kala kapanır.',
      },
      {
        heading: 'Dijital Biniş Kartı & Bagaj Teslimi',
        detail:
          'Online check-in sonrası dijital biniş kartınızı telefonunuza indirip havalimanında yalnızca bagaj teslim (Bag Drop) kontuarına uğrayabilirsiniz.',
      },
      {
        heading: 'Koltuk Seçimi Politikası',
        detail:
          'Standart koltuklar tarife paketine göre (Eco / Extra / Prime / Business) ücretsiz veya ücretli sunulur; ekstra diz mesafesi koltukları ücretlidir.',
      },
      {
        heading: 'Vize & Pasaport Kontrolü',
        detail:
          'Vize veya belge kontrolü gerektiren uluslararası uçuşlarda online check-in yapılsa dahi biniş kartı onayı için kontuara uğramanız istenebilir.',
      },
    ],
    tableTitle: 'Havayolu Bazlı Charter & Regular Check-In Özeti',
    tableSub: 'Havayollarına göre genel uygulama özeti (güncel detaylar operasyon ekibimiz tarafından güncellenir).',
    cols: ['Havayolu', 'Charter Online Check-In', 'Charter Koltuk Seçimi', 'Regular Online Check-In', 'Notlar'],
    rows: [
      {
        code: 'TK',
        airline: 'Turkish Airlines (THY)',
        charterOnlineCheckIn: 'Yok (Sadece Kontuar)',
        charterSeatRule: 'Ücretli',
        regularOnlineCheckIn: '24 saat önce açılır',
        regularSeatRule: 'Pakete göre ücretsiz / ücretli',
        notes: 'Charter seferlerde tüm işlemler havalimanı kontuarından yapılır.',
      },
      {
        code: 'KC',
        airline: 'Air Astana',
        charterOnlineCheckIn: 'Sefere göre kontuardan',
        charterSeatRule: 'Ücretli / Kontuarda atama',
        regularOnlineCheckIn: '36 saat önce açılır',
        regularSeatRule: 'Ücretli / Check-in’de standart',
        notes: 'MySEAT ile tarifeli seferlerde erken koltuk seçimi yapılabilir.',
      },
      {
        code: 'DV',
        airline: 'SCAT Airlines',
        charterOnlineCheckIn: 'Çoğunlukla Kontuar',
        charterSeatRule: 'Ücretli',
        regularOnlineCheckIn: '24 saat önce açılır',
        regularSeatRule: 'Ücretli / Kontuarda atama',
        notes: 'Kazakistan–Türkiye charter seferlerinde pasaport ile kontuar check-in.',
      },
      {
        code: 'XQ',
        airline: 'SunExpress',
        charterOnlineCheckIn: 'Sınırlı / Kontuar',
        charterSeatRule: 'Ücretli',
        regularOnlineCheckIn: '36 saat önce açılır',
        regularSeatRule: 'Ücretli / Rastgele atama',
        notes: 'Tur operatörü PNR kodları için kalkıştan 24 saat önce kontrol önerilir.',
      },
      {
        code: 'PC',
        airline: 'Pegasus Airlines',
        charterOnlineCheckIn: 'Kontuar (Özel sefer)',
        charterSeatRule: 'Ücretli',
        regularOnlineCheckIn: '72 saat önce açılır',
        regularSeatRule: 'Ücretli / Otomatik atama',
        notes: 'Tarifeli seferlerde mobil uygulama üzerinden hızlı biniş kartı.',
      },
      {
        code: 'XC',
        airline: 'Corendon Airlines',
        charterOnlineCheckIn: 'Sefere göre değişir',
        charterSeatRule: 'Ücretli',
        regularOnlineCheckIn: '72 saat önce açılır',
        regularSeatRule: 'Ücretli',
        notes: 'Charter blok koltuklarda kalkıştan 3 saat önce kontuarda olun.',
      },
    ],
    updateBanner:
      'Not: Havayolu charter ve regular check-in kuralları sezona ve operatöre göre değişiklik gösterebilir. Uçuşunuz özelinde kesin bilgi almak için 7/24 WhatsApp destek hattımızdan PNR kodunuzla bilgi alabilirsiniz.',
  },
  EN: {
    eyebrow: 'IMPORTANT NOTICE · CHECK-IN RULES',
    title: 'Online Check-In Rules for Charter & Regular (Scheduled) Flights',
    subtitle:
      'Online check-in availability and seat selection rules differ depending on whether your ticket is a charter or a regular scheduled flight.',
    charterBadge: 'CHARTER FLIGHTS',
    charterTitle: 'Charter (Tour Operator) Flight Rules',
    charterLead:
      'On charter flights operated for tour operators, online check-in and complimentary seat selection are generally unavailable.',
    charterPoints: [
      {
        heading: 'Turkish Airlines (THY) Charter Flights',
        detail:
          'Online check-in is NOT available on Turkish Airlines charter flights. Check-in is completed exclusively at the airport counter with your passport, and seat selection is paid.',
      },
      {
        heading: 'Seat Selection & Seating Together',
        detail:
          'Standard seats on charter flights are assigned at the airport check-in desk. Preferred, front-row, or extra-legroom seats require an additional fee.',
      },
      {
        heading: 'Airport Counter Arrival Time',
        detail:
          'For international charter flights, check-in desks typically open 3 hours before departure and close 60 minutes prior to takeoff.',
      },
      {
        heading: 'Ticket Issuance & PNR',
        detail:
          'Charter tickets are typically issued 24–48 hours before departure; you may check in directly at the airport counter using your passport.',
      },
    ],
    regularBadge: 'REGULAR (SCHEDULED) FLIGHTS',
    regularTitle: 'Regular Scheduled Flight Rules',
    regularLead:
      'On scheduled flights, online check-in opens 24–48 hours before departure via your airline’s official portal using your PNR and last name.',
    regularPoints: [
      {
        heading: 'Opening & Closing Window',
        detail:
          'Most scheduled carriers open online check-in 24–48 hours prior to departure and close it 60–90 minutes before international flights.',
      },
      {
        heading: 'Mobile Boarding Pass & Bag Drop',
        detail:
          'Download your digital boarding pass after online check-in and proceed straight to the Bag Drop counter if traveling with checked luggage.',
      },
      {
        heading: 'Seat Selection Policy',
        detail:
          'Depending on your fare bundle (Eco / Extra / Prime / Business), standard seat selection may be free or paid; extra-legroom seats are paid.',
      },
      {
        heading: 'Document & Visa Verification',
        detail:
          'On routes requiring visa or document checks, the airline may still require a quick airport desk verification before issuing a boarding pass.',
      },
    ],
    tableTitle: 'Airline Summary: Charter vs. Regular Check-In',
    tableSub: 'Quick overview by airline (rules are kept updated by our operations team).',
    cols: ['Airline', 'Charter Online Check-In', 'Charter Seat Selection', 'Regular Online Check-In', 'Notes'],
    rows: [
      {
        code: 'TK',
        airline: 'Turkish Airlines (THY)',
        charterOnlineCheckIn: 'Not Available (Counter Only)',
        charterSeatRule: 'Paid',
        regularOnlineCheckIn: 'Opens 24h before',
        regularSeatRule: 'Fare-dependent',
        notes: 'All charter check-in procedures are handled at the airport counter.',
      },
      {
        code: 'KC',
        airline: 'Air Astana',
        charterOnlineCheckIn: 'Airport counter (flight-dependent)',
        charterSeatRule: 'Paid / Assigned at desk',
        regularOnlineCheckIn: 'Opens 36h before',
        regularSeatRule: 'Paid / Standard at check-in',
        notes: 'Advance seat selection available via MySEAT on regular flights.',
      },
      {
        code: 'DV',
        airline: 'SCAT Airlines',
        charterOnlineCheckIn: 'Counter Only (Most routes)',
        charterSeatRule: 'Paid',
        regularOnlineCheckIn: 'Opens 24h before',
        regularSeatRule: 'Paid / Assigned at desk',
        notes: 'Passport check-in at airport counter for KZ–TR charter routes.',
      },
      {
        code: 'XQ',
        airline: 'SunExpress',
        charterOnlineCheckIn: 'Limited / Counter',
        charterSeatRule: 'Paid',
        regularOnlineCheckIn: 'Opens 36h before',
        regularSeatRule: 'Paid / Auto-assigned',
        notes: 'Verify tour operator PNR 24h prior to departure.',
      },
      {
        code: 'PC',
        airline: 'Pegasus Airlines',
        charterOnlineCheckIn: 'Airport Counter',
        charterSeatRule: 'Paid',
        regularOnlineCheckIn: 'Opens 72h before',
        regularSeatRule: 'Paid / Auto-assigned',
        notes: 'Fast mobile boarding pass on scheduled flights.',
      },
      {
        code: 'XC',
        airline: 'Corendon Airlines',
        charterOnlineCheckIn: 'Flight-dependent',
        charterSeatRule: 'Paid',
        regularOnlineCheckIn: 'Opens 72h before',
        regularSeatRule: 'Paid',
        notes: 'Arrive at airport desk 3 hours before charter departure.',
      },
    ],
    updateBanner:
      'Note: Charter and regular check-in rules may vary by season and tour operator. Contact our 24/7 WhatsApp support with your PNR for flight-specific confirmation.',
  },
  RU: {
    eyebrow: 'ВАЖНАЯ ИНФОРМАЦИЯ · ПРАВИЛА РЕГИСТРАЦИИ',
    title: 'Правила онлайн-регистрации на чартерные и регулярные рейсы',
    subtitle:
      'Условия онлайн-регистрации и выбора мест отличаются для чартерных (туроператорских) и регулярных рейсов.',
    charterBadge: 'ЧАРТЕРНЫЕ РЕЙСЫ',
    charterTitle: 'Правила для чартерных рейсов (Charter)',
    charterLead:
      'На большинстве чартерных рейсов онлайн-регистрация недоступна, а выбор места оплачивается отдельно.',
    charterPoints: [
      {
        heading: 'Чартерные рейсы Turkish Airlines (THY)',
        detail:
          'На чартерных рейсах Turkish Airlines онлайн-регистрация отсутствует. Регистрация проходит только на стойке в аэропорту по паспорту, выбор места — платный.',
      },
      {
        heading: 'Выбор мест в салоне',
        detail:
          'На чартерных рейсах стандартные места назначаются на стойке регистрации. Выбор конкретных мест или мест повышенной комфортности является платным.',
      },
      {
        heading: 'Прибытие в аэропорт',
        detail:
          'На международные чартерные рейсы регистрация открывается за 3 часа и закрывается за 60 минут до вылета.',
      },
      {
        heading: 'Выписка чартерных билетов',
        detail:
          'Билеты на чартер обычно оформляются за 24–48 часов до вылета; для регистрации в аэропорту достаточно паспорта.',
      },
    ],
    regularBadge: 'РЕГУЛЯРНЫЕ РЕЙСЫ',
    regularTitle: 'Правила для регулярных рейсов (Regular)',
    regularLead:
      'На регулярных рейсах онлайн-регистрация открывается за 24–48 часов до вылета по коду PNR и фамилии пассажира.',
    regularPoints: [
      {
        heading: 'Время открытия и закрытия',
        detail:
          'У большинства авиакомпаний регистрация открывается за 24–48 часов и закрывается за 60–90 минут до вылета.',
      },
      {
        heading: 'Электронный посадочный и багаж',
        detail:
          'После онлайн-регистрации скачайте посадочный талон и сдайте багаж на стойке Bag Drop в аэропорту.',
      },
      {
        heading: 'Выбор места по тарифу',
        detail:
          'В зависимости от тарифа (Eco / Extra / Prime / Business) стандартное место может быть бесплатным или платным.',
      },
      {
        heading: 'Проверка документов',
        detail:
          'На направлениях с визовым контролем авиакомпания может попросить предъявить документы на стойке.',
      },
    ],
    tableTitle: 'Сводка по авиакомпаниям: Charter и Regular',
    tableSub: 'Основные правила регистрации и выбора мест по ключевым перевозчикам.',
    cols: ['Авиакомпания', 'Charter Check-In', 'Выбор места (Charter)', 'Regular Check-In', 'Примечание'],
    rows: [
      {
        code: 'TK',
        airline: 'Turkish Airlines (THY)',
        charterOnlineCheckIn: 'Нет (только в аэропорту)',
        charterSeatRule: 'Платно',
        regularOnlineCheckIn: 'За 24 часа',
        regularSeatRule: 'По условиям тарифа',
        notes: 'На чартерных рейсах регистрация проходит строго на стойке.',
      },
      {
        code: 'KC',
        airline: 'Air Astana',
        charterOnlineCheckIn: 'На стойке (зависит от рейса)',
        charterSeatRule: 'Платно / на стойке',
        regularOnlineCheckIn: 'За 36 часов',
        regularSeatRule: 'Платно / стандарт при рег.',
        notes: 'На регулярных рейсах доступен сервис MySEAT.',
      },
      {
        code: 'DV',
        airline: 'SCAT Airlines',
        charterOnlineCheckIn: 'Только в аэропорту',
        charterSeatRule: 'Платно',
        regularOnlineCheckIn: 'За 24 часа',
        regularSeatRule: 'Платно / на стойке',
        notes: 'Чартеры Казахстан–Турция: регистрация на стойке по паспорту.',
      },
      {
        code: 'XQ',
        airline: 'SunExpress',
        charterOnlineCheckIn: 'Ограничено / в аэропорту',
        charterSeatRule: 'Платно',
        regularOnlineCheckIn: 'За 36 часов',
        regularSeatRule: 'Платно / авто-выбор',
        notes: 'Рекомендуем уточнять PNR туроператора за 24 часа.',
      },
      {
        code: 'PC',
        airline: 'Pegasus Airlines',
        charterOnlineCheckIn: 'В аэропорту',
        charterSeatRule: 'Платно',
        regularOnlineCheckIn: 'За 72 часа',
        regularSeatRule: 'Платно / авто-выбор',
        notes: 'Удобный мобильный посадочный на регулярных рейсах.',
      },
      {
        code: 'XC',
        airline: 'Corendon Airlines',
        charterOnlineCheckIn: 'Зависит от рейса',
        charterSeatRule: 'Платно',
        regularOnlineCheckIn: 'За 72 часа',
        regularSeatRule: 'Платно',
        notes: 'Рекомендуем прибывать на стойку за 3 часа до вылета.',
      },
    ],
    updateBanner:
      'Примечание: правила чартерных и регулярных рейсов могут меняться в зависимости от сезона и туроператора. Уточняйте детали по вашему PNR в нашей поддержке WhatsApp 24/7.',
  },
  KK: {
    eyebrow: 'МАҢЫЗДЫ АҚПАРАТ · ТІРКЕЛУ ЕРЕЖЕЛЕРІ',
    title: 'Чартерлік және Тұрақты (Regular) рейстердегі онлайн тіркелу ережелері',
    subtitle:
      'Билетіңіздің чартерлік немесе тұрақты (regular) рейс болуына байланысты онлайн тіркелу және орын таңдау шарттары өзгереді.',
    charterBadge: 'ЧАРТЕРЛІК РЕЙСТЕР',
    charterTitle: 'Чартерлік (Туроператор) рейс ережелері',
    charterLead:
      'Чартерлік рейстердің көбінде онлайн тіркелу қолжетімсіз және орын таңдау ақылы болады.',
    charterPoints: [
      {
        heading: 'Turkish Airlines (THY) Чартерлік рейстері',
        detail:
          'THY чартерлік рейстерінде онлайн тіркелу жоқ. Тіркелу тек әуежай тірегінде төлқұжат арқылы жасалады, орын таңдау ақылы.',
      },
      {
        heading: 'Орын таңдау шарттары',
        detail:
          'Чартерлік рейстерде орындар әуежай тірегінде тағайындалады. Алдыңғы немесе қосымша кең орындар ақылы.',
      },
      {
        heading: 'Әуежайға келу уақыты',
        detail:
          'Халықаралық чартерлік рейстерде тіркелу ұшуға 3 сағат қалғанда ашылып, 60 минут қалғанда жабылады.',
      },
      {
        heading: 'Билет және PNR',
        detail:
          'Чартер билеттері әдетте ұшуға 24–48 сағат қалғанда рәсімделеді; тіректе төлқұжатыңызбен тіркеле аласыз.',
      },
    ],
    regularBadge: 'ТҰРАҚТЫ (REGULAR) РЕЙСТЕР',
    regularTitle: 'Тұрақты (Regular) рейс ережелері',
    regularLead:
      'Тұрақты рейстерде PNR коды мен тегіңіз арқылы ұшуға 24–48 сағат қалғанда онлайн тіркеле аласыз.',
    regularPoints: [
      {
        heading: 'Ашылу және жабылу уақыты',
        detail:
          'Көптеген тұрақты әуе компанияларында онлайн тіркелу 24–48 сағат бұрын ашылып, 60–90 минут қалғанда жабылады.',
      },
      {
        heading: 'Электронды талон және жолжүк',
        detail:
          'Онлайн тіркелген соң сандық отырғызу талонын жүктеп, әуежайда тек Bag Drop тірегіне жолжүгіңізді тапсырасыз.',
      },
      {
        heading: 'Орын таңдау саясаты',
        detail:
          'Тариф пакетіне (Eco / Extra / Prime / Business) қарай стандартты орын тегін немесе ақылы беріледі.',
      },
      {
        heading: 'Құжаттарды тексеру',
        detail:
          'Виза немесе құжат тексерісі қажет халықаралық бағыттарда тіректе растау талап етілуі мүмкін.',
      },
    ],
    tableTitle: 'Әуе компаниялары бойынша Charter және Regular кестесі',
    tableSub: 'Негізгі тасымалдаушылар бойынша тіркелу және орын таңдау қысқаша ережелері.',
    cols: ['Әуе компаниясы', 'Charter Check-In', 'Charter Орын таңдау', 'Regular Check-In', 'Ескертпе'],
    rows: [
      {
        code: 'TK',
        airline: 'Turkish Airlines (THY)',
        charterOnlineCheckIn: 'Жоқ (Тек әуежай тірегі)',
        charterSeatRule: 'Ақылы',
        regularOnlineCheckIn: '24 сағат бұрын',
        regularSeatRule: 'Тарифке байланысты',
        notes: 'Чартер рейстерде барлық тіркелу әуежай тірегінде жасалады.',
      },
      {
        code: 'KC',
        airline: 'Air Astana',
        charterOnlineCheckIn: 'Тіректе (рейске байланысты)',
        charterSeatRule: 'Ақылы / Тіректе беріледі',
        regularOnlineCheckIn: '36 сағат бұрын',
        regularSeatRule: 'Ақылы / Тіркелуде стандарт',
        notes: 'Тұрақты рейстерде MySEAT қызметі қолжетімді.',
      },
      {
        code: 'DV',
        airline: 'SCAT Airlines',
        charterOnlineCheckIn: 'Негізінен әуежай тірегі',
        charterSeatRule: 'Ақылы',
        regularOnlineCheckIn: '24 сағат бұрын',
        regularSeatRule: 'Ақылы / Тіректе беріледі',
        notes: 'Қазақстан–Түркия чартерлерінде төлқұжатпен тіректе тіркелу.',
      },
      {
        code: 'XQ',
        airline: 'SunExpress',
        charterOnlineCheckIn: 'Шектеулі / Тіректе',
        charterSeatRule: 'Ақылы',
        regularOnlineCheckIn: '36 сағат бұрын',
        regularSeatRule: 'Ақылы / Автоматты',
        notes: 'Ұшуға 24 сағат қалғанда PNR тексеру ұсынылады.',
      },
      {
        code: 'PC',
        airline: 'Pegasus Airlines',
        charterOnlineCheckIn: 'Әуежай тірегі',
        charterSeatRule: 'Ақылы',
        regularOnlineCheckIn: '72 сағат бұрын',
        regularSeatRule: 'Ақылы / Автоматты',
        notes: 'Тұрақты рейстерде жылдам мобильді отырғызу талоны.',
      },
      {
        code: 'XC',
        airline: 'Corendon Airlines',
        charterOnlineCheckIn: 'Рейске байланысты',
        charterSeatRule: 'Ақылы',
        regularOnlineCheckIn: '72 сағат бұрын',
        regularSeatRule: 'Ақылы',
        notes: 'Чартер рейстерге 3 сағат бұрын келу ұсынылады.',
      },
    ],
    updateBanner:
      'Ескертпе: Чартерлік және тұрақты рейс ережелері маусым мен туроператорға байланысты өзгеруі мүмкін. Нақты ақпарат үшін 24/7 WhatsApp қолдау қызметіне PNR кодыңызбен хабарласыңыз.',
  },
};
