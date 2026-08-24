// Order state machine

const STATES = {
  PendingForPayment: 'PendingForPayment',
  Pending: 'Pending',
  UserAccept: 'UserAccept',
  VendorAccept: 'VendorAccept',
  CheckupPaid: 'CheckupPaid',
  OrderPaid: 'OrderPaid',
  PendingForBid: 'PendingForBid',
  Finalised: 'Finalised',
  PendingForOrder: 'PendingForOrder',
  PendingForManufacture: 'PendingForManufacture',
  ManufacturingAccept: 'ManufacturingAccept',
  UnderManufacturing: 'UnderManufacturing',
  ManufactureDone: 'ManufactureDone',
  ShippingBack: 'ShippingBack',
  PendingService: 'PendingService',
  Completed: 'Completed',
  Processing: 'Processing',
  ReadyForShipping: 'ReadyForShipping',
  ReadyForDelivery: 'ReadyForDelivery',
  PendingForDelivery: 'PendingForDelivery',
  BeingDelivered: 'BeingDelivered',
  Delivered: 'Delivered',
  UserConfirmed: 'UserConfirmed',
  SystemDone: 'SystemDone',
  Cancelled: 'Cancelled',
};

// from -> allowed targets
const transitions = {
  PendingForPayment: ['Pending', 'CheckupPaid', 'OrderPaid', 'Cancelled'],
  Pending: ['CheckupPaid', 'Cancelled'],
  UserAccept: ['VendorAccept', 'Cancelled'],
  VendorAccept: ['OrderPaid', 'Cancelled'],
  CheckupPaid: ['PendingForOrder', 'Finalised', 'Cancelled'],
  OrderPaid: ['PendingForBid', 'Finalised', 'Cancelled', 'PendingService'],
  PendingForBid: ['PendingForManufacture', 'Cancelled'],
  Finalised: ['PendingForManufacture', 'Processing', 'Cancelled'],
  PendingForOrder: ['Finalised', 'Cancelled'],
  PendingForManufacture: ['ManufacturingAccept', 'Cancelled'],
  ManufacturingAccept: ['UnderManufacturing', 'Cancelled'],
  UnderManufacturing: ['ManufactureDone'],
  ManufactureDone: ['ShippingBack'],
  ShippingBack: ['Delivered', 'ReadyForDelivery'],
  ReadyForDelivery: ['PendingForDelivery', 'BeingDelivered'],
  PendingForDelivery: ['BeingDelivered'],
  BeingDelivered: ['Delivered'],
  PendingService: ['Completed', 'Cancelled'],
  Completed: ['UserConfirmed', 'SystemDone'],
  Processing: ['ReadyForShipping'],
  ReadyForShipping: ['Delivered'],
  Delivered: ['UserConfirmed', 'SystemDone'],
  UserConfirmed: ['SystemDone'],
  SystemDone: [],
  Cancelled: [],
};

function canTransition(from, to) {
  return (transitions[from] || []).includes(to);
}

module.exports = { STATES, transitions, canTransition };
