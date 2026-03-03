#!/usr/bin/env node

import { validate } from './validate';
import { exportPlan } from './export';
import { apply } from './apply';
import { doctor } from './doctor';
import { lint } from './lint';

const args = process.argv.slice(2);
const command = args[0];

// Parse simple --input <path>
let inputPath: string | undefined = process.env.SEC_SNIPPETS;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--input' && i + 1 < args.length) {
    inputPath = args[i + 1];
    break;
  }
}

switch (command) {
  case 'validate':
    validate(inputPath);
    break;
  case 'export':
    exportPlan(inputPath);
    break;
  case 'apply':
    apply();
    break;
  case 'doctor':
    doctor();
    break;
  case 'lint':
    lint(inputPath);
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
