import React from 'react';
import { useTranslation } from 'react-i18next';

export default function CuttingInfo({ cutting }) {
  const { t } = useTranslation();
  if (!cutting || cutting === 'Standard') return null;
  return (
    <div style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>
      <span style={{ fontWeight: 700 }}>Cutting:</span>{' '}
      <span style={{ fontWeight: 700, fontStyle: 'italic' }}>{t(cutting) || cutting}</span>
    </div>
  );
}
