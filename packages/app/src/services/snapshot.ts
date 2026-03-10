import { EngineSnapshotPort } from '../ports/engine';

export class SnapshotService {
  constructor(private snapshotPort: EngineSnapshotPort) {}

  /**
   * Creates a pre-apply snapshot.
   */
  public createSnapshot(): string {
    return this.snapshotPort.createSnapshot();
  }

  /**
   * Restores the latest apply from a snapshot.
   */
  public restoreSnapshot(snapshotId: string): void {
    this.snapshotPort.restoreSnapshot(snapshotId);
  }

  /**
   * Rolls back the last apply operation if a snapshot exists.
   */
  public rollbackLatestSnapshot(): boolean {
    return this.snapshotPort.rollbackLatestSnapshot();
  }
}
