import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api.js';
import ClearableInput from '../../components/ClearableInput';
import { getCategoryNameLabel } from '../../i18n.js';

export default function AdminGoodsCategories() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    api('/api/admin/goods-categories').then((res) => {
      setCategories(res.categories || []);
    }).catch((e) => {
      console.error(e);
      setError(e?.data?.error || e?.response?.data?.error || 'server_error');
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function submit(e) {
    e.preventDefault();
    setError(null);
    const payload = { name: name.trim() };
    if (!payload.name) return;
    api('/api/admin/goods-categories', { method: 'POST', body: payload }).then(() => {
      setName('');
      load();
    }).catch((err) => {
      setError(err?.data?.error || err?.response?.data?.error || 'server_error');
    });
  }

  function startEdit(category) {
    setEditingId(category.id);
    setEditingName(category.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
  }

  function saveEdit(id) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    setError(null);
    api(`/api/admin/goods-categories/${id}`, { method: 'PATCH', body: { name: trimmed } }).then(() => {
      cancelEdit();
      load();
    }).catch((err) => {
      setError(err?.data?.error || err?.response?.data?.error || 'server_error');
    });
  }

  function removeCategory(id) {
    if (!window.confirm(t('Delete this category?') || 'Delete this category?')) return;
    setError(null);
    api(`/api/admin/goods-categories/${id}`, { method: 'DELETE' }).then(() => {
      load();
    }).catch((err) => {
      setError(err?.data?.error || err?.response?.data?.error || 'server_error');
    });
  }

  return (
    <div>
      <h2 className="h2">{t('Goods Category', { defaultValue: 'Goods Category' })}</h2>
      <form onSubmit={submit} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ClearableInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Category name') || 'Category name'}
            required
            style={{ minWidth: 220 }}
          />
          <button type="submit" style={{ fontWeight: 700, fontSize: 16, padding: '10px 16px' }}>{t('Add Category') || 'Add Category'}</button>
        </div>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{t(error) || error}</div>}
      </form>

      {loading ? <div>{t('Loading...') || 'Loading...'}</div> : (
        <div>
          {categories.length === 0 ? <div>{t('No categories') || 'No categories'}</div> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {categories.map((category) => (
                <li key={category.id} style={{ padding: '10px 12px', border: '1px solid #eee', borderRadius: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    {editingId === category.id ? (
                    <>
                      <ClearableInput value={editingName} onChange={(e) => setEditingName(e.target.value)} style={{ flex: 1 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => saveEdit(category.id)}>{t('Save') || 'Save'}</button>
                        <button type="button" onClick={cancelEdit}>{t('Cancel') || 'Cancel'}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>{getCategoryNameLabel(category.name, t)}</strong>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => startEdit(category)}>{t('Edit') || 'Edit'}</button>
                        <button type="button" onClick={() => removeCategory(category.id)}>{t('Delete') || 'Delete'}</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
