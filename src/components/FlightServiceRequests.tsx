import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, apiMessage, ApiError } from '../data/api';
import type { CustomerServiceKind, ServiceRequest, ServiceScope } from '../data/api';
import type { LangCode } from '../types';

const labels = {
  TR: {
    heading: 'Uçuş talebi ve takibi', code: 'E-posta kodu', send: 'Kod gönder', open: 'Talepleri aç',
    codeSent: 'Kayıtlı adres uygunsa kod gönderilir. Kod 20 dakika geçerlidir.',
    accessError: 'Rezervasyon hesabınızla giriş yapın veya geçerli e-posta kodunu girin.',
    detail: 'Ekibimiz talebinizi değerlendirir. Gönderim bilette değişiklik veya iade başlatmaz.',
    kind: 'İşlem', scope: 'Uçuş', passenger: 'Yolcu sırası', everyone: 'Tüm yolcular',
    date: 'İstenen yeni tarih', submit: 'Talep gönder', tracking: 'Takip numarası', empty: 'Henüz talep yok.',
    fee: 'Kesinti', refundAmount: 'İade tutarı', estimated: 'Tahmini',
    kinds: { cancel: 'İptal', change: 'Değişiklik', refund: 'İade', ticketing_issue: 'Biletleme kontrolü', schedule_change: 'Uçuş değişikliği', payment_mismatch: 'Ödeme kontrolü' },
    scopes: { all: 'Tüm uçuşlar', outbound: 'Gidiş', return: 'Dönüş' },
    statuses: { received: 'Alındı', in_review: 'İnceleniyor', rejected: 'Reddedildi', completed: 'Tamamlandı' },
  },
  EN: {
    heading: 'Flight requests and tracking', code: 'Email code', send: 'Send code', open: 'Open requests',
    codeSent: 'If a registered address is available, a code is sent. It is valid for 20 minutes.',
    accessError: 'Sign in with the booking account or enter a valid email code.',
    detail: 'Our team reviews your request. Submitting it does not change your ticket or issue a refund.',
    kind: 'Action', scope: 'Flight', passenger: 'Passenger number', everyone: 'All passengers',
    date: 'Requested new date', submit: 'Submit request', tracking: 'Tracking number', empty: 'No requests yet.',
    fee: 'Deduction', refundAmount: 'Refund amount', estimated: 'Estimated',
    kinds: { cancel: 'Cancellation', change: 'Change', refund: 'Refund', ticketing_issue: 'Ticketing review', schedule_change: 'Schedule change', payment_mismatch: 'Payment review' },
    scopes: { all: 'All flights', outbound: 'Outbound', return: 'Return' },
    statuses: { received: 'Received', in_review: 'In review', rejected: 'Declined', completed: 'Completed' },
  },
  RU: {
    heading: 'Заявки по рейсу и их статус', code: 'Код из письма', send: 'Отправить код', open: 'Открыть заявки',
    codeSent: 'Если адрес указан в брони, на него придёт код. Код действует 20 минут.',
    accessError: 'Войдите в аккаунт бронирования или введите действующий код из письма.',
    detail: 'Команда рассмотрит заявку. Отправка заявки не меняет билет и не запускает возврат.',
    kind: 'Действие', scope: 'Рейс', passenger: 'Номер пассажира', everyone: 'Все пассажиры',
    date: 'Желаемая новая дата', submit: 'Отправить заявку', tracking: 'Номер заявки', empty: 'Заявок пока нет.',
    fee: 'Удержание', refundAmount: 'Сумма возврата', estimated: 'Предварительно',
    kinds: { cancel: 'Отмена', change: 'Изменение', refund: 'Возврат', ticketing_issue: 'Проверка билета', schedule_change: 'Изменение расписания', payment_mismatch: 'Проверка оплаты' },
    scopes: { all: 'Все рейсы', outbound: 'Туда', return: 'Обратно' },
    statuses: { received: 'Получена', in_review: 'На рассмотрении', rejected: 'Отклонена', completed: 'Выполнена' },
  },
  KK: {
    heading: 'Рейс өтінімдері және олардың күйі', code: 'Электрондық пошта коды', send: 'Код жіберу', open: 'Өтінімдерді ашу',
    codeSent: 'Тіркелген мекенжай болса, код жіберіледі. Код 20 минут жарамды.',
    accessError: 'Брондау тіркелгісіне кіріңіз немесе жарамды пошта кодын енгізіңіз.',
    detail: 'Топ өтінімді қарайды. Өтінім жіберу билетті өзгертпейді және ақшаны қайтаруды бастамайды.',
    kind: 'Әрекет', scope: 'Рейс', passenger: 'Жолаушы нөмірі', everyone: 'Барлық жолаушылар',
    date: 'Қалаған жаңа күн', submit: 'Өтінім жіберу', tracking: 'Өтінім нөмірі', empty: 'Өтінімдер әлі жоқ.',
    fee: 'Ұсталым', refundAmount: 'Қайтарым сомасы', estimated: 'Болжамды',
    kinds: { cancel: 'Бас тарту', change: 'Өзгерту', refund: 'Қайтару', ticketing_issue: 'Билетті тексеру', schedule_change: 'Кесте өзгерісі', payment_mismatch: 'Төлемді тексеру' },
    scopes: { all: 'Барлық рейстер', outbound: 'Бару', return: 'Қайту' },
    statuses: { received: 'Қабылданды', in_review: 'Қаралуда', rejected: 'Қабылданбады', completed: 'Аяқталды' },
  },
};

