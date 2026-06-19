const i18n = require('../web/src/i18n').default;

(async () => {
  await i18n.changeLanguage('en');
  console.log('en Reset:', i18n.t('Reset'));
  console.log('en Cancel:', i18n.t('Cancel'));
  await i18n.changeLanguage('zh');
  console.log('zh Reset:', i18n.t('Reset'));
  console.log('zh Cancel:', i18n.t('Cancel'));
})();
