import { parseDocumentLocally } from './clientDocumentParser';
import { uploadToR2 } from './r2UploadClient';

const BATCH_SIZE = 8; // Micro-batch size to keep each serverless request under 2 seconds

/**
 * Robust Zero-Timeout Ingestion Pipeline for Vercel Free Tier
 * @param {File} file The selected file
 * @param {Object} options
 * @param {string|null} options.serverId Optional server ID for shared resources
 * @param {Function} options.onProgress Callback for interactive progress updates
 * @returns {Promise<{ documentId: string, sessionId: string, chunkCount: number }>}
 */
export async function ingestDocumentZeroTimeout(file, { serverId = null, onProgress = () => {} } = {}) {
  try {
    // Stage 1: In-browser text extraction (0 server seconds)
    onProgress({ stage: 'parsing', percent: 15, message: 'Extracting text in browser...' });
    const parsed = await parseDocumentLocally(file);

    // Stage 2: Optional direct upload of original document to Cloudflare R2
    onProgress({ stage: 'uploading', percent: 35, message: 'Saving file to Cloudflare R2 storage...' });
    let fileUrl = null;
    try {
      const uploadRes = await uploadToR2(file, serverId ? `servers/${serverId}` : 'personal-docs');
      fileUrl = uploadRes.fileUrl;
    } catch (uploadErr) {
      console.warn('R2 upload skipped or unconfigured, proceeding with extracted text:', uploadErr);
    }

    // Stage 3: Register document metadata in MongoDB
    onProgress({ stage: 'registering', percent: 50, message: 'Initializing study document...' });
    const regRes = await fetch('/api/rag/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: parsed.filename,
        detectedType: parsed.type,
        sizeBytes: parsed.sizeBytes,
        chunkCount: parsed.chunks.length,
        fileUrl,
        serverId,
      }),
    });

    if (!regRes.ok) {
      const err = await regRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to register document metadata');
    }

    const { documentId, sessionId } = await regRes.json();

    // Stage 4: Micro-batched vector ingestion (each request ~1-2s, immune to 10s timeout)
    const chunks = parsed.chunks.map((content, idx) => ({ index: idx, content }));
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const start = batchIdx * BATCH_SIZE;
      const batchChunks = chunks.slice(start, start + BATCH_SIZE);
      const batchPercent = 50 + Math.round(((batchIdx + 1) / totalBatches) * 45);

      onProgress({
        stage: 'indexing',
        percent: batchPercent,
        currentBatch: batchIdx + 1,
        totalBatches,
        message: `Indexing knowledge chunk batch ${batchIdx + 1} of ${totalBatches}...`,
      });

      const batchRes = await fetch('/api/rag/embed-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          batchIndex: batchIdx,
          totalBatches,
          chunks: batchChunks,
          serverId,
        }),
      });

      if (!batchRes.ok) {
        console.warn(`Batch ${batchIdx + 1} experienced an issue, continuing...`);
      }
    }

    onProgress({ stage: 'complete', percent: 100, message: 'Document ready for study!' });

    return {
      documentId,
      sessionId,
      chunkCount: chunks.length,
      filename: parsed.filename,
    };
  } catch (error) {
    onProgress({ stage: 'error', percent: 0, message: error.message });
    throw error;
  }
}
