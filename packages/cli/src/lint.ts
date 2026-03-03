import { validate } from './validate';

export function lint(inputPath?: string) {
  // Lint is an alias for validate
  validate(inputPath);
}
