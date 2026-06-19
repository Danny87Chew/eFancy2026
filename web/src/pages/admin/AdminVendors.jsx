import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { ALL_ROLES, ROLE_LABELS } from '../../roles';
import { useAuth } from '../../state/AuthContext.jsx';
import { useTranslation } from 'react-i18next';

const NON_VENDOR_ROLES = new Set(['consumer', 'admin', 'super_admin']);
const VENDOR_ROLES = ALL_ROLES.filter((role) => !NON_VENDOR_ROLES.has(role));

function formatDisplayName(user) {
  return user.nickname || user.real_name || user.user_code || user.mobile;
}

export default function AdminVendors() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === 'super_admin';
  const [users, setUsers] = useState([]);
  const [category, setCategory] = useState('all');
  const [keyword, setKeyword] = useState('');
  const load = async () => {
    const usersRes = await api('/api/admin/users');
    setUsers(usersRes.users || []);
  };
  useEffect(() => { load(); }, []);

  const vendorUsers = useMemo(() => {
    return users.filter((u) => {
      if (!VENDOR_ROLES.includes(u.role)) return false;
      const isStaffOnly =
        (u.staffs?.length || 0) === 0 &&
        (u.staff_of || []).some((s) => s.vendor_role === u.role);
      return !isStaffOnly;
    });
  }, [users]);

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(VENDOR_ROLES.map((role) => [role, 0]));
    for (const user of vendorUsers) {
      counts[user.role] = (counts[user.role] || 0) + 1;
    }
    return counts;
  }, [vendorUsers]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return vendorUsers.filter((u) => {
      if (category !== 'all' && u.role !== category) return false;
      if (!q) return true;
      const fields = [
        u.nickname,
        u.real_name,
        u.user_code,
        u.mobile,
        ROLE_LABELS[u.role] || u.role,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      return fields.some((v) => v.startsWith(q));
    });
  }, [vendorUsers, category, keyword]);

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <strong>{t('Vendors')}</strong>
            <div className="muted" style={{ marginTop: 4 }}>
              {t('Manage vendor listings here. Use the add page to create new vendors and shops.')}
            </div>
          </div>
          <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => navigate('/admin/vendors/add')}>
            {t('Add Vendor')}
          </button>
        </div>
      </div>

      <div className="card">
        <strong>{t('Vendors')}</strong>
        <div className="muted" style={{ marginTop: 4 }}>
          {t('Total vendors', { n: vendorUsers.length })}
        </div>

        <label className="field" style={{ marginTop: 12 }}>
          {t('Search')}
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('Search by name, code or mobile')}
          />
        </label>

        <label className="field" style={{ marginBottom: 0 }}>
          {t('Vendor category')}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">{t('All categories', { n: vendorUsers.length })}</option>
            {VENDOR_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(ROLE_LABELS[role]) || (ROLE_LABELS[role] || role) + ` (${categoryCounts[role] || 0})`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 && (
        <div className="card">
          <div className="muted">{t('No vendors found for the selected filter.')}</div>
        </div>
      )}
      {filtered.map((v) => (
        <div key={v.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong>{formatDisplayName(v)}</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                {ROLE_LABELS[v.role] || v.role}
              </div>
              <div className="muted" style={{ marginTop: 2 }}>
                {v.mobile} · {v.user_code}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div className="status-badge">{t('Staffs', { n: (v.staffs || []).length })}</div>
              {isSuperAdmin && (
                <button
                  className="btn secondary"
                  style={{ width: 'auto', padding: '4px 12px' }}
                  onClick={() => navigate(`/admin/vendors/${v.id}/edit`)}
                >
                  {t('Edit')}
                </button>
              )}
            </div>
          </div>

          {(v.staffs || []).length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div className="muted" style={{ marginBottom: 4 }}>{t('Associated Staffs')}</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {v.staffs.map((s) => (
                  <div key={s.id} className="muted" style={{ fontSize: 12 }}>
                    • {s.nickname || s.user_code || t('Unregistered staff')} · {s.staff_mobile}
                    {s.is_admin ? ` · ${t('Vendor Admin')}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