export function FlightServiceRequests({ pnr, surname, lang }: { pnr: string; surname: string; lang: LangCode }) {
  const ui = labels[lang];
  const [code, setCode] = useState('');
  const [records, setRecords] = useState<Awaited<ReturnType<typeof api.serviceRequests>> | null>(null);
  const [kind, setKind] = useState<CustomerServiceKind>('cancel');
  const [scope, setScope] = useState<ServiceScope>('all');
  const [passenger, setPassenger] = useState(0);
  const [date, setDate] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const access = { pnr, surname, code };
  const amount = new Intl.NumberFormat(lang === 'KK' ? 'kk-KZ' : lang, { style: 'currency', currency: 'TRY' });

  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError(ui.accessError);
        setRecords(null);
      } else {
        setError(apiMessage(cause));
      }
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const { request } = await api.createServiceRequest({
        ...access, kind, scope, passenger, requestedDate: kind === 'change' ? date : '',
      });
      setRecords((current) => current && ({
        ...current, requests: [request, ...current.requests.filter((row) => row.id !== request.id)],
      }));
      setNotice(ui.tracking + ' ' + request.id);
    });
  }

  function renderRequest(row: ServiceRequest) {
    return (
      <li key={row.id} style={{ marginBottom: 8 }}>
        <strong>{ui.kinds[row.kind]} · {ui.statuses[row.status]}</strong>
        <div>{ui.tracking} <code>{row.id}</code></div>
        <div>
          {ui.scopes[row.scope]} · {row.passenger ? ui.passenger + ' ' + row.passenger : ui.everyone}
          {row.requestedDate && ' · ' + row.requestedDate}
        </div>
        {row.status === 'in_review' && (row.feeKurus !== null || row.refundKurus !== null) && <div>{ui.estimated}</div>}
        {row.feeKurus !== null && <div>{ui.fee} {amount.format(row.feeKurus / 100)}</div>}
        {row.refundKurus !== null && row.status !== 'rejected' && <div>{ui.refundAmount} {amount.format(row.refundKurus / 100)}</div>}
      </li>
    );
  }

  return (
    <section style={{ margin: '16px 0', display: 'grid', gap: 10 }} aria-labelledby="flight-service-title">
      <h2 id="flight-service-title" style={{ fontSize: 18, margin: 0 }}>{ui.heading}</h2>
      <div className="panel-actions">
        <button type="button" className="uf-quick-pill" disabled={pending} onClick={() => void run(async () => {
          await api.sendServiceCode(pnr, surname);
          setRecords(null);
          setCode('');
          setNotice(ui.codeSent);
        })}>{ui.send}</button>
        <button type="button" className="uf-quick-pill" disabled={pending} onClick={() => void run(async () => {
          setRecords(await api.serviceRequests(access));
        })}>{ui.open}</button>
      </div>
      {!records && <label>
        {ui.code}
        <input className="modal-input" autoComplete="one-time-code" maxLength={12} value={code}
          onChange={(event) => setCode(event.target.value.trim().toUpperCase())} />
      </label>}
      {error && <div role="alert" className="form-action-error">{error}</div>}
      {notice && <div role="status">{notice}</div>}
      {records && <>
        <p style={{ margin: 0 }}>{ui.detail}</p>
        <form onSubmit={submit} className="panel-form-grid">
          <label>{ui.kind}
            <select className="modal-input" value={kind} onChange={(event) => setKind(event.target.value as CustomerServiceKind)}>
              {(['cancel', 'change', 'refund'] as const).map((value) => <option key={value} value={value}>{ui.kinds[value]}</option>)}
            </select>
          </label>
          <label>{ui.scope}
            <select className="modal-input" value={scope} onChange={(event) => setScope(event.target.value as ServiceScope)}>
              {(['all', 'outbound', 'return'] as const).filter((value) => value !== 'return' || records.hasReturn)
                .map((value) => <option key={value} value={value}>{ui.scopes[value]}</option>)}
            </select>
          </label>
          {records.passengerCount > 1 && <label>{ui.passenger}
            <select className="modal-input" value={passenger} onChange={(event) => setPassenger(Number(event.target.value))}>
              <option value={0}>{ui.everyone}</option>
              {Array.from({ length: records.passengerCount }, (_, index) => index + 1)
                .map((number) => <option key={number} value={number}>{number}</option>)}
            </select>
          </label>}
          {kind === 'change' && <label>{ui.date}
            <input className="modal-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>}
          <button type="submit" className="adm-btn adm-btn-blue" disabled={pending}>{ui.submit}</button>
        </form>
        {records.requests.length ? <ul style={{ margin: 0, paddingInlineStart: 18 }}>{records.requests.map(renderRequest)}</ul> : <p style={{ margin: 0 }}>{ui.empty}</p>}
      </>}
    </section>
  );
}
