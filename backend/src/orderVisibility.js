const STAFF_PRICE_HIDDEN_ROLES = new Set(['staff', 'platform_staff']);

function shouldHideOrderPrices(role) {
  return !!role && STAFF_PRICE_HIDDEN_ROLES.has(role);
}

function redactOrderForRole(order, role) {
  if (!order || !shouldHideOrderPrices(role)) return order;

  const hiddenOrder = { ...order };
  if (hiddenOrder.meta && typeof hiddenOrder.meta === 'object') {
    hiddenOrder.meta = { ...hiddenOrder.meta };
    if (hiddenOrder.meta.vendor_price != null) hiddenOrder.meta.vendor_price = null;
    if (hiddenOrder.meta.pricing && typeof hiddenOrder.meta.pricing === 'object') {
      hiddenOrder.meta.pricing = Object.fromEntries(
        Object.entries(hiddenOrder.meta.pricing).map(([key, value]) => [key, null])
      );
    }
  }

  if (hiddenOrder.total != null) hiddenOrder.total = null;

  if (Array.isArray(hiddenOrder.items)) {
    hiddenOrder.items = hiddenOrder.items.map((item) => ({
      ...item,
      unit_price: null,
    }));
  }

  if (Array.isArray(hiddenOrder.payments)) {
    hiddenOrder.payments = hiddenOrder.payments.map((payment) => ({
      ...payment,
      amount: null,
    }));
  }

  return hiddenOrder;
}

module.exports = {
  STAFF_PRICE_HIDDEN_ROLES,
  shouldHideOrderPrices,
  redactOrderForRole,
};
