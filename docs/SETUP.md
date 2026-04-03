# 校園維修通報系統 - 部署設定指南

本系統使用 **GitHub Pages**（靜態前端）+ **Google Sheets**（資料儲存）+ **Google Apps Script**（API）的架構，完全免費。

---

## 架構說明

```
GitHub Pages          Google Apps Script         Google Sheets
（靜態網頁）    --->   （免費 API 伺服器）   --->  （資料庫）
                              |
                              v
                       LINE Messaging API
                       （報修推播通知）
```

---

## 第一步：設定 Google Sheets + Apps Script

### 1.1 建立 Google Sheets

1. 開啟 [Google Sheets](https://sheets.google.com)
2. 點選「空白試算表」建立新的試算表
3. 將試算表命名為「校園維修通報系統」

### 1.2 建立 Apps Script

1. 在試算表中，點選上方選單「擴充功能」→「Apps Script」
2. 在 Apps Script 編輯器中，將預設的 `function myFunction(){}` **全部刪除**
3. 開啟專案中的 `docs/google-apps-script.js` 檔案
4. 將檔案內容**全部複製**，貼入 Apps Script 編輯器
5. 修改最上方的 `CONFIG` 設定：

```javascript
const CONFIG = {
  SHEET_NAME: '報修紀錄',           // 可自訂工作表名稱
  DASHBOARD_PASSWORD: 'admin1234', // 修改為你的管理密碼
  LINE_CHANNEL_ACCESS_TOKEN: '',   // 填入 LINE Token（見第三步）
  LINE_USER_ID: '',                // 填入 LINE User ID（見第三步）
};
```

6. 點選上方的「儲存」按鈕（或按 Ctrl+S）

### 1.3 初始化試算表

1. 在 Apps Script 編輯器中，選擇上方的函式下拉選單，選擇 `initializeSheet`
2. 點選「執行」按鈕
3. 首次執行時會要求授權，點選「審查權限」→ 選擇你的 Google 帳號 → 「進階」→「前往（不安全）」→「允許」
4. 執行完成後，回到 Google Sheets 確認已建立「報修紀錄」工作表並含有表頭

### 1.4 部署為 Web App

1. 在 Apps Script 編輯器中，點選右上角「部署」→「新增部署作業」
2. 點選左側齒輪圖示，選擇「網頁應用程式」
3. 設定：
   - **說明**：維修通報系統 API
   - **執行身分**：自己
   - **存取權限**：所有人
4. 點選「部署」
5. **複製產生的網址**（格式如 `https://script.google.com/macros/s/xxxxxxx/exec`）

> 這個網址就是你的 API 網址，後續步驟會用到。

---

## 第二步：設定 GitHub Pages

### 2.1 註冊 GitHub 帳號

1. 前往 [github.com](https://github.com) 點選「Sign up」
2. 依照步驟完成註冊（免費帳號即可）

### 2.2 建立 Repository

1. 登入 GitHub 後，點選右上角「+」→「New repository」
2. 設定：
   - **Repository name**：`repair-system`（或自訂名稱）
   - **Visibility**：Public（GitHub Pages 免費版需要公開）
3. 點選「Create repository」
4. 記下你的 GitHub 使用者名稱和 repo 名稱

### 2.3 設定 Repository Variable

1. 在 Repository 頁面，點選「Settings」→ 左側選單「Secrets and variables」→「Actions」
2. 切換到「Variables」分頁
3. 點選「New repository variable」
4. 新增：
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: 貼上第一步取得的 Google Apps Script 網址
5. 點選「Add variable」

### 2.4 啟用 GitHub Pages

1. 在 Repository 頁面，點選「Settings」→ 左側選單「Pages」
2. **Source** 選擇「GitHub Actions」

### 2.5 上傳程式碼

在你的電腦上開啟終端機（Terminal），依序執行：

```bash
cd /Users/matt/Desktop/repair-system

git init
git add .
git commit -m "首次提交：校園維修通報系統"
git branch -M main
git remote add origin https://github.com/你的使用者名稱/repair-system.git
git push -u origin main
```

> 推送完成後，GitHub Actions 會自動建構並部署網站。

### 2.6 確認部署狀態

1. 在 Repository 頁面，點選「Actions」分頁
2. 確認「Deploy to GitHub Pages」工作流程執行成功（綠色勾勾）
3. 部署完成後，網址為：`https://你的使用者名稱.github.io/repair-system/`

---

## 第三步：設定 LINE 通知（選擇性）

如果不需要 LINE 通知，可跳過此步驟。

### 3.1 建立 LINE Bot

1. 前往 [LINE Developers](https://developers.line.biz/) 並登入
2. 建立 Provider（如「學校名稱」）
3. 建立 Messaging API Channel
4. 在 Channel 設定頁面取得：
   - **Channel Access Token**（在「Messaging API」分頁最下方，點「Issue」產生）
   - **Your User ID**（在「Basic settings」分頁的「Your user ID」）

### 3.2 更新 Apps Script 設定

1. 回到 Google Apps Script 編輯器
2. 修改 `CONFIG` 中的 LINE 設定：

```javascript
LINE_CHANNEL_ACCESS_TOKEN: '你的_Channel_Access_Token',
LINE_USER_ID: '你的_User_ID',
```

3. 儲存後，點選「部署」→「管理部署作業」→ 點選編輯圖示 → 版本選擇「建立新版本」→「部署」

---

## 更新部署

### 修改前端程式碼後

只需要將變更推送到 GitHub，GitHub Actions 會自動重新部署：

```bash
git add .
git commit -m "更新說明"
git push
```

### 修改 Apps Script 後

1. 在 Apps Script 編輯器中儲存修改
2. 點選「部署」→「管理部署作業」
3. 點選最新部署旁的編輯圖示
4. 版本選擇「建立新版本」
5. 點選「部署」

> 每次修改 Apps Script 程式碼後，必須建立新版本並重新部署，變更才會生效。

---

## 常見問題

### Q: 報修單送出後顯示失敗？

1. 確認 `.env.production` 或 GitHub Variable 中的 `NEXT_PUBLIC_API_URL` 是否正確
2. 確認 Apps Script 已正確部署且存取權限為「所有人」
3. 開啟瀏覽器開發者工具（F12）查看 Console 錯誤訊息

### Q: LINE 通知沒有收到？

1. 確認 Apps Script 中的 `LINE_CHANNEL_ACCESS_TOKEN` 和 `LINE_USER_ID` 填寫正確
2. 確認 LINE Bot 有加入好友
3. 在 Apps Script 中查看「執行項目」紀錄，檢查是否有錯誤

### Q: 如何修改管理密碼？

修改 Apps Script 中 `CONFIG.DASHBOARD_PASSWORD` 的值，儲存後重新部署。

### Q: 如何使用自訂網域？

1. 在 GitHub Repository Settings → Pages 中設定 Custom domain
2. 使用自訂網域時，移除 GitHub Variable 中的 `NEXT_PUBLIC_BASE_PATH`（或設為空值）
3. 重新推送觸發部署
