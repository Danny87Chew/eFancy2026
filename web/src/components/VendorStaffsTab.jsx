import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import PhoneInput from './PhoneInput.jsx';
import { useAuth } from '../state/AuthContext.jsx';

const VENDOR_OWNER_ROLES = ['spectacle_checkup_vendor', 'spectacle_producer_vendor'];

export default function VendorStaffsTab() {
  const { t } = useTranslation();
  const { user, vendorContext } = useAuth();
  const isOwner = VENDOR_OWNER_ROLES.includes(user?.role);
  const isStaffAdmin = !isOwner && vendorContext?.is_staff_admin;

  const [staffList, setStaffList] = useState([]);
  const [ownerMobile, setOwnerMobile] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editMobile, setEditMobile] = useState('');
  const [editName, setEditName] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editingOwner, setEditingOwner] = useState(false);
  const [newOwnerMobile, setNewOwnerMobile] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [newMobile, setNewMobile] = useState('+65');
  const [newName, setNewName] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const d = await api('/api/vendor/staff');
      setStaffList(d.staff);
      setOwnerMobile(d.owner_mobile);
      setOwnerName(d.owner_name || '');
    } catch { setError(t('Failed to load staff list.')); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm(t('Remove this staff member?'))) return;
    try {
      await api(`/api/vendor/staff/${id}`, { method: 'DELETE' });
      setStaffList(prev => prev.filter(s => s.id !== id));
    } catch (e) { setError(e?.data?.error || t('Delete failed.')); }
  };

  const startEdit = (staff) => {
    setEditingId(staff.id);
    setEditMobile(staff.staff_mobile);
    setEditName(staff.name || '');
    setEditIsAdmin(!!staff.is_admin);
    setEditingOwner(false);
  };

  const cancelEdit = () => { setEditingId(null); setEditMobile(''); setEditName(''); };

  const handleUpdate = async (id) => {
    setSaving(true); setError('');
    try {
      const d = await api(`/api/vendor/staff/${id}`, { method: 'PATCH', body: { mobile: editMobile, is_admin: editIsAdmin, name: editName } });
      setStaffList(prev => prev.map(s => s.id === id ? { ...s, staff_mobile: d.staff.staff_mobile, is_admin: d.staff.is_admin, name: d.staff.name } : s));
      setEditingId(null);
    } catch (e) {
      setError(
        e?.data?.error === 'already_exists' ? t('This number is already a staff member.') :
        e?.data?.error || t('Update failed.')
      );
    } finally { setSaving(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (newMobile === ownerMobile) { setError(t("Cannot add owner's registered number as staff.")); return; }
    setSaving(true); setError('');
    try {
      const d = await api('/api/vendor/staff', { method: 'POST', body: { mobile: newMobile, is_admin: newIsAdmin, name: newName } });
      setStaffList(prev => [...prev, d.staff]);
      setNewMobile('+65'); setNewName(''); setNewIsAdmin(false); setShowAdd(false);
    } catch (e) {
      setError(
        e?.data?.error === 'already_exists' ? t('This number is already a staff member.') :
        e?.data?.error === 'cannot_add_self' ? t("Cannot add owner's registered number.") :
        e?.data?.error || t('Add failed.')
      );
    } finally { setSaving(false); }
  };

  const handleChangeOwnerMobile = async (e) => {
    e.preventDefault();
    const mobileChanged = newOwnerMobile && newOwnerMobile !== ownerMobile;
    const nameChanged = newOwnerName !== ownerName;
    if (!mobileChanged && !nameChanged) { setEditingOwner(false); return; }
    setSaving(true); setError('');
    try {
      const body = {};
      if (mobileChanged) body.mobile = newOwnerMobile;
      if (nameChanged) body.name = newOwnerName;
      const d = await api('/api/vendor/profile/mobile', { method: 'PATCH', body });
      setOwnerMobile(d.mobile || newOwnerMobile);
      setOwnerName(d.name ?? newOwnerName);
      setEditingOwner(false);
      setNewOwnerMobile('');
      setNewOwnerName('');
    } catch (e) {
      setError(
        e?.data?.error === 'mobile_taken' ? t('This number is already registered by another user.') :
        e?.data?.error || t('Update failed.')
      );
    } finally { setSaving(false); }
  };

  if (loading) return <div className="muted" style={{ padding: 16 }}>{t('Loading')}</div>;

  return (
    <>
      {error && (
        <div className="card" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', marginBottom: 8 }}>
          {error}
          <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => setError('')}>{t('Dismiss')}</button>
        </div>
      )}

      {isOwner && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="label" style={{ marginBottom: 2 }}>{t('Registered Number (Owner)')}</div>
              <div style={{ fontWeight: 600 }}>
                {ownerName || <span className="muted" style={{ fontStyle: 'italic', fontWeight: 400 }}>{t('(no name)')}</span>}
              </div>
              <div style={{ fontSize: 13 }}>{ownerMobile}</div>
            </div>
            {!editingOwner && (
              <button className="btn secondary" style={{ width: 'auto', padding: '6px 14px' }}
                onClick={() => { setEditingOwner(true); setNewOwnerMobile(ownerMobile); setNewOwnerName(ownerName); }}>
                {t('Change')}
              </button>
            )}
          </div>
          {editingOwner && (
            <form onSubmit={handleChangeOwnerMobile} style={{ marginTop: 12 }}>
              <label className="field" style={{ marginBottom: 10 }}>{t('Name')}<input value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)} placeholder={t('Owner name')} /></label>
              <PhoneInput label={t('New Mobile Number')} value={newOwnerMobile} onChange={setNewOwnerMobile} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn" type="submit"
                  disabled={saving || !newOwnerMobile || (newOwnerMobile === ownerMobile && newOwnerName === ownerName)}
                  style={{ flex: 1 }}>
                  {saving ? t('Saving…') : t('Save')}
                </button>
                <button className="btn secondary" type="button" onClick={() => { setEditingOwner(false); setNewOwnerMobile(''); setNewOwnerName(''); }} style={{ flex: 1 }}>{t('Form.Cancel')}</button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>{t('Staff ({{count}})', { count: staffList.length })}</strong>
          {!showAdd && (
            <button className="btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setShowAdd(true)}>
              + {t('Add Staff')}
            </button>
          )}
        </div>

        {showAdd && (
            <form onSubmit={handleAdd} style={{ marginBottom: 16, padding: 12, background: 'var(--bg-alt, #f8f9fa)', borderRadius: 8 }}>
            <label className="field" style={{ marginBottom: 10 }}>{t('Name')}<input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('Staff name')} /></label>
            <PhoneInput label={t('Staff Mobile Number')} value={newMobile} onChange={setNewMobile} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={newIsAdmin} onChange={e => setNewIsAdmin(e.target.checked)} />
              <span style={{ whiteSpace: 'nowrap' }}>{t('Vendor Admin (can manage staff list and orders)')}</span>
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn" type="submit" disabled={saving || !newMobile || newMobile.length <= 3} style={{ flex: 1 }}>
                {saving ? t('Adding…') : t('Add')}
              </button>
              <button className="btn secondary" type="button" onClick={() => { setShowAdd(false); setNewMobile('+65'); setNewName(''); setNewIsAdmin(false); }} style={{ flex: 1 }}>
                {t('Form.Cancel')}
              </button>
            </div>
          </form>
        )}

        {staffList.length === 0 && !showAdd && <p className="muted">{t('No staff added yet.')}</p>}

        {staffList.map((s) => (
          <div key={s.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
            {editingId === s.id ? (
              <>
                <label className="field" style={{ marginBottom: 10 }}>{t('Name')}<input value={editName} onChange={e => setEditName(e.target.value)} placeholder={t('Staff name')} /></label>
                <PhoneInput label={t('Mobile Number')} value={editMobile} onChange={setEditMobile} />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editIsAdmin} onChange={e => setEditIsAdmin(e.target.checked)} />
                  <span style={{ whiteSpace: 'nowrap' }}>{t('Vendor Admin (can manage staff list and orders)')}</span>
                </label>
                {(() => {
                  const dirty = editMobile !== s.staff_mobile || editName !== (s.name || '') || editIsAdmin !== !!s.is_admin;
                  return (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="btn" onClick={() => handleUpdate(s.id)}
                        disabled={saving || !editMobile || !dirty} style={{ flex: 1 }}>
                        {saving ? t('Saving…') : t('Save')}
                      </button>
                      <button className="btn secondary" onClick={cancelEdit} style={{ flex: 1 }}>{t('Form.Cancel')}</button>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{s.name || <span className="muted" style={{ fontStyle: 'italic' }}>{t('(no name)')}</span>}</div>
                  <div style={{ fontSize: 13 }}>{s.staff_mobile}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.is_admin ? `${t('Vendor Admin')} · ${t('Registered')}` : `${t('Staff')} · ${t('Registered')}`}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn secondary" style={{ width: 'auto', padding: '5px 12px' }}
                      onClick={() => startEdit(s)}>{t('Edit')}</button>
                    <button className="btn secondary" style={{ width: 'auto', padding: '5px 12px', color: '#dc2626' }}
                      onClick={() => handleDelete(s.id)}>{t('Remove')}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
