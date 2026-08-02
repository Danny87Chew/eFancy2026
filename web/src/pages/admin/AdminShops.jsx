import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import ClearableInput from '../../components/ClearableInput';
import { useTranslation } from 'react-i18next';

const EMPTY = { name: '', address: '', postcode: '', road: '', town: '', district: '', mrt: '', opening_time: '', contact: '', building_name: '', floor_number: '', unit_number: '' };
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun/PBH'];

function createEmptyHours() {
  return Object.fromEntries(WEEK_DAYS.map((d) => [d, { open: '', close: '' }]));
}

function toOpeningTimeText(hours) {
  return WEEK_DAYS
    .map((day) => {
      const slot = hours[day] || {};
      const open = String(slot.open || '').trim();
      const close = String(slot.close || '').trim();
      if (!open || !close) return `${day} Closed`;
      return `${day} ${open}-${close}`;
    })
    .join('; ');
}

const SG_MRT_STATIONS = [
  'Admiralty', 'Aljunied', 'Ang Mo Kio', 'Bartley', 'Bayfront', 'Beauty World',
  'Bedok', 'Bedok North', 'Bedok Reservoir', 'Bencoolen', 'Bishan', 'Boon Keng',
  'Boon Lay', 'Botanic Gardens', 'Braddell', 'Bras Basah', 'Bright Hill',
  'Buangkok', 'Bugis', 'Bukit Batok', 'Bukit Gombak', 'Bukit Panjang',
  'Buona Vista', 'Caldecott', 'Canberra', 'Cashew', 'Changi Airport',
  'Chinatown', 'Chinese Garden', 'Choa Chu Kang', 'City Hall', 'Clarke Quay',
  'Clementi', 'Commonwealth', 'Dakota', 'Dhoby Ghaut', 'Dover', 'Downtown',
  'Esplanade', 'Expo', 'Eunos', 'Farrer Park', 'Farrer Road', 'Fort Canning',
  'Gardens by the Bay', 'Geylang Bahru', 'Great World', 'Gul Circle',
  'HarbourFront', 'Havelock', 'Haw Par Villa', 'Hillview', 'Holland Village',
  'Hougang', 'Jalan Besar', 'Joo Koon', 'Jurong East', 'Kaki Bukit', 'Kallang',
  'Kembangan', 'Kent Ridge', 'Khatib', 'King Albert Park', 'Kovan',
  'Kranji', 'Labrador Park', 'Lakeside', 'Lavender', 'Little India', 'Lorong Chuan',
  'MacPherson', 'Marina Bay', 'Marina South Pier', 'Marsiling', 'Marymount',
  'Maxwell', 'Mountbatten', 'Napier', 'Newton', 'Novena', 'One-North',
  'Orchard', 'Orchard Boulevard', 'Outram Park', 'Pasir Panjang', 'Pasir Ris',
  'Paya Lebar', 'Pioneer', 'Potong Pasir', 'Promenade', 'Punggol', 'Queenstown',
  'Raffles Place', 'Redhill', 'Rochor', 'Sembawang', 'Sengkang', 'Serangoon',
  'Shenton Way', 'Siglap', 'Simei', 'Sixth Avenue', 'Somerset', 'Springleaf',
  'Stadium', 'Stevens', 'Tai Seng', 'Tampines', 'Tampines East',
  'Tampines West', 'Tan Kah Kee', 'Tanah Merah', 'Telok Ayer', 'Telok Blangah',
  'Tiong Bahru', 'Toa Payoh', 'Tuas Crescent', 'Tuas Link', 'Tuas West Road',
  'Ubi', 'Upper Changi', 'Woodlands', 'Woodlands North', 'Woodlands South',
  'Woodleigh', 'Yio Chu Kang', 'Yishun'
];

