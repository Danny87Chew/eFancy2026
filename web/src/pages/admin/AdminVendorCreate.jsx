import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../state/AuthContext.jsx';
import { ALL_ROLES, ROLE_LABELS } from '../../roles';
import PhoneInput from '../../components/PhoneInput.jsx';

const NON_VENDOR_ROLES = new Set(['consumer', 'admin', 'super_admin']);
const VENDOR_ROLES = ALL_ROLES.filter((role) => !NON_VENDOR_ROLES.has(role));
const COUNTRY_CODES = [
  { code: '+65', label: '🇸🇬 +65' },
  { code: '+60', label: '🇲🇾 +60' },
  { code: '+86', label: '🇨🇳 +86' },
];

const EMPTY_SHOP = {
  name: '',
  country: 'SG',
  state: '',
  city: '',
  address: '',
  building_name: '',
  floor_number: '',
  unit_number: '',
  postcode: '',
  road: '',
  town: '',
  district: '',
  mrt: '',
  opening_time: '',
  contact: '',
  contact_cc: '+65',
  office_number: '',
  mobile_number: '',
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun/PBH'];

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

const SG_TOWNS = [
  'Ang Mo Kio', 'Bedok', 'Bishan', 'Boon Lay', 'Bukit Batok', 'Bukit Merah',
  'Bukit Panjang', 'Bukit Timah', 'Central Area', 'Changi', 'Choa Chu Kang',
  'Clementi', 'Downtown Core', 'Geylang', 'Hougang', 'Jurong East', 'Jurong West',
  'Kallang', 'Mandai', 'Marine Parade', 'Newton', 'Novena', 'Orchard',
  'Pasir Ris', 'Punggol', 'Queenstown', 'River Valley', 'Rochor', 'Sembawang',
  'Sengkang', 'Serangoon', 'Tampines', 'Tanglin', 'Toa Payoh', 'Tuas',
  'Woodlands', 'Yishun',
];

const MY_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Malacca',
  'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Putrajaya',
  'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
];

const CN_PROVINCES = [
  'Anhui', 'Beijing', 'Chongqing', 'Fujian', 'Gansu', 'Guangdong', 'Guangxi',
  'Guizhou', 'Hainan', 'Hebei', 'Heilongjiang', 'Henan', 'Hong Kong', 'Hubei',
  'Hunan', 'Inner Mongolia', 'Jiangsu', 'Jiangxi', 'Jilin', 'Liaoning', 'Macau',
  'Ningxia', 'Qinghai', 'Shaanxi', 'Shandong', 'Shanghai', 'Shanxi', 'Sichuan',
  'Taiwan', 'Tianjin', 'Tibet', 'Xinjiang', 'Yunnan', 'Zhejiang',
];

const MY_CITIES = {
  'Johor': ['Johor Bahru', 'Batu Pahat', 'Kluang', 'Muar', 'Pontian', 'Segamat', 'Kulai', 'Skudai', 'Pasir Gudang'],
  'Kedah': ['Alor Setar', 'Sungai Petani', 'Kulim', 'Langkawi'],
  'Kelantan': ['Kota Bharu', 'Pasir Mas', 'Tanah Merah'],
  'Kuala Lumpur': ['Kuala Lumpur'],
  'Labuan': ['Labuan'],
  'Malacca': ['Malacca City', 'Alor Gajah', 'Jasin'],
  'Negeri Sembilan': ['Seremban', 'Port Dickson', 'Nilai'],
  'Pahang': ['Kuantan', 'Temerloh', 'Bentong', 'Raub'],
  'Penang': ['George Town', 'Butterworth', 'Bukit Mertajam'],
  'Perak': ['Ipoh', 'Taiping', 'Teluk Intan', 'Sitiawan'],
  'Perlis': ['Kangar', 'Arau'],
  'Putrajaya': ['Putrajaya'],
  'Sabah': ['Kota Kinabalu', 'Sandakan', 'Tawau', 'Lahad Datu'],
  'Sarawak': ['Kuching', 'Miri', 'Sibu', 'Bintulu'],
  'Selangor': ['Shah Alam', 'Petaling Jaya', 'Klang', 'Subang Jaya', 'Ampang', 'Kajang'],
  'Terengganu': ['Kuala Terengganu', 'Kemaman', 'Dungun'],
};

const CN_CITIES = {
  'Anhui': ['Hefei', 'Wuhu', 'Bengbu'],
  'Beijing': ['Beijing'],
  'Chongqing': ['Chongqing'],
  'Fujian': ['Fuzhou', 'Xiamen', 'Quanzhou'],
  'Gansu': ['Lanzhou'],
  'Guangdong': ['Guangzhou', 'Shenzhen', 'Dongguan', 'Foshan', 'Zhuhai', 'Zhongshan'],
  'Guangxi': ['Nanning', 'Liuzhou', 'Guilin'],
  'Guizhou': ['Guiyang'],
  'Hainan': ['Haikou', 'Sanya'],
  'Hebei': ['Shijiazhuang', 'Tangshan'],
  'Heilongjiang': ['Harbin'],
  'Henan': ['Zhengzhou', 'Luoyang'],
  'Hong Kong': ['Hong Kong'],
  'Hubei': ['Wuhan', 'Yichang'],
  'Hunan': ['Changsha', 'Zhuzhou'],
  'Inner Mongolia': ['Hohhot', 'Baotou'],
  'Jiangsu': ['Nanjing', 'Suzhou', 'Wuxi', 'Changzhou', 'Nantong'],
  'Jiangxi': ['Nanchang', 'Ganzhou'],
  'Jilin': ['Changchun', 'Jilin'],
  'Liaoning': ['Shenyang', 'Dalian'],
  'Macau': ['Macau'],
  'Ningxia': ['Yinchuan'],
  'Qinghai': ['Xining'],
  'Shaanxi': ["Xi'an"],
  'Shandong': ['Jinan', 'Qingdao', 'Yantai'],
  'Shanghai': ['Shanghai'],
  'Shanxi': ['Taiyuan'],
  'Sichuan': ['Chengdu', 'Mianyang'],
  'Taiwan': ['Taipei', 'Kaohsiung', 'Taichung'],
  'Tianjin': ['Tianjin'],
  'Tibet': ['Lhasa'],
  'Xinjiang': ['Urumqi'],
  'Yunnan': ['Kunming'],
  'Zhejiang': ['Hangzhou', 'Ningbo', 'Wenzhou', 'Shaoxing'],
};

