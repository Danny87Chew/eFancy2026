import React from 'react';
import { useTranslation } from 'react-i18next';

export function getCuttingOptions(category = '') {
  const normalized = String(category || '').trim().toLowerCase();
  const cleaned = normalized.replace(/\b(fresh|frozen|cooked)\b/g, '').replace(/\s+/g, ' ').trim();
  if (['beef', 'lamb', 'mutton'].includes(cleaned)) {
    return ['100g/Pcs', '150g/Pcs', '200g/Pcs', '250g/Pcs', '300g/Pcs', '350g/Pcs', '400g/Pcs'];
  }
  if (cleaned === 'fish') {
    return ['Butter Fly', 'Whole', 'Half', 'Quarter', '8 pieces', 'Small pieces'];
  }
  if (['chicken', 'checken', 'duck', 'goose'].includes(cleaned)) {
    return ['Whole', 'Half', 'Quarter', '8 pieces', 'Small pieces'];
  }
  return [];
}

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
