import React, { useRef, useState } from 'react';
import { Plus, Star, Trash2, Zap } from 'lucide-react';
import type { AdminCatalog } from '../data/api';
import { formatDisplayDate, formatPrice } from '../data/mockData';
import { addCalendarDays, toCalendarDate } from '../data/calendarDates';
import type { CurrencyCode, LangCode } from '../types';
import { resolveCityImage } from '../utils/cityImages';

type DealItem = AdminCatalog['deals'][number];
type TourItem = AdminCatalog['tours'][number];
type HotelItem = AdminCatalog['hotels'][number];
type TransferItem = AdminCatalog['transfers'][number];

interface AdminDealsSectionProps {
  lang: LangCode;
  currency: CurrencyCode;
  deals: DealItem[];
  catalogWritable: boolean;
  onSaveDeals: (items: DealItem[], message: string, afterSave?: () => void) => void;
}

export const AdminDealsSection: React.FC<AdminDealsSectionProps> = ({
  lang,
  currency,
  deals,
  catalogWritable,
  onSaveDeals,
}) => {
  const formRef = useRef<HTMLDivElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [fromCity, setFromCity] = useState('Antalya');
  const [fromCode, setFromCode] = useState('AYT');
  const [toCity, setToCity] = useState('Almatı');
  const [toCode, setToCode] = useState('ALA');
  const [region, setRegion] = useState<DealItem['region']>('ORTA ASYA');
  const [date, setDate] = useState(() => addCalendarDays(toCalendarDate(new Date()), 18));
  const [price, setPrice] = useState('6450');
  const [customImage, setCustomImage] = useState('');
  const [featured, setFeatured] = useState(false);

  const previewImg = resolveCityImage(toCode || toCity, customImage);
  const activeCount = deals.filter((d) => d.active).length;

  const resetForm = () => {
    setEditingId(null);
    setFromCity('Antalya');
    setFromCode('AYT');
    setToCity('Almatı');
    setToCode('ALA');
    setRegion('ORTA ASYA');
    setDate(addCalendarDays(toCalendarDate(new Date()), 18));
    setPrice('6450');
    setCustomImage('');
    setFeatured(false);
  };

  const startEdit = (d: DealItem) => {
    setEditingId(d.id);
    setFromCity(d.fromCity);
    setFromCode(d.fromCode);
    setToCity(d.toCity);
    setToCode(d.toCode);
    setRegion(d.region);
    setDate(d.date);
    setPrice(String(d.price));
    setCustomImage(d.image || '');
    setFeatured(d.featured);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromCity.trim() || !fromCode.trim() || !toCity.trim() || !toCode.trim()) return;
    const record: DealItem = {
      id: editingId || crypto.randomUUID(),
      fromCity: fromCity.trim(),
      fromCode: fromCode.trim().toUpperCase().slice(0, 4),
      toCity: toCity.trim(),
      toCode: toCode.trim().toUpperCase().slice(0, 4),
      region,
      date,
      price: Math.max(300, Math.round(Number(price) || 1500)),
      image: customImage.trim() || undefined,
      featured,
      active: true,
    };
    const baseList = featured ? deals.map((row) => ({ ...row, featured: false })) : deals;
    const nextItems = editingId
      ? baseList.map((row) => (row.id === editingId ? record : row))
      : [...baseList, record];
    onSaveDeals(
      nextItems,
      editingId
        ? `✓ ${record.fromCity} → ${record.toCity} fırsat uçuşu güncellendi.`
        : `✓ ${record.fromCity} → ${record.toCity} Fırsat Uçuşlar vitrinine eklendi.`,
      resetForm
    );
  };

  return (
    <div className="panel-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <strong style={{ fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Zap size={18} color="#d97706" /> Ana Sayfa Fırsat Uçuşlar &amp; Günün Fırsatı Yönetimi
          </strong>
          <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginTop: 3 }}>
            Ana sayfadaki <strong>&ldquo;Fırsat Uçuşlar&rdquo;</strong> bölümünde <strong>1 büyük Günün Fırsatı + 6 vitrin kartı (toplam 7 kart)</strong> gösterilir.
            Varış şehrini veya IATA kodunu (ör. <strong>Almatı / ALA</strong>, <strong>Dubai / DXB</strong>) yazdığınızda sistem o şehrin arka plan fotoğrafını <strong>otomatik</strong> yerleştirir; isterseniz özel görsel linki de girebilirsiniz.
          </div>
        </div>
        <span className="pkg-pill" style={{ background: 'rgba(16,185,129,0.14)', color: '#047857', fontWeight: 800 }}>
          Aktif Vitrin: {Math.min(7, activeCount)} / 7 Kart
        </span>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Önizleme &amp; Rota</th>
              <th>Bölge</th>
              <th>Uçuş Tarihi</th>
              <th>Fiyat</th>
              <th>Vitrin Tipi</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--aspan-text-muted)' }}>
                  Henüz fırsat uçuşu eklenmemiş. Aşağıdan ilk fırsat uçuşunu ekleyebilirsiniz.
                </td>
              </tr>
            ) : (
              deals.map((d) => {
                const thumb = resolveCityImage(d.toCode || d.toCity, d.image);
                const isConfirming = pendingDeleteId === d.id;
                return (
                  <tr key={d.id} className={!d.active ? 'is-inactive' : ''}>
                    <td data-label="Rota">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img
                          src={thumb}
                          alt={d.toCity}
                          style={{ width: 58, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--aspan-border)' }}
                        />
                        <div>
                          <strong>{d.fromCity} ({d.fromCode}) → {d.toCity} ({d.toCode})</strong>
                          <div style={{ fontSize: 11, color: 'var(--aspan-text-muted)' }}>
                            {d.image ? 'Özel görsel' : 'Otomatik şehir fotoğrafı'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Bölge"><span className="pkg-pill">{d.region}</span></td>
                    <td data-label="Tarih" style={{ fontSize: 12.5 }}>{formatDisplayDate(d.date, lang)}</td>
                    <td data-label="Fiyat">
                      <strong style={{ fontSize: 15, color: 'var(--aspan-teal-deep)' }}>
                        {formatPrice(d.price, currency)}
                      </strong>
                    </td>
                    <td data-label="Vitrin">
                      {d.featured ? (
                        <span className="pkg-pill" style={{ background: 'rgba(217,119,6,0.16)', color: '#b45309', fontWeight: 800 }}>
                          ⭐ Günün Fırsatı
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="adm-btn adm-btn-ghost"
                          disabled={!catalogWritable}
                          onClick={() =>
                            onSaveDeals(
                              deals.map((row) => ({ ...row, featured: row.id === d.id })),
                              `⭐ ${d.fromCity} → ${d.toCity} Günün Fırsatı olarak ayarlandı.`
                            )
                          }
                        >
                          <Star size={12} /> Günün Fırsatı Yap
                        </button>
                      )}
                    </td>
                    <td data-label="Durum">
                      <span className={`status-badge ${d.active ? 'ok' : 'warn'}`}>
                        {d.active ? '● Aktif' : '○ Pasif'}
                      </span>
                    </td>
                    <td data-label="İşlemler">
                      <div className="adm-actions">
                        <button
                          type="button"
                          className="adm-btn adm-btn-blue"
                          disabled={!catalogWritable}
                          onClick={() => startEdit(d)}
                        >
                          ✎ Düzenle
                        </button>
                        <button
                          type="button"
                          className={`adm-btn ${d.active ? 'adm-btn-amber' : 'adm-btn-green-soft'}`}
                          disabled={!catalogWritable}
                          onClick={() =>
                            onSaveDeals(
                              deals.map((row) => (row.id === d.id ? { ...row, active: !row.active } : row)),
                              `${d.fromCity} → ${d.toCity} ${d.active ? 'pasifleştirildi' : 'aktifleştirildi'}.`
                            )
                          }
                        >
                          {d.active ? 'Pasifleştir' : 'Aktifleştir'}
                        </button>
                        {isConfirming ? (
                          <span className="adm-confirm-inline">
                            Silinsin mi?
                            <button
                              type="button"
                              className="adm-btn adm-btn-red-solid"
                              style={{ height: 26, padding: '0 8px' }}
                              disabled={!catalogWritable}
                              onClick={() => {
                                setPendingDeleteId(null);
                                onSaveDeals(
                                  deals.filter((row) => row.id !== d.id),
                                  `✓ ${d.fromCity} → ${d.toCity} fırsat vitrininden silindi.`
                                );
                              }}
                            >
                              Evet, Sil
                            </button>
                            <button
                              type="button"
                              className="adm-btn adm-btn-ghost"
                              style={{ height: 26, padding: '0 8px' }}
                              onClick={() => setPendingDeleteId(null)}
                            >
                              Vazgeç
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="adm-btn adm-btn-red"
                            disabled={!catalogWritable}
                            onClick={() => setPendingDeleteId(d.id)}
                          >
                            <Trash2 size={13} /> Sil
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div ref={formRef} className="adm-form-box" style={{ marginTop: 14 }}>
        <div className="adm-form-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} color="#059669" />
            {editingId ? 'Fırsat Uçuşunu Düzenle' : 'Yeni Fırsat Uçuşu / Günün Fırsatı Ekle'}
          </span>
          {editingId && (
            <button type="button" className="adm-btn adm-btn-ghost" onClick={resetForm}>
              Düzenlemeyi İptal Et
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="panel-form-grid">
            <div>
              <label className="adm-field-lbl">Kalkış Şehri</label>
              <input className="modal-input" required value={fromCity} onChange={(e) => setFromCity(e.target.value)} placeholder="Örn: Antalya" />
            </div>
            <div>
              <label className="adm-field-lbl">Kalkış Kodu (IATA)</label>
              <input className="modal-input" required maxLength={4} value={fromCode} onChange={(e) => setFromCode(e.target.value.toUpperCase())} placeholder="AYT" />
            </div>
            <div>
              <label className="adm-field-lbl">Varış Şehri (Görsel Otomatik Seçilir)</label>
              <input className="modal-input" required value={toCity} onChange={(e) => setToCity(e.target.value)} placeholder="Örn: Almatı" />
            </div>
            <div>
              <label className="adm-field-lbl">Varış Kodu (IATA)</label>
              <input className="modal-input" required maxLength={4} value={toCode} onChange={(e) => setToCode(e.target.value.toUpperCase())} placeholder="ALA" />
            </div>
            <div>
              <label className="adm-field-lbl">Bölge Etiketi</label>
              <select className="modal-input" value={region} onChange={(e) => setRegion(e.target.value as DealItem['region'])}>
                <option value="YURT İÇİ">YURT İÇİ</option>
                <option value="ORTA ASYA">ORTA ASYA</option>
                <option value="AVRUPA">AVRUPA</option>
                <option value="ORTA DOĞU">ORTA DOĞU</option>
              </select>
            </div>
            <div>
              <label className="adm-field-lbl">Uçuş Tarihi</label>
              <input className="modal-input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="adm-field-lbl">Kişi Başı Fiyat (₺)</label>
              <input className="modal-input" type="number" min={300} required value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label className="adm-field-lbl">Özel Görsel URL (Boş bırakılırsa şehir fotoğrafı otomatik gelir)</label>
              <input className="modal-input" value={customImage} onChange={(e) => setCustomImage(e.target.value)} placeholder="Opsiyonel: https://..." />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <img
                src={previewImg}
                alt={toCity}
                style={{ width: 96, height: 56, borderRadius: 10, objectFit: 'cover', border: '1.5px solid var(--aspan-border)' }}
              />
              <div style={{ fontSize: 12, color: 'var(--aspan-text-muted)' }}>
                <strong style={{ color: 'var(--aspan-text)', display: 'block' }}>
                  Canlı Kart Arka Plan Önizlemesi ({toCity || toCode})
                </strong>
                {customImage.trim() ? 'Özel görsel linki kullanılıyor' : 'Rotaya göre şehir fotoğrafı otomatik eşleşti'}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', color: '#b45309' }}>
                <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                ⭐ Günün Fırsatı (Sol Büyük Kart) Yap
              </label>
            </div>

            <button type="submit" className="adm-btn adm-btn-green" style={{ height: 42, padding: '0 20px', fontSize: 13 }} disabled={!catalogWritable}>
              <Plus size={15} /> {editingId ? 'Fırsat Uçuşunu Güncelle' : 'Fırsat Uçuşu Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AdminToursCardProps {
  currency: CurrencyCode;
  tours: TourItem[];
  catalogWritable: boolean;
  onSaveTours: (items: TourItem[], message: string, afterSave?: () => void) => void;
}

export const AdminToursCard: React.FC<AdminToursCardProps> = ({
  currency,
  tours,
  catalogWritable,
  onSaveTours,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('4 Gece · 5 Gün');
  const [includes, setIncludes] = useState('Uçak Dahil · 5★ Otel · Rehber · VIP Transfer');
  const [quota, setQuota] = useState('12');
  const [price, setPrice] = useState('18900');
  const [customImage, setCustomImage] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setCity('');
    setTitle('');
    setDuration('4 Gece · 5 Gün');
    setIncludes('Uçak Dahil · 5★ Otel · Rehber · VIP Transfer');
    setQuota('12');
    setPrice('18900');
    setCustomImage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !title.trim()) return;
    const item: TourItem = {
      id: editingId || crypto.randomUUID(),
      city: city.trim().toUpperCase(),
      title: title.trim(),
      duration: duration.trim() || '3 Gece · 4 Gün',
      includes: includes.trim() || undefined,
      quota: Math.max(1, Math.round(Number(quota) || 10)),
      price: Math.max(500, Math.round(Number(price) || 15000)),
      image: customImage.trim() || undefined,
      active: true,
    };
    const next = editingId ? tours.map((t) => (t.id === editingId ? item : t)) : [...tours, item];
    onSaveTours(
      next,
      editingId ? `✓ ${item.title} tur paketi güncellendi.` : `✓ ${item.title} canlı Turlar sayfasına eklendi.`,
      resetForm
    );
  };

  return (
    <div className="panel-card">
      <strong style={{ fontSize: 18, display: 'block', marginBottom: 6 }}>
        Paket Turlar &amp; Kültür Turları (Canlı Vitrin Yönetimi)
      </strong>
      <div style={{ fontSize: 12.5, color: 'var(--aspan-text-muted)', marginBottom: 12 }}>
        Eklediğiniz, düzenlediğiniz veya pasifleştirdiğiniz turlar anında <strong>/turlar</strong> sayfasında güncellenir. Şehir adına göre fotoğraf otomatik atanır.
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Önizleme &amp; Şehir</th>
              <th>Tur Başlığı &amp; İçerik</th>
              <th>Süre / Kontenjan</th>
              <th>Fiyat</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {tours.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--aspan-text-muted)' }}>
                  Kayıtlı tur paketi bulunmuyor. Aşağıdan yeni tur ekleyebilirsiniz.
                </td>
              </tr>
            ) : (
              tours.map((t) => {
                const isConfirming = pendingDeleteId === t.id;
                return (
                  <tr key={t.id} className={!t.active ? 'is-inactive' : ''}>
                    <td data-label="Şehir">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img
                          src={resolveCityImage(t.city, t.image)}
                          alt={t.city}
                          style={{ width: 52, height: 36, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
                        />
                        <span className="pkg-pill">{t.city}</span>
                      </div>
                    </td>
                    <td data-label="Tur">
                      <strong>{t.title}</strong>
                      {t.includes && <div style={{ fontSize: 11.5, color: 'var(--aspan-text-muted)' }}>{t.includes}</div>}
                    </td>
                    <td data-label="Süre / Kontenjan" style={{ fontSize: 12.5 }}>{t.duration} · {t.quota} kişi</td>
                    <td data-label="Fiyat">
                      <strong style={{ fontSize: 15, color: 'var(--aspan-teal-deep)' }}>{formatPrice(t.price, currency)}</strong>
                    </td>
                    <td data-label="Durum">
                      <span className={`status-badge ${t.active ? 'ok' : 'warn'}`}>{t.active ? '● Aktif' : '○ Pasif'}</span>
                    </td>
                    <td data-label="İşlemler">
                      <div className="adm-actions">
                        <button
                          type="button"
                          className="adm-btn adm-btn-blue"
                          disabled={!catalogWritable}
                          onClick={() => {
                            setEditingId(t.id);
                            setCity(t.city);
                            setTitle(t.title);
                            setDuration(t.duration);
                            setIncludes(t.includes || '');
                            setQuota(String(t.quota));
                            setPrice(String(t.price));
                            setCustomImage(t.image || '');
                          }}
                        >
                          ✎ Düzenle
                        </button>
                        <button
                          type="button"
                          className={`adm-btn ${t.active ? 'adm-btn-amber' : 'adm-btn-green-soft'}`}
                          disabled={!catalogWritable}
                          onClick={() =>
                            onSaveTours(
                              tours.map((row) => (row.id === t.id ? { ...row, active: !row.active } : row)),
                              `${t.title} ${t.active ? 'pasifleştirildi' : 'aktifleştirildi'}.`
                            )
                          }
                        >
                          {t.active ? 'Pasifleştir' : 'Aktifleştir'}
                        </button>
                        {isConfirming ? (
                          <span className="adm-confirm-inline">
                            Silinsin mi?
                            <button
                              type="button"
                              className="adm-btn adm-btn-red-solid"
                              style={{ height: 26, padding: '0 8px' }}
                              disabled={!catalogWritable}
                              onClick={() => {
                                setPendingDeleteId(null);
                                onSaveTours(tours.filter((row) => row.id !== t.id), `✓ ${t.title} silindi.`);
                              }}
                            >
                              Evet, Sil
                            </button>
                            <button type="button" className="adm-btn adm-btn-ghost" style={{ height: 26, padding: '0 8px' }} onClick={() => setPendingDeleteId(null)}>
                              Vazgeç
                            </button>
                          </span>
                        ) : (
                          <button type="button" className="adm-btn adm-btn-red" disabled={!catalogWritable} onClick={() => setPendingDeleteId(t.id)}>
                            <Trash2 size={13} /> Sil
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="adm-form-box" style={{ marginTop: 12 }}>
        <div className="adm-form-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} color="#059669" /> {editingId ? 'Tur Paketini Düzenle' : 'Yeni Tur Paketi Ekle'}
          </span>
          {editingId && (
            <button type="button" className="adm-btn adm-btn-ghost" onClick={resetForm}>
              Vazgeç
            </button>
          )}
        </div>
        <form className="panel-form-grid" onSubmit={handleSubmit}>
          <div>
            <label className="adm-field-lbl">Şehir / Bölge (Görsel Otomatik)</label>
            <input className="modal-input" required placeholder="Örn: ALMATI veya KAPADOKYA" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="adm-field-lbl">Tur Adı</label>
            <input className="modal-input" required placeholder="Örn: Almatı & Shymbulak 4 Gece Turu" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="adm-field-lbl">Süre</label>
            <input className="modal-input" required placeholder="4 Gece · 5 Gün" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <label className="adm-field-lbl">Fiyat (₺)</label>
            <input className="modal-input" type="number" min={500} required value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="adm-field-lbl">Kontenjan</label>
            <input className="modal-input" type="number" min={1} required value={quota} onChange={(e) => setQuota(e.target.value)} />
          </div>
          <div>
            <label className="adm-field-lbl">Paket İçeriği</label>
            <input className="modal-input" placeholder="Uçak + 5★ Otel + Transfer" value={includes} onChange={(e) => setIncludes(e.target.value)} />
          </div>
          <div>
            <label className="adm-field-lbl">Özel Görsel URL (Opsiyonel)</label>
            <input className="modal-input" placeholder="Boş bırakılırsa şehir görseli gelir" value={customImage} onChange={(e) => setCustomImage(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="adm-btn adm-btn-green" style={{ height: 42, width: '100%', fontSize: 13 }} disabled={!catalogWritable}>
              <Plus size={15} /> {editingId ? 'Turu Güncelle' : 'Tur Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export type { DealItem, TourItem, HotelItem, TransferItem };
