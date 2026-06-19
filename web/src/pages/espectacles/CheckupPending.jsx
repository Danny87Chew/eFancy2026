import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useDraft } from '../../state/OrderDraftContext.jsx';
import QRImage from '../../components/QRImage.jsx';
import ChangeShopModal from '../../components/ChangeShopModal.jsx';
import { statusLabel } from '../../utils/status';
import { useTranslation } from 'react-i18next';

export default function CheckupPending() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [record, setRecord] = useState(null);
  const [changingShop, setChangingShop] = useState(false);
  const nav = useNavigate();
  const { setDraft } = useDraft();

  const refresh = async () => {
    const d = await api(`/api/orders/${id}`);
    setOrder(d.order);
    const r = await api('/api/orders/eyesight/latest');
    setRecord(r.record);
  };

  useEffect(() => { refresh(); }, [id]);

  if (!order) return <div>Loading…</div>;

  const continueToOrdering = () => {
    if (!record) return;
    setDraft({
      eyesight: {
        l_sph: record.l_sph, l_cyl: record.l_cyl, l_axis: record.l_axis, l_add: record.l_add,
        r_sph: record.r_sph, r_cyl: record.r_cyl, r_axis: record.r_axis, r_add: record.r_add,
        pd: record.pd,
      },
      eyesightMode: 'have',
    });
    nav('/espectacles/ordering');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <button
          className="btn secondary"
          style={{ width: 'auto', padding: '8px 14px', fontSize: '1.5em' }}
          onClick={() => nav('/espectacles/eyesight')}
        >
          ← {t('Back')}
        </button>
        <h1 className="h1" style={{ margin: 0 }}>{t('Eyesight Checkup pending')}</h1>
        <div style={{ width: 70 }} />
      </div>
      <div className="card">
        <div>{t('Order')} <strong>{order.order_code}</strong></div>
        <div>{t('Shop')}: {order.meta && order.meta.shop_name}</div>
        <div>{t('Status')}: <span className={`status-badge status-${order.status}`}>{statusLabel(order)}</span></div>
        {(order.status === 'PendingForPayment' || order.status === 'CheckupPaid') && (
          <button
            className="btn secondary"
            style={{ width: 'auto', padding: '6px 12px', marginTop: 10 }}
            onClick={() => setChangingShop(true)}
          >
            {t('Change Shop')}
          </button>
        )}
      </div>
      <div className="card">
        <strong>{t('Show this QR at the shop')}</strong>
        <div style={{ marginTop: 10, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
          <QRImage value={order.qr_token} size={168} />
        </div>
        <div style={{ marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'center', fontSize: '1.5em', fontWeight: 700 }}>
          {order.qr_token}
        </div>
        <p className="muted">{t('Shop staff will scan and upload your eyesight data.')}</p>
      </div>
      <button className="btn secondary" onClick={refresh}>{t('Refresh')}</button>
      <div className="spacer" />
      <button className="btn" disabled={!record || record.source !== 'shop'} onClick={continueToOrdering}>
        {t('Continue to Ordering')}
      </button>
      {!record && <div className="muted" style={{ marginTop: 8 }}>{t('Waiting for shop to upload eyesight data…')}</div>}

      {changingShop && (
        <ChangeShopModal
          orderId={order.id}
          currentShopId={order.shop_id}
          onClose={() => setChangingShop(false)}
          onChanged={(o) => setOrder(o)}
        />
      )}
    </div>
  );
}
