import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useTranslation } from 'react-i18next';

export default function ChangeShopModal({ orderId, currentShopId, onClose, onChanged }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [shops, setShops] = useState([]);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/api/shops?q=${encodeURIComponent(q)}`).then(d => {
        setShops(d.shops);
        // Pre-select the current shop so the user can see what's currently chosen.
        setPicked(prev => {
          if (prev) return prev;
          return d.shops.find(s => s.id === currentShopId) || null;
        });
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q, currentShopId]);

  const save = async () => {
    if (!picked) return;
    setBusy(true); setErr('');
    try {
      const r = await api(`/api/orders/${orderId}/checkup/shop`, {
        method: 'PATCH',
        body: { shop_id: picked.id },
      });
      onChanged && onChanged(r.order);
      onClose();
    } catch (e) {
      setErr('Could not change shop: ' + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '100%' }}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <div style={{ padding: 18, maxHeight: '80vh', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 10px' }}>{t('Change Shop')}</h3>
          <label className="field">
            {t('Search by postcode, road, town, district or MRT')}
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('e.g. Bishan or 570123')} />
          </label>
          <div>
            {shops.map(s => (
              <label
                key={s.id}
                className="card"
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
                  background: picked && picked.id === s.id ? '#eef6ff' : '#fff',
                }}
              >
                <input
                  type="radio"
                  style={{ width: 'auto', marginTop: 4 }}
                  checked={picked ? picked.id === s.id : false}
                  onChange={() => setPicked(s)}
                />
                <div>
                  <strong>{s.name}{s.id === currentShopId ? ` (${t('current')})` : ''}</strong>
                  <div className="muted">{s.address}</div>
                  <div className="muted">{t('Open')}: {s.opening_time} · {s.contact}</div>
                </div>
              </label>
            ))}
          </div>
          {err && <div className="error" style={{ marginBottom: 8 }}>{err}</div>}
          <div className="btn-row">
            <button className="btn secondary" onClick={onClose}>{t('Form.Cancel')}</button>
            <button className="btn" disabled={!picked || picked.id === currentShopId || busy} onClick={save}>
              {busy ? t('Saving…') : t('Change Shop')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
