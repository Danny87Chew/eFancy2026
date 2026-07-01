import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { api } from '../api.js';
import { VENDOR_ROLES, ROLE_LABELS } from '../roles.js';
import AdminVendorCreate from './admin/AdminVendorCreate.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import DeliveryAddressesList from '../components/DeliveryAddressesList.jsx';
import { useTranslation } from 'react-i18next';

export default function Me() {
  const { user, updateProfile } = useAuth();
  const [nickname, setNickname] = useState(user.nickname || '');
  const [realName, setRealName] = useState(user.real_name || '');
  const [mobile, setMobile] = useState(user.mobile || '');
  const [preorderNotificationOptIn, setPreorderNotificationOptIn] = useState(
    user.preorder_notification_opt_in != null ? user.preorder_notification_opt_in === 1 : true
  );
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [deliveryAddresses, setDeliveryAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const isVendorOwner = VENDOR_ROLES.includes(user.role);
  const isConsumer = user.role === 'consumer';

  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'en';

  useEffect(() => {
    if (isConsumer) {
      fetchDeliveryAddresses();
    }
  }, [isConsumer]);

  const fetchDeliveryAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const result = await api('/api/auth/delivery-addresses');
      setDeliveryAddresses(result.addresses || []);
    } catch (e) {
      console.error('Failed to load delivery addresses:', e);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleAddressUpdate = async (newAddress) => {
    // Refresh the address list
    await fetchDeliveryAddresses();
  };

  const handleAddressDelete = async (id) => {
    // Remove from local state
    setDeliveryAddresses(prev => prev.filter(a => a.id !== id));
  };

  const save = async () => {
    setErr('');
    try {
      await updateProfile({
        nickname,
        real_name: realName,
        mobile,
        preorder_notification_opt_in: preorderNotificationOptIn ? 1 : 0,
      });
      setMsg('Saved');
      setTimeout(() => setMsg(''), 1500);
    } catch (e) {
      setErr(e?.data?.error || 'save_failed');
    }
  };

  const cancel = () => {
    setNickname(user.nickname || '');
    setRealName(user.real_name || '');
    setMobile(user.mobile || '');
    setPreorderNotificationOptIn(
      user.preorder_notification_opt_in != null ? user.preorder_notification_opt_in === 1 : true
    );
    setErr('');
    setMsg('');
  };

  const isDirty =
    nickname !== (user.nickname || '') ||
    realName !== (user.real_name || '') ||
    mobile !== (user.mobile || '') ||
    preorderNotificationOptIn !==
      (user.preorder_notification_opt_in != null
        ? user.preorder_notification_opt_in === 1
        : true);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="h1">{t('Me')}</h1>
      </div>
      <div className="card">
        <div>{t('User ID')}: <strong>{user.user_code}</strong></div>
        <div>{t('Role')}: {t(ROLE_LABELS[user.role]) || user.role}</div>
      </div>
      {isVendorOwner ? (
        <AdminVendorCreate selfMode />
      ) : (
        <>
          <div className="card">
            <label className="field">{t('Nickname')}<input value={nickname} onChange={e => setNickname(e.target.value)} /></label>
            <label className="field">{t('Real name')}<input value={realName} onChange={e => setRealName(e.target.value)} /></label>
            <div className="field">
              <div className="label">{t('Mobile')}</div>
              <PhoneInput value={mobile} onChange={setMobile} />
            </div>
            <div className="field">
              <div className="label" style={{ whiteSpace: 'nowrap', fontWeight: '700' }}>
                {t('Receive fresh goods pre-order notifications')}
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <input
                    type="radio"
                    name="preorder_notification_opt_in"
                    value="1"
                    checked={preorderNotificationOptIn}
                    onChange={() => setPreorderNotificationOptIn(true)}
                  />
                  {t('Yes')}
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <input
                    type="radio"
                    name="preorder_notification_opt_in"
                    value="0"
                    checked={!preorderNotificationOptIn}
                    onChange={() => setPreorderNotificationOptIn(false)}
                  />
                  {t('No')}
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn secondary" onClick={cancel} disabled={!isDirty}>{t('Form.Reset')}</button>
              <button className="btn" onClick={save} disabled={!isDirty}>{t('Save')}</button>
            </div>
            {msg && <div className="muted" style={{ marginTop: 8 }}>{t('Saved')}</div>}
            {err && <div style={{ color: 'var(--danger)', marginTop: 8 }}>{t(err)}</div>}
          </div>

          {isConsumer && (
            <div>
              <h2 className="h2" style={{ marginTop: 24 }}>{t('Delivery Addresses')}</h2>
              {loadingAddresses ? (
                <div className="card muted">{t('Loading...')}</div>
              ) : (
                <DeliveryAddressesList
                  addresses={deliveryAddresses}
                  onUpdate={handleAddressUpdate}
                  onDelete={handleAddressDelete}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
