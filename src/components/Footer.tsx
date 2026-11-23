import React, { useEffect, useState } from 'react';
import {
  Phone,
  MessageCircle,
  ArrowUp,
  Instagram,
  Linkedin,
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

export const Footer: React.FC<FooterProps> = ({ lang, onNavigate, onJumpToTab, onOpenLegal }) => {
  const t = TRANSLATIONS[lang].footer;
  const fl = FOOTER_LINKS_I18N[lang];
  const [showTop, setShowTop] = useState(false);
  const [cookieVisible, setCookieVisible] = useState(false);
  const [cookieDismissed, setCookieDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 420);
      if (window.scrollY > 220) setCookieVisible(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const cookieOpen = cookieVisible && !cookieDismissed;

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
                  <span>INFINITIVE TRAVEL · GLOBAL AVIATION &amp; HOSPITALITY NETWORK</span>
                </div>
                <h3 className="exec-prefooter-title">
                  Türkiye, Kazakistan, Avrupa ve Orta Doğu&apos;da Resmi Acente Güvencesi
                </h3>
              </div>
              <div className="exec-prefooter-ctas">
                <a href={PHONE_HREF} className="exec-prefooter-phone">
                  <Headphones size={16} />
                  <span>7/24 VIP Destek: {PHONE_DISPLAY}</span>
                </a>
                <a
                  href={WA_HREF}
                  target="_blank"
                  rel="noreferrer"
                  className="exec-prefooter-wa"
                >
                  <MessageCircle size={16} />
                  <span>WhatsApp Hızlı Biletleme</span>
                </a>
              </div>
            </div>

            <div className="exec-prefooter-pillars">
              <div className="exec-pillar-item">
                <div className="exec-pillar-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <strong>256-Bit SSL &amp; 3D Secure</strong>
                  <span>Uluslararası PCI-DSS standartlarında şifreli banka ödeme altyapısı</span>
                </div>
              </div>

              <div className="exec-pillar-item">
                <div className="exec-pillar-icon gold">
                  <Award size={20} />
                </div>
                <div>
                  <strong>IATA &amp; TÜRSAB Yetkili Acente</strong>
                  <span>500+ tarifeli ve charter havayolunda resmi PNR &amp; e-bilet garantisi</span>
                </div>
              </div>

              <div className="exec-pillar-item">
                <div className="exec-pillar-icon">
                  <CreditCard size={20} />
                </div>
                <div>
                  <strong>Çoklu Döviz &amp; 9 Taksit</strong>
                  <span>TRY ₺, USD $, EUR €, KZT ₸ ve RUB ₽ ile şeffaf, gizli ücretsi fiyatlar</span>
                </div>
              </div>

              <div className="exec-pillar-item">
                <div className="exec-pillar-icon green">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <strong>Anında İptal, İade &amp; Değişiklik</strong>
                  <span>7/24 kesintisiz çağrı merkezi ve online PNR yönetim desteği</span>
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
                  <button
                    type="button"
                    onClick={() => onNavigate('admin')}
                    style={{ color: '#F5CD5E', fontWeight: 700 }}
                  >
                    ⚙ Yönetici &amp; Fiyat Paneli
                  </button>
                </li>
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
            <div>{t.rights}</div>
            <div className="uff-socials">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="uff-social-btn"
                aria-label="Instagram"
              >
                <Instagram size={16} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="uff-social-btn"
                aria-label="LinkedIn"
              >
                <Linkedin size={16} />
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
              onClick={() => setCookieDismissed(true)}
            >
              {t.reject}
            </button>
            <button
              type="button"
              className="cookie-btn-accept"
              onClick={() => setCookieDismissed(true)}
            >
              {t.accept}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
