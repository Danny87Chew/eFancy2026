import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useTranslation } from 'react-i18next';

export default function AdminConfig() {
  const { t } = useTranslation();
  const [config, setConfig] = useState([]);
  const [edits, setEdits] = useState({});
  const load = () => api('/api/admin/config').then(d => {
    setConfig(d.config);
    setEdits(Object.fromEntries(d.config.map(c => [c.key, c.value])));
  });
  useEffect(() => { load(); }, []);
  const save = async (key) => {
    await api('/api/admin/config', { method: 'PATCH', body: { key, value: edits[key] } });
    load();
  };
  const keys = new Set(config.map(c => c.key));
  ['checkup_fee','order_modify_window_hours','refund_window_weeks','sgd_to_rmb_rate','paynow_uen','paylah_mobile'].forEach(k => {
    if (!keys.has(k)) config.push({ key: k, value: '' });
  });
  return (
    <div>
      <div className="card">
        <strong>{t('System config (Super Admin)')}</strong>
        {config.map(c => {
          const dirty = (edits[c.key] ?? '') !== (c.value ?? '');
          return (
            <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="muted">{c.key}</div>
                <input value={edits[c.key] ?? ''} onChange={e => setEdits({ ...edits, [c.key]: e.target.value })} />
              </div>
              <button
                className="btn secondary"
                style={{ width: 'auto', padding: '8px 12px' }}
                onClick={() => setEdits({ ...edits, [c.key]: c.value })}
              >
                {t('Form.Cancel')}
              </button>
              <button
                className="btn"
                style={{ width: 'auto', padding: '8px 12px' }}
                disabled={!dirty}
                onClick={() => save(c.key)}
              >
                {t('Save')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
