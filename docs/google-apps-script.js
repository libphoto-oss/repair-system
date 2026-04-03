// ============================================================
// 校園維修通報系統 - Google Apps Script 後端（AI 智能升級版）
// 
// 使用方式：
// 1. 開啟 Google Sheets，擴充功能 → Apps Script
// 2. 貼入本程式碼，修改下方 CONFIG。
// 3. 點選「執行」initializeSheet()
// 4. 部署為網頁應用程式（所有人皆可存取），並設定為 LINE Webhook
// ============================================================

const CONFIG = {
  SHEET_NAME: '報修紀錄',
  DASHBOARD_PASSWORD: 'admin3531', // 網頁管理密碼
  LINE_CHANNEL_ACCESS_TOKEN: 'b7/Lqf+zUSEIrXRs4WNhPk2jQTpmA1vS56NMpAwa+couLBHPRx/3kw2jCTuYRPwu8hRjKE85Os301Vh0QnP2I92fM0NrtQiyjcYChcnOadkw5/qoHdIU8Vo0dYcgyYN5HTIFHKNyXnWp2EjJcT0uyAdB04t89/1O/w1cDnyilFU=',   // LINE Bot Token
  LINE_USER_ID: 'U2b52ae8fcbb4d01321a937aa2b5d33b6',                // 管理員的 LINE ID（收到新報修會通知他。只有他能用 LINE 改單）
  GEMINI_API_KEY: 'AIzaSyAKMllDsPGW8SrKb2Yl4xH9I9IlnGEwciE',              // Google AI Studio 申請的免費金鑰
};

// ==========================================
// 初始化與 HTTP 處理
// ==========================================

function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  // 增加第 14 欄：reporterLineId（隱藏欄位）
  sheet.getRange(1, 1, 1, 14).setValues([[
    'id', 'reportTime', 'department', 'teacher', 'location',
    'classroom', 'description', 'category', 'status',
    'maintenanceDate', 'isClosed', 'assignedPerson', 'createdAt', 'reporterLineId'
  ]]);

  const headerRange = sheet.getRange(1, 1, 1, 14);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4f46e5');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');

  sheet.setFrozenRows(1);
  SpreadsheetApp.getUi().alert('試算表初始化完成！');
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'getReports') {
    return jsonResponse(getAllReports());
  }
  return jsonResponse({ error: 'Unknown action' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // ==========================================
    // 1. LINE Webhook 處理 (AI 助理模式)
    // ==========================================
    if (body.events !== undefined) {
      if (Array.isArray(body.events)) {
        body.events.forEach(function (event) {
          if (event.type === 'message' && event.message.type === 'text') {
            const userMessage = event.message.text;
            const replyToken = event.replyToken;
            const userId = event.source.userId;

            // 將使用者的話交給 AI 解析
            const aiResult = callGeminiAPI(userMessage);
            if (!aiResult) {
              replyToLine(replyToken, "系統連線異常，請稍後再試。");
              return;
            }

            // 判斷 AI 解析出的意圖
            if (aiResult.intent === "REPORT") {
              const result = addReport({ ...aiResult.data, _reporterLineId: userId });
              replyToLine(replyToken, `✅ 已為您登記報修！單號為 #${result.id}。\n處理完畢後會透過 LINE 通知您。`);
              // 推播給管理員
              pushToLine(CONFIG.LINE_USER_ID, `🔔【新報修(AI代收)】\n單號: #${result.id}\n單位: ${aiResult.data.department} (${aiResult.data.teacher})\n地點: ${aiResult.data.location} - ${aiResult.data.classroom}\n維修項目: ${aiResult.data.category}\n說明: ${aiResult.data.description}`);

            } else if (aiResult.intent === "CLOSE") {
              // 驗證身分：只有管理員能透過 LINE 直接結案
              if (userId !== CONFIG.LINE_USER_ID) {
                replyToLine(replyToken, "⛔ 抱歉，只有管理員能變更報修狀態。");
                return;
              }
              const reportId = aiResult.id;
              const updateResult = updateReport(reportId, { isClosed: 1, status: '已修復' }, 'LINE_ADMIN');
              if (updateResult.success) {
                replyToLine(replyToken, `✅ 單號 #${reportId} 已結案！`);
              } else {
                replyToLine(replyToken, `❌ 找不到單號 #${reportId}。`);
              }

            } else if (aiResult.intent === "CHAT") {
              // 一般問候與閒聊，直接回傳 AI 生成的對話
              replyToLine(replyToken, aiResult.reply);

            } else {
              replyToLine(replyToken, "抱歉，我聽不太懂您的需求。請嘗試說：\n「我是設備組王老師，報修教學大樓203的投影機，畫面閃爍」\n或「麻煩把單號 25 結案」");
            }
          }
        });
      }
      return jsonResponse({ status: 'ok' });
    }

    // ==========================================
    // 2. 網頁端 API 處理
    // ==========================================
    const action = body.action;
    if (action === 'addReport') {
      const result = addReport(body.data);
      // 網頁填寫推播給管理員
      pushToLine(CONFIG.LINE_USER_ID, `🔔【新報修通知】\n單號: #${result.id}\n單位: ${body.data.department} (${body.data.teacher})\n地點: ${body.data.location} - ${body.data.classroom}\n維修項目: ${body.data.category}\n說明: ${body.data.description}`);
      return jsonResponse(result);
    }
    if (action === 'updateReport') {
      const result = updateReport(body.id, body.data, 'WEB_ADMIN');
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

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// Google Sheets 資料操作
// ==========================================

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
}

function getAllReports() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const reports = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (h === 'id' || h === 'isClosed') ? Number(data[i][j]) || 0 : data[i][j];
    });
    reports.push(row);
  }
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

