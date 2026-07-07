import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../state/AuthContext.jsx';
import { useCurrency } from '../../state/CurrencyContext.jsx';
import { useTranslation } from 'react-i18next';

const TERMINAL = ['Cancelled', 'SystemDone'];

const WORKFLOW_TRANSITIONS = {
  Paid:                  ['Finalised'],
  Finalised:             ['PendingForManufacture', 'Processing'],
  PendingForManufacture: ['Processing'],
  Delivered:             ['UserConfirmed', 'SystemDone'],
  UserConfirmed:         ['SystemDone'],
  Completed:             ['UserConfirmed', 'SystemDone'],
};

function OrderDetails({ order, allOrders, refresh }) {
  const { t } = useTranslation();
  const { fmt } = useCurrency();
  const [commentInput, setCommentInput] = useState('');
  const [replyToId, setReplyToId] = useState(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [comments, setComments] = useState(order.comments || []);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    setComments(order.comments || []);
  }, [order.id, order.comments]);

  useEffect(() => {
    if ((!order.comments || order.comments.length === 0) && order.has_opening_comments) {
      (async () => {
        setLoadingComments(true);
        try {
          const data = await api(`/api/orders/${order.id}`);
          setComments(data.order.comments || []);
        } catch (e) {
          console.error('Failed to load order comments', e);
        } finally {
          setLoadingComments(false);
        }
      })();
    }
  }, [order.id, order.comments, order.has_opening_comments]);

  // For supplement orders, show the parent order's details
  let displayOrder = order;
  let isSupp = false;
  if (order.meta?.kind === 'supplement' && order.meta?.parent_order_id && allOrders) {
    const parent = allOrders.find(o => o.id === order.meta.parent_order_id);
    if (parent) { displayOrder = parent; isSupp = true; }
  }

  const meta = displayOrder.meta || {};
  const eyesight = meta.eyesight || {};
  // Compute pricing fallback: derive from frame and lens items when meta.pricing is missing
  let pricing = displayOrder.meta?.pricing || null;
  if (!pricing && displayOrder.items) {
    const frameItem = displayOrder.items.find(i => i.kind === 'frame');
    const lensItem = displayOrder.items.find(i => i.kind === 'lens');
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
  // If we still don't have pricing, attempt to fetch current frame prices (async)
  const [fetchedPricing, setFetchedPricing] = useState(null);
  React.useEffect(() => {
    if (pricing || !displayOrder.items) return;
    const frameItem = displayOrder.items.find(i => i.kind === 'frame');
    const lensItem = displayOrder.items.find(i => i.kind === 'lens');
    const frameId = displayOrder.meta?.frame_id || (frameItem && frameItem.ref_id);
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
  }, [displayOrder]);
  if (!pricing && fetchedPricing) pricing = fetchedPricing;
  const lens = meta.lens || {};
  const lensItem = displayOrder.items?.find(i => i.kind === 'lens');
  const frameItem = displayOrder.items?.find(i => i.kind === 'frame');
  const frameName = frameItem?.label || meta.frame_name;
  const hasEyesight = Object.values(eyesight).some(v => v != null);

  const submitComment = async () => {
    if (!commentInput.trim()) return;
    setCommentBusy(true);
    try {
      const result = await api(`/api/orders/${order.id}/comments`, {
        method: 'POST',
        body: { content: commentInput.trim(), parent_id: replyToId || null },
      });
      setComments(result.comments || comments);
      setCommentInput('');
      setReplyToId(null);
      if (refresh) refresh();
    } catch (e) {
      alert(e.message || t('Unable to add comment'));
    } finally {
      setCommentBusy(false);
    }
  };

  const handleReplyClick = (event, commentId) => {
    event.preventDefault();
    event.stopPropagation();
    setReplyToId(commentId);
    setCommentInput('');
  };

  const handleSubmitComment = (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitComment();
  };

  const handleCancelReply = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setReplyToId(null);
    setCommentInput('');
  };

  const stopComposerPropagation = (event) => {
    event.stopPropagation();
  };

  const renderComments = (parentId = null, depth = 0) => {
    const items = (comments || []).filter(c => (c.parent_id || null) === parentId);
    if (!items.length) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: depth === 0 ? 8 : 6 }}>
        {items.map(comment => {
          const author = comment.author_nickname || comment.real_name || comment.mobile || t('Customer');
          const createdAt = comment.created_at ? new Date(comment.created_at).toLocaleString() : '';
          return (
            <div key={comment.id} style={{ marginLeft: depth * 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: depth === 0 ? '#fafafa' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <strong>{author}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{createdAt}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{comment.content}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
                  onClick={(event) => handleReplyClick(event, comment.id)}
                >
                  {t('Reply')}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
                  disabled={commentBusy || replyToId !== comment.id || !commentInput.trim()}
                  onClick={handleSubmitComment}
                >
                  {t('Submit')}
                </button>
              </div>
              {replyToId === comment.id && (
                <div
                  style={{ marginTop: 8 }}
                  onClick={stopComposerPropagation}
                  onMouseDown={stopComposerPropagation}
                  onTouchStart={stopComposerPropagation}
                  onFocus={stopComposerPropagation}
                >
                  <textarea
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onClick={stopComposerPropagation}
                    onMouseDown={stopComposerPropagation}
                    onTouchStart={stopComposerPropagation}
                    onFocus={stopComposerPropagation}
                    placeholder={t('Write a reply')}
                    style={{ width: '100%', minHeight: 84, padding: 10, borderRadius: 8, border: '1px solid var(--border)', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="btn secondary" onClick={handleCancelReply}>
                      {t('Cancel reply')}
                    </button>
                  </div>
                </div>
              )}
              {renderComments(comment.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const hasComments = Array.isArray(comments) && comments.length > 0;
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 13 }}>
      {isSupp && (
        <div className="muted" style={{ marginBottom: 6, fontStyle: 'italic' }}>
          {t('Supplement payment for order')} <strong>{order.meta.parent_order_code}</strong>
        </div>
      )}
      <div className="muted" style={{ marginBottom: 6 }}>
        {t('Created')}: {order.created_at} {order.paid_at ? `· ${t('Paid')}: ${order.paid_at}` : ''}
        {pricing && pricing.base_total != null && pricing.promo_total != null && Number(pricing.base_total) !== Number(pricing.promo_total) && (
          <div style={{ marginTop: 6 }}>
            <div style={{ color: 'var(--muted)' }}>{t('Base total')}</div>
            <div style={{ textDecoration: 'line-through' }}>{fmt(Number(pricing.base_total))}</div>
            <div style={{ marginTop: 4 }}>{t('Promotion total')}: <strong>{fmt(Number(pricing.promo_total))}</strong></div>
          </div>
        )}
      </div>
      {meta.shop_name && (
        <div style={{ marginBottom: 6 }}>{t('Shop')}: <strong>{meta.shop_name}</strong></div>
      )}
      {order.status === 'PendingForBid' && (
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#000' }}>{t('Vendor Offered')}</span>
          <strong style={{ fontSize: 16, color: '#000' }}>{fmt(Number(order.meta?.vendor_price ?? 0))}</strong>
        </div>
      )}
      {(frameName || meta.frame_brand || meta.frame_code) && (
        <div style={{ marginBottom: 6 }}>
          <div className="label" style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{t('FRAME')}</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {meta.frame_brand ? <li>{t('Frame Brand')}: {meta.frame_brand}</li> : null}
            {frameName ? <li>{t('Frame Name')}: {frameName}</li> : null}
            {meta.frame_code ? <li>{t('Frame Code')}: {meta.frame_code}</li> : null}
          </ul>
        </div>
      )}
      {(lensItem || Object.keys(lens).length > 0) && (
        <div style={{ marginBottom: 6 }}>
          <div className="label" style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{t('LENS')}</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {lens.brand ? <li>{t('Lens Brand')}: {lens.brand}</li> : null}
            {lens.name ? <li>{t('Lens Name')}: {lens.name}</li> : null}
            {(lens.code || lens.brand_code) ? <li>{t('Lens Code')}: {lens.code || lens.brand_code}</li> : null}
          </ul>
          {lens.thickness && <div style={{ marginTop: 4 }}>{t('Thickness')}: <strong>{lens.thickness}</strong></div>}
          {lens.blueLight && <div>✓ {t('Blue Light Filter')}</div>}
          {lens.photochromic && <div>✓ {t('Photochromic')}</div>}
          {lens.progressive && <div>✓ {t('Progressive')}</div>}
        </div>
      )}
      {hasEyesight && (
        <div style={{ marginBottom: 6 }}>
          <div className="label" style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{t('EYESIGHT')}</div>
          <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ color: 'var(--muted)' }}>
                <th style={{ textAlign: 'left' }}></th>
                <th>{t('Sphere')}</th><th>{t('Cylinder')}</th><th>{t('Axis')}</th><th>{t('Addition')}</th>
              </tr>
            </thead>
            <tbody>
              {[['Left', 'l'], ['Right', 'r']].map(([eye, k]) => (
                <tr key={eye}>
                  <td style={{ fontWeight: 600 }}>{t(eye)}</td>
                  {['sph','cyl','axis','add'].map(f => (
                    <td key={f} style={{ textAlign: 'center' }}>{eyesight[`${k}_${f}`] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {eyesight.pd != null && <div style={{ marginTop: 4, fontWeight: 700 }}>{t('Pupil Distance')}: <strong>{eyesight.pd}</strong></div>}
        </div>
      )}
      {isSupp && displayOrder.payments && displayOrder.payments.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div className="label" style={{ fontSize: 11 }}>{t('ORIGINAL PAYMENT')}</div>
          {displayOrder.payments.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{p.method} · {p.status}</span>
              <span>{fmt(Number(p.amount))}</span>
            </div>
          ))}
        </div>
      )}
      {order.items && order.items.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div className="label" style={{ fontSize: 11 }}>{t('ITEMS')}</div>
          {order.items.map(it => {
            let meta = null;
            try { meta = it.meta_json ? JSON.parse(it.meta_json) : null; } catch (e) { meta = null; }
            const baseUnit = meta && (meta.frame_base_price != null) ? Number(meta.frame_base_price) : null;
            const promoUnit = meta && (meta.frame_promo_price != null) ? Number(meta.frame_promo_price) : null;
            const showCrossed = baseUnit != null && promoUnit != null && promoUnit > 0 && promoUnit < baseUnit;
            return (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div>{it.label} × {it.qty}</div>
                  {showCrossed ? (
                    <div style={{ fontSize: 13 }}>
                      <span style={{ textDecoration: 'line-through', color: 'var(--muted)', marginRight: 8 }}>{fmt(baseUnit)}</span>
                      <span style={{ fontWeight: 700 }}>{fmt(promoUnit)}</span>
                    </div>
                  ) : null}
                </div>
                <div>
                  {showCrossed ? fmt(promoUnit * it.qty) : fmt(it.unit_price * it.qty)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {order.payments && order.payments.length > 0 && (
        <div>
          <div className="label" style={{ fontSize: 11 }}>{t('PAYMENTS')}</div>
          {order.payments.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{p.method} · {p.status}</span>
              <span>{fmt(Number(p.amount))}</span>
            </div>
          ))}
        </div>
      )}
      <div className="card" style={{ marginTop: 12, padding: 12, background: '#fff' }}>
        <div className="label" style={{ fontSize: 11 }}>{t('COMMENTS')}</div>
        {loadingComments ? (
          <div className="muted" style={{ marginTop: 8 }}>{t('Loading...')}</div>
        ) : hasComments ? (
          renderComments()
        ) : (
          <div className="muted" style={{ marginTop: 8 }}>{t('No comments yet.')}</div>
        )}
        {!replyToId ? (
          <div
            style={{ marginTop: 12 }}
            onClick={stopComposerPropagation}
            onMouseDown={stopComposerPropagation}
            onTouchStart={stopComposerPropagation}
            onFocus={stopComposerPropagation}
          >
            <textarea
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onClick={stopComposerPropagation}
              onMouseDown={stopComposerPropagation}
              onTouchStart={stopComposerPropagation}
              onFocus={stopComposerPropagation}
              placeholder={t('Add a comment for this order')}
              style={{ width: '100%', minHeight: 84, padding: 10, borderRadius: 8, border: '1px solid var(--border)', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn" disabled={commentBusy || !commentInput.trim()} onClick={handleSubmitComment}>
                {t('Add comment')}
              </button>
            </div>
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 12 }}>{t('Replying to a previous comment')}</div>
        )}
      </div>
    </div>
  );
}

const ALL_STATUSES = [
  'OrderPaid', 'PendingForBid', 'PendingForManufacture', 'ManufacturingAccept',
  'UnderManufacturing', 'ManufactureDone', 'ShippingBack', 'Delivered',
  'CheckupPaid', 'PendingForOrder', 'PendingForPayment', 'Finalised',
  'Processing', 'Completed', 'Cancelled', 'SystemDone',
];
const SPECIAL_FILTERS = [{ value: '_opening_comments', label: 'Openning Comment(s)' }];

export default function AdminOrders() {
  const { user } = useAuth();
  const { fmt } = useCurrency();
  const { t } = useTranslation();
  const isSuperAdmin = user?.role === 'super_admin';
  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [uploading, setUploading] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [publishForm, setPublishForm] = useState(null); // { orderId, orderCode, vendorPrice }

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const openPublish = (o) => {
    setPublishForm({ orderId: o.id, orderCode: o.order_code, vendorPrice: '', editPriceOnly: false });
  };

  const openEditPrice = (o) => {
    setPublishForm({ orderId: o.id, orderCode: o.order_code, vendorPrice: o.meta?.vendor_price ?? '', editPriceOnly: true });
  };

  const confirmPublish = async () => {
    const price = parseFloat(publishForm.vendorPrice);
    if (!publishForm.vendorPrice || isNaN(price) || price <= 0)
      return alert('Please enter a valid vendor price.');
    setBusy(publishForm.orderId + 'publish');
    try {
      if (publishForm.editPriceOnly) {
        await api(`/api/admin/orders/${publishForm.orderId}/vendor-price`, {
          method: 'PATCH', body: { vendor_price: price },
        });
      } else {
        await api(`/api/admin/orders/${publishForm.orderId}/status`, {
          method: 'PATCH', body: { status: 'PendingForBid', vendor_price: price },
        });
      }
      setPublishForm(null);
      load();
    } catch (e) {
      alert(e?.data?.error || e.message);
    } finally { setBusy(null); }
  };

  const load = () => api('/api/admin/orders').then(d => setOrders(d.orders));
  useEffect(() => { load(); }, []);

  useEffect(() => { console.log('AdminOrders load result', orders); }, [orders]);

  const finalise = async () => {
    const r = await api('/api/orders/cron/finalise', { method: 'POST' });
    alert(`Finalised: ${r.finalised}`);
    load();
  };

  const setStatus = async (id, status) => {
    setBusy(id + status);
    try {
      await api(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      alert(e?.data?.error || e.message);
    } finally { setBusy(null); setConfirmAction(null); }
  };

  const upload = async (id) => {
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : Number(v)]));
    await api(`/api/orders/${id}/checkup/upload`, { method: 'POST', body });
    setUploading(null); setForm({}); load();
  };

  const workflowTargets = (status) => (WORKFLOW_TRANSITIONS[status] || []);
  const displayed = filterStatus === '_opening_comments'
    ? orders.filter(o => o.has_opening_comments)
    : filterStatus
      ? orders.filter(o => o.status === filterStatus)
      : orders;
  console.log('AdminOrders render, orders count=', orders.length, 'filterStatus=', filterStatus);

  return (
    <div>
      {/* Publish for Bid dialog */}
      {publishForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div className="card" style={{ maxWidth: 320, width: '90%' }}>
            <h3 style={{ marginTop: 0 }}>{publishForm.editPriceOnly ? '✏️ ' + t('Edit Offer') : '📢 ' + t('Publish for Bid')}</h3>
            <p style={{ marginTop: 0 }}>{t('Order')} <strong>{publishForm.orderCode}</strong></p>
            <label className="field">
              {t('Vendor Price Offered (S$)')}
              <input
                type="number"
                min="0"
                step="0.01"
                value={publishForm.vendorPrice}
                onChange={e => setPublishForm(f => ({ ...f, vendorPrice: e.target.value }))}
                placeholder={t('e.g. 120.00')}
                autoFocus
              />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn" style={{ flex: 1, background: '#2563eb' }} disabled={!!busy} onClick={confirmPublish}>
                {busy ? t('Publishing…') : t('Publish')}
              </button>
              <button className="btn secondary" style={{ flex: 1 }} onClick={() => setPublishForm(null)}>
                {t('Form.Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div className="card" style={{ maxWidth: 320, width: '90%' }}>
            <h3 style={{ marginTop: 0 }}>{t('Confirm')} {confirmAction.label}</h3>
            <p>{t('Order')} <strong>{confirmAction.orderCode}</strong> {t('will be set to')} <strong>{confirmAction.status}</strong>. {t('This cannot be undone.')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                style={{ flex: 1, background: confirmAction.status === 'Cancelled' ? '#dc2626' : undefined }}
                disabled={!!busy}
                onClick={() => setStatus(confirmAction.orderId, confirmAction.status)}
              >
                {busy ? t('Processing…') : t('Confirm')}
              </button>
              <button className="btn secondary" style={{ flex: 1 }} onClick={() => setConfirmAction(null)}>
                {t('Form.Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn secondary" style={{ width: 'auto' }} onClick={finalise}>
          {t('Run auto-finalise (12h+)')}
        </button>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ flex: 1, minWidth: 160, width: 'auto' }}
        >
          <option value="">{t('All statuses')} ({orders.length})</option>
          {SPECIAL_FILTERS.map(({ value, label }) => {
            const count = orders.filter(o => o.has_opening_comments).length;
            return count > 0 ? <option key={value} value={value}>{t(label)} ({count})</option> : null;
          })}
          {ALL_STATUSES.map(s => {
            const count = orders.filter(o => o.status === s).length;
            return count > 0 ? <option key={s} value={s}>{s} ({count})</option> : null;
          })}
        </select>
      </div>

      {/* Order list */}
      {displayed.map(o => {
        const isTerminal = TERMINAL.includes(o.status);
        const workflow = workflowTargets(o.status);
        return (
          <div key={o.id} className="card">
            <div
              style={{ cursor: 'pointer' }}
              onClick={() => toggleExpand(o.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{o.order_code}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`status-badge status-${o.status}`}>{o.status}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{expandedId === o.id ? '▲' : '▼'}</span>
                </div>
              </div>
              <div className="muted">{o.module} · {fmt(o.total)} · user #{o.user_id}</div>
            </div>

            {expandedId === o.id && (
              <div style={{ cursor: 'pointer' }} onClick={() => toggleExpand(o.id)}>
                <OrderDetails order={o} allOrders={orders} />
              </div>
            )}

            {!isTerminal && expandedId === o.id && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                {/* Publish for Bid — OrderPaid espectacles orders */}
                {o.status === 'OrderPaid' && o.module === 'espectacles' && (
                    <button
                    className="btn"
                    style={{ width: 'auto', padding: '4px 14px', fontSize: 13, background: '#2563eb' }}
                    disabled={!!busy}
                    onClick={() => openPublish(o)}
                  >
                    📢 {t('Publish for Bid')}
                  </button>
                )}

                {/* Edit Offer — PendingForBid espectacles orders */}
                {o.status === 'PendingForBid' && o.module === 'espectacles' && (
                    <button
                    className="btn secondary"
                    style={{ width: 'auto', padding: '4px 12px', fontSize: 13 }}
                    disabled={!!busy}
                    onClick={() => openEditPrice(o)}
                  >
                    ✏️ {t('Edit Offer')}
                  </button>
                )}

                {/* Normal workflow transitions */}
                {workflow.map(target => (
                  <button
                    key={target}
                    className="btn secondary"
                    style={{ width: 'auto', padding: '4px 12px', fontSize: 13 }}
                    disabled={!!busy}
                    onClick={() => setStatus(o.id, target)}
                  >
                    → {target}
                  </button>
                ))}

                {/* Cancel */}
                <button
                  className="btn secondary"
                  style={{ width: 'auto', padding: '4px 12px', fontSize: 13, color: '#dc2626', borderColor: '#dc2626' }}
                  disabled={!!busy}
                  onClick={() => setConfirmAction({ orderId: o.id, orderCode: o.order_code, status: 'Cancelled', label: 'Cancel Order' })}
                >
                  ✕ {t('Form.Cancel')}
                </button>

                {/* Close (SystemDone) — super_admin only */}
                {isSuperAdmin && (
                  <button
                    className="btn secondary"
                    style={{ width: 'auto', padding: '4px 12px', fontSize: 13 }}
                    disabled={!!busy}
                    onClick={() => setConfirmAction({ orderId: o.id, orderCode: o.order_code, status: 'SystemDone', label: 'Close Order' })}
                    >
                    ✓ {t('Close')}
                  </button>
                )}
              </div>
            )}

            {o.module === 'checkup' && o.status === 'Pending' && expandedId === o.id && (
              <>
                <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => setUploading(uploading === o.id ? null : o.id)}>
                  {uploading === o.id ? t('Form.Cancel') : t('Upload eyesight data')}
                </button>
                {uploading === o.id && (
                  <div style={{ marginTop: 10 }}>
                    {['l_sph', 'l_cyl', 'l_axis', 'l_add', 'r_sph', 'r_cyl', 'r_axis', 'r_add', 'pd'].map(k => (
                      <label key={k} className="field">
                        {k}
                        <input value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })} inputMode="decimal" />
                      </label>
                    ))}
                    <button className="btn" onClick={() => upload(o.id)}>{t('Submit')}</button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
