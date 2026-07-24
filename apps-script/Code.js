/**
 * 유치부 예산관리 - Google Apps Script (Web App)
 * [DriveApp 네이티브 안정화 버전 - 2026-03-22]
 */

/**
 * ★ 최초 1회 실행 필요 ★
 * 에디터에서 직접 실행 → DriveApp 권한 승인 → 새 버전으로 배포
 */
function requestDriveAuth() {
  const folder = DriveApp.getFolderById(RECEIPT_FOLDER_ID);
  Logger.log('✅ Drive 인증 완료: ' + folder.getName());
}

/***** 설정값 *****/
const SHEET_ID = '1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA';
const RECEIPT_FOLDER_ID = '1q8JWztUpkulaJQWGBXYhaOQ9sWMNh9b7';
const MEMBER_PHOTO_FOLDER_ID = '1gmhV08lX3V2I0PgO2fNKCiWc3x8nasQn';
const TOKEN = 'thank1234!!';
const ATTENDANCE_GID = '348133938';
const MEMBERS_GID = '1598655081';
const BUDGET_GUIDE_GID = '1805455987';
const FELLOWSHIP_GID = '1416333507';
const FELLOWSHIP_FOLDER_ID = '1ZkYWUsDxJGn-JK1sxyN7OZqipGdGNBl4';

const MEMBER_HEADERS = ["ID","연번","구분","이름","나이","직책","반","담임선생님","생년월일","등록일","전출일","기도제목","사진URL","사진ID","담당학생","비고"];

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function getSheet(index) {
  return SpreadsheetApp.openById(SHEET_ID).getSheets()[index || 0] || null;
}
function getSheetByGid(gid) {
  var sheets = SpreadsheetApp.openById(SHEET_ID).getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getSheetId()) === String(gid)) return sheets[i];
  }
  return null;
}

/***** GET *****/
function doGet(e) {
  try {
    if (e.parameter && e.parameter.action === 'list') {
      if (e.parameter.token !== TOKEN) return json({ error: 'unauthorized' });
      return listHandler_();
    }
    return json({ ok: true, message: "Nursery Budget GAS is running." });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  }
}

/***** POST *****/
function doPost(e) {
  try {
    var raw = e.postData && e.postData.contents ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    if (body.token !== TOKEN) return json({ error: 'unauthorized' });

    switch (body.action) {
      case 'list':                  return listHandler_();
      case 'save':                  return saveHandler_(body);
      case 'uploadReceipt':         return uploadReceiptHandler_(body);
      case 'deleteReceipt':         return deleteReceiptHandler_(body);
      case 'getBudget':             return getBudgetHandler_();
      case 'getPurchasers':         return getPurchasers(body);
      case 'verifyAppPassword':     return verifyAppPassword(body);
      case 'verifyGoogleUser':      return verifyGoogleUser(body);  // ← 이 줄 추가
      case 'getMembers':            return getMembersHandler_();
      case 'saveMembers':           return saveMembersHandler_(body);
      case 'uploadMemberPhoto':     return uploadMemberPhotoHandler_(body);
      case 'getAttendance':         return getAttendanceHandler_(body);
      case 'saveAttendance':        return saveAttendanceHandler_(body);
      case 'getAttendanceInit':     return getAttendanceInitHandler_();
      case 'getBudgetGuide':        return getBudgetGuideHandler_();
      case 'getFellowship':         return getFellowshipHandler_();
      case 'saveFellowship':        return saveFellowshipHandler_(body);
      case 'uploadFellowshipReceipt': return uploadFellowshipReceiptHandler_(body);
      case 'initializeDutySheets':  return initializeDutySheetsHandler_();
      case 'getMemoryVerses':       return getMemoryVersesHandler_();
      case 'getPrayerOrder':        return getPrayerOrderHandler_();
      case 'getOfferingOrder':      return getOfferingOrderHandler_();
      case 'getCleaningOrder':      return getCleaningOrderHandler_();
      default:
        return json({ error: '지원하지 않는 명령: ' + (body.action || 'undefined') });
    }
  } catch (err) {
    return json({ error: 'doPost error: ' + String(err && err.message ? err.message : err) });
  }
}

/***** 비밀번호 *****/
function verifyAppPassword(payload) {
  var inputPassword = payload.password;
  if (!inputPassword) return json({ valid: false, error: "Password missing" });
  try {
    var targetSheet = getSheet(5);
    if (!targetSheet) return json({ valid: false, error: "Sheet 6 not found" });
    var passwordA1 = targetSheet.getRange("A1").getValue().toString().trim();
    var passwordB1 = targetSheet.getRange("B1").getValue().toString().trim();
    var normalizedInput = inputPassword.toString().trim();
    if (normalizedInput === passwordA1) return json({ valid: true, role: 'full' });
    if (normalizedInput === passwordB1) return json({ valid: true, role: 'partial' });
    return json({ valid: false });
  } catch (ex) {
    return json({ valid: false, error: ex.toString() });
  }
}

