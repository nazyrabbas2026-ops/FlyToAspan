// Zero-dependency + QR Resend transactional email service for FlyToAspan
// Activates automatically when RESEND_API_KEY is configured in .env
import QRCode from 'qrcode';

function toIataAscii(raw) {
  return String(raw || '')
    .replace(/[Çç]/g, 'C')
    .replace(/[Ğğ]/g, 'G')
    .replace(/[İIıi]/g, 'I')
    .replace(/[Öö]/g, 'O')
    .replace(/[Şş]/g, 'S')
    .replace(/[Üü]/g, 'U')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 /]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toJulianDayOfYear(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '001';
  const [y, m, d] = isoDate.split('-').map(Number);
  const start = Date.UTC(y, 0, 0);
  const current = Date.UTC(y, m - 1, d);
  const day = Math.max(1, Math.min(366, Math.round((current - start) / 86_400_000)));
  return String(day).padStart(3, '0');
}

export function buildIataBcbpString({ passenger, pnr, fromCode, toCode, flightNumber, date, cabin, seat, sequenceNo }) {
  const cleanName = toIataAscii(passenger);
  const parts = cleanName.split(' ').filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] || 'PASSENGER';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
  const nameField = `${last}/${first}`.slice(0, 20).padEnd(20, ' ');
  const pnrField = toIataAscii(pnr).replace(/[^A-Z0-9]/g, '').slice(0, 7).padEnd(7, ' ');
  const fromField = toIataAscii(fromCode).replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
  const toField = toIataAscii(toCode).replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
  const fltClean = toIataAscii(flightNumber || '').replace(/[^A-Z0-9]/g, '');
  const carrierMatch = fltClean.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  const carrierField = (carrierMatch ? carrierMatch[1] : fltClean.slice(0, 2) || 'FT').padEnd(3, ' ');
  const fltNumField = (carrierMatch ? carrierMatch[2] : fltClean.replace(/^[A-Z]+/, '') || '0001').padStart(4, '0').slice(0, 5).padEnd(5, ' ');
  const julianField = toJulianDayOfYear(date);
  const cabinField = /business|biz/i.test(cabin || '') ? 'C' : 'Y';
  const firstSeat = toIataAscii((seat || '').split(',')[0] || '').replace(/[^A-Z0-9]/g, '');
  const seatField = (firstSeat ? firstSeat.padStart(4, '0') : '0000').slice(-4);
  const seqDigits = String(sequenceNo || '1').replace(/\D/g, '') || '1';
  const seqField = seqDigits.padStart(4, '0').slice(-4).padEnd(5, ' ');
  return `M1${nameField}E${pnrField}${fromField}${toField}${carrierField}${fltNumField}${julianField}${cabinField}${seatField}${seqField}100`;
}

