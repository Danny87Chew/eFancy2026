import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { statusLabel, moduleLabel } from '../utils/status';
import { useDraft } from '../state/OrderDraftContext.jsx';
import { useCurrency } from '../state/CurrencyContext.jsx';
import { useTranslation } from 'react-i18next';

const USER_CANCELLABLE = new Set([
  'PendingForPayment', 'Pending', 'UserAccept', 'VendorAccept',
  'CheckupPaid', 'OrderPaid', 'Finalised', 'PendingForOrder', 'PendingForManufacture', 'ManufacturingAccept'
]);

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [confirmId, setConfirmId] = useState(null);
  const { setDraft } = useDraft();
  const { fmt } = useCurrency();
  const nav = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    api('/api/orders/mine').then(d => {
      setOrders(d.orders);
    }).catch(e => {
      // ignore fetch errors for UI; show empty list
      setOrders([]);
    });
  }, []);

  const handleOrderClick = async (e, o) => {
    if (o.module === 'checkup' && o.status === 'PendingForOrder') {
      e.preventDefault();
      try {
        const r = await api('/api/orders/eyesight/latest');
        if (r.record) {
          const { l_sph, l_cyl, l_axis, l_add, r_sph, r_cyl, r_axis, r_add, pd } = r.record;
          setDraft({ eyesight: { l_sph, l_cyl, l_axis, l_add, r_sph, r_cyl, r_axis, r_add, pd }, eyesightMode: 'have', checkupOrderId: o.id, frame: null });
        }
      } catch {}
      nav('/espectacles/frames');
    } else if (o.status === 'PendingForPayment') {
      e.preventDefault();
      nav(`/espectacles/pay/${o.id}`);
    }
  };

  const doCancel = async (id) => {
    setConfirmId(null);
    await api(`/api/orders/${id}/cancel`, { method: 'POST' });
    const d = await api('/api/orders/mine');
    setOrders(d.orders);
  };

  return (
    <div>
      <h1 className="h1">{t('My Orders')}</h1>
      {/* Debug JSON removed to avoid leaking raw data in the UI */}
      {orders.length === 0 && <div className="card muted">{t('No orders yet.')}</div>}
      {orders.map(o => (
        <div key={o.id} className="card" style={{ padding: 0 }}>
          <Link to={`/orders/${o.id}`} style={{ display: 'block', color: 'inherit', padding: '14px 14px 10px' }}
            onClick={e => handleOrderClick(e, o)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <strong>{o.order_code}</strong>
              <span className={`status-badge status-${o.status}`}>{statusLabel(o)}</span>
            </div>
            <div className="muted">{moduleLabel(o.module)} · {fmt(o.total)}</div>
            <div className="muted">{o.created_at}</div>
            {o.module === 'checkup' && o.status === 'PendingForOrder' && (
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
                👓 {t('Please choose your favorite frame')} →
              </div>
            )}
            {o.status === 'PendingForPayment' && (
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
                💳 {t('Confirm your order')} →
              </div>
            )}
          </Link>
          {USER_CANCELLABLE.has(o.status) && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px' }}>
              {confirmId === o.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                  <span style={{ flex: 1, color: 'var(--muted)' }}>{t('Cancel this order?')}</span>
                  <button onClick={() => doCancel(o.id)}
                    style={{ padding: '4px 14px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                    {t('Yes, Cancel')}
                  </button>
                  <button onClick={() => setConfirmId(null)}
                    style={{ padding: '4px 14px', background: 'var(--border)', color: 'var(--text)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                    {t('No')}
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmId(o.id)}
                  style={{ fontSize: 13, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                  {t('✕ Cancel Order')}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
