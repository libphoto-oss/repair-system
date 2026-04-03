# 校園維修通報系統 - 部署設定指南 (包含 AI 智能版)

本系統使用 **GitHub Pages** (靜態前端) + **Google Sheets** (資料庫) + **Google Apps Script** (免費 API 與 LINE Webhook) 的架構。新加入的 **Google Gemini AI** 功能，可讓 LINE 機器人擁有聽懂「自然語言報修」與自動回覆的能力！

---

## 第一步：申請 Google Gemini API 金鑰 (免費)

為了讓 LINE Bot 可以讀懂日常對話（例如：「我是輔導室周老師，諮商室冷氣不冷」），我們需要 Google 的 AI 來幫忙提取欄位。

1. 前往 **[Google AI Studio](https://aistudio.google.com/)**，點擊登入。
2. 接受服務條款後，點擊左側導覽列的 **「Get API key」**。
3. 點擊藍色按鈕 **「Create API key」**，選擇建立。
4. 網頁會顯示一串以 `AIza` 開頭的字串，這就是你的 `GEMINI_API_KEY`，請將它複製並妥善保存。

---

## 第二步：設定 Google Sheets + Apps Script

### 2.1 建立 Google Sheets

1. 開啟 [Google Sheets](https://sheets.google.com)，建立新的空白試算表。
2. 命名為「校園維修通報系統」。

### 2.2 建立 Apps Script

1. 點選試算表上方選單：「擴充功能」→「Apps Script」
2. 在 Apps Script 編輯器中，將預設的程式碼**全部刪除**。
3. 把本專案的 `docs/google-apps-script.js` 內容**全部複製並貼上**。
4. 設定最上方的 `CONFIG` 區塊：

```javascript
const CONFIG = {
  SHEET_NAME: '報修紀錄',
  DASHBOARD_PASSWORD: 'admin1234', // 修改為你的管理密碼
  LINE_CHANNEL_ACCESS_TOKEN: '你的LINE_TOKEN',
  LINE_USER_ID: '管理員的LINE_ID', // 只有這個 ID 可以在 LINE 輸入「結案單號XX」
  GEMINI_API_KEY: 'AIza開頭的字串（第一步取得的金鑰）', 
};
```
5. 點擊上方的儲存 (磁碟片圖示)。

### 2.3 初始化試算表

1. 選擇上方函式下拉選單為 `initializeSheet`。
2. 點擊「執行」。首次授權請選擇「進階」→「前往(不安全)」。
3. 等待執行完畢，回到試算表，會發現標題欄自動建立了（包含隱藏的 `reporterLineId` 欄位供通知使用）。

### 2.4 部署與取得 Webhook URL

1. 點擊右上角「部署」→「新增部署作業」。
2. 選擇「網頁應用程式」，設定以下：
   - 執行身分：自己
   - 存取權限：**所有人**
3. 點擊部署，並**複製產生的「網頁應用程式網址」** (https://script.google.com/macros/s/xxxx/exec)。

---

## 第三步：設定 GitHub Pages 前端

1. 開啟 GitHub，建立新的 Public Repository `repair-system`。
2. 前往 `Settings` → `Secrets and variables` → `Actions` → `Variables`。
3. 增加 Repository Variable：
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `你在 2.4 步驟複製的網址`
4. 開啟終端機，上傳程式碼即可自動建構部署（請參考標準 Git 操作）。

---

## 第四步：設定 LINE 官方帳號設定

1. 前往 [LINE Developers](https://developers.line.biz/) 建立 Messaging API Channel。
2. 在 `Messaging API` 分頁，將你的 Webhook URL 設定為 2.4 步驟取得的 Apps Script 網址，並開啟「Use webhook」。
3. **重要：** 前往 LINE Official Account Manager (官方帳號設定中心)：
   - 將「回應模式」設為「聊天 Bot」
   - 將「Webhook」設為「開啟」
   - 將「自動回覆訊息」設為「關閉」（讓 AI 掌管回覆！）
4. 在 Messaging API 頁面取得 `Channel Access Token`，並在 Basic Settings 取得自己的 `Your user ID`。
5. （填回 CONFIG 然後重新部署 Apps Script 建立新版本：點部署 → 管理部署作業 → 編輯 → 建立新版本）。

---

## 完成！如何使用 AI 功能？

- **管理員專屬功能：**
  你可以對 Bot 說：「麻煩把單號 5 結案」
  Bot: ✅ 單號 #5 已結案！
- **一般使用者報修：**
  隨便任何加入 LINE Bot 的人傳訊：「我是輔導室的美環老師，1 樓的走廊盆栽破了」
  Bot: ✅ 已為您登記報修！單號為 #6。處理完畢後會透過 LINE 通知您。
- **網頁後台雙向同步通知：**
  管理員如果在 GitHub Pages 網頁平台上修改狀態為「處理中」或「結案」。系統會透過隱藏的 `reporterLineId` 自動私訊原本用 LINE 報修的老師進度更新！
