// Basic EMV QR builder for PayNow-like payloads
// Produces EMV tag-length-value string and CRC16-CCITT checksum (as tag 63)

function encodeTLV(map) {
  // map: { tag: value } where value is string or nested map
  const parts = [];
  for (const tag of Object.keys(map)) {
    const val = map[tag];
    let body = '';
    if (val && typeof val === 'object') {
      body = encodeTLV(val);
    } else {
      body = String(val || '');
    }
    const len = String(body.length).padStart(2, '0');
    parts.push(`${tag}${len}${body}`);
  }
  return parts.join('');
}

// CRC16-CCITT (0x1021) implementation (initial 0xFFFF)
function crc16ccitt(buf) {
  let crc = 0xFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      else crc = (crc << 1) & 0xFFFF;
    }
  }
  return crc & 0xFFFF;
}

function toHex4(n) {
  return n.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Build a basic EMV payload for PayNow-style payments.
 * Options:
 *  - uen: merchant UEN or recipient identifier
 *  - amount: a number or string like '123.45'
 *  - ref: reference text
 *  - merchantName, city
 *  - gui: optional GUI for merchant account info (defaults to a PayNow-compatible GUID)
 */
function buildPayNowEMV({ uen, amount, ref, merchantName = '', city = '', gui = 'A000000677010112' }) {
  // Use dynamic QR (01=static, 12=dynamic)
  const payload = {
    '00': '01',
    '01': '12',
    // Merchant Account Information (26) with GUI and the UEN in subfield 01
    '26': {
      '00': gui,
      '01': uen || ''
    },
    '52': '0000', // merchant category code (0000 unspecified)
    '53': '702',  // currency (702 = SGD)
    '54': typeof amount === 'number' ? amount.toFixed(2) : String(amount || ''),
    '58': 'SG',
    '59': merchantName || '',
    '60': city || '',
    // Additional data field template (62) - subfield 05 commonly used for reference
    '62': {
      '05': ref || ''
    }
  };

  // Build TLV without CRC
  const tlv = encodeTLV(payload);
  // Append CRC field tag 63 with placeholder length 04 per EMV spec
  const toCrc = tlv + '63' + '04';
  const crc = crc16ccitt(toCrc);
  const crcHex = toHex4(crc);
  return toCrc + crcHex;
}

module.exports = { buildPayNowEMV };
