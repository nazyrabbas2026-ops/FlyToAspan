import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, apiMessage } from '../data/api';
import type { OperationsServiceKind, ServiceStatus, StaffServiceRequest } from '../data/api';

const kinds = {
  cancel: 'İptal', change: 'Değişiklik', refund: 'İade', ticketing_issue: 'Biletleme sorunu',
  schedule_change: 'Uçuş saati değişikliği / iptali', payment_mismatch: 'Ödeme ve bilet kaydı farkı',
};
const operationsKinds = ['ticketing_issue', 'schedule_change', 'payment_mismatch'] as const;
const statuses = { received: 'Alındı', in_review: 'İnceleniyor', rejected: 'Reddedildi', completed: 'Tamamlandı' };
const scopes = { all: 'Tüm uçuşlar', outbound: 'Gidiş', return: 'Dönüş' };
const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

export function FlightOperationsQueue({ operator, refunds }: { operator: boolean; refunds: boolean }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.operationsQueue>>>();
  const [page, setPage] = useState(1);
  const [closed, setClosed] = useState(false);
  const [version, setVersion] = useState(0);
  const [pnr, setPnr] = useState('');
  const [kind, setKind] = useState<OperationsServiceKind>('ticketing_issue');
  const [editing, setEditing] = useState<StaffServiceRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    setData(undefined);
    setLoadError('');
    api.operationsQueue(page, closed).then(
      (result) => { if (active) setData(result); },
      (cause) => { if (active) setLoadError(apiMessage(cause)); },
    );
    return () => { active = false; };
  }, [page, closed, version]);

  async function save(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      setEditing(null);
      setVersion((previous) => previous + 1);
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function switchPage(next: number, nextClosed = closed) {
    setEditing(null);
    setError('');
    setPage(next);
    setClosed(nextClosed);
  }

  function update(event: FormEvent<HTMLFormElement>, row: StaffServiceRequest) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fee = form.get('fee');
    const refund = form.get('refund');
    void save(() => api.updateOperationsCase(row.id, {
      revision: row.revision,
      status: form.get('status') as ServiceStatus,
      feeKurus: fee ? Math.round(Number(fee) * 100) : null,
      refundKurus: refund ? Math.round(Number(refund) * 100) : null,
      reference: String(form.get('reference') || ''),
      contacted: form.has('contacted'),
    }));
  }

  return (
    <section className="panel-card" style={{ display: 'grid', gap: 12 }} aria-labelledby="flight-operations-title">
      <h2 id="flight-operations-title" style={{ margin: 0, fontSize: 18 }}>Uçuş işlem kuyruğu</h2>
      {operator && <form className="panel-form-grid" onSubmit={(event) => {
        event.preventDefault();
        void save(async () => {
          await api.createOperationsCase(pnr, kind);
          setPnr('');
          switchPage(1, false);
        });
      }}>
        <label>Rezervasyon kodu
          <input className="modal-input" required minLength={5} maxLength={24} value={pnr}
            onChange={(event) => setPnr(event.target.value.toUpperCase())} />
        </label>
        <label>Operasyon konusu
          <select className="modal-input" value={kind} onChange={(event) => setKind(event.target.value as OperationsServiceKind)}>
            {operationsKinds.map((value) => <option key={value} value={value}>{kinds[value]}</option>)}
          </select>
        </label>
        <button type="submit" className="adm-btn adm-btn-blue" disabled={busy}>Kayıt aç</button>
      </form>}
      <div className="panel-actions">
        <button type="button" className="uf-quick-pill" aria-pressed={!closed} disabled={busy} onClick={() => switchPage(1, false)}>Açık talepler</button>
        <button type="button" className="uf-quick-pill" aria-pressed={closed} disabled={busy} onClick={() => switchPage(1, true)}>Kapalı talepler</button>
        <button type="button" className="uf-quick-pill" disabled={busy} onClick={() => {
          setEditing(null);
          setError('');
          setVersion((previous) => previous + 1);
        }}>Yenile</button>
      </div>
      {(error || loadError) && <p role="alert" className="form-action-error">{error || loadError}</p>}
      {!data && !loadError && <p role="status">Talepler yükleniyor…</p>}
      {data?.requests.length === 0 && <p>Bu sayfada talep yok.</p>}
      {data?.requests.map((row) => {
        const financial = ['cancel', 'refund', 'payment_mismatch', 'ticketing_issue'].includes(row.kind);
        return <article key={row.id} style={{ borderTop: '1px solid var(--aspan-text-muted)', paddingBlock: 10 }}>
          <strong>{row.pnr} · {kinds[row.kind]} · {statuses[row.status]}</strong>
          <p style={{ margin: '5px 0' }}>
            {scopes[row.scope]} · {row.passenger ? 'Yolcu ' + row.passenger : 'Tüm yolcular'}
            {row.requestedDate && ' · ' + row.requestedDate} · <code>{row.id}</code>
          </p>
          {row.reference && <div>İşlem referansı {row.reference}</div>}
          {row.feeKurus !== null && <div>Kesinti {money.format(row.feeKurus / 100)}</div>}
          {row.refundKurus !== null && <div>İade {money.format(row.refundKurus / 100)}</div>}
          {row.contactedAt && <div>Yolcu bilgilendirildi · {new Date(row.contactedAt).toLocaleString('tr-TR')}</div>}
          {!closed && (operator || (refunds && financial)) && editing?.id !== row.id && (
            <button type="button" className="uf-quick-pill" disabled={busy} onClick={() => { setEditing(row); setError(''); }}>Düzenle</button>
          )}
          {editing?.id === row.id && <form className="panel-form-grid" onSubmit={(event) => update(event, editing)}>
            <label>Durum
              <select className="modal-input" name="status" defaultValue="in_review">
                <option value="in_review">İnceleniyor</option>
                {row.status === 'in_review' && <option value="completed">Tamamlandı</option>}
                <option value="rejected">Reddedildi</option>
              </select>
            </label>
            <label>Kesinti (TL)
              <input className="modal-input" type="number" name="fee" min="0" max="1000000" step="0.01"
                defaultValue={row.feeKurus === null ? '' : row.feeKurus / 100} />
            </label>
            {financial && <label>İade (TL)
              <input className="modal-input" type="number" name="refund" min="0" max="1000000" step="0.01"
                defaultValue={row.refundKurus === null ? '' : row.refundKurus / 100} />
            </label>}
            <label>Sağlayıcı veya POS işlem referansı
              <input className="modal-input" maxLength={64} name="reference" defaultValue={row.reference} />
            </label>
            <label><input type="checkbox" name="contacted" defaultChecked={Boolean(row.contactedAt)} /> Yolcuya sonucu bildirdim</label>
            <button type="submit" className="adm-btn adm-btn-blue" disabled={busy}>Kaydet</button>
            <button type="button" className="uf-quick-pill" disabled={busy} onClick={() => setEditing(null)}>Vazgeç</button>
          </form>}
        </article>;
      })}
      {(page > 1 || data?.hasNext) && <div className="panel-actions">
        <button type="button" className="uf-quick-pill" disabled={busy || page < 2} onClick={() => switchPage(page - 1)}>Önceki</button>
        <button type="button" className="uf-quick-pill" disabled={busy || !data?.hasNext} onClick={() => switchPage(page + 1)}>Sonraki</button>
      </div>}
    </section>
  );
}
