import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDraft } from '../../state/OrderDraftContext.jsx';
import NumInput from '../../components/NumInput.jsx';
import { useTranslation } from 'react-i18next';

export default function ManualEyesight() {
  const { t } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const { draft, setDraft } = useDraft();
  const init = draft.eyesight || {};
  const norm = (v) => (v === null || v === undefined || Number.isNaN(v) ? '' : String(v));
  const [data, setData] = useState({
    l_sph: norm(init.l_sph), l_cyl: norm(init.l_cyl), l_axis: norm(init.l_axis), l_add: norm(init.l_add),
    r_sph: norm(init.r_sph), r_cyl: norm(init.r_cyl), r_axis: norm(init.r_axis), r_add: norm(init.r_add),
    pd: norm(init.pd),
  });
  const [err, setErr] = useState('');

  const update = (k, v) => { setData(d => ({ ...d, [k]: v })); setErr(''); };

  const isValidNumStr = (v) => {
    if (v === '' || v === null) return false;
    const n = Number(v);
    return Number.isFinite(n);
  };

  const submit = () => {
    const required = ['l_sph','l_cyl','l_axis','r_sph','r_cyl','r_axis','pd'];
    for (const k of required) {
      if (!isValidNumStr(data[k])) {
        setErr(t('Please fill all eyesight values with a valid number'));
        return;
      }
    }
    const parsed = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, isValidNumStr(v) ? Number(v) : null])
    );
    setDraft({ eyesight: parsed, eyesightMode: 'have' });
    nav('/espectacles/ordering');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <button
          className="btn secondary"
          style={{ width: 'auto', padding: '8px 14px', fontSize: '1.5em' }}
          onClick={() => nav(-1)}
        >
          ← {t('Back')}
        </button>
        <h1 className="h1" style={{ margin: 0 }}>{t('Enter Eyesight Data')}</h1>
        <div style={{ width: 70 }} />
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          {t('Enter your eyesight prescription below. Values may be signed (e.g. -2.50, +1.25).')}
          {id && (
            <> {t('Your existing Eyesight Checkup order #{{id}} is not affected — you can cancel it separately if you no longer need the in-shop checkup.', { id })}</>
          )}
        </p>
        <h3 className="h2" style={{ marginTop: 0 }}>{t('Left Eye')}</h3>
        <div className="row">
          <label className="field">{t('Sphere')}<NumInput value={data.l_sph} onChange={v => update('l_sph', v)} placeholder={t('e.g. -2.50')} /></label>
          <label className="field">{t('Cylinder')}<NumInput value={data.l_cyl} onChange={v => update('l_cyl', v)} placeholder={t('e.g. -0.75')} /></label>
        </div>
        <div className="row">
          <label className="field">{t('Axis')}<NumInput value={data.l_axis} onChange={v => update('l_axis', v)} placeholder={t('0–180')} /></label>
          <label className="field">{t('Addition')}<NumInput value={data.l_add} onChange={v => update('l_add', v)} placeholder={t('optional')} /></label>
        </div>
        <h3 className="h2">{t('Right Eye')}</h3>
        <div className="row">
          <label className="field">{t('Sphere')}<NumInput value={data.r_sph} onChange={v => update('r_sph', v)} placeholder={t('e.g. -2.50')} /></label>
          <label className="field">{t('Cylinder')}<NumInput value={data.r_cyl} onChange={v => update('r_cyl', v)} placeholder={t('e.g. -0.75')} /></label>
        </div>
        <div className="row">
          <label className="field">{t('Axis')}<NumInput value={data.r_axis} onChange={v => update('r_axis', v)} placeholder={t('0–180')} /></label>
          <label className="field">{t('Addition')}<NumInput value={data.r_add} onChange={v => update('r_add', v)} placeholder={t('optional')} /></label>
        </div>
        <label className="field">{t('Pupil Distance')} <span style={{ color: '#000' }}>*</span><NumInput value={data.pd} onChange={v => update('pd', v)} placeholder={t('e.g. 62')} /></label>
        {err && <div className="error">{err}</div>}
      </div>

      <button className="btn success" onClick={submit}>{t('Save and Continue')}</button>
    </div>
  );
}
