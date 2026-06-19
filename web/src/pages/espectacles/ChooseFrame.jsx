import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { useDraft } from '../../state/OrderDraftContext.jsx';
import { useCurrency } from '../../state/CurrencyContext.jsx';

function FrameModal({ frame, onClose }) {
  const { fmt } = useCurrency();
  const [idx, setIdx] = useState(0);
  const images = frame.images && frame.images.length ? frame.images : [{ url: '' }];
  const scrollerRef = React.useRef(null);
  const touchStartX = React.useRef(null);

  const goTo = (i) => {
    const clamped = Math.max(0, Math.min(images.length - 1, i));
    setIdx(clamped);
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  };

  const dragStartX = React.useRef(null);
  const dragScrollLeft = React.useRef(0);
  const dragMoved = React.useRef(false);

  const onPointerDown = (e) => {
    const el = scrollerRef.current;
    if (!el) return;
    dragStartX.current = e.clientX;
    dragScrollLeft.current = el.scrollLeft;
    dragMoved.current = false;
    el.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (dragStartX.current == null) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 5) dragMoved.current = true;
    el.scrollLeft = dragScrollLeft.current - dx;
  };
  const endPointer = (e) => {
    const el = scrollerRef.current;
    if (dragStartX.current == null || !el) { dragStartX.current = null; return; }
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    const width = el.clientWidth;
    let target = Math.round(dragScrollLeft.current / width);
    if (Math.abs(dx) > width * 0.2) target += dx < 0 ? 1 : -1;
    goTo(target);
    el.releasePointerCapture?.(e.pointerId);
  };

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) goTo(idx + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div style={{ position: 'relative' }}>
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            style={{
              display: 'flex',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              cursor: images.length > 1 ? 'grab' : 'default',
              touchAction: 'pan-y',
              userSelect: 'none',
            }}
          >
            {images.map((im, i) => (
              <img
                key={i}
                src={im.url}
                className="modal-img"
                draggable={false}
                style={{ flex: '0 0 100%', scrollSnapAlign: 'start', pointerEvents: 'none' }}
                alt=""
              />
            ))}
          </div>
          {images.length > 1 && (
            <>
              <button
                className="carousel-nav prev"
                onClick={() => goTo(idx - 1)}
                disabled={idx === 0}
                aria-label="Previous image"
              >‹</button>
              <button
                className="carousel-nav next"
                onClick={() => goTo(idx + 1)}
                disabled={idx === images.length - 1}
                aria-label="Next image"
              >›</button>
            </>
          )}
        </div>
        <div style={{ padding: '8px 16px' }}>
          <strong>{frame.name}</strong>
          <div className="muted">
            {(frame.promotion_price && Number(frame.promotion_price) > 0 && Number(frame.promotion_price) < Number(frame.base_price)) ? (
              <div>
                <span style={{ textDecoration: 'line-through', marginRight: 8 }}>{fmt(frame.base_price)}</span>
                <span style={{ fontWeight: 700 }}>{fmt(frame.promotion_price)}</span>
              </div>
            ) : (
              <div>{fmt(frame.base_price)}</div>
            )}
          </div>
        </div>
        {images.length > 1 && (
          <div className="modal-dots">
            {images.map((_, i) => (
              <div
                key={i}
                className={'modal-dot' + (i === idx ? ' active' : '')}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChooseFrame() {
  const [frames, setFrames] = useState([]);
  const [popup, setPopup] = useState(null);
  const { draft, setDraft } = useDraft();
  const { t } = useTranslation();
  const { fmt } = useCurrency();
  const nav = useNavigate();
  const cameFromOrdering = !!draft.cameFromOrdering;
  const [selected, setSelected] = useState(draft.frame || null);

  useEffect(() => {
    api('/api/frames').then(d => setFrames(d.frames));
  }, []);

  const onNext = () => {
    if (!selected) return;
    setDraft({ frame: selected });
    if ((cameFromOrdering || draft.checkupOrderId) && draft.eyesight) {
      setDraft({ cameFromOrdering: false });
      nav('/espectacles/ordering');
    } else {
      nav('/espectacles/eyesight');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="h1">{t('Please choose your favorite frame')}</h1>
        <button className="btn" style={{ width: 'auto', padding: '8px 16px' }} disabled={!selected} onClick={onNext}>
          {t('Next')}
        </button>
      </div>
      <div className="frames-grid">
        {frames.map(f => (
          <div
            key={f.id}
            className={'frame-card' + (selected && selected.id === f.id ? ' selected' : '')}
            onClick={() => { setSelected(f); setPopup(f); }}
          >
            {f.images && f.images[0] && (
              <img src={f.images[0].url} alt={f.name} />
            )}
            <div className="name">{f.name}</div>
            <div className="price">
              {(f.promotion_price && Number(f.promotion_price) > 0 && Number(f.promotion_price) < Number(f.base_price)) ? (
                <div>
                  <span style={{ textDecoration: 'line-through', marginRight: 8 }}>{fmt(f.base_price)}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(f.promotion_price)}</span>
                </div>
              ) : (
                <div>{fmt(f.base_price)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {popup && <FrameModal frame={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}
