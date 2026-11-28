import { PanelMfaForm } from './PanelMfaForm';
import { useEffect, useRef, useState } from 'react';
import { Activity, Clipboard, Code2, ExternalLink, LayoutGrid, LogOut, RefreshCw, Search, Ticket, Users, Wallet, X } from 'lucide-react';
import { api, apiMessage } from '../data/api';
import { formatDisplayDate, formatPrice } from '../data/mockData';
import type { BookingRecord, UserProfile } from '../types';
import './developerWorkspace.css';

const sections = [
  { id: 'ozet', label: 'Özet', compact: 'Özet', icon: LayoutGrid },
  { id: 'rezervasyon', label: 'Rezervasyonlar', compact: 'Kayıtlar', icon: Ticket },
  { id: 'uyeler', label: 'Üyeler', compact: 'Üyeler', icon: Users },
  { id: 'hareketler', label: 'Hareketler', compact: 'Hareketler', icon: Activity },
  { id: 'saglik', label: 'Site Sağlığı', compact: 'Sağlık', icon: Activity },
  { id: 'degisiklik', label: 'AI Görevleri', compact: 'AI', icon: Code2 },
] as const;

const periods = [
  { id: 'today', label: 'Bugün' },
  { id: '7d', label: 'Son 7 gün' },
  { id: '30d', label: 'Son 30 gün' },
] as const;

type Section = typeof sections[number]['id'];
type Period = typeof periods[number]['id'];
type Analytics = Awaited<ReturnType<typeof api.adminAnalytics>>;
type Bookings = Awaited<ReturnType<typeof api.bookings>>;

const actionTime = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul',
});
const stepLabels: Record<string, string> = {
  search: 'Arama yaptı', select: 'Ürün seçti', passenger_form: 'Yolcu formuna geldi',
  checkout_submit: 'Formu gönderdi', checkout_error: 'Kayıt sırasında hata aldı', booking_complete: 'Rezervasyon oluşturdu',
};
const methodLabels: Record<string, string> = {
  password: 'Parola', password_2fa: 'Parola + 2FA', email_registration: 'E-posta ile kayıt',
};
const deviceLabels: Record<string, string> = { desktop: 'Bilgisayar', mobile: 'Telefon', tablet: 'Tablet' };

function currentSection(): Section {
  return sections.find(({ id }) => '#' + id === window.location.hash)?.id ?? 'ozet';
}

