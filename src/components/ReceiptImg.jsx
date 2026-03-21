import React, { useState, useEffect } from 'react';
import { resolveReceiptUrl } from '../utils/receiptStorage';

const ReceiptImg = ({ src, alt, className, onError, ...props }) => {
  const [resolved, setResolved] = useState(src?.startsWith('local:') ? '' : src);

  useEffect(() => {
    if (!src) { setResolved(''); return; }
    if (!src.startsWith('local:')) { setResolved(src); return; }
    resolveReceiptUrl(src).then(setResolved);
  }, [src]);

  if (!resolved) return <div className={className} style={{ background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#9ca3af', fontSize: 12 }}>로딩중...</span></div>;

  return <img src={resolved} alt={alt} className={className} onError={onError} {...props} />;
};

export default ReceiptImg;
