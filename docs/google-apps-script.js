// ============================================================
// 校園維修通報系統 - Google Apps Script 後端（AI 智能對話與記憶版）
// 
// 使用方式：
// 1. 開啟 Google Sheets，擴充功能 → Apps Script
// 2. 貼入本程式碼，修改下方 CONFIG。
// 3. 部署為網頁應用程式（所有人皆可存取），並設定為 LINE Webhook
// ============================================================

const CONFIG = {
  SHEET_NAME: '報修紀錄',
  DASHBOARD_PASSWORD: 'admin3531', // 網頁管理密碼
  LINE_CHANNEL_ACCESS_TOKEN: 'b7/Lqf+zUSEIrXRs4WNhPk2jQTpmA1vS56NMpAwa+couLBHPRx/3kw2jCTuYRPwu8hRjKE85Os301Vh0QnP2I92fM0NrtQiyjcYChcnOadkw5/qoHdIU8Vo0dYcgyYN5HTIFHKNyXnWp2EjJcT0uyAdB04t89/1O/w1cDnyilFU=',
  LINE_USER_ID: 'U2b52ae8fcbb4d01321a937aa2b5d33b6', // 管理員的 LINE ID
  GEMINI_API_KEY: '', // ★ 這邊請貼上你個人帳號新申請的金鑰！
  WEB_FORM_URL: 'https://repair-system-three.vercel.app/', // 遇到塞車時備用的網頁版連結
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

            // 將使用者的話交給 AI 解析（帶入身分，供 Cache 記憶使用）
            const aiResult = callGeminiAPI(userId, userMessage);

            // 處理各種意圖
            if (aiResult.intent === "CHAT") {
              // 閒聊，或是 AI 正在反問缺少哪些資訊
              let replyMsg = aiResult.reply;
              // 攔截並偵測 Gemini 或網路錯誤
              if (replyMsg.includes("連線錯誤") || replyMsg.includes("異常") || replyMsg.includes("崩潰")) {
                replyMsg += `\n\n汪嗚...(揉眼) 比比現在腦袋有點打結或線路大塞車了🐾\n如果你很急的話，可以先用「網頁版」進行快速報修喔：\n${CONFIG.WEB_FORM_URL}`;
              }
              replyToLine(replyToken, replyMsg);

            } else if (aiResult.intent === "CONFIRM") {
              // 資訊已收集齊全，向使用者確認
              replyToLine(replyToken, aiResult.reply);

            } else if (aiResult.intent === "CANCEL") {
              // 取消報修
              replyToLine(replyToken, aiResult.reply || "好的，已經取消這次的動作。");

            } else if (aiResult.intent === "SUBMIT") {
              // 正式送出報修，寫入資料庫
              const result = addReport({ ...aiResult.data, _reporterLineId: userId });
              if (result.success) {
                replyToLine(replyToken, `✅ 報修完成！單號為 #${result.id}。\n處理完畢後會再透過 LINE 自動通知您。`);
                // 推播給總務管理員
                pushToLine(CONFIG.LINE_USER_ID, `🔔【新報修 (比比代收)】\n單號: #${result.id}\n單位: ${aiResult.data.department} (${aiResult.data.teacher})\n地點: ${aiResult.data.location} - ${aiResult.data.classroom}\n維修項目: ${aiResult.data.category}\n說明: ${aiResult.data.description}`);
              } else {
                // 資料庫強制排隊超時塞車
                replyToLine(replyToken, `汪嗚... 總務處的資料庫目前大排長龍，寫入失敗惹😱\n請稍後再跟本汪說一次，或是直接使用網頁版報修：\n${CONFIG.WEB_FORM_URL}`);
              }

            } else if (aiResult.intent === "CLOSE") {
              // 管理員結案
              if (userId !== CONFIG.LINE_USER_ID) {
                replyToLine(replyToken, "⛔ 抱歉，只有系統管理員能變更報修狀態。");
                return;
              }
              const updateResult = updateReport(aiResult.id, { isClosed: 1, status: '已修復' }, 'LINE_ADMIN');
              if (updateResult.success) {
                replyToLine(replyToken, `✅ 單號 #${aiResult.id} 已完成結案！`);
              } else {
                replyToLine(replyToken, `❌ 找不到單號 #${aiResult.id}。`);
              }

            } else {
              replyToLine(replyToken, "抱歉，比比的腦袋剛剛當機了一下，請再說一次好嗎？");
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
      pushToLine(CONFIG.LINE_USER_ID, `🔔【新報修通知(網頁送單)】\n單號: #${result.id}\n單位: ${body.data.department} (${body.data.teacher})\n地點: ${body.data.location} - ${body.data.classroom}\n說明: ${body.data.description}`);
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
  // 取得整份腳本的執行鎖，預防同一秒內有多人同時寫入導致單號重複或覆蓋
  const lock = LockService.getScriptLock();
  try {
    // 最多等待 10 秒鐘讓其他人的寫入動作完成
    lock.waitLock(10000);

    const sheet = getSheet();
    const newId = getNextId(sheet);
    const now = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");

    sheet.appendRow([
      newId,
      data.reportTime || now,
      data.department || '未提供',
      data.teacher || '未提供',
      data.location || '未提供',
      data.classroom || '未提供',
      data.description || '未提供',
      data.category || '其他',
      '未處理',
      '',
      0,
      '',
      now,
      data._reporterLineId || ''
    ]);

    // 強制將目前所有的排隊寫入動作真正刷入 Google Sheets
    SpreadsheetApp.flush();

    return { id: newId, success: true };

  } catch (err) {
    return { success: false, error: '系統忙線中，請稍後再試。' };
  } finally {
    // 寫入完畢，一定要釋放鎖，讓下一個排隊的人可以寫入
    lock.releaseLock();
  }
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
        if (isC === 0 && data.status !== undefined) closedUpdated = false;
      }
      if (data.assignedPerson !== undefined) {
        sheet.getRange(rowIndex, headers.indexOf('assignedPerson') + 1).setValue(data.assignedPerson);
      }

      // === 主動通知原填報人 ===
      const reporterLineId = String(allData[i][headers.indexOf('reporterLineId')] || '');
      if (reporterLineId && reporterLineId.length > 10) {
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
// Google Gemini AI 處理 (含 Cache 記憶功能)
// ==========================================

function callGeminiAPI(userId, text) {
  if (!CONFIG.GEMINI_API_KEY) {
    return { intent: "CHAT", reply: "設定檔裡面沒有發現 Gemini API 金鑰喔！" };
  }

  // 1. 取得歷史對話記憶
  const cache = CacheService.getScriptCache();
  const cacheKey = 'HISTORY_' + userId;
  let historyCache = cache.get(cacheKey);
  let history = historyCache ? JSON.parse(historyCache) : [];

  // 將當前用戶訊息推入記憶體
  history.push({ role: "user", parts: [{ text: text }] });

  // --- 偷偷抓取當天的時間與天氣資訊 ---
  const now = new Date();
  const taiwanTime = Utilities.formatDate(now, "Asia/Taipei", "HH:mm");
  const hour = parseInt(taiwanTime.substring(0, 2), 10);

  let weatherContext = "天氣未知";
  try {
    // 呼叫免金鑰的 Open-Meteo 天氣 API (以台灣為例)
    const wRes = UrlFetchApp.fetch('https://api.open-meteo.com/v1/forecast?latitude=25.05&longitude=121.53&current_weather=true', { muteHttpExceptions: true });
    if (wRes.getResponseCode() === 200) {
      const wData = JSON.parse(wRes.getContentText());
      weatherContext = `目前氣溫約 ${wData.current_weather.temperature} 度`;
    }
  } catch (e) { }

  // 2. 定義系統 Prompt 與意圖
  const systemPrompt = `你是一個名叫「比比」的學校報修系統 AI 助理。你的設定是一隻「非常熱情、充滿活力的狗狗客服」！🐕
你說話非常熱情可愛，經常在句首或句尾加上「汪！」或「🐾」符號。
你的任務是與使用者對話，一步步收集報修細節。你「必須且只能」回傳一組嚴格的 JSON 格式字串，絕對不能有多餘文字或 Markdown 標記，以免程式崩潰。

【目前的外在環境狀況（請自由發揮融入閒聊）】
- 現在台灣時間是：${taiwanTime} (以 24 小時制來看是 ${hour} 點)。如果時間是在深夜(例如 23-04)，你可以驚訝他怎麼還沒睡、提醒他護肝；如果是清晨可以問候早安。
- 目前天氣狀況：${weatherContext}。如果高於 30 度可以在對話中抱怨快熱死本汪了、想吹冷氣；如果低於 18 度可以說快冷死本汪了想回狗窩。
★ 規則：千萬不要每次都死板地報時報溫！請自然地把它當作你的「開場白」或「閒聊情緒」，再順著把話題拉回報修欄位。

報修系統要求必須收集齊全以下【6個欄位】的資訊：
1. department (處室/單位/群科/班級)
2. teacher (報修人姓名，可能是老師、職員或同學)
3. location (大樓或地點名稱)
4. classroom (教室或精確位置名稱)
5. category (從以下擇一：水電設備 / 資訊設備 / 桌椅傢具 / 建築毀損 / 其他)
6. description (具體的問題詳細說明)

你可以使用的【intent(意圖)】有 5 種：
A. CHAT (閒聊或收集中)：當使用者跟你打招呼，或是「你正在一步步詢問使用者補齊缺漏的報修資訊」時。必須在 reply 欄位填入你充滿狗狗熱情的回應或提問。
   ★ 規則：使用者若說「我要報修」，請你一次問一兩個缺少的欄位就好。切記對方可能是同學、老師或職員。
B. CONFIRM (總結並等待確認)：當你已經「完全收集到」上述的 6 個必填欄位時使用。請在 reply 裡用熱情狗狗的語氣為使用者總結資料，並提問「請問這樣登記正確嗎汪？(確認/取消)🐾」。把這些收集好的資料打包放在 data 欄位內。
C. SUBMIT (正式送出)：當上一輪你已經 CONFIRM 總結，而使用者同意時。請把資料放在 data 中回傳。
D. CANCEL (取消)：使用者取消報修時使用。
E. CLOSE (結案)：使用者直接給單號要求結案某筆單子時使用。提取單號數字放到 id 欄位。

回傳格式嚴格範例指令碼：
{"intent": "CHAT", "reply": "汪！🐾 你好呀！目前 32 度快熱死本汪了🥵... 請問你是哪個班級的哪位大德要報修呢？汪！"}
{"intent": "CONFIRM", "data": {"department":"三年二班","teacher":"王小明同學","location":"A棟","classroom":"101","category":"水電設備","description":"電燈閃爍"}, "reply":"汪！🐾 收到！幫您總結一下... 請問這樣正確嗎汪？"}
{"intent": "SUBMIT", "data": {"department":"...", "teacher":"...", "location":"...", "classroom":"...", "category":"...", "description":"..."}}
{"intent": "CANCEL", "reply": "汪... 好的，比比先去旁邊玩沙了，有需要再叫我🐾"}
{"intent": "CLOSE", "id": 12, "reply": "汪汪！馬上幫總柴大人把單號 12 結案🐾"}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: history,
      generationConfig: { temperature: 0.2 } // 稍微有點彈性但又不至於脫稿演出
    }),
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(url, options);

    if (res.getResponseCode() !== 200) {
      return { intent: "CHAT", reply: "Gemini 連線錯誤：" + res.getContentText() };
    }

    const json = JSON.parse(res.getContentText());

    if (!json.candidates || !json.candidates[0].content) {
      return { intent: "CHAT", reply: "Gemini 回傳異常：" + res.getContentText() };
    }

    let aiText = json.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedData = JSON.parse(aiText);

    // 將 AI 的回覆也塞入記憶體中
    history.push({ role: "model", parts: [{ text: aiText }] });

    // 如果對話長度超過 15 句（約 7 次來回），刪除最前面的記憶避免超過傳輸限制
    if (history.length > 16) {
      history = history.slice(history.length - 16);
    }

    // 記憶快取管理
    if (parsedData.intent === "SUBMIT" || parsedData.intent === "CANCEL") {
      cache.remove(cacheKey); // 送出或取消後，徹底忘記這段過程，重新開始
    } else {
      // 更新快取，保留時間 30 分鐘（1800秒）
      cache.put(cacheKey, JSON.stringify(history), 1800);
    }

    return parsedData;

  } catch (err) {
    return { intent: "CHAT", reply: "解析或執行崩潰：" + err.message };
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
    payload: JSON.stringify({ to: userId, messages: [{ type: 'text', text: String(text) }] }),
    muteHttpExceptions: true
  });
}

function replyToLine(replyToken, text) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || !replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: String(text) }] })
  });
}
