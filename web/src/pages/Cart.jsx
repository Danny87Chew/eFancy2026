import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { calculateCartTotals, getSelectedCheckoutItems } from './cartUtils.js';

const CART_STORAGE_KEY = 'efreshes-cart';

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

export default function Cart() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
      const merged = mergeCartItems(saved);
      setItems(merged);
      setSelectedIds(merged.map((item) => item.id));
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      setItems([]);
    }
  }, []);

  const updateStorage = (nextItems) => {
    const merged = mergeCartItems(nextItems);
    setItems(merged);
    setSelectedIds((prev) => {
      const nextSelected = prev.filter((id) => merged.some((item) => item.id === id));
      if (nextSelected.length === 0 && merged.length > 0) {
        return merged.map((item) => item.id);
      }
      return nextSelected;
    });
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event('efreshes-cart-updated'));
  };

  const removeItem = (id) => {
    const nextItems = items.filter((item) => item.id !== id);
    updateStorage(nextItems);
  };

  const changeQuantity = (id, nextQuantity) => {
    if (nextQuantity < 1) return;
    const nextItems = items.map((item) => item.id === id ? { ...item, quantity: nextQuantity } : item);
    updateStorage(nextItems);
  };

  const cartTotals = calculateCartTotals(items);
  const selectedItems = getSelectedCheckoutItems(items, selectedIds);
  const checkoutTotal = calculateCartTotals(selectedItems).reduce((sum, item) => sum + item.subtotal, 0);
  const formatPrice = (amount) => Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const toggleItemSelection = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]);
  };

  const selectAllItems = () => {
    setSelectedIds(items.map((item) => item.id));
  };

  const handleCheckout = async () => {
    if (selectedItems.length === 0) return;
    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const result = await api('/api/orders/efreshes', {
        method: 'POST',
        body: {
          items: selectedItems,
          total: checkoutTotal,
        },
      });

      const remainingItems = items.filter((item) => !selectedIds.includes(item.id));
      const mergedRemaining = mergeCartItems(remainingItems);
      setItems(mergedRemaining);
      setSelectedIds([]);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(mergedRemaining));
      window.dispatchEvent(new Event('efreshes-cart-updated'));
      if (result?.order?.id) {
        navigate(`/espectacles/pay/${result.order.id}`);
      } else {
        navigate('/orders');
      }
    } catch (error) {
      setCheckoutError(error?.data?.error || error.message || 'checkout_failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h1 className="h1" style={{ margin: 0 }}>{t('Cart')}</h1>
        <button
          type="button"
          className="btn"
          style={{ minWidth: 90, width: '37.5%', fontSize: '1.5rem' }}
          onClick={handleCheckout}
          disabled={selectedItems.length === 0 || checkoutLoading}
        >
          {checkoutLoading
            ? t('Processing...') || 'Processing...'
            : `${t('Checkout') || 'Checkout'} (${selectedItems.length})`}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="card muted">
          {t('Your cart is empty.') || 'Your cart is empty.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{selectedItems.length} {t('Item(s) Selected') || 'Item(s) Selected'}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={selectAllItems}
                disabled={selectedIds.length === items.length}
                style={{ whiteSpace: 'nowrap' }}
              >
                {t('Select all') || 'Select all'}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setSelectedIds([])}
                disabled={selectedIds.length === 0}
                style={{ whiteSpace: 'nowrap', minWidth: 118 }}
              >
                {t('Un-select all') || 'Un-select all'}
              </button>
            </div>
          </div>
          {items.map((item) => {
            const subtotal = cartTotals.find((entry) => entry.id === item.id)?.subtotal || 0;
            const isSelected = selectedIds.includes(item.id);

            return (
            <div key={item.id} className="card" style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItemSelection(item.id)}
                    style={{ marginTop: 4, width: 22, height: 22, flexShrink: 0 }}
                  />
                  <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div className="muted">
                      {item.category || ''}
                      {item.cutting ? ` • ${item.cutting}` : ''}
                      {item.weight ? ` • ${item.weight}g` : ''}
                      {typeof item.price === 'number' ? ` • ${Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price)}` : ''}
                      {item.preorder ? ` • ${t('Pre-order') || 'Pre-order'}` : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '6px 10px', minWidth: 'auto', width: 'auto', display: 'inline-flex' }}
                  onClick={() => removeItem(item.id)}
                >
                  {t('Remove') || 'Remove'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>{t('Qty') || 'Qty'}:</span>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: 44, padding: '6px 0', fontSize: 20, lineHeight: 1 }}
                  onClick={() => changeQuantity(item.id, (item.quantity || 1) - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity || 1}
                  onChange={(e) => changeQuantity(item.id, Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                  style={{ width: 48, textAlign: 'center' }}
                />
                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: 44, padding: '6px 0', fontSize: 20, lineHeight: 1 }}
                  onClick={() => changeQuantity(item.id, (item.quantity || 1) + 1)}
                >
                  +
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: 8, fontWeight: 600 }}>
                <span>{t('Subtotal') || 'Subtotal'}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
            </div>
            );
          })}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
            <span>{t('Checkout Total') || 'Checkout Total'}</span>
            <span>{formatPrice(checkoutTotal)}</span>
          </div>
          {checkoutError ? (
            <div className="card muted" style={{ color: 'var(--red, #b91c1c)' }}>
              {checkoutError}
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn"
              style={{ width: '37.5%', fontSize: '1.5rem' }}
              onClick={handleCheckout}
              disabled={selectedItems.length === 0 || checkoutLoading}
            >
              {checkoutLoading
                ? t('Processing...') || 'Processing...'
                : `${t('Checkout') || 'Checkout'} (${selectedItems.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