function addReport(data) {
  const sheet = getSheet();
  const newId = getNextId(sheet);
  const now = new Date().toISOString();

  sheet.appendRow([
    newId,
    data.reportTime || now,
    data.department || '',
    data.teacher || '',
    data.location || '',
    data.classroom || '',
    data.description || '',
    data.category || '其他',
    '未處理',
    '',
    0,
    '',
    now,
    data._reporterLineId || '' // 若從網頁填則為空；從 LINE 填則寫入 userId
  ]);

  return { id: newId, success: true };
}

function updateReport(id, data, source) {
  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][0]) === String(id)) {
      const rowIndex = i + 1;
      let statusUpdated = false;
      let closedUpdated = false;

      if (data.status !== undefined) {
        sheet.getRange(rowIndex, headers.indexOf('status') + 1).setValue(data.status);
        statusUpdated = true;
      }
      if (data.maintenanceDate !== undefined) {
        sheet.getRange(rowIndex, headers.indexOf('maintenanceDate') + 1).setValue(data.maintenanceDate);
      }
      if (data.isClosed !== undefined) {
        let isC = data.isClosed ? 1 : 0;
        sheet.getRange(rowIndex, headers.indexOf('isClosed') + 1).setValue(isC);
        if (isC === 1) closedUpdated = true;
        if (isC === 0 && data.status !== undefined) closedUpdated = false; // 從已結案改處理中
      }
      if (data.assignedPerson !== undefined) {
        sheet.getRange(rowIndex, headers.indexOf('assignedPerson') + 1).setValue(data.assignedPerson);
      }

      // === 主動通知原填報人 ===
      const reporterLineId = String(allData[i][headers.indexOf('reporterLineId')] || '');
      if (reporterLineId && reporterLineId.length > 10) { // 簡單檢查
        if (closedUpdated) {
          pushToLine(reporterLineId, `🔔 您的報修 (單號 #${id}) 已結案！\n地點：${allData[i][headers.indexOf('location')]} ${allData[i][headers.indexOf('classroom')]} \n感謝您的通報。`);
        } else if (statusUpdated && data.status !== "未處理" && data.status !== "已修復") {
          pushToLine(reporterLineId, `📢 您的報修 (單號 #${id}) 進度更新\n目前狀態：${data.status}`);
        }
      }

      return { success: true };
    }
  }
  return { error: '找不到指定的報修紀錄' };
}

// ==========================================
// Google Gemini AI 處理
// ==========================================

function callGeminiAPI(text) {
  if (!CONFIG.GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

  const prompt = `你是一個名叫「比比」的學校報修系統 AI 助理。你的個性親切、樂於助人。請判斷使用者的文字意圖，擷取實體並嚴格回傳只包含 JSON 格式的字串，不要包含 \`\`\`json 標記，也不要有其他廢話。

意圖選項：
1. REPORT (報修)：提供包含 department(單位), teacher(姓名), location(地點), classroom(教室), category(請從 水電設備/資訊設備（電腦/投影機）/桌椅傢具/建築毀損/其他 擇一), description(問題描述)。沒提到的用"未提供"代替。
2. CLOSE (結案)：使用者要求結案某筆單號，擷取 id(單號, 數字型態)。
3. CHAT (聊天)：使用者若只是呼叫你（例如：「比比」）、打招呼或一般對話，請提供一段親切的文字回覆。例如：「我在！有什麼我可以幫忙的嗎？」
4. UNKNOWN (其他)：無法判斷。

回傳格式規範：
若為 REPORT: {"intent": "REPORT", "data": {"department": "...", "teacher": "...", "location": "...", "classroom": "...", "category": "...", "description": "..."}}
若為 CLOSE: {"intent": "CLOSE", "id": 123}
若為 CHAT: {"intent": "CHAT", "reply": "這裡是你針對聊天的親切回覆..."}
若為 UNKNOWN: {"intent": "UNKNOWN"}

使用者訊息：「${text}」`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    }),
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(res.getContentText());
    let aiText = json.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(aiText);
  } catch (err) {
    Logger.log("Gemini Error: " + err.message);
    return null;
  }
}

// ==========================================
// LINE 訊息機制
// ==========================================

function pushToLine(userId, text) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || !userId) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({ to: userId, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
}

function replyToLine(replyToken, text) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || !replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
}
