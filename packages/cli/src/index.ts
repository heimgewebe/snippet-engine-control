#!/usr/bin/env node

import { validate } from './validate';
import { exportPlan } from './export';
import { apply } from './apply';
import { doctor } from './doctor';
import { lint } from './lint';

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'validate':
    validate();
    break;
  case 'export':
    exportPlan();
    break;
  case 'apply':
    apply();
    break;
  case 'doctor':
    doctor();
    break;
  case 'lint':
    lint();
    break;
  case undefined:
  case 'help':
    console.log(`
Usage: sec <command>

Commands:
  validate   Validate IR and engine constraints
  export     Show diffable export plan (dry-run)
  apply      Write and apply snippets
  doctor     Run common failure mode checks
  lint       Check for conflicts and boundary risks
`);
    process.exit(0);
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
