/**
 * Zero-Timeout In-Browser Document Parser
 * Parses PDF, DOCX, and TXT directly on the student's browser.
 * Bypasses Vercel 4.5MB payload limits and eliminates server processing timeouts.
 */
import mammoth from 'mammoth';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/**
 * Split text into semantic chunks with overlap
 * @param {string} text Raw text
 * @param {number} chunkSize Max chars per chunk
 * @param {number} chunkOverlap Overlap between chunks
 * @returns {string[]}
 */
export function chunkText(text, chunkSize = CHUNK_SIZE, chunkOverlap = CHUNK_OVERLAP) {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const chunks = [];
  let startIndex = 0;

  while (startIndex < normalized.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex < normalized.length) {
      // Find a natural break point (paragraph or sentence)
      const paragraphBreak = normalized.lastIndexOf('\n\n', endIndex);
      const sentenceBreak = normalized.lastIndexOf('. ', endIndex);
      const lineBreak = normalized.lastIndexOf('\n', endIndex);

      if (paragraphBreak > startIndex + chunkSize / 2) {
        endIndex = paragraphBreak + 2;
      } else if (sentenceBreak > startIndex + chunkSize / 2) {
        endIndex = sentenceBreak + 2;
      } else if (lineBreak > startIndex + chunkSize / 2) {
        endIndex = lineBreak + 1;
      }
    }

    const chunk = normalized.slice(startIndex, endIndex).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    startIndex = Math.max(startIndex + 1, endIndex - chunkOverlap);
  }

  return chunks;
}

/**
 * Parse PDF document in the browser using pdfjs-dist
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function parsePdfInBrowser(arrayBuffer) {
  try {
    // Dynamically import pdfjs-dist to optimize bundle splitting
    const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
    
    // In mobile Safari / Chrome, workers often fail due to CSP or cross-origin restrictions
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdfDoc = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(' ');
      fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
    }

    return fullText;
  } catch (err) {
    console.warn('Browser PDF parser notice (server extraction will handle this file):', err.message);
    return '';
  }
}

/**
 * Parse DOCX document in the browser using mammoth
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function parseDocxInBrowser(arrayBuffer) {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  } catch (err) {
    console.warn('Browser DOCX parser notice:', err.message);
    return '';
  }
}

/**
 * Parse TXT document in the browser
 * @param {ArrayBuffer} arrayBuffer
 * @returns {string}
 */
export function parseTxtInBrowser(arrayBuffer) {
  try {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(arrayBuffer);
  } catch {
    return '';
  }
}

/**
 * Master parser: detects type and extracts chunks
 * @param {File} file The selected file object
 * @returns {Promise<{ filename: string, type: string, fullText: string, chunks: string[], sizeBytes: number }>}
 */
export async function parseDocumentLocally(file) {
  const filename = file.name || 'study-document.pdf';
  let ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || !['pdf', 'docx', 'txt'].includes(ext)) {
    if (file.type === 'application/pdf') ext = 'pdf';
    else if (file.type?.includes('word') || file.type?.includes('officedocument')) ext = 'docx';
    else if (file.type?.includes('text')) ext = 'txt';
    else ext = 'pdf';
  }

  let fullText = '';
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (ext === 'pdf') {
      fullText = await parsePdfInBrowser(arrayBuffer);
    } else if (ext === 'docx') {
      fullText = await parseDocxInBrowser(arrayBuffer);
    } else if (ext === 'txt') {
      fullText = parseTxtInBrowser(arrayBuffer);
    }
  } catch (parseErr) {
    console.warn('Local parser warning:', parseErr.message);
  }

  const chunks = fullText && fullText.trim().length > 20 ? chunkText(fullText) : [];

  return {
    filename,
    type: ext,
    fullText: fullText || '',
    chunks,
    sizeBytes: file.size || 0,
  };
}