const CN_DISTRICTS = {
  'Guangzhou': [
    'Yuexiu', 'Liwan', 'Haizhu', 'Tianhe', 'Baiyun', 'Huangpu',
    'Panyu', 'Huadu', 'Nansha', 'Conghua', 'Zengcheng',
  ],
  'Shenzhen': [
    'Futian', 'Luohu', 'Yantian', 'Nanshan', "Bao'an", 'Longgang',
    'Longhua', 'Pingshan', 'Guangming', 'Dapeng',
  ],
  'Foshan': ['Chancheng', 'Nanhai', 'Shunde', 'Sanshui', 'Gaoming'],
  'Zhongshan': [
    'Shiqi', 'Eastern District', 'Western District', 'Southern District',
    'Wuguishan', 'Shaxi', 'Dachong', 'Sanjiao', 'Minzhong', 'Banfu',
    'Nanlang', 'Tanzhou', 'Henglan', 'Guzhen', 'Xiaolan', 'Dongsheng',
    'Huangpu', 'Nantou', 'Sanxiang', 'Shenwan', 'Tangjiawan',
  ],
  'Dongguan': [
    'Guancheng', 'Nancheng', 'Dongcheng', 'Wanjiang', 'Shilong', 'Humen',
    'Changping', 'Liaobu', 'Dalingshan', 'Dalang', 'Houjie', "Chang'an",
    'Shatian', 'Hongmei', 'Mayong', 'Daojiao', 'Wangniudun', 'Shijie',
    'Qiaotou', 'Hengli', 'Qishi', 'Tangxia', 'Fenggang', 'Xiegang',
    'Qingxi', 'Zhangmutou', 'Dongkeng', 'Shipai', 'Chashan', 'Shipaitou',
    'Wangjiang', 'Gaobu',
  ],
};

const SG_ROADS = [
  'Adam Road', 'Admiralty Road', 'Alexandra Road', 'Aljunied Road', 'Ang Mo Kio Avenue 1', 'Ang Mo Kio Avenue 2',
  'Ang Mo Kio Avenue 3', 'Ang Mo Kio Avenue 4', 'Ang Mo Kio Avenue 5', 'Ang Mo Kio Avenue 6', 'Ang Mo Kio Avenue 8',
  'Ang Mo Kio Avenue 10', 'Anson Road', 'Balestier Road', 'Bartley Road', 'Battery Road', 'Beach Road',
  'Bedok North Avenue 1', 'Bedok North Road', 'Bedok South Avenue 1', 'Bedok South Road', 'Bencoolen Street',
  'Bishan Street 11', 'Bishan Street 13', 'Boon Keng Road', 'Boon Lay Way', 'Braddell Road', 'Bras Basah Road',
  'Bridge Road', 'Bukit Batok East Avenue 3', 'Bukit Batok East Avenue 6', 'Bukit Batok Road',
  'Bukit Batok West Avenue 2', 'Bukit Batok West Avenue 5', 'Bukit Merah Central', 'Bukit Merah View',
  'Bukit Panjang Ring Road', 'Bukit Timah Road', 'Buona Vista Road', 'Cairnhill Road', 'Cantonment Road',
  'Cecil Street', 'Changi Road', 'Choa Chu Kang Avenue 1', 'Choa Chu Kang Avenue 4', 'Choa Chu Kang Road',
  'Church Street', 'Circular Road', 'Clarke Quay', 'Clementi Avenue 2', 'Clementi Avenue 3', 'Clementi Road',
  'Collyer Quay', 'Commonwealth Avenue', 'Commonwealth Avenue West', 'Cross Street', 'Cuscaden Road',
  'Depot Road', 'Devonshire Road', 'Dover Road', 'Dunearn Road', 'East Coast Road', 'Eu Tong Sen Street',
  'Farrer Road', 'Frankel Avenue', 'Fullerton Road', 'Geylang Road', 'Ghim Moh Road', 'Hampshire Road',
  'Havelock Road', 'Henderson Road', 'Hill Street', 'Holland Road', 'Hougang Avenue 3', 'Hougang Avenue 8',
  'Hougang Avenue 10', 'Jalan Besar', 'Jalan Bukit Merah', 'Jalan Eunos', 'Jalan Kayu', 'Jalan Sultan',
  'Joo Chiat Road', 'Jurong East Avenue 1', 'Jurong East Street 13', 'Jurong East Street 21',
  'Jurong West Avenue 1', 'Jurong West Street 41', 'Jurong West Street 61', 'Kallang Avenue', 'Kallang Road',
  'Keppel Road', 'Killiney Road', 'Kim Tian Road', 'Kitchener Road', 'Lavender Street', 'Loyang Avenue',
  'Lornie Road', 'Lower Delta Road', 'Macpherson Road', 'Mandai Road', 'Marina Boulevard',
  'Marine Parade Road', 'Market Street', 'Maxwell Road', 'Middle Road', 'Mountbatten Road',
  'New Bridge Road', 'New Industrial Road', 'Newton Road', 'Nicoll Highway', 'North Bridge Road',
  'North Buona Vista Road', 'Novena Terrace', 'Ophir Road', 'Orchard Boulevard', 'Orchard Road',
  'Orchard Turn', 'Outram Road', 'Pasir Panjang Road', 'Pasir Ris Drive 1', 'Pasir Ris Drive 3',
  'Paya Lebar Road', 'Penang Road', 'Pioneer Road', 'Prinsep Street', 'Punggol Central', 'Punggol Field',
  'Punggol Road', 'Queensway', 'Raffles Avenue', 'Raffles Boulevard', 'Raffles Place', 'Raffles Quay',
  'River Valley Road', 'Robinson Road', 'Rochor Road', 'Sago Street', 'Scotts Road', 'Selegie Road',
  'Sembawang Road', 'Sengkang East Avenue', 'Sengkang West Avenue', 'Serangoon Avenue 2', 'Serangoon Avenue 3',
  'Serangoon Road', 'Shenton Way', 'Sims Avenue', 'Sims Drive', 'Smith Street', 'South Bridge Road',
  'Stamford Road', 'Stevens Road', 'Still Road', 'Sungei Kadut Avenue', 'Tampines Avenue 1',
  'Tampines Avenue 4', 'Tampines Avenue 5', 'Tampines Avenue 7', 'Tampines Avenue 9', 'Tampines Street 11',
  'Tampines Street 21', 'Tampines Street 32', 'Tampines Street 81', 'Tanglin Road', 'Tanjong Katong Road',
  'Tanjong Pagar Road', 'Tannery Lane', 'Telok Ayer Street', 'Telok Blangah Road', 'Telok Kurau Road',
  'Temasek Avenue', 'Temasek Boulevard', 'Thomson Road', 'Tiong Bahru Road', 'Toa Payoh Central',
  'Toa Payoh Lorong 1', 'Toa Payoh Lorong 4', 'Toa Payoh Lorong 6', 'Toa Payoh North', 'Tras Street',
  'Tuas Avenue', 'Tuas Road', 'Ubi Avenue 1', 'Ubi Road 1', 'Ulu Pandan Road', 'Upper Bukit Timah Road',
  'Upper Changi Road', 'Upper Cross Street', 'Upper East Coast Road', 'Upper Paya Lebar Road',
  'Upper Serangoon Road', 'Upper Thomson Road', 'Verdun Road', 'Victoria Street', 'West Coast Highway',
  'West Coast Road', 'Whitley Road', 'Woodlands Avenue 2', 'Woodlands Avenue 5', 'Woodlands Drive 14',
  'Woodlands Drive 50', 'Woodlands Road', 'Yio Chu Kang Road', 'Yishun Avenue 2', 'Yishun Avenue 6',
  'Yishun Avenue 9', 'Yishun Ring Road', 'Yishun Street 11', 'Yishun Street 22', 'York Hill', 'Zion Road',
];

