const DEFAULT_CHUNK_CHARS = 6_000;
const DEFAULT_OVERLAP_CHARS = 600;

/** Ordered text slice used for retrieval after PDF upload. */
export interface TextChunk {
  ord: number;
  content: string;
}

/** Tunables for chunk size and overlap during source-text indexing. */
export interface ChunkTextOptions {
  chunkChars?: number;
  overlapChars?: number;
}

/**
 * Splits normalized PDF text into overlapping chunks, preferring sentence or
 * paragraph boundaries near the target size when possible.
 */
export function chunkText(text: string, options: ChunkTextOptions = {}): TextChunk[] {
  const chunkChars = options.chunkChars ?? DEFAULT_CHUNK_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  if (chunkChars <= 0) throw new Error("chunkChars must be positive");
  if (overlapChars < 0) throw new Error("overlapChars must be non-negative");
  if (overlapChars >= chunkChars) throw new Error("overlapChars must be smaller than chunkChars");

  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < normalized.length) {
    const hardEnd = Math.min(start + chunkChars, normalized.length);
    let end = hardEnd;
    if (hardEnd < normalized.length) {
      const sentenceEnd = normalized.lastIndexOf(". ", hardEnd);
      const paragraphEnd = normalized.lastIndexOf("\n\n", hardEnd);
      const softEnd = Math.max(sentenceEnd, paragraphEnd);
      if (softEnd > start + Math.floor(chunkChars * 0.6)) {
        end = softEnd + (softEnd === sentenceEnd ? 1 : 0);
      }
    }

    const content = normalized.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({ ord: chunks.length, content });
    }
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlapChars);
  }
  return chunks;
}
