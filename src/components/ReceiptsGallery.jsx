import React, { useEffect, useState } from 'react';
import { formatKRW, parseAmount } from '../utils/format';
import Card from './Card';
import { useSerialNumbers } from '../hooks/useSerialNumbers';
import { resolveReceiptUrl } from '../utils/receiptStorage';
import ReceiptImg from './ReceiptImg';

const parseReceiptUrls = (receiptUrl) =>
  receiptUrl ? receiptUrl.split('|').filter(Boolean) : [];

const Lightbox = ({ url, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <button
        style={{ position: 'absolute', top: 16, right: 20, color: '#fff', fontSize: 36, fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
        onClick={onClose}
        aria-label="닫기"
      >×</button>
      <img
        src={url}
        alt="영수증 원본"
        style={{ maxWidth: '100%', maxHeight: '100vh', objectFit: 'contain', borderRadius: 8 }}
        referrerPolicy="no-referrer"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

const ReceiptsGallery = ({ expenses, onJumpToExpense, highlightId }) => {
  const withReceipts = expenses.filter((e) => e.receiptUrl);
  const serialMap = useSerialNumbers();
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const totalCount = expenses.length;
  const receiptCount = withReceipts.length;

  useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`receipt-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-indigo-400', 'animate-pulse');
        setTimeout(() => el.classList.remove('animate-pulse'), 1000);
        setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-400'), 3000);
      }
    }
  }, [highlightId]);

  // 모든 URL 타입(local:, data:, blob:, Google Drive)을 라이트박스로 표시
  const openReceipt = async (url) => {
    const resolved = await resolveReceiptUrl(url);
    if (!resolved) return;
    setLightboxUrl(resolved);
  };

  const ReceiptCard = ({ e }) => {
    const serialNum = serialMap[e.id];

    return (
      <div key={e.id} id={`receipt-${e.id}`} className="border rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow transition-all duration-500">
        {(() => {
          const urls = parseReceiptUrls(e.receiptUrl);
          if (urls.length === 1) {
            const url = urls[0];
            const driveId = url.includes("drive.google.com") && url.includes("id=") ? new URL(url).searchParams.get("id") : null;
            const thumb = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w800` : url;
            const lightboxUrl = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1920` : url;
            return (
              <div className="aspect-video bg-gray-100 overflow-hidden relative group cursor-pointer" onClick={() => openReceipt(lightboxUrl)}>
                <ReceiptImg src={thumb} alt={e.description || "receipt"} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" onError={(ev) => { if (!ev.target.src?.includes("export=view")) ev.target.src = url; }} />
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-black/50 text-white px-2 py-1 rounded text-sm">원본 보기</span>
                </div>
              </div>
            );
          }
          return (
            <div className="grid grid-cols-3 gap-0.5 bg-gray-200">
              {urls.map((url, idx) => {
                const driveId = url.includes("drive.google.com") && url.includes("id=") ? new URL(url).searchParams.get("id") : null;
                const thumb = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w400` : url;
                const lightboxUrl = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1920` : url;
                return (
                  <div key={idx} className="aspect-square bg-gray-100 overflow-hidden relative group cursor-pointer" onClick={() => openReceipt(lightboxUrl)}>
                    <ReceiptImg src={thumb} alt={`${e.description || "receipt"} ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-black/50 text-white px-1.5 py-0.5 rounded text-xs">{idx + 1}/{urls.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div
          className="p-3 text-base cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={() => { if (onJumpToExpense) onJumpToExpense(e.id); }}
          title="해당 내역으로 이동"
        >
          <div className="font-medium flex items-center justify-between">
            <span>
              {serialNum ? <span className="text-gray-500 mr-2 font-mono text-sm">#{serialNum}</span> : null}
              <span className="text-gray-800">{e.description || "영수증"}</span>
            </span>
          </div>
          <div className="text-gray-600 mt-1 text-sm">{e.date} · {e.category}</div>
          <div className="mt-1 font-bold text-gray-900">
            {formatKRW(parseAmount(e.amount))}
            <span className="font-normal text-gray-500 text-sm">({e.purchaser || "미지정"})</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      <div className="space-y-8">
        <Card title={
          <div className="flex items-center gap-2">
            <span>{`영수증 갤러리 (${receiptCount}건 / 전체 지출 ${totalCount}건)`}</span>
            <a
              href="https://drive.google.com/drive/folders/1q8JWztUpkulaJQWGBXYhaOQ9sWMNh9b7"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 font-normal"
            >
              📂 드라이브
            </a>
          </div>
        }>
          {withReceipts.length === 0 ? (
            <p className="text-base text-gray-500">등록된 영수증이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {withReceipts.map((e) => (
                <ReceiptCard key={e.id} e={e} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

export default ReceiptsGallery;
