import React from 'react';
import {
  ShieldCheck,
  FileText,
  Lock,
  Cookie,
  RotateCcw,
  MailCheck,
  ArrowLeft,
  Phone,
} from 'lucide-react';
import { PHONE_DISPLAY } from '../i18n/translations';
import { LangCode, LegalDocKey } from '../types';

interface LegalPagesProps {
  lang?: LangCode;
  activeDoc: LegalDocKey;
  onSelectDoc: (doc: LegalDocKey) => void;
  onBackHome: () => void;
}

const LEGAL_UI: Record<
  LangCode,
  {
    back: string;
    eyebrow: string;
    title: string;
    tabs: Record<LegalDocKey, string>;
    langNotice?: string;
  }
> = {
  TR: {
    back: 'Ana Sayfaya Dön',
    eyebrow: 'FLYTOASPAN BY INFINITIVE TRAVEL · RESMİ SÖZLEŞMELER & KVKK',
    title: 'Yasal Bilgilendirme, KVKK ve Satış Sözleşmeleri',
    tabs: {
      terms: 'Kullanım Koşulları & Mesafeli Satış',
      kvkk: 'KVKK & Gizlilik Aydınlatma Metni',
      refund: 'İptal, İade ve Değişiklik Koşulları',
      commercial: 'Ticari Elektronik İleti Onayı',
      cookies: 'Çerez (Cookie) Politikası',
    },
  },
  EN: {
    back: 'Back to Homepage',
    eyebrow: 'FLYTOASPAN BY INFINITIVE TRAVEL · LEGAL POLICIES & PRIVACY',
    title: 'Legal Notice, Privacy (KVKK/GDPR) & Terms',
    tabs: {
      terms: 'Terms of Use & Distance Sales',
      kvkk: 'Privacy & Data Protection (KVKK / GDPR)',
      refund: 'Cancellation, Refund & Change Policy',
      commercial: 'Commercial Electronic Message Consent',
      cookies: 'Cookie Policy',
    },
    langNotice: 'Official statutory agreements under Turkish Law No. 6502 and 6698 (KVKK) are displayed below in their binding Turkish legal text. For English assistance, contact info@flytoaspan.com.',
  },
  RU: {
    back: 'На главную',
    eyebrow: 'FLYTOASPAN BY INFINITIVE TRAVEL · ПРАВОВАЯ ИНФОРМАЦИЯ',
    title: 'Правовая информация, защита данных и условия',
    tabs: {
      terms: 'Условия использования',
      kvkk: 'Защита персональных данных (KVKK / GDPR)',
      refund: 'Отмена, возврат и обмен билетов',
      commercial: 'Согласие на рассылку',
      cookies: 'Политика файлов Cookie',
    },
    langNotice: 'Официальные юридические тексты в соответствии с законодательством Турции (KVKK) приведены ниже на турецком языке. По вопросам на русском пишите на info@flytoaspan.com.',
  },
  KK: {
    back: 'Басты бетке оралу',
    eyebrow: 'FLYTOASPAN BY INFINITIVE TRAVEL · РЕСМИ ШАРТТАР МЕН ҚҰПИЯЛЫЛЫҚ',
    title: 'Құқықтық ақпарат, деректерді қорғау және шарттар',
    tabs: {
      terms: 'Пайдалану шарттары',
      kvkk: 'Дербес деректерді қорғау (KVKK / GDPR)',
      refund: 'Бас тарту, қайтару және өзгерту',
      commercial: 'Хабарлама келісімі',
      cookies: 'Cookie саясаты',
    },
    langNotice: 'Түркия заңнамасына (KVKK) сәйкес ресми заңды мәтіндер төменде берілген. Қазақ тілінде кеңес алу үшін info@flytoaspan.com поштасына жазыңыз.',
  },
};

