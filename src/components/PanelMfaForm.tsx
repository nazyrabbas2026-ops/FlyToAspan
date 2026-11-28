import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, apiMessage } from '../data/api';
import type { UserProfile } from '../types';

export function PanelMfaForm({ active, onComplete }: { active: boolean; onComplete: (user: UserProfile) => void }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (secret) {
        const result = await api.enable2fa(code);
        setSecret('');
        setNotice('İki aşamalı doğrulama güncellendi. Diğer oturumlar kapatıldı.');
        onComplete(result.user);
      } else {
        const next = await api.setup2fa(password, code);
        setSecret(next.secret);
        setPassword('');
      }
      setCode('');
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
      {secret ? (
        <p style={{ margin: 0 }}>Doğrulama uygulamanıza yeni anahtarı ekleyin. <code>{secret}</code></p>
      ) : (
        <label>Mevcut parola
          <input className="modal-input" type="password" required autoComplete="current-password"
            value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
      )}
      {(active || secret) && <label>{secret ? 'Yeni doğrulama kodu' : 'Mevcut doğrulama kodu'}
        <input className="modal-input" required pattern="[0-9]{6}" maxLength={6} inputMode="numeric"
          autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
      </label>}
      <div className="panel-actions">
        <button type="submit" className="btn-gold-nav" disabled={busy}>
          {secret ? 'Yeni kodu doğrula' : active ? 'Doğrulama anahtarını değiştir' : 'Doğrulamayı kur'}
        </button>
        {secret && <button type="button" className="uf-quick-pill" disabled={busy}
          onClick={() => { setSecret(''); setCode(''); setError(''); }}>Vazgeç</button>}
      </div>
      {error && <p role="alert" className="form-action-error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
