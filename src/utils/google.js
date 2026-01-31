export async function gsFetch(cfg, action, payload) {
  if (!cfg?.url) throw new Error("Apps Script URL이 비어 있습니다.");
  const token = cfg.token || "";

  // 1) 목록은 GET (프리플라이트 회피)
  if (action === "list") {
    const u = new URL(cfg.url);
    u.searchParams.set("action", "list");
    u.searchParams.set("token", token);
    const resp = await fetch(u.toString(), { method: "GET" });
    if (!resp.ok) throw new Error(`Apps Script 응답 오류: ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  // 2) 저장/업로드는 POST + text/plain (단순요청)
  const body = JSON.stringify({ action, token, ...payload });
  const resp = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" }, // ★ 중요: application/json 금지
    body,
  });
  if (!resp.ok) throw new Error(`Apps Script 응답 오류: ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Google Sheets에서 직접 CSV 형식으로 데이터를 읽어옵니다.
 * @param {string} sheetId - 스프레드시트 ID
 * @param {string} gid - 시트 GID
 * @returns {Promise<Array<Array<string>>>} - 2차원 배열 (행, 열)
 */
export async function fetchSheetData(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  console.log('Fetching sheet data from:', url);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Google Sheets 데이터 읽기 실패: ${resp.status}`);

  const text = await resp.text();
  console.log('Raw CSV data:', text.substring(0, 200)); // 처음 200자만 로그

  const rows = text.trim().split('\n').map(row => {
    // CSV는 쉼표로 구분됨 (탭이 아님)
    // 따옴표로 감싸진 값 처리를 위한 간단한 파싱
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());

    return cells;
  });

  console.log('Parsed rows:', rows.slice(0, 5)); // 처음 5행만 로그
  return rows;
}
