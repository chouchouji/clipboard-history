import * as vscode from 'vscode';

export default class ClipboardWatcher {
  private interval = 500;
  private lastClipboardText: string | undefined = undefined;
  private intervalId: NodeJS.Timeout | string | number | undefined = undefined;

  setInterval(interval: number) {
    this.interval = interval;
  }

  watchClipboard(cb: (clipboardText: string) => Promise<void>) {
    this.intervalId = setInterval(async () => {
      try {
        const clipboardText = await vscode.env.clipboard.readText();

        if (clipboardText && clipboardText !== this.lastClipboardText) {
          this.lastClipboardText = clipboardText;
          await cb(clipboardText);
        }
      } catch (error) {
        // ignore error
      }
    }, this.interval);
  }

  unwatchClipboard() {
    clearInterval(this.intervalId);
  }
}
