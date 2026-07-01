import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import jsQR from 'jsqr';
import { api } from '../../api';
import PhoneInput, { COUNTRY_CODES } from '../../components/PhoneInput.jsx';
import { useAuth } from '../../state/AuthContext.jsx';
import VendorStaffsTab from '../../components/VendorStaffsTab.jsx';

// ── Eyesight checkup tab ──────────────────────────────────────────────────────

const EYE_FIELDS = [
  { key: 'l_sph',  label: 'L SPH'  },
  { key: 'l_cyl',  label: 'L CYL'  },
  { key: 'l_axis', label: 'L AXIS' },
  { key: 'l_add',  label: 'L ADD'  },
  { key: 'r_sph',  label: 'R SPH'  },
  { key: 'r_cyl',  label: 'R CYL'  },
  { key: 'r_axis', label: 'R AXIS' },
  { key: 'r_add',  label: 'R ADD'  },
];
const EMPTY_EYESIGHT = {
  l_sph: '', l_cyl: '', l_axis: '', l_add: '',
  r_sph: '', r_cyl: '', r_axis: '', r_add: '', pd: '',
};

function CheckupTab() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('scan'); // 'scan' | 'manual'
  const [manualToken, setManualToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [order, setOrder] = useState(null);
  const [eyesight, setEyesight] = useState(EMPTY_EYESIGHT);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setScanning(true);
    } catch {
      setError('Camera access denied. Please use manual entry.');
      setMode('manual');
    }
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const tick = () => {
      const v = videoRef.current; const c = canvasRef.current;
      if (!v || !c || v.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }
      const ctx = c.getContext('2d');
      c.width = v.videoWidth; c.height = v.videoHeight;
      ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const result = jsQR(img.data, img.width, img.height);
      if (result?.data) { stopCamera(); lookupToken(result.data.trim()); }
      else rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [scanning, stopCamera]);

  useEffect(() => { if (mode !== 'scan') stopCamera(); }, [mode, stopCamera]);
  useEffect(() => () => stopCamera(), [stopCamera]);

  const lookupToken = async (token) => {
    setError(''); setOrder(null); setEyesight(EMPTY_EYESIGHT); setDone(false);
    try {
      const d = await api(`/api/vendor/checkup/qr/${encodeURIComponent(token)}`);
      setOrder(d.order);
    } catch (e) {
      const msg = e?.data?.error || '';
      setError(
        msg === 'not_found'         ? 'No checkup order found for this QR code.' :
        msg === 'order_cancelled'   ? 'This order has been cancelled.' :
        msg === 'already_completed' ? 'Eyesight data already uploaded for this order.' :
        'Order not found. Please check the code and try again.'
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pd = parseFloat(eyesight.pd);
    if (isNaN(pd)) { setError('PD is required and must be a number.'); return; }
    const payload = {
      pd,
      l_sph:  eyesight.l_sph  !== '' ? parseFloat(eyesight.l_sph)  : null,
      l_cyl:  eyesight.l_cyl  !== '' ? parseFloat(eyesight.l_cyl)  : null,
      l_axis: eyesight.l_axis !== '' ? parseFloat(eyesight.l_axis) : null,
      l_add:  eyesight.l_add  !== '' ? parseFloat(eyesight.l_add)  : null,
      r_sph:  eyesight.r_sph  !== '' ? parseFloat(eyesight.r_sph)  : null,
      r_cyl:  eyesight.r_cyl  !== '' ? parseFloat(eyesight.r_cyl)  : null,
      r_axis: eyesight.r_axis !== '' ? parseFloat(eyesight.r_axis) : null,
      r_add:  eyesight.r_add  !== '' ? parseFloat(eyesight.r_add)  : null,
    };
    setError(''); setSubmitting(true);
    try {
      await api(`/api/vendor/checkup/${order.id}/upload`, { method: 'POST', body: payload });
      setDone(true); setOrder(null); setManualToken('');
    } catch (e) {
      setError(e?.data?.error || 'Upload failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  const reset = () => { setOrder(null); setEyesight(EMPTY_EYESIGHT); setDone(false); setError(''); setManualToken(''); stopCamera(); };

    if (done) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h2 style={{ margin: '12px 0 8px' }}>{t('Data Uploaded!')}</h2>
        <p className="muted">{t("Eyesight data saved. Customer's order is now Finalised.")}</p>
        <button className="btn" onClick={reset}>{t('Scan Next Order')}</button>
      </div>
    );
  }

  return (
    <>
      {!order && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className={`btn${mode === 'scan' ? '' : ' secondary'}`} style={{ flex: 1 }} onClick={() => setMode('scan')}>{t('📷 Scan QR')}</button>
            <button className={`btn${mode === 'manual' ? '' : ' secondary'}`} style={{ flex: 1 }} onClick={() => setMode('manual')}>{t('⌨️ Enter Code')}</button>
          </div>

          {mode === 'scan' && (
            <div className="card">
              {!scanning ? (
                <>
                  <button className="btn" onClick={startCamera}>{t('Start Camera')}</button>
                  <p className="muted" style={{ marginTop: 8 }}>{t('Allow camera access, then point at the customer\'s QR code.')}</p>
                </>
              ) : (
                <>
                  <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                    <video ref={videoRef} style={{ width: '100%', display: 'block', maxHeight: 300 }} playsInline muted />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <div style={{ width: 180, height: 180, border: '3px solid rgba(255,255,255,0.85)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
                    </div>
                  </div>
                  <p className="muted" style={{ marginTop: 8, textAlign: 'center' }}>{t('Point camera at QR code…')}</p>
                  <button className="btn secondary" onClick={stopCamera}>{t('Form.Cancel')}</button>
                </>
              )}
            </div>
          )}

          {mode === 'manual' && (
            <div className="card">
              <form onSubmit={e => { e.preventDefault(); if (manualToken.trim()) lookupToken(manualToken.trim()); }}>
                <label className="label">{t('QR Code Text')}</label>
                <input className="input" value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder={t('Paste or type the QR code text')} autoFocus />
                <button className="btn" type="submit" disabled={!manualToken.trim()} style={{ marginTop: 12 }}>{t('Look Up Order')}</button>
              </form>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="card" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', marginBottom: 8 }}>
          <div>{t(error) || error}</div>
          <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setError('')}>{t('Try Again')}</button>
        </div>
      )}

      {order && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{order.order_code}</strong>
                <div className="muted" style={{ marginTop: 4 }}>{((typeof window !== 'undefined' && window.localStorage && (localStorage.getItem('lang') || (navigator && navigator.language))) || 'en').startsWith('zh') ? (order.meta?.shop_name_zh || order.meta?.shop_name) : (order.meta?.shop_name || t('Checkup Order'))}</div>
              </div>
              <button className="btn secondary" style={{ width: 'auto', padding: '6px 12px' }} onClick={reset}>✕ {t('Form.Cancel')}</button>
            </div>
          </div>
          {order.delivery_address && (
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{t('Delivery Address')}</div>
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
          <form onSubmit={handleSubmit}>
            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>{t('Enter Eyesight Data')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {EYE_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="label" style={{ marginBottom: 4 }}>{label}</label>
                    <input className="input" type="number" step="0.25" value={eyesight[key]}
                      onChange={e => setEyesight(prev => ({ ...prev, [key]: e.target.value }))} placeholder="0.00" />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <label className="label">{t('PD (Pupillary Distance) *')}</label>
                <input className="input" type="number" step="0.5" min="50" max="80" value={eyesight.pd}
                  onChange={e => setEyesight(prev => ({ ...prev, pd: e.target.value }))} placeholder={t('e.g. 64')} required />
              </div>
            </div>
            {error && <div style={{ color: '#dc2626', marginBottom: 8 }}>{t(error) || error}</div>}
            <button className="btn" type="submit" disabled={submitting || !eyesight.pd}>
              {submitting ? t('Saving…') : t('Submit Eyesight Data')}
            </button>
          </form>
        </>
      )}
    </>
  );
}

// ── Staff management tab ──────────────────────────────────────────────────────

function isValidMobile(mobile) {
  return COUNTRY_CODES.some(c => c.pattern.test(mobile.replace(c.code, '')));
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VendorCheckup() {
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState('checkup'); // 'checkup' | 'staffs'
  const { user, vendorContext } = useAuth();
  const isOwner = user?.role === 'spectacle_checkup_vendor';
  const canManageStaff = isOwner || vendorContext?.is_staff_admin;
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error };
    }
    componentDidCatch(error, info) {
      console.error('VendorCheckup error:', error, info);
    }
    render() {
      const tt = (this.props && this.props.t) ? this.props.t : (s => s);
      if (this.state.error) {
        return (
          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>{tt('Error')}</h2>
            <div style={{ color: '#dc2626' }}>{tt('An unexpected error occurred. Check console for details.')}</div>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{String(this.state.error)}</pre>
          </div>
        );
      }
      return this.props.children;
    }
  }

  return (
    <ErrorBoundary t={t}>
      <div>
        <h1 className="h1">{t('Eyesight Checkup') || 'Eyesight Checkup'}</h1>

        {canManageStaff && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
            {[['checkup', '👁️ Eyesight Checkup'], ['staffs', '👥 Staff Management']].map(([key, labelKey]) => (
              <button key={key}
                onClick={() => setMainTab(key)}
                style={{
                  flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                  fontWeight: mainTab === key ? 700 : 400,
                  color: mainTab === key ? 'var(--primary)' : 'var(--muted)',
                  borderBottom: mainTab === key ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -2,
                }}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        )}

        {mainTab === 'checkup' && <CheckupTab />}
        {mainTab === 'staffs' && canManageStaff && <VendorStaffsTab />}

        <div className="spacer" />
      </div>
    </ErrorBoundary>
  );
}

