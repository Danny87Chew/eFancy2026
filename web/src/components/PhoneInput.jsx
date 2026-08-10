import React from 'react';

const COUNTRY_CODES = [
  { code: '+65', label: '🇸🇬 +65', placeholder: '8/9XXXXXXX',    pattern: /^[89]\d{7}$/, len: 8,  errMsg: '8 digits starting with 8 or 9 required' },
  { code: '+60', label: '🇲🇾 +60', placeholder: 'XXXXXXXX',      pattern: /^\d{8}$/,   len: 8,  errMsg: '8 digits required' },
  { code: '+86', label: '🇨🇳 +86', placeholder: '1XXXXXXXXXX', pattern: /^1\d{10}$/, len: 11, errMsg: '11 digits starting with 1 required' },
];

const DEFAULT_CODE = '+65';

/**
 * PhoneInput — renders a country-code selector + local number input.
 * Props:
 *   value       {string}  — full phone string e.g. "+6591234567"
 *   onChange    {fn}      — called with new full phone string
 *   placeholder {string}  — optional, defaults to "9XXXXXXX"
 *   label       {string}  — optional field label
 */
export default function PhoneInput({ value = '', onChange, label, allowAnyLeading = false, disabled = false }) {
  // Split stored full value into country code + local
  const matchedCode = COUNTRY_CODES.find(c => value.startsWith(c.code)) || COUNTRY_CODES[0];
  const local = value.startsWith(matchedCode.code) ? value.slice(matchedCode.code.length) : value;

  // If caller requests no leading-digit restriction for +65, override the rule
  const rule = (allowAnyLeading && matchedCode.code === '+65')
    ? { ...matchedCode, pattern: /^\d{8}$/, placeholder: 'XXXXXXXX', errMsg: '8 digits required' }
    : matchedCode;

  const handleCode = (e) => {
    const nextCode = e.target.value;
    // Clear the local number when the country code changes so the caller
    // returns only the new country code (user must re-enter the local part).
    onChange(nextCode);
  };

  const handleLocal = (e) => {
    let v = e.target.value.replace(/\s/g, '');
    const match = COUNTRY_CODES.find(c => v.startsWith(c.code));
    if (match) v = v.slice(match.code.length);
    v = v.replace(/\D/g, '').slice(0, rule.len);
    onChange(matchedCode.code + v);
  };

  const isValid = !local || rule.pattern.test(local);

  return (
    <label className="field">
      {label}
      <div style={{ display: 'flex', gap: 6 }}>
          <select
          value={matchedCode.code}
          onChange={handleCode}
          disabled={disabled}
          // compute a compact width that's just wide enough for the flag and code
          // add ~3 characters of extra space so codes like '+886' fit comfortably
          // previous multiplier was 1.5; reduce overall width by ~15% -> 1.275, and reduce min to 102px
          style={{ width: Math.max(((String(matchedCode.label || '').length * 8) + 12 + 24) * 1.275, 102), flexShrink: 0, padding: '2px 6px', paddingLeft: 4 }}
        >
          {COUNTRY_CODES.map(c => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            key={matchedCode.code}
            style={{ width: '100%', paddingRight: local ? 30 : undefined, borderColor: local && !isValid ? 'var(--danger)' : undefined }}
            value={local}
            onChange={handleLocal}
            disabled={disabled}
            placeholder={rule.placeholder}
            inputMode="tel"
            maxLength={rule.len}
          />
          {local && !disabled && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => onChange(matchedCode.code)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: 28,
                lineHeight: 1,
                padding: 0,
                minWidth: 28,
                minHeight: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {local && !isValid && (
        <span style={{ color: 'var(--danger)', fontSize: 12 }}>
          {matchedCode.errMsg}
        </span>
      )}
    </label>
  );
}

export { DEFAULT_CODE, COUNTRY_CODES };
