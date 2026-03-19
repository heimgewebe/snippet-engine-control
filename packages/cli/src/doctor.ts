import { health, runDoctor } from '@snippet-engine-control/adapter-espanso';

export interface DoctorOptions {
  engine?: string;
  dir?: string;
}

export interface DoctorDependencies {
  health: typeof health;
  runDoctor: typeof runDoctor;
}

const defaultDependencies: DoctorDependencies = {
  health,
  runDoctor,
};

export function doctorInternal(options: DoctorOptions = {}, deps: DoctorDependencies = defaultDependencies): number {
  console.log('Running doctor checks...');

  if (!options.engine || options.engine === 'espanso') {
    // 1. Check configuration structure
    const configResult = deps.health(options.dir);
    console.log(`[Espanso Config] Status: ${configResult.status}`);
    if (configResult.message) {
      console.log(`[Espanso Config] Message: ${configResult.message}`);
    }

    if (configResult.status === 'error' || configResult.status === 'unknown') {
      console.error(`[Espanso Config] Health check failed with status: ${configResult.status}`);
      return 1;
    }

    // 2. Check actual daemon/runtime health (the 'doctor' step)
    const runtimeResult = deps.runDoctor();
    console.log(`[Espanso Runtime] Status: ${runtimeResult.status}`);
    if (runtimeResult.message) {
      console.log(`[Espanso Runtime] Message: ${runtimeResult.message}`);
    }

    if (runtimeResult.status === 'error' || runtimeResult.status === 'unknown') {
      console.error(`[Espanso Runtime] Health check failed with status: ${runtimeResult.status}`);
      return 1;
    }

  } else {
    console.log(`[${options.engine}] Health check not supported for this engine.`);
  }

  return 0;
}

export function doctor(options: DoctorOptions = {}, deps: DoctorDependencies = defaultDependencies) {
  const code = doctorInternal(options, deps);
  process.exit(code);
}
