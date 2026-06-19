import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import QRImage from '../components/QRImage.jsx';
import ChangeShopModal from '../components/ChangeShopModal.jsx';
import { statusLabel, moduleLabel } from '../utils/status';
import { useDraft } from '../state/OrderDraftContext.jsx';
import { useCurrency } from '../state/CurrencyContext.jsx';
import { useTranslation } from 'react-i18next';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [changingShop, setChangingShop] = useState(false);
  const [error, setError] = useState(null);
  const nav = useNavigate();
  const { setDraft } = useDraft();
  const { fmt } = useCurrency();
  const { t } = useTranslation();
  const lang = (typeof window !== 'undefined' && window.localStorage && (localStorage.getItem('lang') || (navigator && navigator.language))) || 'en';

  const localizeMeta = (meta, key) => {
    if (!meta) return null;
    if (!key) return null;
    const suff = lang && lang.startsWith('zh') ? '_zh' : `_${lang}`;
    return meta[key + suff] || meta[key] || null;
  };

  const refresh = async () => {
    setError(null);
    try {
      const d = await api(`/api/orders/${id}`);
      setOrder(d.order);
    } catch (e) {
      if (e.status === 404) setError(t('Order not found'));
      else if (e.status === 403) setError(t('You are not allowed to view this order'));
      else setError(e.message || 'request_failed');
      setOrder(null);
    }
  };

  useEffect(() => { refresh(); }, [id]);

  const [fetchedPricing, setFetchedPricing] = useState(null);
  React.useEffect(() => {
    if (order?.meta?.pricing) return;
    if (!order?.items) return;
    const frameItem = order.items.find(i => i.kind === 'frame');
    const lensItem = order.items.find(i => i.kind === 'lens');
    const frameId = order.meta?.frame_id || (frameItem && frameItem.ref_id);
    if (!frameId) return;
    (async () => {
      try {
        const f = await api(`/api/frames/${frameId}`);
        const frameBase = Number(f.frame.base_price || 0);
        const framePromo = Number(f.frame.promotion_price || frameBase);
        const lensUnit = lensItem ? Number(lensItem.unit_price || 0) : 0;
        setFetchedPricing({ frame_base_price: frameBase, frame_promo_price: framePromo, base_total: frameBase + lensUnit, promo_total: framePromo + lensUnit });
      } catch (e) {
        // ignore
      }
    })();
  }, [order]);

  if (error) return <div className="card muted" style={{ padding: 16, fontSize: 16 }}>{error}</div>;
  if (!order) return <div className="card" style={{ padding: 24, fontSize: 18, textAlign: 'center' }}>{t('Loading')}…</div>;

  const cancel = async () => {
    if (!confirm(t('Cancel this order? Refund will be processed within 4 weeks.'))) return;
    setBusy(true);
    try {
      await api(`/api/orders/${id}/cancel`, { method: 'POST' });
      refresh();
    } catch (e) { alert('Cannot cancel: ' + e.message); }
    finally { setBusy(false); }
  };

  const modify = async () => {
    try {
      const frames = await api('/api/frames');
      const frame = frames.frames.find(f => f.id === order.meta?.frame_id) || null;
      // Reset then set as one atomic update to avoid stale draft fields
      setDraft(() => ({
        frame,
        eyesight: order.meta?.eyesight || null,
        lens: order.meta?.lens || null,
        eyesightMode: 'have',
        modifyOrderId: order.id,
        originalTotal: Number(order.total),
      }));
    } catch {}
    nav('/espectacles/ordering');
  };

  return (
    <div>
      <h1 className="h1">{t('Order')} {order.order_code}</h1>
      <div className="card">
        <div>{t('Status')}: <span className={`status-badge status-${order.status}`}>{statusLabel(order)}</span></div>
        <div>{t('Module')}: {moduleLabel(order.module)}</div>
        {(() => {
          let pricing = order.meta?.pricing || null;
          if (!pricing && order.items) {
            const frameItem = order.items.find(i => i.kind === 'frame');
            const lensItem = order.items.find(i => i.kind === 'lens');
            if (frameItem) {
              let frameMeta = null;
              try { frameMeta = frameItem.meta_json ? JSON.parse(frameItem.meta_json) : null; } catch (e) { frameMeta = null; }
              const frameBase = frameMeta && frameMeta.frame_base_price != null ? Number(frameMeta.frame_base_price) : Number(frameItem.unit_price || 0);
              const framePromo = frameMeta && frameMeta.frame_promo_price != null ? Number(frameMeta.frame_promo_price) : frameBase;
              const lensUnit = lensItem ? Number(lensItem.unit_price || 0) : 0;
              pricing = {
                frame_base_price: frameBase,
                frame_promo_price: framePromo,
                base_total: frameBase + lensUnit,
                promo_total: framePromo + lensUnit,
              };
            }
          }
          if (!pricing && fetchedPricing) pricing = fetchedPricing;
          if (pricing && pricing.base_total != null && pricing.promo_total != null && Number(pricing.base_total) !== Number(pricing.promo_total)) {
            return (
              <div>
                <div style={{ color: 'var(--muted)' }}>{t('Base total')}</div>
                <div style={{ textDecoration: 'line-through' }}>{fmt(Number(pricing.base_total))}</div>
                <div style={{ marginTop: 6 }}>{t('Promotion total')}: <strong>{fmt(Number(pricing.promo_total))}</strong></div>
                <div className="muted" style={{ marginTop: 6 }}>{t('Paid')}: {fmt(order.total)}</div>
              </div>
            );
          }
          return <div>{t('Total Paid')}: {fmt(order.total)}</div>;
        })()}
        {order.paid_at && <div className="muted">{t('Paid')}: {order.paid_at}</div>}
        {order.finalised_at && <div className="muted">{t('Finalised')}: {order.finalised_at}</div>}
        {order.cancelled_at && <div className="muted">{t('Cancelled')}: {order.cancelled_at}</div>}
      </div>

      {order.meta && (localizeMeta(order.meta, 'frame_name') || order.meta.frame_name) && (
        <div className="card">
          <strong>{t('Frame')}:</strong> {localizeMeta(order.meta, 'frame_name') || order.meta.frame_name}
          {order.meta.lens && (
            <ul style={{ paddingLeft: 18, marginTop: 6 }}>
              <li>{t('Thickness')}: {order.meta.lens.thickness}</li>
              <li>{t('Blue-light')}: {order.meta.lens.blueLight ? t('Yes') : t('No')}</li>
              <li>{t('Photochromic')}: {order.meta.lens.photochromic ? t('Yes') : t('No')}</li>
              <li>{t('Progressive')}: {order.meta.lens.progressive ? t('Yes') : t('No')}</li>
            </ul>
          )}
        </div>
      )}

      {order.meta && (localizeMeta(order.meta, 'shop_name') || order.meta.shop_name) && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div><strong>{t('Partner Shop')}:</strong> {localizeMeta(order.meta, 'shop_name') || order.meta.shop_name}</div>
            {order.module === 'checkup' && (order.status === 'PendingForPayment' || order.status === 'CheckupPaid') && (
                <button
                className="btn secondary"
                style={{ width: 'auto', padding: '6px 10px' }}
                onClick={() => setChangingShop(true)}
              >
                {t('Change Shop')}
              </button>
            )}
          </div>
          {order.qr_token && order.status === 'CheckupPaid' && (
            <div style={{ marginTop: 10, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
              <QRImage value={order.qr_token} size={154} />
              <div style={{ marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'center', fontSize: '1.5em', fontWeight: 700 }}>
                {order.qr_token}
              </div>
            </div>
          )}
        </div>
      )}

      {order.modifiable && order.module === 'espectacles' && (
        <button className="btn secondary" onClick={modify}>{t('Modify (within window)')}</button>
      )}

      {order.items && order.items.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="label" style={{ fontSize: 11 }}>{t('ITEMS')}</div>
          {order.items.map(it => {
            let meta = null;
            try { meta = it.meta_json ? JSON.parse(it.meta_json) : null; } catch (e) { meta = null; }
            const baseUnit = meta && (meta.frame_base_price != null) ? Number(meta.frame_base_price) : null;
            const promoUnit = meta && (meta.frame_promo_price != null) ? Number(meta.frame_promo_price) : null;
            const showCrossed = baseUnit != null && promoUnit != null && promoUnit > 0 && promoUnit < baseUnit;
            return (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div>{it.label} × {it.qty}</div>
                    {showCrossed && <div style={{ background: '#eef2ff', color: '#3730a3', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>{t('Promotion')}</div>}
                  </div>
                  {showCrossed ? (
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <span style={{ textDecoration: 'line-through', color: 'var(--muted)', marginRight: 8 }}>{fmt(baseUnit)}</span>
                      <span style={{ fontWeight: 700 }}>{fmt(promoUnit)}</span>
                    </div>
                  ) : null}
                </div>
                <div style={{ fontWeight: 600 }}>
                  {showCrossed ? fmt(promoUnit * it.qty) : fmt(it.unit_price * it.qty)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(order.status === 'PendingForPayment' || order.modifiable) && (
        <>
          <div className="spacer" />
          {order.module === 'checkup' && order.status === 'CheckupPaid' && (
            <>
              <button
                className="btn success"
                onClick={() => nav(`/espectacles/manual-eyesight/${order.id}`)}
              >
                {t('I Have My Eyesight Data Now')}
              </button>
              <div className="spacer" />
            </>
          )}
          <button className="btn danger" disabled={busy} onClick={cancel}>{t('Cancel order')}</button>
        </>
      )}

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
