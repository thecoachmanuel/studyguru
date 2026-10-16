import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { retrieveRelevantChunks } from '@/lib/vectorSearch';
import { generateStreamWithFallback, generateContentWithFallback } from '@/lib/llm';
import { cleanEmDashes } from '@/lib/cleanText';
import { generateOpenAIImage } from '@/lib/openaiImage';

// In-memory cache for common student questions on documents
const chatResponseCache = new Map();
const CHAT_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

const GREETING_REGEX = /^(hi|hello|hey|hiya|howdy|sup|yo|good\s*(morning|afternoon|evening|day)|what\'?s\s*up|how\s*are\s*you)[\s!.,?]*$/i;
const CHITCHAT_IDENTITY_REGEX = /^(who\s*are\s*you|what\s*(are\s*you|can\s*you\s*do|is\s*studycord|is\s*your\s*name))[\s!.,?]*$/i;
const IMAGE_PROMPT_REGEX = /^\s*(?:can you\s+)?(?:please\s+)?(?:generate|create|draw|paint|illustrate|render|make|produce|show me)\s+(?:an?\s+)?(?:image|picture|drawing|illustration|diagram|photo|visual)\s+(?:of|about|depicting|showing)?\s*(.+)/i;
const DRAW_PROMPT_REGEX = /^\s*(?:can you\s+)?(?:please\s+)?draw\s+(?:me\s+)?(?:an?\s+)?(.+)/i;

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

    // Instant Visual / Image Generation Router powered by OpenAI DALL-E
    const imgMatch = trimmedMessage.match(IMAGE_PROMPT_REGEX);
    const drawMatch = !imgMatch ? trimmedMessage.match(DRAW_PROMPT_REGEX) : null;
    if (imgMatch || drawMatch) {
      const rawSubject = (imgMatch ? imgMatch[1] : drawMatch[1]).replace(/[.?!\s]+$/, '').trim();
      if (rawSubject.length > 1) {
        const enhancedPrompt = `${rawSubject}, academic educational diagram, ultra-clear high resolution, highly detailed, pedagogical scientific illustration, sharp focus, 4k`;
        const imageUrl = await generateOpenAIImage(enhancedPrompt, { rawSubject });

        const reply = `Here is the high-definition visual illustration for **${rawSubject}**:\n\n![${rawSubject}](${imageUrl})\n\n*Generated with OpenAI DALL·E Image AI (Ultra-HD)*\n\n💡 **Next Steps:** You can type *"explain this visual step-by-step"*, ask *"draw this from another angle"*, or ask *"how does this connect to our lesson?"*`;

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
    }

    const userId = session.user.id;
    const isFreeChat = body.mode === 'free' || body.freeChat === true;
    let db = null;

    // 1. Resolve Document Context (Whole document text + semantic vector chunks)
    let doc = null;
    let fullDocumentText = '';
    let docTitle = '';

    const clientDocTitle = !isFreeChat ? (body.documentTitle || body.filename || body.docTitle || '') : '';
    const clientDocText = !isFreeChat ? (body.documentText || body.docText || body.fileText || '') : '';

    if (clientDocText && clientDocText.length > 20) {
      // Instant path: Use client-provided document text directly for sub-millisecond setup
      fullDocumentText = clientDocText.trim();
      docTitle = clientDocTitle || 'Study Material';
    } else if (!isFreeChat && documentId) {
      try {
        db = await getDatabase();
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

      if (doc) {
        docTitle = doc.original_filename || doc.title || clientDocTitle || 'Study Material';
        if (doc.extracted_text && typeof doc.extracted_text === 'string') {
          fullDocumentText = doc.extracted_text.trim();
        }
      }
    } else if (!isFreeChat && body.mode === 'guided') {
      try {
        if (!db) db = await getDatabase();
        doc = await db.collection('rag_documents').findOne(
          { user_id: userId },
          { sort: { created_at: -1 } }
        );
        if (doc) {
          docTitle = doc.original_filename || doc.title || clientDocTitle || 'Study Material';
          if (doc.extracted_text && typeof doc.extracted_text === 'string') {
            fullDocumentText = doc.extracted_text.trim();
          }
        }
      } catch {}
    }

    if (!docTitle && clientDocTitle) {
      docTitle = clientDocTitle;
    }

function extractFastRelevantPassages(text, query, maxChars = 15000) {
  if (!text || text.length <= maxChars) return text || '';
  const queryWords = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 20);
  if (paragraphs.length <= 4) {
    return text.slice(0, maxChars);
  }

  const scored = paragraphs.map((p, idx) => {
    const pLower = p.toLowerCase();
    let score = 0;
    for (const w of queryWords) {
      if (pLower.includes(w)) score += 3;
    }
    // Strongly preserve introductory chapters, syllabus, and outline (first 2 paragraphs)
    if (idx === 0) score += 4;
    if (idx === 1) score += 2;
    return { p, score, idx };
  });

  scored.sort((a, b) => b.score - a.score);
  // Pick top 12 relevant paragraphs to cover the document deeply
  const selected = scored.slice(0, 12);
  // Re-sort chronologically so natural document flow is maintained
  selected.sort((a, b) => a.idx - b.idx);
  
  const combined = selected.map((s) => s.p).join('\n\n');
  return combined.slice(0, maxChars);
}

    const isTeachingQuery = isTeachingOrBroadQuery(message);
    const isExplicitAllAtOnce = wantsAllAtOnce(message);

    // 2. High-speed Context Extraction: Use fast in-memory relevance if full text exists, otherwise fall back to vector search
    let contextChunks = [];
    if (!isFreeChat && !fullDocumentText && (doc?._id || documentId)) {
      try {
        const chunkSearchQuery = isTeachingQuery
          ? `${message} ${docTitle} overview introduction core concepts summary`
          : `${message} ${docTitle}`;

        contextChunks = await Promise.race([
          retrieveRelevantChunks({
            query: chunkSearchQuery,
            documentId: doc?._id?.toString() || documentId,
            userId,
            limit: isTeachingQuery ? 6 : 4,
          }),
          new Promise((resolve) => setTimeout(() => resolve([]), 400)),
        ]);
      } catch {}
    }

    // 3. Assemble document context with optimized token footprint for instantaneous TTFT (Time-To-First-Token)
    let contextText = '';
    if (docTitle) {
      contextText += `Document Subject: ${docTitle}\n\n`;
    }

    if (fullDocumentText) {
      const relevantPassages = extractFastRelevantPassages(fullDocumentText, message, isTeachingQuery ? 18000 : 14000);
      contextText += `Document Material & Key Insights:\n${relevantPassages}\n\n`;
    } else if (contextChunks.length > 0) {
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
    const isGuidedMode = !isFreeChat && (body.mode === 'guided' || Boolean(docTitle));
    const hasActiveDoc = !isFreeChat && Boolean(docTitle && (fullDocumentText || contextChunks.length > 0));

    const systemPrompt = `You are StudyGuru AI (AI Guru), a brilliant, empathetic, and encouraging Personal Academic Tutor on StudyCord.
Your mission is to guide the student through their academic questions using an interactive, adaptive, conversational tutoring approach.

${isFreeChat ? `FREE CHAT MODE (UNRESTRICTED ACADEMIC TUTOR):
• You are operating in FREE CHAT MODE. Do NOT read, search, cite, or assume any uploaded document or notes.
• Freely answer the student's questions across ALL subjects: Computer Science, Software Engineering, Mathematics, Physics, Chemistry, Biology, Medicine, History, Philosophy, Literature, Languages, Code Debugging, Logic, or Exam Preparation.
• Provide deep, direct, crystal-clear answers from first principles without referring to any document.` : isGuidedMode ? `GUIDED STUDY TUTORING MODE (STRICT DOCUMENT-GROUNDED LEARNING):
• Target Document: "${docTitle || 'Uploaded Study Notes'}"
• PRIMARY DIRECTIVE: Actively and strictly guide the student through their study journey based on their uploaded document:
  1. Base your teachings, chapter walk-throughs, definitions, formulas, and examples directly on the contents and structure of "${docTitle || 'the uploaded document'}".
  2. Walk the student step-by-step through the topics covered in their uploaded document. Never jump ahead or wander off into unrelated external trivia unless the student asks.
  3. When explaining concepts, quote or reference the specific sections, terms, and principles from the document so the student can easily follow along with their notes.
  4. Break the document into clear, digestible learning milestones: outline the core sections, explain the current section thoroughly, and check the student's understanding before moving to the next section.
  5. If the student asks "guide me", "start guided study", "teach me", or "overview", provide a structured syllabus/roadmap directly from their document, teach the first foundational concept, and offer actionable next steps.

Document Material:
${contextText || (docTitle ? `Document: ${docTitle}. (Ground your tutoring strictly in this material).` : 'Please upload your study document or lecture notes to begin guided study!')}` : hasActiveDoc ? `ACTIVE STUDY DOCUMENT & TOPIC:
• Subject Document: "${docTitle}"
• TUTORING DIRECTIVE:
  - If the student's question relates to "${docTitle}", anchor your explanations, analogies, and examples firmly in the document material below.
  - If the student asks a general academic, foundational, or adjacent question, provide a brilliant, clear explanation using your deep academic knowledge, and connect it back to the study context when helpful.

Document Context:
${contextText}` : `ACADEMIC TUTORING CONTEXT:
• General Academic Mode: Answer any subject question (STEM, Coding, Medicine, Humanities, Languages, or Exam Prep) with crystal-clear explanations, intuitive analogies, and step-by-step guidance.`};

CORE TUTORING PEDAGOGY & ADAPTIVE PACING:
1. ADAPTIVE RESPONSE LENGTH & DYNAMIC DEPTH:
   - You have COMPLETE AUTONOMY over your response length without any artificial limits.
   - Adapt your answer dynamically according to the student's specific question, prompt, and instruction:
     * When the student asks a quick, straightforward question or clarification: Give a crisp, direct, concise answer.
     * When the student asks for a detailed explanation, proof, complete code implementation, comprehensive breakdown, or in-depth overview: Provide a thorough, rich, and exhaustive response covering all necessary details without cutting off.
   - Teach with clarity: use bold key terms, relatable real-world analogies, clean bullet points, and code/math blocks whenever helpful.
   - If introducing a multi-step topic, you can provide a helpful roadmap and invite the student to explore each step interactively.

2. ADAPT DYNAMICALLY TO THE STUDENT'S LEARNING FLOW & SIGNALS:
   - Carefully review the previous conversation turns:
     * When the student understands (says "Got it", "Makes sense", "Yes", "Next", "Understood"): Celebrate warmly ("Spot on! 🎉", "Exactly right!"), briefly cement the takeaway, and seamlessly proceed.
     * When the student is confused or struggling (says "I don't get it", "I'm lost", "Can you explain again?"): Pause immediately! Empathize with warmth and reassurance. Break that specific obstacle down using a different, simpler analogy or visual example.
     * When the student asks for practice or a quiz: Present engaging questions or mini-scenarios.

3. DIRECT ANSWER & HUMAN TONE (CRITICAL):
   - Always respond directly to the student's question without hesitation or meta-commentary, exactly like ChatGPT.
   - STRICT PROHIBITION: NEVER output internal thoughts, reasoning steps, planning scratchpads, or self-instructions (e.g. "I need to provide a concise definition", "Thinking process", "Plan:").
   - NEVER start your response with an em-dash ('—'), en-dash ('–'), or hyphen ('-'). Begin directly with your explanation or clear answer.
   - Speak naturally like an encouraging, enthusiastic private mentor ("Notice how...", "Think of it like...", "Here's the fun part:").
   - Never sound like a stiff textbook or a robotic search engine. Never say "As an AI language model".
   - Use clean Markdown: bold terms, brief bullet points, and code/math blocks only when relevant.
   - STRICT PUNCTUATION RULE: Do NOT use unnecessary hyphens or em-dashes ('—' or '--'). Express thoughts cleanly using commas, periods, colons, or parentheses instead.

4. CONTINUITY, NEXT STEPS & ACTIONABLE GUIDANCE (CRITICAL):
   - Never stop a response abruptly without giving the student clear, inspiring next steps!
   - At the end of EVERY answer, explanation, or problem solution, provide 1 to 2 clear follow-up prompts or options the student can immediately type or ask, for example:
     💡 **Next Steps:** You can type *"explain step 2 in detail"*, ask *"give me an analogy"*, or type *"test me on this"* to check your understanding.
   - Make it effortlessly natural for the student to continue the conversation without having to wonder what to say next.

5. IMAGE & DIAGRAM GENERATION:
   - If the student asks you to generate, draw, illustrate, or create an image or visual diagram of any concept, process, organ, structure, or scene:
   - Explain the concept thoroughly with structured steps, labeled components, and clear educational descriptions.
   - Always describe key visual markers and provide follow-up study guidance beneath it!

6. STRICT TOPIC ISOLATION & SHIFT DIRECTIVE (CRITICAL):
   - Always pay close attention to what the student is asking about right now in their current message.
   - If the student changes or introduces a new topic (e.g. asking about "ecology" or "trauma" after previously discussing "respiratory system" or "biology"), IMMEDIATELY and COMPLETELY switch to the newly requested topic!
   - Do NOT bring up, repeat questions from, or mix in concepts from the previous topic or old questions unless the student explicitly asks to compare them.`;

    let userPrompt = '';
    if (formattedHistory) {
      userPrompt += `Previous Conversation Turns:\n${formattedHistory}\n\n`;
    }
    userPrompt += `Current Student Message: ${message}`;
    userPrompt += `\n\n(TUTOR INSTRUCTION: Focus 100% on the student's current requested topic. If the student has changed topics, pivot completely to the new topic without mixing in past topics from the conversation turns. Adapt your response length dynamically without artificial caps. ${hasActiveDoc ? `Ground your response in "${docTitle}".` : 'Answer freely without referring to any document.'})`;

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
                if (!db) db = await getDatabase();
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
        if (!db) db = await getDatabase();
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
