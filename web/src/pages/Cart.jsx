import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Cart() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="h1">{t('Cart')}</h1>
      <div className="card muted">
        {t('Your cart is empty. In this MVP, eSpectacles orders are checked out directly from the Ordering flow.')}
      </div>
    </div>
  );
}
