import * as vscode from 'vscode';
import type { History } from './types';
import { deduplicateClipboardHistory } from './utils';
import ClipboardWatcher from './watch';

const clipboardWatcher = new ClipboardWatcher();

let completionProvider: vscode.Disposable | undefined;

function registerCompletionProvider(
  context: vscode.ExtensionContext,
  triggerCharacter: string,
  workspaceName: string,
) {
  if (completionProvider) {
    completionProvider.dispose();
  }

  completionProvider = vscode.languages.registerCompletionItemProvider(
    '*',
    {
      provideCompletionItems(
        _document: vscode.TextDocument,
        position: vscode.Position,
      ) {
        const prevPosition: vscode.Position = new vscode.Position(
          Math.max(position.line, 0),
          Math.max(position.character - triggerCharacter.length, 0),
        );

        const historyList =
          context.workspaceState.get<History[]>(workspaceName) ?? [];
        if (!historyList.length) {
          vscode.window.showWarningMessage(
            vscode.l10n.t('No any content to select'),
          );
          return;
        }

        const completeItems: vscode.CompletionItem[] = historyList.map(
          ({ text }, index) => ({
            label: text,
            kind: vscode.CompletionItemKind.Method,
            sortText: `${index}`,
            additionalTextEdits: [
              vscode.TextEdit.delete(new vscode.Range(prevPosition, position)),
            ],
          }),
        );
        return completeItems;
      },
    },
    triggerCharacter,
  );

  context.subscriptions.push(completionProvider);
}

export function activate(context: vscode.ExtensionContext) {
  const workspaceName = vscode.workspace.name;
  if (!workspaceName) {
    vscode.window.showWarningMessage(
      vscode.l10n.t('No any applicable workspace name'),
    );
    return;
  }

  let triggerCharacter = '%';
  let completionItemCount = 10;

  clipboardWatcher.watchClipboard(async (clipboardText: string) => {
    const historyStack =
      context.workspaceState.get<History[]>(workspaceName) ?? [];
    historyStack.unshift({ text: clipboardText });

    if (historyStack.length > completionItemCount) {
      while (historyStack.length > completionItemCount) {
        historyStack.pop();
      }
    }

    await context.workspaceState.update(
      workspaceName,
      deduplicateClipboardHistory(historyStack),
    );
  });

  registerCompletionProvider(context, triggerCharacter, workspaceName);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('clipboard-history.completionItemCount')) {
        const defaultCompletionItemCount = vscode.workspace
          .getConfiguration('clipboard-history')
          .get<number>('completionItemCount');
        if (defaultCompletionItemCount) {
          completionItemCount = defaultCompletionItemCount;
        }

        const historyStack =
          context.workspaceState.get<History[]>(workspaceName) ?? [];
        if (historyStack.length > completionItemCount) {
          while (historyStack.length > completionItemCount) {
            historyStack.pop();
          }

          await context.workspaceState.update(
            workspaceName,
            deduplicateClipboardHistory(historyStack),
          );
        }
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('clipboard-history.pollingInterval')) {
        const pollingInterval = vscode.workspace
          .getConfiguration('clipboard-history')
          .get<number>('pollingInterval');
        if (pollingInterval) {
          clipboardWatcher.setInterval(pollingInterval);
        }
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('clipboard-history.triggerCharacter')) {
        const defaultTriggerCharacter = vscode.workspace
          .getConfiguration('clipboard-history')
          .get<string>('triggerCharacter');
        if (defaultTriggerCharacter) {
          triggerCharacter = defaultTriggerCharacter;
          registerCompletionProvider(context, triggerCharacter, workspaceName);
        }
      }
    }),
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
          vscode.window.showInformationMessage(
            vscode.l10n.t('No active editor found'),
          );
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
    vscode.commands.registerCommand(
      'clipboard-history.clearClipboardHistory',
      async () => {
        const historyList =
          context.workspaceState.get<History[]>(workspaceName) ?? [];
        if (!historyList.length) {
          vscode.window.showWarningMessage(
            vscode.l10n.t('No any content to select'),
          );
          return;
        }

        const selectedTexts = await vscode.window.showQuickPick(
          historyList.map((history) => history.text),
          {
            placeHolder: vscode.l10n.t('Please choose one or more to delete'),
            canPickMany: true,
          },
        );
        // cancel select texts
        if (selectedTexts === undefined) {
          return;
        }

        const restHistoryList = historyList.filter(
          ({ text }) => !selectedTexts.includes(text),
        );
        await context.workspaceState.update(
          workspaceName,
          deduplicateClipboardHistory(restHistoryList),
        );
      },
    ),
  );
}

export function deactivate() {
  clipboardWatcher.unwatchClipboard();
}
