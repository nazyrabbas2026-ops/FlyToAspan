# FlyToAspan — Canlıya Alma (Production), Güvenlik, Veri Koruma, Proxy ve Çerez Rehberi

Bu doküman, bir uçak bileti / otel / VIP transfer satış platformunu canlı ortamda güvenli, yasalara uyumlu ve kesintisiz işletmek için gereken tüm teknik ve hukuki bileşenleri özetler.

## Yerel sunucuyu çalıştırma

- Node.js 24 veya üzeriyle `npm install` ve `npm run dev` çalıştırın. Derlenmiş sürüm için `npm run build` ve `npm start` kullanın. Ana sayfa ve paylaşılabilir adresler aynı sunucudan açılır.
- Üye hesabı sitedeki **Kayıt Ol** ekranından açılır. Yönetici hesabını sunucunun terminalinde `npm run admin:create` komutuyla oluşturun ve `/yonetim` adresinden giriş yapın. Parola yazılırken ekranda görünmez.
- Hesaplar, rezervasyonlar ve fiyat kuralları varsayılan olarak `.data/flytoaspan.sqlite` dosyasında saklanır. İsteğe bağlı `FLYTOASPAN_DB` değişkeni kalıcı veritabanının konumunu belirler. Dış erişimde HTTPS sağlayan vekil sunucu kullanın ve `FLYTOASPAN_ORIGIN` değerini sitenin tam HTTPS adresi olarak ayarlayın.
- Uçuş, otel, transfer ve tur kayıtları şu aşamada yerel deneme envanteridir. Anlaşmalı tedarikçilerin (Amadeus / Buranus / SAMO-Tour / Hotelbeds) ve Sanal POS'un (iyzico / PayTR) test erişimi geldiğinde İstanbul–Antalya gidiş-dönüş fiyatı, ödeme, biletleme ve iptal uçtan uca doğrulanacaktır.

---

## Uçuş satışından önce operasyon provası

- **Müşteri talepleri.** Bilet İşlemleri ekranında rezervasyon hesabıyla veya rezervasyondaki e-postaya gönderilen kodla iptal, değişiklik ve iade talebi açılır. Talep numarasıyla durum ve varsa tahmini ya da kayda geçirilmiş tutar izlenir. Gidiş, dönüş ve yolcu kapsamı ayrı seçilebilir. Kod teslimi için doğrulanmış gönderen alanı, Resend ayarları ve bir test gelen kutusu gerekir.
- **Operasyon ve finans.** Yönetim → Rezervasyonlar → Uçuş işlem kuyruğunda ödeme farkı, biletleme hatası ve havayolu kaynaklı uçuş saati değişikliği/iptali kaydedilir. Ekip sağlayıcı veya POS panelinde işlemi doğrular, yolcuya sonucu bildirir, referansı girer ve kaydı kapatır. Buradaki kayıt POS tahsilatı, iade, bilet düzenleme veya bildirim gönderimi başlatmaz. Geliştirici + Analist kuyruğu okuyabilir.
- **Vardiya ve mutabakat.** Site sahibi çalışma saatlerini, mesai dışı acil sorumluyu ve yedeğini belirler. Açık biletleme ve ödeme farklarını sorumlu ekip takip eder. Finans ekibi her gün rezervasyon kodu, POS referansı, para birimi, tahsilat, bilet ve iade kayıtlarını karşılaştırır. Fark için kuyrukta kayıt açar, sağlayıcı ve POS sonucunu doğrulayana kadar açık tutar.
- **Sağlayıcı ve POS.** İlk ödeme başlamadan önce sunucuda kalıcı bir bekleyen kayıt ve sipariş numarası oluşturulmalı. POS bildiriminin imzası, siparişi, tutarı ve para birimi doğrulanmalı. Aynı bildirimin tekrar gelmesi veya sunucunun yeniden başlaması ek tahsilat, bilet ya da iade oluşturmamalı. Biletleme zaman aşımında önce sağlayıcının sonucu sorgulanmalı. Bilet kesin olarak kesilmediyse POS üzerinden ödeme iptali veya iade uygulanmalı. Bu bağlantılar seçilen servislerin test erişimiyle kurulacak.
- **Şirket bilgileri.** Site sahibi satış yapan tüzel kişiyi, fatura düzenleyen tarafı, iade sorumlusunu ve ürün bazında acente yetkisini teyit eder. Onaylı ticari unvan, adres, e-posta ve telefon için dört FLYTOASPAN_SELLER_* ayarını birlikte doldurun. Checkout bu bilgileri gösterir. Yasal metinleri ve uygulanabilir ETBİS/KVKK yükümlülüklerini şirketin fiili satış ve veri akışı üzerinden teyit edin. Canlı ödeme ekranında vergiler, hizmet bedeli, ekler, para birimi ve ödenecek son toplam sağlayıcı verisiyle doğrulanır.
- **İstanbul–Antalya kabul provası.** HTTPS ön yayın ortamında gerçek sağlayıcı/POS test hesaplarıyla gidiş-dönüş fiyat değişimi, başarılı satış, 3D Secure reddi, ödemeden sonra biletleme hatası, çift bildirim, kısmi/tam iade ve havayolu saat değişikliği denenir. Kısmi iadede tek yolcu ve dönüş bacağı kontrol edilir. E-bilet, doğrulama kodu ve değişiklik mesajı gerçek test gelen kutusuna ulaşmalı. Docker imajı, kalıcı kayıt ve gerçek mobil tarayıcı kontrol edilir. Başarılı sağlayıcı akışı olan ürünler, site sahibi onayından sonra açılır.

