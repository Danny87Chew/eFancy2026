import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../state/AuthContext.jsx';

const initialForm = { name: '', code: '', brand: '', base_price: '', promotion_price: '', images: '', vendor_name: '', vendor_office: '', vendor_mobile: '', vendor_address: '' };

function getVendorDefaults(user, vendorContext) {
  const defaults = { vendor_name: '', vendor_office: '', vendor_mobile: '', vendor_address: '' };
  if (!user && !vendorContext) return defaults;

  const fromUser = {
    vendor_name: user?.vendor_name || user?.merchant_name || '',
    vendor_office: user?.vendor_office || user?.office_number || user?.contact_number || '',
    vendor_mobile: user?.vendor_mobile || user?.mobile_number || user?.mobile || '',
    vendor_address: user?.vendor_address || user?.address || '',
  };

  const fromContext = {
    vendor_name: vendorContext?.merchant_name || '',
    vendor_office: vendorContext?.office_number || vendorContext?.contact_number || '',
    vendor_mobile: vendorContext?.mobile_number || '',
    vendor_address: vendorContext?.address || '',
  };

  return {
    vendor_name: fromUser.vendor_name || fromContext.vendor_name,
    vendor_office: fromUser.vendor_office || fromContext.vendor_office,
    vendor_mobile: fromUser.vendor_mobile || fromContext.vendor_mobile,
    vendor_address: fromUser.vendor_address || fromContext.vendor_address,
  };
}

