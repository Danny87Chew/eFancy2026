import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../state/AuthContext.jsx';

const initialForm = { brand: '', name: '', code: '', price_multiplier: '1.0', base_price: '', promotion_price: '', images: '', vendor_name: '', vendor_office: '', vendor_mobile: '', vendor_address: '' };

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

export default function VendorLenses() {
  const { t } = useTranslation();
  const { user, vendorContext } = useAuth();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialForm, ...getVendorDefaults(user, vendorContext) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadBrands = async () => {
    setLoading(true);
    try {
      const data = await api('/api/lens-brands/my');
      setBrands(data.brands || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    if (!user && !vendorContext) return;
    setForm((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.entries(getVendorDefaults(user, vendorContext)).map(([key, value]) => [key, prev[key] || value])),
    }));
  }, [user, vendorContext]);

  const createBrand = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api('/api/lens-brands', {
        method: 'POST',
        body: {
          brand: form.brand.trim() || undefined,
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          price_multiplier: Number(form.price_multiplier) || 1,
          base_price: Number(form.base_price) || 0,
          promotion_price: Number(form.promotion_price) || 0,
          images: form.images.split('\n').map((line) => line.trim()).filter(Boolean),
          vendor_name: form.vendor_name.trim() || undefined,
          vendor_office: form.vendor_office.trim() || undefined,
          vendor_mobile: form.vendor_mobile.trim() || undefined,
          vendor_address: form.vendor_address.trim() || undefined,
        },
      });
      setForm({ ...initialForm, ...getVendorDefaults(user, vendorContext) });
      setShowForm(false);
      await loadBrands();
    } catch (e) {
      setError(e?.data?.error || 'request_failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="h1">{t('Available Lens')}</h1>
      <div style={{ marginTop: 12, marginBottom: 20 }}>
        <button className="btn" onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? t('Close') : t('Add Len')}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <label className="field">{t('Brand')}<input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></label>
          <label className="field">{t('Lens Name')}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">{t('Lens Code')}<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="field">{t('Price multiplier')}<input type="number" min="0.1" step="0.01" value={form.price_multiplier} onChange={(e) => setForm({ ...form, price_multiplier: e.target.value })} /></label>
          <div className="row" style={{ gap: 12 }}>
            <label className="field" style={{ flex: 1 }}>{t('Base price (S$)')}<input type="number" min="0" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} /></label>
            <label className="field" style={{ flex: 1 }}>{t('Promotion price (S$)')}<input type="number" min="0" step="0.01" value={form.promotion_price} onChange={(e) => setForm({ ...form, promotion_price: e.target.value })} /></label>
          </div>
          <label className="field">{t('Image URLs (one per line)')}<textarea rows="3" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} /></label>
          <label className="field">{t('Vendor name')}<input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label className="field" style={{ flex: 1 }}>{t('Vendor office number')}<input value={form.vendor_office} onChange={(e) => setForm({ ...form, vendor_office: e.target.value })} /></label>
            <label className="field" style={{ flex: 1 }}>{t('Vendor mobile number')}<input value={form.vendor_mobile} onChange={(e) => setForm({ ...form, vendor_mobile: e.target.value })} /></label>
          </div>
          <label className="field">{t('Vendor address')}<textarea rows="2" value={form.vendor_address} onChange={(e) => setForm({ ...form, vendor_address: e.target.value })} /></label>
          {error && <div className="error" style={{ marginBottom: 12 }}>{t(error)}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={() => { setShowForm(false); setForm(initialForm); }}>{t('Form.Cancel')}</button>
            <button className="btn" onClick={createBrand} disabled={saving}>{saving ? t('Saving…') : t('Add Len')}</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <div className="card muted">{t('Loading...')}</div>
        ) : brands.length === 0 ? (
          <div className="card muted">{t('No available len found.')}</div>
        ) : brands.map((brand) => (
          <div key={brand.id} className="card">
            <strong>{brand.brand || brand.name}</strong>
            <div className="muted" style={{ marginTop: 4 }}>
              {brand.name && brand.name !== brand.brand ? `${t('Name')}: ${brand.name}` : null}
              {brand.code ? ` · ${t('Lens Code')}: ${brand.code}` : null}
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              {t('Price multiplier')}: ×{brand.price_multiplier || 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
