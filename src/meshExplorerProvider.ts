import * as vscode from 'vscode';
import * as path from 'path';

interface MeshItem {
  uri: vscode.Uri;
}

export class MeshExplorerProvider implements vscode.TreeDataProvider<MeshItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(context: vscode.ExtensionContext) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{mesh,msh,inp,vtk,stl}');
    context.subscriptions.push(
      watcher,
      watcher.onDidCreate(() => this._onDidChangeTreeData.fire()),
      watcher.onDidDelete(() => this._onDidChangeTreeData.fire())
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MeshItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      path.basename(element.uri.fsPath),
      vscode.TreeItemCollapsibleState.None
    );
    item.resourceUri = element.uri;
    item.command = {
      command: 'vscode.openWith',
      title: 'Open in Mesh Viewer',
      arguments: [element.uri, 'meshViewer.view']
    };
    item.iconPath = new vscode.ThemeIcon('circuit-board');
    item.tooltip   = element.uri.fsPath;
    item.description = vscode.workspace.asRelativePath(
      vscode.Uri.file(path.dirname(element.uri.fsPath))
    );
    return item;
  }

  async getChildren(): Promise<MeshItem[]> {
    const results = await vscode.workspace.findFiles('**/*.{mesh,msh,inp,vtk,stl}', '**/node_modules/**');
    return results
      .sort((a, b) => a.fsPath.localeCompare(b.fsPath))
      .map(uri => ({ uri }));
  }
}