const CN_ROADS = {
  'Guangzhou': [
    'Beijing Road', 'Renmin North Road', 'Renmin Middle Road', 'Renmin South Road',
    'Jiefang North Road', 'Jiefang Middle Road', 'Jiefang South Road',
    'Zhongshan 1st Road', 'Zhongshan 2nd Road', 'Zhongshan 3rd Road', 'Zhongshan 4th Road',
    'Zhongshan 5th Road', 'Zhongshan 6th Road', 'Zhongshan 7th Road', 'Zhongshan 8th Road',
    'Huanshi East Road', 'Huanshi Middle Road', 'Huanshi West Road',
    'Dongfeng East Road', 'Dongfeng Middle Road', 'Dongfeng West Road',
    'Tianhe Road', 'Tianhe North Road', 'Tiyu East Road', 'Tiyu West Road',
    'Linhe West Road', 'Linhe East Road', 'Zhujiang East Road', 'Zhujiang West Road',
    'Huangpu Avenue East', 'Huangpu Avenue West', 'Guangzhou Avenue North', 'Guangzhou Avenue Middle',
    'Guangzhou Avenue South', 'Yuexiu North Road', 'Yuexiu South Road', 'Wende Road',
    'Yanjiang East Road', 'Yanjiang West Road', 'Changdi Road', 'Liwan Road',
    'Xingang East Road', 'Xingang Middle Road', 'Xingang West Road', 'Kecun Road',
    'Binjiang East Road', 'Binjiang West Road', 'Panyu Avenue', 'Shiqiao Road',
    'Baiyun Avenue North', 'Baiyun Avenue South', 'Jichang Road', 'Yangji Road',
  ],
  'Shenzhen': [
    'Shennan Boulevard', 'Shennan East Road', 'Shennan Middle Road', 'Shennan West Road',
    'Binhe Boulevard', 'Binhai Boulevard', 'Houhai Avenue', 'Nanhai Avenue',
    'Hongli Road', 'Hongling North Road', 'Hongling Middle Road', 'Hongling South Road',
    'Caitian Road', 'Fuhua 1st Road', 'Fuhua 2nd Road', 'Fuhua 3rd Road',
    'Keyuan Road', 'Gaoxin Middle Avenue', 'Gaoxin South Avenue',
    'Shahe West Road', 'Qiaocheng East Road', 'Qiaocheng North Road',
    "Bao'an Avenue", 'Bagua 1st Road', 'Bagua 2nd Road', 'Bagua 3rd Road',
    'Aiguo Road', 'Wenjin Middle Road', 'Wenjin South Road', 'Jiabin Road',
    'Renmin North Road', 'Renmin South Road', 'Dongmen North Road', 'Dongmen Middle Road',
    'Dongmen South Road', 'Liantang Road', 'Yantian Road', 'Mingzhu Avenue',
  ],
  'Foshan': [
    'Foshan Avenue', 'Lingnan Avenue North', 'Lingnan Avenue Middle', 'Lingnan Avenue South',
    'Jihua 1st Road', 'Jihua 2nd Road', 'Jihua 3rd Road', 'Jihua 4th Road', 'Jihua 5th Road',
    'Wenhua Road', 'Renmin Road', 'Fenjiang North Road', 'Fenjiang Middle Road', 'Fenjiang South Road',
    'Jianxin Road', 'Nanhai Avenue', 'Guicheng Avenue', 'Dali Avenue',
    'Shunde Avenue', 'Daliang Avenue', 'Sanshui Avenue', 'Gaoming Avenue',
  ],
  'Zhongshan': [
    'Zhongshan 1st Road', 'Zhongshan 2nd Road', 'Zhongshan 3rd Road',
    'Zhongshan 4th Road', 'Zhongshan 5th Road', 'Zhongshan 6th Road',
    'Sunwen East Road', 'Sunwen Middle Road', 'Sunwen West Road',
    'Xingzhong Road', "Bo'ai 1st Road", "Bo'ai 2nd Road", "Bo'ai 3rd Road",
    "Bo'ai 4th Road", "Bo'ai 5th Road", "Bo'ai 6th Road",
    'Qiwan Road', 'Songyuan Road', 'Dongming Road', 'Fuhua Road', 'Tianyi Road',
  ],
  'Dongguan': [
    'Dongguan Avenue', 'Hongfu Road', 'Dongcheng Middle Road', 'Dongcheng West Road',
    'Nancheng Road', 'Guantai Road', 'Tiyu Road', 'Xinghe Road',
    'Humen Avenue', 'Changping Avenue', 'Houjie Avenue', "Chang'an Avenue",
    'Liaobu Avenue', 'Dalingshan Avenue', 'Dalang Avenue', 'Shilong Avenue',
  ],
};

function buildMobile(cc, local) {
  return `${cc}${String(local || '').replace(/\s+/g, '')}`.trim();
}

const MOBILE_RULES = {
  '+65': { len: 8,  placeholder: '8/9XXXXXXX',    pattern: /^[89]\d{7}$/, label: '8 digits starting with 8 or 9 required' },
  '+60': { len: 8,  placeholder: 'XXXXXXXX',      pattern: /^\d{8}$/,     label: '8 digits required' },
  '+86': { len: 11, placeholder: '1XXXXXXXXXX', pattern: /^1\d{10}$/,   label: '11 digits starting with 1 required' },
};

function mobileMaxLen(cc) {
  return MOBILE_RULES[cc]?.len ?? 15;
}

function mobilePlaceholder(cc) {
  return MOBILE_RULES[cc]?.placeholder ?? 'Local number';
}

function contactPlaceholder(cc) {
  const len = MOBILE_RULES[cc]?.len ?? 8;
  return 'X'.repeat(len);
}

function validateLocalMobile(cc, local) {
  const digits = String(local || '').replace(/\D/g, '');
  const rule = MOBILE_RULES[cc];
  if (!rule) return digits.length >= 7 ? '' : 'Mobile number is too short.';
  return rule.pattern.test(digits) ? '' : rule.label;
}

// Contact numbers (landline/business) only require correct digit count,
// no leading-digit restriction.
function validateContactNumber(cc, local) {
  const digits = String(local || '').replace(/\D/g, '');
  const rule = MOBILE_RULES[cc];
  if (!rule) return digits.length >= 7 ? '' : 'Contact number is too short.';
  if (digits.length !== rule.len) return `${rule.len} digits required`;
  return '';
}

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

function parseOpeningTimeText(text) {
  const out = Object.fromEntries(WEEK_DAYS.map((d) => [d, { open: '', close: '' }]));
  if (!text) return out;
  for (const part of String(text).split(';')) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/^(\S+)\s+(.+)$/);
    if (!m) continue;
    const day = m[1];
    if (!(day in out)) continue;
    const rest = m[2].trim();
    if (/^closed$/i.test(rest)) { out[day] = { open: '', close: '' }; continue; }
    const tm = rest.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (tm) out[day] = { open: tm[1], close: tm[2] };
  }
  return out;
}