export default function AdminShops() {
  const { t } = useTranslation();
  const [shops, setShops] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [hours, setHours] = useState(createEmptyHours);
  const [applyAllDays, setApplyAllDays] = useState(false);
  const [postcodeLookup, setPostcodeLookup] = useState({ loading: false, error: '' });
  const load = () => api('/api/shops').then(d => setShops(d.shops));
  useEffect(() => { load(); }, []);

  const filteredMrtStations = useMemo(() => {
    const q = form.mrt.trim().toLowerCase();
    if (!q) return SG_MRT_STATIONS;
    return SG_MRT_STATIONS.filter((station) => station.toLowerCase().startsWith(q));
  }, [form.mrt]);

  const create = async () => {
    if (!form.name) return;
    await api('/api/shops', {
      method: 'POST',
      body: {
        ...form,
        opening_time: toOpeningTimeText(hours),
      },
    });
    setForm(EMPTY);
    setHours(createEmptyHours());
    setApplyAllDays(false);
    load();
  };

  const setDayHours = (day, key, value) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [key]: value,
      },
    }));
  };

  const setAllDaysHours = (key, value) => {
    setHours((prev) => Object.fromEntries(
      WEEK_DAYS.map((day) => [day, { ...prev[day], [key]: value }])
    ));
  };

  const toggleApplyAllDays = (enabled) => {
    setApplyAllDays(enabled);
    if (!enabled) return;
    const seed = hours.Mon || { open: '', close: '' };
    setHours((prev) => Object.fromEntries(
      WEEK_DAYS.map((day) => [day, { ...prev[day], open: seed.open, close: seed.close }])
    ));
  };

  const renderField = (key, label = key) => (
    <label key={key} className="field">
      {label}
      <ClearableInput value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  const lookupPostcode = async (pc) => {
    const postcode = String(pc || '').trim();
    if (!/^\d{6}$/.test(postcode)) {
      setPostcodeLookup({ loading: false, error: 'Enter a 6-digit Singapore postcode.' });
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
        setPostcodeLookup({ loading: false, error: 'No address found for this postcode.' });
        return;
      }
      const blk = (hit.BLK_NO || '').trim();
      const road = (hit.ROAD_NAME || '').trim();
      const building = (hit.BUILDING && hit.BUILDING !== 'NIL') ? hit.BUILDING.trim() : '';
      const fullAddr = (hit.ADDRESS || [blk, road, building].filter(Boolean).join(' ')).trim();
      setForm((prev) => ({ ...prev, postcode: postcode, address: fullAddr || prev.address, road: road || prev.road, building_name: building || prev.building_name }));
      setPostcodeLookup({ loading: false, error: '' });
    } catch (e) {
      setPostcodeLookup({ loading: false, error: 'Postcode lookup failed.' });
    }
  };

  return (
    <div>
      <div className="card">
        <strong>{t('Add Partner Shop')}</strong>
        <div className="row">
          {renderField('name', t('Name'))}
          {renderField('contact', t('Contact'))}
        </div>
        <label className="field">
          {t('Full Address')}
          <div style={{ position: 'relative' }}>
            <textarea value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} rows="3" style={{ paddingLeft: 36, width: '100%' }} />
            <button type="button" onClick={() => setForm({ ...form, address: '' })} style={{ position: 'absolute', left: 8, top: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
        </label>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'flex-start' }}>
          <label className="field" style={{ flex: 1, minWidth: 0 }}>
            {t('Building Name:')}
            <div style={{ position: 'relative' }}>
              <ClearableInput value={form.building_name || ''} onChange={e => setForm({ ...form, building_name: e.target.value })} style={{ paddingLeft: 36, width: '100%' }} />
              <button type="button" onClick={() => setForm({ ...form, building_name: '' })} style={{ position: 'absolute', left: 8, top: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
          </label>
          <label className="field" style={{ width: 60 }}>
            {t('Floor:') || t('Floor') || 'Floor:'}
            <ClearableInput value={form.floor_number || ''} onChange={e => setForm({ ...form, floor_number: e.target.value })} style={{ width: '100%' }} />
          </label>
          <label className="field" style={{ width: 110 }}>
            {t('Unit:') || t('Unit') || 'Unit:'}
            <ClearableInput value={form.unit_number || ''} onChange={e => setForm({ ...form, unit_number: e.target.value })} style={{ width: '100%' }} />
          </label>
        </div>
        {renderField('road', t('Road Name'))}
        <div className="row">
          <label className="field" style={{ position: 'relative' }}>
            Postcode
            <div style={{ display: 'flex', gap: 8 }}>
              <ClearableInput value={form.postcode || ''} onChange={e => setForm({ ...form, postcode: e.target.value })} />
              <button
                type="button"
                className="btn secondary"
                style={{ width: 'auto', padding: '6px 10px' }}
                onClick={() => lookupPostcode(form.postcode)}
                disabled={postcodeLookup.loading}
              >
                {postcodeLookup.loading ? t('Looking…') : t('Lookup')}
              </button>
            </div>
            {postcodeLookup.error && <div className="muted" style={{ color: '#dc2626', marginTop: 6 }}>{t(postcodeLookup.error)}</div>}
          </label>
          {renderField('town', t('Town'))}
        </div>
        <div className="row">
          {renderField('district', t('District'))}
          <label className="field">
            MRT Stations
            <ClearableInput
              list="sg-mrt-stations"
              value={form.mrt}
              onChange={e => setForm({ ...form, mrt: e.target.value })}
              placeholder={t('Type station name')}
            />
            <datalist id="sg-mrt-stations">
              {filteredMrtStations.map((station) => (
                <option key={station} value={station} />
              ))}
            </datalist>
          </label>
        </div>

        <label className="field" style={{ marginBottom: 8 }}>
          {t('Opening Time')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 6, marginLeft: 50, textAlign: 'left', justifyItems: 'start' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, color: 'var(--text)', width: '100%', whiteSpace: 'nowrap', textAlign: 'left' }}>
              <input
                type="radio"
                name="apply-all-days"
                checked={!applyAllDays}
                onChange={() => toggleApplyAllDays(false)}
                style={{ width: 'auto', padding: 0, margin: 0, flex: '0 0 auto' }}
              />
              <span style={{ whiteSpace: 'nowrap' }}>{t('Set each day')}</span>
              {postcodeLookup.error && <div className="muted" style={{ color: '#dc2626', marginTop: 6 }}>{t(postcodeLookup.error)}</div>}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, color: 'var(--text)', width: '100%', whiteSpace: 'nowrap', textAlign: 'left' }}>
              <input
                type="radio"
                name="apply-all-days"
                checked={applyAllDays}
                onChange={() => toggleApplyAllDays(true)}
                style={{ width: 'auto', padding: 0, margin: 0, flex: '0 0 auto' }}
              />
              <span style={{ whiteSpace: 'nowrap' }}>{t('Apply to all days')}</span>
            </label>
          </div>
        </label>

        {applyAllDays ? (
          <div className="row">
            <label className="field">
              {t('All days open')}
              <input
                type="time"
                value={hours.Mon?.open || ''}
                onChange={(e) => setAllDaysHours('open', e.target.value)}
                onFocus={(e) => { if (!e.target.value) setAllDaysHours('open', '09:00'); }}
              />
            </label>
            <label className="field">
              {t('All days close')}
              <input
                type="time"
                value={hours.Mon?.close || ''}
                onChange={(e) => setAllDaysHours('close', e.target.value)}
                onFocus={(e) => { if (!e.target.value) setAllDaysHours('close', '18:00'); }}
              />
            </label>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr', gap: 8, alignItems: 'center' }}>
              <div />
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('Open Time:')}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('Close Time:')}</div>
            </div>
            {WEEK_DAYS.map((day) => (
              <div key={day} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{day}</div>
                <input
                  type="time"
                  value={hours[day]?.open || ''}
                  onChange={(e) => setDayHours(day, 'open', e.target.value)}
                  onFocus={(e) => { if (!e.target.value) setDayHours(day, 'open', '09:00'); }}
                />
                <input
                  type="time"
                  value={hours[day]?.close || ''}
                  onChange={(e) => setDayHours(day, 'close', e.target.value)}
                  onFocus={(e) => { if (!e.target.value) setDayHours(day, 'close', '18:00'); }}
                />
              </div>
            ))}
          </div>
        )}

        <button className="btn" onClick={create}>{t('Add shop')}</button>
      </div>
      {shops.map(s => (
        <div key={s.id} className="card">
          <strong>{s.name}</strong>
          <div className="muted">{s.address}</div>
          <div className="muted">Open: {s.opening_time} · {s.contact}</div>
        </div>
      ))}
    </div>
  );
}
