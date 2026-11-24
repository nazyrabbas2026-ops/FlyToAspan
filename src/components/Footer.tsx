import React, { useEffect, useState } from 'react';
import {
  Phone,
  MessageCircle,
  ArrowUp,
  Cookie,
  ShieldCheck,
  Award,
  CreditCard,
  Headphones,
  Plane,
  CheckCircle2,
} from 'lucide-react';
import { PHONE_DISPLAY, PHONE_HREF, PHONE_SHORT, TRANSLATIONS, WA_HREF } from '../i18n/translations';
import { LangCode, LegalDocKey, PageView, SearchTab } from '../types';

interface FooterProps {
  lang: LangCode;
  canManage?: boolean;
  onNavigate: (page: PageView) => void;
  onJumpToTab: (tab: SearchTab) => void;
  onOpenLegal?: (doc: LegalDocKey) => void;
}

const FOOTER_LINKS_I18N: Record<
  LangCode,
  {
    locations: string;
    corpLinks: [string, string, string, string];
    srvLinks: [string, string, string, string];
    privLinks: [string, string, string, string];
    tursabBadge: string;
    sslNote: string;
  }
> = {
  TR: {
    locations: 'Infinitive Travel · İstanbul, Türkiye & Almatı, Kazakistan',
    corpLinks: ['Hakkımızda', 'Kampanyalar', 'Online Check-In', 'Yardım & SSS'],
    srvLinks: [
      'Yurt İçi & Yurt Dışı Uçak Bileti',
      'Otel Konaklama Hizmetleri',
      'Havalimanı & VIP Transfer',
      'Bilet İşlemleri & İptal',
    ],
    privLinks: [
      'Kullanım Koşulları',
      'Kişisel Verilerin Korunması (KVKK)',
      'Ticari Elektronik İleti Onayı',
      'Çerez Aydınlatma Metni',
    ],
    tursabBadge: 'TÜRSAB A Grubu Acente',
    sslNote: 'FlyToAspan by Infinitive Travel — 3D Secure 256-Bit SSL Koruma',
  },
  EN: {
    locations: 'Infinitive Travel · Istanbul, Turkey & Almaty, Kazakhstan',
    corpLinks: ['About Us', 'Deals & Offers', 'Online Check-In', 'Help & FAQ'],
    srvLinks: [
      'Domestic & International Flights',
      'Hotel Accommodation Services',
      'Airport & VIP Transfer',
      'Manage Booking & Cancellations',
    ],
    privLinks: [
      'Terms of Use',
      'Personal Data Protection (GDPR / KVKK)',
      'Commercial Electronic Message Consent',
      'Cookie Policy',
    ],
    tursabBadge: 'TURSAB Class A Agency',
    sslNote: 'FlyToAspan by Infinitive Travel — 3D Secure 256-Bit SSL Protection',
  },
  RU: {
    locations: 'Infinitive Travel · Стамбул, Турция и Алматы, Казахстан',
    corpLinks: ['О компании', 'Акции и скидки', 'Онлайн-регистрация', 'Помощь и FAQ'],
    srvLinks: [
      'Внутренние и международные авиабилеты',
      'Бронирование отелей',
      'VIP-трансфер из аэропорта',
      'Управление билетами и возврат',
    ],
    privLinks: [
      'Условия использования',
      'Защита персональных данных',
      'Согласие на рассылку',
      'Политика файлов Cookie',
    ],
    tursabBadge: 'Агентство TURSAB класса A',
    sslNote: 'FlyToAspan by Infinitive Travel — Защита 3D Secure 256-Bit SSL',
  },
  KK: {
    locations: 'Infinitive Travel · Ыстамбұл, Түркия және Алматы, Қазақстан',
    corpLinks: ['Біз туралы', 'Науқандар', 'Онлайн тіркелу', 'Көмек және Сұрақтар'],
    srvLinks: [
      'Ішкі және халықаралық әуе билеттері',
      'Қонақүй брондау қызметі',
      'Әуежай және VIP трансфер',
      'Билет рәсімдері және қайтару',
    ],
    privLinks: [
      'Пайдалану шарттары',
      'Дербес деректерді қорғау',
      'Хабарлама келісімі',
      'Cookie саясаты',
    ],
    tursabBadge: 'TÜRSAB A тобындағы агенттік',
    sslNote: 'FlyToAspan by Infinitive Travel — 3D Secure 256-Bit SSL қорғанысы',
  },
};

const PREFOOTER_I18N: Record<
  LangCode,
  {
    eyebrow: string;
    title: string;
    vipSupport: string;
    waCta: string;
    pillars: [string, string][];
    registryLine: string;
  }
