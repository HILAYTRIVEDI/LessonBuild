import { extractText as unpdfExtract, getDocumentProxy } from "unpdf";

/**
 * Extracts merged, trimmed text from a PDF byte buffer.
 *
 * @param data PDF bytes from the uploaded file.
 * @return Trimmed text merged across all PDF pages.
 */
export async function extractText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await unpdfExtract(pdf, { mergePages: true });
  return text.trim();
}
