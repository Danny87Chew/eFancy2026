import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Placeholder({ title }) {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="h1">{title}</h1>
      <div className="card">
        <p className="muted">{t('This module is part of the phased roadmap and will be enabled after the eSpectacles MVP.')}</p>
      </div>
    </div>
  );
}
