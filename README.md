# 3D Mesh Viewer

[繁體中文](README.md) | [English](README.en.md)

3D Mesh Viewer 是一個 Visual Studio Code 擴充套件，讓你可以直接在編輯器內檢視常見的工程分析與模擬網格檔案格式。

這個工具適合用在不想頻繁切換到外部 3D 檢視器的工作流程。你可以直接在 VS Code 開啟 mesh 檔案、立即檢查幾何外型、切換實體與線框模式，並快速確認 parser 匯入後的模型是否正確，而不需要離開目前的開發環境。

## 工具功能

- 在 VS Code 內使用自訂 3D Viewer 開啟 mesh 檔案。
- 支援表面網格與體積網格。
- 可針對四面體與六面體體積網格擷取外表面並進行渲染。
- 提供實體模式、表面線框模式，以及完整 mesh 線框模式。
- 內建側邊欄檔案瀏覽器，方便快速找到工作區中的 mesh 檔案。

## 支援格式

- `.mesh`：MEDIT ASCII mesh
- `.msh`：Gmsh ASCII mesh
- `.inp`：Abaqus input mesh
- `.vtk`：VTK legacy ASCII unstructured grid
- `.stl`：ASCII 與 Binary STL

## 適用情境

- 在後續模擬前，先確認匯出的 mesh 結構是否正確。
- 檢查四面體或六面體體積網格的外表面。
- 開發 mesh 匯入流程時，比對 parser 的輸出結果。
- 直接在 repository 中檢視 mesh 資產，而不需要切換到其他工具。

## Viewer 功能

- 實體渲染模式，適合檢查整體表面外觀。
- 表面線框疊加模式，方便檢查邊界。
- Mesh 線框模式，可檢查元素邊線結構。
- 可調整殼層透明度。
- 提供色彩選擇器，方便快速調整視覺對比。
- 支援 Orbit Controls，可旋轉、平移與縮放模型。

## 安裝方式

如果你要從已打包的 release 檔案安裝：

1. 到 GitHub Releases 頁面下載 `.vsix` 檔案。
2. 在 VS Code 執行 `Extensions: Install from VSIX...`。
3. 選取下載好的 `.vsix` 檔案。

如果你要在本機自行打包：

```bash
npm ci
npm run package:vsix
```

## 開發方式

安裝相依套件：

```bash
npm ci
```

執行本機 CI 驗證流程：

```bash
npm run ci
```

執行開發模式建置：

```bash
npm run dev
```

打包 extension：

```bash
npm run package:vsix
```

## GitHub Release 流程

1. 將 repository push 到 GitHub。
2. 更新 `package.json` 中的版本號。
3. push 對應版本的 tag，例如 `v0.1.0`。
4. GitHub Actions 會自動執行 CI、打包 extension，並建立附帶 `.vsix` 檔案的 GitHub Release。

## 專案說明

- 目前 `publisher` 設定為 `local-build`，目的是讓專案可以先在本機完成打包。
- 如果之後要發佈到 VS Code Marketplace，請先修改 `package.json` 內的 `publisher`。
- 目前這個 repository 的發佈流程以本機打包與 GitHub Releases 為主，尚未直接串接 Marketplace 發佈。

