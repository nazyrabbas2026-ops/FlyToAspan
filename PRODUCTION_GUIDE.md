# FlyToAspan — Canlıya Alma (Production), Güvenlik, Veri Koruma, Proxy ve Çerez Rehberi

Bu doküman, bir uçak bileti / otel / VIP transfer satış platformunu canlı ortamda güvenli, yasalara uyumlu ve kesintisiz işletmek için gereken tüm teknik ve hukuki bileşenleri özetler.

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
