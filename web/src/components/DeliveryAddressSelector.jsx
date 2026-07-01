import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import DeliveryAddressForm from './DeliveryAddressForm.jsx';

export default function DeliveryAddressSelector({ addresses = [], selectedId = null, onSelect = null, onAddressAdded = null, onAddressUpdated = null, title = null }) {
  const { t } = useTranslation();
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleAddressAdded = async (data) => {
    setSaving(true);
    setErr('');
    try {
      const result = await api('/api/auth/delivery-addresses', {
        method: 'POST',
        body: data,
      });
      setShowAddressForm(false);
      onAddressAdded && onAddressAdded(result.address);
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddressUpdated = async (data) => {
    setSaving(true);
    setErr('');
    try {
      const result = await api(`/api/auth/delivery-addresses/${editingId}`, {
        method: 'PATCH',
        body: data,
      });
      setEditingId(null);
      onAddressUpdated && onAddressUpdated(result.address);
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetAsDefault = async () => {
    if (!selectedId) return;
    setSaving(true);
    setErr('');
    try {
      const result = await api(`/api/auth/delivery-addresses/${selectedId}`, {
        method: 'PATCH',
        body: { is_default: 1 },
      });
      onAddressUpdated && onAddressUpdated(result.address);
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedAddress = addresses.find(a => a.id === selectedId);

  if (editingId) {
    const addr = addresses.find(a => a.id === editingId);
    if (!addr) return null;
    return (
      <DeliveryAddressForm
        initialData={addr}
        onSubmit={handleAddressUpdated}
        onCancel={() => { setEditingId(null); setErr(''); }}
        isLoading={saving}
      />
    );
  }

  if (showAddressForm) {
    return (
      <DeliveryAddressForm
        onSubmit={handleAddressAdded}
        onCancel={() => { setShowAddressForm(false); setErr(''); }}
        isLoading={saving}
      />
    );
  }

  return (
    <div>
      {title && <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>{title}</div>}
      {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}
      
      {addresses.length === 0 ? (
        <div className="card">
          <p className="muted">{t('No delivery addresses found. Please add one to continue.')}</p>
          <button className="btn" onClick={() => setShowAddressForm(true)}>
            {t('Add Delivery Address')}
          </button>
        </div>
      ) : (
        <div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: '#555' }}>{t('Select Delivery Address')}</label>
            <select
              value={selectedId || ''}
              onChange={(e) => onSelect && onSelect(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '16px' }}
            >
              <option value="">{t('Choose an address...')}</option>
              {addresses.map((addr) => (
                <option key={addr.id} value={addr.id}>
                  {addr.label || t('Address')} {addr.is_default === 1 ? `(${t('Default')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedAddress && (
            <div className="card" style={{ marginBottom: 16, backgroundColor: '#f8f9ff', border: '1px solid var(--border)' }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontSize: 18 }}>{selectedAddress.label || t('Address')}</strong>
                  {selectedAddress.is_default === 1 && (
                    <span style={{ fontSize: 12, backgroundColor: '#2e7d32', color: '#fff', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                      {t('Default')}
                    </span>
                  )}
                </div>
                <div style={{ color: '#666', marginBottom: 8 }}>
                  <strong>{selectedAddress.recipient_name}</strong> · {selectedAddress.recipient_phone}
                </div>
                <div style={{ color: '#666', fontSize: 14, lineHeight: 1.5 }}>
                  {selectedAddress.address}
                  {(selectedAddress.city || selectedAddress.state || selectedAddress.postal_code) && (
                    <div style={{ marginTop: 4 }}>
                      {selectedAddress.city && <span>{selectedAddress.city}</span>}
                      {selectedAddress.state && <span>{selectedAddress.state && selectedAddress.city ? ', ' : ''}{selectedAddress.state}</span>}
                      {selectedAddress.postal_code && <span>{(selectedAddress.city || selectedAddress.state) ? ' ' : ''}{selectedAddress.postal_code}</span>}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  className="btn secondary"
                  onClick={() => setEditingId(selectedAddress.id)}
                  disabled={saving}
                  style={{ flex: 1 }}
                >
                  {t('Edit')}
                </button>
              </div>

              {selectedAddress.is_default !== 1 && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', whiteSpace: 'nowrap', marginBottom: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={handleSetAsDefault}
                    disabled={saving}
                  />
                  <span>{t('Set as default delivery address')}</span>
                </label>
              )}
            </div>
          )}

          <button
            className="btn secondary"
            onClick={() => setShowAddressForm(true)}
            style={{ width: '100%' }}
          >
            {t('Add Another Address')}
          </button>
        </div>
      )}
    </div>
  );
}
