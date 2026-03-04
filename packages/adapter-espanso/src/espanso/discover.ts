import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// discover.ts - find config dirs
export function discoverDirs(): string[] {
  const dirs: string[] = [];

  const addIfDir = (p: string) => {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        dirs.push(p);
      }
    } catch (e) {
      // ignore
    }
  };

  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'linux') {
    const xdgConfigHome = process.env.XDG_CONFIG_HOME;
    if (xdgConfigHome) {
      addIfDir(path.join(xdgConfigHome, 'espanso'));
    }
    addIfDir(path.join(home, '.config', 'espanso'));
  } else if (platform === 'darwin') {
    addIfDir(path.join(home, 'Library', 'Application Support', 'espanso'));
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      addIfDir(path.join(appData, 'espanso'));
    }
  }

  // Deduplicate dirs
  return Array.from(new Set(dirs.map(d => path.resolve(d))));
}