/***** Google 로그인 *****/
function verifyGoogleUser(payload) {
  var ALLOWED = ['hyok96@gmail.com'];
  var email = (payload.email || '').toLowerCase().trim();
  if (ALLOWED.indexOf(email) === -1) return json({ valid: false });
  return json({ valid: true, role: 'full' });
}


/***** 지출 목록 *****/
function listHandler_() {
  var sh = getSheet(0);
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return json({ expenses: [] });
  var lastCol = sh.getLastColumn();
  var dataRange = sh.getRange(2, 1, lastRow - 1, lastCol);
  var values = dataRange.getValues();
  var expenses = values.map(function(row) {
    // H열(index 7)에 첫 URL, 12번 이후 컬럼에 추가 URL
    var urls = [];
    if (row[7]) urls.push(String(row[7]));
    for (var c = 12; c < row.length; c++) {
      if (row[c] && String(row[c]).trim()) urls.push(String(row[c]).trim());
    }
    return {
      id: row[0],
      date: formatDate_(row[2]),
      category: row[3],
      description: row[4],
      amount: Number(row[5] || 0),
      purchaser: row[6],
      receiptUrl: urls.join('|'),
      reimbursed: String(row[8]).toUpperCase() === 'TRUE',
      reimbursedAt: formatDate_(row[9]),
      webChurchConfirmed: String(row[10]).toUpperCase() === 'TRUE',
      webChurchConfirmedAt: formatDate_(row[11])
    };
  });
  return json({ expenses: expenses.reverse() });
}

/***** 지출 저장 *****/
function saveHandler_(body) {
  var list = Array.isArray(body.expenses) ? body.expenses : [];
  var sh = getSheet(0);
  sh.clear();
  var headers = ["ID","연번","날짜","세세목","적요","금액","구매자","영수증","입금여부","입금일","웹교회입력","웹교회입력일"];

  // 추가 영수증 최대 개수 계산
  var maxExtra = 0;
  var reversedList = list.slice().reverse();
  reversedList.forEach(function(item) {
    var urls = (item.receiptUrl || '').split('|').filter(function(u) {
      return u && !u.startsWith('data:') && !u.startsWith('blob:');
    });
    if (urls.length > 1 && urls.length - 1 > maxExtra) maxExtra = urls.length - 1;
  });

  for (var i = 0; i < maxExtra; i++) {
    headers.push("영수증" + (i + 2));
  }

  var rows = reversedList.map(function(item, index) {
    var d = function(v) { return (typeof v === 'string' && v.length > 10) ? v.substring(0, 10) : v; };
    var receiptUrls = (item.receiptUrl || '').split('|').filter(function(u) {
      return u && !u.startsWith('data:') && !u.startsWith('blob:');
    });

    var row = [
      item.id, index + 1, d(item.date), item.category, item.description,
      item.amount, item.purchaser,
      receiptUrls[0] || "",
      item.reimbursed ? "TRUE" : "FALSE", d(item.reimbursedAt),
      item.webChurchConfirmed ? "TRUE" : "FALSE", d(item.webChurchConfirmedAt)
    ];

    for (var j = 0; j < maxExtra; j++) {
      row.push(receiptUrls[j + 1] || "");
    }
    return row;
  });

  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#EFEFEF");
  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sh.getRange(2, 2, rows.length, 1).setNumberFormat("0");
    sh.getRange(2, 3, rows.length, 1).setNumberFormat("yyyy-MM-dd");
    sh.getRange(2, 6, rows.length, 1).setNumberFormat("#,##0");
    sh.getRange(2, 10, rows.length, 1).setNumberFormat("yyyy-MM-dd");
    sh.getRange(2, 12, rows.length, 1).setNumberFormat("yyyy-MM-dd");
  }
  sh.hideColumns(1);
  var widths = [0, 60, 110, 150, 500, 120, 100, 250, 80, 110, 80, 110];
  widths.forEach(function(w, idx) { if (w > 0) sh.setColumnWidth(idx + 1, w); });
  for (var k = 0; k < maxExtra; k++) {
    sh.setColumnWidth(13 + k, 250);
  }
  if (rows.length > 0) {
    sh.getDataRange().setVerticalAlignment("middle").setHorizontalAlignment("center");
    sh.getRange(2, 8, rows.length, 1).setHorizontalAlignment("left");
    for (var m = 0; m < maxExtra; m++) {
      sh.getRange(2, 13 + m, rows.length, 1).setHorizontalAlignment("left");
    }
  }
  return json({ ok: true, count: list.length });
}

