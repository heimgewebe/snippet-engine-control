import { rollbackLatestSnapshot } from '@snippet-engine-control/adapter-espanso';

export function rollback(options: { dir?: string }) {
  try {
    const success = rollbackLatestSnapshot(options.dir);
    if (success) {
      console.log('Successfully rolled back to the latest snapshot.');
    } else {
      console.log('No snapshot found to roll back.');
    }
  } catch (err: any) {
    console.error(`Failed to rollback: ${err.message}`);
    process.exit(1);
  }
}
