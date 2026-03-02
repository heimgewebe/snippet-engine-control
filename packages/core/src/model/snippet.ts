export interface Snippet {
  id: string;
  triggers: string[];
  body: string;
  constraints?: {
    wordBoundary?: boolean;
    appInclude?: string[];
    appExclude?: string[];
    localeHints?: string[];
  };
  tags?: string[];
  origin?: {
    source: string;
    path: string;
  };
}
