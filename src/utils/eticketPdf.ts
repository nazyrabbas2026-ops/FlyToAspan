import { formatDisplayDate, formatPrice, formatTRY } from '../data/mockData';
import type { BookingRecord, CurrencyCode, LangCode } from '../types';

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBarcodeSvg(seed: string): string {
  const bars: string[] = [];
  let x = 0;
  for (let i = 0; i < 44; i++) {
    const code = seed.charCodeAt(i % seed.length) + i * 17;
    const w = (code % 3) + 1.5;
    if (i % 2 === 0 || code % 5 !== 0) {
      bars.push(`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="42" fill="#0B1E33" />`);
    }
    x += w + ((code % 2) + 1.2);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(x)} 42" width="190" height="42" aria-hidden="true">${bars.join('')}</svg>`;
}

export function openBrandedEticketPdf(
  booking: BookingRecord,
  options: { currency?: CurrencyCode; lang?: LangCode } = {}
): void {
  const currency = options.currency ?? 'TRY';
  const lang = options.lang ?? 'TR';
  const docTitle =
    booking.type === 'Uçak'
      ? 'ELEKTRONİK UÇAK BİLETİ & FATURA ÖZETİ'
      : booking.type === 'Otel'
        ? 'OTEL KONAKLAMA VOUCHER & REZERVASYON BELGESİ'
        : 'VIP HAVALİMANI TRANSFER VOUCHER';

  const statusColor =
    booking.status === 'Onaylandı' || booking.status === 'Tamamlandı'
      ? '#059669'
      : booking.status === 'İptal Talebi'
        ? '#D97706'
        : '#BE123C';

  const issuedAt = booking.createdAt
    ? new Date(booking.createdAt).toLocaleString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

  const travelDateStr =
    formatDisplayDate(booking.date, lang) +
    (booking.returnDate ? ` → ${formatDisplayDate(booking.returnDate, lang)}` : '');

  const eticketNo = booking.eticketNumber || `235-${booking.pnr.replace(/[^A-Z0-9]/g, '').slice(0, 8)}01`;
  const barcodeSvg = buildBarcodeSvg(booking.pnr + eticketNo);
  const logoUrl = `${window.location.origin}/images/logo-light.png`;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>FlyToAspan_EBilet_${escapeHtml(booking.pnr)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #F1F5F9;
      color: #0F172A;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #0B1E33;
      color: #fff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 16px rgba(11, 30, 51, 0.25);
    }
    .toolbar button {
      background: linear-gradient(135deg, #F2C85C, #E0AA36);
      color: #0B1E33;
      border: none;
      border-radius: 10px;
      padding: 9px 18px;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
    }
    .toolbar .close-btn {
      background: rgba(255,255,255,0.14);
      color: #fff;
      margin-left: 8px;
    }
    .sheet {
      max-width: 794px;
      margin: 24px auto;
      background: #FFFFFF;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 12px 36px rgba(15, 23, 42, 0.12);
      border: 1px solid #E2E8F0;
    }
    .hero {
      background: linear-gradient(135deg, #0B1E33 0%, #10324F 65%, #0D4B5E 100%);
      color: #FFFFFF;
      padding: 26px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .hero img { height: 42px; width: auto; display: block; }
    .hero-sub { font-size: 11px; letter-spacing: 1.4px; color: #F2C85C; font-weight: 700; margin-top: 6px; }
    .status-pill {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      background: ${statusColor};
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.4px;
    }
    .pnr-band {
      background: #F8FAFC;
      border-bottom: 1px dashed #CBD5E1;
      padding: 20px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .pnr-code {
      font-size: 30px;
      font-weight: 900;
      letter-spacing: 2.5px;
      color: #0B1E33;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748B; font-weight: 700; margin-bottom: 4px; }
    .body { padding: 26px 32px; }
    .route-title { font-size: 22px; font-weight: 800; color: #0B1E33; margin: 0 0 6px; }
    .route-sub { font-size: 13.5px; color: #475569; margin: 0 0 22px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-bottom: 22px;
    }
    .box {
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
      background: #F8FAFC;
    }
    .val { font-size: 14.5px; font-weight: 700; color: #0F172A; }
    .price-box {
      background: linear-gradient(135deg, rgba(0, 168, 181, 0.08), rgba(224, 170, 54, 0.08));
      border: 1.5px solid #00A8B5;
      border-radius: 14px;
      padding: 18px 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 22px;
    }
    .price-main { font-size: 26px; font-weight: 900; color: #0B1E33; }
    .notes {
      padding: 14px 16px;
      border-radius: 12px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      font-size: 12px;
      line-height: 1.55;
      color: #78350F;
    }
    .footer {
      border-top: 1px solid #E2E8F0;
      padding: 16px 32px;
      background: #F8FAFC;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      color: #64748B;
      flex-wrap: wrap;
      gap: 8px;
    }
    @media print {
      body { background: #FFFFFF; }
      .toolbar { display: none !important; }
      .sheet { margin: 0; box-shadow: none; border: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div><strong>FlyToAspan</strong> · E-Bilet &amp; Voucher Önizleme (${escapeHtml(booking.pnr)})</div>
    <div>
      <button type="button" onclick="window.print()">PDF Olarak Kaydet / Yazdır</button>
      <button type="button" class="close-btn" onclick="window.close()">Kapat</button>
    </div>
  </div>

  <div class="sheet">
    <div class="hero">
      <div>
        <img src="${escapeHtml(logoUrl)}" alt="FlyToAspan" onerror="this.style.display='none'" />
        <div class="hero-sub">${escapeHtml(docTitle)}</div>
      </div>
      <div style="text-align: right;">
        <span class="status-pill">${escapeHtml(booking.status.toUpperCase())}</span>
        <div style="font-size: 11.5px; color: #CBD5E1; margin-top: 6px;">Düzenlenme: ${escapeHtml(issuedAt)}</div>
      </div>
    </div>

    <div class="pnr-band">
      <div>
        <div class="lbl">Rezervasyon Kodu (PNR)</div>
        <div class="pnr-code">${escapeHtml(booking.pnr)}</div>
      </div>
      <div>
        <div class="lbl">E-Bilet / Belge No</div>
        <div class="val" style="font-family: ui-monospace, monospace;">${escapeHtml(eticketNo)}</div>
      </div>
      <div style="text-align: right;">
        ${barcodeSvg}
      </div>
    </div>

    <div class="body">
      <h1 class="route-title">${escapeHtml(booking.title)}</h1>
      <p class="route-sub">${escapeHtml(booking.subtitle)}</p>

      <div class="grid">
        <div class="box">
          <div class="lbl">Yolcu / Rezervasyon Sahibi</div>
          <div class="val">${escapeHtml(booking.passenger)}</div>
        </div>
        <div class="box">
          <div class="lbl">Seyahat / Hizmet Tarihi</div>
          <div class="val">${escapeHtml(travelDateStr)}</div>
        </div>
        <div class="box">
          <div class="lbl">Hizmet Kategorisi</div>
          <div class="val">${escapeHtml(booking.type)}</div>
        </div>
        <div class="box">
          <div class="lbl">Satış Kanalı / Acente</div>
          <div class="val">${escapeHtml(booking.organizationName || 'FlyToAspan · Infinitive Travel')}${booking.sellerName ? ` (${escapeHtml(booking.sellerName)})` : ''}</div>
        </div>
      </div>

      <div class="price-box">
        <div>
          <div class="lbl" style="color: #0369A1;">Toplam Ödenen Tutar (Vergi &amp; Hizmet Bedeli Dahil)</div>
          <div style="font-size: 12px; color: #475569;">TL Karşılığı: ₺${escapeHtml(formatTRY(booking.price))}</div>
        </div>
        <div class="price-main">${escapeHtml(formatPrice(booking.price, currency))}</div>
      </div>

      <div class="notes">
        <strong>Önemli Seyahat Bilgilendirmesi:</strong> Dış hat uçuşlarında kalkıştan en az 3 saat, iç hat uçuşlarında en az 2 saat önce havalimanında bulunmanız ve geçerli kimlik/pasaportunuzu yanınızda taşımanız gerekmektedir. Online Check-In ve değişiklik işlemleri için <strong>flytoaspan.com</strong> üzerinden PNR kodunuz ve soyadınızla sorgulama yapabilirsiniz.
      </div>
    </div>

    <div class="footer">
      <div><strong>FlyToAspan by Infinitive Travel</strong> · 7/24 Destek: +90 531 460 61 75</div>
      <div>destek@flytoaspan.com · Türkiye &amp; Kazakistan Seyahat Portalı</div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 350);
    });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=920,height=780');
  if (!win) {
    // Fallback: download standalone printable HTML file if popup blocked
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlyToAspan_EBilet_${booking.pnr}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
