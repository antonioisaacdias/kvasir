import type { SourceAdapter } from './types.js';
import { gutenbergAdapter } from './gutenberg.js';
import { standardEbooksAdapter } from './standardEbooks.js';
import { internetArchiveAdapter } from './internetArchive.js';

export const enabledAdapters: SourceAdapter[] = [gutenbergAdapter, standardEbooksAdapter, internetArchiveAdapter];
