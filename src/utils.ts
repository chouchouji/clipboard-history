import type { History } from './types';

export function deduplicateClipboardHistory(historyList: History[]) {
  if (!historyList.length) {
    return historyList;
  }
  const res = [];
  const set = new Set();

  for (const history of historyList) {
    if (set.has(history.text)) {
      continue;
    }

    res.push(history);
    set.add(history.text);
  }

  return res;
}
