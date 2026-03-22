export async function loadFirebaseCompat() {
  if (window.firebase) return window.firebase;
  const appSrc = "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js";
  const authSrc = "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js";
  const fsSrc = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js";
  const storageSrc = "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js";
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = appSrc; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  await Promise.all([
    new Promise((res, rej) => { const s = document.createElement("script"); s.src = authSrc; s.onload = res; s.onerror = rej; document.head.appendChild(s); }),
    new Promise((res, rej) => { const s = document.createElement("script"); s.src = fsSrc;   s.onload = res; s.onerror = rej; document.head.appendChild(s); }),
    new Promise((res, rej) => { const s = document.createElement("script"); s.src = storageSrc; s.onload = res; s.onerror = rej; document.head.appendChild(s); }),
  ]);
  return window.firebase;
}

/**
 * Firebase Storage에 이미지를 업로드하고 공개 다운로드 URL을 반환합니다.
 * @param {object} cloudInfo - { apiKey, authDomain, projectId, appId, storageBucket? }
 * @param {string} dataUrl - base64 data URL (image/jpeg)
 * @param {string} filename - 파일명
 * @returns {Promise<string>} - 공개 다운로드 URL
 */
export async function uploadToFirebaseStorage(cloudInfo, dataUrl, filename) {
  const firebase = await loadFirebaseCompat();
  const storageBucket = cloudInfo.storageBucket || `${cloudInfo.projectId}.appspot.com`;
  const app = firebase.apps?.length ? firebase.app() : firebase.initializeApp({
    apiKey: cloudInfo.apiKey,
    authDomain: cloudInfo.authDomain,
    projectId: cloudInfo.projectId,
    appId: cloudInfo.appId,
    storageBucket,
  });
  // 이미 앱이 있는데 storageBucket이 누락된 경우 처리
  if (!app.options.storageBucket) {
    throw new Error("storageBucket이 설정되지 않았습니다. Firebase 설정을 확인해주세요.");
  }
  const storage = firebase.storage(app);
  const ref = storage.ref(`receipts/${filename}`);
  // data URL → Blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  await ref.put(blob, { contentType: "image/jpeg" });
  const downloadUrl = await ref.getDownloadURL();
  return downloadUrl;
}
