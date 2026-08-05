import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SERVICES = [
  { key: 'electrician', emoji: '🔌', title: 'Electrician' },
  { key: 'plumber', emoji: '🔧', title: 'Plumber' },
  { key: 'carpenter', emoji: '🪚', title: 'Carpenter' },
  { key: 'tiler', emoji: '🧱', title: 'Tiler' },
  { key: 'locksmith', emoji: '🔐', title: 'Locksmith' },
  { key: 'aircon', emoji: '❄️', title: 'Aircon Services' },
];

const ORDER_STORAGE_KEY = 'eservices-order';

function slugFor(key) {
  return `/eservices/${key}`;
}

function loadInitialOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) {
      const map = Object.fromEntries(SERVICES.map((service) => [service.key, service]));
      return saved.map((key) => map[key]).filter(Boolean).concat(SERVICES.filter((service) => !saved.includes(service.key)));
    }
  } catch (e) {
    // ignore
  }
  return SERVICES;
}

export default function EServices() {
  const { t } = useTranslation();
  const [services, setServices] = useState(loadInitialOrder);
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const touchState = useRef(null);
  const suppressClickUntil = useRef(0);

  useEffect(() => {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(services.map((item) => item.key)));
  }, [services]);

  const persist = (next) => {
    setServices(next);
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next.map((item) => item.key)));
  };

  const reorder = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const fromIndex = services.findIndex((item) => item.key === fromKey);
    const toIndex = services.findIndex((item) => item.key === toKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = services.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persist(next);
  };

  const tileFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const tile = el.closest('[data-tilekey]');
    return tile ? tile.getAttribute('data-tilekey') : null;
  };

  const onDragStart = (key) => (e) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', key); } catch (err) { }
  };

  const onDragOver = (key) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overKey !== key) setOverKey(key);
  };

  const onDrop = (e, key) => {
    e.preventDefault();
    reorder(dragKey, key);
    setDragKey(null);
    setOverKey(null);
    suppressClickUntil.current = Date.now() + 350;
  };

  const onDragEnd = () => {
    setDragKey(null);
    setOverKey(null);
  };

  const onTouchStart = (key) => (e) => {
    const t = e.touches[0];
    touchState.current = {
      key,
      startX: t.clientX,
      startY: t.clientY,
      activated: false,
      moved: false,
      timer: window.setTimeout(() => {
        if (!touchState.current || touchState.current.key !== key) return;
        touchState.current.activated = true;
        setDragKey(key);
      }, 220),
    };
  };

  const onTouchMove = (e) => {
    const st = touchState.current;
    if (!st) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - st.startX);
    const dy = Math.abs(t.clientY - st.startY);
    if (!st.activated) {
      if (dx > 10 || dy > 10) {
        clearTimeout(st.timer);
        touchState.current = null;
      }
      return;
    }
    if (!st.moved && (dx > 4 || dy > 4)) st.moved = true;
    e.preventDefault();
    const over = tileFromPoint(t.clientX, t.clientY);
    setOverKey(over);
  };

  const onTouchEnd = () => {
    const st = touchState.current;
    touchState.current = null;
    if (!st) return;
    clearTimeout(st.timer);
    if (st.activated && st.moved) {
      reorder(st.key, overKey);
      suppressClickUntil.current = Date.now() + 350;
    }
    setDragKey(null);
    setOverKey(null);
  };

  const onTileClick = (e) => {
    if (Date.now() < suppressClickUntil.current) e.preventDefault();
  };

  return (
    <div>
      <h1 className="h1">{t('eServices') || 'eServices'}</h1>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>{t('Find trusted local professionals for common home services.') || 'Find trusted local professionals for common home services.'}</p>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div
          className="home-grid eservices-grid"
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {services.map((s) => {
            const isDragging = dragKey === s.key;
            const isOver = overKey === s.key && dragKey && dragKey !== s.key;
            return (
              <Link
                key={s.key}
                to={slugFor(s.key)}
                className="home-tile"
                data-tilekey={s.key}
                draggable
                onDragStart={onDragStart(s.key)}
                onDragOver={onDragOver(s.key)}
                onDrop={(e) => onDrop(e, s.key)}
                onDragEnd={onDragEnd}
                onTouchStart={onTouchStart(s.key)}
                onClick={onTileClick}
                style={{
                  opacity: isDragging ? 0.4 : 1,
                  outline: isOver ? '2px dashed var(--primary)' : undefined,
                  outlineOffset: isOver ? '-2px' : undefined,
                  transform: isDragging ? 'scale(0.97)' : undefined,
                  transition: 'transform .12s, opacity .12s',
                }}
              >
                <div className="emoji" style={{ fontSize: 'calc(var(--ui-scale) * 42px)' }}>{s.emoji}</div>
                <div className="title" style={{ marginTop: 6, fontSize: '0.95rem' }}>{t(s.title) || s.title}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
