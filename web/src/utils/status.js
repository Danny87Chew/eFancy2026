import i18n from '../i18n';

// Human-readable status labels per module.
export function statusLabel(order) {
  if (!order) return '';
  const { status, module } = order;
  if (module === 'checkup' && status === 'Pending') return i18n.t('Pending for Eyesight Checkup');
  if (module === 'checkup' && status === 'PendingForPayment') return i18n.t('Pending for Payment');
  if (module === 'checkup' && status === 'CheckupPaid') return i18n.t('Checkup Paid');
  if (module === 'checkup' && status === 'PendingForOrder') return i18n.t('Ready — Start Spectacle Order');
  if (status === 'PendingForBid') return i18n.t('Pending for Bid');
  if (status === 'OrderPaid') return i18n.t('Order Paid');
  if (status === 'PendingForManufacture') return i18n.t('Pending for Manufacture');
  if (status === 'ManufacturingAccept') return i18n.t('Manufacture Accepted');
  if (status === 'UnderManufacturing') return i18n.t('Under Manufacturing');
  if (status === 'ManufactureDone') return i18n.t('Manufacture Done');
  if (status === 'ShippingBack') return i18n.t('Shipping Back');
  return i18n.t(status);
}

export function moduleLabel(module) {
  switch (module) {
    case 'checkup': return i18n.t('Eyesight Checkup');
    case 'espectacles': return i18n.t('eSpectacles');
    case 'egroceries': return i18n.t('eGroceries');
    case 'efreshes': return i18n.t('eFreshes');
    case 'eservices': return i18n.t('eServices');
    default: return module || '';
  }
}

export function orderTypeLabel(order) {
  if (!order) return '';
  if (order.module === 'efreshes') return i18n.t('Pre-Order');
  return '';
}
