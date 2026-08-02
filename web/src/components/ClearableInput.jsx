import React from 'react';

export default function ClearableInput({ value, onChange, style, inputProps, as, ...rest }) {
  const show = value !== undefined && value !== null && String(value).length > 0;
  const InputTag = as === 'textarea' ? 'textarea' : 'input';
  return (
    <div style={{ position: 'relative', display: 'block', width: '100%', overflow: 'visible' }}>
      <InputTag
        {...rest}
        {...inputProps}
        value={value}
        onChange={onChange}
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', ...style, paddingLeft: 48, paddingRight: 12 }}
      />
      {show ? (
        <button
          type="button"
          onClick={() => {
            const fakeEvent = { target: { value: '' } };
            if (onChange) onChange(fakeEvent);
          }}
          aria-label="clear"
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 'none',
            background: '#ffffffcc',
            cursor: 'pointer',
            fontSize: 32,
            lineHeight: 1,
            padding: 6,
            zIndex: 9999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 20,
            color: '#374151',
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
