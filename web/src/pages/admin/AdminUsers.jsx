import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { ALL_ROLES, ROLE_LABELS } from '../../roles';
import { useAuth } from '../../state/AuthContext.jsx';
import { useTranslation } from 'react-i18next';
import PhoneInput, { COUNTRY_CODES as PHONE_COUNTRY_CODES } from '../../components/PhoneInput.jsx';
import ClearableInput from '../../components/ClearableInput';

function splitMobile(mobile = '') {
  for (const { code } of PHONE_COUNTRY_CODES) {
    if (mobile.startsWith(code)) return { cc: code, local: mobile.slice(code.length) };
  }
  return { cc: '+65', local: mobile };
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isSuperAdmin = me?.role === 'super_admin';
  const [users, setUsers] = useState([]);
  const [filterRole, setFilterRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editCC, setEditCC] = useState('+65');
  const [editLocal, setEditLocal] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editRealName, setEditRealName] = useState('');
  const [editHomeAddress, setEditHomeAddress] = useState('');
  const [editHomePhone, setEditHomePhone] = useState('');
  const [editNextKinName, setEditNextKinName] = useState('');
  const [editNextKinPhone, setEditNextKinPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editMerchantName, setEditMerchantName] = useState('');
  const [vendors, setVendors] = useState([]);
  const [vendorSelectedId, setVendorSelectedId] = useState(null);
  const [editStaffs, setEditStaffs] = useState([]);
  const [editInitial, setEditInitial] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = () => api('/api/admin/users').then(d => setUsers(d.users));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const incomingRole = location.state?.filterRole;
    if (incomingRole && incomingRole !== filterRole) setFilterRole(incomingRole);
  }, [location.state]);

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId || !users.length) return;
    const target = users.find((u) => u.id === editId);
    if (target) {
      startEdit(target);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [users, location.state]);

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const res = await api('/api/admin/users');
        const list = (res.users || [])
          .filter(u => !['consumer', 'admin', 'super_admin'].includes(u.role))
          .map((u) => ({
            ...u,
            display: (u.vendor_profile && u.vendor_profile.merchant_name) || u.nickname || u.real_name || '',
          }))
          .filter((u) => String(u.display || '').trim());
        setVendors(list);
        // if currently editing, try to match vendor by merchant name
        if (editingId) {
          const cur = vendors.find(v => v.display === ((users.find(x=>x.id===editingId)?.vendor_profile?.merchant_name) || ''));
          if (cur) setVendorSelectedId(cur.id);
        }
      } catch (e) { setVendors([]); }
    };
    loadVendors();
  }, [editingId]);

  const setRole = async (id, role) => {
    await api(`/api/admin/users/${id}`, { method: 'PATCH', body: { role } });
    load();
  };

  const startEdit = (u) => {
    const { cc, local } = splitMobile(u.mobile);
    setEditingId(u.id);
    setEditCC(cc);
    setEditLocal(local);
    setEditRole(u.role);
    setEditNickname(u.nickname || '');
    setEditRealName(u.real_name || '');
    setEditHomeAddress(u.home_address || '');
    setEditHomePhone(u.home_phone || '');
    setEditNextKinName(u.next_kin_name || '');
    setEditNextKinPhone(u.next_kin_phone || '');
    setEditDepartment(u.department || '');
    setEditMerchantName((u.vendor_profile && u.vendor_profile.merchant_name) || '');
    const display = (u.vendor_profile && u.vendor_profile.merchant_name) || '';
    // try to match existing vendor user by display name
    setVendorSelectedId(null);
    // vendors may not have loaded yet; we'll set match after vendors load effect
    const staffs = (u.staffs || []).map((s) => ({
      id: s.id,
      staff_mobile: s.staff_mobile,
      is_admin: !!s.is_admin,
    }));
    setEditStaffs(staffs);
    setEditInitial(JSON.stringify({
      cc,
      local,
      role: u.role,
      nickname: u.nickname || '',
      real_name: u.real_name || '',
      home_address: u.home_address || '',
      home_phone: u.home_phone || '',
      next_kin_name: u.next_kin_name || '',
      next_kin_phone: u.next_kin_phone || '',
      department: u.department || '',
      merchant_name: (u.vendor_profile && u.vendor_profile.merchant_name) || '',
      staffs,
    }));
    setErr('');
  };

  const cancelEdit = () => { setEditingId(null); setErr(''); setEditMerchantName(''); };

  const isVendorRole = (role) => !['consumer', 'admin', 'super_admin'].includes(role);
  const isInternalRole = (role) => ['admin', 'staff', 'super_admin', 'platform_staff'].includes(role);

  const saveEdit = async (id) => {
    setSaving(true); setErr('');
    try {
      const body = {
        mobile: editCC + editLocal,
        role: editRole,
        nickname: editNickname.trim(),
        real_name: editRealName.trim(),
      };
      if (isInternalRole(editRole)) {
        body.home_address = editHomeAddress.trim();
        body.home_phone = editHomePhone.trim();
        body.next_kin_name = editNextKinName.trim();
        body.next_kin_phone = editNextKinPhone.trim();
        body.department = editDepartment.trim();
      }
      if (isVendorRole(editRole)) body.merchant_name = editMerchantName.trim() || undefined;
      if (isVendorRole(editRole)) body.staffs = editStaffs;
      await api(`/api/admin/users/${id}`, { method: 'PATCH', body });
      setEditingId(null);
      load();
    } catch (e) {
      if (e?.data?.error === 'mobile_taken') setErr('This mobile is already taken.');
      else if (e?.data?.error === 'duplicate_staff_mobile') setErr('Duplicate staff mobile numbers are not allowed.');
      else if (e?.data?.error === 'staff_mobile_required') setErr('Each associated staff must have a mobile number.');
      else setErr(e?.data?.error || 'Save failed.');
    } finally { setSaving(false); }
  };

  const updateStaff = (idx, patch) => {
    setEditStaffs((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeStaff = (idx) => {
    setEditStaffs((prev) => prev.filter((_, i) => i !== idx));
  };

  const addStaff = () => {
    setEditStaffs((prev) => [...prev, { id: null, staff_mobile: '+65', is_admin: false }]);
  };

  const filteredUsers = (filterRole === 'all' ? users : users.filter((u) => u.role === filterRole && !(u.staff_of || []).some((s) => s.vendor_role === filterRole)))
    .filter((u) => {
      if (!searchTerm) return true;
      const q = searchTerm.trim().toLowerCase();
      return [u.nickname, u.user_code, u.mobile, u.real_name].some(val => String(val || '').toLowerCase().includes(q));
    });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <button
          className="btn"
          style={{ width: 'auto', padding: '8px 14px' }}
          onClick={() => navigate('/login?intent=register&internal_user_create=1')}
        >
          + {t('Add User')}
        </button>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0, flex: 1 }}>
          {t('Search users')}
          <ClearableInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('Search by name, code or mobile')}
          />
        </label>
        <label className="field" style={{ marginBottom: 0, width: 180 }}>
          {t('User type')}
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="all">{t('All user types')}</option>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABELS[r]) || r}</option>)}
          </select>
        </label>
      </div>

      {filteredUsers.map(u => (
        <div key={u.id} className="card" style={{ marginBottom: 10 }}>
          {editingId === u.id ? (
            <>
              <div style={{ marginBottom: 8 }}>
                <label className="field" style={{ marginBottom: 10 }}>
                  {t('Name')}
                  <ClearableInput
                    value={editRealName}
                    onChange={e => setEditRealName(e.target.value)}
                    placeholder={t('Real name')}
                  />
                </label>
                <label className="field" style={{ marginBottom: 10 }}>
                  {t('Nickname')}
                  <ClearableInput
                    value={editNickname}
                    onChange={e => setEditNickname(e.target.value)}
                    placeholder={t('Nickname')}
                  />
                </label>
                <PhoneInput
                  label={<div style={{ marginBottom: 6, fontWeight: 700 }}>{t('Owner Mobile')}</div>}
                  value={editCC + editLocal}
                  onChange={(v) => {
                    const { cc, local } = splitMobile(v);
                    setEditCC(cc);
                    setEditLocal(local);
                  }}
                />
                <label className="field">
                  {t('Role')}
                  <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                    {ALL_ROLES.map(r => <option key={r} value={r}>{t(ROLE_LABELS[r]) || r}</option>)}
                  </select>
                </label>

                {isInternalRole(editRole) && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 10 }}>
                    <label className="field" style={{ marginBottom: 0 }}>
                      {t('Name')}
                      <ClearableInput value={editRealName} onChange={e => setEditRealName(e.target.value)} placeholder={t('Full name')} />
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      {t('Home Address')}
                      <ClearableInput value={editHomeAddress} onChange={e => setEditHomeAddress(e.target.value)} placeholder={t('Home address')} />
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      {t('Home Phone')}
                      <ClearableInput value={editHomePhone} onChange={e => setEditHomePhone(e.target.value)} placeholder={t('Home phone')} />
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      {t("Next Kin's Name")}
                      <ClearableInput value={editNextKinName} onChange={e => setEditNextKinName(e.target.value)} placeholder={t("Next kin's name")} />
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      {t("Next Kin's Phone Number")}
                      <ClearableInput value={editNextKinPhone} onChange={e => setEditNextKinPhone(e.target.value)} placeholder={t("Next kin's phone")} />
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      {t('Department')}
                      <ClearableInput value={editDepartment} onChange={e => setEditDepartment(e.target.value)} placeholder={t('Department')} />
                    </label>
                  </div>
                )}

                {isVendorRole(editRole) && (
                  <div style={{ marginTop: 8 }}>
                    <label className="field" style={{ marginBottom: 10 }}>
                      {t('Vendor name')}
                      <select value={vendorSelectedId || ''} onChange={e => {
                        const id = e.target.value || null;
                        if (!id) {
                          setVendorSelectedId(null);
                          setEditMerchantName('');
                          return;
                        }
                        const sel = vendors.find(v => String(v.id) === String(id));
                        if (!sel) return;
                        setVendorSelectedId(sel.id);
                        setEditMerchantName(sel.display || '');
                      }}>
                        <option value="">— {t('(none)')} —</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.display}</option>
                        ))}
                      </select>
                    </label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div className="label">{t('Associated Staffs')}</div>
                        <button
                        type="button"
                        className="btn secondary"
                        style={{ width: 'auto', padding: '5px 12px' }}
                        onClick={addStaff}
                      >
                        + {t('Add Staff')}
                      </button>
                    </div>
                    {editStaffs.length === 0 && (
                      <div className="muted" style={{ fontSize: 13 }}>{t('No associated staffs.')}</div>
                    )}
                    {editStaffs.map((s, idx) => (
                      <div key={s.id || `new-${idx}`} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}>
                        <PhoneInput
                          label={<strong>{t('Staff {{n}} Mobile', { n: idx + 1 })}</strong>}
                          value={s.staff_mobile || '+65'}
                          onChange={(v) => updateStaff(idx, { staff_mobile: v })}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!s.is_admin}
                              onChange={(e) => updateStaff(idx, { is_admin: e.target.checked })}
                            />
                            {t('Vendor Admin')}
                          </label>
                          <button
                            type="button"
                            className="btn secondary"
                            style={{ width: 'auto', padding: '4px 10px', color: '#dc2626' }}
                            onClick={() => removeStaff(idx)}
                          >
                            {t('Remove')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {err && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  disabled={saving || JSON.stringify({
                    cc: editCC,
                    local: editLocal,
                    role: editRole,
                    nickname: editNickname,
                    real_name: editRealName,
                    home_address: editHomeAddress,
                    home_phone: editHomePhone,
                    next_kin_name: editNextKinName,
                    next_kin_phone: editNextKinPhone,
                    department: editDepartment,
                    staffs: editStaffs,
                  }) === editInitial}
                  onClick={() => saveEdit(u.id)}
                >
                  {saving ? t('Saving…') : t('Save')}
                </button>
                <button className="btn secondary" style={{ flex: 1 }} onClick={cancelEdit}>{t('Form.Cancel')}</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <strong>{u.nickname || u.user_code}</strong>
                <div className="muted" style={{ fontSize: 13 }}>{u.mobile} · {u.user_code}</div>
                {u.real_name && (
                  <div className="muted" style={{ fontSize: 13 }}>{t('Name')}: {u.real_name}</div>
                )}
                <div className="muted" style={{ fontSize: 13 }}>{t('Category')}: {t(ROLE_LABELS[u.role]) || u.role}</div>
                {isInternalRole(u.role) && (
                  <>
                    {u.home_address && <div className="muted" style={{ fontSize: 12 }}>{t('Home Address')}: {u.home_address}</div>}
                    {u.home_phone && <div className="muted" style={{ fontSize: 12 }}>{t('Home Phone')}: {u.home_phone}</div>}
                    {u.next_kin_name && <div className="muted" style={{ fontSize: 12 }}>{t("Next Kin's Name")}: {u.next_kin_name}</div>}
                    {u.next_kin_phone && <div className="muted" style={{ fontSize: 12 }}>{t("Next Kin's Phone Number")}: {u.next_kin_phone}</div>}
                    {u.department && <div className="muted" style={{ fontSize: 12 }}>{t('Department')}: {u.department}</div>}
                  </>
                )}
                <div className="muted" style={{ fontSize: 12 }}>
                  Created: {fmtDate(u.created_at)} · Modified: {fmtDate(u.updated_at || u.created_at)}
                </div>
                {filterRole !== 'all' && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                    Associated Staffs: {u.staffs?.length || 0}
                  </div>
                )}
                {filterRole !== 'all' && (u.staffs?.length || 0) > 0 && (
                  <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                    {u.staffs.map((s) => (
                      <div key={s.id} className="muted" style={{ fontSize: 12 }}>
                        • {s.nickname || s.user_code || t('Unregistered staff')} · {s.staff_mobile}
                        {(s.vendor_role || s.role) ? ` · ${t(ROLE_LABELS[s.vendor_role || s.role]) || s.vendor_role || s.role}` : ''}
                        {s.is_admin ? ` · ${t('Vendor Admin')}` : ''}
                      </div>
                    ))}
                  </div>
                )}
                {filterRole !== 'all' && (u.staff_of || []).some((s) => s.vendor_role === filterRole) && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Staff Of: {(u.staff_of || [])
                      .filter((s) => s.vendor_role === filterRole)
                      .map((s) => `${s.vendor_nickname || s.vendor_user_code || 'Vendor'}${s.is_admin ? ' (Vendor Admin)' : ''}`)
                      .join(', ')}
                  </div>
                )}
              </div>
              {isSuperAdmin ? (
                <button className="btn secondary" style={{ width: 'auto', padding: '5px 12px' }}
                  onClick={() => startEdit(u)}>{t('Edit')}</button>
              ) : (
                <select value={u.role} onChange={e => setRole(u.id, e.target.value)} style={{ width: 'auto' }}>
                  {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
