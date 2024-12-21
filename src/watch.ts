import * as vscode from 'vscode';

export default class ClipboardWatcher {
  private interval: number;
  private lastClipboardText: string | undefined = undefined;
  private intervalId: NodeJS.Timeout | string | number | undefined = undefined;

  constructor(interval = 500) {
    this.interval = interval;
  }

  watchClipboard(cb: (clipboardText: string) => Promise<void>) {
    this.intervalId = setInterval(async () => {
      try {
        const clipboardText = await vscode.env.clipboard.readText();

        if (clipboardText !== this.lastClipboardText) {
          this.lastClipboardText = clipboardText;
          await cb(clipboardText);
        }
      } catch (error) {
        vscode.window.showErrorMessage('Read clipboard text error');
      }
    }, this.interval);
  }

  unwatchClipboard() {
    clearInterval(this.intervalId);
  }
}