function escapeHtml(raw) {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapBrandedEmail(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="tr">
<body style="margin:0;padding:24px;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background:linear-gradient(135deg,#0B1E33,#0D4B5E);padding:22px 28px;color:#FFFFFF;">
      <div style="font-size:20px;font-weight:900;letter-spacing:0.5px;">FlyToAspan <span style="color:#F2C85C;font-size:12px;font-weight:700;">by Infinitive Travel</span></div>
      <div style="font-size:13px;color:#CBD5E1;margin-top:4px;">${escapeHtml(title)}</div>
    </div>
    <div style="padding:26px 28px;font-size:14px;line-height:1.6;">
      ${bodyHtml}
    </div>
    <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:14px 28px;font-size:12px;color:#64748B;">
      FlyToAspan 7/24 Destek: +90 531 460 61 75 · destek@flytoaspan.com
    </div>
  </div>
</body>
</html>`;
}

export async function sendMail({ to, subject, html, attachments }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim() || 'FlyToAspan <noreply@flytoaspan.com>';
  if (!apiKey || !to) {
    return { sent: false, skipped: 'no_api_key' };
  }
  try {
    const payload = { from, to: [to], subject, html };
    if (Array.isArray(attachments) && attachments.length > 0) {
      payload.attachments = attachments;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    return { sent: res.ok, status: res.status };
  } catch {
    return { sent: false, error: 'network_error' };
  }
}

export function sendBookingConfirmationEmail({ to, passenger, pnr, title, date, price }) {
  return sendMail({
    to,
    subject: `FlyToAspan E-Bilet Onayı · PNR: ${pnr}`,
    html: wrapBrandedEmail(
      'Rezervasyonunuz Onaylandı',
      `<p>Sayın <strong>${escapeHtml(passenger)}</strong>,</p>
       <p>Rezervasyonunuz başarıyla oluşturuldu. Detaylarınız aşağıdadır:</p>
       <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:12px;padding:16px;margin:16px 0;">
         <div><strong>PNR Kodu:</strong> <span style="font-size:18px;letter-spacing:1.5px;color:#0B1E33;">${escapeHtml(pnr)}</span></div>
         <div style="margin-top:6px;"><strong>Hizmet / Güzergâh:</strong> ${escapeHtml(title)}</div>
         <div style="margin-top:6px;"><strong>Tarih:</strong> ${escapeHtml(date)}</div>
         <div style="margin-top:6px;"><strong>Toplam Tutar:</strong> ₺${Number(price || 0).toLocaleString('tr-TR')}</div>
       </div>
       <p>Biletinizi PDF olarak indirmek veya sorgulamak için <strong>flytoaspan.com/bilet-islemleri</strong> sayfasını kullanabilirsiniz.</p>`
    ),
  });
}

export function sendCorporateApprovedEmail({ to, firstName, companyName, password, loginUrl }) {
  return sendMail({
    to,
    subject: 'FlyToAspan Kurumsal / Ekip Hesabınız Onaylandı!',
    html: wrapBrandedEmail(
      'Kurumsal Portal Giriş Bilgileriniz',
      `<p>Merhaba <strong>${escapeHtml(firstName)}</strong>,</p>
       <p><strong>${escapeHtml(companyName || 'Kurumsal')}</strong> başvurunuz FlyToAspan yöneticisi tarafından onaylandı.</p>
       <div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:12px;padding:16px;margin:16px 0;">
         <div><strong>Giriş Adresi:</strong> ${escapeHtml(loginUrl || 'https://flytoaspan.com/yonetim')}</div>
         <div style="margin-top:6px;"><strong>E-Posta:</strong> ${escapeHtml(to)}</div>
         <div style="margin-top:6px;"><strong>Tanımlanan Şifre:</strong> <code>${escapeHtml(password)}</code></div>
       </div>
       <p>Güvenliğiniz için ilk girişinizden sonra şifrenizi saklı tutunuz.</p>`
    ),
  });
}

export function sendPasswordResetEmail({ to }) {
  return sendMail({
    to,
    subject: 'FlyToAspan Parola Sıfırlama Talebi',
    html: wrapBrandedEmail(
      'Parola Sıfırlama Talebi',
      `<p>Hesabınız için bir parola sıfırlama talebi alındı.</p>
       <p>Bu işlemi siz yapmadıysanız bu e-postayı dikkate almayabilirsiniz. Yardım için 7/24 destek hattımıza ulaşabilirsiniz.</p>`
    ),
  });
}

function buildBoardingPassEmailHtml({
  passenger,
  pnr,
  airlinePnr,
  eticketNo,
  airline,
  flightNumber,
  routeTitle,
  fromCode,
  toCode,
  date,
  departTime,
  arriveTime,
  baggage,
  cabin,
  seat,
  passengerSeats,
  terminal,
  gate,
  boardingTime,
  gateCloseTime,
  boardingGroup,
  sequenceNo,
  baggageDropNote,
  mobilePassUrl,
  officialQrDataUrl,
  officialPassFileName,
  qrImageDataUrl,
  bcbpCode: providedBcbp,
  lang = 'TR',
}) {
  const copy = {
    TR: {
      header: 'Online Check-In Tamamlandı · Biniş Kartınız Hazır',
      greeting: 'Sayın',
      intro: 'Otomatik Check-In & Koltuk Atama hizmetiniz kapsamında uçuşunuzun online check-in işlemi tamamlanmış ve koltuğunuz atanmıştır. Biniş kartı detaylarınız aşağıdadır:',
      boardingPassTitle: 'DİJİTAL BİNİŞ KARTI / BOARDING PASS',
      seatLbl: 'KOLTUK / SEAT',
      boardingLbl: 'BİNİŞ SAATİ',
      gateCloseLbl: 'KAPI KAPANIŞ',
      terminalLbl: 'TERMİNAL',
      gateLbl: 'KAPI / GATE',
      groupLbl: 'GRUP / ZONE',
      seqLbl: 'SIRA / SEQ',
      pnrLbl: 'PNR KODU',
      airlinePnrLbl: 'HAVAYOLU PNR',
      eticketLbl: 'E-BİLET NO',
      dateLbl: 'UÇUŞ TARİHİ',
      departLbl: 'KALKIŞ',
      arriveLbl: 'VARIŞ',
      baggageLbl: 'BAGAJ HAKKI',
      cabinLbl: 'KABİN',
      paxTableTitle: 'Yolcu & Koltuk Listesi',
      paxCol: 'Yolcu Adı Soyadı',
      seatCol: 'Koltuk',
      seqCol: 'Sıra No',
      noteTitle: 'Havalimanı & Biniş Hatırlatmaları',
      defaultNote: 'Kayıtlı bagajınız varsa uçuş saatinden en az 2 saat önce havalimanındaki Online Check-In / Bagaj Teslim (Bag-Drop) kontuarına uğrayınız. Biniş kapısı kalkıştan 20 dakika önce kapanır. Kimlik veya pasaportunuzu yanınızda bulundurunuz.',
      openMobileBtn: 'Havayolu Mobil Biniş Kartını Aç',
      manageHint: 'Biletinizi ve biniş kartınızı istediğiniz zaman flytoaspan.com/bilet-islemleri sayfasından PNR kodunuzla görüntüleyebilirsiniz.',
      tba: 'Havalimanı Ekranı',
    },
    EN: {
      header: 'Online Check-In Completed · Your Boarding Pass is Ready',
      greeting: 'Dear',
      intro: 'Your online check-in has been completed and your seat has been assigned as part of your Auto Check-In & Seat Assignment service. Your boarding pass details are below:',
      boardingPassTitle: 'DIGITAL BOARDING PASS',
      seatLbl: 'SEAT',
      boardingLbl: 'BOARDING',
      gateCloseLbl: 'GATE CLOSES',
      terminalLbl: 'TERMINAL',
      gateLbl: 'GATE',
      groupLbl: 'ZONE / GROUP',
      seqLbl: 'SEQ NO',
      pnrLbl: 'BOOKING PNR',
      airlinePnrLbl: 'AIRLINE PNR',
      eticketLbl: 'E-TICKET NO',
      dateLbl: 'FLIGHT DATE',
      departLbl: 'DEPARTURE',
      arriveLbl: 'ARRIVAL',
      baggageLbl: 'BAGGAGE',
      cabinLbl: 'CABIN',
      paxTableTitle: 'Passengers & Assigned Seats',
      paxCol: 'Passenger Name',
      seatCol: 'Seat',
      seqCol: 'Seq',
      noteTitle: 'Airport & Boarding Instructions',
      defaultNote: 'If you have checked baggage, please visit the Bag-Drop counter at least 2 hours before departure. Boarding gates close 20 minutes before departure. Keep your passport or ID ready.',
      openMobileBtn: 'Open Airline Mobile Boarding Pass',
      manageHint: 'You can view or download your booking and boarding pass anytime at flytoaspan.com/bilet-islemleri.',
      tba: 'Check Airport Screen',
    },
    RU: {
      header: 'Онлайн-регистрация выполнена · Посадочный талон готов',
      greeting: 'Уважаемый(ая)',
      intro: 'В рамках услуги авторегистрации мы выполнили онлайн-регистрацию на ваш рейс и назначили место в салоне. Данные вашего посадочного талона:',
      boardingPassTitle: 'ПОСАДОЧНЫЙ ТАЛОН / BOARDING PASS',
      seatLbl: 'МЕСТО / SEAT',
      boardingLbl: 'ПОСАДКА',
      gateCloseLbl: 'ЗАКРЫТИЕ ВЫХОДА',
      terminalLbl: 'ТЕРМИНАЛ',
      gateLbl: 'ВЫХОД / GATE',
      groupLbl: 'ГРУППА / ZONE',
      seqLbl: 'SEQ №',
      pnrLbl: 'КОД PNR',
      airlinePnrLbl: 'PNR АВИАКОМПАНИИ',
      eticketLbl: '№ ЭЛ. БИЛЕТА',
      dateLbl: 'ДАТА ВЫЛЕТА',
      departLbl: 'ВЫЛЕТ',
      arriveLbl: 'ПРИЛЁТ',
      baggageLbl: 'БАГАЖ',
      cabinLbl: 'КЛАСС',
      paxTableTitle: 'Пассажиры и назначенные места',
      paxCol: 'Пассажир',
      seatCol: 'Место',
      seqCol: 'Seq',
      noteTitle: 'Памятка для аэропорта',
      defaultNote: 'При наличии регистрируемого багажа подойдите на стойку Bag-Drop не позднее чем за 2 часа до вылета. Посадка закрывается за 20 минут до вылета. Возьмите с собой паспорт.',
      openMobileBtn: 'Открыть мобильный посадочный',
      manageHint: 'Вы всегда можете проверить бронирование и посадочный талон на flytoaspan.com/bilet-islemleri.',
      tba: 'См. табло аэропорта',
    },
    KK: {
      header: 'Онлайн тіркеу аяқталды · Отырғызу талоныңыз дайын',
      greeting: 'Құрметті',
      intro: 'Автоматты тіркелу және орын таңдау қызметі аясында рейсіңізге онлайн тіркеу жасалып, орныңыз бекітілді. Отырғызу талонының мәліметтері төменде:',
      boardingPassTitle: 'САНДЫҚ ОТЫРҒЫЗУ ТАЛОНЫ / BOARDING PASS',
      seatLbl: 'ОРЫН / SEAT',
      boardingLbl: 'ОТЫРҒЫЗУ УАҚЫТЫ',
      gateCloseLbl: 'ҚАҚПА ЖАБЫЛУЫ',
      terminalLbl: 'ТЕРМИНАЛ',
      gateLbl: 'ҚАҚПА / GATE',
      groupLbl: 'ТОП / ZONE',
      seqLbl: 'РЕТТІК №',
      pnrLbl: 'PNR КОДЫ',
      airlinePnrLbl: 'ӘУЕКОМПАНИЯ PNR',
      eticketLbl: 'E-БИЛЕТ №',
      dateLbl: 'ҰШУ КҮНІ',
      departLbl: 'ҰШУ',
      arriveLbl: 'ҚОНУ',
      baggageLbl: 'ЖОЛЖҮК',
      cabinLbl: 'КЛАСС',
      paxTableTitle: 'Жолаушылар және орындар тізімі',
      paxCol: 'Жолаушының аты-жөні',
      seatCol: 'Орын',
      seqCol: 'Seq',
      noteTitle: 'Әуежай және отырғызу ескертпесі',
      defaultNote: 'Тіркелетін жолжүгіңіз болса, ұшудан кемінде 2 сағат бұрын Bag-Drop тағанына келіңіз. Отырғызу қақпасы ұшуға 20 минут қалғанда жабылады. Төлқұжатыңызды ұмытпаңыз.',
      openMobileBtn: 'Мобильді отырғызу талонын ашу',
      manageHint: 'Брондау мен отырғызу талонын кез келген уақытта flytoaspan.com/bilet-islemleri бетінен көре аласыз.',
      tba: 'Әуежай таблосынан қараңыз',
    },
  }[lang] || {};

  const c = copy.header ? copy : {
    header: 'Online Check-In Tamamlandı · Biniş Kartınız Hazır',
    greeting: 'Sayın',
    intro: 'Online check-in işleminiz tamamlanmıştır.',
    boardingPassTitle: 'DİJİTAL BİNİŞ KARTI / BOARDING PASS',
    seatLbl: 'KOLTUK / SEAT',
    boardingLbl: 'BİNİŞ SAATİ',
    gateCloseLbl: 'KAPI KAPANIŞ',
    terminalLbl: 'TERMİNAL',
    gateLbl: 'KAPI / GATE',
    groupLbl: 'GRUP / ZONE',
    seqLbl: 'SIRA / SEQ',
    pnrLbl: 'PNR KODU',
    airlinePnrLbl: 'HAVAYOLU PNR',
    eticketLbl: 'E-BİLET NO',
    dateLbl: 'UÇUŞ TARİHİ',
    departLbl: 'KALKIŞ',
    arriveLbl: 'VARIŞ',
    baggageLbl: 'BAGAJ HAKKI',
    cabinLbl: 'KABİN',
    paxTableTitle: 'Yolcu & Koltuk Listesi',
    paxCol: 'Yolcu Adı Soyadı',
    seatCol: 'Koltuk',
    seqCol: 'Sıra No',
    noteTitle: 'Havalimanı & Biniş Hatırlatmaları',
    defaultNote: 'Kayıtlı bagajınız varsa uçuş saatinden en az 2 saat önce Bag-Drop kontuarına uğrayınız.',
    openMobileBtn: 'Mobil Biniş Kartını Aç',
    manageHint: 'flytoaspan.com/bilet-islemleri',
    tba: 'Havalimanı Ekranı',
  };

  const seatRows = Array.isArray(passengerSeats) && passengerSeats.length > 0
    ? passengerSeats
    : [{ fullName: passenger, seat: seat || '—', seqNo: sequenceNo || '001' }];

  const safeMobileUrl =
    typeof mobilePassUrl === 'string' && /^https?:\/\//i.test(mobilePassUrl.trim())
      ? mobilePassUrl.trim()
      : '';

  const bcbpCode = providedBcbp || buildIataBcbpString({
    passenger,
    pnr: airlinePnr || pnr,
    fromCode: fromCode || 'IST',
    toCode: toCode || 'AYT',
    flightNumber,
    date,
    cabin,
    seat,
    sequenceNo,
  });
  const activeQrSrc = officialQrDataUrl || qrImageDataUrl || '';
  const hasOfficialQr = Boolean(officialQrDataUrl);

  const paxTableHtml = `
    <div style="margin:18px 0 0;">
      <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;margin-bottom:8px;">${escapeHtml(c.paxTableTitle)}</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#F8FAFC;text-align:left;font-size:11px;color:#64748B;">
            <th style="padding:9px 12px;border-bottom:1px solid #E2E8F0;">${escapeHtml(c.paxCol)}</th>
            <th style="padding:9px 12px;border-bottom:1px solid #E2E8F0;">${escapeHtml(c.seatCol)}</th>
            <th style="padding:9px 12px;border-bottom:1px solid #E2E8F0;">${escapeHtml(c.seqCol)}</th>
          </tr>
        </thead>
        <tbody>
          ${seatRows.map((r) => `
            <tr style="font-size:13px;color:#0F172A;">
              <td style="padding:9px 12px;border-bottom:1px solid #F1F5F9;font-weight:700;">${escapeHtml(r.fullName)}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #F1F5F9;"><span style="display:inline-block;padding:3px 10px;border-radius:6px;background:#0B1E33;color:#F2C85C;font-weight:900;letter-spacing:0.06em;">${escapeHtml(r.seat || seat || '—')}</span></td>
              <td style="padding:9px 12px;border-bottom:1px solid #F1F5F9;color:#475569;font-weight:700;">${escapeHtml(r.seqNo || sequenceNo || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  const hasOfficialImage = Boolean(officialQrDataUrl && /^data:image\//i.test(officialQrDataUrl));
  const hasOfficialPdf = Boolean(officialPassFileName && !hasOfficialImage);

  // When the airline's official boarding pass (PNG/JPG or PDF) is uploaded, send a clean FlyToAspan Check-In Summary
  // + the FULL-SIZE official airline boarding pass (or attached PDF) instead of a duplicate FlyToAspan boarding pass!
  if (hasOfficialImage || hasOfficialPdf) {
    const officialBodyHtml = `
      <p style="margin-top:0;">${escapeHtml(c.greeting)} <strong>${escapeHtml(passenger)}</strong>,</p>
      <p style="color:#334155;">${escapeHtml(c.intro)}</p>

      <div style="margin:18px 0;padding:16px 18px;border-radius:14px;background:#F8FAFC;border:1.5px solid #CBD5E1;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:#047857;margin-bottom:8px;">✓ ${escapeHtml(c.header)}</div>
        <div style="font-size:16px;font-weight:900;color:#0B1E33;">${escapeHtml(routeTitle)} ${airline || flightNumber ? `· ${escapeHtml([airline, flightNumber].filter(Boolean).join(' '))}` : ''}</div>
        <div style="font-size:13px;color:#334155;margin-top:6px;">
          <strong>${escapeHtml(c.dateLbl)}:</strong> ${escapeHtml(date)} ${departTime ? `· <strong>${escapeHtml(c.departLbl)}:</strong> ${escapeHtml(departTime)}` : ''}
          · <strong>${escapeHtml(c.airlinePnrLbl)}:</strong> <span style="font-weight:900;color:#0B1E33;">${escapeHtml(airlinePnr || pnr)}</span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:separate;border-spacing:6px;">
          <tr>
            <td style="background:#0B1E33;border-radius:10px;padding:10px 12px;text-align:center;">
              <div style="font-size:10px;color:#94A3B8;font-weight:800;">${escapeHtml(c.seatLbl)}</div>
              <div style="font-size:22px;font-weight:900;color:#F2C85C;">${escapeHtml(seat || '—')}</div>
            </td>
            <td style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;text-align:center;">
              <div style="font-size:10px;color:#64748B;font-weight:800;">${escapeHtml(c.boardingLbl)}</div>
              <div style="font-size:18px;font-weight:900;color:#065F46;">${escapeHtml(boardingTime || '—')}</div>
            </td>
            <td style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;text-align:center;">
              <div style="font-size:10px;color:#64748B;font-weight:800;">${escapeHtml(c.gateLbl)}</div>
              <div style="font-size:16px;font-weight:900;color:#0369A1;">${escapeHtml(gate || c.tba)}</div>
            </td>
          </tr>
        </table>
      </div>

      ${hasOfficialImage ? `
        <div style="margin:20px 0;text-align:center;padding:16px;border-radius:16px;background:#FFFFFF;border:2px solid #0B1E33;">
          <div style="font-size:11px;font-weight:800;color:#047857;letter-spacing:0.06em;margin-bottom:10px;">✓ Resmi Havayolu Barkodu · Havayolunun Resmi Biniş Kartı</div>
          <img src="${escapeHtml(officialQrDataUrl)}" alt="Official Airline Boarding Pass" style="max-width:440px;width:100%;height:auto;border-radius:12px;border:1px solid #E2E8F0;display:block;margin:0 auto;" />
        </div>
      ` : `
        <div style="margin:20px 0;padding:16px 18px;border-radius:14px;background:#ECFDF5;border:1.5px solid #6EE7B7;color:#065F46;font-size:13.5px;font-weight:700;">
          📎 <strong>Resmi Havayolu Biniş Kartınız (${escapeHtml(officialPassFileName)})</strong> bu e-postaya PDF olarak eklenmiştir. Havalimanında doğrudan ekteki resmi havayolu biniş kartını kullanabilirsiniz.
        </div>
      `}

      ${safeMobileUrl ? `
        <div style="text-align:center;margin:18px 0;">
          <a href="${escapeHtml(safeMobileUrl)}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#00A8B5;color:#FFFFFF;font-weight:800;text-decoration:none;font-size:14px;">
            ✈ ${escapeHtml(c.openMobileBtn)}
          </a>
        </div>
      ` : ''}

      <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:12px;padding:14px 16px;margin:16px 0;font-size:12.5px;color:#92400E;">
        <div style="font-weight:800;margin-bottom:4px;">ℹ ${escapeHtml(c.noteTitle)}</div>
        <div>${escapeHtml(baggageDropNote || c.defaultNote)}</div>
      </div>

      <p style="font-size:12.5px;color:#64748B;">${escapeHtml(c.manageHint)}</p>
    `;

    const subjectMapOfficial = {
      TR: `✈ Online Check-In Tamamlandı · Resmi Biniş Kartınız (Koltuk: ${seat || '-'}) · PNR: ${airlinePnr || pnr}`,
      EN: `✈ Online Check-In Completed · Official Boarding Pass (Seat: ${seat || '-'}) · PNR: ${airlinePnr || pnr}`,
      RU: `✈ Онлайн-регистрация выполнена · Официальный посадочный (Место: ${seat || '-'}) · PNR: ${airlinePnr || pnr}`,
      KK: `✈ Онлайн тіркеу аяқталды · Ресми отырғызу талоны (Орын: ${seat || '-'}) · PNR: ${airlinePnr || pnr}`,
    };

    return {
      subject: subjectMapOfficial[lang] || subjectMapOfficial.TR,
      html: wrapBrandedEmail(c.header, officialBodyHtml),
    };
  }

  const bodyHtml = `
    <p style="margin-top:0;">${escapeHtml(c.greeting)} <strong>${escapeHtml(passenger)}</strong>,</p>
    <p style="color:#334155;">${escapeHtml(c.intro)}</p>

    <!-- Realistic Airline Boarding Pass Card -->
    <div style="margin:20px 0;border:2px solid #0B1E33;border-radius:16px;overflow:hidden;background:#FFFFFF;">
      <div style="background:linear-gradient(135deg,#0B1E33 0%,#0E5368 100%);padding:14px 20px;color:#FFFFFF;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;color:#F2C85C;">${escapeHtml(c.boardingPassTitle)}</div>
              <div style="font-size:16px;font-weight:900;margin-top:3px;">${escapeHtml(airline || 'FlyToAspan Flight')} ${flightNumber ? `· ${escapeHtml(flightNumber)}` : ''}</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="font-size:10px;color:#CBD5E1;">${escapeHtml(c.airlinePnrLbl)}</div>
              <div style="font-size:17px;font-weight:900;letter-spacing:1.8px;color:#F2C85C;">${escapeHtml(airlinePnr || pnr)}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding:18px 20px;">
        <!-- Route Row -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
          <tr>
            <td style="width:40%;">
              <div style="font-size:26px;font-weight:900;color:#0B1E33;letter-spacing:0.04em;">${escapeHtml(fromCode || 'DEP')}</div>
              <div style="font-size:12px;color:#475569;font-weight:700;">${escapeHtml(c.departLbl)}: <strong>${escapeHtml(departTime || '—')}</strong></div>
            </td>
            <td align="center" style="width:20%;font-size:20px;color:#00A8B5;font-weight:900;">✈</td>
            <td align="right" style="width:40%;">
              <div style="font-size:26px;font-weight:900;color:#0B1E33;letter-spacing:0.04em;">${escapeHtml(toCode || 'ARR')}</div>
              <div style="font-size:12px;color:#475569;font-weight:700;">${escapeHtml(c.arriveLbl)}: <strong>${escapeHtml(arriveTime || '—')}</strong></div>
            </td>
          </tr>
        </table>
        <div style="font-size:12.5px;color:#475569;padding-bottom:14px;border-bottom:1px dashed #CBD5E1;">
          <strong>${escapeHtml(routeTitle)}</strong> · ${escapeHtml(c.dateLbl)}: <strong>${escapeHtml(date)}</strong>
        </div>

        <!-- Pegasus-Style Split 2D QR Barcode + Gate & Seat Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse;">
          <tr>
            <td style="width:180px;vertical-align:top;padding-right:16px;text-align:center;">
              <div style="border:1.5px solid #CBD5E1;border-radius:12px;padding:10px;background:#FFFFFF;display:inline-block;">
                ${activeQrSrc ? `<img src="${escapeHtml(activeQrSrc)}" alt="Boarding Pass 2D QR Barcode" width="150" height="150" style="display:block;width:150px;height:150px;object-fit:contain;" />` : ''}
                <div style="margin-top:6px;font-size:10px;font-weight:800;color:${hasOfficialQr ? '#047857' : '#475569'};">
                  ${hasOfficialQr ? '✓ Resmi Havayolu Barkodu' : 'IATA 792 2D QR'}
                </div>
              </div>
            </td>
            <td style="vertical-align:top;">
              <div style="background:#0B1E33;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
                <div style="font-size:10px;font-weight:800;color:#94A3B8;letter-spacing:0.08em;">${escapeHtml(c.seatLbl)}</div>
                <div style="font-size:28px;font-weight:900;color:#F2C85C;margin-top:2px;letter-spacing:0.06em;">${escapeHtml(seat || '—')}</div>
              </div>
              <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:10px 14px;margin-bottom:8px;">
                <div style="font-size:10px;font-weight:800;color:#0369A1;letter-spacing:0.08em;">${escapeHtml(c.gateLbl)}</div>
                <div style="font-size:18px;font-weight:900;color:#0C4A6E;margin-top:2px;">${escapeHtml(gate || c.tba)}</div>
              </div>
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:8px 14px;font-size:12px;color:#334155;">
                <strong>${escapeHtml(c.terminalLbl)}:</strong> ${escapeHtml(terminal || '—')}
              </div>
            </td>
          </tr>
        </table>

        <!-- Status Ribbon -->
        <div style="margin-top:14px;padding:9px 14px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;font-size:12.5px;font-weight:800;text-align:center;">
          ✓ ${escapeHtml(c.header)}
        </div>

        <!-- 3-Column Timing Row (Boarding | Gate Close | Departure) -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:separate;border-spacing:6px;">
          <tr>
            <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;width:33.3%;text-align:center;">
              <div style="font-size:10px;font-weight:800;color:#64748B;">${escapeHtml(c.boardingLbl)}</div>
              <div style="font-size:18px;font-weight:900;color:#0B1E33;margin-top:2px;">${escapeHtml(boardingTime || '—')}</div>
            </td>
            <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;width:33.3%;text-align:center;">
              <div style="font-size:10px;font-weight:800;color:#64748B;">${escapeHtml(c.gateCloseLbl)}</div>
              <div style="font-size:18px;font-weight:900;color:#B45309;margin-top:2px;">${escapeHtml(gateCloseTime || '—')}</div>
            </td>
            <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;width:33.3%;text-align:center;">
              <div style="font-size:10px;font-weight:800;color:#64748B;">${escapeHtml(c.departLbl)}</div>
              <div style="font-size:18px;font-weight:900;color:#0B1E33;margin-top:2px;">${escapeHtml(departTime || '—')}</div>
            </td>
          </tr>
        </table>

        <!-- Meta Details Strip (PNR | Group | Seq | Baggage) -->
        <div style="margin-top:12px;padding:10px 12px;background:#F8FAFC;border-radius:10px;font-size:12px;color:#475569;border:1px solid #E2E8F0;">
          <span><strong>${escapeHtml(c.pnrLbl)}:</strong> ${escapeHtml(airlinePnr || pnr)}</span>
          &nbsp;·&nbsp; <span><strong>${escapeHtml(c.groupLbl)}:</strong> ${escapeHtml(boardingGroup || 'Standard')}</span>
          &nbsp;·&nbsp; <span><strong>${escapeHtml(c.seqLbl)}:</strong> ${escapeHtml(sequenceNo || '001')}</span>
          ${eticketNo ? ` &nbsp;·&nbsp; <span><strong>${escapeHtml(c.eticketLbl)}:</strong> ${escapeHtml(eticketNo)}</span>` : ''}
          ${cabin ? ` &nbsp;·&nbsp; <span><strong>${escapeHtml(c.cabinLbl)}:</strong> ${escapeHtml(cabin)}</span>` : ''}
          ${baggage ? `<div style="margin-top:4px;"><strong>${escapeHtml(c.baggageLbl)}:</strong> ${escapeHtml(baggage)}</div>` : ''}
          ${officialPassFileName ? `<div style="margin-top:4px;color:#047857;"><strong>📎 Ekli Resmi Biniş Kartı:</strong> ${escapeHtml(officialPassFileName)}</div>` : ''}
        </div>

        ${paxTableHtml}

        <!-- IATA BCBP String Strip -->
        <div style="margin-top:14px;padding:9px 12px;background:#0F172A;border-radius:10px;text-align:center;">
          <div style="font-family:monospace;font-size:10.5px;letter-spacing:1.4px;color:#CBD5E1;word-break:break-all;">${escapeHtml(bcbpCode)}</div>
        </div>
      </div>
    </div>

    ${safeMobileUrl ? `
      <div style="text-align:center;margin:18px 0;">
        <a href="${escapeHtml(safeMobileUrl)}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#00A8B5;color:#FFFFFF;font-weight:800;text-decoration:none;font-size:14px;">
          ✈ ${escapeHtml(c.openMobileBtn)}
        </a>
      </div>
    ` : ''}

    <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:12px;padding:14px 16px;margin:16px 0;font-size:12.5px;color:#92400E;">
      <div style="font-weight:800;margin-bottom:4px;">ℹ ${escapeHtml(c.noteTitle)}</div>
      <div>${escapeHtml(baggageDropNote || c.defaultNote)}</div>
      ${!hasOfficialQr && !officialPassFileName ? `<div style="margin-top:6px;font-weight:700;">${escapeHtml(
        lang === 'EN'
          ? 'Note: This email is a Check-In Information Summary. Present the airline official boarding pass (app/email attachment) or airport counter printout at security and boarding gates.'
          : lang === 'RU'
            ? 'Примечание: это письмо является информационной сводкой регистрации. Для прохода на посадку используйте официальный посадочный талон авиакомпании или стойку в аэропорту.'
            : lang === 'KK'
              ? 'Ескерту: бұл хат тіркелу туралы ақпараттық түйіндеме. Отырғызу кезінде әуекомпанияның ресми талонын немесе әуежай тағанын пайдаланыңыз.'
              : 'Bilgilendirme: Bu e-posta Check-In Bilgilendirme Özetidir. Havalimanı güvenlik ve kapı geçişlerinde havayolunun resmi biniş kartını (uygulama/ek) veya kontuar çıktısını kullanınız.'
      )}</div>` : ''}
    </div>

    <p style="font-size:12.5px;color:#64748B;">${escapeHtml(c.manageHint)}</p>
  `;

  const subjectMap = {
    TR: `✈ Online Check-In Tamamlandı · Biniş Kartınız (Koltuk: ${seat || '-'}) · PNR: ${airlinePnr || pnr}`,
    EN: `✈ Online Check-In Completed · Your Boarding Pass (Seat: ${seat || '-'}) · PNR: ${airlinePnr || pnr}`,
    RU: `✈ Онлайн-регистрация выполнена · Посадочный талон (Место: ${seat || '-'}) · PNR: ${airlinePnr || pnr}`,
    KK: `✈ Онлайн тіркеу аяқталды · Отырғызу талоны (Орын: ${seat || '-'}) · PNR: ${airlinePnr || pnr}`,
  };

  return {
    subject: subjectMap[lang] || subjectMap.TR,
    html: wrapBrandedEmail(c.header, bodyHtml),
  };
}

export async function sendBoardingPassEmail(payload) {
  const bcbpCode = payload.bcbpString || buildIataBcbpString({
    passenger: payload.passenger,
    pnr: payload.airlinePnr || payload.pnr,
    fromCode: payload.fromCode || 'IST',
    toCode: payload.toCode || 'AYT',
    flightNumber: payload.flightNumber,
    date: payload.date,
    cabin: payload.cabin,
    seat: payload.seat,
    sequenceNo: payload.sequenceNo,
  });

  let qrImageDataUrl = '';
  try {
    qrImageDataUrl = await QRCode.toDataURL(bcbpCode, {
      errorCorrectionLevel: 'M',
      width: 220,
      margin: 1,
      color: { dark: '#0B1E33', light: '#FFFFFF' },
    });
  } catch {
    qrImageDataUrl = '';
  }

  const attachments = [];
  if (typeof payload.officialPassDataUrl === 'string' && payload.officialPassDataUrl.includes(';base64,')) {
    const base64Part = payload.officialPassDataUrl.split(';base64,')[1];
    if (base64Part) {
      attachments.push({
        filename: payload.officialPassFileName || `BoardingPass_${payload.airlinePnr || payload.pnr}.pdf`,
        content: base64Part,
      });
    }
  }

  const { subject, html } = buildBoardingPassEmailHtml({
    ...payload,
    bcbpCode,
    qrImageDataUrl,
  });
  const res = await sendMail({ to: payload.to, subject, html, attachments });
  return {
    ...res,
    to: payload.to,
    subject,
    bcbpCode,
    previewHtml: html,
  };
}
