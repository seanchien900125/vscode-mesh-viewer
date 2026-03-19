# Plan: VS Code 3D Mesh Viewer Extension

**TL;DR**: 建立一個 VS Code extension，使用 `CustomReadonlyEditorProvider` 開啟 `.mesh`/`.msh`/`.inp`/`.vtk`/`.stl` 檔案，在 webview 中用 Three.js 渲染 3D 網格模型，支援滑鼠旋轉/縮放/平移、切換多種實體/框線顯示模式、調整網格顏色與外殼透明度，並在格式錯誤時安全地顯示 parse error 而不是拖垮 extension host。

---

### Architecture

- **Extension host** (Node.js): 讀取檔案、解析網格資料、做格式驗證/容錯、透過 `postMessage` 傳送幾何資料至 webview
- **Webview** (browser): Three.js 渲染 3D 模型、滑鼠操控、UI 控制面板、透明度與顯示模式切換

---

### Steps

#### Phase 1: 專案腳手架
1. 建立 `package.json` — extension manifest，註冊 `customEditors` 對應 `*.mesh`/`*.msh`/`*.inp`/`*.vtk`/`*.stl`
2. 建立 `tsconfig.json`、`webpack.config.js`（兩個 entry: extension node + webview browser）
3. 建立 `.vscode/launch.json` 用於 F5 除錯
4. 安裝依賴：`three`、`@types/three`、`@types/vscode`、`typescript`、`ts-loader`、`webpack`、`webpack-cli`

#### Phase 2: 檔案格式解析器
5. 定義 `ParsedMesh` 介面：`{ vertices: Float32Array, indices: Uint32Array }`
6. 實作 `meshParser.ts` — MEDIT 格式解析（Vertices → 座標，Hexahedra/Tetrahedra/Triangles → 提取邊界面三角形）
   - 關鍵：六面體(hex)需做 **boundary face extraction**（只渲染外表面，用 face hashing 找出只出現一次的面）
7. 實作 `stlParser.ts` — STL 格式（偵測 ASCII/binary，讀取三角形）
8. 實作 `mshParser.ts` — Gmsh MSH 格式（ASCII，v2/v4）
9. 實作 `inpParser.ts` — Abaqus/CalculiX `.inp` 格式（`*NODE` / `*ELEMENT`，先支援常見 tri/quad/tet/hex）
10. 實作 `vtkParser.ts` — VTK legacy ASCII 格式
11. 實作 `parserUtils.ts` — 共用格式驗證與 fail-fast 防護，避免錯誤檔案導致 extension host 卡死

#### Phase 3: Extension Host 核心
12. `src/extension.ts` — activate 時註冊 `CustomReadonlyEditorProvider`
13. `src/meshEditorProvider.ts` — 讀取檔案、依副檔名選擇解析器、設定 webview HTML（含 CSP），post 解析後的資料
14. `src/meshExplorerProvider.ts` — 側欄列出 `mesh/msh/inp/vtk/stl` 檔案並支援 watcher refresh

#### Phase 4: Webview 3D 渲染器
15. `media/viewer.ts` — Three.js 場景：
    - `WebGLRenderer`（antialias）+ `PerspectiveCamera` + `OrbitControls`
    - 環境光 + 方向光
    - 接收 mesh 資料 → 建立 `BufferGeometry` → 自動 frame camera
16. 顯示模式控制：
    - **Solid**
    - **Surface Wireframe**
    - **Mesh Wireframe**
    - **Solid + Surface Wireframe**
    - **Solid + Mesh Wireframe**
    - `<input type="color">` 色彩選擇器
    - `<input type="range">` 外殼透明度控制
17. 體積元素顯示策略：
    - 解析端先做 **boundary face extraction**
    - 針對 boundary faces 做 outward orientation 修正，避免 `FrontSide` 時缺面
    - wireframe 區分 **surface edges** 與 **all element edges**

#### Phase 5: 測試與優化
18. webpack 建置，用 `Bellows_hex.mesh`、`Bellows_hex.inp`、`Bellows_2.vtk` 測試
19. 處理視窗 resize、主題色彩適配
20. 對格式不正確/截斷/索引越界的檔案，顯示 parse error 而不是讓 VS Code 卡死

---

### 專案結構
```
vscode-mesh-viewer/
├── src/
│   ├── extension.ts
│   ├── meshEditorProvider.ts
│   ├── meshExplorerProvider.ts
│   └── parsers/
│       ├── types.ts          # ParsedMesh interface
│       ├── meshParser.ts     # MEDIT .mesh
│       ├── mshParser.ts      # Gmsh .msh
│       ├── inpParser.ts      # Abaqus/CalculiX .inp
│       ├── vtkParser.ts      # VTK legacy
│       ├── stlParser.ts      # STL ASCII+binary
│       └── parserUtils.ts    # shared validation / fail-fast helpers
├── media/
│   └── viewer.ts             # Three.js 場景 + OrbitControls + UI
├── package.json
├── tsconfig.json
├── webpack.config.js
└── .vscode/launch.json
```

---

### Verification
1. `npm run build` — webpack 無錯誤
2. F5 啟動 Extension Development Host
3. 開啟 `Bellows_hex.mesh` 或 `Bellows_hex.inp` → 顯示波紋管(bellows)六面體網格
4. 滑鼠左鍵拖動旋轉、滾輪縮放、右鍵平移
5. 色彩選擇器改變網格顏色
6. 切換 surface/full-mesh wireframe 與 solid 組合模式
7. 拖動 `Shell Opacity` 驗證外殼透明度即時更新
8. 開啟故意損壞的測試檔時，webview 應顯示 parse error，而不是卡住或閃退

### Key Decisions
- **CustomReadonlyEditorProvider** — 純瀏覽器，不需 save/undo/redo
- **Boundary face extraction** — 體積元素只渲染外表面（避免 z-fighting 和效能問題）。方法：對每個元素面做 sorted vertex-index hash，只出現一次的面即為邊界面
- **Boundary face orientation fix** — 抽出的 boundary faces 依 cell center 校正 outward winding，避免 front-face culling 導致缺面
- **解析在 extension host 端** — 利用 Node.js Buffer API，webview 只負責渲染
- **顯示層分離** — surface edges 與 full mesh edges 分開建構，避免固體模式與完整內部線框互相干擾
- **Fail-fast parser validation** — 對不合理 count、截斷記錄、非法數值與越界 index 立即報錯，避免 extension host 被壞檔案拖垮
- **支援元素類型**：hex(六面體)、tet(四面體)、triangle(三角形)、quadrilateral(四邊形) 優先
- **Scope**：唯讀瀏覽器，不含網格編輯或產生功能

### Further Considerations
1. **大型網格效能**：測試檔 41K 頂點較小。若需支援 >1M 元素，可考慮 web worker 解析。建議先不優化。
2. **Binary 格式**：`.stl` binary 已支援；`.msh`/`.vtk` binary 可後續加入。
3. **混合元素**：實際網格可能有 prism、pyramid、beam 等；目前 `.inp` 中不支援的元素會略過。
4. **錯誤 UX**：之後可補更友善的錯誤訊息，例如列出 `.inp` 中被忽略的不支援元素類型。