export default function VendorFrames() {
  const { t } = useTranslation();
  const { user, vendorContext } = useAuth();
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialForm, ...getVendorDefaults(user, vendorContext) });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ...initialForm, ...getVendorDefaults(user, vendorContext) });
  const [error, setError] = useState('');

  const loadFrames = async () => {
    setLoading(true);
    try {
      const data = await api('/api/frames/my');
      setFrames(data.frames || []);
    } catch (e) {
      console.error(e);
      setFrames([]);
    } finally {
      setLoading(false);
    }
  };

  const startEditFrame = (frame) => {
    setEditingId(frame.id);
    setEditForm({
      ...initialForm,
      ...getVendorDefaults(user, vendorContext),
      name: frame.name || '',
      code: frame.code || '',
      brand: frame.brand || '',
      base_price: String(frame.base_price || ''),
      promotion_price: String(frame.promotion_price || ''),
      images: (frame.images || []).map((i) => i.url).join('\n'),
    });
    setError('');
  };

  const cancelEditFrame = () => {
    setEditingId(null);
    setEditForm({ ...initialForm, ...getVendorDefaults(user, vendorContext) });
    setError('');
  };

  const saveEditFrame = async () => {
    if (!editingId || !editForm.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api(`/api/frames/${editingId}`, {
        method: 'PATCH',
        body: {
          name: editForm.name.trim(),
          code: editForm.code.trim() || undefined,
          brand: editForm.brand.trim() || undefined,
          base_price: Number(editForm.base_price) || 0,
          promotion_price: Number(editForm.promotion_price) || 0,
          images: editForm.images.split('\n').map((line) => line.trim()).filter(Boolean),
        },
      });
      cancelEditFrame();
      await loadFrames();
    } catch (e) {
      setError(e?.data?.error || 'request_failed');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadFrames();
  }, [user?.id, user?.role, vendorContext?.id, vendorContext?.role]);

  useEffect(() => {
    if (!user && !vendorContext) return;
    setForm((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.entries(getVendorDefaults(user, vendorContext)).map(([key, value]) => [key, prev[key] || value])),
    }));
  }, [user, vendorContext]);

  const createFrame = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api('/api/frames', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          brand: form.brand.trim() || undefined,
          base_price: Number(form.base_price) || 0,
          promotion_price: Number(form.promotion_price) || 0,
          images: form.images.split('\n').map((line) => line.trim()).filter(Boolean),
        },
      });
      setForm({ ...initialForm, ...getVendorDefaults(user, vendorContext) });
      setShowForm(false);
      await loadFrames();
    } catch (e) {
      setError(e?.data?.error || 'request_failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="h1">{t('Available Frame(s)')}</h1>
      <div style={{ marginTop: 12, marginBottom: 20 }}>
        <button className="btn" onClick={() => setShowForm((prev) => !prev)} disabled={saving || editingId !== null}>
          {showForm ? t('Close') : t('Add Frame')}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <label className="field">{t('Brand')}<input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></label>
          <label className="field">{t('Frame Name')}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">{t('Frame Code')}<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <div className="row" style={{ gap: 12 }}>
            <label className="field" style={{ flex: 1 }}>{t('Base price (S$)')}<input type="number" min="0" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} /></label>
            <label className="field" style={{ flex: 1 }}>{t('Promotion price (S$)')}<input type="number" min="0" step="0.01" value={form.promotion_price} onChange={(e) => setForm({ ...form, promotion_price: e.target.value })} /></label>
          </div>
          <label className="field" style={{ opacity: 0.7 }}>{t('Vendor name')}<input value={form.vendor_name} disabled /></label>
          <div className="row" style={{ gap: 12 }}>
            <label className="field" style={{ flex: 1, opacity: 0.7 }}>{t('Vendor office number')}<input value={form.vendor_office} disabled /></label>
            <label className="field" style={{ flex: 1, opacity: 0.7 }}>{t('Vendor mobile number')}<input value={form.vendor_mobile} disabled /></label>
          </div>
          <label className="field" style={{ opacity: 0.7 }}>{t('Vendor address')}<textarea rows="2" value={form.vendor_address} disabled /></label>
          <label className="field">{t('Image URLs (one per line)')}<textarea rows="3" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} /></label>
          {error && <div className="error" style={{ marginBottom: 12 }}>{t(error)}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={() => { setShowForm(false); setForm(initialForm); }}>{t('Form.Cancel')}</button>
            <button className="btn" onClick={createFrame} disabled={saving}>{saving ? t('Saving…') : t('Add Frame')}</button>
          </div>
        </div>
      )}

      {editingId && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>{t('Edit Frame')}</h2>
          <label className="field">{t('Brand')}<input value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} /></label>
          <label className="field">{t('Frame Name')}<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
          <label className="field">{t('Frame Code')}<input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} /></label>
          <div className="row" style={{ gap: 12 }}>
            <label className="field" style={{ flex: 1 }}>{t('Base price (S$)')}<input type="number" min="0" step="0.01" value={editForm.base_price} onChange={(e) => setEditForm({ ...editForm, base_price: e.target.value })} /></label>
            <label className="field" style={{ flex: 1 }}>{t('Promotion price (S$)')}<input type="number" min="0" step="0.01" value={editForm.promotion_price} onChange={(e) => setEditForm({ ...editForm, promotion_price: e.target.value })} /></label>
          </div>
          <label className="field" style={{ opacity: 0.7 }}>{t('Vendor name')}<input value={editForm.vendor_name} disabled /></label>
          <div className="row" style={{ gap: 12 }}>
            <label className="field" style={{ flex: 1, opacity: 0.7 }}>{t('Vendor office number')}<input value={editForm.vendor_office} disabled /></label>
            <label className="field" style={{ flex: 1, opacity: 0.7 }}>{t('Vendor mobile number')}<input value={editForm.vendor_mobile} disabled /></label>
          </div>
          <label className="field" style={{ opacity: 0.7 }}>{t('Vendor address')}<textarea rows="2" value={editForm.vendor_address} disabled /></label>
          <label className="field">{t('Image URLs (one per line)')}<textarea rows="3" value={editForm.images} onChange={(e) => setEditForm({ ...editForm, images: e.target.value })} /></label>
          {error && <div className="error" style={{ marginBottom: 12 }}>{t(error)}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={cancelEditFrame}>{t('Cancel')}</button>
            <button className="btn" onClick={saveEditFrame} disabled={saving}>{saving ? t('Saving…') : t('Save Changes')}</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <div className="card muted">{t('Loading...')}</div>
        ) : frames.length === 0 ? (
          <div className="card muted">{t('No available frame found.')}</div>
        ) : frames.map((frame) => (
          <div key={frame.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <strong>{frame.name}</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                {frame.code ? `${t('Code')}: ${frame.code}` : null}
                {frame.brand ? ` · ${t('Frame Brand')}: ${frame.brand}` : null}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {t('Base price (S$)')}: {frame.base_price || 0} · {t('Promotion price (S$)')}: {frame.promotion_price || 0}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button className="btn secondary" onClick={() => startEditFrame(frame)} disabled={saving || editingId !== null || showForm}>{t('Edit')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