> = {
  TR: {
    eyebrow: 'INFINITIVE TRAVEL · GLOBAL HAVACILIK VE KONAKLAMA AĞI',
    title: "Türkiye, Kazakistan, Avrupa ve Orta Doğu'da Güvenilir Seyahat Deneyimi",
    vipSupport: '7/24 VIP Destek:',
    waCta: 'WhatsApp Hızlı Destek',
    pillars: [
      ['256-Bit SSL & Güvenli Altyapı', 'Uluslararası güvenlik standartlarında şifreli oturum ve veri koruması'],
      ['IATA & TÜRSAB Acente Standartları', '500+ tarifeli ve charter havayolu ile şeffaf rezervasyon akışı'],
      ['Çoklu Döviz & Şeffaf Fiyat', 'TRY ₺, USD $, EUR €, KZT ₸ ve RUB ₽ ile şeffaf, gizli ücretsiz fiyatlar'],
      ['Anında İptal, İade & Değişiklik', '7/24 kesintisiz çağrı merkezi ve online PNR sorgulama desteği'],
    ],
    registryLine: 'Ticari Ünvan: Infinitive Travel (Resmi künye & TÜRSAB Belge No: Bilgi bekleniyor · MERSİS / Vergi No: Bilgi bekleniyor)',
  },
  EN: {
    eyebrow: 'INFINITIVE TRAVEL · GLOBAL AVIATION & HOSPITALITY NETWORK',
    title: 'Trusted Travel Experience Across Turkey, Kazakhstan, Europe & Middle East',
    vipSupport: '24/7 VIP Support:',
    waCta: 'WhatsApp Quick Support',
    pillars: [
      ['256-Bit SSL & Secure Platform', 'Encrypted sessions and personal data protection at international standards'],
      ['IATA & TURSAB Agency Standards', 'Transparent booking flow across 500+ scheduled and charter airlines'],
      ['Multi-Currency & Transparent Fares', 'Clear fares in TRY ₺, USD $, EUR €, KZT ₸ and RUB ₽ with no hidden fees'],
      ['Instant Cancellation & Changes', '24/7 travel desk support and online PNR booking lookup'],
    ],
    registryLine: 'Legal Entity: Infinitive Travel (Official TURSAB License No: Pending · Tax / Registry ID: Pending)',
  },
  RU: {
    eyebrow: 'INFINITIVE TRAVEL · МЕЖДУНАРОДНАЯ СЕТЬ АВИАЦИИ И ОТЕЛЕЙ',
    title: 'Надёжные путешествия по Турции, Казахстану, Европе и Ближнему Востоку',
    vipSupport: 'VIP-поддержка 24/7:',
    waCta: 'Быстрая помощь WhatsApp',
    pillars: [
      ['256-Bit SSL и защита данных', 'Защищённые сессии и сохранность персональных данных по мировым стандартам'],
      ['Стандарты агентств IATA и TURSAB', 'Прозрачный подбор более 500 регулярных и чартерных авиакомпаний'],
      ['Мультивалютность и честные цены', 'Прозрачные тарифы в TRY ₺, USD $, EUR €, KZT ₸ и RUB ₽ без скрытых сборов'],
      ['Быстрый обмен и возврат', 'Круглосуточная поддержка 24/7 и онлайн-проверка брони по PNR'],
    ],
    registryLine: 'Юр. лицо: Infinitive Travel (Лицензия TURSAB: ожидается · Рег. номер / ИНН: ожидается)',
  },
  KK: {
    eyebrow: 'INFINITIVE TRAVEL · ХАЛЫҚАРАЛЫҚ ӘУЕ ЖӘНЕ ҚОНАҚҮЙ ЖЕЛІСІ',
    title: 'Түркия, Қазақстан, Еуропа және Таяу Шығыстағы сенімді саяхат қызметі',
    vipSupport: '24/7 VIP қолдау:',
    waCta: 'WhatsApp жедел қолдау',
    pillars: [
      ['256-Bit SSL және деректер қорғау', 'Халықаралық қауіпсіздік стандарттарына сай шифрланған жүйе'],
      ['IATA және TÜRSAB стандарттары', '500+ тұрақты және чартерлік әуе компаниялары бойынша ашық іздеу'],
      ['Көп валюта және ашық баға', 'TRY ₺, USD $, EUR €, KZT ₸ және RUB ₽ бойынша жасырын төлемсіз бағалар'],
      ['Жылдам өзгерту және қайтару', '24/7 үздіксіз байланыс орталығы және онлайн PNR тексеру'],
    ],
    registryLine: 'Заңды тұлға: Infinitive Travel (TÜRSAB куәлік №: ақпарат күтілуде · БСН / Салық №: ақпарат күтілуде)',
  },
};

