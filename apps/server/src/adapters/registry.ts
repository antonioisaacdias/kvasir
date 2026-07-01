import type { SourceAdapter } from './types';
import { gutenbergAdapter } from './gutenberg';
import { standardEbooksAdapter } from './standardEbooks';

export const enabledAdapters: SourceAdapter[] = [gutenbergAdapter, standardEbooksAdapter];
