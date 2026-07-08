import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { useAuth } from '../../state/AuthContext.jsx';
import { useCurrency } from '../../state/CurrencyContext.jsx';
import VendorStaffsTab from '../../components/VendorStaffsTab.jsx';

const STATUS_LABELS = {
  PendingForBid:         'Open for Bid',
  PendingForManufacture: 'Accepted — Ready to Start',
  ManufacturingAccept:   'Processing',
  UnderManufacturing:    'Manufacturing',
  ManufactureDone:       'Done — Ready to Ship',
  ShippingBack:          'Shipped Back',
};

const NEXT_ACTIONS = {
  PendingForManufacture: { action: 'start',      label: '▶ Start Processing' },
  ManufacturingAccept:   { action: 'processing', label: '🔨 Mark Manufacturing' },
  UnderManufacturing:    { action: 'done',        label: '✅ Order Done' },
  ManufactureDone:       { action: 'shipback',    label: '📦 Order Shipped' },
};

function OrderCard({ order: initialOrder, actionLabel, onAction }) {
  const [order, setOrder] = useState(initialOrder);
  const [expanded, setExpanded] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [frameDetails, setFrameDetails] = useState(null);
  const { fmt } = useCurrency();
  const { t } = useTranslation();

  useEffect(() => { setOrder(initialOrder); }, [initialOrder]);

  const toggleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !order.items) {
      setLoadingDetail(true);
      try {
        const d = await api(`/api/vendor/orders/${order.id}`);
        setOrder(prev => ({ ...prev, items: d.order.items, meta: d.order.meta || prev.meta }));
      } catch {}
      finally { setLoadingDetail(false); }
    }
  };

  useEffect(() => {
    if (!expanded || !order.items) return;
    const frameId = order.meta?.frame_id || order.items.find(i => i.kind === 'frame')?.ref_id;
    if (!frameId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await api(`/api/frames/${frameId}`);
        if (!cancelled) setFrameDetails(data.frame || null);
      } catch {
        if (!cancelled) setFrameDetails(null);
      }
    })();

    return () => { cancelled = true; };
  }, [expanded, order.items, order.meta]);

  const doAction = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try { await onAction(); }
    finally { setBusy(false); }
  };

  const meta = order.meta || {};
  const eyesight = meta.eyesight || {};
  const lens = meta.lens || {};
  const frameItem = order.items?.find(i => i.kind === 'frame');
  const lensItem = order.items?.find(i => i.kind === 'lens');
  const frameBrand = frameDetails?.brand || meta.frame_brand || null;
  const frameName = frameDetails?.name || frameItem?.label || meta.frame_name || meta.frame_name_zh || null;
  const frameCode = frameDetails?.code || meta.frame_code || null;
  const lensBrand = lens.brand || lensItem?.label || lens.brand_name_zh || null;
  const lensName = lens.name || null;
  let lensCode = lens.code || lens.brand_code || null;
  if (!lensCode && lensItem?.meta_json) {
    try {
      const itemMeta = typeof lensItem.meta_json === 'string' ? JSON.parse(lensItem.meta_json) : lensItem.meta_json;
      lensCode = itemMeta?.brand_code || null;
    } catch (e) {
      lensCode = null;
    }
  }
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={toggleExpand}
      >
        <div>
          <div style={{ fontWeight: 600 }}>{order.order_code}</div>
          <div
            style={{
              marginTop: 4,
              textAlign: 'center',
              color: '#16a34a',
              fontWeight: 700,
              fontSize: 22,
              lineHeight: 1.2,
            }}
          >
            Offered: {fmt(Number(meta.vendor_price ?? 0))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-badge status-${order.status}`}>
            {t(STATUS_LABELS[order.status] || order.status)}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 16 }}>
          {loadingDetail ? (
            <div className="muted" style={{ fontSize: 15 }}>{t('Loading')}</div>
          ) : (
            <>
              {frameName && (
                <div style={{ marginBottom: 12 }}>
                  <div className="label" style={{ fontSize: 15, marginBottom: 4, fontWeight: 700, color: '#2563eb' }}>{t('FRAME')}</div>
                  {frameDetails?.images?.[0]?.url ? (
                    <img
                      src={frameDetails.images[0].url}
                      alt={frameName}
                      style={{ width: 120, height: 96, objectFit: 'cover', borderRadius: 10, marginBottom: 8, display: 'block' }}
                    />
                  ) : null}
                  {frameBrand ? (
                    <div style={{ marginBottom: 6, fontSize: 15 }}>{t('Brand')}: <strong>{frameBrand}</strong></div>
                  ) : null}
                  {frameName ? (
                    <div style={{ marginBottom: 6, fontSize: 15 }}>{t('Name')}: <strong>{frameName}</strong></div>
                  ) : null}
                  {frameCode ? (
                    <div style={{ marginBottom: 6, fontSize: 15 }}>{t('Frame Code')}: <strong>{frameCode}</strong></div>
                  ) : null}
                </div>
              )}

              {Object.keys(lens).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="label" style={{ fontSize: 15, marginBottom: 4, fontWeight: 700, color: '#2563eb' }}>{t('LENS OPTIONS')}</div>
                  <div style={{ fontSize: 16, lineHeight: 1.6 }}>
                    {lensBrand && <div><strong>{t('Brand')}:</strong> {lensBrand}</div>}
                    {lensName && <div><strong>{t('Name')}:</strong> {lensName}</div>}
                    {lensCode && <div><strong>{t('Lens Code')}:</strong> {lensCode}</div>}
                    {lens.thickness && <div>{t('Thickness')}: <strong>{lens.thickness}</strong></div>}
                    {lens.blueLight && <div>✓ {t('Blue-light')}</div>}
                    {lens.photochromic && <div>✓ {t('Photochromic')}</div>}
                    {lens.progressive && <div>✓ {t('Progressive')}</div>}
                  </div>
                </div>
              )}

              {eyesight.pd != null && (
                <div style={{ marginBottom: 12 }}>
                  <div className="label" style={{ fontSize: 15, marginBottom: 6, fontWeight: 700, color: '#2563eb' }}>{t('EYESIGHT')}</div>
                  <table style={{ fontSize: 15, borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ color: 'var(--muted)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px 4px 0' }}></th>
                        <th style={{ padding: '4px 8px' }}>{t('Sphere')}</th>
                        <th style={{ padding: '4px 8px' }}>{t('Cylinder')}</th>
                        <th style={{ padding: '4px 8px' }}>{t('Axis')}</th>
                        <th style={{ padding: '4px 8px' }}>{t('Addition')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[['Left', 'l'], ['Right', 'r']].map(([eye, k]) => (
                        <tr key={eye}>
                          <td style={{ padding: '6px 6px 6px 0', fontWeight: 700 }}>{t(eye)}</td>
                          {['sph','cyl','axis','add'].map(f => (
                            <td key={f} style={{ padding: '6px 8px', textAlign: 'center' }}>
                              {eyesight[`${k}_${f}`] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 15, marginTop: 6, fontWeight: 700 }}>{t('Pupil Distance')}: <strong>{eyesight.pd}</strong></div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {actionLabel && onAction && (
        <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={doAction}>
          {busy ? 'Processing…' : actionLabel}
        </button>
      )}
    </div>
  );
}

function AvailableOrdersTab() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const d = await api('/api/vendor/orders?tab=available');
      setOrders(d.orders);
    } catch { setError('Failed to load orders.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleTake = async (id) => {
    try {
      await api(`/api/vendor/orders/${id}/accept`, { method: 'POST' });
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (e) {
      setError(e?.data?.error === 'already_taken' ? 'This order was already taken by another vendor.' : 'Failed to take order.');
    }
  };

  if (loading) return <div className="muted" style={{ padding: 16 }}>Loading…</div>;

  return (
    <>
      {error && (
        <div className="card" style={{ color: '#dc2626', background: '#fef2f2', marginBottom: 12 }}>
          {t(error) || error}
          <button className="btn secondary" style={{ marginTop: 6 }} onClick={() => setError('')}>{t('Dismiss')}</button>
        </div>
      )}
      {orders.length === 0
        ? <div className="card"><span className="muted">{t('No available orders at the moment.')}</span></div>
        : orders.map(o => (
          <OrderCard
            key={o.id}
            order={o}
            actionLabel="🤝 Take Order"
            onAction={() => handleTake(o.id)}
          />
        ))
      }
    </>
  );
}

function TakenOrdersTab() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const d = await api('/api/vendor/orders?tab=taken');
      setOrders(d.orders);
    } catch { setError('Failed to load orders.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (orderId, action) => {
    try {
      const d = await api(`/api/vendor/orders/${orderId}/${action}`, { method: 'POST' });
      setOrders(prev => {
        const updated = prev.map(o => o.id === orderId ? { ...d.order } : o);
        // If current filter now has no orders, reset to "All statuses"
        if (filterStatus && !updated.some(o => o.status === filterStatus)) {
          setFilterStatus('');
        }
        return updated;
      });
    } catch (e) {
      setError(e?.data?.error || 'Action failed.');
    }
  };

  if (loading) return <div className="muted" style={{ padding: 16 }}>{t('Loading')}</div>;

  return (
    <>
      {error && (
        <div className="card" style={{ color: '#dc2626', background: '#fef2f2', marginBottom: 12 }}>
          {t(error) || error}
          <button className="btn secondary" style={{ marginTop: 6 }} onClick={() => setError('')}>{t('Dismiss')}</button>
        </div>
      )}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 16, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 700 }}>{t('Orders Taken:')}</label>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '6px 8px', fontSize: 16, width: '35%' }}>
          <option value="">{t('All statuses')} ({orders.length})</option>
          {Object.keys(STATUS_LABELS).map(s => {
            const count = orders.filter(o => o.status === s).length;
            return count > 0 ? <option key={s} value={s}>{t(STATUS_LABELS[s] || s)} ({count})</option> : null;
          })}
        </select>
      </div>

      {orders.filter(o => !filterStatus || o.status === filterStatus).length === 0
        ? <div className="card"><span className="muted">{t('No taken orders yet.')}</span></div>
        : orders.filter(o => !filterStatus || o.status === filterStatus).map(o => {
          const actionDef = NEXT_ACTIONS[o.status];
          return (
            <OrderCard
              key={o.id}
              order={o}
              actionLabel={actionDef?.label}
              onAction={actionDef ? () => handleAction(o.id, actionDef.action) : null}
            />
          );
        })
      }
    </>
  );
}

const TABS = [
  ['available', '📋 Available Orders'],
  ['taken',     '🔨 Taken Orders'],
  ['staff',     '👥 Staff'],
];

export default function VendorManufacture() {
  const [tab, setTab] = useState('available');
  const { user, vendorContext } = useAuth();
  const { t } = useTranslation();
  const isOwner = user?.role === 'spectacle_producer_vendor';
  const canManageStaff = isOwner || vendorContext?.is_staff_admin;

  const visibleTabs = TABS.filter(([key]) => key !== 'staff' || canManageStaff);

  return (
    <div>
      <h1 className="h1">{t('Manufacture Orders') || '🏭 Manufacture Orders'}</h1>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        {visibleTabs.map(([key, labelKey]) => (
          <button key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: tab === key ? 700 : 400,
              color: tab === key ? '#000000' : '#000000',
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              fontSize: 17,
            }}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === 'available' && <AvailableOrdersTab />}
      {tab === 'taken' && <TakenOrdersTab />}
      {tab === 'staff' && canManageStaff && <VendorStaffsTab />}

      <div className="spacer" />
    </div>
  );
}
