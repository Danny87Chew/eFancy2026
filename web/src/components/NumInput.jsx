import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Allows signed real numbers like -2.50, +1.25, 0, .5, -.75
const VALID = /^[+-]?(\d+\.?\d*|\.\d+)?$/;

function sanitize(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s === 'NaN') return '';
  return s;
}

export default function NumInput({ value, onChange, ...rest }) {
  const [warn, setWarn] = useState(false);
  const { t } = useTranslation();
  const handleChange = (e) => {
    const v = e.target.value;
    if (v === '' || VALID.test(v)) {
      onChange(v);
    } else {
      setWarn(true);
    }
  };
  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={sanitize(value)}
        onChange={handleChange}
        {...rest}
      />
      {warn && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setWarn(false)}
        >
          <div
            style={{
              position: 'relative', background: '#fff', borderRadius: 12,
              padding: '20px 22px 18px', maxWidth: 320, width: '86%',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close"
              onClick={() => setWarn(false)}
              style={{
                position: 'absolute', top: 6, right: 10, border: 'none',
                background: 'transparent', fontSize: 22, cursor: 'pointer', lineHeight: 1,
              }}
            >
              ×
            </button>
            <h3 style={{ margin: '0 0 8px', color: '#b45309' }}>{t('Invalid character')}</h3>
            <p style={{ margin: '0 0 14px' }}>
              {t('Only numbers are allowed. You may use')} <code>.</code>, <code>-</code>, {t('or')} <code>+</code> {t('for decimal and signed values.')}
            </p>
            <button
              className="btn"
              style={{ width: 'auto', padding: '8px 16px' }}
              onClick={() => setWarn(false)}
            >
              {t('Close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