function parseMobile(full) {
  const s = String(full || '').trim();
  for (const { code } of COUNTRY_CODES) {
    if (s.startsWith(code)) return { cc: code, local: s.slice(code.length) };
  }
  return { cc: COUNTRY_CODES[0].code, local: s.replace(/^\+/, '') };
}

export default function AdminVendorCreate({ selfMode = false, onSelfFormChange, hideActions = false } = {}) {
  const navigate = useNavigate();
  const params = useParams();
  const { logout } = useAuth();
  const { t } = useTranslation();
  const editId = selfMode ? 'self' : params.id;
  const isEdit = selfMode ? true : !!editId;

  const [vendorForm, setVendorForm] = useState({
    nickname: '',
    owner_name: '',
    business_licence: '',
    mobile_cc: COUNTRY_CODES[0].code,
    mobile_local: '',
    role: VENDOR_ROLES[0] || 'service_vendor',
    staffs: [],
  });
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [vendorErr, setVendorErr] = useState('');

  const [shopForm, setShopForm] = useState(EMPTY_SHOP);
  const [shopHours, setShopHours] = useState(createEmptyHours);
  const [applyAllDays, setApplyAllDays] = useState(false);
  const [creatingShop, setCreatingShop] = useState(false);
  const [shopErr, setShopErr] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [initialSnapshot, setInitialSnapshot] = useState(null);

  const currentSnapshot = JSON.stringify({ vendorForm, shopForm, shopHours, applyAllDays });
  const isDirty = initialSnapshot !== null && currentSnapshot !== initialSnapshot;

  useEffect(() => {
    if (isEdit) return;
    setInitialSnapshot(JSON.stringify({ vendorForm, shopForm, shopHours, applyAllDays }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function fetchVendorData() {
    setLoadingEdit(true);
    try {
      let u;
      if (selfMode) {
        const { user } = await api('/api/vendor/profile/self');
        u = user;
      } else {
        const { users } = await api('/api/admin/users');
        u = (users || []).find((x) => String(x.id) === String(editId));
      }
      if (!u) { setVendorErr(t('Vendor not found.')); setLoadingEdit(false); return; }
      const p = u.vendor_profile || {};
      const ownerMobile = parseMobile(u.mobile);
      const contactParsed = parseMobile(p.contact_number || '');
      const nextVendorForm = {
        nickname: u.nickname || '',
        owner_name: u.real_name || '',
        business_licence: p.business_licence || '',
        mobile_cc: ownerMobile.cc,
        mobile_local: ownerMobile.local,
        role: u.role,
        staffs: (u.staffs || []).map((s) => {
          const parsed = parseMobile(s.staff_mobile);
          return { mobile_cc: parsed.cc, mobile_local: parsed.local, is_admin: !!s.is_admin, name: s.name || '' };
        }),
      };
      const nextShopForm = {
        ...EMPTY_SHOP,
        name: p.merchant_name || u.real_name || '',
        country: p.country === 'CN' ? 'CN' : 'SG',
        address: p.address || '',
        building_name: p.building_name || '',
        floor_number: p.floor_number || p.floor || '',
        unit_number: p.unit_number || '',
        postcode: p.postcode || '',
        road: p.road || '',
        town: p.town || '',
        district: p.district || '',
        mrt: p.mrt || '',
        contact: p.contact_number ? contactParsed.local : '',
        contact_cc: p.contact_number ? contactParsed.cc : '+65',
        office_number: p.office_number || '',
        mobile_number: p.mobile_number || '',
      };
      const nextShopHours = parseOpeningTimeText(p.business_hours || '');
      setVendorForm(nextVendorForm);
      setShopForm(nextShopForm);
      setShopHours(nextShopHours);
      setInitialSnapshot(JSON.stringify({ vendorForm: nextVendorForm, shopForm: nextShopForm, shopHours: nextShopHours, applyAllDays: false }));
      setVendorErr('');
    } catch (e) {
      setVendorErr('Failed to load vendor data.');
    } finally {
      setLoadingEdit(false);
    }
  }

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      await fetchVendorData();
    })();
    return () => { cancelled = true; };
  }, [editId, isEdit, selfMode]);

  useEffect(() => {
    if (!selfMode || typeof onSelfFormChange !== 'function') return;
    const mapped = {
      merchant_name: vendorForm.nickname || '',
      address: shopForm.address || '',
      building_name: shopForm.building_name || '',
      floor_number: shopForm.floor_number || '',
      unit_number: shopForm.unit_number || '',
      post_code: shopForm.postcode || '',
      contact_number: shopForm.contact || shopForm.office_number || shopForm.mobile_number || '',
      business_hours: toOpeningTimeText(shopHours),
      business_licence: vendorForm.business_licence || '',
      staff_mobiles: vendorForm.staffs || [],
    };
    try { onSelfFormChange(mapped); } catch (e) { /* ignore */ }
  }, [selfMode, onSelfFormChange, vendorForm, shopForm, shopHours]);

  const filteredMrtStations = useMemo(() => {
    const q = shopForm.mrt.trim().toLowerCase();
    if (!q) return SG_MRT_STATIONS;
    return SG_MRT_STATIONS.filter((station) => station.toLowerCase().startsWith(q));
  }, [shopForm.mrt]);

  const filteredTowns = useMemo(() => {
    const q = shopForm.town.trim().toLowerCase();
    if (!q) return SG_TOWNS;
    return SG_TOWNS.filter((t) => t.toLowerCase().startsWith(q));
  }, [shopForm.town]);

  const stateOptions = shopForm.country === 'MY' ? MY_STATES : shopForm.country === 'CN' ? CN_PROVINCES : [];
  const filteredStates = useMemo(() => {
    const q = shopForm.state.trim().toLowerCase();
    if (!q) return stateOptions;
    return stateOptions.filter((s) => s.toLowerCase().startsWith(q));
  }, [shopForm.state, stateOptions]);

  const isLensVendor = vendorForm.role === 'spectacle_lens_vendor' || vendorForm.role === 'spectacle_frame_vendor';

  const cityOptions = useMemo(() => {
    if (shopForm.country === 'MY') return MY_CITIES[shopForm.state] || [];
    if (shopForm.country === 'CN') return CN_CITIES[shopForm.state] || [];
    return [];
  }, [shopForm.country, shopForm.state]);
  const filteredCities = useMemo(() => {
    const q = shopForm.city.trim().toLowerCase();
    if (!q) return cityOptions;
    return cityOptions.filter((c) => c.toLowerCase().startsWith(q));
  }, [shopForm.city, cityOptions]);

  const districtOptions = useMemo(() => {
    if (shopForm.country === 'CN') return CN_DISTRICTS[shopForm.city] || [];
    return [];
  }, [shopForm.country, shopForm.city]);
  const filteredDistricts = useMemo(() => {
    const q = shopForm.district.trim().toLowerCase();
    if (!q) return districtOptions;
    return districtOptions.filter((d) => d.toLowerCase().startsWith(q));
  }, [shopForm.district, districtOptions]);

  const createVendor = async () => {
    setVendorErr('');
    const mobile = buildMobile(vendorForm.mobile_cc, vendorForm.mobile_local);
    if (!vendorForm.mobile_local.trim()) {
      setVendorErr(t('Please enter a local mobile number ({{placeholder}}).', { placeholder: mobilePlaceholder(vendorForm.mobile_cc) }));
      return;
    }
    const mobileErr = validateLocalMobile(vendorForm.mobile_cc, vendorForm.mobile_local);
    if (mobileErr) { setVendorErr(mobileErr); return; }

    if (shopForm.contact.trim()) {
      const contactErr = validateContactNumber(shopForm.contact_cc, shopForm.contact);
      if (contactErr) { setVendorErr(t('Contact: {{err}}', { err: contactErr })); return; }
    }

    const staffs = vendorForm.staffs
      .map((s) => ({
        staff_mobile: buildMobile(s.mobile_cc, s.mobile_local),
        is_admin: !!s.is_admin,
        name: (s.name || '').trim() || null,
        _cc: s.mobile_cc,
        _local: s.mobile_local,
      }))
      .filter((s) => s._local.length > 0);

    for (const s of staffs) {
      const e = validateLocalMobile(s._cc, s._local);
      if (e) { setVendorErr(t('Staff {{mobile}}: {{err}}', { mobile: s.staff_mobile, err: e })); return; }
    }

    const staffSet = new Set();
    for (const s of staffs) {
      if (s.staff_mobile === mobile) {
        setVendorErr(t('Staff mobile cannot be the same as owner mobile.'));
        return;
      }
      if (staffSet.has(s.staff_mobile)) {
        setVendorErr(t('Duplicate staff mobile numbers are not allowed.'));
        return;
      }
      staffSet.add(s.staff_mobile);
    }

    setCreatingVendor(true);
    try {
      if (isEdit) {
        const url = selfMode ? '/api/vendor/profile/self' : `/api/admin/users/${editId}`;
        await api(url, {
          method: 'PATCH',
          body: {
            nickname: vendorForm.nickname.trim() || null,
            real_name: vendorForm.owner_name.trim() || null,
            business_licence: vendorForm.business_licence.trim() || null,
            merchant_name: shopForm.name.trim() || vendorForm.nickname.trim() || null,
            contact_number: shopForm.contact.trim() ? buildMobile(shopForm.contact_cc, shopForm.contact) : null,
            office_number: shopForm.office_number.trim() || null,
            mobile_number: shopForm.mobile_number.trim() || null,
            address: shopForm.address.trim() || null,
            postcode: shopForm.postcode.trim() || null,
            road: shopForm.road.trim() || null,
            town: shopForm.town.trim() || null,
            district: shopForm.district.trim() || null,
            mrt: shopForm.mrt.trim() || null,
            business_hours: toOpeningTimeText(shopHours),
            building_name: shopForm.building_name?.trim() || null,
            floor_number: shopForm.floor_number?.trim() || null,
            unit_number: shopForm.unit_number?.trim() || null,
            country: shopForm.country === 'CN' ? 'CN' : 'SG',
            staffs: staffs.map(({ staff_mobile, is_admin, name }) => ({ staff_mobile, is_admin, name })),
          },
        });
        if (selfMode) {
          setInitialSnapshot(JSON.stringify({ vendorForm, shopForm, shopHours, applyAllDays }));
        } else {
          navigate('/admin/vendors');
        }
        return;
      }
      await api('/api/admin/users', {
        method: 'POST',
        body: {
          mobile,
          role: vendorForm.role,
          nickname: vendorForm.nickname.trim() || undefined,
          real_name: vendorForm.owner_name.trim() || undefined,
          business_licence: vendorForm.business_licence.trim() || undefined,
          merchant_name: shopForm.name.trim() || vendorForm.nickname.trim() || undefined,
          contact_number: shopForm.contact.trim() ? buildMobile(shopForm.contact_cc, shopForm.contact) : undefined,
          office_number: shopForm.office_number.trim() || undefined,
          mobile_number: shopForm.mobile_number.trim() || undefined,
          address: shopForm.address.trim() || undefined,
          postcode: shopForm.postcode.trim() || undefined,
          road: shopForm.road.trim() || undefined,
          town: shopForm.town.trim() || undefined,
          district: shopForm.district.trim() || undefined,
          mrt: shopForm.mrt.trim() || undefined,
          business_hours: toOpeningTimeText(shopHours),
          building_name: shopForm.building_name?.trim() || undefined,
          floor_number: shopForm.floor_number?.trim() || undefined,
          unit_number: shopForm.unit_number?.trim() || undefined,
          country: shopForm.country === 'CN' ? 'CN' : 'SG',
          staffs: staffs.map(({ staff_mobile, is_admin, name }) => ({ staff_mobile, is_admin, name })),
        },
      });
      setVendorForm((prev) => ({
        nickname: '',
        owner_name: '',
        business_licence: '',
        mobile_cc: prev.mobile_cc,
        mobile_local: '',
        role: prev.role,
        staffs: [],
      }));
      setShopForm(EMPTY_SHOP);
      setShopHours(createEmptyHours());
      setApplyAllDays(false);
      navigate('/admin/vendors');
    } catch (e) {
      if (e?.data?.error === 'mobile_taken') setVendorErr(t('This mobile is already registered.'));
      else if (e?.data?.error === 'invalid_mobile') setVendorErr(t('Invalid mobile format. Example: +6591234567'));
      else if (e?.data?.error === 'invalid_vendor_role') setVendorErr(t('Please choose a valid vendor category.'));
      else if (e?.data?.error === 'duplicate_staff_mobile') setVendorErr(t('Duplicate staff mobile numbers are not allowed.'));
      else if (e?.data?.error === 'staff_mobile_required') setVendorErr(t('Each associated staff must have a mobile number.'));
      else if (e?.data?.error === 'staff_cannot_be_owner') setVendorErr(t('Staff mobile cannot be the same as owner mobile.'));
      else if (e?.data?.error === 'invalid_staff_mobile') setVendorErr(t('One or more staff mobiles are invalid.'));
      else setVendorErr(e?.data?.error || t('Failed to add vendor.'));
    } finally {
      setCreatingVendor(false);
    }
  };

  const addStaff = () => {
    setVendorForm((prev) => ({
      ...prev,
      staffs: [...prev.staffs, { mobile_cc: COUNTRY_CODES[0].code, mobile_local: '', is_admin: false, name: '' }],
    }));
  };

  const updateStaff = (idx, patch) => {
    setVendorForm((prev) => ({
      ...prev,
      staffs: prev.staffs.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const removeStaff = (idx) => {
    setVendorForm((prev) => ({
      ...prev,
      staffs: prev.staffs.filter((_, i) => i !== idx),
    }));
  };

  const createShop = async () => {
    setShopErr('');
    if (!shopForm.name.trim()) {
      setShopErr('Shop name is required.');
      return;
    }
    setCreatingShop(true);
    try {
      await api('/api/shops', {
        method: 'POST',
        body: {
          ...shopForm,
          opening_time: toOpeningTimeText(shopHours),
        },
      });
      setShopForm(EMPTY_SHOP);
      setShopHours(createEmptyHours());
      setApplyAllDays(false);
    } catch (e) {
      setShopErr(e?.data?.error || 'Failed to add shop.');
    } finally {
      setCreatingShop(false);
    }
  };

  const setDayHours = (day, key, value) => {
    setShopHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [key]: value,
      },
    }));
  };

  const setAllDaysHours = (key, value) => {
    setShopHours((prev) => Object.fromEntries(
      WEEK_DAYS.map((day) => [day, { ...prev[day], [key]: value }])
    ));
  };

  const toggleApplyAllDays = (enabled) => {
    setApplyAllDays(enabled);
    if (!enabled) return;
    const seed = shopHours.Mon || { open: '', close: '' };
    setShopHours((prev) => Object.fromEntries(
      WEEK_DAYS.map((day) => [day, { ...prev[day], open: seed.open, close: seed.close }])
    ));
  };

  const renderShopField = (key, label = key) => (
    <label key={key} className="field">
      {label}
      <input value={shopForm[key]} onChange={e => setShopForm({ ...shopForm, [key]: e.target.value })} />
    </label>
  );

  const clearShopField = (key) => setShopForm((prev) => ({ ...prev, [key]: '' }));
  const renderClearX = (key, onClick) => shopForm[key] ? (
    <button
      type="button"
      onClick={onClick || (() => clearShopField(key))}
      title="Clear"
      style={{
        position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: '#555', fontSize: 26, lineHeight: 1, padding: 0, fontWeight: 700,
      }}
    >×</button>
  ) : null;
  const renderClearableField = (key, label) => (
    <label className="field">
      {label}
      <div style={{ position: 'relative' }}>
        <input
          value={shopForm[key]}
          onChange={(e) => setShopForm({ ...shopForm, [key]: e.target.value })}
          style={{ paddingLeft: 36, width: '100%' }}
        />
        {renderClearX(key)}
      </div>
    </label>
  );

  const [postcodeLookup, setPostcodeLookup] = useState({ loading: false, error: '' });
  const [roadOptions, setRoadOptions] = useState([]);

  const lookupPostcode = async (postcode) => {
    const pc = String(postcode || '').trim();
    if (!/^\d{6}$/.test(pc)) {
      setPostcodeLookup({ loading: false, error: 'Enter a 6-digit Singapore postcode.' });
      return;
    }
    setPostcodeLookup({ loading: true, error: '' });
    try {
      const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(pc)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('lookup_failed');
      const data = await r.json();
      const hit = (data.results || [])[0];
      if (!hit) {
        setPostcodeLookup({ loading: false, error: 'No address found for this postcode.' });
        return;
      }
      const roads = Array.from(new Set(
        (data.results || [])
          .map((h) => (h.ROAD_NAME || '').trim())
          .filter(Boolean)
      ));
      setRoadOptions(roads);
      const blk = (hit.BLK_NO || '').trim();
      const road = (hit.ROAD_NAME || '').trim();
      const building = (hit.BUILDING && hit.BUILDING !== 'NIL') ? hit.BUILDING.trim() : '';
      const fullAddr = (hit.ADDRESS || [blk, road, building].filter(Boolean).join(' ')).trim();
      setShopForm((prev) => ({
        ...prev,
        postcode: pc,
        address: fullAddr || prev.address,
        road: road || prev.road,
        building_name: building || prev.building_name,
      }));
      setPostcodeLookup({ loading: false, error: '' });
    } catch {
      setPostcodeLookup({ loading: false, error: 'Postcode lookup failed.' });
    }
  };

  const resetToInitial = () => {
    if (!initialSnapshot) return;
    const snap = JSON.parse(initialSnapshot);
    setVendorForm(snap.vendorForm);
    setShopForm(snap.shopForm);
    setShopHours(snap.shopHours);
    setApplyAllDays(snap.applyAllDays);
    setVendorErr('');
  };

  const handleCancel = () => {
    if (isEdit) {
      // reload from database
      fetchVendorData();
      return;
    }
    if (isDirty) {
      resetToInitial();
    } else if (!selfMode) {
      navigate('/admin/vendors');
    }
  };

  const handleExitEdit = () => {
    if (isDirty) {
      if (!confirm(t('You have unsaved changes — discard and exit?'))) return;
    }
    navigate('/admin/vendors');
  };

  return (
    <div>
      {!selfMode && (
        <div className="card">
          <strong>{isEdit ? t('Edit Vendor') : t('Add Vendor')}</strong>
        </div>
      )}

      <div className="card">
        {!hideActions && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, justifyContent: 'center' }}>
            <button
            className="btn secondary"
            style={{ width: 'auto', padding: '12px 28px', fontSize: 16 }}
            onClick={handleCancel}
            disabled={creatingVendor || (selfMode && !isDirty)}
          >
            {t('Form.Reset')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
            className="btn secondary"
            style={{ width: 'auto', padding: '12px 28px', fontSize: 16 }}
            onClick={handleExitEdit}
            disabled={!isEdit || selfMode || creatingVendor}
          >
            {t('Form.Cancel')}
          </button>
            <button
            className="btn"
            style={{ width: 'auto', padding: '12px 28px', fontSize: 16 }}
            onClick={createVendor}
            disabled={creatingVendor || loadingEdit || !isDirty}
          >
            {loadingEdit ? t('Loading') : creatingVendor
              ? (isEdit ? t('Saving…') : t('Adding vendor…'))
              : (isEdit ? t('Save Changes') : t('Add Vendor'))}
          </button>
          </div>
          </div>
        )}
        {!selfMode && (
          <label className="field">
            {t('Vendor category')}
            <select
              value={vendorForm.role}
              onChange={(e) => setVendorForm((prev) => ({ ...prev, role: e.target.value }))}
            >
              {VENDOR_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
              ))}
            </select>
          </label>
        )}

        <label className="field" style={{ marginTop: 10 }}>
          {t('Vendor name')}
          <input
            value={vendorForm.nickname}
            onChange={(e) => setVendorForm((prev) => ({ ...prev, nickname: e.target.value }))}
            placeholder={t('e.g. Dan Optical')}
          />
        </label>
        <label className="field">
          {t('Business Licence')}
          <input
            value={vendorForm.business_licence}
            onChange={(e) => setVendorForm((prev) => ({ ...prev, business_licence: e.target.value }))}
            placeholder={t('Business licence number')}
          />
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <label className="field">
              {t('Owner name')}
              <input
                value={vendorForm.owner_name}
                onChange={(e) => setVendorForm((prev) => ({ ...prev, owner_name: e.target.value }))}
                placeholder={t('Owner name')}
              />
            </label>
          </div>
          <div style={{ width: 300 }}>
            <PhoneInput
              label={t('Owner Mobile')}
              value={(vendorForm.mobile_cc || '+65') + (vendorForm.mobile_local || '')}
              onChange={(v) => {
                const parsed = parseMobile(v);
                setVendorForm((prev) => ({ ...prev, mobile_cc: parsed.cc, mobile_local: parsed.local }));
              }}
            />
          </div>
        </div>

        <div className="row">
          <PhoneInput
            allowAnyLeading
            label={<div style={{ marginBottom: 6, fontWeight: 700 }}>{t('Office Number')}</div>}
            value={shopForm.office_number || ''}
            onChange={(v) => setShopForm({ ...shopForm, office_number: v })}
          />
          <PhoneInput
            label={<div style={{ marginBottom: 6, fontWeight: 700 }}>{t('Mobile Number')}</div>}
            value={shopForm.mobile_number || ''}
            onChange={(v) => setShopForm({ ...shopForm, mobile_number: v })}
          />
        </div>

        {/* Full Address textarea moved below, above Road Name */}

        {/* Owner name and Contact Number removed per request */}

        {/* Vendor Mobile field removed as requested */}

        

        {/* Associated Staffs moved to the end of the form */}

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          <label className="field">
            {t('Country')}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'nowrap', overflowX: 'auto' }}>
              {[
                { value: 'SG', label: t('🇸🇬 Singapore') },
                { value: 'MY', label: t('🇲🇾 Malaysia') },
                { value: 'CN', label: t('🇨🇳 China') },
              ].map((opt) => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="radio"
                    name="vendor-country"
                    value={opt.value}
                    checked={shopForm.country === opt.value}
                    onChange={() => {
                      setShopForm({
                        ...shopForm,
                        country: opt.value,
                        state: '', city: '', address: '', postcode: '', road: '',
                        town: '', district: '', mrt: '',
                      });
                      setRoadOptions([]);
                      setPostcodeLookup({ loading: false, error: '' });
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </label>
          {shopForm.country !== 'SG' && (
            <label className="field">
              {t('Province/State')}
              <div style={{ position: 'relative' }}>
                <input
                  list="vendor-state-list"
                  value={shopForm.state}
                  onChange={(e) => {
                    setShopForm({
                      ...shopForm,
                      state: e.target.value,
                      city: '', address: '', postcode: '', road: '',
                      town: '', district: '', mrt: '',
                    });
                    setRoadOptions([]);
                    setPostcodeLookup({ loading: false, error: '' });
                  }}
                  placeholder={t('Select or type province/state')}
                  style={{ paddingLeft: 36, width: '100%' }}
                />
                {renderClearX('state', () => {
                  setShopForm({
                    ...shopForm,
                    state: '', city: '', address: '', postcode: '', road: '',
                    town: '', district: '', mrt: '',
                  });
                  setRoadOptions([]);
                  setPostcodeLookup({ loading: false, error: '' });
                })}
              </div>
              <datalist id="vendor-state-list">
                {filteredStates.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
          )}
          {shopForm.country !== 'SG' && (
            <label className="field">
              {t('City')}
              <div style={{ position: 'relative' }}>
                <input
                  list="vendor-city-list"
                  value={shopForm.city}
                  onChange={(e) => {
                    setShopForm({
                      ...shopForm,
                      city: e.target.value,
                      address: '', postcode: '', road: '',
                      town: '', district: '', mrt: '',
                    });
                    setRoadOptions([]);
                    setPostcodeLookup({ loading: false, error: '' });
                  }}
                  placeholder={t('Select or type city')}
                  style={{ paddingLeft: 36, width: '100%' }}
                />
                {renderClearX('city', () => {
                  setShopForm({
                    ...shopForm,
                    city: '', address: '', postcode: '', road: '',
                    town: '', district: '', mrt: '',
                  });
                  setRoadOptions([]);
                  setPostcodeLookup({ loading: false, error: '' });
                })}
              </div>
              <datalist id="vendor-city-list">
                {filteredCities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          )}
          <label className="field">
            {t('Full Address')}
            <div style={{ position: 'relative' }}>
              <textarea
                value={shopForm.address}
                onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                placeholder={t('Enter full address')}
                rows="3"
                style={{ paddingLeft: 36, width: '100%' }}
              />
              {renderClearX('address')}
            </div>
          </label>

          <label className="field">
            {t('Road Name')}
            <div style={{ position: 'relative' }}>
              <input
                list="vendor-road-list"
                value={shopForm.road}
                onChange={(e) => setShopForm({ ...shopForm, road: e.target.value })}
                placeholder={t('Select or type road name')}
                style={{ paddingLeft: 36, width: '100%' }}
              />
              {renderClearX('road')}
            </div>
            <datalist id="vendor-road-list">
              {(shopForm.country === 'SG'
                ? Array.from(new Set([...roadOptions, ...SG_ROADS]))
                : shopForm.country === 'CN' && CN_ROADS[shopForm.city]
                  ? Array.from(new Set([...roadOptions, ...CN_ROADS[shopForm.city]]))
                  : roadOptions
              )
                .filter((r) => !shopForm.road.trim() || r.toLowerCase().startsWith(shopForm.road.trim().toLowerCase()))
                .map((r) => (
                  <option key={r} value={r} />
                ))}
            </datalist>
          </label>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'flex-start' }}>
            <label className="field" style={{ flex: 1, minWidth: 0 }}>
              {t('Building Name:')}
              <div style={{ position: 'relative' }}>
                  <input placeholder={t('Building name')} value={shopForm.building_name || ''} onChange={(e) => setShopForm({ ...shopForm, building_name: e.target.value })} style={{ paddingLeft: 36, width: '100%' }} />
                {renderClearX('building_name')}
              </div>
            </label>
            <label className="field" style={{ width: 60 }}>
              {t('Floor:') || t('Floor') || 'Floor:'}
                <input placeholder={t('Floor')} value={shopForm.floor_number || ''} onChange={(e) => setShopForm({ ...shopForm, floor_number: e.target.value })} style={{ width: '100%' }} />
            </label>
              <label className="field" style={{ width: 110 }}>
                {t('Unit:') || t('Unit') || 'Unit:'}
                <input placeholder={t('Unit number')} value={shopForm.unit_number || ''} onChange={(e) => setShopForm({ ...shopForm, unit_number: e.target.value })} style={{ width: '100%' }} />
            </label>
          </div>
          <div className="row">
            <label className="field">
                {t('Postcode')}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    value={shopForm.postcode}
                    onChange={(e) => setShopForm({ ...shopForm, postcode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    onBlur={(e) => { if (/^\d{6}$/.test(e.target.value)) lookupPostcode(e.target.value); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupPostcode(shopForm.postcode); } }}
                    inputMode="numeric"
                    placeholder={t('6-digit postcode')}
                    style={{ paddingLeft: 36, width: '100%' }}
                  />
                  {renderClearX('postcode')}
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: 'auto', padding: '6px 12px', flexShrink: 0 }}
                  onClick={() => lookupPostcode(shopForm.postcode)}
                  disabled={postcodeLookup.loading}
                >
                  {postcodeLookup.loading ? '…' : t('Search')}
                </button>
              </div>
              {postcodeLookup.error && (
                <div className="muted" style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{postcodeLookup.error}</div>
              )}
            </label>
            <label className="field">
              {t('Town')}
              <div style={{ position: 'relative' }}>
                <input
                  list="sg-towns-create"
                  value={shopForm.town}
                  onChange={e => setShopForm({ ...shopForm, town: e.target.value })}
                  placeholder={t('Select or type town')}
                  style={{ paddingLeft: 36, width: '100%' }}
                />
                {renderClearX('town')}
              </div>
              <datalist id="sg-towns-create">
                {filteredTowns.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="row">
              {districtOptions.length > 0 ? (
              <label className="field">
                {t('District')}
                <div style={{ position: 'relative' }}>
                  <input
                    list="vendor-district-list"
                    value={shopForm.district}
                    onChange={(e) => setShopForm({ ...shopForm, district: e.target.value })}
                    placeholder={t('Select or type district')}
                    style={{ paddingLeft: 36, width: '100%' }}
                  />
                  {renderClearX('district')}
                </div>
                <datalist id="vendor-district-list">
                  {filteredDistricts.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </label>
              ) : (
              renderClearableField('district', t('District'))
            )}
            <label className="field">
              {t('MRT Stations')}
              <div style={{ position: 'relative' }}>
                <input
                  list="sg-mrt-stations-create"
                  value={shopForm.mrt}
                  onChange={e => setShopForm({ ...shopForm, mrt: e.target.value })}
                  placeholder={t('Type station name')}
                  style={{ paddingLeft: 36, width: '100%' }}
                />
                {renderClearX('mrt')}
              </div>
              <datalist id="sg-mrt-stations-create">
                {filteredMrtStations.map((station) => (
                  <option key={station} value={station} />
                ))}
              </datalist>
            </label>
          </div>

          <label className="field" style={{ marginBottom: 8 }}>
            {t('Opening Time')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, color: 'var(--text)', width: '100%', whiteSpace: 'nowrap', textAlign: 'left' }}>
                <input
                  type="radio"
                  name="apply-all-days-create"
                  checked={!applyAllDays}
                  onChange={() => toggleApplyAllDays(false)}
                  style={{ width: 'auto', padding: 0, margin: 0, flex: '0 0 auto' }}
                />
                <span style={{ whiteSpace: 'nowrap' }}>{t('Set each day')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, color: 'var(--text)', width: '100%', whiteSpace: 'nowrap', textAlign: 'left' }}>
                <input
                  type="radio"
                  name="apply-all-days-create"
                  checked={applyAllDays}
                  onChange={() => toggleApplyAllDays(true)}
                  style={{ width: 'auto', padding: 0, margin: 0, flex: '0 0 auto' }}
                />
                <span style={{ whiteSpace: 'nowrap' }}>{t('Apply to all days')}</span>
              </label>
            </div>
          </label>

          {applyAllDays ? (
            <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
              <label className="field" style={{ flex: 1, minWidth: 200 }}>
                {t('All days open')}
                <input
                  type="time"
                  style={{ minWidth: 220 }}
                  value={shopHours.Mon?.open || ''}
                  onChange={(e) => setAllDaysHours('open', e.target.value)}
                  onFocus={(e) => { if (!e.target.value) setAllDaysHours('open', '09:00'); }}
                />
              </label>
              <label className="field" style={{ flex: 1, minWidth: 200 }}>
                {t('All days close')}
                <input
                  type="time"
                  style={{ minWidth: 220 }}
                  value={shopHours.Mon?.close || ''}
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
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t(day)}</div>
                  <input
                    type="time"
                    value={shopHours[day]?.open || ''}
                    onChange={(e) => setDayHours(day, 'open', e.target.value)}
                    onFocus={(e) => { if (!e.target.value) setDayHours(day, 'open', '09:00'); }}
                  />
                  <input
                    type="time"
                    value={shopHours[day]?.close || ''}
                    onChange={(e) => setDayHours(day, 'close', e.target.value)}
                    onFocus={(e) => { if (!e.target.value) setDayHours(day, 'close', '18:00'); }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Associated Staffs inserted here as the last field */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>{t('Associated Staffs')}</strong>
            <button
              type="button"
              className="btn secondary"
              style={{ width: 'auto', padding: '5px 12px' }}
              onClick={addStaff}
            >
              + {t('Add Staff')}
            </button>
          </div>
          {vendorForm.staffs.length === 0 && (
            <div className="muted" style={{ fontSize: 13 }}>{t('No associated staffs.')}</div>
          )}
          {vendorForm.staffs.map((s, idx) => (
            <div key={`staff-${idx}`} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}>
              <div className="label" style={{ marginBottom: 4, fontWeight: 700 }}>{t('Staff {{n}} Name', { n: idx + 1 })}</div>
              <input
                value={s.name || ''}
                onChange={(e) => updateStaff(idx, { name: e.target.value })}
                placeholder={t('Staff name')}
                style={{ marginBottom: 8 }}
              />
              <div className="label" style={{ marginBottom: 4, fontWeight: 700 }}>{t('Staff {{n}} Mobile', { n: idx + 1 })}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={s.mobile_cc}
                  onChange={(e) => updateStaff(idx, { mobile_cc: e.target.value, mobile_local: s.mobile_local.slice(0, mobileMaxLen(e.target.value)) })}
                  style={{ width: 'auto', flexShrink: 0 }}
                >
                  {COUNTRY_CODES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
                <input
                  value={s.mobile_local}
                  onChange={(e) => updateStaff(idx, { mobile_local: e.target.value.replace(/\D/g, '').slice(0, mobileMaxLen(s.mobile_cc)) })}
                  placeholder={mobilePlaceholder(s.mobile_cc)}
                  inputMode="tel"
                  maxLength={mobileMaxLen(s.mobile_cc)}
                  style={{ borderColor: s.mobile_local && validateLocalMobile(s.mobile_cc, s.mobile_local) ? 'var(--danger)' : undefined }}
                />
              </div>
              {s.mobile_local && validateLocalMobile(s.mobile_cc, s.mobile_local) && (
                <span style={{ color: 'var(--danger)', fontSize: 12 }}>
                  {validateLocalMobile(s.mobile_cc, s.mobile_local)}
                </span>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!s.is_admin}
                    onChange={(e) => updateStaff(idx, { is_admin: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  {t('Vendor Admin')}
                </label>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: 'auto', padding: '4px 10px', color: '#dc2626' }}
                  onClick={() => removeStaff(idx)}
                >
                  {t('Remove')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {vendorErr && <div className="error" style={{ marginBottom: 8 }}>{t(vendorErr)}</div>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            className="btn secondary"
            style={{ width: 'auto', padding: '12px 28px', fontSize: 16 }}
            onClick={handleCancel}
            disabled={creatingVendor || (selfMode && !isDirty)}
          >
            {t('Form.Reset')}
          </button>
          <button
            className="btn secondary"
            style={{ width: 'auto', padding: '12px 28px', fontSize: 16 }}
            onClick={handleExitEdit}
            disabled={!isEdit || selfMode || creatingVendor}
          >
            {t('Form.Cancel')}
          </button>
          <button
            className="btn"
            style={{ width: 'auto', padding: '12px 28px', fontSize: 16 }}
            onClick={createVendor}
            disabled={creatingVendor || loadingEdit || !isDirty}
          >
            {creatingVendor ? (isEdit ? t('Saving…') : t('Adding vendor…')) : (isEdit ? t('Save Changes') : t('Add Vendor'))}
          </button>
        </div>
      </div>
    </div>
  );
}
