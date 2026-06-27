import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { gisRenderButton } from '../utils/googleAuth';

export default function Login({ clientId, onSuccess, onError, loading }) {
  const btnRef = useRef(null);

  useEffect(() => {
    if (!clientId || !btnRef.current) return;
    let cancelled = false;
    gisRenderButton(clientId, btnRef.current)
      .then((user) => { if (!cancelled) onSuccess(user); })
      .catch((e) => { if (!cancelled) onError?.(e); });
    return () => { cancelled = true; };
  // clientId가 바뀔 때마다 버튼 다시 렌더
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 mb-4">
            <img
              src="/icon-192.png"
              alt="유치부"
              className="w-full h-full rounded-2xl object-cover"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">유치부 예산관리</h1>
          <p className="text-gray-500 mt-2 text-sm text-center">Google 계정으로 로그인하세요</p>
        </div>

        {!clientId ? (
          <div className="text-center text-sm text-amber-700 bg-amber-50 rounded-lg p-4">
            ⚠️ Google OAuth Client ID가 설정되지 않았습니다.<br />
            설정(⚙️)에서 Client ID를 먼저 입력해주세요.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="animate-spin h-6 w-6 text-gray-400" />
          </div>
        ) : (
          /* GIS가 여기에 Google 버튼을 렌더링함 */
          <div ref={btnRef} className="flex justify-center min-h-[44px]" />
        )}

        <p className="mt-6 text-xs text-gray-400 text-center">
          인가된 Google 계정만 접속 가능합니다
        </p>
      </div>
    </div>
  );
}
