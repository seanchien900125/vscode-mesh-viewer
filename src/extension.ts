import * as vscode from 'vscode';
import { MeshEditorProvider } from './meshEditorProvider';
import { MeshExplorerProvider } from './meshExplorerProvider';

export function activate(context: vscode.ExtensionContext): void {
  // Custom editor for mesh files
  context.subscriptions.push(MeshEditorProvider.register(context));

  // Sidebar file explorer
  const explorer = new MeshExplorerProvider(context);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('meshViewer.explorer', explorer),
    vscode.commands.registerCommand('meshViewer.refresh', () => explorer.refresh()),
    vscode.commands.registerCommand('meshViewer.openFile', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'Mesh Files': ['mesh', 'msh', 'inp', 'vtk', 'stl'] },
        title: 'Open Mesh File'
      });
      if (uris && uris.length > 0) {
        await vscode.commands.executeCommand('vscode.openWith', uris[0], 'meshViewer.view');
      }
    })
  );
}

export function deactivate(): void {
  // nothing to clean up
}
