import { validate } from './validate';
import { ValidateOptions } from '@snippet-engine-control/app';

export function lint(options: ValidateOptions = {}) {
  // Lint is an alias for validate
  validate(options);
}
