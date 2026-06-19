import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../state/AuthContext.jsx';
import { PUBLIC_ROLES, ROLE_LABELS } from '../roles';
import PhoneInput, { DEFAULT_CODE } from '../components/PhoneInput.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import AdminVendorCreate from './admin/AdminVendorCreate.jsx';

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

  const isVendor = role !== 'consumer';

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
      setPickingRole(false);
          if (r.devCode) setHint(t('Dev OTP: {{code}}', { code: r.devCode }));
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
      <PhoneInput label={t('Mobile (with country code)')} value={mobile} onChange={setMobile} />
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
        <label className="field">
          {t('OTP code')}
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('6-digit code')} inputMode="numeric" />
        </label>
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
            <button className="btn secondary" onClick={() => send('register')} disabled={busy || !mobile || !vendorFieldsComplete}>
              {t('Send OTP To Register')} {t('Send OTP To Register as')} {t(ROLE_LABELS[role])}
            </button>
          </div>
        ) : (
          <div className="btn-row">
            <button className="btn" onClick={() => send('login')} disabled={busy || !mobile}>
              {t('Send OTP To Login')}
            </button>
            <button className="btn secondary" onClick={() => { setErr(''); setHint(''); setPickingRole(true); }} disabled={busy || !mobile}>
              {t('Send OTP To Register')}
            </button>
          </div>
        )
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn" style={{ width: '50%', margin: '0 auto' }} onClick={verify} disabled={busy || code.length < 4}>
            {intent === 'register' ? t('Verify & Register') : t('Verify & Sign in')}
          </button>
          <button className="btn secondary" style={{ width: '50%', margin: '0 auto' }} onClick={() => { setSent(false); setCode(''); setHint(''); setErr(''); }}>
            {t('Not Me, Change the Number')}
          </button>
        </div>
      )}
    </div>
  );
}

export default Login;
