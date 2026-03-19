import * as vscode from 'vscode';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { encodeParsedMesh } from './meshDataTransfer';
import { parseMeshFileBuffer } from './parsers/parseMeshFile';
import { ParsedMesh } from './parsers/types';

const MAX_MESH_FILE_BYTES = 512 * 1024 * 1024;

export class MeshEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'meshViewer.view';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      MeshEditorProvider.viewType,
      new MeshEditorProvider(context),
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { retainContextWhenHidden: true }
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose(): void { /* nothing */ } };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist')
      ]
    };

    let initialDataSent = false;
    const postInitialMeshData = async (): Promise<void> => {
      if (initialDataSent) {
        return;
      }

      initialDataSent = true;

      void webviewPanel.webview.postMessage({
        type: 'status',
        message: 'Parsing mesh file...'
      });

      try {
        const meshData = await this.parseMeshFile(document.uri, token);
        await webviewPanel.webview.postMessage({ type: 'meshData', data: encodeParsedMesh(meshData) });
      } catch (err) {
        await webviewPanel.webview.postMessage({
          type: 'error',
          message: String(err)
        });
      }
    };

    const messageListener = webviewPanel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'ready') {
        void postInitialMeshData();
      }
    });

    webviewPanel.onDidDispose(() => {
      messageListener.dispose();
    });

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
  }

  private async parseMeshFile(uri: vscode.Uri, token: vscode.CancellationToken): Promise<ParsedMesh> {
    if (token.isCancellationRequested) {
      throw new Error('Mesh loading was cancelled');
    }

    const fileStat = await vscode.workspace.fs.stat(uri);
    if (fileStat.size > MAX_MESH_FILE_BYTES) {
      const sizeInMiB = (fileStat.size / (1024 * 1024)).toFixed(1);
      throw new Error(`Mesh file is too large to load safely (${sizeInMiB} MiB)`);
    }

    if (token.isCancellationRequested) {
      throw new Error('Mesh loading was cancelled');
    }

    const buffer = Buffer.from(await vscode.workspace.fs.readFile(uri));

    if (token.isCancellationRequested) {
      throw new Error('Mesh loading was cancelled');
    }

    return parseMeshFileBuffer(uri.fsPath, buffer);
  }

  private getNonce(): string {
    return randomBytes(16).toString('hex');
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'viewer.js')
    );
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             img-src ${webview.cspSource} blob:;
             script-src ${webview.cspSource} 'nonce-${nonce}';
             style-src 'unsafe-inline';">
  <title>Mesh Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #1e1e1e; }
    canvas { display: block; }
    #ui {
      position: fixed;
      top: 12px;
      left: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: rgba(30,30,30,0.85);
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.15);
      font-family: monospace;
      font-size: 13px;
      color: #ccc;
      z-index: 10;
    }
    #ui label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    #ui .stacked-label {
      align-items: flex-start;
      flex-direction: column;
      cursor: default;
      gap: 4px;
    }
    #ui .inline-row {
      align-items: center;
      display: flex;
      gap: 8px;
      justify-content: space-between;
      width: 100%;
    }
    #ui select, #ui input[type=color] {
      background: #2d2d2d;
      border: 1px solid #555;
      color: #ccc;
      border-radius: 3px;
      padding: 2px 4px;
      cursor: pointer;
    }
    #ui input[type=range] {
      width: 180px;
      cursor: pointer;
    }
    #status {
      position: fixed;
      bottom: 12px;
      left: 12px;
      font-family: monospace;
      font-size: 12px;
      color: #888;
      z-index: 10;
    }
    #error {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #c0392b;
      color: white;
      padding: 16px 24px;
      border-radius: 6px;
      font-family: monospace;
      display: none;
      z-index: 20;
    }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div id="ui">
    <label>
      Mode:
      <select id="modeSelect">
        <option value="solid">Solid</option>
        <option value="surface-wireframe">Surface Wireframe</option>
        <option value="mesh-wireframe">Mesh Wireframe</option>
        <option value="solid+surface-wireframe" selected>Solid + Surface Wireframe</option>
        <option value="solid+mesh-wireframe">Solid + Mesh Wireframe</option>
      </select>
    </label>
    <label>
      Color:
      <input type="color" id="colorPicker" value="#4a90d9">
    </label>
    <label class="stacked-label">
      <span class="inline-row">
        <span>Shell Opacity</span>
        <span id="opacityValue">90%</span>
      </span>
      <input type="range" id="opacitySlider" min="0.05" max="1" step="0.05" value="0.9">
    </label>
  </div>
  <div id="status">Loading...</div>
  <div id="error"></div>
  <script nonce="${nonce}">
    window.addEventListener('error', (event) => {
      const status = document.getElementById('status');
      const error = document.getElementById('error');
      if (status) {
        status.textContent = 'Failed to load';
      }
      if (error) {
        error.textContent = 'Error: ' + (event.message || 'Unknown webview error');
        error.style.display = 'block';
      }
    });
    window.addEventListener('unhandledrejection', (event) => {
      const status = document.getElementById('status');
      const error = document.getElementById('error');
      if (status) {
        status.textContent = 'Failed to load';
      }
      if (error) {
        const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
        error.textContent = 'Error: ' + reason;
        error.style.display = 'block';
      }
    });
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