/***** 영수증 업로드 (DriveApp 네이티브) *****/
function uploadReceiptHandler_(body) {
  return uploadToDrive_(body, RECEIPT_FOLDER_ID);
}

function uploadToDrive_(body, folderId) {
  var dataUrl = body && body.dataUrl ? String(body.dataUrl) : '';
  var i = dataUrl.indexOf(',');
  if (i < 0) return json({ error: 'invalid_dataurl' });
  var bytes = Utilities.base64Decode(dataUrl.slice(i + 1));
  var mimeType = body.mimeType || 'image/jpeg';
  var filename = body.filename || ('receipt_' + Date.now() + '.jpg');
  var token = ScriptApp.getOAuthToken();
  var boundary = 'receipt_boundary_' + Date.now();
  var metaBytes = Utilities.newBlob(
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify({ name: filename, parents: [folderId] }) + '\r\n'
  ).getBytes();
  var mediaHeader = Utilities.newBlob(
    '--' + boundary + '\r\nContent-Type: ' + mimeType + '\r\n\r\n'
  ).getBytes();
  var closing = Utilities.newBlob('\r\n--' + boundary + '--').getBytes();
  var allBytes = [...metaBytes, ...mediaHeader, ...bytes, ...closing];
  var uploadRes = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      payload: allBytes,
      muteHttpExceptions: true
    }
  );
  var fileData = JSON.parse(uploadRes.getContentText());
  if (!fileData.id) return json({ error: 'Drive REST error: ' + uploadRes.getContentText() });
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + fileData.id + '/permissions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ role: 'reader', type: 'anyone' }),
    muteHttpExceptions: true
  });
  return json({
    ok: true,
    fileId: fileData.id,
    viewUrl: 'https://drive.google.com/uc?export=view&id=' + fileData.id
  });
}


function deleteReceiptHandler_(params) {
  try {
    if (!params.fileId) return json({ error: "No File ID" });
    var token = ScriptApp.getOAuthToken();
    UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + params.fileId,
      {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
      }
    );
    return json({ success: true });
  } catch (e) {
    return json({ error: e.toString() });
  }
}


/***** 예산/구매자 *****/
function getBudgetHandler_() {
  var sheet = getSheet(4);
  var rows = sheet.getDataRange().getValues();
  return json({ budgetRows: rows });
}

function getPurchasers(cfg) {
  var sheet = getSheet(1);
  if (!sheet) return json({ error: "Sheet 2 not found" });
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return json({ purchasers: [] });
  var headers = data[0];
  var colIdx = -1;
  for (var i = 0; i < headers.length; i++) {
    if (["구매자","이름","예금주","성명"].indexOf(headers[i]) >= 0) { colIdx = i; break; }
  }
  if (colIdx === -1) return json({ error: "Purchaser column not found" });
  var seen = {};
  var list = [];
  for (var r = 1; r < data.length; r++) {
    var v = String(data[r][colIdx]).trim();
    if (v && !seen[v]) { seen[v] = true; list.push(v); }
  }
  return json({ purchasers: list });
}

/***** 명단 *****/
function getMembersHandler_() {
  var sh = getSheetByGid(MEMBERS_GID);
  if (!sh) return json({ error: "Member sheet not found" });
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return json({ members: [] });
  var data = sh.getRange(2, 1, lastRow - 1, MEMBER_HEADERS.length).getValues();
  var members = data.map(function(row) {
    return {
      id: row[0], serial: row[1], type: row[2], name: row[3],
      age: row[4], position: row[5], group: row[6], teacher: row[7],
      birthDate: formatDate_(row[8]), regDate: formatDate_(row[9]),
      leaveDate: formatDate_(row[10]), prayer: row[11],
      photoUrl: row[12], photoDriveId: row[13], assignedStudents: row[14], s1: row[15]
    };
  });
  return json({ members: members });
}

