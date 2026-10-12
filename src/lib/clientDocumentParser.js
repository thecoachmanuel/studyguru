/**
 * Zero-Timeout In-Browser Document Parser
 * Parses PDF, DOCX, and TXT directly on the student's browser.
 * Resilient to mobile Safari & Chrome limitations, CSP restrictions, and missing extensions.
 */

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
 * Native in-browser DOCX extractor.
 * Unzips word/document.xml using standard DecompressionStream, completely bypassing
 * Node Buffer dependencies and mammoth runtime errors on mobile Safari & Chrome.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function parseDocxInBrowser(arrayBuffer) {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    let fullText = '';

    // Search for zip local file header: PK\x03\x04 (0x04034b50)
    for (let i = 0; i < bytes.length - 30; i++) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4B && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04) {
        const compMethod = view.getUint16(i + 8, true);
        const compSize = view.getUint32(i + 18, true);
        const nameLen = view.getUint16(i + 26, true);
        const extraLen = view.getUint16(i + 28, true);
        const nameBytes = bytes.subarray(i + 30, i + 30 + nameLen);
        const entryName = new TextDecoder('utf-8').decode(nameBytes);

        if (entryName === 'word/document.xml') {
          const dataStart = i + 30 + nameLen + extraLen;
          const compData = bytes.subarray(dataStart, dataStart + compSize);
          let xml = '';

          if (compMethod === 0) {
            xml = new TextDecoder('utf-8').decode(compData);
          } else if (compMethod === 8 && typeof DecompressionStream !== 'undefined') {
            try {
              const ds = new DecompressionStream('deflate-raw');
              const writer = ds.writable.getWriter();
              writer.write(compData);
              writer.close();
              const response = new Response(ds.readable);
              xml = await response.text();
            } catch (decompErr) {
              console.warn('Browser raw deflate notice:', decompErr?.message);
            }
          }

          if (xml) {
            // Extract all text inside <w:t> elements and paragraph breaks
            const textMatches = xml.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g);
            for (const m of textMatches) {
              if (m[1]) fullText += m[1] + ' ';
            }
          }
          break;
        }
        i += 30 + nameLen + extraLen + compSize - 1;
      }
    }

    if (fullText.trim().length > 15) {
      return fullText.trim();
    }
  } catch (nativeErr) {
    console.warn('Native browser DOCX parser notice:', nativeErr?.message);
  }

  // Secondary fallback: mammoth (if browser environment supports it)
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (result?.value?.trim()) return result.value.trim();
  } catch (mammothErr) {
    console.warn('Mammoth DOCX fallback notice:', mammothErr?.message);
  }

  return '';
}

/**
 * Native in-browser PDF stream text extractor for mobile environments
 * where Web Workers or CSP block external worker scripts.
 */
async function extractTextFromPdfInBrowserFallback(arrayBuffer) {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const latin1Text = new TextDecoder('latin1').decode(bytes);
    let fullText = '';

    // Extract uncompressed literal strings
    const tjMatches = latin1Text.matchAll(/\(([^)]{2,})\)\s*Tj/g);
    for (const m of tjMatches) {
      if (m[1] && !m[1].includes('%PDF')) fullText += m[1] + ' ';
    }
    const tjArrMatches = latin1Text.matchAll(/\[(.*?)\]\s*TJ/g);
    for (const m of tjArrMatches) {
      const inners = m[1].matchAll(/\(([^)]+)\)/g);
      for (const im of inners) {
        if (im[1]) fullText += im[1] + ' ';
      }
    }

    return fullText.replace(/\\([()\\])/g, '$1').trim();
  } catch {
    return '';
  }
}

/**
 * Parse PDF document in the browser using pdfjs-dist with fallback
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function parsePdfInBrowser(arrayBuffer) {
  try {
    const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
    
    // In mobile Safari / Chrome, workers often fail due to CSP or cross-origin restrictions
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.4.299'}/build/pdf.worker.min.mjs`;
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

    if (fullText.trim().length > 15) return fullText.trim();
  } catch (err) {
    console.warn('Browser PDF parser notice (trying native stream extractor):', err.message);
  }

  // Resilient mobile stream fallback
  const fallbackText = await extractTextFromPdfInBrowserFallback(arrayBuffer);
  return fallbackText || '';
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
 * Detect file type via magic bytes
 * @param {ArrayBuffer} arrayBuffer
 * @returns {'pdf' | 'docx' | 'txt'}
 */
export function detectTypeFromBytes(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 4) return 'txt';
  const bytes = new Uint8Array(arrayBuffer, 0, 4);

  // PK\x03\x04 => Zip archive (DOCX, XLSX, PPTX)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'docx';
  }
  // %PDF => PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }
  return 'txt';
}

/**
 * Master parser: detects type reliably via magic bytes and extracts chunks
 * @param {File} file The selected file object
 * @returns {Promise<{ filename: string, type: string, fullText: string, chunks: string[], sizeBytes: number }>}
 */
export async function parseDocumentLocally(file) {
  const filename = file.name || 'study-document.pdf';
  let ext = filename.split('.').pop()?.toLowerCase();

  let fullText = '';
  let detectedType = ext;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const magicType = detectTypeFromBytes(arrayBuffer);

    // Prefer magic byte detection for binary files (prevents Safari/Chrome MIME/extension mismatches)
    if (magicType === 'pdf' || magicType === 'docx') {
      detectedType = magicType;
    } else if (ext && ['pdf', 'docx', 'txt'].includes(ext)) {
      detectedType = ext;
    } else {
      detectedType = magicType;
    }

    if (detectedType === 'pdf') {
      fullText = await parsePdfInBrowser(arrayBuffer);
    } else if (detectedType === 'docx') {
      fullText = await parseDocxInBrowser(arrayBuffer);
    } else {
      fullText = parseTxtInBrowser(arrayBuffer);
    }
  } catch (parseErr) {
    console.warn('Local parser warning:', parseErr?.message);
  }

  const chunks = fullText && fullText.trim().length > 20 ? chunkText(fullText) : [];

  return {
    filename,
    type: detectedType || 'pdf',
    fullText: fullText || '',
    chunks,
    sizeBytes: file.size || 0,
  };
}
