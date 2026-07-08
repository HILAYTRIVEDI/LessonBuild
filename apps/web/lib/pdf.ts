import { extractText as unpdfExtract, getDocumentProxy } from "unpdf";

export async function extractText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await unpdfExtract(pdf, { mergePages: true });
  return text.trim();
}
