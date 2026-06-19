import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRImage({ value, size = 240 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!value) { setSrc(''); return; }
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(''); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!src) return null;
  return (
    <img
      src={src}
      alt="QR code"
      width={size}
      height={size}
      style={{ display: 'block', margin: '0 auto', borderRadius: 8 }}
    />
  );
}
