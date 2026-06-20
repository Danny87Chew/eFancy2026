import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const DEFAULT = [
  { key: 'espectacles', emoji: '👓', title: 'eSpectacles', to: '/espectacles' },
  { key: 'egroceries', emoji: '🛍️', title: 'eGroceries', to: '/egroceries' },
  { key: 'efreshes', emoji: '🥬', title: 'eFreshes', to: '/efreshes' },
  { key: 'eservices', emoji: '🛠️', title: 'eServices', to: '/eservices' },
];

const ORDER_KEY = 'efancy_home_order';

function loadInitial() {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null');
    if (Array.isArray(saved)) {
      const map = Object.fromEntries(DEFAULT.map((t) => [t.key, t]));
      return saved.map((k) => map[k]).filter(Boolean).concat(DEFAULT.filter((t) => !saved.includes(t.key)));
    }
  } catch {}
  return DEFAULT;
}

export default function Home() {
  const { t } = useTranslation();
  const [tiles, setTiles] = useState(loadInitial);
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);

  // Touch DnD state
  const touchState = useRef(null); // { key, startX, startY, activated, moved, timer }
  const suppressClickUntil = useRef(0);

  const persist = (next) => {
    setTiles(next);
    localStorage.setItem(ORDER_KEY, JSON.stringify(next.map((t) => t.key)));
  };

  const reorder = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const from = tiles.findIndex((t) => t.key === fromKey);
    const to = tiles.findIndex((t) => t.key === toKey);
    if (from < 0 || to < 0) return;
    const next = tiles.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next);
  };

  // HTML5 DnD (desktop / pointer with mouse)
  const onDragStart = (key) => (e) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', key); } catch {}
  };
  const onDragOver = (key) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overKey !== key) setOverKey(key);
  };
  const onDrop = (key) => (e) => {
    e.preventDefault();
    reorder(dragKey, key);
    setDragKey(null);
    setOverKey(null);
    suppressClickUntil.current = Date.now() + 350;
  };
  const onDragEnd = () => { setDragKey(null); setOverKey(null); };
  const onTileClick = (e) => {
    if (Date.now() < suppressClickUntil.current) e.preventDefault();
  };

  // Touch DnD (mobile)
  const tileFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const tile = el.closest('[data-tilekey]');
    return tile ? tile.getAttribute('data-tilekey') : null;
  };
  const onTouchStart = (key) => (e) => {
    const t = e.touches[0];
    const st = {
      key,
      startX: t.clientX,
      startY: t.clientY,
      activated: false,
      moved: false,
      timer: null,
    };
    st.timer = setTimeout(() => {
      if (!touchState.current || touchState.current.key !== key) return;
      touchState.current.activated = true;
      setDragKey(key);
    }, 220);
    touchState.current = st;
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

  return (
    <div>
      <div>
        <h1 className="h1" style={{ marginBottom: 2 }}>{t('Welcome to eFancy!')}</h1>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>{t('Drag to reorder. On touch devices, press and hold a tile, then drag.')}</p>
      <div
        className="home-grid"
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {tiles.map((tile) => {
          const isDragging = dragKey === tile.key;
          const isOver = overKey === tile.key && dragKey && dragKey !== tile.key;
          const style = {
            opacity: isDragging ? 0.4 : 1,
            outline: isOver ? '2px dashed var(--primary)' : undefined,
            outlineOffset: isOver ? '-2px' : undefined,
            transform: isDragging ? 'scale(0.97)' : undefined,
            transition: 'transform .12s, opacity .12s',
            cursor: 'grab',
            touchAction: 'manipulation',
            userSelect: 'none',
          };
          return (
            <Link
              key={tile.key}
              data-tilekey={tile.key}
              className="home-tile"
              style={style}
              to={tile.to}
              draggable
              onDragStart={onDragStart(tile.key)}
              onDragOver={onDragOver(tile.key)}
              onDrop={onDrop(tile.key)}
              onDragEnd={onDragEnd}
              onTouchStart={onTouchStart(tile.key)}
              onClick={onTileClick}
            >
              <div className="emoji">{tile.emoji}</div>
              <div className="title" style={{ fontSize: 36 }}>{t(tile.title)}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
