import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { VENDOR_ROLES } from '../roles.js';
import AdminVendorCreate from './admin/AdminVendorCreate.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import { useTranslation } from 'react-i18next';

export default function Me() {
  const { user, updateProfile } = useAuth();
  const [nickname, setNickname] = useState(user.nickname || '');
  const [realName, setRealName] = useState(user.real_name || '');
  const [mobile, setMobile] = useState(user.mobile || '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const isVendorOwner = VENDOR_ROLES.includes(user.role);

  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'en';

  const save = async () => {
    setErr('');
    try {
      await updateProfile({ nickname, real_name: realName, mobile });
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
    setErr('');
    setMsg('');
  };

  const isDirty =
    nickname !== (user.nickname || '') ||
    realName !== (user.real_name || '') ||
    mobile !== (user.mobile || '');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="h1">{t('Me')}</h1>
        <div>
          <select value={lang} onChange={e => { const v = e.target.value; i18n.changeLanguage(v); localStorage.setItem('lang', v); }} style={{ padding: '6px 8px' }} aria-label="Language selector">
            <option value="en">English</option>
            <option value="zh">中 文</option>
          </select>
        </div>
      </div>
      <div className="card">
        <div>{t('User ID')}: <strong>{user.user_code}</strong></div>
        <div>{t('Role')}: {user.role}</div>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn secondary" onClick={cancel} disabled={!isDirty}>{t('Form.Reset')}</button>
              <button className="btn" onClick={save} disabled={!isDirty}>{t('Save')}</button>
            </div>
            {msg && <div className="muted" style={{ marginTop: 8 }}>{t('Saved')}</div>}
            {err && <div style={{ color: 'var(--danger)', marginTop: 8 }}>{t(err)}</div>}
          </div>
        </>
      )}
    </div>
  );
}
