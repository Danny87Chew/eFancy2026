import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ESpectaclesHome() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="h1">{t('eSpectacles')}</h1>
      <p className="muted">{t('Order prescription glasses in a few steps.')}</p>
      <div className="spacer" />
      <Link to="/espectacles/frames" className="btn" style={{ display: 'block', textAlign: 'center' }}>
        {t('Start a new order')}
      </Link>
      <div className="spacer" />
      <div className="card">
        <strong>{t('How it works')}</strong>
        <ol style={{ paddingLeft: 18, marginTop: 8 }}>
          <li>{t('Choose a frame')}</li>
          <li>{t('Provide eyesight data (or book an Eyesight Checkup)')}</li>
          <li>{t('Pick lens options')}</li>
          <li>{t('Confirm and pay')}</li>
        </ol>
      </div>
    </div>
  );
}
