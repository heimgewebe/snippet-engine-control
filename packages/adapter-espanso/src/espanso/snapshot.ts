import * as fs from 'fs';
import * as path from 'path';
import { discoverDirs } from './discover';

export function createSnapshot(targetDir?: string): string {
  const dirs = targetDir ? [targetDir] : discoverDirs();
  if (dirs.length === 0) {
    throw new Error('Cannot create snapshot: target directory not found.');
  }

  const matchDir = path.join(dirs[0], 'match');
  const snapshotDir = path.join(dirs[0], '.sec-snapshots');

  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
    if (process.platform !== 'win32') {
      fs.chmodSync(snapshotDir, 0o700);
    }
  }

  const targetFile = path.join(matchDir, 'sec.generated.yml');
  const timestamp = Date.now().toString();
  const snapshotFile = path.join(snapshotDir, `sec.generated.snapshot.${timestamp}.yml`);

  if (fs.existsSync(targetFile)) {
    fs.copyFileSync(targetFile, snapshotFile);
  } else {
    // Empty file to indicate it didn't exist
    fs.writeFileSync(snapshotFile, '');
  }

  return snapshotFile;
}

export function restoreSnapshot(snapshotId: string, targetDir?: string): void {
  if (!fs.existsSync(snapshotId)) {
    throw new Error(`Snapshot not found: ${snapshotId}`);
  }

  const dirs = targetDir ? [targetDir] : discoverDirs();
  if (dirs.length === 0) {
    throw new Error('Cannot restore snapshot: target directory not found.');
  }

  const matchDir = path.join(dirs[0], 'match');
  const targetFile = path.join(matchDir, 'sec.generated.yml');

  const content = fs.readFileSync(snapshotId, 'utf8');
  if (content === '') {
    if (fs.existsSync(targetFile)) {
      fs.rmSync(targetFile, { force: true });
    }
  } else {
    fs.copyFileSync(snapshotId, targetFile);
  }
}

/**
 * Rolls back the configuration to the most recent snapshot.
 *
 * Note (MVP): This currently resolves the "latest" snapshot purely by
 * lexically sorting the snapshot files (which include a timestamp).
 * There is currently no strict metadata binding tracking which snapshot
 * corresponds to a specific Apply ID.
 */
export function rollbackLatestSnapshot(targetDir?: string): boolean {
  const dirs = targetDir ? [targetDir] : discoverDirs();
  if (dirs.length === 0) {
    throw new Error('Cannot rollback: target directory not found.');
  }

  const snapshotDir = path.join(dirs[0], '.sec-snapshots');
  if (!fs.existsSync(snapshotDir)) {
    return false;
  }

  const files = fs.readdirSync(snapshotDir);
  const snapshots = files
    .filter(f => f.startsWith('sec.generated.snapshot.') && f.endsWith('.yml'))
    .sort()
    .reverse();

  if (snapshots.length === 0) {
    return false;
  }

  const latestSnapshot = path.join(snapshotDir, snapshots[0]);
  restoreSnapshot(latestSnapshot, targetDir);
  return true;
}
