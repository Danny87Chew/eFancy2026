import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';

const CART_STORAGE_KEY = 'efreshes-cart';

function formatPrice(value) {
  const amount = Number(value ?? 0);
  return amount ? `$${amount.toFixed(2)}` : '-';
}

const createCartKey = (item) => `${item.goodId}||${item.category || ''}`;

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

export default function EGroceries() {
  const { t } = useTranslation();
  const [goods, setGoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [quantities, setQuantities] = useState({});

  const loadGoods = async () => {
    try {
      setLoading(true);
      const res = await api('/api/goods?kind=grocery');
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
    const run = async () => {
      if (!mounted) return;
      await loadGoods();
    };
    run();
    return () => { mounted = false; };
  }, []);

  const visibleGoods = useMemo(() => goods, [goods]);

  const handleQuantityChange = (goodId, value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const next = Math.max(1, Math.floor(parsed));
    setQuantities((prev) => ({ ...prev, [goodId]: next }));
  };

  const adjustQuantity = (goodId, delta) => {
    const current = quantities[goodId] ?? 1;
    handleQuantityChange(goodId, current + delta);
  };

  const handleAddToCart = (good) => {
    const quantity = quantities[good.id] ?? 1;
    const cartItem = {
      goodId: good.id,
      name: good.name,
      category: good.category,
      quantity,
      price: good.promotion_price ?? good.market_price ?? good.price,
      weight: good.weight,
      createdAt: new Date().toISOString(),
    };

    try {
      const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
      const nextCart = mergeCartItems([cartItem, ...saved]);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextCart));
      window.dispatchEvent(new Event('efreshes-cart-updated'));
      setQuantities((prev) => ({ ...prev, [good.id]: quantity }));
      setSuccess(`${good.name} ${t('added_to_cart') || 'added to cart'}`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (e) {
      setError('Unable to save cart');
    }
  };

  return (
    <div>
      <h1 className="h1">{t('eGroceries') || 'eGroceries'}</h1>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          {t('Order groceries and pantry items for quick delivery.') || 'Order groceries and pantry items for quick delivery.'}
        </p>
        {success ? (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            {success}
          </div>
        ) : null}
      </div>

      {loading ? <div className="card">{t('Loading') || 'Loading'}</div> : null}
      {error ? <div className="card" style={{ color: '#b91c1c' }}>{error}</div> : null}

      {!loading && visibleGoods.length === 0 ? (
        <div className="card muted">{t('No groceries available yet.') || 'No groceries available yet.'}</div>
      ) : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {visibleGoods.map((good) => {
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <span>{t('Qty') || 'Qty'}:</span>
                  <button type="button" className="btn secondary" style={{ width: 44, padding: '6px 0' }} onClick={() => adjustQuantity(good.id, -1)}>-</button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(good.id, e.target.value)}
                    style={{ width: 60, textAlign: 'center' }}
                  />
                  <button type="button" className="btn secondary" style={{ width: 44, padding: '6px 0' }} onClick={() => adjustQuantity(good.id, 1)}>+</button>
                </label>
                <button type="button" className="btn" style={{ minWidth: 130 }} onClick={() => handleAddToCart(good)}>
                  {t('Add to Cart') || 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
