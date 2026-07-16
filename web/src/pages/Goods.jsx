import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import ClearableInput from '../components/ClearableInput';

const getCuttingOptions = (category = '') => {
  const normalized = String(category || '').trim().toLowerCase();
  // Remove common qualifiers like Fresh/Frozen/Cooked so e.g. "Fresh Chicken" matches "chicken"
  const cleaned = normalized.replace(/\b(fresh|frozen|cooked)\b/g, '').replace(/\s+/g, ' ').trim();

  if (['beef', 'lamb', 'mutton'].includes(cleaned)) {
    return ['100g/Pcs', '150g/Pcs', '200g/Pcs', '250g/Pcs', '300g/Pcs', '350g/Pcs', '400g/Pcs'];
  }
  if (cleaned === 'fish') {
    return ['Butter Fly', 'Whole', 'Half', 'Quarter', '8 pieces', 'Small pieces'];
  }
  if (['chicken', 'checken', 'duck', 'goose'].includes(cleaned)) {
    return ['Whole', 'Half', 'Quarter', '8 pieces', 'Small pieces'];
  }
  return [];
};

export default function Goods() {
  const { t } = useTranslation();
  const [goods, setGoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const hasActiveFilter = Boolean(categoryFilter?.trim());

  const emptyForm = { name: '', code: '', category: '', kind: 'normal', cutting: '', source_price: '', market_price: '', promotion_price: '', stock: '', available_from: '', active: true };
  const [form, setForm] = useState(emptyForm);
  const [imagesInput, setImagesInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);

  function resetForm() {
    setForm({ ...emptyForm });
    setImagesInput('');
    setEditingId(null);
    setShowAddForm(false);
  }

  function load(nextFilter = categoryFilter) {
    setLoading(true);
    const q = nextFilter ? `?category=${encodeURIComponent(nextFilter)}` : '';
    Promise.all([
      api(`/api/admin/goods${q}`),
      api('/api/admin/goods-categories')
    ]).then(([goodsRes, categoriesRes]) => {
      setGoods(goodsRes.goods || []);
      setCategories(categoriesRes.categories || []);
    }).catch((e) => {
      console.error(e);
    }).finally(() => setLoading(false));
  }

  function applyCategoryFilter(nextValue = categoryFilter) {
    load(nextValue);
  }

  useEffect(() => { load(''); }, []);

  function submit(e) {
    e.preventDefault();
    setError(null);
    const images = imagesInput
      .split(/\r?\n|,/)
      .map((url) => url.trim())
      .filter(Boolean);

    const request = editingId
      ? api(`/api/admin/goods/${editingId}`, { method: 'PATCH', body: { ...form, images } })
      : api('/api/admin/goods', { method: 'POST', body: { ...form, images } });

    request.then(() => {
      resetForm();
      load();
    }).catch((err) => {
      setError(err?.data?.error || err?.response?.data?.error || 'server_error');
    });
  }

  function toggleAddForm() {
    if (showAddForm) {
      resetForm();
      return;
    }
    setEditingId(null);
    setShowAddForm(true);
    setForm({ ...emptyForm });
    setImagesInput('');
    setError(null);
  }

  function startEdit(good) {
    setEditingId(good.id);
    setShowAddForm(true);
    const options = getCuttingOptions(good.category || '');
    setForm({
      name: good.name || '',
      code: good.code || '',
      category: good.category || '',
      kind: good.kind || 'normal',
      cutting: good.cutting || (options.includes('Whole') ? 'Whole' : ''),
      source_price: good.source_price ?? good.price ?? '',
      market_price: good.market_price ?? '',
      promotion_price: good.promotion_price ?? '',
      stock: good.stock ?? '',
      available_from: good.available_from || '',
      active: Boolean(good.active),
    });
    setImagesInput(Array.isArray(good.images) ? good.images.join('\n') : '');
    setError(null);
  }

  function deleteGood(id) {
    if (!window.confirm(t('Delete this good?') || 'Delete this good?')) return;
    api(`/api/admin/goods/${id}`, { method: 'DELETE' }).then(() => {
      if (editingId === id) resetForm();
      load();
    }).catch((err) => {
      setError(err?.data?.error || err?.response?.data?.error || 'server_error');
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <h1 className="h1">{t('Goods') || 'Goods'}</h1>
        <button type="button" onClick={toggleAddForm} style={{ backgroundColor: '#007bff', color: '#fff', fontWeight: 700, fontSize: 16, padding: '10px 16px', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{t('Add Goods') || 'Add Goods'}</button>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>{t('Filter by category') || 'Filter by category'}: </label>
        <ClearableInput
          list="goods-category-filter-options"
          value={categoryFilter}
          onChange={(e) => {
            const nextValue = e.target.value;
            setCategoryFilter(nextValue);
            load(nextValue);
          }}
          style={{ minWidth: 220 }}
        />
        <datalist id="goods-category-filter-options">
          {categories.map((category) => (
            <option key={`filter-${category.id}`} value={category.name} />
          ))}
        </datalist>
        <button
          type="button"
          disabled={!hasActiveFilter}
          onClick={(e) => {
            e.preventDefault();
            setCategoryFilter('');
            load('');
          }}
          style={{
            fontWeight: 700,
            fontSize: 16,
            padding: '6px 12px',
            border: hasActiveFilter ? '2px solid #007bff' : '2px solid #007bff',
            borderRadius: 6,
            backgroundColor: hasActiveFilter ? '#fff' : '#e0e0e0',
            color: hasActiveFilter ? '#007bff' : '#6c757d',
            cursor: hasActiveFilter ? 'pointer' : 'not-allowed',
            opacity: hasActiveFilter ? 1 : 0.85,
          }}
        >
          {t('Clear the Filter') || 'Clear the Filter'}
        </button>
      </div>

      {(showAddForm || editingId) ? (
        <div style={{ marginBottom: 20 }}>
          <form onSubmit={submit}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Name') || 'Name'}
              <ClearableInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Code') || 'Code'}
              <ClearableInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 220 }}>
              {t('Category') || 'Category'}
              <ClearableInput
                list="goods-category-options"
                value={form.category}
                onChange={(e) => {
                  const nextCategory = e.target.value;
                    const options = getCuttingOptions(nextCategory);
                    const nextCutting = options.includes(form.cutting) ? form.cutting : (options.includes('Whole') ? 'Whole' : '');
                    setForm({ ...form, category: nextCategory, cutting: nextCutting });
                }}
              />
            </label>
            <datalist id="goods-category-options">
              {categories.map((category) => (
                <option key={category.id} value={category.name} />
              ))}
            </datalist>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Sale Mode') || 'Sale Mode'}
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="normal">{t('Normal') || 'Normal'}</option>
                <option value="fresh_preorder">{t('Fresh pre-order') || 'Fresh pre-order'}</option>
              </select>
            </label>
            {getCuttingOptions(form.category).length > 0 ? (
              <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
                {t('Cuttings') || 'Cuttings'}
                <select value={form.cutting || ''} onChange={(e) => setForm({ ...form, cutting: e.target.value })}>
                  <option value="">{t('Select cutting') || 'Select cutting'}</option>
                  {getCuttingOptions(form.category).map((option) => (
                      <option key={option} value={option}>{t(option) || option}</option>
                    ))}
                </select>
              </label>
            ) : null}
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Source price (admin)') || 'Source price (admin)'}
              <ClearableInput type="number" step="0.01" value={form.source_price} onChange={(e) => setForm({ ...form, source_price: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Market price (consumer)') || 'Market price (consumer)'}
              <ClearableInput type="number" step="0.01" value={form.market_price} onChange={(e) => setForm({ ...form, market_price: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Promotion price (consumer, final)') || 'Promotion price (consumer, final)'}
              <ClearableInput type="number" step="0.01" value={form.promotion_price} onChange={(e) => setForm({ ...form, promotion_price: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
              {t('Stock') || 'Stock'}
              <ClearableInput type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Available from') || 'Available from'}
              <ClearableInput type="date" value={form.available_from} onChange={(e) => setForm({ ...form, available_from: e.target.value })} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 140, fontWeight: 700, marginTop: 12 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 20, height: 20, margin: 0 }} />
              {t('On Shelf') || 'On Shelf'}
            </label>
          </div>
          <div style={{ marginBottom: 8, marginTop: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 4 }}>
              {t('Image URLs') || 'Image URLs'}
              <ClearableInput
                as="textarea"
                value={imagesInput}
                onChange={(e) => setImagesInput(e.target.value)}
                placeholder={t('One URL per line or comma separated') || 'One URL per line or comma separated'}
                rows={3}
                style={{ width: '100%', minHeight: 72, resize: 'vertical' }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="submit" style={{ fontWeight: 700, fontSize: 17 }}>{editingId ? (t('Update Goods') || 'Update Goods') : (t('Confirm to Add Goods') || 'Confirm to Add Goods')}</button>
            {(showAddForm || editingId) ? <button type="button" onClick={resetForm} style={{ fontWeight: 700, fontSize: 17, marginLeft: 0 }}>{t('Cancel') || 'Cancel'}</button> : null}
            {error && <span style={{ color: 'red', marginLeft: 12 }}>{error}</span>}
          </div>
          </form>
        </div>
      ) : null}

      <div>
        {loading ? <div>{t('Loading...') || 'Loading...'}</div> : (
          <div>
            {goods.length === 0 ? <div>{t('No goods') || 'No goods'}</div> : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {goods.map(g => (
                  <li key={g.id} style={{ padding: 12, border: '1px solid #eee', marginBottom: 8, borderRadius: 6 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div>
                          <strong>{g.name}</strong>
                          <div style={{ color: '#666' }}>{g.code ? `Code: ${g.code}` : ''} {g.category ? `· ${g.category}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => startEdit(g)}>{t('Edit') || 'Edit'}</button>
                          <button type="button" onClick={() => deleteGood(g.id)}>{t('Remove') || 'Remove'}</button>
                        </div>
                      </div>
                      <div style={{ color: '#666' }}>{g.kind} · Source: ${g.source_price ?? g.price ?? 0} · Market: ${g.market_price ?? 0} · Promotion: ${g.promotion_price ?? 0} · stock: {g.stock}{g.cutting ? ` · Cutting: ${t(g.cutting) || g.cutting}` : ''}</div>
                      {Array.isArray(g.images) && g.images.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                          {g.images.map((img, idx) => (
                            <img key={`${g.id}-${idx}`} src={img} alt={`${g.name} ${idx + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
