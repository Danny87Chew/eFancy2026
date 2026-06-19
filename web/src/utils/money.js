// Currency formatting. Stored canonical price is SGD; RMB computed on display.
export function formatMoney(sgdAmount, currency = 'SGD', rate = 5.3) {
  const n = Number(sgdAmount) || 0;
  if (currency === 'RMB') {
    return `¥${(n * Number(rate || 0)).toFixed(2)}`;
  }
  return `S$${n.toFixed(2)}`;
}

export function currencySymbol(currency = 'SGD') {
  return currency === 'RMB' ? '¥' : 'S$';
}
