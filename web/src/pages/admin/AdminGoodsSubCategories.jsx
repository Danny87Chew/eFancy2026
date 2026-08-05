import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api.js';
import { getCategoryNameLabel } from '../../i18n.js';
import ClearableInput from '../../components/ClearableInput';

export default function AdminGoodsSubCategories() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [subCategoriesByParent, setSubCategoriesByParent] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!selectedCategory) return;
    setSearch(getCategoryNameLabel(selectedCategory.name, t));
  }, [selectedCategory, t, i18n.language]);

  const loadSubCategories = (parentId) => {
    if (!parentId) return;
    api(`/api/admin/goods-categories/${parentId}/subcategories`)
      .then((res) => {
        setSubCategoriesByParent((prev) => ({ ...prev, [parentId]: res.subcategories || [] }));
      })
      .catch((err) => {
        console.error(err);
        setError(err?.data?.error || err?.response?.data?.error || 'server_error');
      });
  };

  useEffect(() => {
    setLoading(true);
    api('/api/admin/goods-categories')
      .then((res) => {
        const loaded = res.categories || [];
        setCategories(loaded);
        const defaultCategory = loaded.find((category) => category.name === 'Groceries');
        if (defaultCategory) {
          setSelectedCategory(defaultCategory);
          setSearch(getCategoryNameLabel(defaultCategory.name, t));
          setDropdownOpen(false);
          loadSubCategories(defaultCategory.id);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err?.data?.error || err?.response?.data?.error || 'server_error');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const filteredCategories = categories.filter((category) => {
    if (!search) return true;
    const label = getCategoryNameLabel(category.name, t).toLowerCase();
    return category.name.toLowerCase().includes(search.toLowerCase()) || label.includes(search.toLowerCase());
  });

  const handleSelect = (category) => {
    setSelectedCategory(category);
    setSearch(getCategoryNameLabel(category.name, t));
    setDropdownOpen(false);
    loadSubCategories(category.id);
  };

  const clearSelection = () => {
    setSelectedCategory(null);
    setSearch('');
    setDropdownOpen(false);
  };

  const handleAddSubCategory = () => {
    if (!selectedCategory || !newSubCategoryName.trim()) return;
    api(`/api/admin/goods-categories/${selectedCategory.id}/subcategories`, {
      method: 'POST',
      body: { name: newSubCategoryName.trim() },
    })
      .then((res) => {
        setSubCategoriesByParent((prev) => {
          const parentId = selectedCategory.id;
          const existing = prev[parentId] || [];
          return {
            ...prev,
            [parentId]: [...existing, res.subcategory],
          };
        });
        setNewSubCategoryName('');
      })
      .catch((err) => {
        console.error(err);
        setError(err?.data?.error || err?.response?.data?.error || 'server_error');
      });
  };

  const currentSubCategories = selectedCategory ? subCategoriesByParent[selectedCategory.id] || [] : [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 className="h2" style={{ margin: 0 }}>{t('Sub-Categories') || 'Sub-Categories'}</h2>
        <button type="button" className="btn secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => navigate('/admin/goods-categories')}>
          {t('Back') || 'Back'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('Manage sub-category groups for goods here.') || 'Manage sub-category groups for goods here.'}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16, position: 'relative' }} ref={dropdownRef}>
        <ClearableInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedCategory(null);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          placeholder={t('Search and choose a main category') || 'Search and choose a main category'}
          style={{ minWidth: 260 }}
        />

        {dropdownOpen && !loading && categories.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 100, width: '40%', marginTop: -24, zIndex: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 12px 24px rgba(0,0,0,0.08)', maxHeight: 260, overflowY: 'auto' }}>
            {filteredCategories.length === 0 ? (
              <div style={{ padding: '12px 14px' }} className="muted">
                {t('No matching categories') || 'No matching categories'}
              </div>
            ) : (
              filteredCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleSelect(category)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {getCategoryNameLabel(category.name, t)}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>
            {selectedCategory
              ? t('Selected category') || 'Selected category'
              : t('Choose a main category to add sub-categories') || 'Choose a main category to add sub-categories'}
          </div>
          <div style={{ fontWeight: 700 }}>
            {selectedCategory ? getCategoryNameLabel(selectedCategory.name, t) : t('No category selected yet') || 'No category selected yet'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 10, fontWeight: 600 }}>
          {t('New Sub-Category name') || 'New Sub-Category name'}
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <ClearableInput
            value={newSubCategoryName}
            onChange={(e) => setNewSubCategoryName(e.target.value)}
            placeholder={t('Enter sub-category name') || 'Enter sub-category name'}
            style={{ minWidth: 260, flex: 1 }}
          />
          <button
            type="button"
            className="btn"
            onClick={handleAddSubCategory}
            disabled={!selectedCategory || !newSubCategoryName.trim()}
            style={{ width: 'auto', padding: '10px 16px' }}
          >
            {t('Add Sub-Categories') || 'Add Sub-Categories'}
          </button>
        </div>
        {selectedCategory && currentSubCategories.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
              {t('Current sub-categories') || 'Current sub-categories'}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {currentSubCategories.map((subcategory) => (
                <li key={subcategory.id} style={{ padding: '10px 12px', border: '1px solid #eee', borderRadius: 6, marginBottom: 8 }}>
                  {getCategoryNameLabel(subcategory.name, t)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {error ? (
        <div className="card" style={{ color: 'red' }}>
          {t(error) || error}
        </div>
      ) : loading ? (
        <div>{t('Loading...') || 'Loading...'}</div>
      ) : null}
    </div>
  );
}
