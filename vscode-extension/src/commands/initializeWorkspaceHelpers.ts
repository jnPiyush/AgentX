import * as fs from 'fs';
import * as vscode from 'vscode';

export async function promptWorkspaceRoot(title: string): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0].uri.fsPath;
  }

  const pick = await vscode.window.showQuickPick(
    folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
    { placeHolder: 'Select workspace folder', title },
  );

  return pick?.folder.uri.fsPath;
}

export function readJsonWithComments<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(raw) as T;
    } catch {
      let stripped = '';
      let inStr = false;
      let esc = false;
      for (let index = 0; index < raw.length; index++) {
        const char = raw[index];
        if (esc) {
          stripped += char;
          esc = false;
          continue;
        }
        if (inStr) {
          if (char === '\\') {
            esc = true;
          } else if (char === '"') {
            inStr = false;
          }
          stripped += char;
          continue;
        }
        if (char === '"') {
          inStr = true;
          stripped += char;
          continue;
        }
        if (char === '/' && raw[index + 1] === '/') {
          while (index < raw.length && raw[index] !== '\n') {
            index++;
          }
          continue;
        }
        if (char === '/' && raw[index + 1] === '*') {
          index += 2;
          while (index < raw.length && !(raw[index] === '*' && raw[index + 1] === '/')) {
            index++;
          }
          index++;
          continue;
        }
        stripped += char;
      }
      return JSON.parse(stripped) as T;
    }
  } catch {
    return undefined;
  }
}
