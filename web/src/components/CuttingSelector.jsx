import React from 'react';
import { useTranslation } from 'react-i18next';
import { getCuttingOptions } from './cuttingOptions.js';

export { getCuttingOptions } from './cuttingOptions.js';

export default function CuttingSelector({ category, value, onChange, label, disabled = false }) {
  const { t } = useTranslation();
  const options = getCuttingOptions(category);
  if (!options.length) return null;

  return (
    <label style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
      {label || t('Cuttings') || 'Cuttings'}
      <select value={value || ''} onChange={(e) => onChange?.(e.target.value)} disabled={disabled}>
        <option value="">{t('Select cutting') || 'Select cutting'}</option>
        {options.map((option) => (
          <option key={option} value={option}>{t(option) || option}</option>
        ))}
      </select>
    </label>
  );
}
