import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api.js';
import ClearableInput from '../../components/ClearableInput';
import CuttingSelector, { getCuttingOptions } from '../../components/CuttingSelector.jsx';
import { getCategoryNameLabel } from '../../i18n.js';

export default function AdminGoods() {
  const { t } = useTranslation();
  const [goods, setGoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const hasActiveFilter = Boolean(categoryFilter?.trim());

  const emptyForm = { name: '', code: '', category: '', subcategory: '', kind: 'normal', cutting: '', source_price: '', market_price: '', promotion_price: '', stock: '', weight: '', available_from: '', active: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [promotionPriceAuto, setPromotionPriceAuto] = useState(true);
  const [error, setError] = useState(null);

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setPromotionPriceAuto(true);
    setShowAddForm(false);
  }

  

  function load(nextFilter = categoryFilter) {
    setLoading(true);
    const q = nextFilter ? `?category=${encodeURIComponent(nextFilter)}` : '';
    api(`/api/admin/goods${q}`).then((res) => {
      setGoods(res.goods || []);
    }).catch((e) => {
      console.error(e);
    }).finally(() => setLoading(false));
  }

  function applyCategoryFilter(nextValue = categoryFilter) {
    load(nextValue);
  }

  const subcategoryOptions = form.category
    ? [...new Set(goods.filter((good) => good.category === form.category && good.subcategory).map((good) => good.subcategory))]
    : [];

  useEffect(() => {
    load('');
    api('/api/admin/goods-categories')
      .then((res) => setCategories(res.categories || []))
      .catch((err) => {
        console.error('Failed loading goods categories', err);
      });
  }, []);

  function submit(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      code: form.code || null,
      category: form.category || null,
      subcategory: form.subcategory || null,
      kind: form.kind,
      cutting: form.cutting || null,
      source_price: form.source_price || null,
      market_price: form.market_price || null,
      promotion_price: form.promotion_price || null,
      stock: form.stock || null,
      weight: form.weight || null,
      available_from: form.available_from || null,
      active: form.active,
    };
    const request = editingId
      ? api(`/api/admin/goods/${editingId}`, { method: 'PATCH', body: payload })
      : api('/api/admin/goods', { method: 'POST', body: payload });

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
    setError(null);
  }

  function startEdit(good) {
    setEditingId(good.id);
    setShowAddForm(true);
    const sourcePrice = good.source_price ?? good.price ?? '';
    const marketPrice = good.market_price ?? '';
    const promotionPrice = good.promotion_price ?? '';
    setForm({
      name: good.name || '',
      code: good.code || '',
      category: good.category || '',
      subcategory: good.subcategory || '',
      kind: good.kind || 'normal',
      cutting: good.cutting || '',
      source_price: sourcePrice,
      market_price: marketPrice,
      promotion_price: promotionPrice,
      stock: good.stock ?? '',
      weight: good.weight ?? '',
      available_from: good.available_from || '',
      active: Boolean(good.active),
    });
    setPromotionPriceAuto(promotionPrice === '' || String(promotionPrice) === String(marketPrice));
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
        <h2 className="h2">{t('Goods') || 'Goods'}</h2>
        <button type="button" onClick={toggleAddForm} style={{ backgroundColor: '#007bff', color: '#fff', fontWeight: 700, fontSize: 16, padding: '10px 16px', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{t('Add Goods') || 'Add Goods'}</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>{t('Filter by category') || 'Filter by category'}: </label>
        <ClearableInput
          value={categoryFilter}
          onChange={(e) => {
            const nextValue = e.target.value;
            setCategoryFilter(nextValue);
            load(nextValue);
          }}
          style={{ marginLeft: 8 }}
        />
        <button
          type="button"
          disabled={!hasActiveFilter}
          onClick={(e) => {
            e.preventDefault();
            setCategoryFilter('');
            load('');
          }}
          style={{
            marginLeft: 8,
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
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Category') || 'Category'}
              <ClearableInput
                list="admin-goods-category-options"
                value={getCategoryNameLabel(form.category, t)}
                onChange={(e) => {
                  const nextDisplay = e.target.value;
                  const matched = categories.find((c) => getCategoryNameLabel(c.name, t) === nextDisplay);
                  const nextCategoryKey = matched ? matched.name : nextDisplay;
                  const nextCutting = getCuttingOptions(nextCategoryKey).includes(form.cutting) ? form.cutting : '';
                  setForm({ ...form, category: nextCategoryKey, cutting: nextCutting, subcategory: nextCategoryKey !== form.category ? '' : form.subcategory });
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Sub-Category') || 'Sub-Category'}
              <ClearableInput
                list="admin-goods-subcategory-options"
                value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                placeholder={t('Enter sub-category') || 'Enter sub-category'}
              />
            </label>
            <datalist id="admin-goods-category-options">
              {categories.map((category) => (
                <option key={category.id} value={getCategoryNameLabel(category.name, t)}>
                  {getCategoryNameLabel(category.name, t)}
                </option>
              ))}
            </datalist>
            <datalist id="admin-goods-subcategory-options">
              {subcategoryOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Sale Mode') || 'Sale Mode'}
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="normal">{t('Normal') || 'Normal'}</option>
                <option value="fresh_preorder">{t('Pre-Order') || 'Pre-Order'}</option>
              </select>
            </label>
            <CuttingSelector category={form.category} value={form.cutting} onChange={(cutting) => setForm({ ...form, cutting })} />
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Source price (admin)') || 'Source price (admin)'}
              <ClearableInput
                type="number"
                step="0.01"
                value={form.source_price}
                onChange={(e) => setForm({ ...form, source_price: e.target.value })}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Market price (consumer)') || 'Market price (consumer)'}
              <ClearableInput
                type="number"
                step="0.01"
                value={form.market_price}
                onChange={(e) => {
                  const nextMarket = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    market_price: nextMarket,
                    promotion_price: promotionPriceAuto ? nextMarket : prev.promotion_price,
                  }));
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
              {t('Promotion price (consumer, final)') || 'Promotion price (consumer, final)'}
              <ClearableInput
                type="number"
                step="0.01"
                value={form.promotion_price}
                onChange={(e) => {
                  setPromotionPriceAuto(false);
                  setForm({ ...form, promotion_price: e.target.value });
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
              {t('Stock') || 'Stock'}
              <ClearableInput type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
              {t('Weight(gram)') || 'Weight(gram)'}
              <ClearableInput type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <strong>{g.name}</strong>
                          <div style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>{g.code ? `Code: ${g.code}` : ''} {g.category ? `· ${getCategoryNameLabel(g.category, t)}` : ''}{g.subcategory ? ` / ${g.subcategory}` : ''}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: Boolean(g.active) ? '#d1fae5' : '#fee2e2', color: Boolean(g.active) ? '#166534' : '#991b1b', fontWeight: 700, fontSize: 12 }}>
                              {Boolean(g.active) ? (t('On Shelf') || 'On Shelf') : (t('Off Shelf') || 'Off Shelf')}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button type="button" onClick={() => startEdit(g)}>{t('Edit') || 'Edit'}</button>
                          <button type="button" onClick={() => deleteGood(g.id)}>{t('Remove') || 'Remove'}</button>
                        </div>
                      </div>
                      <div style={{ color: '#666' }}>
                        {g.kind} · Source: ${g.source_price ?? g.price ?? 0} · Market: ${g.market_price ?? 0} · Promotion: ${g.promotion_price ?? 0} · stock: {g.stock}{g.weight ? ` · Weight: ${g.weight}g` : ''}{g.cutting ? ` · Cutting: ${g.cutting}` : ''}
                      </div>
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