function saveMembersHandler_(body) {
  var list = Array.isArray(body.members) ? body.members : [];
  var sh = getSheetByGid(MEMBERS_GID);
  if (!sh) return json({ error: "Members sheet not found" });
  sh.clear();
  sh.getRange(1, 1, 1, MEMBER_HEADERS.length).setValues([MEMBER_HEADERS]).setFontWeight("bold").setBackground("#EFEFEF");
  if (list.length > 0) {
    var rows = list.map(function(m, i) {
      return [m.id||"", i+1, m.type||"", m.name||"", String(m.age||""), m.position||"",
              m.group||"", m.teacher||"", m.birthDate||"", m.regDate||"", m.leaveDate||"",
              m.prayer||"", m.photoUrl||"", m.photoDriveId||"", m.assignedStudents||"", ""];
    });
    sh.getRange(2, 1, rows.length, MEMBER_HEADERS.length).setValues(rows);
  }
  sh.hideColumns(1);
  sh.getDataRange().setVerticalAlignment("middle").setHorizontalAlignment("center");
  return json({ ok: true, count: list.length });
}

function uploadMemberPhotoHandler_(body) {
  return uploadToDrive_(body, MEMBER_PHOTO_FOLDER_ID);
}

/***** 출결 *****/
function getAttendanceHandler_(body) {
  var sh = getSheetByGid(ATTENDANCE_GID);
  if (!sh) return json({ error: "Attendance sheet not found" });
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return json({ attendance: [], headers: [] });
  var data = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];
  var records = [];
  for (var r = 1; r < data.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) { obj[headers[c]] = data[r][c]; }
    records.push(obj);
  }
  return json({ headers: headers, records: records });
}

function saveAttendanceHandler_(body) {
  var headers = body.headers;
  var records = body.records;
  var sh = getSheetByGid(ATTENDANCE_GID);
  if (!sh) return json({ error: "Attendance sheet not found" });
  sh.clear();
  if (!headers || headers.length === 0) return json({ ok: true });
  var rows = records.map(function(r) { return headers.map(function(h) { return r[h] || ""; }); });
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#EFEFEF");
  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sh.getDataRange().setVerticalAlignment("middle").setHorizontalAlignment("center");
  return json({ ok: true });
}

function getAttendanceInitHandler_() {
  var mSh = getSheetByGid(MEMBERS_GID);
  var members = [];
  if (mSh && mSh.getLastRow() > 1) {
    var mData = mSh.getRange(2, 1, mSh.getLastRow() - 1, MEMBER_HEADERS.length).getValues();
    members = mData.map(function(row) {
      return {
        id: row[0], serial: row[1], type: row[2], name: row[3],
        age: row[4], position: row[5], group: row[6], teacher: row[7],
        birthDate: formatDate_(row[8]), regDate: formatDate_(row[9]),
        leaveDate: formatDate_(row[10]), prayer: row[11],
        photoUrl: row[12], photoDriveId: row[13], assignedStudents: row[14]
      };
    });
  }
  var aSh = getSheetByGid(ATTENDANCE_GID);
  var headers = [];
  var records = [];
  if (aSh && aSh.getLastRow() >= 1 && aSh.getLastColumn() >= 1) {
    var aData = aSh.getRange(1, 1, aSh.getLastRow(), aSh.getLastColumn()).getValues();
    headers = aData[0];
    for (var r = 1; r < aData.length; r++) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) { obj[headers[c]] = aData[r][c]; }
      records.push(obj);
    }
  }
  return json({ members: members, attendance: { headers: headers, records: records } });
}

/***** 예산 가이드 *****/
function getBudgetGuideHandler_() {
  var sh = getSheetByGid(BUDGET_GUIDE_GID);
  if (!sh) return json({ error: "Budget guide sheet not found" });
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return json({ guide: {} });
  var data = sh.getRange(2, 1, lastRow - 1, 4).getValues();
  var guide = {};
  data.forEach(function(row) {
    var cat = String(row[0]).trim();
    if (!cat || cat === "합계") return;
    guide[cat] = {
      descriptions: String(row[2]||"").split('\n').map(function(s){return s.trim();}).filter(function(s){return s;}),
      notes: String(row[3]||"").split('\n').map(function(s){return s.trim();}).filter(function(s){return s;})
    };
  });
  return json({ guide: guide });
}

/***** 친목회 *****/
function getFellowshipHandler_() {
  var sh = getSheetByGid(FELLOWSHIP_GID);
  if (!sh) return json({ error: "Fellowship sheet not found" });
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return json({ fellowship: [] });
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colMap = {};
  headers.forEach(function(h, i) { if (h) colMap[String(h).trim()] = i; });
  var data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var fellowship = [];
  data.forEach(function(row) {
    var item = {
      id: colMap["ID"] !== undefined ? String(row[colMap["ID"]]) : "",
      date: colMap["날짜"] !== undefined ? formatDate_(row[colMap["날짜"]]) : "",
      category: colMap["과목"] !== undefined ? row[colMap["과목"]] : "",
      description: colMap["적요"] !== undefined ? row[colMap["적요"]] : "",
      income: Number(row[colMap["수입금액"]] || 0),
      expense: Number(row[colMap["지출금액"]] || 0),
      remarks: colMap["비고"] !== undefined ? row[colMap["비고"]] : "",
      receiptUrl: colMap["증빙"] !== undefined ? row[colMap["증빙"]] : ""
    };
    if (item.id || item.date) fellowship.push(item);
  });
  return json({ fellowship: fellowship });
}

