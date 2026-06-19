import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useDraft } from '../../state/OrderDraftContext.jsx';
import { useCurrency } from '../../state/CurrencyContext.jsx';
import { useTranslation } from 'react-i18next';
import NumInput from '../../components/NumInput.jsx';

export default function EyesightChoice() {
  const { draft, setDraft } = useDraft();
  const { fmt } = useCurrency();
  const { t } = useTranslation();
  const nav = useNavigate();
  const [mode, setMode] = useState(''); // '' | none | have — unselected on entry
  const [confirmed, setConfirmed] = useState(false);
  const [data, setData] = useState(draft.eyesight || {
    l_sph: '', l_cyl: '', l_axis: '', l_add: '',
    r_sph: '', r_cyl: '', r_axis: '', r_add: '',
    pd: '',
  });

  // Shop search (No-data path)
  const [q, setQ] = useState('');
  const [shops, setShops] = useState([]);
  const [shop, setShopState] = useState(draft.checkupShop || null);
  const setShop = (s) => { setShopState(s); setDraft({ checkupShop: s }); };
  const [fee, setFee] = useState(20);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/config/public').then(d => setFee(d.checkup_fee));
  }, []);
  useEffect(() => {
    if (mode === 'none') {
      const t = setTimeout(() => api(`/api/shops?q=${encodeURIComponent(q)}`).then(d => setShops(d.shops)), 200);
      return () => clearTimeout(t);
    }
  }, [q, mode]);

  if (!draft.frame) {
    return <div>{t('Please choose a frame first')} <button className="btn" onClick={() => nav('/espectacles/frames')}>{t('Back to frames')}</button></div>;
  }

  const updateField = (k, v) => { setData(d => ({ ...d, [k]: v })); setConfirmed(false); };

  const confirmHave = () => {
    const required = ['l_sph','l_cyl','l_axis','r_sph','r_cyl','r_axis','pd'];
    for (const k of required) {
      const n = Number(data[k]);
      if (data[k] === '' || data[k] === null || !Number.isFinite(n)) {
        alert(t('Please fill all eyesight values with a valid number')); return;
      }
    }
    setConfirmed(true);
  };

  const onNextHave = () => {
    const parsed = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : Number(v)]));
    setDraft({ eyesight: parsed, eyesightMode: 'have' });
    nav('/espectacles/ordering');
  };

  const payCheckup = async () => {
    if (!shop) return;
    setBusy(true);
    try {
      const o = await api('/api/orders/checkup', { method: 'POST', body: { shop_id: shop.id } });
      nav(`/espectacles/pay/${o.order.id}`);
    } catch (e) {
      alert(t('Failed') + ': ' + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h1 className="h1">{t('Eyesight data')}</h1>
      </div>

      <div className="card">
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="radio" style={{ width: 'auto' }} checked={mode === 'none'} onChange={() => setMode('none')} />
          {t('No Eyesight Data')}
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
          <input
            type="radio"
            style={{ width: 'auto' }}
            checked={mode === 'have'}
            onChange={() => { setMode('have'); nav('/espectacles/manual-eyesight'); }}
          />
          {t('Having Eyesight Data')}
        </label>
      </div>

      {mode === 'none' && (
        <div className="card">
          <p>{t('We recommend an Eyesight Checkup at a partner shop. Eyesight Checkup fee:')} <strong>{fmt(fee)}</strong>.</p>
          <label className="field">
            {t('Search by postcode, road, town, district or MRT')}
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('e.g. Bishan or 570123')} />
          </label>
          <div>
            {shops.map(s => (
              <label key={s.id} className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', background: shop && shop.id === s.id ? '#eef6ff' : '#fff' }}>
                <input type="radio" style={{ width: 'auto', marginTop: 4 }} checked={shop && shop.id === s.id} onChange={() => setShop(s)} />
                <div>
                  <strong>{s.name}</strong>
                  <div className="muted">{s.address}</div>
                  <div className="muted">Open: {s.opening_time} · {s.contact}</div>
                </div>
              </label>
            ))}
          </div>
          <button className="btn" disabled={!shop || busy} onClick={payCheckup}>
            {t('Pay and create Eyesight Checkup order', { fee: fmt(fee) })}
          </button>
        </div>
      )}
    </div>
  );
}
