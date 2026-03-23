import { useState, useEffect } from 'react';
import { GS_META, DEFAULT_SCRIPT_URL, DEFAULT_SCRIPT_TOKEN } from '../constants';

export function useGScriptConfig() {
  const [cfg, setCfg] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(GS_META) || "null");
      // 사용자가 직접 커스텀 URL을 설정하지 않은 경우 항상 최신 기본값 사용
      if (saved && saved.url && saved.url !== DEFAULT_SCRIPT_URL && saved._userCustomized) return saved;
      return { url: DEFAULT_SCRIPT_URL, token: DEFAULT_SCRIPT_TOKEN };
    } catch {
      return { url: DEFAULT_SCRIPT_URL, token: DEFAULT_SCRIPT_TOKEN };
    }
  });
  // Update local storage whenever cfg changes, but mostly it will just re-save the defaults if they were missing
  useEffect(() => { localStorage.setItem(GS_META, JSON.stringify(cfg)); }, [cfg]);
  return [cfg, setCfg];
}