## 0. Canlıya Çıkış Altyapısı, Hosting, Anahtar Yönetimi ve Şifreli Yedekleme

### 0.1 Alan Adı, Sunucu ve Staging Ortamı
- **Alan Adı & HTTPS:** Şirket alan adı (`flytoaspan.com` / `www.flytoaspan.com`) arkasında TLS 1.3 + HSTS zorunlu reverse proxy (Nginx / Caddy veya Cloudflare) çalıştırın.
- **Staging (Ön Yayın) Ortamı:** Canlıya çıkmadan önce `staging.flytoaspan.com` alt alan adında ayrı bir `FLYTOASPAN_DB` dosyası ve ayrı şifreleme anahtarıyla tüm tedarikçi, POS ve sürüm güncellemelerini doğrulayın.
- **Kalıcı Disk & Yalıtılmış Veri Dizini:** SQLite dosyası (`FLYTOASPAN_DB=/var/lib/flytoaspan/flytoaspan.sqlite`) kalıcı bir disk biriminde (`chmod 700 /var/lib/flytoaspan`) tutulmalı, uygulama derleme/deploy sırasında üzerine yazılmamalıdır.

### 0.2 Şifreleme Anahtarlarının Ayrı Yönetimi (AES-256-GCM)
- Hassas yolcu belgeleri (TCKN / pasaport numarası) veritabanında `enc:v1:...` biçiminde **AES-256-GCM** ile şifrelenir.
- Anahtar **asla kaynak kodda veya veritabanında saklanmaz**:
  - Üretimde `FLYTOASPAN_PII_KEY` (32 byte hex veya base64) ortam değişkenini gizli kasa / sunucu secret store üzerinden verin.
  - Üretim yedekleri için farklı bir 32 baytlık `FLYTOASPAN_BACKUP_KEY` tanımlayın. Yedekleme ve geri yükleme, iki anahtar da geçerli ve farklı olduğunda çalışır. Anahtarları veritabanı ve yedek dosyalarından ayrı saklayın.
  - Geliştirme ortamında değişken verilmezse anahtar otomatik olarak DB klasörünün dışındaki `0600` izinli bir anahtar dosyasında oluşturulur.

### 0.3 Şifreli SQLite Yedekleme ve Geri Yükleme Doğrulaması
- SQLite canlı iken tutarlı anlık kopya (`VACUUM INTO`) alıp AES-256-GCM + SHA-256 bütünlük doğrulamasıyla şifreleyen betik dahildir:
  - **Yedek alma:** Üretim ortam değişkenleriyle `NODE_ENV=production npm run backup:db` komutunu çalıştırın. `FLYTOASPAN_BACKUP_DIR` yedek dizinini belirler.
  - **Geri yükleme ve bütünlük testi (`PRAGMA integrity_check`):** Aynı anahtarlarla `NODE_ENV=production node --env-file-if-exists=.env server/backup.mjs restore /var/backups/flytoaspan/backup.ftaenc /tmp/verify-yeni.sqlite` çalıştırın. Hedef dosya yeni olmalıdır. Geri yüklenen kopyada bir rezervasyon ve şifreli yolcu alanının okunabildiğini doğrulayın.
