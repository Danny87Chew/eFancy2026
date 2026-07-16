import React from 'react';
import { useTranslation } from 'react-i18next';

export default function CuttingInfo({ cutting }) {
  const { t } = useTranslation();
  if (!cutting) return null;
  return (
    <div style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>
      {t('Cutting') || 'Cutting'}: {t(cutting) || cutting}
    </div>
  );
}
