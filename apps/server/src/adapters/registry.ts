import type { SourceAdapter } from './types.js';
import { gutenbergAdapter } from './gutenberg.js';
import { standardEbooksAdapter } from './standardEbooks.js';

export const enabledAdapters: SourceAdapter[] = [gutenbergAdapter, standardEbooksAdapter];
