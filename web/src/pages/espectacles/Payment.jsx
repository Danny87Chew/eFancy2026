import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useDraft } from '../../state/OrderDraftContext.jsx';
import { useCurrency } from '../../state/CurrencyContext.jsx';
import { useTranslation } from 'react-i18next';
import QRImage from '../../components/QRImage.jsx';
import DeliveryAddressSelector from '../../components/DeliveryAddressSelector.jsx';

const METHODS = [
  { key: 'card', label: 'Credit/Debit Card' },
  { key: 'paylah', label: 'PayLah!' },
  { key: 'paynow', label: 'PayNow' },
  { key: 'wechat', label: 'WeChat Pay' },
  { key: 'alipay', label: 'AliPay' },
];

function digitsOnly(v, max) {
  const out = (v || '').replace(/\D/g, '');
  return max ? out.slice(0, max) : out;
}
function formatCard(v) {
  const d = digitsOnly(v, 19);
  return d.replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(v) {
  const d = digitsOnly(v, 4);
  if (d.length < 3) return d;
  return d.slice(0, 2) + '/' + d.slice(2);
}
// Luhn checksum
function luhnValid(num) {
  const d = digitsOnly(num);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function validate(method, f, t) {
  switch (method) {
    case 'card': {
      const num = digitsOnly(f.cardNumber);
      if (num.length < 13 || num.length > 19) return t ? t('Enter a valid card number') : 'Enter a valid card number';
      if (!luhnValid(num)) return t ? t('Card number is not valid') : 'Card number is not valid';
      if (!/^\d{2}\/\d{2}$/.test(f.expiry || '')) return t ? t('Enter expiry as MM/YY') : 'Enter expiry as MM/YY';
      const [mm, yy] = f.expiry.split('/').map(Number);
      if (mm < 1 || mm > 12) return t ? t('Invalid expiry month') : 'Invalid expiry month';
      if (yy < 26) return t ? t('Card expired') : 'Card expired';
      if (!/^\d{3,4}$/.test(f.cvv || '')) return t ? t('Enter a valid CVV') : 'Enter a valid CVV';
      if (!(f.cardName || '').trim()) return t ? t('Enter the cardholder name') : 'Enter the cardholder name';
      return null;
    }
    case 'paylah':
    case 'paynow': {
        if (method === 'paylah') {
          const m = digitsOnly(f.mobile);
          if (m.length < 8) return 'Enter a valid mobile number';
        }
        // PayNow uses merchant UEN/mobile configured server-side; no payer input required here
        return null;
    }
    case 'wechat':
      if (!(f.wechatId || '').trim()) return 'Enter your WeChat ID';
      return null;
    case 'alipay':
      if (!(f.alipayAccount || '').trim()) return 'Enter your Alipay account (mobile or email)';
      return null;
    default:
      return null;
  }
}

function MethodForm({ method, value, onChange, onInvalidCard }) {
  const { t } = useTranslation();
  const upd = (patch) => onChange({ ...value, ...patch });

  if (method === 'card') {
    return (
      <div>
        <label className="field">
          {t('Card number')}
          <input
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder={t('1234 5678 9012 3456')}
            value={value.cardNumber || ''}
            onChange={e => upd({ cardNumber: formatCard(e.target.value) })}
            onBlur={() => {
              const d = digitsOnly(value.cardNumber);
              if (d.length >= 13 && !luhnValid(d)) onInvalidCard && onInvalidCard();
            }}
          />
        </label>
        <div className="row">
          <label className="field">
            {t('Expiry (MM/YY)')}
            <input
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={value.expiry || ''}
              onChange={e => upd({ expiry: formatExpiry(e.target.value) })}
            />
          </label>
          <label className="field">
            {t('CVV')}
            <input
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              value={value.cvv || ''}
              onChange={e => upd({ cvv: digitsOnly(e.target.value, 4) })}
            />
          </label>
        </div>
        <label className="field" style={{ marginBottom: 0 }}>
          {t('Cardholder name')}
          <input
            autoComplete="cc-name"
            placeholder={t('Name as on card')}
            value={value.cardName || ''}
            onChange={e => upd({ cardName: e.target.value })}
          />
        </label>
      </div>
    );
  }

  if (method === 'paylah') {
    return (
      <label className="field" style={{ marginBottom: 0 }}>
        {t('PayLah! mobile number')}
        <input
          inputMode="tel"
          autoComplete="tel"
          placeholder={t('e.g. 91234567')}
          value={value.mobile || ''}
          onChange={e => upd({ mobile: e.target.value })}
        />
      </label>
    );
  }

  if (method === 'paynow') {
    return (
      <div className="muted" style={{ marginTop: 6 }}>{t('PayNow will generate a QR code for you; no input required.')}</div>
    );
  }

  if (method === 'wechat') {
    return (
      <label className="field" style={{ marginBottom: 0 }}>
        {t('WeChat ID')}
        <input
          placeholder={t('WeChat ID')}
          value={value.wechatId || ''}
          onChange={e => upd({ wechatId: e.target.value })}
        />
      </label>
    );
  }

  if (method === 'alipay') {
    return (
      <label className="field" style={{ marginBottom: 0 }}>
        {t('Alipay account (mobile or email)')}
        <input
          placeholder={t('e.g. user@example.com')}
          value={value.alipayAccount || ''}
          onChange={e => upd({ alipayAccount: e.target.value })}
        />
      </label>
    );
  }

  return null;
}

export default function Payment() {
  const { id } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const { reset } = useDraft();
  const { fmt } = useCurrency();
  const [order, setOrder] = useState(null);
  const [deliveryAddresses, setDeliveryAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressErr, setAddressErr] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [method, setMethod] = useState('card');
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [paynow, setPaynow] = useState(null);
  const [paynowTriggered, setPaynowTriggered] = useState(false);
  const [window, setWindow] = useState(12);
  const [cardWarn, setCardWarn] = useState(false);

  useEffect(() => {
    api(`/api/orders/${id}`).then(d => setOrder(d.order));
    api('/api/config/public').then(d => setWindow(d.order_modify_window_hours));
  }, [id]);

  useEffect(() => {
    const fetchDeliveryAddresses = async () => {
      setAddressErr('');
      setLoadingAddresses(true);
      try {
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
        setAddressErr(e?.data?.error || e.message || 'Failed to load delivery addresses');
      } finally {
        setLoadingAddresses(false);
      }
    };

    fetchDeliveryAddresses();
  }, [order?.delivery_address_id]);

  const form = forms[method] || {};
  const formError = useMemo(() => validate(method, form, t), [method, form, t]);

  useEffect(() => {
    if (method === 'paynow') {
      if (!paynowTriggered && order && !busy && !paynow && !formError) {
        setPaynowTriggered(true);
        pay('paynow');
      }
    } else if (paynowTriggered) {
      setPaynowTriggered(false);
    }
  }, [method, order, busy, paynow, formError, paynowTriggered]);

  const hasDeliveryAddress = Boolean(order?.delivery_address_id || selectedAddressId);
  const canPay = !busy && !formError && hasDeliveryAddress && !savingAddress;

  const refreshOrder = async () => {
    const d = await api(`/api/orders/${id}`);
    setOrder(d.order);
  };

  const updateOrderDeliveryAddress = async (addressId) => {
    if (!order) return;
    if (order.delivery_address_id === addressId) return;
    const endpoint = order.module === 'checkup'
      ? `/api/orders/${id}/checkup/address`
      : `/api/orders/${id}/spectacles`;
    setSavingAddress(true);
    setAddressErr('');
    try {
      await api(endpoint, {
        method: 'PATCH',
        body: { delivery_address_id: addressId },
      });
      await refreshOrder();
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
    await updateOrderDeliveryAddress(address.id);
  };

  const handleAddressUpdated = (updatedAddress) => {
    setDeliveryAddresses(prev => prev.map(a => a.id === updatedAddress.id ? updatedAddress : a));
    if (selectedAddressId === updatedAddress.id) {
      setOrder(prev => prev ? { ...prev, delivery_address: updatedAddress } : prev);
    }
  };

  const handleSelectAddress = async (addressId) => {
    setSelectedAddressId(addressId);
    await updateOrderDeliveryAddress(addressId);
  };

  const pay = async (paymentMethod = method) => {
    setErr('');
    if (!hasDeliveryAddress) {
      if (selectedAddressId) {
        await updateOrderDeliveryAddress(selectedAddressId);
        const d = await api(`/api/orders/${id}`);
        setOrder(d.order);
        if (!d.order.delivery_address_id) {
          setErr(t('Please add or select a delivery address before payment.'));
          return;
        }
      } else {
        setErr(t('Please add or select a delivery address before payment.'));
        return;
      }
    }
    const v = validate(paymentMethod, form, t);
    if (v) { setErr(v); return; }
    setBusy(true);
    try {
      const r = await api(`/api/orders/${id}/pay`, { method: 'POST', body: { method: paymentMethod } });
      if (r.paynow) {
        // show QR and wait for user confirmation
        setOrder(r.order);
        setPaynow(r.paynow);
      } else {
        setOrder(r.order); setDone(true); reset();
      }
    } catch (e) {
      setErr('Payment failed: ' + e.message);
      if (paymentMethod === 'paynow') {
        setPaynowTriggered(false);
      }
    }
    finally { setBusy(false); }
  };

  if (!order) return <div>Loading…</div>;

  if (done || order.status === 'CheckupPaid' || order.status === 'OrderPaid') {
    const isCheckup = order.module === 'checkup';
    return (
      <div>
        <h1 className="h1">{t('Payment successful')}</h1>
        <div className="card">
          <p>{t('Your order')} <strong>{order.order_code}</strong> {t('is now Paid.')}</p>
          {isCheckup ? (
            <p className="muted">{t('Show the QR code at the partner shop for your Eyesight Checkup.')}</p>
          ) : (
            <>
              <p className="muted">{t('You can modify or cancel this order within <strong>{{hours}} hours</strong>. After that, it becomes <strong>Finalised</strong> and cannot be changed.', { hours: window })}</p>
              <p className="muted">{t('Cancelled orders are refunded within 4 weeks.')}</p>
            </>
          )}
        </div>
        {order.delivery_address && (
          <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#f8f9ff', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{t('Delivery Address')}</div>
            {order.delivery_address.label && (
              <div style={{ marginBottom: 6, fontSize: 14, color: '#333' }}>{order.delivery_address.label}</div>
            )}
            <div style={{ marginBottom: 4 }}>
              {order.delivery_address.recipient_name || t('Unknown recipient')}
              {order.delivery_address.recipient_phone ? ` · ${order.delivery_address.recipient_phone}` : ''}
            </div>
            <div>{order.delivery_address.address || t('Address not available')}</div>
            {(order.delivery_address.city || order.delivery_address.state || order.delivery_address.postal_code) && (
              <div style={{ color: '#555', marginTop: 4 }}>
                {order.delivery_address.city ? `${order.delivery_address.city}` : ''}
                {order.delivery_address.state ? ` ${order.delivery_address.state}` : ''}
                {order.delivery_address.postal_code ? ` ${order.delivery_address.postal_code}` : ''}
              </div>
            )}
          </div>
        )}
        <div className="btn-row">
          <button className="btn secondary" onClick={() => nav('/orders')}>{t('Go to Orders')}</button>
          {isCheckup ? (
            <button className="btn" onClick={() => nav(`/espectacles/checkup/${order.id}`)}>{t('Show QR')}</button>
          ) : (
            <button className="btn" onClick={() => nav('/')}>{t('Home')}</button>
          )}
        </div>
      </div>
    );
  }

  const activeMethod = METHODS.find(m => m.key === method);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <button
          className="btn secondary"
          style={{ width: 'auto', padding: '8px 14px', fontSize: '1.5em' }}
          onClick={() => nav(-1)}
        >
          ← {t('Back')}
        </button>
        <h1 className="h1" style={{ margin: 0 }}>{t('Payment')}</h1>
        <div style={{ width: 70 }} />
      </div>
      <div className="card">
        <div className="muted">{t('Order')} {order.order_code}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(order.total)}</div>
      </div>
      <div className="card">
        <strong style={{ fontSize: 17 }}>{t('Payment method')}</strong>
        {METHODS.map(m => (
          <label
            key={m.key}
            className="field"
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 0, fontSize: 16 }}
          >
            <input
              type="radio"
              style={{ width: 'auto' }}
              checked={method === m.key}
              onChange={() => {
                setMethod(m.key);
                setErr('');
              }}
            />
            {t(m.label)}
          </label>
        ))}
      </div>
      {addressErr && <div className="error" style={{ marginBottom: 12 }}>{addressErr}</div>}
      {loadingAddresses ? (
        <div className="card muted" style={{ marginTop: 12 }}>{t('Loading addresses...')}</div>
      ) : (
        <div className="card">
          <DeliveryAddressSelector
            addresses={deliveryAddresses}
            selectedId={selectedAddressId}
            onSelect={handleSelectAddress}
            onAddressAdded={handleAddressAdded}
            onAddressUpdated={handleAddressUpdated}
            title={t('Delivery Address')}
          />
        </div>
      )}
      <div style={{ height: 8 }} />
      <div className="card">
        <strong>{t(activeMethod.label)} {t('details')}</strong>
        <div style={{ marginTop: 10 }}>
          <MethodForm
            method={method}
            value={form}
            onChange={(v) => setForms(prev => ({ ...prev, [method]: v }))}
            onInvalidCard={() => setCardWarn(true)}
          />
        </div>
      </div>
      {err && <div className="error" style={{ marginBottom: 8 }}>{err}</div>}
      <button
        className="btn"
        style={{
          fontSize: 19,
          opacity: canPay ? 1 : 0.5,
          cursor: canPay ? 'pointer' : 'not-allowed',
        }}
        disabled={!canPay}
        onClick={pay}
      >
        {busy ? t('Processing…') : t('Pay Now', { amount: fmt(order.total) })}
      </button>

      {cardWarn && (
        <div className="modal-backdrop" onClick={() => setCardWarn(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <button
              className="modal-close"
              aria-label="Close"
              onClick={() => setCardWarn(false)}
            >
              ×
            </button>
            <div style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 8px', color: 'var(--danger)' }}>{t('Invalid card number')}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {t('The card number you entered is not valid. Please check the digits and try again.')}
              </p>
              <button className="btn" onClick={() => setCardWarn(false)}>{t('Close')}</button>
            </div>
          </div>
        </div>
      )}
      {paynow && (
        <div className="modal-backdrop" onClick={() => setPaynow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <button className="modal-close" aria-label="Close" onClick={() => setPaynow(null)}>×</button>
            <div style={{ padding: 20, textAlign: 'center' }}>
              <h3 style={{ marginTop: 0 }}>{t('PayNow')}</h3>
              <div style={{ margin: '12px 0' }}>
                <div style={{ display: 'inline-block', background: '#fff', padding: 12, borderRadius: 8 }}>
                  <QRImage value={paynow.qr} size={220} />
                </div>
              </div>
              <div className="muted" style={{ marginBottom: 12 }}>{t('An extra payment of {{amount}} is required. You\'ll be taken to the payment page after confirming.', { amount: fmt(order.total) })}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn secondary" style={{ fontSize: 17 }} onClick={() => setPaynow(null)}>{t('Close')}</button>
                <button className="btn" style={{ fontSize: 17 }} onClick={async () => {
                  try {
                    setBusy(true);
                    await api(`/api/payments/${paynow.payment_id}/confirm`, { method: 'POST' });
                    const d = await api(`/api/orders/${id}`);
                    setOrder(d.order); setDone(true); reset(); setPaynow(null);
                  } catch (e) { setErr('Confirm failed: ' + e.message); }
                  finally { setBusy(false); }
                }}>{t('I Have Paid') || 'I Have Paid'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
