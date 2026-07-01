import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function DeliveryAddressForm({ onSubmit, onCancel, initialData, isLoading }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(initialData?.label || '');
  const [recipientName, setRecipientName] = useState(initialData?.recipient_name || '');
  const [recipientPhone, setRecipientPhone] = useState(initialData?.recipient_phone || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [postalCode, setPostalCode] = useState(initialData?.postal_code || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [state, setState] = useState(initialData?.state || '');
  const [country, setCountry] = useState(initialData?.country || 'SG');
  const [isDefault, setIsDefault] = useState(initialData?.is_default === 1 || false);
  const [err, setErr] = useState('');
  const [postcodeLookup, setPostcodeLookup] = useState({ loading: false, error: '' });

  useEffect(() => {
    const next = initialData || {};
    setLabel(next.label || '');
    setRecipientName(next.recipient_name || '');
    setRecipientPhone(next.recipient_phone || '');
    setAddress(next.address || '');
    setPostalCode(next.postal_code || '');
    setCity(next.city || '');
    setState(next.state || '');
    setCountry(next.country || 'SG');
    setIsDefault(next.is_default === 1 || false);
  }, [initialData?.id, initialData?.label, initialData?.recipient_name, initialData?.recipient_phone, initialData?.address, initialData?.postal_code, initialData?.city, initialData?.state, initialData?.country, initialData?.is_default]);

  const lookupPostcode = async (pc) => {
    const postcode = String(pc || postalCode || '').trim();
    if (!/^[0-9]{6}$/.test(postcode)) {
      setPostcodeLookup({ loading: false, error: t('Enter a 6-digit Singapore postcode.') });
      return;
    }
    setPostcodeLookup({ loading: true, error: '' });
    try {
      const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postcode)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('lookup_failed');
      const data = await r.json();
      const hit = (data.results || [])[0];
      if (!hit) {
        setPostcodeLookup({ loading: false, error: t('No address found for this postcode.') });
        return;
      }
      const blk = (hit.BLK_NO || '').trim();
      const road = (hit.ROAD_NAME || '').trim();
      const building = (hit.BUILDING && hit.BUILDING !== 'NIL') ? hit.BUILDING.trim() : '';
      const fullAddr = (hit.ADDRESS || [blk, road, building].filter(Boolean).join(' ')).trim();
      setPostalCode(postcode);
      setAddress(fullAddr || address);
      setPostcodeLookup({ loading: false, error: '' });
    } catch (e) {
      setPostcodeLookup({ loading: false, error: t('Postcode lookup failed.') });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErr('');

    if (!recipientName.trim()) {
      setErr(t('Recipient name is required'));
      return;
    }
    if (!recipientPhone.trim()) {
      setErr(t('Recipient phone is required'));
      return;
    }
    if (!address.trim()) {
      setErr(t('Address is required'));
      return;
    }
    if (!postalCode.trim()) {
      setErr(t('Postal Code is required'));
      return;
    }

    onSubmit({
      label: label.trim() || null,
      recipient_name: recipientName.trim(),
      recipient_phone: recipientPhone.trim(),
      address: address.trim(),
      postal_code: postalCode.trim(),
      city: city.trim() || null,
      state: state.trim() || null,
      country,
      is_default: isDefault ? 1 : 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 500 }}>
      <div className="field">
        <label>{t('Address Label')} {t('(optional)')}</label>
        <input
          type="text"
          placeholder={t('e.g., Home, Office')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={isLoading}
        />
        <div className="hint">{t('A name to help you identify this address')}</div>
      </div>

      <div className="field">
        <label>{t('Recipient Name')} *</label>
        <input
          type="text"
          placeholder={t('Full name')}
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      <div className="field">
        <label>{t('Recipient Phone')} *</label>
        <input
          type="tel"
          placeholder={t('Phone number')}
          value={recipientPhone}
          onChange={(e) => setRecipientPhone(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      <div className="field">
        <label>{t('Address')} *</label>
        <textarea
          placeholder={t('Street address')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={isLoading}
          required
          rows={3}
          style={{ fontFamily: 'inherit' }}
        />
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>{t('City')} {t('(optional)')}</label>
          <input
            type="text"
            placeholder={t('City')}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>{t('State')} {t('(optional)')}</label>
          <input
            type="text"
            placeholder={t('State')}
            value={state}
            onChange={(e) => setState(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label>{t('Postal Code')} *</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              type="text"
              placeholder={t('6-digit postcode')}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              disabled={isLoading || postcodeLookup.loading}
              required
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="btn secondary"
              onClick={() => lookupPostcode(postalCode)}
              disabled={isLoading || postcodeLookup.loading}
              style={{ padding: '10px 10px', whiteSpace: 'nowrap', flex: 0 }}
            >
              {postcodeLookup.loading ? t('…') : t('Lookup')}
            </button>
          </div>
          {postcodeLookup.error && (
            <div className="muted" style={{ color: '#dc2626', marginTop: 6 }}>{t(postcodeLookup.error)}</div>
          )}
        </div>
        <div className="field" style={{ flex: 0.6 }}>
          <label>{t('Country')}</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={isLoading}
          >
            <option value="SG">Singapore</option>
            <option value="MY">Malaysia</option>
            <option value="CN">China</option>
            <option value="US">United States</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <label className="field" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, whiteSpace: 'nowrap', fontSize: 16 }}>
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          disabled={isLoading}
        />
        <span style={{ whiteSpace: 'nowrap' }}>{t('Set as default delivery address')}</span>
      </label>

      {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn" disabled={isLoading} style={{ flex: 1 }}>
          {isLoading ? t('Saving...') : t('Save Address')}
        </button>
        {onCancel && (
          <button
            type="button"
            className="btn secondary"
            onClick={onCancel}
            disabled={isLoading}
            style={{ flex: 1 }}
          >
            {t('Cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
