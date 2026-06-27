const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGIS() {
  if (window.google?.accounts) return Promise.resolve(window.google.accounts);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.onload = () => resolve(window.google.accounts);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * GIS One Tap / Popup으로 로그인.
 * @param {string} clientId - Google Cloud Console OAuth 2.0 Client ID
 * @returns {Promise<{email, name, picture, sub}>}
 */
export async function gisSignIn(clientId) {
  const accounts = await loadGIS();
  return new Promise((resolve, reject) => {
    accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response.credential) {
          reject(new Error("credential 없음"));
          return;
        }
        const payload = parseJwt(response.credential);
        resolve({ email: payload.email, name: payload.name, picture: payload.picture, sub: payload.sub });
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap 차단된 경우 팝업 fallback
        accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          callback: () => {},
        });
        // renderButton 방식으로 fallback — prompt() 실패 시 버튼 클릭으로 유도
        reject(new Error("one_tap_skipped"));
      }
    });
  });
}

/**
 * 버튼 렌더링 방식 GIS 로그인 (가장 안정적).
 * @param {string} clientId
 * @param {HTMLElement} btnEl - 버튼을 렌더링할 div
 * @returns {Promise<{email, name, picture, sub}>}
 */
export async function gisRenderButton(clientId, btnEl) {
  const accounts = await loadGIS();
  return new Promise((resolve, reject) => {
    accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response.credential) { reject(new Error("credential 없음")); return; }
        const payload = parseJwt(response.credential);
        resolve({ email: payload.email, name: payload.name, picture: payload.picture, sub: payload.sub });
      },
      auto_select: false,
    });
    accounts.id.renderButton(btnEl, {
      type: "standard",
      shape: "rectangular",
      theme: "outline",
      text: "signin_with",
      size: "large",
      locale: "ko",
      width: btnEl.offsetWidth || 320,
    });
  });
}

export async function gisSignOut() {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
}

function parseJwt(token) {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64));
}
