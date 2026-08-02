export function calculateCartTotals(items = []) {
  return (items || []).map((item) => {
    const quantity = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    return {
      id: item.id,
      subtotal: Math.round((price * quantity) * 100) / 100,
    };
  });
}

export function getSelectedCheckoutItems(items = [], selectedIds = []) {
  const selectedSet = new Set(selectedIds || []);
  return (items || []).filter((item) => selectedSet.has(item.id));
}