- Günlük otomatik zamanlanmış görev (cron) ile yedek alın, farklı bir sunucu/nesne depolamaya kopyalayın ve haftada bir geçici dosyaya geri yükleyerek bütünlüğü test edin.

### 0.4 Yönetici, Ekip ve Geliştirici + Analist (Nazyr) Hesapları
- **Site Sahibi (Süper Admin):** `npm run admin:create` ile oluşturulur; tam yetkiye, iade/silme/rol değiştirme ve 2FA yönetimine sahiptir.
- **Geliştirici + Analist (Nazyr):** Sunucu başlangıcında `FLYTOASPAN_DEV_ANALYST_EMAIL` ve `FLYTOASPAN_DEV_ANALYST_PASSWORD` (min 12 karakter) ile kişiye özel tanımlanabilir veya Süper Admin tarafından **Geliştirici + Analist (Nazyr)** rol şablonuyla atanır (`bookings.view_all`, `analytics.view`, `finance.view`). Bu hesap üye, operasyon, satış, hata ve analiz verilerini görür; **iade, silme, rol verme ve sağlayıcı anahtarı değiştirme yetkisi kapalıdır**.
- **2FA (TOTP) & Oturum İptali:** Tüm canlı yönetici hesapları paneldeki **Analiz & Site Sağlığı → Hesap Güvenliği** bölümünden TOTP 2FA (Google Authenticator / 1Password) açmalıdır. Parola değişimi diğer tüm açık oturumları otomatik sonlandırır.

### 0.5 Analiz, Hata İzleme ve Çerez Rızası (PostHog, Cloudflare, Sentry)
- **Birinci Taraf Panel Metrikleri:** Üye sayısı, giriş hareketleri, canlı/deneme satış & iade ayrımı, şüpheli trafik uyarıları ve dönüşüm hunisi `/yonetim#analytics` ekranında otomatik sunulur.
- **İsteğe Bağlı Dış Araçlar (Site Sahibi Onayı ile):**
  - `POSTHOG_HOST` / `POSTHOG_API_KEY`: Yalnızca kullanıcı analitik çerezine onay verdikten sonra etkinleştirilir; pasaport, TCKN, e-posta, telefon gibi **PII alanları gönderilmez**.
  - `CLOUDFLARE_ZONE_ID` / WAF: Bot, scraper ve DDoS koruması.
  - `SENTRY_DSN`: Sunucu ve istemci hatalarını toplar; yolcu PII ve oturum token'ları `scrubSensitiveFields` ile temizlenir.

---

## 1. Sunucu, Reverse Proxy ve Ağ Güvenliği
- **Cloudflare (WAF + DDoS + Bot Koruması):**
  - Arama motoru endpoint'lerine (GDS fiyat sorgusu pahalıdır) gelen bot/scraper saldırılarını **Cloudflare Bot Management** ve **Rate Limiting** (ör. IP başına dakikada 30 uçuş araması) ile engelleyin.
  - Tüm trafik **TLS 1.3 + HSTS** zorunlu olacak şekilde şifrelenmelidir.
