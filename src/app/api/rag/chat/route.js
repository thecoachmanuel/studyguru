import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { retrieveRelevantChunks } from '@/lib/vectorSearch';
import { generateStreamWithFallback, generateContentWithFallback } from '@/lib/llm';
import { cleanEmDashes } from '@/lib/cleanText';

// In-memory cache for common student questions on documents
const chatResponseCache = new Map();
const CHAT_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

const GREETING_REGEX = /^(hi|hello|hey|hiya|howdy|sup|yo|good\s*(morning|afternoon|evening|day)|what\'?s\s*up|how\s*are\s*you)[\s!.,?]*$/i;
const CHITCHAT_IDENTITY_REGEX = /^(who\s*are\s*you|what\s*(are\s*you|can\s*you\s*do|is\s*studycord|is\s*your\s*name))[\s!.,?]*$/i;

/**
 * Detects whether a student is requesting to learn or be tutored
 */
function isTeachingOrBroadQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.trim().toLowerCase();
  return /teach|explain.*(topic|subject|material|document|everything|chapter|concept|all|this)|walk.*through|overview|start|syllabus|what is this|lesson|guide me|summary|introduction|step by step|let's learn|begin/i.test(q);
}

/**
 * Detects whether a student explicitly asked for the entire concept/document at once
 */