function saveFellowshipHandler_(body) {
  var list = Array.isArray(body.fellowship) ? body.fellowship : [];
  var sh = getSheetByGid(FELLOWSHIP_GID);
  if (!sh) return json({ error: "Fellowship sheet not found" });
  list.sort(function(a, b) { return (a.date||"").localeCompare(b.date||""); });
  sh.clear();
  var headers = ["ID","#","날짜","과목","적요","수입금액","지출금액","잔액","비고","증빙"];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#EFEFEF");
  if (list.length > 0) {
    var bal = 0;
    var rows = list.map(function(item, index) {
      var inc = Number(item.income || 0);
      var exp = Number(item.expense || 0);
      bal += (inc - exp);
      return [item.id||"", index+1, item.date||"", item.category||"", item.description||"", inc, exp, bal, item.remarks||"", item.receiptUrl||""];
    });
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sh.getRange(2, 3, rows.length, 1).setNumberFormat("yyyy-MM-dd");
    sh.getRange(2, 6, rows.length, 3).setNumberFormat("#,##0");
  }
  sh.hideColumns(1);
  sh.getDataRange().setVerticalAlignment("middle").setHorizontalAlignment("center");
  var widths = [0, 40, 100, 110, 250, 90, 90, 100, 150, 200];
  widths.forEach(function(w, i) { if (w > 0) sh.setColumnWidth(i + 1, w); });
  return json({ success: true, count: list.length });
}

function uploadFellowshipReceiptHandler_(body) {
  return uploadToDrive_(body, FELLOWSHIP_FOLDER_ID);
}

/***** 출석 추가 데이터 *****/
function initializeDutySheetsHandler_() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    if (!ss.getSheetByName('암송말씀')) ss.insertSheet('암송말씀');
    return json({ success: true, message: '초기화 완료!' });
  } catch (ex) {
    return json({ error: ex.toString() });
  }
}

function getMemoryVersesHandler_() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('암송말씀');
    if (!sheet) return json({ error: '암송말씀 시트를 찾을 수 없습니다.' });
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return json({ verses: {} });
    var verses = {};
    for (var i = 1; i < data.length; i++) {
      var month = parseInt(String(data[i][0]).replace('월','').trim());
      var list = [data[i][1], data[i][2]].filter(function(v){return v && v.toString().trim();});
      if (month && !isNaN(month)) verses[month] = list;
    }
    return json({ verses: verses });
  } catch (ex) {
    return json({ error: 'getMemoryVerses error: ' + ex.toString() });
  }
}

function getPrayerOrderHandler_() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('기도');
    if (!sheet) return json({ error: '기도 시트를 찾을 수 없습니다.' });
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return json({ schedule: {} });
    var schedule = {};
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) schedule[data[i][0]] = data[i][1].toString().trim();
    }
    return json({ schedule: schedule });
  } catch (ex) {
    return json({ error: 'getPrayerOrder error: ' + ex.toString() });
  }
}

function getOfferingOrderHandler_() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('헌금');
    if (!sheet) return json({ error: '헌금 시트를 찾을 수 없습니다.' });
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return json({ schedule: {} });
    var schedule = {};
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) schedule[data[i][0]] = data[i][1].toString().trim();
    }
    return json({ schedule: schedule });
  } catch (ex) {
    return json({ error: 'getOfferingOrder error: ' + ex.toString() });
  }
}

function getCleaningOrderHandler_() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('청소');
    if (!sheet) return json({ error: '청소 시트를 찾을 수 없습니다.' });
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return json({ schedule: {} });
    var schedule = {};
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        var pair = [];
        if (data[i][1] && data[i][1].toString().trim()) pair.push(data[i][1].toString().trim());
        if (data[i][2] && data[i][2].toString().trim()) pair.push(data[i][2].toString().trim());
        schedule[data[i][0]] = pair;
      }
    }
    return json({ schedule: schedule });
  } catch (ex) {
    return json({ error: 'getCleaningOrder error: ' + ex.toString() });
  }
}

/***** Utils *****/
function formatDate_(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, '0');
    var d = String(val.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return String(val).split('T')[0];
}
