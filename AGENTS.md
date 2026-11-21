# AGENTS.md — `sunshine-vdd-manager` 專案規範與架構紅線

本文件供後續維護與 AI 協作代理直接遵循，彙整本專案所有不可違反之需求、硬體快照規則、螢幕切換原則、封面規範與隱私紅線。

---

## 1. 專案定位與跨電腦可攜原則

- **零外部相依**：核心伺服器僅使用 Node.js 20+ 內建模組（不引入第三方 npm runtime 套件），搭配 Windows 內建 PowerShell、Virtual Display Driver（MTT VDD）、MultiMonitorTool 與內建 Microsoft Edge / Chrome headless 產生封面圖。
- **跨電腦即開即用**：
  - 所有個人本機設定（`MonitorID`、`SerialNumber`、本機檔案路徑、自動產生的 `.cfg`/`.bat`/備份與自訂封面）**一律隔離於 `.gitignore` 忽略的 `local/` 目錄**。
  - 在任何新 Windows 電腦只需執行 `Start-Manager.bat`，透過「自動偵測本機螢幕」（`scripts/Detect-Monitors.ps1`）或匯入既有全亮 `PC.cfg` 即可部署。
- **RTSS 鎖幀為選配模組**：透過 `local/machine.json` 的 `rtss.enabled` 控制；目標電腦未安裝 RTSS 時必須可完全略過，不得報錯或中斷切換。
- **本機安全邊界**：Web UI 僅監聽 `127.0.0.1:47995`，所有寫檔操作必須驗證路徑不得跨出允許目錄。

---

## 2. 顯示器切換核心規則（實體螢幕 vs VDD）

| 模式 (`mode`) | 適用項目 | 進入串流行為 (`Switch-Display.ps1`) | 離開串流還原 (`Restore-Display.ps1`) |
|---|---|---|---|
| `vdd` | `Desktop｜Fold8U`（7 項）、`Steam｜Fold8U / iPad / iPhone / 4K`（11 項） | 若啟用 RTSS 先鎖目標幀率（僅啟動一次） → **PnP 啟用 `*Virtual Display*`** → **`MultiMonitorTool /disable` 關閉全部實體螢幕** → 載入對應 `.cfg` | 中止卡住的工具 → `MultiMonitorTool /enable` 喚醒全部實體螢幕 → `/SetPrimary` 設回主螢幕 → 載入 `PC.cfg` → **PnP 停用 `*Virtual Display*`** → 恢復 RTSS 原幀率 |
| `passthrough` | `Desktop｜原生雙螢幕` | 不附掛 `prep-cmd`，保留雙實體螢幕原樣 | 無須切換 |
| `physical-primary` | `Steam｜2K 實體螢幕` | 僅保留主實體螢幕，關閉副螢幕與 VDD | 同 `Restore-Display.ps1` 完整恢復雙實體螢幕 |

- **薄包裝 `.bat` 原則**：Sunshine `apps.json` 僅指向 `local/wrappers/Start_<id>.bat` 與 `local/wrappers/Restore_PC.bat`，實際邏輯統一集中於 `scripts/Switch-Display.ps1` 與 `scripts/Restore-Display.ps1`（禁止複製貼上大量獨立 `.bat`）。

---

## 3. MultiMonitorTool `.cfg` 快照嚴格規範

1. **禁止破壞既有遺留檔案**：絕對不可修改或刪除專案目錄外原有的舊版 `.cfg` 與 `.bat` 快照。
2. **必須包含全部參與螢幕**：
   - 每份 `.cfg` 皆須完整列出所有實體螢幕（`[Monitor0]`, `[Monitor1]`, ...）與虛擬顯示器區塊，不得遺漏；不亮起的螢幕其 `BitsPerPixel`、`Width`、`Height`、`DisplayFlags`、`DisplayFrequency`、`DisplayOrientation`、`PositionX`、`PositionY` 一律設為 `0`。
   - 依賴靜態硬體 `MonitorID`（與 `SerialNumber`）識別螢幕，不可依賴會跳動的 `\\.\DISPLAY*` 編號；保持 `DisplayFlags=0` 與 `DisplayOrientation=0`。
3. **檔案編碼與換行**：所有 `.cfg` 與 `.bat` 必須輸出為 **純 ASCII（不可含 UTF-8 BOM）＋ Windows CRLF（`\r\n`）**。

---

## 4. Galaxy Z Fold 8 Ultra 解析度矩陣與原生直向規則