- **Reverse Proxy (Nginx veya Caddy):**
  - Frontend (React build) ve Backend API'yi tek domain arkasında yönlendirin (`/api/*` → Backend, `/*` → Frontend).
  - GDS/havayolu API anahtarları **asla** tarayıcıda (frontend'de) tutulmaz; tüm GDS çağrıları **Backend Proxy** üzerinden yapılır.
  - Zorunlu HTTP güvenlik başlıkları: `Content-Security-Policy (CSP)`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, sıkı `CORS` whitelist.

## 2. Uçuş, Otel ve Transfer API / GDS Entegrasyonları
- **Uçuş (GDS / NDC):** Amadeus Enterprise / Self-Service API, Sabre, Travelport, Duffel veya yerli konsolidatör XML/JSON (THY, Pegasus, AJet, Air Astana için IATA yetkili acente sözleşmesi).
- **Otel:** Hotelbeds, TBO Holidays, BookingAgora, Expedia TAAP.
- **Önbellekleme (Redis):** Aynı rota/tarih aramalarını 2–5 dakika Redis'te cache'leyerek GDS maliyetini düşürün ve hızı artırın.

## 3. Ödeme ve PCI-DSS Güvenliği
- **Sanal POS / Ödeme Altyapısı:** iyzico, PayTR, Stripe veya banka 3D Secure sanal POS.
- **PCI-DSS Kuralı:** Kredi kartı numarası ve CVV **kesinlikle kendi veritabanınıza yazılmaz**. Ödeme sağlayıcının `iframe` / `hosted checkout` veya tokenization altyapısı kullanılır.
- **3D Secure + Fraud Kontrolü:** Yurt dışı kartlar ve yüksek tutarlı biletlerde 3D Secure zorunlu tutulmalı, aynı kart/IP'den peş peşe denemelere limit konulmalıdır.

## 4. Üye & Kurumsal Panel Güvenliği (Auth & Yetkilendirme)
- **Şifre Saklama:** Parolalar düz metin tutulmaz; **Argon2id** veya **bcrypt** (cost ≥ 12) ile hashlenir.
- **Oturum Yönetimi:** Kısa ömürlü JWT (`15 dk`) + rotasyonlu `Refresh Token` (veya Redis session) **yalnızca `HttpOnly; Secure; SameSite=Lax` cookie** içinde saklanır (XSS saldırısında JavaScript okuyamaz).
- **CSRF Koruması:** State değiştiren `POST/PUT/DELETE` isteklerinde CSRF token veya `SameSite` + `Origin` doğrulaması.
- **2FA (SMS / OTP):** Bilet iptali, şifre değişikliği ve kurumsal yönetici onaylarında SMS/e-posta OTP doğrulaması.
- **RBAC (Rol Tabanlı Yetki):** `Bireysel Üye`, `Kurumsal Çalışan`, `Kurumsal Yönetici`, `Acente Operasyon`, `Süper Admin` rolleri kesin ayrılmalı; her bilet iptali ve onay işlemi **Audit Log** tablosuna kaydedilmelidir.

## 5. Verilerin Korunması (KVKK & GDPR) & Hukuki Gereklilikler
- **Şifreleme:** Veritabanında pasaport numarası, TCKN ve telefon gibi hassas PII verileri **AES-256-GCM (Encryption at Rest)** ile şifrelenmeli, loglarda maskelenmelidir (`123*****89`).
- **Yasal Belgeler & Kayıtlar:**
  - **TÜRSAB A Grubu Belgesi** ve **IATA Yetkisi** (veya yetkili acente iş ortaklığı).
  - **KVKK Aydınlatma Metni**, **Açık Rıza Kaydı** (zaman damgası + IP + metin versiyonu ile loglanmalı).
  - **İYS (İleti Yönetim Sistemi):** SMS ve e-posta kampanyaları için İYS entegrasyonu zorunludur.
  - **ETBİS Kaydı** ve **Mesafeli Satış Sözleşmesi / Ön Bilgilendirme Formu** (her bilet satışında PDF oluşturulup e-posta ile gönderilmeli).

## 6. Çerez (Cookie) Politikası ve Rıza Yönetimi
- Çerezler 3 kategoriye ayrılmalıdır:
  1. **Zorunlu Çerezler:** Oturum (`HttpOnly`), dil tercihi (`TR/EN/RU/KK`), güvenlik/CSRF — rıza gerektirmez.
  2. **Analitik Çerezler:** Google Analytics / PostHog — kullanıcı **"Kabul Et"** demeden yüklenmemelidir.
  3. **Pazarlama Çerezleri:** Meta Pixel, Google Ads — yalnızca açık rıza sonrası yüklenmelidir.
- Kullanıcının çerez tercihini sonradan değiştirebileceği bir ayar bağlantısı footer'da ve üye panelinde bulunmalıdır.