function wantsAllAtOnce(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.trim().toLowerCase();
  return (
    /all at once|everything at once|in one go|all in one|all together/i.test(q) ||
    /give me (the )?whole|give me all|explain (the )?whole|teach (me )?(the )?whole/i.test(q) ||
    /entire (document|lesson|syllabus|topic|chapter|concept|subject)/i.test(q) ||
    /full (breakdown|overview|summary|guide|lesson|lecture) at once/i.test(q) ||
    /complete (breakdown|overview|summary|guide|explanation)/i.test(q) ||
    /whole topic at once/i.test(q)
  );
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const message = body.message || body.question || body.query || body.prompt;
    const documentId = body.documentId || body.document_id || body.doc_id;
    const sessionId = body.sessionId || body.session_id;
    const rawHistory = Array.isArray(body.history) ? body.history : [];

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const trimmedMessage = message.trim();
    const wantsStream = req.headers.get('accept')?.includes('text/event-stream') || body.stream === true;

    // Instant Greeting & Salutation Router (<10ms latency)
    if (GREETING_REGEX.test(trimmedMessage)) {
      const activeSubject = body.documentTitle || body.docTitle || body.filename || '';
      const reply = activeSubject
        ? `Hey there! 👋 I'm StudyCord AI Guru, your personal study tutor. I'm ready to help you master **${activeSubject}**! What topic, concept, or question would you like to start with?`
        : `Hey there! 👋 I'm StudyCord AI Guru, your personal study tutor. What subject, problem, or topic are you working on today? Feel free to ask any question or upload your notes!`;

      if (wantsStream) {
        const encoder = new TextEncoder();
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(reply));
              controller.close();
            },
          }),
          {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Transfer-Encoding': 'chunked',
              'Cache-Control': 'no-cache, no-transform',
            },
          }
        );
      }
      return NextResponse.json({ answer: reply, success: true, instant: true });
    }

    // Instant Identity / Capability check (<10ms latency)
    if (CHITCHAT_IDENTITY_REGEX.test(trimmedMessage)) {
      const reply = `I'm StudyCord AI Guru, your personal academic tutor and study partner! 🎓\n\nHere is how I can help you excel:\n• **Step-by-Step Tutoring**: I teach one concept at a time with intuitive, real-world analogies.\n• **Document Grounding**: Ask me anything about your uploaded study documents or PDFs.\n• **Any Subject**: STEM, Coding, Medicine, Humanities, Languages, or Exam Prep.\n• **Interactive Check-ins**: I test your understanding as we go to make sure concepts stick.\n\nWhat are you studying right now?`;

      if (wantsStream) {
        const encoder = new TextEncoder();
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(reply));
              controller.close();
            },
          }),
          {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Transfer-Encoding': 'chunked',
              'Cache-Control': 'no-cache, no-transform',
            },
          }
        );
      }
      return NextResponse.json({ answer: reply, success: true, instant: true });
    }

    const userId = session.user.id;
    const db = await getDatabase();

    const isFreeChat = body.mode === 'free' || body.freeChat === true;

    // 1. Resolve Document Context (Whole document text + semantic vector chunks)
    let doc = null;
    let fullDocumentText = '';
    let docTitle = '';

    if (!isFreeChat && documentId) {
      try {
        const safeDocId = safeObjectId(documentId);
        doc = await db.collection('rag_documents').findOne({
          $or: [{ _id: safeDocId }, { id: documentId }, { document_id: documentId }],
        });

        // If not found directly, check via session
        if (!doc && sessionId) {
          const safeSessId = safeObjectId(sessionId);
          const sess = await db.collection('rag_sessions').findOne({
            $or: [{ _id: safeSessId }, { id: sessionId }, { session_id: sessionId }],
          });
          if (sess?.document_id) {
            doc = await db.collection('rag_documents').findOne({
              $or: [{ _id: safeObjectId(sess.document_id) }, { id: sess.document_id }],
            });
          }
        }
      } catch (docErr) {
        console.warn('Document lookup notice in chat:', docErr.message);
      }
    }

    // Only fallback to user's latest study document in guided mode
    if (!isFreeChat && !doc && body.mode === 'guided') {
      try {
        doc = await db.collection('rag_documents').findOne(
          { user_id: userId },
          { sort: { created_at: -1 } }
        );
      } catch {}
    }

    const clientDocTitle = !isFreeChat ? (body.documentTitle || body.filename || body.docTitle || '') : '';
    const clientDocText = !isFreeChat ? (body.documentText || body.docText || body.fileText || '') : '';

    if (doc) {
      docTitle = doc.original_filename || doc.title || clientDocTitle || 'Study Material';
      if (doc.extracted_text && typeof doc.extracted_text === 'string') {
        fullDocumentText = doc.extracted_text.trim();
      }
    } else if (clientDocTitle || clientDocText) {
      docTitle = clientDocTitle || 'Study Material';
      fullDocumentText = clientDocText.trim();
    }

    if (!docTitle && clientDocTitle) {
      docTitle = clientDocTitle;
    }

    const isDocPlaceholder = !fullDocumentText || fullDocumentText.length < 60 || fullDocumentText.startsWith('Academic study material:');
    if ((isDocPlaceholder || !fullDocumentText) && clientDocText && clientDocText.length > 20) {
      fullDocumentText = clientDocText.trim();
      if (doc?._id) {
        db.collection('rag_documents').updateOne(
          { _id: doc._id },
          { $set: { extracted_text: fullDocumentText, updated_at: new Date() } }
        ).catch(() => {});
      }
    }

    const isTeachingQuery = isTeachingOrBroadQuery(message);
    const isExplicitAllAtOnce = wantsAllAtOnce(message);

    // 2. Retrieve relevant semantic chunks
    const chunkSearchQuery = isTeachingQuery
      ? `${message} ${docTitle} overview introduction core concepts summary`
      : `${message} ${docTitle}`;

    let contextChunks = [];
    if (!isFreeChat && (doc?._id || documentId)) {
      try {
        contextChunks = await Promise.race([
          retrieveRelevantChunks({
            query: chunkSearchQuery,
            documentId: doc?._id?.toString() || documentId,
            userId,
            limit: isTeachingQuery ? 6 : 4,
          }),
          new Promise((resolve) => setTimeout(() => resolve([]), 500)),
        ]);
      } catch {}
    }

    // 3. Assemble whole-document context
    let contextText = '';
    if (docTitle) {
      contextText += `Document Title / Subject: ${docTitle}\n\n`;
    }

    if (fullDocumentText) {
      const textSlice = isTeachingQuery
        ? fullDocumentText.slice(0, 14000)
        : fullDocumentText.slice(0, 10000);
      contextText += `Document Overview & Core Material:\n${textSlice}\n\n`;
    }

    if (contextChunks.length > 0) {
      contextText += `Relevant Document Passages:\n${contextChunks.join('\n\n---\n\n')}`;
    }

    if (!isFreeChat && !contextText.trim() && docTitle) {
      contextText = `Study Document: ${docTitle}. Teach strictly from this topic.`;
    }

    // 4. Incorporate multi-turn conversation history
    const formattedHistory = rawHistory
      .filter((turn) => turn && typeof turn.content === 'string' && turn.content.trim())
      .slice(-8)
      .map((turn) => `${turn.role === 'user' ? 'Student' : 'Personal Tutor'}: ${turn.content.trim()}`)
      .join('\n\n');

    // 5. Personal Tutor System Prompt (Grounded in doc if present, versatile academic wisdom overall)
    const hasActiveDoc = !isFreeChat && Boolean(docTitle && (fullDocumentText || contextChunks.length > 0));

    const systemPrompt = `You are StudyGuru AI (AI Guru), a brilliant, empathetic, and encouraging Personal Academic Tutor on StudyCord.
Your mission is to guide the student through their academic questions using an interactive, adaptive, conversational tutoring approach.

${isFreeChat ? `FREE CHAT MODE (UNRESTRICTED ACADEMIC TUTOR):
• You are operating in FREE CHAT MODE. Do NOT read, search, cite, or assume any uploaded document.
• Freely answer the student's questions across ALL subjects: Computer Science, Software Engineering, Mathematics, Physics, Chemistry, Biology, Medicine, History, Philosophy, Literature, Languages, Code Debugging, Logic, or Exam Preparation.
• Provide deep, direct, crystal-clear answers from first principles without mentioning "your document" or "your notes".` : hasActiveDoc ? `ACTIVE STUDY DOCUMENT & TOPIC:
• Subject Document: "${docTitle}"
• TUTORING DIRECTIVE:
  - If the student's question relates to "${docTitle}", anchor your explanations, analogies, and examples firmly in the document material below.
  - If the student asks a general academic, foundational, or adjacent question, provide a brilliant, clear explanation using your deep academic knowledge, and connect it back to the study context when helpful.