- **排序與分級原則**：**效率版**優先於**效能版**；`Desktop`（純桌面）與 `Steam`（`steam://open/bigpicture`）清楚分區，共 20 個標準項目（定義於 `presets/devices.json`）：
  - **Fold 8 Ultra 效率版**：展開橫向 `2184×1968`、展開直向 `1968×2184`、16:9 `2184×1228`
  - **Fold 8 Ultra 效能版**：展開橫向 `2504×2256`、展開直向 `2256×2504`、16:9 `2496×1404`
  - **Fold 8 Ultra 外螢幕**：閉合橫向 `2520×1080`（`vddExtraResolutions` 另預載 `1080×2520` 備用）
  - **其他既定裝置**：iPad `2360×1640`、iPhone 15 Pro 全螢幕 `2556×1179` / 安全區 `2202×1179`、PC 2K 主螢幕 `2560×1440`（`180Hz`）、4K 電視 `3840×2160`
- **原生直向輸出（不可旋轉 90°）**：展開直向模式在 `.cfg` 與 `vdd_settings.xml` 一律使用 **`Width < Height` 且 `DisplayOrientation=0`**，避免 Windows 畫面旋轉導致硬體編碼與游標座標異常。

---

## 5. Sunshine `apps.json` 與 Moonlight KATO 命名契約

- **名稱帶入解析度**：所有非原生項目名稱必須包含明確 `寬×高`（例如 `Desktop｜Fold8U 展開直向 (效率 1968×2184)`），供 `moonlight-kato` v0.6+ 啟動時自動辨識並套用當次解析度與橫直向。
- **無空白指令保護**：`apps.json` 內**絕對不可輸出空白的 `cmd` 或空白 `prep-cmd` 項目**（Desktop 項目省略 `cmd` 鍵；所有 `prep-cmd` 必設 `"elevated": true`）。
- **寫前自動備份**：修改系統 `vdd_settings.xml` 或 Sunshine `apps.json` 前，必須先以時間戳記備份至 `local/backups/`；需要 UAC 管理員權限的操作一律透過標準 Windows 提權腳本（`scripts/Apply-SystemSync.ps1`）執行。

---

## 6. `600×800` 專屬封面圖示與繁中字幕規範

- **禁止共用 `desktop.png` 或空白圖示**：Moonlight Android 在項目套用 `desktop.png` 時會隱藏文字標題；因此 20 個項目皆須透過 `server/lib/coverGenerator.js` 產生獨立 `600×800`（3:4）PNG 圖卡（預置於 `assets/covers/`，使用者自訂項目產於 `local/covers/`）。
- **視覺資訊必要元素**：
  1. 左上類別標籤（`DESKTOP` / `STEAM`）與右上分級標籤（`效率版` / `效能版` / `外螢幕` / `原生` 等）。
  2. 模式狀態條：`⚡ VDD 關實體雙螢幕` / `🖥️ 保留實體雙螢幕` / `🖥️ 單留主螢幕・關副螢幕`。
  3. 中央專屬向量 SVG 裝置輪廓（區分雙實體螢幕、Fold 展開橫向／直向／16:9／閉合、iPad、iPhone 全螢幕／安全區、2K 實體、4K 電視）。
  4. 底部微軟正黑體粗體繁中主標、副標與等寬解析度膠囊（在 7 欄小縮圖下仍清晰可讀，零裁切重疊）。
- **快取刷新提示**：每次在電腦端變更封面圖示並同步至 Sunshine 後，須提醒使用者在 Android 端對 Moonlight 執行 **「僅清除快取」（切勿清除資料，以保留 Sunshine 配對）**。

---

## 7. 隱私安全紅線與提交前驗證

- **嚴禁進入 Git 的內容**：`local/`、任何電腦的真實 `MonitorID` / `SerialNumber`、個人系統路徑、Sunshine/GitHub 帳號密碼、第三方執行檔（`tools/*.exe`）及無關私人或機密資料夾。
- **提交前必跑驗證**：
  1. 單元測試：`npm test`（驗證 `.cfg` 格式、VDD XML 無損補齊、Sunshine `apps.json` 零空白指令與 `600×800` 封面 PNG 尺寸）。
  2. PowerShell AST 檢查：`scripts/*.ps1` 零語法錯誤。
  3. 隱私關鍵字掃描：確認 `git ls-files` 不含 `local/` 與任何本機個人識別資訊。
