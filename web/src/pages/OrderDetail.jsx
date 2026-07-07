import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import QRImage from '../components/QRImage.jsx';
import ChangeShopModal from '../components/ChangeShopModal.jsx';
import DeliveryAddressSelector from '../components/DeliveryAddressSelector.jsx';
import { statusLabel, moduleLabel } from '../utils/status';
import { useDraft } from '../state/OrderDraftContext.jsx';
import { useCurrency } from '../state/CurrencyContext.jsx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../state/AuthContext.jsx';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [changingShop, setChangingShop] = useState(false);
  const [error, setError] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  const [replyToId, setReplyToId] = useState(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);
  const [collapsedComments, setCollapsedComments] = useState({});
  const [deliveryAddresses, setDeliveryAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [orderDeliveryAddress, setOrderDeliveryAddress] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressErr, setAddressErr] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const nav = useNavigate();
  const { user, loading } = useAuth();
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

  const canModifyDeliveryAddress = Boolean(
    user && order && order.user_id === user.id && (
      (order.module === 'espectacles' && (order.status === 'PendingForPayment' || order.modifiable)) ||
      (order.module === 'checkup' && order.status === 'CheckupPaid')
    )
  );
  const isOwner = Boolean(user && order && order.user_id === user.id);

  const fetchDeliveryAddresses = async () => {
    setAddressErr('');
    try {
      setLoadingAddresses(true);
      const result = await api('/api/auth/delivery-addresses');
      const addresses = result.addresses || [];
      setDeliveryAddresses(addresses);
      if (order?.delivery_address_id) {
        setSelectedAddressId(order.delivery_address_id);
      } else if (addresses.length > 0) {
        const defaultAddr = addresses.find(a => a.is_default === 1);
        setSelectedAddressId(defaultAddr ? defaultAddr.id : addresses[0].id);
      }
    } catch (e) {
      setAddressErr(e?.data?.error || e.message || 'Failed to load addresses');
    } finally {
      setLoadingAddresses(false);
    }
  };

  React.useEffect(() => {
    if (isOwner) {
      fetchDeliveryAddresses();
    }
  }, [isOwner, order?.delivery_address_id]);

  React.useEffect(() => {
    if (!order?.comments || !order.comments.length) return;
    const parentIds = new Set(order.comments.filter(c => c.parent_id != null).map(c => c.parent_id));
    setCollapsedComments(prev => {
      const next = { ...prev };
      parentIds.forEach(id => {
        if (next[id] === undefined) next[id] = true;
      });
      return next;
    });
  }, [order?.comments]);

  const updateOrderDeliveryAddress = async (addressId) => {
    if (!order) return;
    if (order.delivery_address_id === addressId) return;
    setSavingAddress(true);
    setAddressErr('');
    try {
      const route = order.module === 'checkup'
        ? `/api/orders/${order.id}/checkup/address`
        : `/api/orders/${order.id}/spectacles`;
      await api(route, {
        method: 'PATCH',
        body: { delivery_address_id: addressId },
      });
      await refresh();
    } catch (e) {
      setAddressErr(e?.data?.error || e.message || 'Unable to update delivery address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleAddressAdded = async (address) => {
    setDeliveryAddresses(prev => [...prev, address]);
    setSelectedAddressId(address.id);
    setAddressErr('');
    if (canModifyDeliveryAddress) await updateOrderDeliveryAddress(address.id);
  };

  const handleAddressUpdated = (updatedAddress) => {
    setDeliveryAddresses(prev => prev.map(a => {
      if (a.id === updatedAddress.id) return updatedAddress;
      if (updatedAddress.is_default === 1) return { ...a, is_default: 0 };
      return a;
    }));
    setSelectedAddressId(updatedAddress.id);
  };

  const handleSelectAddress = async (addressId) => {
    setSelectedAddressId(addressId);
    if (canModifyDeliveryAddress) await updateOrderDeliveryAddress(addressId);
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

  React.useEffect(() => {
    if (!order) {
      setOrderDeliveryAddress(null);
      return;
    }
    if (order.delivery_address) {
      setOrderDeliveryAddress(order.delivery_address);
      return;
    }
    if (order.delivery_address_id) {
      api(`/api/auth/delivery-addresses/${order.delivery_address_id}`)
        .then(d => setOrderDeliveryAddress(d.address || null))
        .catch(() => setOrderDeliveryAddress(null));
      return;
    }
    setOrderDeliveryAddress(null);
  }, [order]);

  const deliveryAddress = order?.delivery_address || orderDeliveryAddress || (order?.delivery_address_id ? { id: order.delivery_address_id } : null);

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
        delivery_address_id: order.delivery_address_id || null,
        modifyOrderId: order.id,
        originalTotal: Number(order.total),
      }));
    } catch {}
    nav('/espectacles/ordering');
  };

  const canComment = Boolean(user && order && (user.id === order.user_id || ['admin', 'super_admin'].includes(user.role)));
  const canReply = canComment;
  const showCommentComposer = !loading && canComment;

  const submitComment = async () => {
    if (!commentInput.trim()) return;
    setCommentBusy(true);
    try {
      await api(`/api/orders/${id}/comments`, {
        method: 'POST',
        body: { content: commentInput.trim(), parent_id: replyToId || null },
      });
      setCommentInput('');
      setReplyToId(null);
      refresh();
    } catch (e) {
      alert(e.message || t('Unable to add comment'));
    } finally {
      setCommentBusy(false);
    }
  };

  const handleReplyClick = (event, commentId) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canReply) return;
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

  const toggleCommentsCollapsed = () => setCommentsCollapsed(prev => !prev);
  const toggleCommentThread = (commentId) => setCollapsedComments(prev => ({ ...prev, [commentId]: !prev[commentId] }));

  const renderComments = (parentId = null, depth = 0) => {
    const items = (order?.comments || []).filter(c => (c.parent_id || null) === parentId);
    if (!items.length) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: depth === 0 ? 8 : 6 }}>
        {items.map(comment => {
          const author = comment.author_nickname || comment.real_name || comment.mobile || t('Customer');
          const createdAt = comment.created_at ? new Date(comment.created_at).toLocaleString() : '';
          const children = (order?.comments || []).filter(c => (c.parent_id || null) === comment.id);
          const hasChildren = children.length > 0;
          const threadCollapsed = !!collapsedComments[comment.id];
          return (
            <div key={comment.id} style={{ marginLeft: depth * 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: depth === 0 ? '#fafafa' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {hasChildren && (
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ width: 'auto', minWidth: 32, padding: '4px 8px', fontSize: 13 }}
                      onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleCommentThread(comment.id); }}
                    >
                      {threadCollapsed ? '+' : '−'}
                    </button>
                  )}
                  <strong>{author}</strong>
                </div>
                <span className="muted" style={{ fontSize: 12 }}>{createdAt}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{comment.content}</div>
              {canComment && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
                    disabled={!canReply}
                    onClick={(event) => handleReplyClick(event, comment.id)}
                  >
                    {t('Reply')}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
                    disabled={!canReply || replyToId !== comment.id || commentBusy || !commentInput.trim()}
                    onClick={handleSubmitComment}
                  >
                    {t('Submit')}
                  </button>
                </div>
              )}
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
              {hasChildren && !threadCollapsed && renderComments(comment.id, depth + 1)}
              {hasChildren && threadCollapsed && (
                <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{t('Replies folded')}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <button
        type="button"
        className="btn secondary"
        style={{ marginBottom: 12 }}
        onClick={() => nav('/orders')}
      >
        ← {t('Back to orders')}
      </button>
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
      {deliveryAddress && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 6 }}>{t('Delivery Address')}</div>
          {deliveryAddress.label && (
            <div style={{ marginBottom: 6, fontSize: 14, color: '#333' }}>{deliveryAddress.label}</div>
          )}
          <div style={{ marginBottom: 4 }}>
            {deliveryAddress.recipient_name || t('Unknown recipient')}
            {deliveryAddress.recipient_phone ? ` · ${deliveryAddress.recipient_phone}` : ''}
          </div>
          <div>{deliveryAddress.address || t('Address not available')}</div>
          {(deliveryAddress.city || deliveryAddress.state || deliveryAddress.postal_code) && (
            <div style={{ color: '#555', marginTop: 4 }}>
              {deliveryAddress.city ? `${deliveryAddress.city}` : ''}
              {deliveryAddress.state ? ` ${deliveryAddress.state}` : ''}
              {deliveryAddress.postal_code ? ` ${deliveryAddress.postal_code}` : ''}
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div className="label" style={{ fontSize: 14, fontWeight: 700 }}>{t('Delivery Address')}</div>
          </div>
          {addressErr && <div className="error" style={{ marginTop: 12 }}>{addressErr}</div>}
          {loadingAddresses ? (
            <div className="card muted" style={{ marginTop: 12 }}>{t('Loading addresses...')}</div>
          ) : (
            <DeliveryAddressSelector
              addresses={deliveryAddresses}
              selectedId={selectedAddressId}
              onSelect={handleSelectAddress}
              onAddressAdded={handleAddressAdded}
              onAddressUpdated={handleAddressUpdated}
              title={t('Delivery Address')}
            />
          )}
        </div>
      )}

      {order.meta && (localizeMeta(order.meta, 'frame_name') || order.meta.frame_name) && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('Frame')}</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {order.meta.frame_brand ? <li>{t('Frame Brand')}: {order.meta.frame_brand}</li> : null}
            <li>{t('Frame Name')}: {localizeMeta(order.meta, 'frame_name') || order.meta.frame_name}</li>
            {order.meta.frame_code ? <li>{t('Frame Code')}: {order.meta.frame_code}</li> : null}
          </ul>
          {order.meta.lens && (
            <>
              <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>{t('Lens')}</div>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {order.meta.lens.brand ? <li>{t('Lens Brand')}: {order.meta.lens.brand}</li> : null}
                {order.meta.lens.name ? <li>{t('Lens Name')}: {order.meta.lens.name}</li> : null}
                {order.meta.lens.code || order.meta.lens.brand_code ? <li>{t('Lens Code')}: {order.meta.lens.code || order.meta.lens.brand_code}</li> : null}
                <li>{t('Thickness')}: {order.meta.lens.thickness}</li>
                <li>{t('Blue-light')}: {order.meta.lens.blueLight ? t('Yes') : t('No')}</li>
                <li>{t('Photochromic')}: {order.meta.lens.photochromic ? t('Yes') : t('No')}</li>
                <li>{t('Progressive')}: {order.meta.lens.progressive ? t('Yes') : t('No')}</li>
              </ul>
            </>
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

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div className="label" style={{ fontSize: 14, fontWeight: 700 }}>{t('COMMENTS')}</div>
          <button
            type="button"
            className="btn secondary"
            style={{ width: 'auto', minWidth: 32, padding: '4px 8px', fontSize: 14, lineHeight: 1 }}
            onClick={toggleCommentsCollapsed}
          >
            {commentsCollapsed ? '+' : '−'}
          </button>
        </div>
        {commentsCollapsed ? (
          <div className="muted" style={{ marginTop: 8 }}>{t('Comments folded')}</div>
        ) : order.comments && order.comments.length > 0 ? renderComments() : <div className="muted" style={{ marginTop: 8 }}>{t('No comments yet.')}</div>}
        {loading ? (
          <div className="muted" style={{ marginTop: 12 }}>{t('Loading account…')}</div>
        ) : showCommentComposer ? (
          !replyToId ? (
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
          )
        ) : (
          <div className="muted" style={{ marginTop: 12 }}>{t('Please sign in to add comments')}</div>
        )}
      </div>

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
