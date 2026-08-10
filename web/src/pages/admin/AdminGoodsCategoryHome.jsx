import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function AdminGoodsCategoryHome() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="h1">{t('Goods Categories') || 'Goods Categories'}</h1>
      <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <Link to="main" className="btn" style={{ textAlign: 'center', padding: '14px 16px' }}>
          {t('Main Categories') || 'Main Categories'}
        </Link>
        <Link to="sub" className="btn secondary" style={{ textAlign: 'center', padding: '14px 16px' }}>
          {t('Sub-Categories') || 'Sub-Categories'}
        </Link>
      </div>
    </div>
  );
}