const cookiePreferenceKey = 'flytoaspan_cookie_preference_v1';

export const Footer: React.FC<FooterProps> = ({ lang, canManage, onNavigate, onJumpToTab, onOpenLegal }) => {
  const t = TRANSLATIONS[lang].footer;
  const fl = FOOTER_LINKS_I18N[lang];
  const pf = PREFOOTER_I18N[lang];
  const [showTop, setShowTop] = useState(false);
  const [cookieVisible, setCookieVisible] = useState(false);
  const [cookiePreference, setCookiePreference] = useState<'accepted' | 'rejected' | null>(() => {
    try {
      const saved = localStorage.getItem(cookiePreferenceKey);
      return saved === 'accepted' || saved === 'rejected' ? saved : null;
    } catch {
      return null;
    }
  });
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 420);
      if (window.scrollY > 220) setCookieVisible(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const cookieOpen = preferencesOpen || (cookieVisible && cookiePreference === null);
  const chooseCookies = (preference: 'accepted' | 'rejected') => {
    try {
      localStorage.setItem(cookiePreferenceKey, preference);
    } catch { /* The choice still applies for this visit. */ }
    setCookiePreference(preference);
    setPreferencesOpen(false);
  };

  return (
    <>
      {/* Executive Pre-Footer Trust, Security & Global Hub Band (Replaces Cartoon Skyline) */}
      <div className="exec-prefooter">
        <div className="container">
          <div className="exec-prefooter-card">
            <div className="exec-prefooter-top">
              <div>
                <div className="exec-prefooter-eyebrow">
                  <Plane size={13} />
                  <span>{pf.eyebrow}</span>
                </div>
                <h3 className="exec-prefooter-title">{pf.title}</h3>
              </div>
              <div className="exec-prefooter-ctas">
                <a href={PHONE_HREF} className="exec-prefooter-phone">
                  <Headphones size={16} />
                  <span>{pf.vipSupport} {PHONE_DISPLAY}</span>
                </a>
                <a
                  href={WA_HREF}
                  target="_blank"
                  rel="noreferrer"
                  className="exec-prefooter-wa"
                >
                  <MessageCircle size={16} />
                  <span>{pf.waCta}</span>
                </a>
              </div>
            </div>

            <div className="exec-prefooter-pillars">
              <div className="exec-pillar-item">
                <div className="exec-pillar-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <strong>{pf.pillars[0][0]}</strong>
                  <span>{pf.pillars[0][1]}</span>
                </div>
              </div>

              <div className="exec-pillar-item">
                <div className="exec-pillar-icon gold">
                  <Award size={20} />
                </div>
                <div>
                  <strong>{pf.pillars[1][0]}</strong>
                  <span>{pf.pillars[1][1]}</span>
                </div>
              </div>

              <div className="exec-pillar-item">
                <div className="exec-pillar-icon">
                  <CreditCard size={20} />
                </div>
                <div>
                  <strong>{pf.pillars[2][0]}</strong>
                  <span>{pf.pillars[2][1]}</span>
                </div>
              </div>

              <div className="exec-pillar-item">
                <div className="exec-pillar-icon green">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <strong>{pf.pillars[3][0]}</strong>
                  <span>{pf.pillars[3][1]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dark Footer (With Subtle Dashed Flight Path Background) */}
      <footer className="uff-footer" style={{ position: 'relative', overflow: 'hidden' }}>
        <svg
          viewBox="0 0 1440 420"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            opacity: 0.45,
          }}
        >
          <path
            d="M 860 390 Q 1120 140 1420 190"
            fill="none"
            stroke="rgba(125, 211, 252, 0.25)"
            strokeWidth="1.5"
            strokeDasharray="4 8"
          />
          <path
            d="M 980 410 Q 1210 240 1440 280"
            fill="none"
            stroke="rgba(245, 205, 94, 0.22)"
            strokeWidth="1.3"
            strokeDasharray="3 8"
          />
        </svg>
        <div className="container">
          <div className="uff-grid">
            <div>
              <img
                src="/images/logo-dark.png"
                alt="FlyToAspan by Infinitive Travel"
                style={{ height: 48, width: 'auto' }}
              />
              <p className="uff-tagline">{t.tagline}</p>
              <div className="uff-support-lbl">{t.supportLbl}</div>
              <a href={PHONE_HREF} className="uff-phone">
                {PHONE_DISPLAY}
              </a>
              <div className="uff-contact-line">info@flytoaspan.com</div>
              <div className="uff-contact-line" style={{ fontSize: 12, opacity: 0.72 }}>
                {fl.locations}
              </div>
            </div>

            <div>
              <h4 className="uff-col-title">{t.corporate}</h4>
              <ul className="uff-links">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('home');
                      setTimeout(
                        () =>
                          document
                            .getElementById('hakkimizda')
                            ?.scrollIntoView({ behavior: 'smooth' }),
                        120
                      );
                    }}
                  >
                    {fl.corpLinks[0]}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('campaigns')}>
                    {fl.corpLinks[1]}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('checkin')}>
                    {fl.corpLinks[2]}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('help')}>
                    {fl.corpLinks[3]}
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="uff-col-title">{t.services}</h4>
              <ul className="uff-links">
                <li>
                  <button type="button" onClick={() => onJumpToTab('flight')}>
                    {fl.srvLinks[0]}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onJumpToTab('hotel')}>
                    {fl.srvLinks[1]}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onJumpToTab('transfer')}>
                    {fl.srvLinks[2]}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('booking-ops')}>
                    {fl.srvLinks[3]}
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="uff-col-title">{t.privacy}</h4>
              <ul className="uff-links">
                <li>
                  <button
                    type="button"
                    onClick={() => (onOpenLegal ? onOpenLegal('terms') : onNavigate('legal'))}
                  >
                    {fl.privLinks[0]}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => (onOpenLegal ? onOpenLegal('kvkk') : onNavigate('legal'))}
                  >
                    {fl.privLinks[1]}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => (onOpenLegal ? onOpenLegal('commercial') : onNavigate('legal'))}
                  >
                    {fl.privLinks[2]}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => (onOpenLegal ? onOpenLegal('cookies') : onNavigate('legal'))}
                  >
                    {fl.privLinks[3]}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setPreferencesOpen(true)}>{t.cookieTitle}</button>
                </li>
                {canManage && <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('admin')}
                    style={{ color: '#F5CD5E', fontWeight: 700 }}
                  >
                    ⚙ Yönetici &amp; Fiyat Paneli
                  </button>
                </li>}
              </ul>
            </div>
          </div>

          <div className="uff-trust-row">
            <div className="uff-badges-group">
              <span className="uff-cert-pill">{fl.tursabBadge}</span>
              <span className="uff-cert-pill" style={{ color: '#007D89' }}>
                IATA Accredited
              </span>
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>
                {fl.sslNote}
              </span>
            </div>

            <div className="uff-badges-group">
              {['VISA', 'Mastercard', 'troy', 'AMEX', 'Maestro'].map((card) => (
                <span key={card} className="uff-pay-pill">
                  {card}
                </span>
              ))}
            </div>
          </div>

          <div className="uff-bottom">
            <div>
              <div>{t.rights}</div>
              <div style={{ fontSize: 11.5, opacity: 0.72, marginTop: 4 }}>{pf.registryLine}</div>
            </div>
            <div className="uff-socials">
              <a
                href={WA_HREF}
                target="_blank"
                rel="noreferrer"
                className="uff-social-btn"
                aria-label="WhatsApp"
                title="WhatsApp 7/24 Destek"
              >
                <MessageCircle size={16} />
              </a>
              <a
                href={PHONE_HREF}
                className="uff-social-btn"
                aria-label="Telefon"
                title={PHONE_DISPLAY}
              >
                <Phone size={16} />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Phone (+90 531 460 61 75), WhatsApp & Scroll-to-Top */}
      <div className="floating-stack">
        <a href={PHONE_HREF} className="float-item" aria-label="Telefonla Ara">
          <span className="float-label">{PHONE_SHORT}</span>
          <span className="float-circle phone">
            <Phone size={21} />
          </span>
        </a>
        <a
          href={WA_HREF}
          target="_blank"
          rel="noreferrer"
          className="float-item"
          aria-label="WhatsApp 7/24 Destek"
        >
          <span className="float-label">{t.supportBadge}</span>
          <span className="float-circle whatsapp">
            <MessageCircle size={22} />
          </span>
        </a>
        {showTop && (
          <button
            type="button"
            className="float-top-btn"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Yukarı çık"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>

      {/* Cookie Consent Toast */}
      {cookieOpen && (
        <div className="cookie-toast" role="dialog" aria-label={t.cookieTitle}>
          <div className="cookie-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Cookie size={16} color="#F5CD5E" />
            {t.cookieTitle}
          </div>
          <div className="cookie-text">{t.cookieText}</div>
          <div className="cookie-actions">
            <button
              type="button"
              className="cookie-btn-ghost"
              onClick={() => chooseCookies('rejected')}
            >
              {t.reject}
            </button>
            <button
              type="button"
              className="cookie-btn-accept"
              onClick={() => chooseCookies('accepted')}
            >
              {t.accept}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
