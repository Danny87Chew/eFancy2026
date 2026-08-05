import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../state/AuthContext.jsx';
import { api } from '../api';
import { PUBLIC_ROLES, ROLE_LABELS } from '../roles';
import PhoneInput, { DEFAULT_CODE } from '../components/PhoneInput.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import AdminVendorCreate from './admin/AdminVendorCreate.jsx';
import DeliveryAddressForm from '../components/DeliveryAddressForm.jsx';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun/PBH'];

function createEmptyHours() {
  return Object.fromEntries(WEEK_DAYS.map((d) => [d, { open: '', close: '' }]));
}

function toOpeningTimeText(hours) {
  return WEEK_DAYS
    .map((day) => {
      const slot = hours[day] || {};
      const open = String(slot.open || '').trim();
      const close = String(slot.close || '').trim();
      if (!open || !close) return `${day} Closed`;
      return `${day} ${open}-${close}`;
    })
    .join('; ');
}

function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { requestOtp, verifyOtp } = useAuth();

  const { t } = useTranslation();
  const [mobile, setMobile] = useState(DEFAULT_CODE);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpCycle, setOtpCycle] = useState(0);
  const [intent, setIntent] = useState('login');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickingRole, setPickingRole] = useState(false);
  const [role, setRole] = useState('consumer');
  const [vendorInfo, setVendorInfo] = useState({
    merchant_name: '',
    address: '',
    building_name: '',
    floor_number: '',
    unit_number: '',
    post_code: '',
    contact_number: '',
    business_hours: '',
    business_licence: '',
    staff_mobiles: [],
  });
  
  const [vendorHours, setVendorHours] = useState(createEmptyHours());
  const [vendorAllDays, setVendorAllDays] = useState(false);
  const [postcodeLookup, setPostcodeLookup] = useState({ loading: false, error: '' });
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('');
  const [settingUpAddress, setSettingUpAddress] = useState(false);
  const [addressForSetup, setAddressForSetup] = useState(null);
  const [skipAddress, setSkipAddress] = useState(false);

  const isValidMobile = (m) => {
    if (typeof m !== 'string') return false;
    if (/^\+65[89]\d{7}$/.test(m)) return true;
    if (/^\+60\d{8}$/.test(m)) return true;
    if (/^\+861\d{12}$/.test(m)) return true;
    return /^\+\d{8,16}$/.test(m);
  };
  const mobileValid = isValidMobile(mobile);

  const isVendor = role !== 'consumer';

  function OTPBoxes({ value, onChange }) {
    const inputs = React.useRef([]);

    React.useEffect(() => {
      // keep inputs' values in sync; if fully filled, focus none
    }, [value]);

    const handleChange = (idx, e) => {
      const v = (e.target.value || '').replace(/\D/g, '').slice(0, 1);
      const arr = value.split('').slice(0, 6);
      while (arr.length < 6) arr.push('');
      arr[idx] = v;
      const next = arr.join('').replace(/\s/g, '');
      onChange(next);
      if (v && idx < 5) inputs.current[idx + 1]?.focus();
    };

    const handleKeyDown = (idx, e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        inputs.current[idx - 1]?.focus();
      }
      if (e.key === 'ArrowLeft' && idx > 0) inputs.current[idx - 1]?.focus();
      if (e.key === 'ArrowRight' && idx < 5) inputs.current[idx + 1]?.focus();
    };

    return (
      <div className="otp-row" style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            className="otp-box"
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={(value || '')[i] || ''}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
          />
        ))}
        <button
          type="button"
          className="otp-clear"
          onClick={() => { onChange(''); inputs.current[0]?.focus(); }}
          aria-label="Clear OTP"
        >
          ×
        </button>
      </div>
    );
  }

  useEffect(() => {
    if (!sent) {
      setOtpTimer(0);
      return undefined;
    }

    setOtpTimer(60);
    const id = window.setInterval(() => {
      setOtpTimer((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [sent, otpCycle]);

  useEffect(() => {
    if (isVendor && !sent) {
      setVendorInfo((prev) => ({ ...prev, contact_number: mobile }));
    }

    try {
      const qp = new URLSearchParams(location.search);
      const i = qp.get('intent');
      const r = qp.get('role');
      if (i === 'register' && !sent) {
        setPickingRole(true);
        if (r) setRole(r);
      }
    } catch (e) {
      // ignore
    }
  }, [location.search, mobile, isVendor, sent]);

  // If user clears the mobile (PhoneInput sets it back to a bare country code
  // like "+65"), revert UI to the initial state: hide OTP segment and
  // clear OTP-related fields.
  useEffect(() => {
    const isBareCountryCode = typeof mobile === 'string' && /^\+\d{1,4}$/.test(mobile);
    if (isBareCountryCode && sent) {
      setSent(false);
      setCode('');
      setDevCode('');
      setHint('');
      setErr('');
      setOtpTimer(0);
    }
  }, [mobile, sent]);

  const errorMessage = (msg) => {
    if (msg === 'user_not_found') return 'No account found for this mobile. Please register.';
    if (msg === 'user_already_exists') return 'This mobile is already registered. Please login.';
    if (msg === 'invalid_mobile') return 'Invalid mobile number.';
    if (msg === 'invalid_role') return 'Invalid user type.';
    if (msg && msg.startsWith('missing_')) {
      const f = msg.slice(8).replace(/_/g, ' ');
      return `Please fill in ${f}.`;
    }
    return null;
  };

  const send = async (which) => {
    setErr('');
    setHint('');
    setBusy(true);
    try {
      const info = which === 'register' && isVendor ? { ...vendorInfo, business_hours: toOpeningTimeText(vendorHours) } : undefined;
      const r = await requestOtp(mobile, which, which === 'register' ? role : undefined, info);
      setIntent(which);
      setSent(true);
      setOtpCycle((prev) => prev + 1);
      setPickingRole(false);
      if (r.devCode) {
        setDevCode(r.devCode);
        setHint(t('Dev OTP: {{code}}', { code: r.devCode }));
      } else {
        setDevCode('');
      }
    } catch (e) {
      setErr(errorMessage(e.message) || 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setErr('');
    setBusy(true);
    try {
      const info = intent === 'register' && isVendor ? vendorInfo : undefined;
      const d = await verifyOtp(mobile, code, intent, intent === 'register' ? role : undefined, info);
      const effectiveRole = d.vendor_context?.role || d.user?.role;
      
      // For consumer registration, show address setup step
      if (intent === 'register' && role === 'consumer') {
        setAddressForSetup(d);
        setSettingUpAddress(true);
        setSent(false);
        return;
      }
      
      let dest = '/';
      if (effectiveRole === 'spectacle_producer_vendor') dest = '/vendor/manufacture';
      else if (effectiveRole === 'spectacle_checkup_vendor') dest = '/vendor/checkup';
      nav(dest);
    } catch (e) {
      setErr(errorMessage(e.message) || 'Invalid or expired code');
    } finally {
      setBusy(false);
    }
  };

  const handleAddressSetup = async (addressData) => {
    setErr('');
    setBusy(true);
    try {
      await api('/api/auth/delivery-addresses', {
        method: 'POST',
        body: { ...addressData, is_default: 1 },
      });
      
      // Address saved successfully, redirect to home
      const effectiveRole = addressForSetup.vendor_context?.role || addressForSetup.user?.role;
      let dest = '/';
      if (effectiveRole === 'spectacle_producer_vendor') dest = '/vendor/manufacture';
      else if (effectiveRole === 'spectacle_checkup_vendor') dest = '/vendor/checkup';
      nav(dest);
    } catch (e) {
      setErr(e?.data?.error || e.message || 'Failed to save address');
    } finally {
      setBusy(false);
    }
  };

  const lookupPostcode = async (pc) => {
    const postcode = String(pc || '').trim();
      if (!/^\d{6}$/.test(postcode)) {
        setPostcodeLookup({ loading: false, error: t('Enter a 6-digit Singapore postcode.') });
      return;
    }
    setPostcodeLookup({ loading: true, error: '' });
    try {
      const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postcode)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('lookup_failed');
      const data = await r.json();
      const hit = (data.results || [])[0];
      if (!hit) {
        setPostcodeLookup({ loading: false, error: t('No address found for this postcode.') });
        return;
      }
      const blk = (hit.BLK_NO || '').trim();
      const road = (hit.ROAD_NAME || '').trim();
      const building = (hit.BUILDING && hit.BUILDING !== 'NIL') ? hit.BUILDING.trim() : '';
      const fullAddr = (hit.ADDRESS || [blk, road, building].filter(Boolean).join(' ')).trim();
      setVendorInfo((prev) => ({
        ...prev,
        post_code: postcode,
        address: fullAddr || prev.address,
        building_name: building || prev.building_name,
      }));
      setPostcodeLookup({ loading: false, error: '' });
    } catch (e) {
      setPostcodeLookup({ loading: false, error: t('Postcode lookup failed.') });
    }
  };

  const vendorFieldsComplete = !isVendor || (
    ['merchant_name', 'address', 'post_code', 'contact_number', 'business_licence']
      .every((k) => vendorInfo[k] && vendorInfo[k].trim() !== '')
    && (
      vendorAllDays
        ? Object.values(vendorHours).some(({ open, close }) => open && close)
        : Object.values(vendorHours).some(({ open, close }) => open && close)
    )
  );

  return (
    <div style={{ paddingTop: 24 }}>
      {settingUpAddress ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 className="h1" style={{ margin: 0 }}>{t('Add Your Delivery Address')}</h1>
              <p className="muted" style={{ marginTop: 6 }}>{t('Complete your registration by adding at least one delivery address')}</p>
            </div>
            <div style={{ marginLeft: 12 }}>
              <LanguageSelector />
            </div>
          </div>
          <div className="spacer" />
          <DeliveryAddressForm
            onSubmit={handleAddressSetup}
            onCancel={() => {
              if (skipAddress) {
                nav('/');
              } else {
                setSettingUpAddress(false);
                setSent(true);
                setSkipAddress(false);
              }
            }}
            isLoading={busy}
          />
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              className="btn secondary"
              onClick={() => {
                setSkipAddress(true);
                nav('/');
              }}
              disabled={busy}
            >
              {t('Skip for now')}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 className="h1" style={{ margin: 0 }}>{t('Welcome to eFancy')}</h1>
              <p className="muted" style={{ marginTop: 6 }}>{t('Sign in or register with your mobile number')}</p>
            </div>
            <div style={{ marginLeft: 12 }}>
              <LanguageSelector />
            </div>
          </div>
      <div className="spacer" />
      <div style={{ width: '60%' }}>
        <PhoneInput label={t('Mobile (with country code)')} value={mobile} onChange={setMobile} />
      </div>
      {pickingRole && !sent && (
        <>
          <label className="field">
            {t('I am a…')}
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {PUBLIC_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(ROLE_LABELS[r])}
                    </option>
                  ))}
            </select>
          </label>
          {isVendor && (
            <AdminVendorCreate
              selfMode
              hideActions
              onSelfFormChange={(data) => {
                setVendorInfo((prev) => ({
                  ...prev,
                  merchant_name: data.merchant_name || prev.merchant_name,
                  address: data.address || prev.address,
                  building_name: data.building_name || prev.building_name,
                  floor_number: data.floor_number || prev.floor_number,
                  unit_number: data.unit_number || prev.unit_number,
                  post_code: data.post_code || prev.post_code,
                  contact_number: data.contact_number || prev.contact_number,
                  business_hours: data.business_hours || prev.business_hours,
                  business_licence: data.business_licence || prev.business_licence,
                  staff_mobiles: (data.staff_mobiles && data.staff_mobiles.length) ? data.staff_mobiles : prev.staff_mobiles,
                }));
              }}
            />
          )}
        </>
      )}
      {sent && (
        <>
          {intent === 'register' && (
            <div className="card" style={{ marginBottom: 12, background: '#f0f7ff', borderColor: '#3b82f6' }}>
              <div className="label" style={{ fontSize: 11 }}>{t('User Type Being Registered')}</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 6 }}>{t(ROLE_LABELS[role])}</div>
            </div>
          )}
          <label className="field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>{t('OTP code')}</span>
          </label>
          <div className="otp-entry">
            <div className="otp-input-row">
              <OTPBoxes value={code} onChange={(v) => setCode(v)} />
              <div className="otp-actions">
                <div className="muted otp-timer">{otpTimer > 0 ? `${otpTimer}s` : ''}</div>
                <button
                  type="button"
                  className="btn ghost otp-resend-btn"
                  disabled={otpTimer > 0 || busy}
                  onClick={() => {
                    setCode('');
                    setErr('');
                    setHint('');
                    setDevCode('');
                    send(intent);
                  }}
                >
                  {t('Re-Send OTP')}
                </button>
              </div>
            </div>
          </div>
          {devCode && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setCode(devCode)}
                style={{ display: 'inline-block', padding: '6px 10px', fontSize: 14 }}
              >
                {t('Use OTP')}: {devCode}
              </button>
            </div>
          )}
        </>
      )}
      {hint && <div className="muted">{hint}</div>}
      {err && <div className="error">{err}</div>}
      <div className="spacer" />
      {!sent ? (
        pickingRole ? (
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setPickingRole(false)}>
              {t('Back')}
            </button>
            <button className="btn secondary" onClick={() => send('register')} disabled={busy || !mobileValid || !vendorFieldsComplete}>
              {t('Send OTP To Register')} {t('Send OTP To Register as')} {t(ROLE_LABELS[role])}
            </button>
          </div>
        ) : (
          <>
            <button className="btn" onClick={() => send('login')} disabled={busy || !mobileValid} style={{ marginBottom: 8 }}>
              {t('Send OTP')}
            </button>
            <div className="btn-row">
              <button className="btn" onClick={() => send('login')} disabled={busy || !mobileValid}>
                {t('Send OTP To Login')}
              </button>
              <button className="btn secondary" onClick={() => { setErr(''); setHint(''); setPickingRole(true); }} disabled={busy || !mobileValid}>
                {t('Send OTP To Register')}
              </button>
            </div>
          </>
        )
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn" style={{ width: '50%', margin: '0 auto' }} onClick={verify} disabled={busy || code.length < 6}>
            {intent === 'register' ? t('Verify & Register') : t('Verify & Sign in')}
          </button>
          <button className="btn secondary" style={{ width: '50%', margin: '0 auto' }} onClick={() => { setSent(false); setCode(''); setHint(''); setErr(''); setMobile(DEFAULT_CODE); }}>
            {t('Not Me, Change the Number')}
          </button>
        </div>
      )}
        </div>
      )}
    </div>
  );
}

export default Login;
