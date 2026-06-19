import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import PhoneInput from '../../components/PhoneInput.jsx';
import { useCurrency } from '../../state/CurrencyContext.jsx';
import { useTranslation } from 'react-i18next';

const emptyForm = { name: '', brand: '', vendor: '', base_price: '', promotion_price: '', images: '', vendor_office: '', vendor_mobile: '', vendor_address: '', vendor_road: '', vendor_postcode: '', vendor_building: '', vendor_floor: '', vendor_unit: '', active: 1 };

export default function AdminFrames() {
  const { t } = useTranslation();
  const [showAddForm, setShowAddForm] = useState(false);
  const [frames, setFrames] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [vendors, setVendors] = useState([]);
  const [vendorSelectedId, setVendorSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editVendorSelectedId, setEditVendorSelectedId] = useState(null);
  const [editInitial, setEditInitial] = useState(emptyForm);
  const { fmt } = useCurrency();
  const [vendorPostcodeLookup, setVendorPostcodeLookup] = useState({ loading: false, error: '' });

  const load = () => api('/api/frames').then(d => setFrames(d.frames));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const res = await api('/api/admin/users');
        const list = (res.users || [])
          .filter(u => u.role === 'spectacle_frame_vendor')
          .map((u) => ({
            ...u,
            display: (u.vendor_profile && u.vendor_profile.merchant_name) || u.nickname || u.real_name || '',
          }))
          .filter((u) => String(u.display || '').trim());
        setVendors(list);
      } catch (e) {
        setVendors([]);
      }
    };
    loadVendors();
  }, []);

  const create = async () => {
    if (!form.name) return;
    await api('/api/frames', {
      method: 'POST',
      body: {
        name: form.name,
        brand: form.brand,
        vendor: form.vendor,
        base_price: Number(form.base_price) || 0,
        promotion_price: Number(form.promotion_price) || 0,
        vendor_office: form.vendor_office || undefined,
        vendor_mobile: form.vendor_mobile || undefined,
        vendor_address: form.vendor_address || undefined,
        vendor_road: form.vendor_road || undefined,
        vendor_postcode: form.vendor_postcode || undefined,
        vendor_building: form.vendor_building || undefined,
        vendor_floor: form.vendor_floor || undefined,
        vendor_unit: form.vendor_unit || undefined,
        active: form.active != null ? (form.active ? 1 : 0) : 1,
        images: form.images.split('\n').map(s => s.trim()).filter(Boolean),
      },
    });
    setForm(emptyForm);
    setShowAddForm(false);
    load();
  };

  const startEdit = (f) => {
    setEditingId(f.id);
    const next = {
      name: f.name || '',
      brand: f.brand || '',
      vendor: f.vendor || '',
      base_price: String(f.base_price ?? ''),
      promotion_price: String(f.promotion_price ?? ''),
      vendor_office: f.vendor_office || '',
      vendor_mobile: f.vendor_mobile || '',
      vendor_address: f.vendor_address || '',
      vendor_road: f.vendor_road || '',
      vendor_postcode: f.vendor_postcode || '',
      vendor_building: f.vendor_building || '',
      vendor_floor: f.vendor_floor || '',
      vendor_unit: f.vendor_unit || '',
      active: f.active != null ? (f.active ? 1 : 0) : 1,
      images: (f.images || []).map(i => i.url).join('\n'),
    };
    setEditForm(next);
    setEditInitial(next);
    // try to match vendor by name to auto-select
    const match = vendors.find(v => v.display === (f.vendor || ''));
    if (match) {
      setEditVendorSelectedId(match.id);
      const p = match.vendor_profile || {};
      setEditForm(prev => ({ ...prev,
        vendor_office: p.office_number || '',
        vendor_mobile: p.mobile_number || '',
        vendor_address: p.address || '',
        vendor_road: p.road || '',
        vendor_postcode: p.postcode || '',
        vendor_building: p.building || '',
        vendor_floor: p.floor || '',
        vendor_unit: p.unit || '',
      }));
    } else {
      setEditVendorSelectedId(null);
    }
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(emptyForm); setEditInitial(emptyForm); };

  const saveEdit = async (id) => {
    await api('/api/frames/' + id, {
      method: 'PATCH',
      body: {
        name: editForm.name,
        brand: editForm.brand,
        vendor: editForm.vendor,
        base_price: Number(editForm.base_price) || 0,
        promotion_price: Number(editForm.promotion_price) || 0,
        vendor_office: editForm.vendor_office || undefined,
        vendor_mobile: editForm.vendor_mobile || undefined,
        vendor_address: editForm.vendor_address || undefined,
        vendor_road: editForm.vendor_road || undefined,
        vendor_postcode: editForm.vendor_postcode || undefined,
        vendor_building: editForm.vendor_building || undefined,
        vendor_floor: editForm.vendor_floor || undefined,
        vendor_unit: editForm.vendor_unit || undefined,
        active: editForm.active != null ? (editForm.active ? 1 : 0) : undefined,
        images: editForm.images.split('\n').map(s => s.trim()).filter(Boolean),
      },
    });
    cancelEdit();
    load();
  };

  const remove = async (id) => {
    if (!confirm('Deactivate this frame?')) return;
    await api('/api/frames/' + id, { method: 'DELETE' });
    load();
  };

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
        setEditForm((prev) => ({ ...prev, vendor_postcode: postcode, vendor_address: fullAddr || prev.vendor_address, vendor_road: road || prev.vendor_road, vendor_building: building || prev.vendor_building }));
      }
      setVendorPostcodeLookup({ loading: false, error: '' });
    } catch (e) {
      setVendorPostcodeLookup({ loading: false, error: 'Postcode lookup failed.' });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button className="btn" style={{ width: '100%' }} onClick={() => setShowAddForm(s => !s)}>{t('Add frame')}</button>
      </div>
      {showAddForm && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{t('Add frame')}</strong>
            <button
              className="btn secondary"
              onClick={() => { setShowAddForm(false); setForm(emptyForm); }}
              style={{ padding: '6px 8px', width: 180, marginLeft: 'auto' }}
            >{t('Close')}</button>
          </div>
          <label className="field">{t('Available')}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="frame_available" checked={form.active === 1} onChange={() => setForm({ ...form, active: 1 })} /> {t('Yes')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="frame_available" checked={form.active === 0} onChange={() => setForm({ ...form, active: 0 })} /> {t('No')}
              </label>
            </div>
          </label>
        <label className="field">{t('Frame Name')}<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field">{t('Brand')}<input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></label>
        <label className="field">{t('Vendor name')}
          <select value={vendorSelectedId || ''} onChange={e => {
            const id = e.target.value || null;
            if (!id) {
              setVendorSelectedId(null);
              setForm(prev => ({ ...prev, vendor: '', vendor_office: '', vendor_mobile: '', vendor_address: '', vendor_road: '', vendor_postcode: '', vendor_building: '', vendor_floor: '', vendor_unit: '' }));
              return;
            }
            const sel = vendors.find(v => String(v.id) === String(id));
            if (!sel) return;
            const display = sel.display || '';
            const p = sel.vendor_profile || {};
            setVendorSelectedId(sel.id);
            setForm(prev => ({ ...prev,
              vendor: display,
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
            <option value="">— {t('(none)')} —</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.display}</option>
            ))}
          </select>
        </label>
          <div className="row">
          <PhoneInput allowAnyLeading disabled={!!vendorSelectedId} label={t('Vendor office number')} value={form.vendor_office || ''} onChange={v => setForm({ ...form, vendor_office: v })} />
          <PhoneInput disabled={!!vendorSelectedId} label={t('Vendor mobile number')} value={form.vendor_mobile || ''} onChange={v => setForm({ ...form, vendor_mobile: v })} />
        </div>
        <label className="field">{t('Vendor address')}<textarea rows={2} value={form.vendor_address} onChange={e => setForm({ ...form, vendor_address: e.target.value })} disabled={!!vendorSelectedId} /></label>
        <label className="field">{t('Road name')}<input value={form.vendor_road || ''} onChange={e => setForm({ ...form, vendor_road: e.target.value })} disabled={!!vendorSelectedId} /></label>
        <label className="field" style={{ marginTop: 8 }}>
          {t('Postcode')}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <input value={form.vendor_postcode || ''} onChange={e => setForm({ ...form, vendor_postcode: e.target.value })} style={{ flex: 1 }} disabled={!!vendorSelectedId} />
          </div>
        </label>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'flex-start' }}>
              <label className="field" style={{ flex: 1, minWidth: 0 }}>
              {t('Building Name:')}
              <input placeholder={t('Building name')} value={form.vendor_building || ''} onChange={e => setForm({ ...form, vendor_building: e.target.value })} disabled={!!vendorSelectedId} />
          </label>
              <label className="field" style={{ width: 60 }}>
                {t('Floor:') || t('Floor') || 'Floor:'}
              <input placeholder={t('Floor')} value={form.vendor_floor || ''} onChange={e => setForm({ ...form, vendor_floor: e.target.value })} style={{ width: '100%' }} disabled={!!vendorSelectedId} />
          </label>
              <label className="field" style={{ width: 110 }}>
                {t('Unit:') || t('Unit') || 'Unit:'}
              <input placeholder={t('Unit number')} value={form.vendor_unit || ''} onChange={e => setForm({ ...form, vendor_unit: e.target.value })} style={{ width: '100%' }} disabled={!!vendorSelectedId} />
            </label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label className="field" style={{ flex: 1, minWidth: 0 }}>{t('Base price (S$)')}
            <input value={form.base_price} onChange={e => setForm({ ...form, base_price: e.target.value })} inputMode="decimal" />
          </label>
          <label className="field" style={{ width: 180 }}>{t('Promotion price (S$)')}
            <input value={form.promotion_price} onChange={e => setForm({ ...form, promotion_price: e.target.value })} inputMode="decimal" />
          </label>
        </div>
        <label className="field">{t('Image URLs (one per line)')}
          <textarea rows={3} value={form.images} onChange={e => setForm({ ...form, images: e.target.value })} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => { setForm(emptyForm); setShowAddForm(false); }}>{t('Form.Cancel')}</button>
          <button className="btn" onClick={create} style={{ width: 180 }}>{t('Add frame')}</button>
        </div>
        </div>
      )}
      {frames.map(f => editingId === f.id ? (
        <div key={f.id} className="card">
          <strong>{t('Edit frame')}</strong>
          <label className="field">{t('Available')}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name={`frame_available_edit_${f.id}`} checked={editForm.active === 1} onChange={() => setEditForm({ ...editForm, active: 1 })} /> {t('Yes')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name={`frame_available_edit_${f.id}`} checked={editForm.active === 0} onChange={() => setEditForm({ ...editForm, active: 0 })} /> {t('No')}
              </label>
            </div>
          </label>
          <label className="field">{t('Frame Name')}<input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></label>
          <label className="field">{t('Brand')}<input value={editForm.brand} onChange={e => setEditForm({ ...editForm, brand: e.target.value })} /></label>
          <label className="field">{t('Vendor name')}
            <select value={editVendorSelectedId || ''} onChange={e => {
              const id = e.target.value || null;
              if (!id) {
                setEditVendorSelectedId(null);
                setEditForm(prev => ({ ...prev, vendor: '', vendor_office: '', vendor_mobile: '', vendor_address: '', vendor_road: '', vendor_postcode: '', vendor_building: '', vendor_floor: '', vendor_unit: '' }));
                return;
              }
              const sel = vendors.find(v => String(v.id) === String(id));
              if (!sel) return;
              const display = sel.display || '';
              const p = sel.vendor_profile || {};
              setEditVendorSelectedId(sel.id);
              setEditForm(prev => ({ ...prev,
                vendor: display,
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
          <div className="row">
            <PhoneInput allowAnyLeading disabled={!!editVendorSelectedId} label={t('Vendor office number')} value={editForm.vendor_office || ''} onChange={v => setEditForm({ ...editForm, vendor_office: v })} />
            <PhoneInput disabled={!!editVendorSelectedId} label={t('Vendor mobile number')} value={editForm.vendor_mobile || ''} onChange={v => setEditForm({ ...editForm, vendor_mobile: v })} />
          </div>
          <label className="field">{t('Vendor address')}<textarea rows={2} value={editForm.vendor_address} onChange={e => setEditForm({ ...editForm, vendor_address: e.target.value })} disabled={!!editVendorSelectedId} /></label>
          <label className="field">{t('Road name')}<input value={editForm.vendor_road || ''} onChange={e => setEditForm({ ...editForm, vendor_road: e.target.value })} disabled={!!editVendorSelectedId} /></label>
          <label className="field" style={{ marginTop: 8 }}>
            {t('Postcode')}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <input value={editForm.vendor_postcode || ''} onChange={e => setEditForm({ ...editForm, vendor_postcode: e.target.value })} style={{ flex: 1 }} disabled={!!editVendorSelectedId} />
            </div>
          </label>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'flex-start' }}>
            <label className="field" style={{ flex: 1, minWidth: 0 }}>
              {t('Building Name:')}
              <input placeholder={t('Building name')} value={editForm.vendor_building || ''} onChange={e => setEditForm({ ...editForm, vendor_building: e.target.value })} disabled={!!editVendorSelectedId} />
            </label>
            <label className="field" style={{ width: 60 }}>
              {t('Floor:') || t('Floor') || 'Floor:'}
              <input placeholder={t('Floor')} value={editForm.vendor_floor || ''} onChange={e => setEditForm({ ...editForm, vendor_floor: e.target.value })} style={{ width: '100%' }} disabled={!!editVendorSelectedId} />
            </label>
            <label className="field" style={{ width: 110 }}>
              {t('Unit:') || t('Unit') || 'Unit:'}
              <input placeholder={t('Unit number')} value={editForm.vendor_unit || ''} onChange={e => setEditForm({ ...editForm, vendor_unit: e.target.value })} style={{ width: '100%' }} disabled={!!editVendorSelectedId} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <label className="field" style={{ flex: 1, minWidth: 0 }}>{t('Base price (S$)')}
              <input value={editForm.base_price} onChange={e => setEditForm({ ...editForm, base_price: e.target.value })} inputMode="decimal" />
            </label>
            <label className="field" style={{ width: 180 }}>{t('Promotion price (S$)')}
              <input value={editForm.promotion_price} onChange={e => setEditForm({ ...editForm, promotion_price: e.target.value })} inputMode="decimal" />
            </label>
          </div>
          <label className="field">{t('Image URLs (one per line)')}
            <textarea rows={3} value={editForm.images} onChange={e => setEditForm({ ...editForm, images: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={cancelEdit}>{t('Form.Cancel')}</button>
            <button className="btn" onClick={() => saveEdit(f.id)} disabled={JSON.stringify(editForm) === JSON.stringify(editInitial)}>{t('Save')}</button>
          </div>
        </div>
      ) : (
        <div key={f.id} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {f.images && f.images[0] && <img src={f.images[0].url} alt="" style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 6 }} />}
          <div style={{ flex: 1 }}>
            <strong>{f.name}</strong>
            <div className="muted">
              {(f.promotion_price && Number(f.promotion_price) > 0 && Number(f.promotion_price) < Number(f.base_price)) ? (
                <span>
                  <span style={{ textDecoration: 'line-through', marginRight: 8 }}>{fmt(f.base_price)}</span>
                  <span style={{ fontWeight: 700, marginRight: 8 }}>{fmt(f.promotion_price)}</span>
                </span>
              ) : (
                <span style={{ marginRight: 8 }}>{fmt(f.base_price)}</span>
              )}
              · {f.brand}{f.vendor ? ` · ${f.vendor}` : ''}
            </div>
          </div>
          <button className="btn" style={{ width: 'auto', padding: '6px 10px' }} onClick={() => startEdit(f)}>{t('Edit')}</button>
          <button className="btn danger" style={{ width: 'auto', padding: '6px 10px', marginLeft: 6 }} onClick={() => remove(f.id)}>{t('Remove')}</button>
        </div>
      ))}
    </div>
  );
}
