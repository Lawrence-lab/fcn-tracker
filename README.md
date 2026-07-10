# 📊 FCN Portfolio Tracker (FCN 投資組合追蹤系統)

這是一個專門為 FCN（Forward Accumulator / Fixed Coupon Note，股票連結票券）商品投資者設計的本機與雲端記帳管理系統。系統支援即時股價追蹤、水位警示、未來利息收入行事曆，以及**利用 Google Gemini 3.5 Flash 進行合約圖片智能辨識自動填表**。

---

## 🌟 核心功能特色

1.  **📊 總覽儀表板 (Dashboard)**
    *   自動計算目前未平倉總投資金額、平均年化票息率與預期總利息。
    *   **風險警告中心**：若有任何連結標的股價接近或跌破敲入 (KI) 生效價，儀表板會立即跳出紅色警告卡片。

2.  **🔍 未平倉商品列表 (Active FCNs)**
    *   動態進度水位條：直觀呈現 worst stock（表現最差股票）相對於 KI 門檻 (0%)、履約價 (58.05%)、期初價 (100%) 及 KO 提前出場價 (100%) 的水位區間。
    *   **防標籤重疊演算法**：當多個價格門檻重合時（如期初價與 KO 水位），自動合併顯示，保持介面精緻乾淨。
    *   **詳細數據表格**：精確至小數點後 4 位，完整列出各檔股票的期初價、履約價、觸及價、當前收盤價及漲跌幅，並以紅底特別標示目前最差標的。

3.  **📅 預期美元配息收入行事曆 (Expected USD Interest Calendar)**
    *   自動依據 active FCN 商品合約中各期「約定配息日」列表，將未來每個月預期收到的美元利息收入進行時序排列。
    *   提供各月份美元小計與未來預期總利息之總結，完美掌控每月被動現金流。

4.  **🤖 智能圖片解析新增 (AI Image Parser)**
    *   免除繁瑣的手動 key-in！只要拖曳上傳您的 FCN 合約截圖，系統會呼叫 **Google Gemini 3.5 Flash API** 自動讀取合約代碼、發行銀行、本金、票息率、各標的期初價、實際配息日列表等資訊，並自動換算成百分比，一鍵填滿表單。

5.  **📜 歷史平倉紀錄與結算試算 (History & Settle)**
    *   支援三種結算模式：提前敲出出場 (KO)、到期現金收回、到期實物交割 (承接股票)。
    *   **接股試算器**：若標的觸發接股，系統會根據本金及履約轉換價，自動計算應交付股數與收盤基準日之股票跌價損失，並統計包含票息在內的「淨損益 (Net Profit/Loss)」。

6.  **⏰ 每日收盤自動判定任務 (Daily Cron Job)**
    *   後端整合 `node-cron` 定時器，於**每日清晨 5:30** 自動清除快取並抓取最新收盤價，即時比對是否觸發 KI 敲入事件，自動更新並存檔，保障資料時效性。

---

## 🛠️ 技術棧

*   **前端 (Frontend)**: React + Vite + Vanilla CSS (Obsidian  obsidian-dark 質感毛玻璃風格)
*   **後端 (Backend)**: Node.js + Express
*   **資料庫 (Database)**: 本機輕量化 JSON 檔案資料庫 (`backend/data/fcns.json`)
*   **排程排班**: `node-cron` + Yahoo Finance API 股價抓取與快取機制
*   **AI 引擎**: Google Generative Language API (`gemini-3.5-flash`)

---

## 💻 本機開發與執行環境準備

1.  **安裝依賴套件**：
    在專案根目錄下執行以下指令（將自動一併安裝前端子目錄的套件）：
    ```bash
    npm install
    ```

2.  **啟動開發環境**：
    執行以下指令，將同時啟動後端 Express 伺服器 (Port 3001) 與 Vite 前端伺服器 (Port 5173)：
    ```bash
    npm run dev
    ```
    打開瀏覽器造訪 **[http://localhost:5173/](http://localhost:5173/)** 即可使用。

3.  **生產環境打包**：
    ```bash
    npm run build
    ```

---

## ☁️ Zeabur 雲端部署指南

本專案已完成 monorepo 設定，在 Zeabur 部署極為方便：

1.  **專案導入**：
    在 Zeabur 控制台點擊「建立服務」➔ 選擇「GitHub」，並連結本專案之 GitHub 儲存庫。Zeabur 將自動執行安裝、打包並啟動 Express 服務。
2.  **掛載永久磁碟 (防止重啟後資料遺失)**：
    *   在服務卡片中，切換到 **「儲存 (Storage)」** 分頁。
    *   點擊 **「掛載硬碟 (Mount Volume)」**，將路徑設定為：` /data`。
3.  **環境變數設定**：
    *   切換到 **「變數 (Variables)」** 分頁，點擊 **「新增變數 (Add Variable)」**。
    *   名稱 (Key)：`DATA_PATH`
    *   值 (Value)：`/data`
    *   保存後系統會自動重啟，資料庫就會被永久保存在 Zeabur 的硬碟中，安全無虞！
