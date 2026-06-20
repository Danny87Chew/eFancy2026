import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const current = i18n.language || (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'en';

  const handleChange = (e) => {
    const v = e.target.value;
    i18n.changeLanguage(v);
    try { localStorage.setItem('lang', v); } catch (err) { }
  };

  return (
    <div className="lang-picker">
      <span className="lang-icon" aria-hidden>🌐</span>
      <select className="lang-select" value={current} onChange={handleChange} aria-label="Select language">
        <option value="en">English</option>
        <option value="zh">中 文</option>
      </select>
    </div>
  );
}