Document Context:
${contextText}` : `ACADEMIC TUTORING CONTEXT:
• General Academic Mode: Answer any subject question (STEM, Coding, Medicine, Humanities, Languages, or Exam Prep) with crystal-clear explanations, intuitive analogies, and step-by-step guidance.`}

CORE HUMAN TUTORING PEDAGOGY:
1. STEP-BY-STEP CONVERSATIONAL PACING (ONE Concept at a Time):
${isExplicitAllAtOnce ? `
   - The student has explicitly requested the whole concept or entire topic at once.
   - Provide a comprehensive, structured full breakdown covering all core sections, key principles, and summaries from the material.
` : `
   - CRITICAL MANDATORY RULE: NEVER dump the entire topic, multiple chapters, or complete explanations all at once unless the student explicitly tells you to! Long walls of text overwhelm students and stop active learning.
   - Teach in bite-sized conversational turns:
     * When starting a topic or answering a broad query: Give a quick 1-line roadmap (e.g. "We can master this in 3 easy steps! Let's start with **Step 1: [Concept Name]**").
     * Explain ONLY that single step/concept in 2 to 3 short, crystal-clear paragraphs.
     * Anchor it in a simple, relatable real-world analogy or everyday mental picture.
     * Bold key terms so they stand out naturally.
     * ALWAYS finish with an interactive check-in question or simple check-for-understanding (e.g. "Does that mental picture make sense to you? When you're ready, let me know and we'll jump into Step 2!", or ask an intuitive question to see how they apply it).