export const LegalPages: React.FC<LegalPagesProps> = ({
  lang = 'TR',
  activeDoc,
  onSelectDoc,
  onBackHome,
}) => {
  const lu = LEGAL_UI[lang];
  const tabs: Array<{ key: LegalDocKey; title: string; icon: React.ReactNode }> = [
    { key: 'terms', title: lu.tabs.terms, icon: <FileText size={16} /> },
    { key: 'kvkk', title: lu.tabs.kvkk, icon: <Lock size={16} /> },
    { key: 'refund', title: lu.tabs.refund, icon: <RotateCcw size={16} /> },
    { key: 'commercial', title: lu.tabs.commercial, icon: <MailCheck size={16} /> },
    { key: 'cookies', title: lu.tabs.cookies, icon: <Cookie size={16} /> },
  ];

  return (
    <>
      <div className="inner-hero">
        <div className="container">
          <button type="button" className="inner-back-btn" onClick={onBackHome}>
            <ArrowLeft size={15} />
            {lu.back}
          </button>
          <div className="section-eyebrow on-dark">{lu.eyebrow}</div>
          <h1 className="inner-h1">{lu.title}</h1>
          <div className="route-pills" style={{ marginTop: 14 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`dest-toggle-btn ${activeDoc === t.key ? 'active' : ''}`}
                style={{
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: activeDoc === t.key ? undefined : 'rgba(255,255,255,0.08)',
                }}
                onClick={() => onSelectDoc(t.key)}
              >
                {t.icon}
                <span>{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="results-workspace">
        <div className="container" style={{ maxWidth: 920 }}>
          <div className="panel-card" style={{ lineHeight: 1.75, fontSize: 14.5 }}>
            {lu.langNotice && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'var(--aspan-teal-soft)',
                  color: 'var(--aspan-teal-deep)',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                {lu.langNotice}
              </div>
            )}
            {activeDoc === 'terms' && (
              <>
                <h2 style={{ marginTop: 0 }}>
                  1. Kullanım Koşulları ve Mesafeli Hizmet / Bilet Satış Sözleşmesi
                </h2>
                <p>
                  İşbu sözleşme, bir tarafta <strong>FlyToAspan by Infinitive Travel</strong> (TÜRSAB
                  ve IATA standartlarında faaliyet gösteren yetkili seyahat acentesi, İletişim:{' '}
                  <strong>{PHONE_DISPLAY}</strong>, E-posta: <strong>info@flytoaspan.com</strong>) ile
                  diğer tarafta FlyToAspan web sitesi üzerinden uçak bileti, otel konaklaması veya
                  VIP havalimanı transferi satın alan <strong>Yolcu / Tüketici</strong> arasında
                  6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler
                  Yönetmeliği uyarınca elektronik ortamda akdedilmiştir.
                </p>
                <h4>1.1. Hizmetin Niteliği ve Biletleme</h4>
                <p>
                  FlyToAspan; ulusal ve uluslararası havayollarının (THY, Pegasus, AJet, SunExpress,
                  Air Astana, FlyArystan, Lufthansa, Emirates vb.), konaklama tesislerinin ve VIP
                  transfer sağlayıcılarının tarifeli/charter seferlerini GDS ve B2B sistemleri
                  üzerinden anlık olarak listeleyen ve biletleme aracılık hizmeti sunan dijital
                  seyahat platformudur.
                </p>
                <h4>1.2. Fiyatlandırma ve 3D Secure Ödeme Güvenliği</h4>
                <p>
                  Ekranda görüntülenen toplam bilet, otel veya transfer bedeline ilgili vergiler ve
                  acente hizmet bedeli (Service Fee) dahildir. Tüm ödemeler 256-Bit SSL şifreleme ve
                  banka <strong>3D Secure</strong> SMS doğrulaması ile tahsil edilir; kredi kartı
                  numarası ve CVV bilgileri hiçbir şekilde FlyToAspan sunucularında saklanmaz.
                </p>
              </>
            )}

            {activeDoc === 'kvkk' && (
              <>
                <h2 style={{ marginTop: 0 }}>
                  2. 6698 Sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve GDPR Aydınlatma Metni
                </h2>
                <p>
                  <strong>FlyToAspan by Infinitive Travel</strong> (&ldquo;Veri Sorumlusu&rdquo;)
                  olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) ve
                  Avrupa Birliği Genel Veri Koruma Tüzüğü (&ldquo;GDPR&rdquo;) kapsamında kişisel
                  verilerinizin güvenliğine en üst düzeyde önem veriyoruz.
                </p>
                <h4>2.1. İşlenen Kişisel Veriler ve İşleme Amaçları</h4>
                <ul>
                  <li>
                    <strong>Kimlik ve Seyahat Belgeleri:</strong> Ad, soyad, doğum tarihi, uyruk, T.C.
                    Kimlik Numarası veya Pasaport numarası (yalnızca havayolu PNR/E-Bilet kesimi ve
                    otel/transfer rezervasyonunun resmi olarak oluşturulması amacıyla işlenir).
                  </li>
                  <li>
                    <strong>İletişim Bilgileri:</strong> E-posta adresi ve cep telefonu numarası
                    (PNR kodu, E-Bilet PDF belgesi, uçuş rötar/kapı bildirimleri ve VIP transfer
                    şoför karşılama bilgilerinin iletilmesi amacıyla).
                  </li>
                  <li>
                    <strong>İşlem Güvenliği:</strong> IP adresi, oturum logları ve 5651 sayılı kanun
                    gereği tutulan yasal erişim kayıtları.
                  </li>
                </ul>
                <h4>2.2. Veri Güvenliği ve Haklarınız</h4>
                <p>
                  TCKN ve pasaport verileriniz veritabanında <strong>AES-256</strong> şifreleme
                  standardıyla korunur. KVKK Madde 11 kapsamındaki veri erişim, düzeltme ve silme
                  taleplerinizi Üye Panelinizdeki <em>&ldquo;Güvenlik &amp; KVKK&rdquo;</em>{' '}
                  sekmesinden veya <strong>info@flytoaspan.com</strong> adresinden iletebilirsiniz.
                </p>
              </>
            )}

            {activeDoc === 'refund' && (
              <>
                <h2 style={{ marginTop: 0 }}>
                  3. Bilet İptal, İade ve Değişiklik Koşulları
                </h2>
                <p>
                  Uçak bileti iptal, iade ve tarih/saat değişikliği işlemleri, satın alınan biletin
                  tarife sınıfına (<strong>Eco Fly, Extra Fly, Prime Fly, Business Class</strong>) ve
                  ilgili havayolunun resmi kurallarına tabidir:
                </p>
                <ul>
                  <li>
                    <strong>Eco Fly (Promosyon / Ekonomik Paket):</strong> Havayolu kuralları gereği
                    genellikle iade edilemez; uçuşa belirli bir süre kalana kadar ücret farkı ve
                    ceza bedeli ödenerek değişiklik yapılabilir.
                  </li>
                  <li>
                    <strong>Extra Fly &amp; Prime Fly:</strong> Esnek değişiklik ve kesintili/tam
                    iade hakkı sunar. Paket seçimi sırasında her uçuş kartının altında iade ve
                    değişiklik şartları şeffaf biçimde yazılıdır.
                  </li>
                  <li>
                    <strong>Business Class:</strong> Kalkış öncesine kadar ücretsiz değişiklik ve
                    kesintisiz iade ayrıcalığı sağlar.
                  </li>
                  <li>
                    <strong>VIP Transfer &amp; Otel İptali:</strong> Transfer saatine 24 saat
                    kalana kadar yapılan iptallerde %100 kesintisiz iade yapılır.
                  </li>
                </ul>
                <p>
                  İptal veya değişiklik talebinizi üst menüdeki{' '}
                  <strong>Bilet İşlemleri (PNR Sorgulama)</strong> ekranından veya 7/24{' '}
                  <strong>{PHONE_DISPLAY}</strong> destek hattımızdan anında gerçekleştirebilirsiniz.
                </p>
              </>
            )}

            {activeDoc === 'commercial' && (
              <>
                <h2 style={{ marginTop: 0 }}>
                  4. 6563 Sayılı Kanun Kapsamında Ticari Elektronik İleti Onayı
                </h2>
                <p>
                  Üyelik veya bilet satın alma aşamasında açık rıza vermeniz halinde; FlyToAspan
                  tarafından sunulan indirim kuponları (örn. <code>ASPAN350</code>,{' '}
                  <code>SKYALA18</code>), erken rezervasyon otel fırsatları ve fiyat alarmı
                  bildirimleri SMS, WhatsApp veya e-posta kanalıyla tarafınıza iletilebilir.
                </p>
                <p>
                  Ticari ileti izninizi dilediğiniz zaman Üye Panelinizden veya gelen iletilerdeki
                  ücretsiz ret bağlantısından tek tıkla iptal edebilirsiniz. (Bilet PNR ve uçuş
                  bilgilendirme mesajları bilgilendirme amaçlı olup ticari ileti kapsamında değildir.)
                </p>
              </>
            )}

            {activeDoc === 'cookies' && (
              <>
                <h2 style={{ marginTop: 0 }}>5. Çerez (Cookie) Aydınlatma Metni</h2>
                <p>
                  FlyToAspan web sitesinde güvenli oturum yönetimi, dil ve para birimi tercihlerinizin
                  (<code>TR / EN / RU / KK</code> ve <code>TRY / USD / EUR / KZT / RUB</code>)
                  hatırlanması ve uçuş arama hızının optimize edilmesi amacıyla çerezler
                  kullanılmaktadır:
                </p>
                <ul>
                  <li>
                    <strong>Zorunlu Oturum &amp; Güvenlik Çerezleri:</strong> 3D Secure ödeme akışı,
                    bot/saldırı koruması (Cloudflare WAF) ve güvenli üye girişi için zorunludur.
                  </li>
                  <li>
                    <strong>İşlevsel Tercih Çerezleri:</strong> Seçtiğiniz dil, para birimi ve son
                    baktığınız rotaları tarayıcınızda hatırlar.
                  </li>
                </ul>
              </>
            )}

            <div
              style={{
                marginTop: 24,
                padding: '16px 20px',
                borderRadius: 14,
                background: 'var(--aspan-bg-soft)',
                border: '1px solid var(--aspan-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={22} color="#00A8B5" />
                <div>
                  <strong>FlyToAspan by Infinitive Travel — Hukuk &amp; Müşteri İlişkileri</strong>
                  <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)' }}>
                    İstanbul, Türkiye &amp; Almatı, Kazakistan · info@flytoaspan.com
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)', marginTop: 4 }}>
                    TÜRSAB Belge No: Bilgi bekleniyor · MERSİS / Vergi No: Bilgi bekleniyor · Açık Adres: Bilgi bekleniyor
                  </div>
                </div>
              </div>
              <a href="tel:+905314606175" className="btn-gold-nav" style={{ height: 40 }}>
                <Phone size={15} />
                {PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
