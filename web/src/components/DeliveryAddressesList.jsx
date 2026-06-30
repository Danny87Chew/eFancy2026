import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import DeliveryAddressForm from './DeliveryAddressForm.jsx';

export default function DeliveryAddressesList({ addresses = [], onUpdate, onDelete, selectable = false, onSelect = null, selectedId = null }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleAdd = async (data) => {
    setSaving(true);
    setErr('');
    try {
      const result = await api('/api/auth/delivery-addresses', {
        method: 'POST',
        body: data,
      });
      setAdding(false);
      onUpdate && onUpdate(result.address);
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (data) => {
    setSaving(true);
    setErr('');
    try {
      const result = await api(`/api/auth/delivery-addresses/${editing}`, {
        method: 'PATCH',
        body: data,
      });
      setEditing(null);
      onUpdate && onUpdate(result.address);
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('Are you sure you want to delete this address?'))) return;
    try {
      await api(`/api/auth/delivery-addresses/${id}`, { method: 'DELETE' });
      onDelete && onDelete(id);
    } catch (e) {
      setErr(e?.data?.error || e.message);
    }
  };

  if (adding) {
    return (
      <DeliveryAddressForm
        onSubmit={handleAdd}
        onCancel={() => { setAdding(false); setErr(''); }}
        isLoading={saving}
      />
    );
  }

  if (editing) {
    const addr = addresses.find(a => a.id === editing);
    if (!addr) return null;
    return (
      <DeliveryAddressForm
        initialData={addr}
        onSubmit={handleEdit}
        onCancel={() => { setEditing(null); setErr(''); }}
        isLoading={saving}
      />
    );
  }

  return (
    <div>
      {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}
      
      {addresses.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: '24px' }}>
          <p>{t('No delivery addresses yet')}</p>
          <button className="btn" onClick={() => setAdding(true)}>
            {t('Add your first address')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="card"
              onClick={() => selectable && onSelect && onSelect(addr.id)}
              style={{
                cursor: selectable ? 'pointer' : 'default',
                backgroundColor: selectable && selectedId === addr.id ? '#f0f8ff' : undefined,
                border: selectable && selectedId === addr.id ? '2px solid #0066cc' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <strong>{addr.label || t('Address')}</strong>
                    {addr.is_default === 1 && (
                      <span style={{ fontSize: 12, backgroundColor: '#e3f2fd', padding: '2px 6px', borderRadius: 4 }}>
                        {t('Default')}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#666', marginBottom: 4 }}>
                    <strong>{addr.recipient_name}</strong> · {addr.recipient_phone}
                  </div>
                  <div style={{ color: '#666', fontSize: 14, lineHeight: 1.5 }}>
                    {addr.address}
                    {addr.city && ` · ${addr.city}`}
                    {addr.state && ` · ${addr.state}`}
                    {addr.postal_code && ` ${addr.postal_code}`}
                  </div>
                </div>

                {!selectable && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn secondary"
                      onClick={() => setEditing(addr.id)}
                      style={{ padding: '8px 12px' }}
                    >
                      {t('Edit')}
                    </button>
                    <button
                      className="btn secondary danger"
                      onClick={() => handleDelete(addr.id)}
                      style={{ padding: '8px 12px' }}
                    >
                      {t('Delete')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {!selectable && (
            <button
              className="btn"
              onClick={() => setAdding(true)}
              style={{ marginTop: 8 }}
            >
              {t('Add another address')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
