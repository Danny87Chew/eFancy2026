import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useDraft } from '../../state/OrderDraftContext.jsx';
import { useCurrency } from '../../state/CurrencyContext.jsx';
import DeliveryAddressSelector from '../../components/DeliveryAddressSelector.jsx';
import DeliveryAddressForm from '../../components/DeliveryAddressForm.jsx';
import { useTranslation } from 'react-i18next';

export default function Confirmation() {
  const { draft, setDraft } = useDraft();
  const { fmt } = useCurrency();
  const nav = useNavigate();
  const [brand, setBrand] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deliveryAddresses, setDeliveryAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState(draft.delivery_address_id || null);
  const [addressErr, setAddressErr] = useState('');
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const zhTwoCharSpacing = (text) => (
    lang.startsWith('zh') && typeof text === 'string' && /^[\u4e00-\u9fff]{2}$/.test(text)
      ? { letterSpacing: '0.12em' }
      : {}
  );

  useEffect(() => {
    if (draft.lens && draft.lens.brand_id) {
      api('/api/lens-brands').then(d => setBrand(d.brands.find(b => b.id === draft.lens.brand_id) || null));
    }
    // Load delivery addresses
    fetchDeliveryAddresses();
  }, [draft.lens]);

  const fetchDeliveryAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const result = await api('/api/auth/delivery-addresses');
      setDeliveryAddresses(result.addresses || []);
      // Prefer a previously selected order address for modifications.
      const selectedFromDraft = draft.delivery_address_id ? (result.addresses || []).find(a => a.id === draft.delivery_address_id) : null;
      if (selectedFromDraft) {
        setSelectedAddressId(selectedFromDraft.id);
      } else {
        const defaultAddr = (result.addresses || []).find(a => a.is_default === 1);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        } else if (result.addresses && result.addresses.length > 0) {
          setSelectedAddressId(result.addresses[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load delivery addresses:', e);
      setAddressErr('Failed to load addresses');
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleAddressAdded = async (addressData) => {
    try {
      const result = await api('/api/auth/delivery-addresses', {
        method: 'POST',
        body: addressData,
      });
      setDeliveryAddresses([...deliveryAddresses, result.address]);
      setSelectedAddressId(result.address.id);
      setAddressErr('');
    } catch (e) {
      setAddressErr(e?.data?.error || 'Failed to save address');
    }
  };

  const handleAddressUpdated = (updatedAddress) => {
    // Update the address in the list
    setDeliveryAddresses(deliveryAddresses.map(a => a.id === updatedAddress.id ? updatedAddress : a));
    // Keep the address selected
    setSelectedAddressId(updatedAddress.id);
  };

  if (!draft.frame || !draft.eyesight || !draft.lens) {
    return <div>{t('Incomplete order.')} <button className="btn" onClick={() => nav('/espectacles/frames')}>{t('Restart')}</button></div>;
  }

  const { frame, eyesight, lens, total, modifyOrderId, originalTotal, baseTotal, promoTotal, frame_base_price, frame_promo_price } = draft;
  const isModify = !!modifyOrderId;
  const diff = isModify ? Math.round(((total || 0) - (originalTotal || 0)) * 100) / 100 : 0;

  const makePayment = async () => {
    if (!isModify && !selectedAddressId) {
      setAddressErr(t('Please select a delivery address'));
      return;
    }
    setBusy(true);
    try {
      if (isModify) {
        const body = { frame_id: frame.id, eyesight, lens, total, base_total: baseTotal, promo_total: promoTotal, frame_base_price: frame_base_price, frame_promo_price: frame_promo_price, delivery_address_id: selectedAddressId };
        const r = await api(`/api/orders/${modifyOrderId}/spectacles`, { method: 'PATCH', body });
        setDraft({ modifyOrderId: null, originalTotal: null });
        if (r.supplement_order_id) {
          // Extra payment needed
          nav(`/espectacles/pay/${r.supplement_order_id}`);
        } else {
          // Refund issued or no change
          nav('/orders');
        }
      } else {
        const body = { frame_id: frame.id, eyesight, lens, total, base_total: baseTotal, promo_total: promoTotal, frame_base_price: frame_base_price, frame_promo_price: frame_promo_price, delivery_address_id: selectedAddressId };
        if (draft.checkupOrderId) body.checkup_order_id = draft.checkupOrderId;
        const r = await api('/api/orders/spectacles', { method: 'POST', body });
        nav(`/espectacles/pay/${r.order.id}`);
      }
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="h1">{isModify ? t('Confirm modification') : t('Confirm your order')}</h1>
        <button className="btn secondary" style={{ width: 'auto', padding: '16px 24px' }} onClick={() => nav('/espectacles/ordering')}>{t('Modify') || 'Modify'}</button>
      </div>

      <div className="card">
        <strong>{t('Frame')}</strong>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
          {frame.images && frame.images[0] && <img src={frame.images[0].url} alt="" style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8 }} />}
          <div>
            <div style={{ marginBottom: 6, lineHeight: 1.6 }}>
              {frame.brand ? <div>{t('Frame Brand')}: {frame.brand}</div> : null}
              <div>{t('Frame Name')}: {(lang && lang.startsWith('zh')) ? (frame.name_zh || frame.name) : frame.name}</div>
              {frame.code ? <div>{t('Frame Code')}: {frame.code}</div> : null}
            </div>
            <div className="muted">
              {(frame.promotion_price && Number(frame.promotion_price) > 0 && Number(frame.promotion_price) < Number(frame.base_price)) ? (
                <div>
                  <span style={{ textDecoration: 'line-through', marginRight: 8 }}>{fmt(frame.base_price)}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(frame.promotion_price)}</span>
                </div>
              ) : (
                <div>{fmt(frame.base_price)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <strong>{t('Eyesight')}</strong>
        <table style={{ width: '100%', marginTop: 8, fontSize: 14, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '19.5%' }} />
            <col style={{ width: '19.5%' }} />
            <col style={{ width: '19.5%' }} />
            <col style={{ width: '19.5%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}></th>
              <th style={{ textAlign: 'center', fontSize: 15, ...zhTwoCharSpacing(t('Sphere')) }}>{t('Sphere')}</th>
              <th style={{ textAlign: 'center', fontSize: 15, ...zhTwoCharSpacing(t('Cylinder')) }}>{t('Cylinder')}</th>
              <th style={{ textAlign: 'center', fontSize: 15, ...zhTwoCharSpacing(t('Axis')) }}>{t('Axis')}</th>
              <th style={{ textAlign: 'center', fontSize: 15, ...zhTwoCharSpacing(t('Addition')) }}>{t('Addition')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ textAlign: 'left', fontSize: 15, fontWeight: 700, ...zhTwoCharSpacing(t('Left')) }}>{t('Left')}</td>
              <td style={{ textAlign: 'center', fontSize: 15 }}>{eyesight.l_sph}</td>
              <td style={{ textAlign: 'center', fontSize: 15 }}>{eyesight.l_cyl}</td>
              <td style={{ textAlign: 'center', fontSize: 15 }}>{eyesight.l_axis}</td>
              <td style={{ textAlign: 'center', fontSize: 15 }}>{eyesight.l_add ?? '—'}</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'left', fontSize: 15, fontWeight: 700, ...zhTwoCharSpacing(t('Right')) }}>{t('Right')}</td>
              <td style={{ textAlign: 'center', fontSize: 15 }}>{eyesight.r_sph}</td>
              <td style={{ textAlign: 'center', fontSize: 15 }}>{eyesight.r_cyl}</td>
              <td style={{ textAlign: 'center', fontSize: 15 }}>{eyesight.r_axis}</td>
              <td style={{ textAlign: 'center', fontSize: 15 }}>{eyesight.r_add ?? '—'}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 6, color: '#000', fontSize: 15, fontWeight: 700, ...zhTwoCharSpacing(t('Pupil Distance')) }}>
          {t('Pupil Distance')}: {eyesight.pd}
        </div>
      </div>

      <div className="card">
        <strong>{t('Lens')}</strong>
        <ul style={{ paddingLeft: 18, marginTop: 6 }}>
          {brand?.brand ? <li>{t('Len Brand')}: {brand.brand}</li> : null}
          {brand?.name && brand.name !== brand.brand ? <li>{t('Len Name')}: {brand.name}</li> : null}
          {brand?.code ? <li>{t('Len Code')}: {brand.code}</li> : null}
          {!brand?.brand && brand ? <li>{t('Len Brand')}: {brand ? ((lang && lang.startsWith('zh')) ? (brand.name_zh || brand.name) : brand.name) : t('Default')}</li> : null}
          <li>{t('Thickness')}: {lens.thickness}</li>
          <li>{t('Blue-light')}: {lens.blueLight ? t('Yes') : t('No')}</li>
          <li>{t('Photochromic')}: {lens.photochromic ? t('Yes') : t('No')}</li>
          <li>{t('Progressive')}: {lens.progressive ? t('Yes') : t('No')}</li>
        </ul>
      </div>

      {!isModify && (
        <div>
          <h3 style={{ margin: '16px 0 8px' }}>{t('Delivery Address')}</h3>
          {addressErr && <div className="error" style={{ marginBottom: 12 }}>{addressErr}</div>}
          
          {loadingAddresses ? (
            <div className="card muted">{t('Loading addresses...')}</div>
          ) : (
            <DeliveryAddressSelector
              addresses={deliveryAddresses}
              selectedId={selectedAddressId}
              onSelect={setSelectedAddressId}
              onAddressAdded={handleAddressAdded}
              onAddressUpdated={handleAddressUpdated}
            />
          )}
        </div>
      )}

      <div className="card">
        {isModify && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
              <span>{t('Original Total (Paid):')}</span>
              <span>{fmt(originalTotal || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginTop: 4,
              color: diff > 0 ? 'var(--danger)' : diff < 0 ? '#059669' : 'var(--muted)' }}>
              <span>{diff > 0 ? t('Extra charge') : diff < 0 ? t('Refund credit') : t('No change')}</span>
              <span>{diff !== 0 ? `${diff > 0 ? '+' : ''}${fmt(Math.abs(diff))}` : '—'}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{t('New Total')}</strong>
          <div style={{ textAlign: 'right' }}>
            {(baseTotal != null && promoTotal != null && baseTotal !== promoTotal) ? (
              <div>
                <div style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>{fmt(baseTotal)}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(promoTotal)}</div>
              </div>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(total || 0)}</div>
            )}
          </div>
        </div>
      </div>

      {isModify && diff < 0 && (
        <div className="card" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontSize: 14 }}>
          {t('A refund of {{amount}} will be processed to your original payment method within 4 weeks.', { amount: fmt(Math.abs(diff)) })}
        </div>
      )}
      {isModify && diff > 0 && (
        <div className="card" style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: 14 }}>
          {t('An extra payment of {{amount}} is required. You\'ll be taken to the payment page after confirming.', { amount: fmt(diff) })}
        </div>
      )}

      <button className="btn" style={{ padding: '16px 32px' }} disabled={busy} onClick={makePayment}>
        {isModify ? (diff > 0 ? t('Confirm & Pay {{amount}}', { amount: fmt(diff) }) : diff < 0 ? t('Confirm & Get Refund') : t('Confirm (no change)')) : t('Make Payment')}
      </button>
    </div>
  );
}