`}

2. ADAPT DYNAMICALLY TO THE STUDENT'S LEARNING FLOW & SIGNALS:
   - Carefully review the previous conversation turns:
     * When the student understands (says "Got it", "Makes sense", "Yes", "Next", "Understood", or answers your check-in correctly): Celebrate warmly ("Spot on! 🎉", "Exactly right!"), briefly cement the takeaway in 1 sentence, and seamlessly transition into the next step.
     * When the student is confused or struggling (says "I don't get it", "I'm lost", "Can you explain again?", or answers incorrectly): Pause immediately! Empathize with warmth and reassurance ("No worries at all, this catches almost everyone!"). Do NOT rush ahead. Break that specific obstacle down using a different, simpler analogy or visual example, and check in again.
     * When the student asks a tangent or specific question: Answer directly and simply (1-2 sentences), connect it back to the current topic, and invite them back into the learning roadmap.
     * When the student asks for a quiz or practice: Present ONE engaging question or mini-scenario. Wait for their response before grading or revealing the answer.

3. HUMAN TONE & WARMTH:
   - Speak naturally like an encouraging, enthusiastic private mentor ("Notice how...", "Think of it like...", "Here's the fun part:").
   - Never sound like a stiff textbook or a robotic search engine. Never say "As an AI language model".
   - Keep each conversational turn focused (around 120-220 words) so it feels like a real human back-and-forth conversation.
   - Use clean Markdown: bold terms, brief bullet points, and code/math blocks only when relevant.
   - STRICT PUNCTUATION RULE: Do NOT use unnecessary hyphens or em-dashes ('—' or '--'). Express thoughts cleanly using commas, periods, colons, or parentheses instead.`;

    let userPrompt = '';
    if (formattedHistory) {
      userPrompt += `Previous Conversation Turns:\n${formattedHistory}\n\n`;
    }
    userPrompt += `Current Student Message: ${message}`;
    if (!isExplicitAllAtOnce) {
      userPrompt += `\n\n(TUTOR INSTRUCTION: Teach conversationally. Explain ONLY the immediate next step or concept in 2-3 short, digestible paragraphs using a relatable real-world analogy. DO NOT dump the entire topic or document at once. ${hasActiveDoc ? `Ground your response in "${docTitle}".` : 'Answer freely without referring to any document.'} Conclude with an engaging interactive check-in question to adapt to the student's pace.)`;
    } else {
      userPrompt += `\n\n(TUTOR INSTRUCTION: The student explicitly requested the whole concept/topic at once. ${hasActiveDoc ? `Ground everything in "${docTitle}".` : 'Answer freely and comprehensively.'} Provide a structured, full breakdown.)`;
    }

    if (wantsStream) {
      const encoder = new TextEncoder();
      let fullAnswer = '';

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = generateStreamWithFallback({
              prompt: userPrompt,
              systemPrompt,
            });

            for await (const chunk of generator) {
              fullAnswer += chunk;
              controller.enqueue(encoder.encode(chunk));
            }

            // Zero MongoDB storage waste: do NOT push messages into MongoDB
            if (sessionId) {
              try {
                const querySessionId = safeObjectId(sessionId);
                await db.collection('rag_sessions').updateOne(
                  { $or: [{ _id: querySessionId }, { id: sessionId }] },
                  { $set: { updated_at: new Date() } }
                );
              } catch (err) {
                console.warn('Session timestamp touch notice:', err.message);
              }
            }

            controller.close();
          } catch (streamError) {
            console.error('Stream processing error:', streamError);
            controller.error(streamError);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache, no-transform',
        },
      });
    }

    // Default JSON response expected by RightPanel.jsx apiRequest
    const normalizedQuestion = message.trim().toLowerCase();
    const chatCacheKey = `${documentId || 'general'}:${isExplicitAllAtOnce ? 'all' : 'step'}:${normalizedQuestion}`;
    const cachedEntry = chatResponseCache.get(chatCacheKey);
    if (cachedEntry && Date.now() - cachedEntry.time < CHAT_CACHE_TTL && rawHistory.length === 0) {
      return NextResponse.json({
        answer: cachedEntry.answer,
        success: true,
        cached: true,
      });
    }

    let fullAnswer = '';
    try {
      const res = await generateContentWithFallback({
        prompt: userPrompt,
        systemPrompt,
      });
      fullAnswer = res?.text || '';
    } catch {
      const generator = generateStreamWithFallback({
        prompt: userPrompt,
        systemPrompt,
      });
      for await (const chunk of generator) {
        fullAnswer += chunk;
      }
    }

    fullAnswer = cleanEmDashes(fullAnswer);

    if (fullAnswer.trim()) {
      chatResponseCache.set(chatCacheKey, {
        answer: fullAnswer,
        time: Date.now(),
      });
    }

    if (!fullAnswer.trim()) {
      fullAnswer = 'I reviewed your study materials, but could not formulate a complete answer. Please rephrase your question or ask me to explain a specific topic.';
    }

    // Zero MongoDB storage waste: do NOT push messages into MongoDB!
    if (sessionId) {
      try {
        const querySessionId = safeObjectId(sessionId);
        await db.collection('rag_sessions').updateOne(
          { $or: [{ _id: querySessionId }, { id: sessionId }] },
          { $set: { updated_at: new Date() } }
        );
      } catch (err) {
        console.warn('Session timestamp touch notice:', err.message);
      }
    }

    return NextResponse.json({
      answer: fullAnswer,
      success: true,
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat' },
      { status: 500 }
    );
  }
}
