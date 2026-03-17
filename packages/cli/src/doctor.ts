import { health } from '@snippet-engine-control/adapter-espanso';

export interface DoctorOptions {
  engine?: string;
  dir?: string;
}

export function doctor(options: DoctorOptions) {
  console.log('Running doctor checks...');

  if (!options.engine || options.engine === 'espanso') {
    const result = health(options.dir);
    console.log(`[Espanso] Status: ${result.status}`);
    if (result.message) {
      console.log(`[Espanso] Message: ${result.message}`);
    }

    if (result.status === 'error') {
      process.exit(1);
    }
  } else {
    console.log(`[${options.engine}] Health check not supported for this engine.`);
  }

  process.exit(0);
}
