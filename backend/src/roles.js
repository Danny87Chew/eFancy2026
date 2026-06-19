// Shared user role definitions
const PUBLIC_ROLES = [
  'consumer',
  'service_vendor',
  'spectacle_checkup_vendor',
  'spectacle_producer_vendor',
  'spectacle_lens_vendor',
  'spectacle_frame_vendor',
  'grocery_vendor',
  'freshfood_vendor',
  'other_vendor',
];

const ADMIN_ROLES = ['admin', 'super_admin'];

const VENDOR_ROLES = [
  'service_vendor',
  'spectacle_checkup_vendor',
  'spectacle_producer_vendor',
  'spectacle_lens_vendor',
  'spectacle_frame_vendor',
  'grocery_vendor',
  'freshfood_vendor',
  'other_vendor',
];

const ALL_ROLES = [...PUBLIC_ROLES, ...ADMIN_ROLES];

const ROLE_LABELS = {
  consumer: 'Consumer User',
  service_vendor: 'Service Vendor',
  spectacle_checkup_vendor: 'Spectacle Eyesight Checkup Vendor',
  spectacle_producer_vendor: 'Spectacle Producer Vendor',
  spectacle_lens_vendor: 'Spectacle Lens Vendor',
  spectacle_frame_vendor: 'Spectacle Frame Vendor',
  grocery_vendor: 'Grocery Vendor',
  freshfood_vendor: 'FreshFood Vendor',
  other_vendor: 'Other Vendor',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

module.exports = { PUBLIC_ROLES, ADMIN_ROLES, VENDOR_ROLES, ALL_ROLES, ROLE_LABELS };
