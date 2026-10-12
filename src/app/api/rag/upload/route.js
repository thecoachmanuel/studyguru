import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase } from '@/lib/mongodb';
import { chunkText } from '@/lib/clientDocumentParser';
import mammoth from 'mammoth';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const filename = file.name;
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
    const userId = session.user.id;
    const db = await getDatabase();
    const now = new Date();

    // 1. Robust Server-Side Text Extraction
    let extractedText = '';
    const arrayBuffer = await file.arrayBuffer();

    if (ext === 'txt') {
      const decoder = new TextDecoder('utf-8');
      extractedText = decoder.decode(arrayBuffer);
    } else if (ext === 'docx') {
      try {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
        extractedText = result.value || '';
      } catch (docxErr) {
        console.warn('DOCX parse warning:', docxErr.message);
      }
    } else if (ext === 'pdf') {
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const data = new Uint8Array(arrayBuffer);
        const doc = await pdfjsLib.getDocument({ data }).promise;
        let pdfText = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          pdfText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        extractedText = pdfText;
      } catch (pdfErr) {
        console.warn('PDF parse warning:', pdfErr.message);
      }
    } else {
      // Fallback for code files / markdown
      try {
        const decoder = new TextDecoder('utf-8');
        extractedText = decoder.decode(arrayBuffer);
      } catch {}
    }

    // Split extracted text into semantic study chunks
    const chunks = chunkText(extractedText);

    // 2. Save document metadata
    const docRes = await db.collection('rag_documents').insertOne({
      user_id: userId,
      original_filename: filename,
      detected_type: ext,
      size_bytes: file.size,
      chunk_count: chunks.length,
      extracted_text: extractedText.slice(0, 10000), // Retain document text sample for instant study recall
      status: 'ready',
      created_at: now,
      updated_at: now,
    });
    const documentId = docRes.insertedId.toString();

    // 3. Create or attach session
    const sessionRes = await db.collection('rag_sessions').insertOne({
      user_id: userId,
      document_id: documentId,
      title: filename,
      messages: [],
      created_at: now,
      updated_at: now,
    });
    const sessionId = sessionRes.insertedId.toString();

    // 4. Ingest Chunks into MongoDB immediately (Guarantees RAG text is available without API key bottlenecks)
    if (chunks.length > 0) {
      const chunkDocs = chunks.map((content, idx) => ({
        document_id: documentId,
        doc_id: documentId,
        user_id: userId,
        chunk_index: idx,
        content,
        embedding: [],
        created_at: now,
      }));
      await db.collection('rag_chunks').insertMany(chunkDocs);
    }

    // 5. Return both snake_case and camelCase keys for seamless frontend compatibility
    return NextResponse.json({
      doc_id: documentId,
      document_id: documentId,
      documentId: documentId,
      session_id: sessionId,
      sessionId: sessionId,
      filename,
      status: 'ready',
      chunk_count: chunks.length,
    }, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'File upload failed' },
      { status: 500 }
    );
  }
}
