// Zero-dependency Resend transactional email service for FlyToAspan
// Activates automatically when RESEND_API_KEY is configured in .env

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

export async function sendMail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim() || 'FlyToAspan <noreply@flytoaspan.com>';
  if (!apiKey || !to) {
    return { sent: false, skipped: 'no_api_key' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(6000),
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
