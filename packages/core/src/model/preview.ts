import { Snippet } from './snippet';

export interface PreviewContext {
  activeApp?: string;
  clipboardText?: string;
  currentDate?: string;
  // Optional engine-specific context
  engineTarget?: string;
}

export interface PreviewResult {
  text: string;
  isTemplate: boolean;
  warnings?: string[];
  // If we can trace how it was expanded
  trace?: string[];
}