function pageSize() {
  return window.innerHeight < 500 ? 2 : window.innerHeight < 660 ? 4 : window.innerHeight < 820 ? 6 : 8;
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  return (
    <div className="dev-pager">
      <span>{total.toLocaleString('tr-TR')} kayıt</span>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Önceki</button>
      <span>{page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Sonraki</button>
    </div>
  );
}

export default function DeveloperWorkspace({ user, onLogout, onAccountChanged }: {
  user: UserProfile; onLogout: () => void; onAccountChanged: (user: UserProfile) => void;
}) {
  const [section, setSection] = useState(currentSection);
  const [range, setRange] = useState<Period>('7d');
  const [revision, setRevision] = useState(0);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [records, setRecords] = useState<Bookings | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingText, setBookingText] = useState('');
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [bookingPage, setBookingPage] = useState(1);
  const [listSize, setListSize] = useState(pageSize);
  const [userQuery, setUserQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [activityView, setActivityView] = useState<'accounts' | 'journeys'>('accounts');
  const [activityPage, setActivityPage] = useState(1);
  const [selected, setSelected] = useState<BookingRecord | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const resize = () => setListSize(pageSize());
    const syncSection = () => setSection(currentSection());
    window.addEventListener('resize', resize);
    window.addEventListener('hashchange', syncSection);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('hashchange', syncSection);
    };
  }, []);

  useEffect(() => {
    if (section === 'degisiklik') return;
    const controller = new AbortController();
    setError('');
    setLoading(true);
    const signal = controller.signal;
    const request = section === 'rezervasyon'
      ? api.bookings(true, signal, { q: query, type: product, status, page: bookingPage, limit: listSize })
        .then((result) => { if (!signal.aborted) setRecords(result); })
      : section === 'uyeler'
        ? api.adminUsers(signal).then((result) => { if (!signal.aborted) setUsers(result.users); })
        : api.adminAnalytics({ range, activity: section === 'hareketler' }, signal)
          .then((result) => { if (!signal.aborted) setAnalytics(result); });
    void request
      .catch((cause: unknown) => { if (!signal.aborted) setError(apiMessage(cause)); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [section, range, revision, bookingPage, listSize, query, product, status]);

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);

  const openSection = (id: Section) => {
    setSection(id);
    window.history.replaceState(null, '', '#' + id);
  };
  const refresh = () => setRevision((value) => value + 1);
  const memberSearch = userQuery.trim().toLocaleLowerCase('tr');
  const matchedUsers = users.filter(({ firstName, lastName, email }) =>
    (firstName + ' ' + lastName + ' ' + email).toLocaleLowerCase('tr').includes(memberSearch)
  );
  const memberPages = Math.max(1, Math.ceil(matchedUsers.length / listSize));
  const shownUserPage = Math.min(userPage, memberPages);
  const memberRows = matchedUsers.slice((shownUserPage - 1) * listSize, shownUserPage * listSize);
  const activitySize = Math.max(1, listSize - 2);
  const totalActivity = analytics?.activity?.[activityView].length ?? 0;
  const activityPages = Math.max(1, Math.ceil(totalActivity / activitySize));
  const shownActivityPage = Math.min(activityPage, activityPages);
  const activityStart = (shownActivityPage - 1) * activitySize;

  return (
    <div className="dev-workspace" lang="tr">
      <header className="dev-header">
        <div className="dev-title"><Code2 size={21} /><h1>Geliştirici Paneli</h1></div>
        <div className="dev-header-actions">
          <span className="dev-account">{user.firstName} · {user.role === 'admin' ? 'Süper Admin' : 'Geliştirici + Analist'}</span>
          <a href="/" target="_blank" rel="noreferrer"><ExternalLink size={16} /> <span>Site</span></a>
          <a href="/yonetim"><span>Yönetim</span></a>
          <button type="button" onClick={onLogout}><LogOut size={16} /> <span>Çıkış</span></button>
        </div>
      </header>

      <details className="dev-box">
        <summary>Hesap güvenliği</summary>
        <PanelMfaForm active={Boolean(user.totpEnabled)} onComplete={onAccountChanged} />
      </details>
      <nav className="dev-nav" aria-label="Geliştirici paneli bölümleri">
        {sections.map(({ id, label, compact, icon: Icon }) => (
          <button key={id} type="button" aria-label={label} aria-current={section === id ? 'page' : undefined}
            onClick={() => openSection(id)}>
            <Icon size={17} /><span className="dev-nav-label">{label}</span><span className="dev-nav-compact">{compact}</span>
          </button>
        ))}
      </nav>

      <div className="dev-content">
        <div className="dev-toolbar">
          <h2>{sections.find(({ id }) => id === section)?.label}</h2>
          {section !== 'degisiklik' && (
            <div className="dev-tools">
              {(section === 'ozet' || section === 'saglik' || section === 'hareketler') && (
                <select aria-label="Rapor dönemi" value={range} onChange={(event) => {
                  setRange(event.target.value as Period);
                  setActivityPage(1);
                }}>
                  {periods.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                </select>
              )}
              <button type="button" onClick={refresh} disabled={loading} aria-label="Verileri yenile">
                <RefreshCw size={16} /> <span>Yenile</span>
              </button>
            </div>
          )}
        </div>

        {section !== 'degisiklik' && (error ? <p className="dev-feedback dev-error" role="alert">{error}</p> :
          loading ? <p className="dev-feedback" role="status">Veriler yükleniyor…</p> : null)}

        {section === 'ozet' && analytics && (
          <>
            <div className="dev-metrics">
              <button type="button" onClick={() => openSection('rezervasyon')}><Ticket size={17} /><span>Rezervasyon</span><strong>{analytics.funnel.bookingsCreated}</strong></button>
              <button type="button" onClick={() => openSection('uyeler')}><Users size={17} /><span>Toplam üye</span><strong>{analytics.members.totalUsers}</strong></button>
              <div><Wallet size={17} /><span>Doğrulanmış satış</span><strong>{formatPrice(analytics.sales.verifiedLiveVolumeTRY)}</strong></div>
              <button type="button" onClick={() => openSection('saglik')}><Activity size={17} /><span>Teknik hata</span><strong>{analytics.health.clientErrors + analytics.health.serverErrors}</strong></button>
            </div>
            <div className="dev-overview">
              <section className="dev-box" aria-label="Rezervasyon adımları">
                <h3>Rezervasyon adımları</h3>
                <table className="dev-table">
                  <thead><tr><th>Adım</th><th>Olay sayısı</th></tr></thead>
                  <tbody>
                    {[
                      ['Arama', analytics.funnel.searches],
                      ['Ürün seçimi', analytics.funnel.selections],
                      ['Yolcu formu', analytics.funnel.passengerForms],
                      ['Form gönderimi', analytics.funnel.checkoutSubmits],
                      ['Oluşan rezervasyon', analytics.funnel.bookingsCreated],
                    ].map(([label, count]) => <tr key={label}><td>{label}</td><td>{count}</td></tr>)}
                  </tbody>
                </table>
              </section>
              <section className="dev-box" aria-label="Operasyon özeti">
                <h3>Operasyon özeti</h3>
                <dl className="dev-facts">
                  <div><dt>Sayfa görüntüleme</dt><dd>{analytics.funnel.pageViews}</dd></div>
                  <div><dt>Dönem girişleri</dt><dd>{analytics.members.loginsInPeriod}</dd></div>
                  <div><dt>Deneme hacmi</dt><dd>{formatPrice(analytics.sales.demoVolumeTRY)}</dd></div>
                  <div><dt>İade kaydı</dt><dd>{analytics.sales.refundedCount}</dd></div>
                  <div><dt>Şüpheli trafik sinyali</dt><dd>{analytics.health.suspiciousAlerts.length}</dd></div>
                </dl>
              </section>
            </div>
          </>
        )}

        {section === 'rezervasyon' && (
          <section className="dev-box" aria-label="Rezervasyon kayıtları">
            <form className="dev-filters" onSubmit={(event) => {
              event.preventDefault();
              setBookingPage(1);
              setQuery(bookingText.trim());
            }}>
              <input aria-label="Rezervasyon kodu veya rota" placeholder="Rezervasyon kodu veya rota" value={bookingText} onChange={(event) => setBookingText(event.target.value)} />
              <select aria-label="Hizmet" value={product} onChange={(event) => { setBookingPage(1); setProduct(event.target.value); }}>
                <option value="ALL">Tüm hizmetler</option>
                {['Uçak', 'Otel', 'Transfer', 'Tur'].map((item) => <option key={item}>{item}</option>)}
              </select>
              <select aria-label="Rezervasyon durumu" value={status} onChange={(event) => { setBookingPage(1); setStatus(event.target.value); }}>
                <option value="ALL">Tüm durumlar</option>
                {['Onaylandı', 'Tamamlandı', 'İptal Talebi', 'İptal Edildi', 'İade Edildi'].map((item) => <option key={item}>{item}</option>)}
              </select>
              <button type="submit" className="dev-primary"><Search size={15}/> Ara</button>
            </form>
            <div className="dev-table-wrap">
              <table className="dev-table">
                <thead><tr><th>PNR</th><th>Rota / ürün</th><th className="dev-wide">Seyahat</th><th className="dev-wide">Durum</th><th>Tutar</th></tr></thead>
                <tbody>{records?.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td><button className="dev-link" type="button" onClick={() => setSelected(booking)}>{booking.pnr}</button></td>
                    <td>{booking.title}<small>{booking.type}{booking.demo ? ' · Deneme' : ''}</small></td>
                    <td className="dev-wide">{formatDisplayDate(booking.date, 'TR')}</td>
                    <td className="dev-wide">{booking.status}</td>
                    <td>{formatPrice(booking.price)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {!loading && !error && records?.bookings.length === 0 && <p className="dev-empty">Aramaya uygun kayıt bulunamadı.</p>}
            {records && <Pager page={records.page ?? bookingPage} pages={records.totalPages ?? 1} total={records.total ?? 0} onPage={setBookingPage} />}
          </section>
        )}

        {section === 'uyeler' && (
          <section className="dev-box" aria-label="Üye kayıtları">
            <div className="dev-filters">
              <input type="search" aria-label="Üye ara" placeholder="Maskeli üye bilgisi ara" value={userQuery}
                onChange={(event) => { setUserPage(1); setUserQuery(event.target.value); }} />
            </div>
            <div className="dev-table-wrap">
              <table className="dev-table">
                <thead><tr><th>Üye</th><th>Hesap</th><th className="dev-wide">Kayıt tarihi</th><th className="dev-wide">Durum</th></tr></thead>
                <tbody>{memberRows.map((member) => (
                  <tr key={member.id}>
                    <td>{member.firstName} {member.lastName}<small>{member.email}</small></td>
                    <td>{member.roleLabel || (member.accountType === 'corporate' ? 'Kurumsal' : 'Bireysel')}</td>
                    <td className="dev-wide">{formatDisplayDate(member.createdAt, 'TR')}</td>
                    <td className="dev-wide">{member.status === 'pending' ? 'Bekliyor' : member.status === 'suspended' ? 'Askıda' : 'Aktif'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {!loading && !error && !matchedUsers.length && <p className="dev-empty">Aramaya uygun üye bulunamadı.</p>}
            <Pager page={shownUserPage} pages={memberPages} total={matchedUsers.length} onPage={setUserPage} />
          </section>
        )}

        {section === 'hareketler' && (
          <section className="dev-box" aria-label="Son hareketler">
            <div className="dev-filters" aria-label="Hareket türü">
              <button type="button" aria-pressed={activityView === 'accounts'} onClick={() => {
                setActivityView('accounts'); setActivityPage(1);
              }}>Hesap girişleri</button>
              <button type="button" aria-pressed={activityView === 'journeys'} onClick={() => {
                setActivityView('journeys'); setActivityPage(1);
              }}>Ziyaret akışı</button>
            </div>
            <p className="dev-empty">{activityView === 'accounts'
              ? 'Son 60 giriş ve kayıt · Türkiye saati'
              : 'Analitik tercihi açık oturumların son ölçülen adımı · Son 60 oturum · Türkiye saati'}</p>
            {activityView === 'accounts' ? (
              <table className="dev-table dev-activity-table">
                <thead><tr><th>Hesap</th><th>İşlem / yöntem</th><th>Tarih ve saat</th><th className="dev-wide">Cihaz</th></tr></thead>
                <tbody>{analytics?.activity?.accounts.slice(activityStart, activityStart + activitySize).map((item) => (
                  <tr key={item.id}>
                    <td>{item.email}</td>
                    <td>{item.event === 'user_register' ? 'Üyelik' : 'Giriş'}<small>{methodLabels[item.method ?? ''] ?? '—'}</small></td>
                    <td>{actionTime.format(item.occurredAt)}</td>
                    <td className="dev-wide">{deviceLabels[item.device ?? ''] ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : (
              <table className="dev-table dev-activity-table">
                <thead><tr><th>Anonim oturum</th><th>Son adım</th><th>Tarih ve saat</th></tr></thead>
                <tbody>{analytics?.activity?.journeys.slice(activityStart, activityStart + activitySize).map((item) => (
                  <tr key={item.session}>
                    <td>{item.session}</td>
                    <td>{stepLabels[item.step]}<small>{item.product || '—'}</small></td>
                    <td>{actionTime.format(item.occurredAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {!loading && !error && totalActivity === 0 && <p className="dev-empty">Bu dönemde gösterilecek hareket bulunamadı.</p>}
            <Pager page={shownActivityPage} pages={activityPages} total={totalActivity} onPage={setActivityPage} />
          </section>
        )}

        {section === 'saglik' && analytics && (
          <div className="dev-overview">
            <section className="dev-box" aria-label="Teknik sağlık sayıları">
              <h3>Teknik sağlık</h3>
              <dl className="dev-facts">
                <div><dt>Tarayıcı hataları</dt><dd>{analytics.health.clientErrors}</dd></div>
                <div><dt>Sunucu hataları</dt><dd>{analytics.health.serverErrors}</dd></div>
                <div><dt>Başarısız girişler</dt><dd>{analytics.health.authFailures}</dd></div>
                <div><dt>Hız sınırına takılan istekler</dt><dd>{analytics.health.rateLimited}</dd></div>
              </dl>
            </section>
            <section className="dev-box" aria-label="Trafik sinyalleri">
              <h3>Şüpheli trafik sinyalleri</h3>
              {analytics.health.suspiciousAlerts.length ? (
                <ul className="dev-signals">{analytics.health.suspiciousAlerts.map((alert) => <li key={alert.code}>{alert.reason}</li>)}</ul>
              ) : <p className="dev-empty">Bu dönemde şüpheli trafik sinyali kaydedilmedi.</p>}
              <h3>Servis yapılandırması</h3>
              <dl className="dev-facts">
                {Object.entries(analytics.integrations).map(([service, info]) => (
                  <div key={service}><dt>{service}</dt><dd>{info.configured ? 'Yapılandırılmış' : 'Ayar eksik'}</dd></div>
                ))}
              </dl>
            </section>
          </div>
        )}

        <div hidden={section !== 'degisiklik'}><ChangeBrief /></div>
      </div>

      <dialog className="dev-dialog" aria-labelledby="dev-booking-title" ref={dialog} onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <header><h2 id="dev-booking-title">{selected.pnr}</h2><button type="button" aria-label="Ayrıntıyı kapat" onClick={() => dialog.current?.close()}><X size={19} /></button></header>
            <strong>{selected.title}</strong>
            <p>{selected.type}{selected.demo ? ' · Deneme' : ''}</p>
            <dl className="dev-facts">
              <div><dt>Yolcu</dt><dd>{selected.passenger}</dd></div>
              <div><dt>Gidiş / giriş</dt><dd>{formatDisplayDate(selected.date, 'TR')}</dd></div>
              {selected.returnDate && <div><dt>Dönüş / çıkış</dt><dd>{formatDisplayDate(selected.returnDate, 'TR')}</dd></div>}
              <div><dt>Durum</dt><dd>{selected.status}</dd></div>
              <div><dt>Tutar</dt><dd>{formatPrice(selected.price)}</dd></div>
            </dl>
          </div>
        )}
      </dialog>
    </div>
  );
}

function ChangeBrief() {
  const [area, setArea] = useState('Müşteri sitesi');
  const [task, setTask] = useState('');
  const [feedback, setFeedback] = useState('');
  const notes = task.trim();
  const prompt = notes ? [
    'FlyToAspan projesinde şu değişikliği yap.',
    'Alan: ' + area,
    '',
    notes,
    '',
    'Önce proje kurallarını ve mevcut değişiklikleri incele. Uygulamayı ayrı bir çalışma dalında yap.',
    'İlgili akışları yerel test verisiyle doğrula. Sonucu, değişen dosyaları ve testleri raporla.',
    'Canlıya yayınlama için site sahibinin onayını bekle.',
  ].join('\n') : '';

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setFeedback('Görev metni kopyalandı.');
    } catch {
      setFeedback('Görev metnini önizlemeden seçip kopyalayabilirsin.');
    }
  };

  return (
    <div className="dev-overview dev-brief">
      <section className="dev-box">
        <h3>Değişiklik isteği</h3>
        <div className="dev-field">
          <label htmlFor="dev-task-area">Alan</label>
          <select id="dev-task-area" value={area} onChange={(event) => { setArea(event.target.value); setFeedback(''); }}>
            <option>Müşteri sitesi</option><option>Rezervasyon ve ödeme</option><option>Yönetim paneli</option>
            <option>Analiz ve altyapı</option>
          </select>
        </div>
        <div className="dev-field">
          <label htmlFor="dev-task-request">Ne değişsin?</label>
          <textarea id="dev-task-request" value={task} onChange={(event) => { setTask(event.target.value); setFeedback(''); }}
            maxLength={2400} placeholder="Örn. Mobilde bilet sorgulama düğmesini görünür tut." />
        </div>
      </section>
      <section className="dev-box">
        <h3>Codex / Neon için görev</h3>
        <textarea aria-label="Görev metni önizlemesi" readOnly value={prompt} placeholder="Değişiklik isteğini yazınca görev metni burada görünür." />
        <button type="button" className="dev-primary" disabled={!prompt} onClick={() => void copyPrompt()}><Clipboard size={16} /> Görevi kopyala</button>
        {feedback && <p className="dev-feedback" role="status">{feedback}</p>}
      </section>
    </div>
  );
}
