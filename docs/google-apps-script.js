// ============================================================
// 校園維修通報系統 - Google Apps Script 後端
// 
// 使用方式：
// 1. 開啟 Google Sheets，建立新的試算表
// 2. 點選「擴充功能」→「Apps Script」
// 3. 將此檔案內容貼入 Apps Script 編輯器
// 4. 修改下方 CONFIG 設定
// 5. 執行 initializeSheet() 函式初始化試算表
// 6. 部署為網頁應用程式（部署 → 新增部署作業）
//    - 執行身分：自己
//    - 存取權限：所有人
// ============================================================

// ===== 設定區域（請依實際情況修改） =====
const CONFIG = {
  SHEET_NAME: '報修紀錄',
  DASHBOARD_PASSWORD: 'admin1234',
  LINE_CHANNEL_ACCESS_TOKEN: '',  // 填入你的 LINE Channel Access Token
  LINE_USER_ID: '',               // 填入你的 LINE User ID 或 Group ID
};

// ===== 初始化函式（首次使用時執行一次） =====
function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  // 清除並寫入表頭
  sheet.getRange(1, 1, 1, 13).setValues([[
    'id', 'reportTime', 'department', 'teacher', 'location',
    'classroom', 'description', 'category', 'status',
    'maintenanceDate', 'isClosed', 'assignedPerson', 'createdAt'
  ]]);

  // 格式化表頭
  const headerRange = sheet.getRange(1, 1, 1, 13);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4f46e5');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');

  // 設定欄寬
  const widths = [50, 160, 120, 100, 120, 120, 260, 150, 150, 120, 80, 100, 160];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // 凍結表頭
  sheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert('試算表初始化完成！');
}

// ===== HTTP 請求處理 =====

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'getReports') {
    return jsonResponse(getAllReports());
  }

  return jsonResponse({ error: 'Unknown action', availableActions: ['getReports'] });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'addReport') {
      const result = addReport(body.data);
      return jsonResponse(result);
    }

    if (action === 'updateReport') {
      const result = updateReport(body.id, body.data);
      return jsonResponse(result);
    }

    if (action === 'auth') {
      const success = body.password === CONFIG.DASHBOARD_PASSWORD;
      return jsonResponse({ success });
    }

    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ===== 回應工具 =====

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== 資料操作 =====

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(CONFIG.SHEET_NAME);
}

function getAllReports() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  const headers = data[0];
  const reports = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((header, j) => {
      let value = data[i][j];
      // 確保 id 和 isClosed 為數字型別
      if (header === 'id' || header === 'isClosed') {
        value = Number(value) || 0;
      }
      row[header] = value;
    });
    reports.push(row);
  }

  // 依照 id 降序排列（最新的在前）
  reports.sort((a, b) => b.id - a.id);
  return reports;
}

function getNextId(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 1;

  let maxId = 0;
  for (let i = 1; i < data.length; i++) {
    const id = Number(data[i][0]);
    if (id > maxId) maxId = id;
  }
  return maxId + 1;
}

function addReport(reportData) {
  const sheet = getSheet();
  const newId = getNextId(sheet);
  const now = new Date().toISOString();

  sheet.appendRow([
    newId,
    reportData.reportTime || now,
    reportData.department || '',
    reportData.teacher || '',
    reportData.location || '',
    reportData.classroom || '',
    reportData.description || '',
    reportData.category || '',
    '未處理',
    '',
    0,
    '',
    now
  ]);

  // 發送 LINE 通知
  sendLineNotification(reportData);

  return { id: newId, success: true };
}

function updateReport(id, data) {
  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][0]) === String(id)) {
      const rowIndex = i + 1; // Sheets 是 1-based

      if (data.status !== undefined) {
        const col = headers.indexOf('status') + 1;
        if (col > 0) sheet.getRange(rowIndex, col).setValue(data.status);
      }
      if (data.maintenanceDate !== undefined) {
        const col = headers.indexOf('maintenanceDate') + 1;
        if (col > 0) sheet.getRange(rowIndex, col).setValue(data.maintenanceDate);
      }
      if (data.isClosed !== undefined) {
        const col = headers.indexOf('isClosed') + 1;
        if (col > 0) sheet.getRange(rowIndex, col).setValue(data.isClosed ? 1 : 0);
      }
      if (data.assignedPerson !== undefined) {
        const col = headers.indexOf('assignedPerson') + 1;
        if (col > 0) sheet.getRange(rowIndex, col).setValue(data.assignedPerson);
      }

      return { success: true };
    }
  }

  return { error: '找不到指定的報修紀錄' };
}

// ===== LINE 通知 =====

function sendLineNotification(reportData) {
  const token = CONFIG.LINE_CHANNEL_ACCESS_TOKEN;
  const targetId = CONFIG.LINE_USER_ID;

  if (!token || !targetId) {
    Logger.log('LINE 設定未填寫，跳過通知。');
    return;
  }

  const message =
    '【新報修通知】\n' +
    '單位/班級: ' + reportData.department + ' (' + reportData.teacher + ')\n' +
    '地點: ' + reportData.location + ' - ' + reportData.classroom + '\n' +
    '報修項目: ' + reportData.category + '\n' +
    '問題說明: ' + reportData.description + '\n' +
    '填報時間: ' + reportData.reportTime;

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    payload: JSON.stringify({
      to: targetId,
      messages: [{ type: 'text', text: message }],
    }),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    Logger.log('LINE 通知傳送結果: ' + response.getContentText());
  } catch (err) {
    Logger.log('LINE 通知傳送失敗: ' + err.message);
  }
}
