import { health, runDoctor } from '@snippet-engine-control/adapter-espanso';

export interface DoctorOptions {
  engine?: string;
  dir?: string;
}

export function doctor(options: DoctorOptions = {}) {
  console.log('Running doctor checks...');

  if (!options.engine || options.engine === 'espanso') {
    // 1. Check configuration structure
    const configResult = health(options.dir);
    console.log(`[Espanso Config] Status: ${configResult.status}`);
    if (configResult.message) {
      console.log(`[Espanso Config] Message: ${configResult.message}`);
    }

    if (configResult.status === 'error' || configResult.status === 'unknown') {
      console.error(`[Espanso Config] Health check failed with status: ${configResult.status}`);
      process.exit(1);
    }

    // 2. Check actual daemon/runtime health (the 'doctor' step)
    const runtimeResult = runDoctor();
    console.log(`[Espanso Runtime] Status: ${runtimeResult.status}`);
    if (runtimeResult.message) {
      console.log(`[Espanso Runtime] Message: ${runtimeResult.message}`);
    }

    if (runtimeResult.status === 'error' || runtimeResult.status === 'unknown') {
      console.error(`[Espanso Runtime] Health check failed with status: ${runtimeResult.status}`);
      process.exit(1);
    }

  } else {
    console.log(`[${options.engine}] Health check not supported for this engine.`);
  }

  process.exit(0);
}
