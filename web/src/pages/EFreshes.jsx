import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import CuttingSelector, { getCuttingOptions } from '../components/CuttingSelector.jsx';

const CART_STORAGE_KEY = 'efreshes-cart';

function formatPrice(value) {
  const amount = Number(value ?? 0);
  return `$${amount.toFixed(2)}`;
}

export default function EFreshes() {
  const { t } = useTranslation();
  const [goods, setGoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCuttings, setSelectedCuttings] = useState({});
  const [quantities, setQuantities] = useState({});

  const loadGoods = async () => {
    try {
      setLoading(true);
      const res = await api('/api/goods?kind=fresh_preorder');
      setGoods(res.goods || []);
      setError('');
    } catch (err) {
      setError(err.message || 'request_failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const runLoad = async () => {
      if (!mounted) return;
      await loadGoods();
    };

    runLoad();
    return () => { mounted = false; };
  }, []);

  const freshGoods = useMemo(() => {
    return goods.filter((good) => (good.kind || 'normal') === 'fresh_preorder');
  }, [goods]);

  const handleCuttingChange = (goodId, cutting) => {
    setSelectedCuttings((prev) => ({ ...prev, [goodId]: cutting }));
  };

  const handleQuantityChange = (goodId, value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const safeValue = Math.max(1, Math.floor(parsed));
    setQuantities((prev) => ({ ...prev, [goodId]: safeValue }));
  };

  const adjustQuantity = (goodId, delta) => {
    const current = quantities[goodId] ?? 1;
    handleQuantityChange(goodId, current + delta);
  };

  const createCartKey = (item) => {
    return `${item.goodId}||${item.cutting || ''}||${item.category || ''}`;
  };

  const mergeCartItems = (items) => {
    const map = new Map();
    items.forEach((item) => {
      const key = createCartKey(item);
      if (map.has(key)) {
        const existing = map.get(key);
        map.set(key, {
          ...existing,
          quantity: (existing.quantity || 0) + (item.quantity || 0),
        });
      } else {
        map.set(key, { ...item, id: key });
      }
    });
    return Array.from(map.values());
  };

  const handleRequest = (good) => {
    const cuttingOptions = getCuttingOptions(good.category || '');
    const defaultCutting = cuttingOptions.includes('Whole') ? 'Whole' : (cuttingOptions[0] || '');
    const cutting = cuttingOptions.length > 0 ? (selectedCuttings[good.id] || defaultCutting) : 'Standard';
    if (cuttingOptions.length > 0 && !cutting) {
      setError(t('Please select a cutting before requesting this pre-order.') || 'Please select a cutting before requesting this pre-order.');
      return;
    }

    const quantity = quantities[good.id] ?? 1;
    const cartItem = {
      goodId: good.id,
      name: good.name,
      category: good.category,
      cutting,
      quantity,
      price: good.promotion_price ?? good.market_price ?? good.price,
      weight: good.weight,
      preorder: (good.kind || '') === 'fresh_preorder',
      createdAt: new Date().toISOString(),
    };

    try {
      const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
      const nextCart = mergeCartItems([cartItem, ...saved]);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextCart));
      window.dispatchEvent(new Event('efreshes-cart-updated'));
      setSelectedCuttings((prev) => ({ ...prev, [good.id]: cutting }));
      setError('');
      setSuccess(`${good.name} added to cart`);
    } catch (e) {
      setError('Unable to save cart');
    }
  };

  return (
    <div>
      <h1 className="h1">{t('eFreshes') || 'eFreshes'}</h1>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          {t('Pre-order fresh meat and seafood. Select a cutting for each item before requesting the pre-order.') || 'Pre-order fresh meat and seafood. Select a cutting for each item before requesting the pre-order.'}
        </p>
        {success ? (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            {success}
          </div>
        ) : null}
      </div>

      {loading ? <div className="card">{t('Loading') || 'Loading'}</div> : null}
      {error ? <div className="card" style={{ color: '#b91c1c' }}>{error}</div> : null}

      {!loading && freshGoods.length === 0 ? (
        <div className="card muted">{t('No fresh pre-order items available yet.') || 'No fresh pre-order items available yet.'}</div>
      ) : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {freshGoods.map((good) => {
          const selectedCutting = selectedCuttings[good.id] || '';
          const quantity = quantities[good.id] ?? 1;
          return (
            <div key={good.id} className="card" style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{good.name}</div>
                  <div className="muted" style={{ marginTop: 4 }}>{good.category || ''}</div>
                </div>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatPrice(good.promotion_price ?? good.market_price ?? good.price)}</div>
              </div>
              <div className="muted">
                {good.weight ? `${good.weight}g` : ''}
                {good.stock != null ? ` • ${t('Stock') || 'Stock'}: ${good.stock}` : ''}
              </div>
              {getCuttingOptions(good.category || '').length > 0 ? (
                <CuttingSelector
                  category={good.category}
                  value={selectedCutting || (getCuttingOptions(good.category || '').includes('Whole') ? 'Whole' : '')}
                  onChange={(value) => handleCuttingChange(good.id, value)}
                  label={t('Cuttings') || 'Cuttings'}
                />
              ) : null}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 180 }}>
                <span>{t('Quantity') || 'Quantity'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ width: 48, padding: '6px 0' }}
                    onClick={() => adjustQuantity(good.id, -1)}
                  >
                    <span style={{ fontSize: 24, lineHeight: 1 }}>−</span>
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(good.id, e.target.value)}
                    style={{ width: 70, textAlign: 'center' }}
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ width: 48, padding: '6px 0' }}
                    onClick={() => adjustQuantity(good.id, 1)}
                  >
                    <span style={{ fontSize: 24, lineHeight: 1 }}>+</span>
                  </button>
                </div>
              </label>
              <button type="button" className="btn secondary" onClick={() => handleRequest(good)}>
                {t('Add to Cart') || 'Add to Cart'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
