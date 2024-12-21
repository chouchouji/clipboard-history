import * as vscode from 'vscode';
import type { History } from './types';
import ClipboardWatcher from './watch';

const clipboardWatcher = new ClipboardWatcher();

export function activate(context: vscode.ExtensionContext) {
  const workspaceName = vscode.workspace.name;
  if (!workspaceName) {
    return;
  }

  clipboardWatcher.watchClipboard(async (clipboardText: string) => {
    const historyList =
      context.workspaceState.get<History[]>(workspaceName) ?? [];
    historyList.unshift({ text: clipboardText });
    await context.workspaceState.update(workspaceName, historyList);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'clipboard-history.openClipboardHistory',
      async () => {
        const historyList =
          context.workspaceState.get<History[]>(workspaceName) ?? [];
        if (!historyList.length) {
          vscode.window.showWarningMessage(
            vscode.l10n.t('No any content to select'),
          );
          return;
        }

        const activeTextEditor = vscode.window.activeTextEditor;
        if (!activeTextEditor) {
          vscode.window.showInformationMessage('No active editor found!');
          return;
        }

        const selectedText = await vscode.window.showQuickPick(
          historyList.map((history) => history.text),
          {
            placeHolder: vscode.l10n.t('Please choose one to paste'),
          },
        );
        // cancel select text
        if (selectedText === undefined) {
          return;
        }

        const cursorPosition = activeTextEditor.selection.active;
        activeTextEditor.edit((editBuilder) => {
          editBuilder.insert(cursorPosition, selectedText);
        });
      },
    ),
  );
}

export function deactivate() {
  clipboardWatcher.unwatchClipboard();
}
