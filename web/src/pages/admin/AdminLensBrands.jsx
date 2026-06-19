import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import PhoneInput from '../../components/PhoneInput.jsx';

export default function AdminLensBrands() {
  const { t } = useTranslation();
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState({ name: '', price_multiplier: '1.0', vendor_name: '', vendor_office: '', vendor_mobile: '', vendor_address: '', vendor_road: '', vendor_postcode: '', vendor_building: '', vendor_floor: '', vendor_unit: '', active: 1 });
  const [vendors, setVendors] = useState([]);
  const [vendorSelectedId, setVendorSelectedId] = useState(null);
  const [editActive, setEditActive] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editMultiplier, setEditMultiplier] = useState('');
  const [editInitial, setEditInitial] = useState('');
  const [editVendorSelectedId, setEditVendorSelectedId] = useState(null);
  const [editVendorName, setEditVendorName] = useState('');
  const [editVendorOffice, setEditVendorOffice] = useState('');
  const [editVendorMobile, setEditVendorMobile] = useState('');
  const [editVendorAddress, setEditVendorAddress] = useState('');
  const [editVendorRoad, setEditVendorRoad] = useState('');
  const [editVendorPostcode, setEditVendorPostcode] = useState('');
  const [editVendorBuilding, setEditVendorBuilding] = useState('');
  const [editVendorFloor, setEditVendorFloor] = useState('');
  const [editVendorUnit, setEditVendorUnit] = useState('');
  const [vendorPostcodeLookup, setVendorPostcodeLookup] = useState({ loading: false, error: '' });
  const [savingId, setSavingId] = useState(null);
  const load = () => api('/api/lens-brands').then(d => setBrands(d.brands));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const loadVendors = async () => {
      try {
        const res = await api('/api/admin/users');
        const list = (res.users || [])
          .filter(u => u.role === 'spectacle_lens_vendor')
          .map((u) => ({
            ...u,
            display: (u.vendor_profile && u.vendor_profile.merchant_name) || u.nickname || u.real_name || '',
          }))
          .filter((u) => String(u.display || '').trim());
        setVendors(list);
      } catch (e) { setVendors([]); }
    };
    loadVendors();
  }, []);
  const lookupVendorPostcode = async (pc, target = 'form') => {
    const postcode = String(pc || '').trim();
    if (!/^[0-9]{6}$/.test(postcode)) {
      setVendorPostcodeLookup({ loading: false, error: 'Enter a 6-digit Singapore postcode.' });
      return;
    }
    setVendorPostcodeLookup({ loading: true, error: '' });
    try {
      const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postcode)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('lookup_failed');
      const data = await r.json();
      const hit = (data.results || [])[0];
      if (!hit) {
        setVendorPostcodeLookup({ loading: false, error: 'No address found for this postcode.' });
        return;
      }
      const blk = (hit.BLK_NO || '').trim();
      const road = (hit.ROAD_NAME || '').trim();
      const building = (hit.BUILDING && hit.BUILDING !== 'NIL') ? hit.BUILDING.trim() : '';
      const fullAddr = (hit.ADDRESS || [blk, road, building].filter(Boolean).join(' ')).trim();
      if (target === 'form') {
        setForm((prev) => ({ ...prev, vendor_postcode: postcode, vendor_address: fullAddr || prev.vendor_address, vendor_road: road || prev.vendor_road, vendor_building: building || prev.vendor_building }));
      } else {
        setEditVendorPostcode(postcode);
        setEditVendorAddress((prev) => prev || fullAddr);
        setEditVendorRoad((prev) => prev || road);
        setEditVendorBuilding((prev) => prev || building);
      }
      setVendorPostcodeLookup({ loading: false, error: '' });
    } catch (e) {
      setVendorPostcodeLookup({ loading: false, error: 'Postcode lookup failed.' });
    }
  };
  const create = async () => {
    if (!form.name) return;
    await api('/api/lens-brands', { method: 'POST', body: {
      name: form.name,
      price_multiplier: Number(form.price_multiplier),
      vendor_name: form.vendor_name || undefined,
      vendor_office: form.vendor_office || undefined,
      vendor_mobile: form.vendor_mobile || undefined,
      vendor_address: form.vendor_address || undefined,
      vendor_road: form.vendor_road || undefined,
      vendor_postcode: form.vendor_postcode || undefined,
      vendor_building: form.vendor_building || undefined,
      vendor_floor: form.vendor_floor || undefined,
      vendor_unit: form.vendor_unit || undefined,
      active: form.active != null ? (form.active ? 1 : 0) : 1,
    } });
    setForm({ name: '', price_multiplier: '1.0', vendor_name: '', vendor_office: '', vendor_mobile: '', vendor_address: '', vendor_road: '', vendor_postcode: '', vendor_building: '', vendor_floor: '', vendor_unit: '', active: 1 });
    setShowAddBrand(false);
    load();
  };

  const startEdit = (brand) => {
    setEditingId(brand.id);
    const v = String(brand.price_multiplier ?? '1');
    setEditMultiplier(v);
    setEditInitial(v);
    setEditVendorName(brand.vendor_name || '');
    setEditVendorOffice(brand.vendor_office || '');
    setEditVendorMobile(brand.vendor_mobile || '');
    setEditVendorAddress(brand.vendor_address || '');
    setEditVendorRoad(brand.vendor_road || '');
    setEditVendorPostcode(brand.vendor_postcode || '');
    setEditVendorBuilding(brand.vendor_building || '');
    setEditVendorFloor(brand.vendor_floor || '');
    setEditVendorUnit(brand.vendor_unit || '');
    setEditActive(brand.active != null ? (brand.active ? 1 : 0) : 1);
    const match = vendors.find(v => v.display === (brand.vendor_name || ''));
    if (match) setEditVendorSelectedId(match.id);
    else setEditVendorSelectedId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMultiplier('');
    setEditInitial('');
    setEditVendorName('');
    setEditVendorOffice('');
    setEditVendorMobile('');
    setEditVendorAddress('');
    setEditVendorRoad('');
    setEditVendorPostcode('');
    setEditVendorBuilding('');
    setEditVendorFloor('');
    setEditVendorUnit('');
    setEditActive(1);
    setEditVendorSelectedId(null);
  };

  const saveEdit = async (brandId) => {
    const next = Number(editMultiplier);
    if (!Number.isFinite(next) || next <= 0) return;
    setSavingId(brandId);
    try {
      await api(`/api/lens-brands/${brandId}`, { method: 'PATCH', body: {
        price_multiplier: next,
        vendor_name: editVendorName || undefined,
        vendor_office: editVendorOffice || undefined,
        vendor_mobile: editVendorMobile || undefined,
        vendor_address: editVendorAddress || undefined,
        vendor_road: editVendorRoad || undefined,
        vendor_postcode: editVendorPostcode || undefined,
        vendor_building: editVendorBuilding || undefined,
        vendor_floor: editVendorFloor || undefined,
        vendor_unit: editVendorUnit || undefined,
        active: editActive != null ? (editActive ? 1 : 0) : undefined,
      } });
      cancelEdit();
      load();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button className="btn" style={{ width: '100%' }} onClick={() => setShowAddBrand(s => !s)}>{t('Add lens brand')}</button>
      </div>
      {showAddBrand ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{t('Add lens brand')}</strong>
            <button
              className="btn secondary"
              onClick={() => { setShowAddBrand(false); setForm({ name: '', price_multiplier: '1.0', vendor_name: '', vendor_office: '', vendor_mobile: '', vendor_address: '', vendor_road: '', vendor_postcode: '', vendor_building: '', vendor_floor: '', vendor_unit: '', active: 1 }); }}
              style={{ padding: '6px 8px', width: 180, marginLeft: 'auto' }}
            >{t('Close')}</button>
          </div>
        <label className="field">{t('Available')}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="brand_available" checked={form.active === 1} onChange={() => setForm({ ...form, active: 1 })} /> {t('Yes')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="brand_available" checked={form.active === 0} onChange={() => setForm({ ...form, active: 0 })} /> {t('No')}
              </label>
          </div>
        </label>
        <label className="field">{t('Name')}<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field">{t('Vendor name')}
          <select value={vendorSelectedId || ''} onChange={e => {
            const id = e.target.value || null;
            if (!id) {
              setVendorSelectedId(null);
              setForm(prev => ({ ...prev, vendor_name: '', vendor_office: '', vendor_mobile: '', vendor_address: '', vendor_road: '', vendor_postcode: '', vendor_building: '', vendor_floor: '', vendor_unit: '' }));
              return;
            }
            const sel = vendors.find(v => String(v.id) === String(id));
            if (!sel) return;
            const display = sel.display || '';
            const p = sel.vendor_profile || {};
            setVendorSelectedId(sel.id);
            setForm(prev => ({ ...prev,
              vendor_name: display,
              vendor_office: p.office_number || '',
              vendor_mobile: p.mobile_number || '',
              vendor_address: p.address || '',
              vendor_road: p.road || '',
              vendor_postcode: p.postcode || '',
              vendor_building: p.building || '',
              vendor_floor: p.floor || '',
              vendor_unit: p.unit || '',
            }));
          }}>
            <option value="">— (none) —</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.display}</option>
            ))}
          </select>
        </label>
          <label className="field">{t('Available')}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" name="brand_available" checked={form.active === 1} onChange={() => setForm({ ...form, active: 1 })} /> {t('Yes')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" name="brand_available" checked={form.active === 0} onChange={() => setForm({ ...form, active: 0 })} /> {t('No')}
            </label>
          </div>
        </label>
          <div className="row">
          <PhoneInput allowAnyLeading label={t('Vendor office number')} value={form.vendor_office || ''} onChange={v => setForm({ ...form, vendor_office: v })} />
          <PhoneInput label={t('Vendor mobile number')} value={form.vendor_mobile || ''} onChange={v => setForm({ ...form, vendor_mobile: v })} />
        </div>
        <label className="field">{t('Vendor address')}<textarea rows={2} value={form.vendor_address} onChange={e => setForm({ ...form, vendor_address: e.target.value })} /></label>
        <label className="field">{t('Road Name')}<input value={form.vendor_road || ''} onChange={e => setForm({ ...form, vendor_road: e.target.value })} /></label>
        <label className="field" style={{ marginTop: 8 }}>
          {t('Postcode')}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <input value={form.vendor_postcode || ''} onChange={e => setForm({ ...form, vendor_postcode: e.target.value })} style={{ flex: 1 }} />
            <button
              type="button"
              className="btn secondary"
              style={{ width: 'auto', padding: '6px 10px' }}
              onClick={() => lookupVendorPostcode(form.vendor_postcode, 'form')}
              disabled={vendorPostcodeLookup.loading}
            >
              {vendorPostcodeLookup.loading ? t('Looking…') : t('Lookup')}
            </button>
          </div>
          {vendorPostcodeLookup.error && <div className="muted" style={{ color: '#dc2626', marginTop: 6 }}>{t(vendorPostcodeLookup.error)}</div>}
        </label>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'flex-start' }}>
            <label className="field" style={{ flex: 1, minWidth: 0 }}>
            {t('Building Name:')}
            <input placeholder={t('Building name')} value={form.vendor_building || ''} onChange={e => setForm({ ...form, vendor_building: e.target.value })} />
          </label>
          <label className="field" style={{ width: 60 }}>
            {t('Floor:') || t('Floor') || 'Floor:'}
            <input placeholder={t('Floor')} value={form.vendor_floor || ''} onChange={e => setForm({ ...form, vendor_floor: e.target.value })} style={{ width: '100%' }} />
          </label>
          <label className="field" style={{ width: 110 }}>
            {t('Unit:') || t('Unit') || 'Unit:'}
            <input placeholder={t('Unit number')} value={form.vendor_unit || ''} onChange={e => setForm({ ...form, vendor_unit: e.target.value })} style={{ width: '100%' }} />
          </label>
        </div>
        <label className="field">{t('Price multiplier')}<input value={form.price_multiplier} onChange={e => setForm({ ...form, price_multiplier: e.target.value })} inputMode="decimal" /></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => { setForm({ name: '', price_multiplier: '1.0', vendor_name: '', vendor_office: '', vendor_mobile: '', vendor_address: '', vendor_road: '', vendor_postcode: '', vendor_building: '', vendor_floor: '', vendor_unit: '', active: 1 }); setShowAddBrand(false); }}>{t('Form.Cancel')}</button>
          <button className="btn" onClick={create}>{t('Add brand')}</button>
        </div>
        </div>
      ) : null}
      {brands.map(b => (
        <div key={b.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{b.name}</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="muted">×{b.price_multiplier}</span>
              <div>
                {b.vendor_name ? <div className="muted">{t('Vendor')}: {b.vendor_name}</div> : null}
                {b.vendor_office ? <div className="muted">{t('Office')}: {b.vendor_office}</div> : null}
                {b.vendor_mobile ? <div className="muted">{t('Mobile')}: {b.vendor_mobile}</div> : null}
              </div>
            </div>
          </div>
          {editingId === b.id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Price multiplier
                <input
                  value={editMultiplier}
                  onChange={e => setEditMultiplier(e.target.value)}
                  inputMode="decimal"
                  style={{ width: 100 }}
                />
              </label>
              <button
                className="btn"
                style={{ width: 'auto', padding: '6px 10px' }}
                disabled={savingId === b.id || editMultiplier === editInitial}
                onClick={() => saveEdit(b.id)}
              >
                {savingId === b.id ? t('Saving…') : t('Save')}
              </button>
              <button
                className="btn secondary"
                style={{ width: 'auto', padding: '6px 10px' }}
                disabled={savingId === b.id}
                onClick={cancelEdit}
              >
                {t('Form.Cancel')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn secondary"
                style={{ width: 'auto', padding: '6px 10px' }}
                onClick={() => startEdit(b)}
              >
                {t('Edit')}
              </button>
            </div>
          )}
          {editingId === b.id && (
            <div style={{ marginTop: 8 }}>
              <label className="field">{t('Available')}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="radio" name={`brand_available_edit_${b.id}`} checked={editActive === 1} onChange={() => setEditActive(1)} /> {t('Yes')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="radio" name={`brand_available_edit_${b.id}`} checked={editActive === 0} onChange={() => setEditActive(0)} /> {t('No')}
                  </label>
                </div>
              </label>
              <label className="field">{t('Vendor name')}
                <select value={editVendorSelectedId || ''} onChange={e => {
                  const id = e.target.value || null;
                  if (!id) {
                    setEditVendorSelectedId(null);
                    setEditVendorName(''); setEditVendorOffice(''); setEditVendorMobile(''); setEditVendorAddress(''); setEditVendorRoad(''); setEditVendorPostcode(''); setEditVendorBuilding(''); setEditVendorFloor(''); setEditVendorUnit('');
                    return;
                  }
                  const sel = vendors.find(v => String(v.id) === String(id));
                  if (!sel) return;
                  const display = sel.display || '';
                  const p = sel.vendor_profile || {};
                  setEditVendorSelectedId(sel.id);
                  setEditVendorName(display);
                  setEditVendorOffice(p.office_number || '');
                  setEditVendorMobile(p.mobile_number || '');
                  setEditVendorAddress(p.address || '');
                  setEditVendorRoad(p.road || '');
                  setEditVendorPostcode(p.postcode || '');
                  setEditVendorBuilding(p.building || '');
                  setEditVendorFloor(p.floor || '');
                  setEditVendorUnit(p.unit || '');
                }}>
                  <option value="">— (none) —</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.display}</option>
                  ))}
                </select>
              </label>
              
              <div className="row">
                <PhoneInput allowAnyLeading label={t('Vendor office number')} value={editVendorOffice || ''} onChange={v => setEditVendorOffice(v)} />
                <PhoneInput label={t('Vendor mobile number')} value={editVendorMobile || ''} onChange={v => setEditVendorMobile(v)} />
              </div>
              <label className="field">{t('Vendor address')}<textarea rows={2} value={editVendorAddress} onChange={e => setEditVendorAddress(e.target.value)} /></label>
              <label className="field">{t('Road Name')}<input value={editVendorRoad || ''} onChange={e => setEditVendorRoad(e.target.value)} /></label>
              <label className="field" style={{ marginTop: 8 }}>
                Postcode
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <input value={editVendorPostcode || ''} onChange={e => setEditVendorPostcode(e.target.value)} style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ width: 'auto', padding: '6px 10px' }}
                    onClick={() => lookupVendorPostcode(editVendorPostcode, 'edit')}
                    disabled={vendorPostcodeLookup.loading}
                  >
                    {vendorPostcodeLookup.loading ? 'Looking…' : 'Lookup'}
                  </button>
                </div>
                {vendorPostcodeLookup.error && <div className="muted" style={{ color: '#dc2626', marginTop: 6 }}>{t(vendorPostcodeLookup.error)}</div>}
              </label>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'flex-start' }}>
                <label className="field" style={{ flex: 1, minWidth: 0 }}>
                  {t('Building Name:')}
                  <input placeholder={t('Building name')} value={editVendorBuilding || ''} onChange={e => setEditVendorBuilding(e.target.value)} />
                </label>
                <label className="field" style={{ width: 60 }}>
                  {t('Floor:')}
                  <input placeholder={t('Floor')} value={editVendorFloor || ''} onChange={e => setEditVendorFloor(e.target.value)} style={{ width: '100%' }} />
                </label>
                <label className="field" style={{ width: 110 }}>
                  {t('Unit:')}
                  <input placeholder={t('Unit number')} value={editVendorUnit || ''} onChange={e => setEditVendorUnit(e.target.value)} style={{ width: '100%' }} />
                </label>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
