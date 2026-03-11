#!/usr/bin/env node

import { validate } from './validate';
import { exportPlan } from './export';
import { apply } from './apply';
import { rollback } from './rollback';
import { doctor } from './doctor';
import { lint } from './lint';
import { startDaemon } from './daemon';

const args = process.argv.slice(2);
const command = args[0];

// Parse simple options
let inputPath: string | undefined = process.env.SEC_SNIPPETS;
let engine: string | undefined;
let dir: string | undefined;
let isDryRun = true;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--input' && i + 1 < args.length) {
    inputPath = args[i + 1];
    i++;
  } else if (args[i] === '--engine' && i + 1 < args.length) {
    engine = args[i + 1];
    i++;
  } else if (args[i] === '--espanso') {
    engine = 'espanso';
  } else if (args[i] === '--dir' && i + 1 < args.length) {
    dir = args[i + 1];
    i++;
  } else if (args[i] === '--yes') {
    isDryRun = false;
  }
}

switch (command) {
  case 'validate':
    validate({ inputPath, engine, dir });
    break;
  case 'export':
    exportPlan({ inputPath, engine, dir });
    break;
  case 'apply':
    apply({ inputPath, engine, dir, isDryRun });
    break;
  case 'rollback':
    rollback({ dir });
    break;
  case 'doctor':
    doctor();
    break;
  case 'lint':
    lint(inputPath);
    break;
  case 'ui':
  case 'daemon':
    let host = '127.0.0.1';
    let allowLan = false;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--host') {
        if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
          console.error(`Error: --host requires a value.`);
          console.error(`Usage: sec ui [--host <ip>] [--allow-lan]`);
          process.exit(2);
        }
        host = args[i + 1];
        i++;
      } else if (args[i] === '--allow-lan') {
        allowLan = true;
      }
    }
    startDaemon(4000, { dir, host, allowLan });
    break;
  case undefined:
  case 'help':
    console.log(`
Usage: sec <command>

Commands:
  ui         Start the Snippet Editing Platform UI (daemon)
  validate   Validate IR and engine constraints
  export     Show diffable export plan (dry-run)
  apply      Write and apply snippets
  rollback   Revert to the last pre-apply snapshot
  doctor     Run common failure mode checks
  lint       Check for conflicts and boundary risks
`);
    process.exit(0);
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
