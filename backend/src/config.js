module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  dbFile: process.env.DB_FILE || './data.sqlite',
  isProd: process.env.NODE_ENV === 'production',
  shippingPartner: {
    url: process.env.SHIPPING_PARTNER_URL || '',
    apiKey: process.env.SHIPPING_PARTNER_KEY || '',
  },
};
