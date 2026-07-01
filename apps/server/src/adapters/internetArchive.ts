import type { SearchResult, SourceAdapter } from './types.js';

const LANGUAGE_MAP: Record<string, string> = {
  por: 'pt',
  eng: 'en',
  spa: 'es',
  fre: 'fr',
  fra: 'fr',
  ger: 'de',
  deu: 'de',
  ita: 'it',
};

interface IADoc {
  identifier: string;
  title: string;
  creator?: string | string[];
  language?: string;
  subject?: string | string[];
}

interface IASearchResponse {
  response: { docs: IADoc[] };
}

interface IAFile {
  name: string;
  format: string;
}

interface IAMetadata {
  files: IAFile[];
  metadata?: {
    'access-restricted-item'?: string | boolean;
  };
}

function isAccessRestricted(meta: IAMetadata): boolean {
  const flag = meta.metadata?.['access-restricted-item'];
  return flag === true || flag === 'true';
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeLanguage(lang?: string): string | undefined {
  if (!lang) return undefined;
  const lower = lang.toLowerCase();
  if (LANGUAGE_MAP[lower]) return LANGUAGE_MAP[lower];
  if (/^[a-z]{2}$/.test(lower)) return lower;
  return undefined;
}

function searchUrl(query: string): string {
  const q = `(${query}) AND mediatype:texts AND licenseurl:*publicdomain* AND -access-restricted-item:true`;
  return `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl=identifier,title,creator,language,subject&rows=20&output=json`;
}

export const internetArchiveAdapter: SourceAdapter = {
  id: 'internet-archive',

  async search(query, fetchFn = fetch) {
    const res = await fetchFn(searchUrl(query));
    const body = (await res.json()) as IASearchResponse;
    return body.response.docs.map((doc): SearchResult => {
      const subjects = asArray(doc.subject);
      return {
        source: 'internet-archive',
        externalId: doc.identifier,
        title: doc.title,
        author: asArray(doc.creator)[0],
        language: normalizeLanguage(doc.language),
        subjects: subjects.length > 0 ? subjects : undefined,
        coverUrl: `https://archive.org/services/img/${doc.identifier}`,
      };
    });
  },

  async download(externalId, fetchFn = fetch, signal = undefined) {
    const metaRes = await fetchFn(`https://archive.org/metadata/${externalId}`, { signal });
    const meta = (await metaRes.json()) as IAMetadata;
    if (isAccessRestricted(meta)) {
      throw new Error(`internet-archive item ${externalId} is access-restricted, refusing to download`);
    }
    const epubFile = meta.files?.find((f) => f.format === 'EPUB');
    if (!epubFile) {
      throw new Error(`no epub format available for internet-archive item ${externalId}`);
    }
    const fileUrl = `https://archive.org/download/${externalId}/${encodeURIComponent(epubFile.name)}`;
    const fileRes = await fetchFn(fileUrl, { signal });
    if (!fileRes.ok) {
      throw new Error(`internet-archive download failed for ${externalId}: HTTP ${fileRes.status}`);
    }
    if (!fileRes.body) {
      throw new Error(`empty response body downloading internet-archive item ${externalId}`);
    }
    const contentLength = fileRes.headers.get('content-length');
    return { stream: fileRes.body, totalBytes: contentLength ? Number(contentLength) : null };
  },
};
