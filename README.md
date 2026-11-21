# Sunshine 虛擬螢幕統一管理中心 (`sunshine-vdd-manager`)

這是一套專為 **Windows + Sunshine + Virtual Display Driver (MTT VDD) + MultiMonitorTool** 設計的可攜式螢幕自動切換與管理平台，整合 **Galaxy Z Fold 8 Ultra**（展開橫向／展開直向／16:9／外螢幕閉合，區分**效率版**與**效能版**）及 iPad / iPhone / 2K / 4K 多裝置配置，並支援搭配自訂版 Moonlight Android（[moonlight-kato](https://github.com/tws040844-oss/moonlight-kato)）依項目名稱自動套用解析度與橫直向。

---

## ✨ 核心特色

1. **零外部相依・一鍵啟動 Web UI**：僅使用 Node.js 內建模組與 Windows 內建 PowerShell，無需 `npm install`，雙擊 `Start-Manager.bat` 即開啟管理介面（僅綁定本機 `127.0.0.1:47995`）。
2. **跨電腦快速移植**：
   - 所有個人硬體 ID（`MonitorID`、`SerialNumber`）、本機路徑與備份均隔離在 `.gitignore` 的 `local/` 資料夾內。
   - 在任何新電腦上，只需點擊 **「自動偵測本機螢幕」**（透過 `MultiMonitorTool /scomma` + PnP），或從現有 `PC.cfg` 一鍵匯入，即可自動建立專屬設定。
3. **嚴格產生安全 `.cfg` 快照**：
   - 自動為每份 `.cfg` 補齊所有實體螢幕的靜態 `MonitorID`（關閉時設寬高與 `BitsPerPixel=0`）、固定 `DisplayFlags=0` 與 `DisplayOrientation=0`。
   - 統一以 **純 ASCII（無 BOM）＋ CRLF** 寫入，避免 MultiMonitorTool 讀取失敗。
4. **原生直向輸出不旋轉**：
   - Fold 8 Ultra 展開直向（`1968×2184`、`2256×2504`）採用 VDD 原生直向模式（`Width < Height`、`DisplayOrientation=0`），避免 Windows 螢幕旋轉 90° 導致的硬體編碼與游標異常。
5. **統一參數化切換引擎 & 自動備份**：
   - 以 `scripts/Switch-Display.ps1` 與 `scripts/Restore-Display.ps1` 取代大量重複 `.bat`，並將 **RTSS 鎖幀** 改為選配模組（他機未安裝也能正常運作）。
   - 寫入 `vdd_settings.xml` 與 Sunshine `apps.json` 前皆自動進行時間戳記備份，並驗證無空白 `prep-cmd` 行。

---

## 📱 內建 Galaxy Z Fold 8 Ultra 與多裝置清單

| 分類 | 名稱 | 解析度 | 定位 |
|---|---|---|---|
| Desktop | `Desktop｜原生雙螢幕` | 原生桌面 | 不切換螢幕 |
| Desktop | `Desktop｜Fold8U 展開橫向 (效率 2184×1968)` | `2184×1968` | 展開橫向・效率 |
| Desktop | `Desktop｜Fold8U 展開直向 (效率 1968×2184)` | `1968×2184` | 展開直向・效率 |
| Desktop | `Desktop｜Fold8U 16:9 (效率 2184×1228)` | `2184×1228` | 展開 16:9・效率 |
| Desktop | `Desktop｜Fold8U 展開橫向 (效能 2504×2256)` | `2504×2256` | 展開橫向・效能 |
| Desktop | `Desktop｜Fold8U 展開直向 (效能 2256×2504)` | `2256×2504` | 展開直向・效能 |
| Desktop | `Desktop｜Fold8U 16:9 (效能 2496×1404)` | `2496×1404` | 展開 16:9・效能 |
| Desktop | `Desktop｜Fold8U 閉合 (2520×1080)` | `2520×1080` | 外螢幕橫向 |
| Steam | 以上 7 組 Fold 8 Ultra + iPad / iPhone 15 Pro / 2K / 4K 電視 | 各裝置解析度 | `steam://open/bigpicture` |

> **搭配 Moonlight KATO v0.6**：項目名稱皆已標註 `寬×高`（例如 `1968×2184`），手機端點選項目時會自動套用對應解析度與橫／直向，不需手動修改設定頁！

---

## 🚀 在全新 Windows 電腦上 5 分鐘部署

### 前置需求
- **Windows 10 / 11**（需具備管理員權限執行 UAC，以控制裝置管理員中的虛擬顯示卡）
- **Node.js 20+**（建議 LTS）
- **Sunshine**（已安裝於預設路徑或自訂路徑）
- **Virtual Display Driver (MTT VDD)**（預設目錄 `C:\VirtualDisplayDriver\`）
- **MultiMonitorTool**（由 NirSoft 官方下載，放於專案內 `tools\MultiMonitorTool.exe`，或在介面指定路徑）

### 啟動與設定步驟
1. 下載或 Clone 本專案後，將 `MultiMonitorTool.exe` 放入 `tools\`。
2. 雙擊 **`Start-Manager.bat`**，自動開啟 `http://127.0.0.1:47995`。
3. 切換至 **「🖥️ 本機硬體精靈」**：
   - 點擊 **「🔍 自動偵測本機螢幕」** 並套用（若已有一份現成的全亮 `PC.cfg`，也可直接輸入路徑匯入）。
   - 依需要開啟或關閉 **RTSS 鎖幀（選配）**，最後點選儲存。
4. 切換至 **「🧩 VDD 解析度同步」**，點擊 **「⚡ 補齊缺少解析度並重載 VDD」**。
5. 切換至 **「☀️ Sunshine 同步中心」**，預覽無誤後點擊 **「🚀 同步至 Sunshine 並重啟服務」**。

---

## 🛡️ 故障排除與安全設計

- **串流結束沒還原螢幕**：直接點擊網頁右上角 **「🆘 緊急還原實體雙螢幕」**，或手動執行 `local\wrappers\Restore_PC.bat`。
- **為什麼備份重要**：每次修改 `vdd_settings.xml` 或 `apps.json` 都會先備份到 `local\backups\`。
- **為什麼 `local/` 不納入 Git**：每台電腦的 `MonitorID`、`SerialNumber` 與安裝路徑皆不同，排除個人硬體資訊可確保公開分享時不外洩任何本機資訊。

---

## 🧪 執行自動化測試

```powershell
npm test
```

## 📄 授權條款

[MIT License](LICENSE)
