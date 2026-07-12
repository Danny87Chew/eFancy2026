import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useDraft } from '../../state/OrderDraftContext.jsx';
import { useCurrency } from '../../state/CurrencyContext.jsx';
import { useTranslation } from 'react-i18next';

const THICKNESS = ['1.50', '1.56', '1.60', '1.67', '1.74'];

function maxAbsSph(eye) {
  const l = Math.abs(Number(eye?.l_sph) || 0);
  const r = Math.abs(Number(eye?.r_sph) || 0);
  return Math.max(l, r);
}
function suggestThickness(eye) {
  const m = maxAbsSph(eye);
  if (m <= 2) return '1.50';
  if (m <= 4) return '1.56';
  if (m <= 5.5) return '1.60';
  if (m <= 7) return '1.67';
  return '1.74';
}

export default function Ordering() {
  const { draft, setDraft } = useDraft();
  const { fmt } = useCurrency();
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [brands, setBrands] = useState([]);
  const lang = i18n.language || 'en';
  const zhTwoCharSpacing = (text) => (
    lang.startsWith('zh') && typeof text === 'string' && /^[\u4e00-\u9fff]{2}$/.test(text)
      ? { letterSpacing: '0.12em' }
      : {}
  );
  const eyesight = draft.eyesight;
  const frame = draft.frame;
  const suggested = useMemo(() => suggestThickness(eyesight), [eyesight]);
  const [lens, setLens] = useState(draft.lens || {
    thickness: suggested,
    blueLight: false,
    photochromic: false,
    progressive: false,
    brand_id: null,
  });

  useEffect(() => {
    api('/api/lens-brands').then((d) => {
      const nextBrands = d.brands || [];
      setBrands(nextBrands);
      setLens((prev) => {
        if (prev?.brand_id != null) return prev;
        const genericBrand = nextBrands.find((b) => (b.brand || b.name || '').toLowerCase() === 'generic');
        return genericBrand ? { ...prev, brand_id: genericBrand.id } : prev;
      });
    });
  }, []);

  if (!frame || !eyesight) {
    return (
      <div>
        {t('Missing data.')} <button className="btn" onClick={() => nav('/espectacles/frames')}>{t('Restart')}</button>
      </div>
    );
  }

  const brand = brands.find(b => b.id === lens.brand_id) || brands[0];
  const thicknessMultiplier = { '1.50':1, '1.56':1.1, '1.60':1.25, '1.67':1.5, '1.74':1.8 }[lens.thickness] || 1;
  const lensBase = 40 * thicknessMultiplier * (brand ? brand.price_multiplier : 1);
  const addons = (lens.blueLight?20:0) + (lens.photochromic?40:0) + (lens.progressive?80:0);
  const frameBase = Number(frame.base_price) || 0;
  const framePromo = (frame.promotion_price && Number(frame.promotion_price) > 0) ? Number(frame.promotion_price) : frameBase;
  const baseTotal = Math.round((frameBase + lensBase + addons) * 100) / 100;
  const promoTotal = Math.round((framePromo + lensBase + addons) * 100) / 100;
  const total = promoTotal;

  const onConfirm = () => {
    setDraft({ lens: { ...lens, brand_id: brand ? brand.id : null },
      total,
      baseTotal,
      promoTotal,
      frame_base_price: frameBase,
      frame_promo_price: framePromo
    });
    nav('/espectacles/confirm');
  };

  const changeFrame = () => {
    setDraft({ cameFromOrdering: true, lens });
    nav('/espectacles/frames');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="h1">{t('Ordering')}</h1>
        <button className="btn" style={{ width: 'auto', padding: '16px 32px' }} onClick={onConfirm}>{t('Confirm')}</button>
      </div>

      <div className="card">
        <div style={{ marginBottom: 8, fontSize: '1.2em', fontWeight: 700, color: '#000' }}>{t('Frame Chosen:')}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {frame.images && frame.images[0] && <img src={frame.images[0].url} alt="" style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8 }} />}
          <div style={{ flex: 1 }}>
            <div style={{ marginTop: 6, lineHeight: 1.6 }}>
              {frame.brand ? <div>{t('Frame Brand')}: {frame.brand}</div> : null}
              <div>{t('Frame Name')}: {(lang && lang.startsWith('zh')) ? (frame.name_zh || frame.name) : frame.name}</div>
              {frame.code ? <div>{t('Frame Code')}: {frame.code}</div> : null}
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
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
          <button className="btn secondary" style={{ width: 'auto', padding: '6px 10px' }} onClick={changeFrame}>{t('Change')}</button>
        </div>

        {/* Eyesight data */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{t('Eyesight')}</span>
            <button className="btn secondary" style={{ width: 'auto', padding: '8px 24px', fontSize: 13 }}
              onClick={() => { setDraft({ lens }); nav('/espectacles/manual-eyesight'); }}>
              {t('Modify')}
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontWeight: 400, paddingBottom: 4, color: 'var(--muted)' }}></th>
                <th style={{ textAlign: 'center', fontWeight: 600, paddingBottom: 4, fontSize: 15, ...zhTwoCharSpacing(t('Sphere')) }}>{t('Sphere')}</th>
                <th style={{ textAlign: 'center', fontWeight: 600, paddingBottom: 4, fontSize: 15, ...zhTwoCharSpacing(t('Cylinder')) }}>{t('Cylinder')}</th>
                <th style={{ textAlign: 'center', fontWeight: 600, paddingBottom: 4, fontSize: 15, ...zhTwoCharSpacing(t('Axis')) }}>{t('Axis')}</th>
                <th style={{ textAlign: 'center', fontWeight: 600, paddingBottom: 4, fontSize: 15, ...zhTwoCharSpacing(t('Addition')) }}>{t('Addition')}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Left', eyesight.l_sph, eyesight.l_cyl, eyesight.l_axis, eyesight.l_add],
                ['Right', eyesight.r_sph, eyesight.r_cyl, eyesight.r_axis, eyesight.r_add],
              ].map(([label, sph, cyl, axis, add]) => (
                <tr key={label}>
                  <td style={{ color: '#000', paddingRight: 8, fontSize: 15, fontWeight: 700, ...zhTwoCharSpacing(t(label)) }}>
                    {t(label)}
                  </td>
                  {[sph, cyl, axis, add].map((v, i) => (
                    <td key={i} style={{ textAlign: 'center', fontWeight: 500, fontSize: 15 }}>
                      {v != null && v !== '' ? v : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700, color: '#000' }}>
            {t('Pupil Distance')}: <strong>{eyesight.pd != null ? eyesight.pd : '—'}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <strong>{t('Lens options')}</strong>
        <label className="field" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>{t('Thickness (suggested: {{suggested}})', { suggested })}</span>
          <select value={lens.thickness} onChange={e => setLens(l => ({ ...l, thickness: e.target.value }))}>
            {THICKNESS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="field">
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>{t('Lens brand')}</span>
          <select value={lens.brand_id || ''} onChange={e => setLens(l => ({ ...l, brand_id: Number(e.target.value) || null }))}>
            <option value="">{t('Default')}</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.brand || b.name}{b.name && b.name !== b.brand ? ` / ${b.name}` : ''}{b.code ? ` (${b.code})` : ''}</option>)}
          </select>
          {brand ? (
            <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
              {brand.brand ? <div><strong>{t('Len Brand')}:</strong> {brand.brand}</div> : null}
              {brand.name && brand.name !== brand.brand ? <div><strong>{t('Len Name')}:</strong> {brand.name}</div> : null}
              {brand.code ? <div><strong>{t('Len Code')}:</strong> {brand.code}</div> : null}
            </div>
          ) : null}
        </label>
        <label className="field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>{t('Blue-light blocking')}</span>
          <input type="checkbox" style={{ width: 'auto' }} checked={lens.blueLight} onChange={e => setLens(l => ({ ...l, blueLight: e.target.checked }))} />
        </label>
        <label className="field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>{t('Photochromic darkening')}</span>
          <input type="checkbox" style={{ width: 'auto' }} checked={lens.photochromic} onChange={e => setLens(l => ({ ...l, photochromic: e.target.checked }))} />
        </label>
        <label className="field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>{t('Progressive lenses')}</span>
          <input type="checkbox" style={{ width: 'auto' }} checked={lens.progressive} onChange={e => setLens(l => ({ ...l, progressive: e.target.checked }))} />
        </label>
      </div>

      {draft.modifyOrderId && draft.originalTotal != null ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', marginBottom: 6 }}>
            <span>{t('Original Total (Paid):')}</span>
            <span>{fmt(Number(draft.originalTotal))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--text)' }}>
            <strong>{t('Updated Total:')}</strong>
            <strong>{fmt(total)}</strong>
          </div>
          {(() => {
            const diff = Math.round((total - Number(draft.originalTotal)) * 100) / 100;
            const label = diff > 0 ? '(Extra to Pay):' : diff < 0 ? '(Refund Credit):' : '';
              return (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--danger)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <span>{t('Difference Total')}{label}</span>
                <span>{diff !== 0 ? `${diff > 0 ? '+' : ''}${fmt(Math.abs(diff))}` : '—'}</span>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{t('Total')}</strong>
          <div style={{ textAlign: 'right' }}>
            {baseTotal !== promoTotal ? (
              <div>
                <div style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>{fmt(baseTotal)}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(promoTotal)}</div>
              </div>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(total)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
