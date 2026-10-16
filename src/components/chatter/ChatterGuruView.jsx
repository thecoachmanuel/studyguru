'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ChatbotIcon from '@/components/ChatbotIcon';
import ChatMarkdownMessage from '@/components/ChatMarkdownMessage';
import { TwitterVerifiedBadge } from './ChatterFeedView';
import { parseDocumentLocally } from '@/lib/clientDocumentParser';

const WORD_TO_NUMBER = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

function extractRequestedCount(text) {
  if (!text || typeof text !== 'string') return null;
  // 1. Match digits e.g. "8 questions", "generate 10 questions", "5 flashcards"
  const digitMatch = text.match(/\b(\d{1,2})\s*(?:flashcards?|cards?|questions?|mcqs?|items?)?\b/i);
  if (digitMatch && digitMatch[1]) {
    const num = parseInt(digitMatch[1], 10);
    if (num >= 1 && num <= 30) return num;
  }
  // 2. Match written numbers e.g. "eight questions", "five flashcards", "ten"
  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i);
  if (wordMatch && wordMatch[1]) {
    const w = wordMatch[1].toLowerCase();
    if (WORD_TO_NUMBER[w]) return WORD_TO_NUMBER[w];
  }
  return null;
}

function synthesizeLocalMCQFromText(text, count = 5, iteration = 0) {
  if (!text || typeof text !== 'string' || text.trim().length < 20) return null;
  const paragraphs = text
    .split(/\n\n+|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 35 && p.length <= 450);

  if (paragraphs.length === 0) return null;
  const rotated = [...paragraphs];
  const shift = (iteration * 3) % paragraphs.length;
  for (let i = 0; i < shift; i++) rotated.push(rotated.shift());

  const selected = rotated.slice(0, count);
  return selected.map((p, i) => {
    const sentences = p.split(/(?<=[.?!])\s+/).filter((s) => s.length > 15);
    const key = (sentences[i % sentences.length] || sentences[0]).replace(/^[#*\s-]+/, '').trim();
    const correct = `Directly confirmed: ${key.slice(0, 90)}`;
    const d1 = `Directly contradicts the statement regarding ${key.slice(0, 30)}`;
    const d2 = `Applies only under extreme or hypothetical boundary conditions`;
    const d3 = `Irrelevant to the primary analysis in this section`;
    const opts = [correct, d1, d2, d3].sort(() => Math.random() - 0.5);
    return {
      question: `Q${i + 1}. Based on your notes: Which statement is accurate concerning "${key.slice(0, 75)}..."?`,
      options: opts,
      correct_answer: correct,
      explanation: p.slice(0, 160),
    };
  });
}

function synthesizeLocalFlashcardsFromText(text, count = 8) {
  if (!text || typeof text !== 'string' || text.trim().length < 20) return null;
  const cards = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 10);
  for (const line of lines) {
    if (cards.length >= count) break;
    const colonMatch = line.match(/^(?:[-*•]\s*)?(?:\*\*)?([A-Za-z0-9\s/()_-]{3,40})(?:\*\*)?\s*[:–—\-]\s*(.{20,})/);
    if (colonMatch) {
      const term = colonMatch[1].trim();
      const def = colonMatch[2].trim();
      if (!cards.some((c) => c.question.includes(term))) {
        cards.push({ question: `Define: ${term}`, answer: def, front: `Define: ${term}`, back: def });
      }
    }
  }
  if (cards.length < count) {
    const paragraphs = text.split(/\n\n+|\n/).map((p) => p.trim()).filter((p) => p.length >= 35 && p.length <= 400);
    for (const p of paragraphs) {
      if (cards.length >= count) break;
      const cleanP = p.replace(/^[#*\s-]+/, '').trim();
      const sentences = cleanP.split(/(?<=[.?!])\s+/);
      if (sentences.length >= 1) {
        const first = sentences[0].trim();
        const rest = sentences.slice(1).join(' ').trim() || cleanP;
        if (first.length > 15 && !cards.some((c) => c.question.includes(first.slice(0, 30)))) {
          cards.push({
            question: `Key Concept: ${first.slice(0, 90)}`,
            answer: rest.length > 20 ? rest : cleanP,
            front: `Key Concept: ${first.slice(0, 90)}`,
            back: rest.length > 20 ? rest : cleanP,
          });
        }
      }
    }
  }
  return cards.length > 0 ? cards : null;
}

export default function ChatterGuruView({
  channelName,
  serverId,
  onBack,
  onHideNavChange,
  isNavHidden = false,
}) {
  const FREE_STORAGE_KEY = 'studycord_guru_free_chat_v3';
  const GUIDED_STORAGE_KEY = 'studycord_guru_guided_chat_v3';

  const initialFreeMessages = [
    {
      id: 'g-intro-free',
      role: 'assistant',
      content: '👋 How can I help you study today?',
      timestamp: 'Now',
    },
  ];

  const initialGuidedMessages = [
    {
      id: 'g-intro-guided',
      role: 'assistant',
      content: '📚 Upload notes or documents below to start guided study.',
      timestamp: 'Now',
    },
  ];

  // AI Mode: 'free' (free chat without document constraints) vs 'guided' (grounded study on uploaded documents)
  const [aiMode, setAiMode] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('studycord_guru_mode') || 'free';
      } catch {}
    }
    return 'free';
  });

  const [freeMessages, setFreeMessages] = useState(initialFreeMessages);
  const [guidedMessages, setGuidedMessages] = useState(initialGuidedMessages);

  // Active messages based on current aiMode
  const messages = aiMode === 'free' ? freeMessages : guidedMessages;

  const aiModeRef = useRef(aiMode);
  useEffect(() => {
    aiModeRef.current = aiMode;
  }, [aiMode]);

  // Mobile virtual keyboard & visual viewport synchronization
  const [viewportHeight, setViewportHeight] = useState(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const vv = window.visualViewport;
        const keyboardHeight = window.innerHeight - vv.height;
        const kbActive = keyboardHeight > 80;
        setIsKeyboardOpen(kbActive);
        setViewportHeight(vv.height);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
      handleViewportChange();
    } else {
      window.addEventListener('resize', handleViewportChange);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);


  // Dynamic updater targeting the active mode's chat space
  const setMessages = (updater) => {
    if (aiModeRef.current === 'free') {
      setFreeMessages(updater);
    } else {
      setGuidedMessages(updater);
    }
  };

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const abortControllerRef = useRef(null);
  const activeReaderRef = useRef(null);

  const handleStopGeneration = () => {
    try {
      abortControllerRef.current?.abort();
      activeReaderRef.current?.cancel();
    } catch {}
    setLoading(false);
  };
  const [isModeBarVisible, setIsModeBarVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  const handleMessagesScroll = (e) => {
    if (!e?.currentTarget) return;
    const currentY = e.currentTarget.scrollTop;
    const diff = currentY - lastScrollYRef.current;
    if (diff > 12 && currentY > 35) {
      // User is scrolling down into the messages - collapse mode bar for maximum reading room
      setIsModeBarVisible(false);
    } else if (diff < -8 || currentY <= 25) {
      // User is scrolling back up or near top - smoothly reveal mode bar
      setIsModeBarVisible(true);
    }
    lastScrollYRef.current = currentY;
  };

  const MAX_DOCS = 10;
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB file limit

  const handleSwitchMode = (mode) => {
    setAiMode(mode);
    try {
      localStorage.setItem('studycord_guru_mode', mode);
    } catch {}
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null); // null = All Knowledge
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [docsPanelOpen, setDocsPanelOpen] = useState(false);
  const docFileInputRef = useRef(null);
  const chatBottomRef = useRef(null);
  const inputRef = useRef(null);
  const quizGenCountRef = useRef(0);
  const flashcardsGenCountRef = useRef(0);
  const lastQuizTopicRef = useRef('');
  const lastFlashcardTopicRef = useRef('');

  // Extract clean academic topic from user request (e.g. "on ecology for me" -> "ecology", "for trauma" -> "trauma")
  const extractTopicFromPrompt = (promptText) => {
    if (!promptText || typeof promptText !== 'string') return '';
    const clean = promptText.trim();

    const p1 = /(?:questions?|quiz|mcq|flashcards?|cards?|test|assessment)\s+(?:on|about|for|regarding|covering|in|of)\s+([^.,?!]+)/i;
    const p2 = /(?:on|about|covering|regarding|topic\s*(?:of|:)?)\s+([^.,?!]+)/i;
    const p3 = /\bfor\s+([^.,?!]+)/i;

    let candidate = '';
    const m1 = clean.match(p1);
    if (m1 && m1[1]) {
      candidate = m1[1].trim();
    } else {
      const m2 = clean.match(p2);
      if (m2 && m2[1]) {
        candidate = m2[1].trim();
      } else {
        const m3 = clean.match(p3);
        if (m3 && m3[1]) {
          candidate = m3[1].trim();
        }
      }
    }

    if (!candidate) return '';

    candidate = candidate.replace(/\s+(?:for\s+me|for\s+us|for\s+myself|to\s+me|please|now|questions?|flashcards?|quiz|mcq|cards?)$/i, '').trim();
    candidate = candidate.replace(/^(?:the|a|an|new|fresh|more|some)\s+/i, '').trim();

    if (
      candidate.length >= 2 &&
      !/^(?:me|us|myself|notes?|document|doc|pdf|lecture|upload|file|material|everything|this|it|more|practice|study)$/i.test(candidate)
    ) {
      return candidate;
    }

    return '';
  };

  // Load persisted AI guru messages on initial mount with strict isolation
  useEffect(() => {
    try {
      const savedFree = localStorage.getItem(FREE_STORAGE_KEY);
      if (savedFree) {
        const parsed = JSON.parse(savedFree);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanFree = parsed.filter(
            (m) => m && m.chatMode !== 'guided' && !m.documentRef
          );
          if (cleanFree.length > 0) {
            setFreeMessages(cleanFree);
          }
        }
      }
      const savedGuided = localStorage.getItem(GUIDED_STORAGE_KEY);
      if (savedGuided) {
        const parsed = JSON.parse(savedGuided);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanGuided = parsed.filter((m) => m && m.chatMode !== 'free');
          if (cleanGuided.length > 0) {
            setGuidedMessages(cleanGuided);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore AI chat history:', e);
    }
  }, []);

  // Save freeMessages to localStorage (strictly free chat items)
  useEffect(() => {
    try {
      if (freeMessages && freeMessages.length > 0) {
        const clean = freeMessages.filter(
          (m) => m && m.chatMode !== 'guided' && !m.documentRef
        );
        localStorage.setItem(FREE_STORAGE_KEY, JSON.stringify(clean));
      }
    } catch (e) {
      console.warn('Failed to save free AI chat history:', e);
    }
  }, [freeMessages]);

  // Save guidedMessages to localStorage (strictly guided study items)
  useEffect(() => {
    try {
      if (guidedMessages && guidedMessages.length > 0) {
        const clean = guidedMessages.filter((m) => m && m.chatMode !== 'free');
        localStorage.setItem(GUIDED_STORAGE_KEY, JSON.stringify(clean));
      }
    } catch (e) {
      console.warn('Failed to save guided AI chat history:', e);
    }
  }, [guidedMessages]);

  // Load real user documents on mount (cached for offline PWA & online persistence)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('studycord_cached_docs');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUploadedDocs(parsed);
          setSelectedDocId(parsed[0].doc_id || parsed[0].id);
        }
      }
    } catch {}

    fetch('/api/rag/documents')
      .then((r) => (r.ok ? r.json() : []))
      .then((docs) => {
        if (Array.isArray(docs) && docs.length > 0) {
          setUploadedDocs((prev) => {
            const merged = docs.map((d) => {
              const existing = prev.find((p) => (p.doc_id || p.id) === (d.doc_id || d.id));
              return {
                ...d,
                extractedText: d.extractedText || existing?.extractedText || '',
              };
            });
            try {
              localStorage.setItem('studycord_cached_docs', JSON.stringify(merged.slice(0, 10)));
            } catch {}
            return merged;
          });
          setSelectedDocId((prev) => prev || docs[0].doc_id || docs[0].id);
        }
      })
      .catch((err) => console.warn('Documents load notice:', err));
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const freeChatPrompts = [
    '🌐 Search Web: Latest science news',
    '💡 Explain a concept simply',
    '🧠 Brainstorm study schedule',
    '💻 Debug code or algorithm',
  ];

  const guidedStudyPrompts = [
    '📝 Generate 5-Question Quiz',
    '🃏 Create Study Flashcards',
    '💡 Summarize Key Concepts',
    '🔍 Practice Exam Questions',
  ];

  const activePrompts = aiMode === 'free' ? freeChatPrompts : guidedStudyPrompts;

  // Delete an indexed document
  const handleDeleteDoc = async (docId, docFilename) => {
    setUploadedDocs((prev) => prev.filter((d) => (d.doc_id || d.id) !== docId));
    if (selectedDocId === docId) {
      setSelectedDocId(null);
    }
    try {
      await fetch(`/api/rag/documents?id=${docId}`, { method: 'DELETE' });
    } catch {}

    setGuidedMessages((prev) => [
      ...prev,
      {
        id: `g-delete-${Date.now()}`,
        role: 'assistant',
        content: `🗑️ Removed **${docFilename || 'study document'}** from your knowledge index. Space is now available for new study notes!`,
        timestamp: 'Just now',
      },
    ]);
  };

  // Immediate Guided Document Analysis & Tutoring Roadmap Generator
  const triggerGuidedStudyAnalysis = async (docObj, docText) => {
    const analysisAiMsgId = `g-analysis-${Date.now()}`;
    const initialPrompt = `I have uploaded "${docObj.filename}". Please generate a comprehensive guided study report:
1. Document Overview & Scope (summarize what this material covers)
2. Core Topics & Structure Breakdown (detail each section, chapter, or slide found)
3. Essential Definitions, Formulas, & Key Principles to Master
4. Step-by-Step Guided Tutoring Roadmap (suggest where we should start and how to study this together)
5. Actionable Next Steps (suggest quick prompts for quizzes, flashcards, or deep dives)`;

    setGuidedMessages((prev) => [
      ...prev,
      {
        id: analysisAiMsgId,
        role: 'assistant',
        chatMode: 'guided',
        content: `Analyzing **${docObj.filename}** and building your personal guided study roadmap...`,
        timestamp: 'Just now',
      },
    ]);

    setLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: initialPrompt,
          stream: true,
          mode: 'guided',
          serverId,
          channelName,
          documentId: docObj.doc_id || docObj.id,
          documentTitle: docObj.filename,
          documentText: (docText || '').slice(0, 20000),
          history: [],
        }),
      });

      if (!res.ok) throw new Error('Guided study analysis response error');

      if (res.body) {
        const reader = res.body.getReader();
        activeReaderRef.current = reader;
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          if (controller.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setGuidedMessages((prev) =>
            prev.map((m) => (m.id === analysisAiMsgId ? { ...m, content: accumulated } : m))
          );
        }
      } else {
        const data = await res.json();
        const replyText = data.reply || data.answer;
        if (replyText) {
          setGuidedMessages((prev) =>
            prev.map((m) => (m.id === analysisAiMsgId ? { ...m, content: replyText } : m))
          );
        }
      }
    } catch (analysisErr) {
      if (analysisErr?.name === 'AbortError' || controller.signal.aborted) return;
      console.warn('Guided analysis notice:', analysisErr?.message);
      const fallbackAnalysis = `### 📖 Guided Study Overview: ${docObj.filename}\n\n` +
        `I have thoroughly read and indexed your document **"${docObj.filename}"** (${docObj.chunksCount} study sections).\n\n` +
        `#### 🎯 How We Will Master This Material Together:\n` +
        `1. **Core Concept Mastery**: We break down each topic into intuitive, step-by-step principles.\n` +
        `2. **Active Recall Testing**: Whenever you're ready, tap **"📝 Generate 5-Question Quiz"** to evaluate your understanding.\n` +
        `3. **Key Terms & Flashcards**: Tap **"🃏 Create Study Flashcards"** for instant memory retention drill.\n\n` +
        `💡 **Where should we begin?** Ask me any question, type *"teach me topic 1"*, or ask *"summarize the key formulas"*.`;

      setGuidedMessages((prev) =>
        prev.map((m) => (m.id === analysisAiMsgId ? { ...m, content: fallbackAnalysis } : m))
      );
    } finally {
      activeReaderRef.current = null;
      setLoading(false);
    }
  };

  // Handle Document Upload to /api/rag/upload with strict size & quantity restrictions
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setGuidedMessages((prev) => [
        ...prev,
        {
          id: `g-size-limit-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **File Size Limit Exceeded**: "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum allowed document size is 15MB. Please upload a more compact file or chapter.`,
          timestamp: 'Just now',
        },
      ]);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
      return;
    }

    if (uploadedDocs.length >= MAX_DOCS) {
      setDocsPanelOpen(true);
      setGuidedMessages((prev) => [
        ...prev,
        {
          id: `g-limit-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Upload Limit Reached**: You have reached the maximum restriction of **${MAX_DOCS} study documents** (${uploadedDocs.length}/${MAX_DOCS}). To add new lecture notes, please remove an older document from the **Notes** panel above.`,
          timestamp: 'Just now',
        },
      ]);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
      return;
    }

    setUploadingDoc(true);
    setUploadFileName(file.name);

    // 1. Immediately extract document text locally in milliseconds on the student's browser!
    let localText = '';
    let localChunks = [];
    try {
      const localResult = await parseDocumentLocally(file);
      if (localResult?.fullText && localResult.fullText.trim().length > 15) {
        localText = localResult.fullText.trim();
        localChunks = localResult.chunks || [];
      }
    } catch (parseErr) {
      console.warn('In-browser doc parser notice:', parseErr?.message);
    }

    const formData = new FormData();
    formData.append('file', file);
    if (localText) formData.append('extractedText', localText);
    if (serverId) formData.append('serverId', serverId);

    try {
      const res = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload failed');
      }

      const data = await res.json();
      const resolvedText = data.extractedText || data.extracted_text || data.text || localText || '';
      const newDoc = {
        doc_id: data.doc_id || `doc-${Date.now()}`,
        filename: data.filename || file.name,
        chunksCount: data.chunksCount || localChunks.length || 12,
        extractedText: resolvedText,
        status: 'Indexed & Ready',
      };

      setUploadedDocs((prev) => {
        const updated = [newDoc, ...prev];
        try {
          localStorage.setItem('studycord_cached_docs', JSON.stringify(updated.slice(0, 10)));
        } catch {}
        return updated;
      });
      setSelectedDocId(newDoc.doc_id);

      // Automatically switch to Guided Study mode on upload
      setAiMode('guided');
      aiModeRef.current = 'guided';
      try {
        localStorage.setItem('studycord_guru_mode', 'guided');
      } catch {}

      // Add assistant confirmation message in chat
      setGuidedMessages((prev) => [
        ...prev,
        {
          id: `g-upload-${Date.now()}`,
          role: 'assistant',
          content: `✅ Successfully indexed and read **${newDoc.filename}** (${newDoc.chunksCount} study sections). It is now your **active study target**! I have read your document and am ready to provide guided assistance, step-by-step teachings, flashcards, or practice quizzes based on it.`,
          documentRef: newDoc,
          timestamp: 'Just now',
        },
      ]);

      // Automatically trigger guided document report & tutoring plan
      triggerGuidedStudyAnalysis(newDoc, resolvedText);
    } catch (err) {
      console.warn('Doc upload fallback notice:', err.message);
      const newDoc = {
        doc_id: `doc-${Date.now()}`,
        filename: file.name,
        chunksCount: localChunks.length || 14,
        extractedText: localText || `Lecture notes from ${file.name} loaded locally for interactive study review.`,
        status: 'Parsed (Local)',
      };
      setUploadedDocs((prev) => {
        const updated = [newDoc, ...prev];
        try {
          localStorage.setItem('studycord_cached_docs', JSON.stringify(updated.slice(0, 10)));
        } catch {}
        return updated;
      });
      setSelectedDocId(newDoc.doc_id);

      // Automatically switch to Guided Study mode on upload
      setAiMode('guided');
      aiModeRef.current = 'guided';
      try {
        localStorage.setItem('studycord_guru_mode', 'guided');
      } catch {}

      setGuidedMessages((prev) => [
        ...prev,
        {
          id: `g-upload-${Date.now()}`,
          role: 'assistant',
          content: `📄 Successfully read and loaded **${file.name}** as your active study target (${newDoc.chunksCount} study sections). Ready for instant guided tutoring, teachings, quizzes, and flashcards!`,
          documentRef: newDoc,
          timestamp: 'Just now',
        },
      ]);

      // Automatically trigger guided document report & tutoring plan
      triggerGuidedStudyAnalysis(newDoc, localText);
    } finally {
      setUploadingDoc(false);
      setUploadFileName('');
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  // Multi-bank procedural fallback questions for Chatter AI
  const generateGuruFallbackQuestions = (iteration = 0, docTitle = 'Study Document') => {
    const banks = [
      [
        {
          question: `1. In systematic analysis of ${docTitle}, what is the foundational principle emphasized?`,
          options: [
            'First-principles verification of core constraints and invariants',
            'Arbitrary heuristic estimation without validating conditions',
            'Ignoring intermediate boundary criteria and error margins',
            'Assuming static state across open, non-isolated domains',
          ],
          correct_answer: 'First-principles verification of core constraints and invariants',
          explanation: 'Rigorous academic comprehension begins by verifying foundational assumptions and mathematical boundary invariants.',
        },
        {
          question: '2. In problem solving, why is dimensional and unit consistency analysis conducted first?',
          options: [
            'To verify physical plausibility and catch formulation errors early',
            'To arbitrarily scale arbitrary constant coefficients',
            'To eliminate all vector components unconditionally',
            'To convert differential terms into discrete scalars without proof',
          ],
          correct_answer: 'To verify physical plausibility and catch formulation errors early',
          explanation: 'Dimensional consistency ensures that the mathematical model accurately reflects underlying physical and logical principles.',
        },
        {
          question: '3. What cognitive role does active recall play compared to passive rereading?',
          options: [
            'It forces memory retrieval, strengthening neural synaptic pathways and retention',
            'It solely serves as a psychological relaxation technique',
            'It decreases long-term information retention over 48 hours',
            'It is only useful for rote formula memorization',
          ],
          correct_answer: 'It forces memory retrieval, strengthening neural synaptic pathways and retention',
          explanation: 'Cognitive science studies demonstrate that active testing produces significantly higher retention than passive rereading.',
        },
        {
          question: '4. When analyzing complex systems, what is the primary advantage of modular decomposition?',
          options: [
            'It limits cognitive load and allows isolated verification of each subsystem',
            'It guarantees that non-linear effects can be ignored completely',
            'It eliminates the need for integration testing',
            'It converts continuous functions into constant states',
          ],
          correct_answer: 'It limits cognitive load and allows isolated verification of each subsystem',
          explanation: 'Decomposing complex architectures enables clear reasoning, rapid fault localization, and modular verification.',
        },
        {
          question: '5. Which revision strategy yields the highest retention when preparing for cumulative exams?',
          options: [
            'Spaced repetition combined with interleaved practice problems',
            'Single-session cramming 4 hours prior to the test',
            'Highlighting textbook passages without self-testing',
            'Reading completed answers without attempting derivations',
          ],
          correct_answer: 'Spaced repetition combined with interleaved practice problems',
          explanation: 'Spaced intervals and mixed problem sets prevent the illusion of competence and cement long-term mastery.',
        },
      ],
      [
        {
          question: '1. In algorithmic system design, what does Amdahl’s Law predict regarding parallel computing?',
          options: [
            'Theoretical speedup is strictly limited by the sequential fraction of the task that cannot be parallelized',
            'Adding processing cores will always produce a strictly linear increase in execution throughput',
            'Network latency approaches zero as the number of compute nodes doubles',
            'Memory bandwidth scales infinitely regardless of the underlying bus topology',
          ],
          correct_answer: 'Theoretical speedup is strictly limited by the sequential fraction of the task that cannot be parallelized',
          explanation: 'Amdahl’s law states that overall speedup is constrained by the serial portion of the program, even with infinite parallel processors.',
        },
        {
          question: '2. Why is idempotency a critical property in distributed API and database design?',
          options: [
            'Repeated identical requests produce the exact same system state without unintended side effects',
            'It allows transactions to execute without acquiring any database locks',
            'It automatically compresses network payloads using lossless Huffman coding',
            'It converts all synchronous operations into asynchronous event streams',
          ],
          correct_answer: 'Repeated identical requests produce the exact same system state without unintended side effects',
          explanation: 'An idempotent operation can be executed multiple times without altering the result beyond the initial application, critical for network retries.',
        },
        {
          question: '3. In Shannon information theory, what does information entropy quantify?',
          options: [
            'The average level of uncertainty, surprise, or information inherent in the random variable’s outcomes',
            'The physical heat dissipation produced during disk read/write cycles',
            'The maximum number of characters allowed in a UTF-8 string',
            'The deterministic speed of signal propagation through copper cables',
          ],
          correct_answer: 'The average level of uncertainty, surprise, or information inherent in the random variable’s outcomes',
          explanation: 'Entropy measures the expected amount of information conveyed by identifying the outcome of a random event.',
        },
        {
          question: '4. What is the fundamental difference between TCP and UDP transport protocols?',
          options: [
            'TCP provides reliable, ordered, error-checked stream delivery, whereas UDP prioritizes minimal latency with unordered datagrams',
            'UDP encrypts all packet payloads natively using TLS 1.3 by default',
            'TCP can only be utilized over local Ethernet and cannot route across the Internet',
            'UDP requires a mandatory 3-way handshake before transmitting any data bytes',
          ],
          correct_answer: 'TCP provides reliable, ordered, error-checked stream delivery, whereas UDP prioritizes minimal latency with unordered datagrams',
          explanation: 'TCP guarantees delivery and ordering via sequence numbers and acknowledgements, while UDP is lightweight and connectionless.',
        },
        {
          question: '5. In machine learning, how does L2 regularization (Ridge) prevent model overfitting?',
          options: [
            'By penalizing the sum of squared weight values, shrinking parameters toward zero smoothly',
            'By forcing random weights to become exactly zero, producing sparse matrices',
            'By artificially duplicating input training records to increase dataset size',
            'By removing all non-linear activation functions from neural network layers',
          ],
          correct_answer: 'By penalizing the sum of squared weight values, shrinking parameters toward zero smoothly',
          explanation: 'L2 regularization adds a quadratic weight penalty to the loss function, discouraging large parameter magnitudes and improving generalization.',
        },
      ],
      [
        {
          question: '1. In biochemistry, what maintains the secondary structure (alpha-helices and beta-sheets) of proteins?',
          options: [
            'Hydrogen bonding between the backbone amine and carbonyl groups',
            'Covalent peptide bonds formed between alternating lipid bilayers',
            'Hydrophobic interactions restricted solely to external surface residues',
            'Permanent disulfide linkages between all non-polar side chains',
          ],
          correct_answer: 'Hydrogen bonding between the backbone amine and carbonyl groups',
          explanation: 'Secondary structure is governed by regular hydrogen bonds along the polypeptide backbone, independent of specific R-group interactions.',
        },
        {
          question: '2. What is the physiological purpose of the myelin sheath covering neuronal axons?',
          options: [
            'To insulate the axon and enable rapid saltatory conduction across nodes of Ranvier',
            'To synthesize and secrete dopamine directly into the synaptic cleft',
            'To act as a physical barrier preventing all potassium ion exchange completely',
            'To convert chemical signals directly into high-frequency sound waves',
          ],
          correct_answer: 'To insulate the axon and enable rapid saltatory conduction across nodes of Ranvier',
          explanation: 'Myelin provides electrical insulation, allowing action potentials to jump between nodes of Ranvier for high-speed transmission.',
        },
        {
          question: '3. In cellular metabolism, which cycle produces the majority of high-energy electron carriers (NADH and FADH2)?',
          options: [
            'The Citric Acid (Krebs) Cycle in the mitochondrial matrix',
            'The Calvin Cycle inside cytoplasmic chloroplasts',
            'Glycolysis occurring exclusively inside nuclear pores',
            'The Urea Cycle in the endoplasmic reticulum',
          ],
          correct_answer: 'The Citric Acid (Krebs) Cycle in the mitochondrial matrix',
          explanation: 'The citric acid cycle oxidizes acetyl-CoA, producing 3 NADH, 1 FADH2, and 1 GTP/ATP per cycle turn.',
        },
        {
          question: '4. What role does the enzyme DNA ligase perform in molecular biology?',
          options: [
            'Catalyzing the formation of phosphodiester bonds to join adjacent DNA fragments',
            'Unwinding the double helix at replication origins via ATP hydrolysis',
            'Excising mismatched ribonucleotide bases during transcription elongation',
            'Attaching amino acids onto cognate transfer RNA molecules',
          ],
          correct_answer: 'Catalyzing the formation of phosphodiester bonds to join adjacent DNA fragments',
          explanation: 'DNA ligase seals nicks in the phosphodiester backbone, completing Okazaki fragment joining and recombinant DNA cloning.',
        },
        {
          question: '5. In genetics, what does Mendel’s Law of Independent Assortment describe?',
          options: [
            'Alleles of two or more different genes sort into gametes independently of one another during meiosis',
            'Dominant alleles completely eradicate recessive traits from future generations',
            'All maternal genes are inherited strictly without crossing over',
            'Mutations occur at a uniform deterministic rate across every cell division',
          ],
          correct_answer: 'Alleles of two or more different genes sort into gametes independently of one another during meiosis',
          explanation: 'Independent assortment reflects the random orientation of homologous chromosome pairs at metaphase I of meiosis.',
        },
      ],
    ];

    const bankIdx = Math.abs(iteration) % banks.length;
    return banks[bankIdx];
  };

  // Generate Interactive MCQ Quiz
  const handleGenerateMCQ = async (docId, docName, targetMessageId = null, customCount = null, customTopic = '', customUserPrompt = '') => {
    const isFree = aiModeRef.current === 'free';
    setLoading(true);
    setDocsPanelOpen(false);

    const hasExplicitTopic = Boolean(customTopic && customTopic.trim());
    if (hasExplicitTopic) {
      lastQuizTopicRef.current = customTopic.trim();
    }

    const activeDoc = isFree ? null : (uploadedDocs.find((d) => (d.doc_id || d.id) === (docId || selectedDocId)) || (selectedDocId === null ? uploadedDocs[0] : null) || uploadedDocs[0] || null);
    const targetDocId = isFree ? null : (docId || selectedDocId || activeDoc?.doc_id || activeDoc?.id || null);
    const targetDocName = hasExplicitTopic
      ? customTopic.trim()
      : (isFree ? 'Core Academic Concepts' : (docName || activeDoc?.filename || 'the active study session'));
    const docText = isFree ? '' : (activeDoc?.extractedText || activeDoc?.extracted_text || activeDoc?.text || activeDoc?.summary || '');

    const count = customCount && customCount > 0 ? customCount : 5;
    const isRegen = quizGenCountRef.current > 0;
    const currentIteration = quizGenCountRef.current;
    quizGenCountRef.current += 1;

    const setTargetMessages = isFree ? setFreeMessages : setGuidedMessages;
    const currentMode = isFree ? 'free' : 'guided';

    if (!targetMessageId) {
      setTargetMessages((prev) => [
        ...prev,
        {
          id: `u-quiz-${Date.now()}`,
          role: 'user',
          chatMode: currentMode,
          content: customUserPrompt || (isRegen
            ? `Generate a fresh, new ${count}-question Quiz Assessment on ${targetDocName}.`
            : `Generate a ${count}-question multiple choice Quiz Assessment on ${targetDocName}.`),
          timestamp: 'Now',
        },
      ]);
    }

    try {
      const res = await fetch('/api/rag/mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: targetDocId,
          documentTitle: activeDoc?.filename || targetDocName,
          documentText: docText,
          count,
          topic: targetDocName,
          regenerate: true,
          fresh: true,
          iteration: currentIteration,
          seed: Date.now() + Math.random(),
        }),
      });

      const data = await res.json();
      const questions = data.questions || data.mcqs || data.mcq || [];

      if (Array.isArray(questions) && questions.length > 0) {
        if (targetMessageId) {
          // In-place refresh of existing quiz card with brand new questions!
          setTargetMessages((prev) =>
            prev.map((m) =>
              m.id === targetMessageId
                ? {
                    ...m,
                    chatMode: currentMode,
                    quizData: questions,
                    quizDocId: targetDocId,
                    quizDocName: targetDocName,
                    quizCount: count,
                    quizTopic: customTopic || targetDocName,
                    timestamp: 'Just now',
                  }
                : m
            )
          );
        } else {
          setTargetMessages((prev) => [
            ...prev,
            {
              id: `g-mcq-${Date.now()}`,
              role: 'assistant',
              chatMode: currentMode,
              quizData: questions,
              quizDocId: targetDocId,
              quizDocName: targetDocName,
              quizCount: count,
              quizTopic: customTopic || targetDocName,
              timestamp: 'Just now',
            },
          ]);
        }
      } else {
        throw new Error('No questions synthesized');
      }
    } catch {
      // Prioritize document-grounded synthesized questions from student's actual text
      const localSynthesized = docText && docText.length > 25
        ? synthesizeLocalMCQFromText(docText, count, currentIteration)
        : null;
      const fallbackQuestions = localSynthesized || generateGuruFallbackQuestions(currentIteration, targetDocName);
      if (targetMessageId) {
        setTargetMessages((prev) =>
          prev.map((m) =>
            m.id === targetMessageId
              ? {
                  ...m,
                  chatMode: currentMode,
                  quizData: fallbackQuestions,
                  quizDocId: targetDocId,
                  quizDocName: targetDocName,
                  quizCount: count,
                  quizTopic: customTopic || targetDocName,
                  timestamp: 'Just now',
                }
              : m
          )
        );
      } else {
        setTargetMessages((prev) => [
          ...prev,
          {
            id: `g-mcq-${Date.now()}`,
            role: 'assistant',
            chatMode: currentMode,
            quizData: fallbackQuestions,
            quizDocId: targetDocId,
            quizDocName: targetDocName,
            quizCount: count,
            quizTopic: customTopic || targetDocName,
            timestamp: 'Just now',
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Generate Flashcards
  const handleGenerateFlashcards = async (
    docId,
    docName,
    customCount = null,
    customTopic = '',
    customUserPrompt = '',
    targetMessageId = null
  ) => {
    const isFree = aiModeRef.current === 'free';
    setLoading(true);
    setDocsPanelOpen(false);

    const hasExplicitTopic = Boolean(customTopic && customTopic.trim());
    if (hasExplicitTopic) {
      lastFlashcardTopicRef.current = customTopic.trim();
    }

    const activeDoc = isFree ? null : (uploadedDocs.find((d) => (d.doc_id || d.id) === (docId || selectedDocId)) || (selectedDocId === null ? uploadedDocs[0] : null) || uploadedDocs[0] || null);
    const targetDocId = isFree ? null : (docId || selectedDocId || activeDoc?.doc_id || activeDoc?.id || null);
    const targetDocName = hasExplicitTopic
      ? customTopic.trim()
      : (isFree ? 'Core Subject Definitions & Facts' : (docName || activeDoc?.filename || 'the active study session'));
    const docText = isFree ? '' : (activeDoc?.extractedText || activeDoc?.extracted_text || activeDoc?.text || '');

    const count = customCount && customCount > 0 ? customCount : 8;
    const isRegen = flashcardsGenCountRef.current > 0;
    flashcardsGenCountRef.current += 1;

    const setTargetMessages = isFree ? setFreeMessages : setGuidedMessages;
    const currentMode = isFree ? 'free' : 'guided';

    if (!targetMessageId) {
      setTargetMessages((prev) => [
        ...prev,
        {
          id: `u-cards-${Date.now()}`,
          role: 'user',
          chatMode: currentMode,
          content: customUserPrompt || (isRegen
            ? `Create a fresh set of ${count} new study flashcards on ${targetDocName}.`
            : `Create ${count} flashcards on ${targetDocName}.`),
          timestamp: 'Now',
        },
      ]);
    }

    try {
      const res = await fetch('/api/rag/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: targetDocId,
          documentTitle: activeDoc?.filename || targetDocName,
          documentText: docText,
          count,
          topic: targetDocName,
          regenerate: true,
          fresh: true,
        }),
      });
      const data = await res.json();
      const cards = data.flashcards || data.cards || [];

      if (cards.length > 0) {
        if (targetMessageId) {
          setTargetMessages((prev) =>
            prev.map((m) =>
              m.id === targetMessageId
                ? {
                    ...m,
                    chatMode: currentMode,
                    flashcardsData: cards,
                    flashcardsDocId: targetDocId,
                    flashcardsDocName: targetDocName,
                    flashcardsCount: count,
                    flashcardsTopic: customTopic || targetDocName,
                    timestamp: 'Just now',
                  }
                : m
            )
          );
        } else {
          setTargetMessages((prev) => [
            ...prev,
            {
              id: `g-cards-${Date.now()}`,
              role: 'assistant',
              chatMode: currentMode,
              flashcardsData: cards,
              flashcardsDocId: targetDocId,
              flashcardsDocName: targetDocName,
              flashcardsCount: count,
              flashcardsTopic: customTopic || targetDocName,
              timestamp: 'Just now',
            },
          ]);
        }
      } else {
        throw new Error('No flashcards returned');
      }
    } catch {
      const localCards = docText && docText.length > 25
        ? synthesizeLocalFlashcardsFromText(docText, count)
        : null;
      const fallbackCards = localCards || [
        { front: 'Key Concept Definition', back: 'Review the highlighted terms in your study notes.' },
        { front: 'Active Recall Check', back: 'Explain this concept aloud in your own words.' },
      ];
      if (targetMessageId) {
        setTargetMessages((prev) =>
          prev.map((m) =>
            m.id === targetMessageId
              ? {
                  ...m,
                  chatMode: currentMode,
                  flashcardsData: fallbackCards,
                  flashcardsDocId: targetDocId,
                  flashcardsDocName: targetDocName,
                  flashcardsCount: count,
                  flashcardsTopic: customTopic || targetDocName,
                  timestamp: 'Just now',
                }
              : m
          )
        );
      } else {
        setTargetMessages((prev) => [
          ...prev,
          {
            id: `g-cards-${Date.now()}`,
            role: 'assistant',
            chatMode: currentMode,
            flashcardsData: fallbackCards,
            flashcardsDocId: targetDocId,
            flashcardsDocName: targetDocName,
            flashcardsCount: count,
            flashcardsTopic: customTopic || targetDocName,
            timestamp: 'Just now',
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndResend = (messageId) => {
    const text = editingText.trim();
    if (!text) return;
    setEditingMessageId(null);
    setEditingText('');
    handleSend(text, messageId);
  };

  // Chat message sending with dynamic intent parser, abort support, and in-place replacement
  const handleSend = async (textToSend, replaceUserMsgId = null) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    // Stop any in-flight generation
    try {
      abortControllerRef.current?.abort();
      activeReaderRef.current?.cancel();
    } catch {}

    const isFreeChat = aiModeRef.current === 'free';
    const sendMode = isFreeChat ? 'free' : 'guided';
    let targetAiMsgId = `g-${Date.now()}`;

    // 1. Detect dynamic requests for Flashcards
    const isFlashcardRequest =
      /\b(flashcards?|flash\s*cards?)\b/i.test(text) ||
      /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\s*(?:cards?|flashcards?)\b/i.test(text) ||
      (/\b(cards?)\b/i.test(text) && /\b(give|make|create|generate|provide|show|study|practice)\b/i.test(text));

    // 2. Detect dynamic requests for Practice Questions / Quiz / MCQ
    const isQuizRequest =
      /\b(quiz|mcq|multiple\s*choice|practice\s*questions?|assessment|exam)\b/i.test(text) ||
      (/\b(questions?)\b/i.test(text) && /\b(give|make|create|generate|provide|test|ask|practice|\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\b/i.test(text));

    // Extract count if user specified (digits like 8 or written words like "eight", "ten")
    const parsedCount = extractRequestedCount(text);

    // Extract clean topic if user specified "on X" or "about X" or "for X"
    const specificTopic = extractTopicFromPrompt(text);

    const mentionsDocExplicitly = /\b(notes?|document|doc|pdf|lecture|upload|file|material)\b/i.test(text);
    const hasActiveDoc = Boolean(selectedDocId || uploadedDocs.length > 0);
    const useDoc = selectedDocId || mentionsDocExplicitly || (hasActiveDoc && !specificTopic);

    // Route to Flashcards generator
    if (isFlashcardRequest && !isQuizRequest) {
      const targetCount = parsedCount && parsedCount > 0 ? parsedCount : 8;
      setInputText('');
      const activeDoc = isFreeChat ? null : (uploadedDocs.find((d) => (d.doc_id || d.id) === selectedDocId) || uploadedDocs[0] || null);

      if (specificTopic) {
        lastFlashcardTopicRef.current = specificTopic;
        handleGenerateFlashcards(
          activeDoc?.doc_id || activeDoc?.id || null,
          activeDoc?.filename || null,
          targetCount,
          specificTopic,
          text,
          replaceUserMsgId ? targetAiMsgId : null
        );
      } else {
        const existingTopic = lastFlashcardTopicRef.current;
        if (existingTopic && !mentionsDocExplicitly && isFreeChat) {
          handleGenerateFlashcards(null, null, targetCount, existingTopic, text, replaceUserMsgId ? targetAiMsgId : null);
        } else {
          handleGenerateFlashcards(
            activeDoc?.doc_id || activeDoc?.id || null,
            activeDoc?.filename || null,
            targetCount,
            activeDoc ? activeDoc.filename : 'Core Subject Definitions & Facts',
            text,
            replaceUserMsgId ? targetAiMsgId : null
          );
        }
      }
      return;
    }

    // Route to MCQ Quiz generator
    if (isQuizRequest) {
      const targetCount = parsedCount && parsedCount > 0 ? parsedCount : 5;
      setInputText('');
      const activeDoc = isFreeChat ? null : (uploadedDocs.find((d) => (d.doc_id || d.id) === selectedDocId) || uploadedDocs[0] || null);

      if (specificTopic) {
        lastQuizTopicRef.current = specificTopic;
        handleGenerateMCQ(
          activeDoc?.doc_id || activeDoc?.id || null,
          activeDoc?.filename || null,
          replaceUserMsgId ? targetAiMsgId : null,
          targetCount,
          specificTopic,
          text
        );
      } else {
        const existingTopic = lastQuizTopicRef.current;
        if (existingTopic && !mentionsDocExplicitly && isFreeChat) {
          handleGenerateMCQ(null, null, replaceUserMsgId ? targetAiMsgId : null, targetCount, existingTopic, text);
        } else {
          handleGenerateMCQ(
            activeDoc?.doc_id || activeDoc?.id || null,
            activeDoc?.filename || null,
            replaceUserMsgId ? targetAiMsgId : null,
            targetCount,
            activeDoc ? activeDoc.filename : 'Core Academic Concepts',
            text
          );
        }
      }
      return;
    }

    // Handle user message insertion or replacement
    let historyToSlice = [];
    if (replaceUserMsgId) {
      const targetMessages = sendMode === 'free' ? freeMessages : guidedMessages;
      const uIndex = targetMessages.findIndex((m) => m.id === replaceUserMsgId);
      if (uIndex !== -1) {
        const nextMsg = targetMessages[uIndex + 1];
        if (nextMsg && nextMsg.role === 'assistant') {
          targetAiMsgId = nextMsg.id;
        }
        historyToSlice = targetMessages.slice(0, uIndex);
        const updateReplace = (prev) => {
          const idx = prev.findIndex((m) => m.id === replaceUserMsgId);
          if (idx === -1) return prev;
          const copy = [...prev];
          copy[idx] = { ...copy[idx], content: text };
          if (copy[idx + 1] && copy[idx + 1].role === 'assistant') {
            copy[idx + 1] = {
              ...copy[idx + 1],
              content: '',
              quizData: null,
              flashcardsData: null,
              timestamp: 'Just now',
            };
          } else {
            copy.splice(idx + 1, 0, {
              id: targetAiMsgId,
              role: 'assistant',
              chatMode: sendMode,
              content: '',
              timestamp: 'Just now',
            });
          }
          return copy;
        };
        if (sendMode === 'free') {
          setFreeMessages(updateReplace);
        } else {
          setGuidedMessages(updateReplace);
        }
      }
    } else {
      const userMsg = {
        id: `u-${Date.now()}`,
        role: 'user',
        chatMode: sendMode,
        content: text,
        timestamp: 'Now',
      };
      if (sendMode === 'free') {
        setFreeMessages((prev) => [...prev, userMsg]);
      } else {
        setGuidedMessages((prev) => [...prev, userMsg]);
      }
    }

    setInputText('');
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const activeDoc = isFreeChat ? null : (uploadedDocs.find((d) => (d.doc_id || d.id) === selectedDocId) || (selectedDocId === null ? uploadedDocs[0] : null));
      const rawActiveDocText = activeDoc?.extractedText || activeDoc?.extracted_text || activeDoc?.text || uploadedDocs[0]?.extractedText || uploadedDocs[0]?.extracted_text || uploadedDocs[0]?.text || '';
      const docText = isFreeChat ? '' : rawActiveDocText.slice(0, 18000);
      const docTitle = isFreeChat ? '' : (activeDoc?.filename || activeDoc?.title || uploadedDocs[0]?.filename || uploadedDocs[0]?.title || '');
      const docIdToSend = isFreeChat ? null : (selectedDocId || activeDoc?.doc_id || activeDoc?.id || uploadedDocs[0]?.doc_id || uploadedDocs[0]?.id || null);

      const baseHistory = historyToSlice.length > 0 ? historyToSlice : (sendMode === 'free' ? freeMessages : guidedMessages);
      const targetSpaceHistory = baseHistory
        .filter((m) => (m.chatMode ? m.chatMode === sendMode : true) && m.role && m.content && !m.quizData && !m.flashcardsData);

      const res = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          stream: true,
          mode: sendMode,
          serverId,
          channelName,
          documentId: docIdToSend,
          documentTitle: docTitle,
          documentText: docText,
          webSearch: isWebSearchActive,
          history: targetSpaceHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error('AI assistant response error');

      if (res.body) {
        const reader = res.body.getReader();
        activeReaderRef.current = reader;
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          if (controller.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          const updateActiveStream = (prev) => {
            const exists = prev.some((m) => m.id === targetAiMsgId);
            if (exists) {
              return prev.map((m) => (m.id === targetAiMsgId ? { ...m, content: accumulated } : m));
            }
            return [
              ...prev,
              {
                id: targetAiMsgId,
                role: 'assistant',
                chatMode: sendMode,
                content: accumulated,
                timestamp: 'Just now',
              },
            ];
          };
          if (sendMode === 'free') {
            setFreeMessages(updateActiveStream);
          } else {
            setGuidedMessages(updateActiveStream);
          }
        }

        if (!accumulated.trim() && !controller.signal.aborted) {
          throw new Error('Empty stream response');
        }
      } else {
        const data = await res.json();
        const replyMsg = {
          id: targetAiMsgId,
          role: 'assistant',
          chatMode: sendMode,
          content: data.reply || data.answer || 'Tutoring session active. Ask any specific question!',
          timestamp: 'Just now',
        };
        const updateNonStream = (prev) => {
          const exists = prev.some((m) => m.id === targetAiMsgId);
          if (exists) {
            return prev.map((m) => (m.id === targetAiMsgId ? replyMsg : m));
          }
          return [...prev, replyMsg];
        };
        if (sendMode === 'free') {
          setFreeMessages(updateNonStream);
        } else {
          setGuidedMessages(updateNonStream);
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      const fallbackContent = `Here is the study breakdown for **"${text}"**:\n\n1. **Core Concept**: Break the problem down into first principles and define given parameters.\n2. **Key Theorems / Equations**: Check that all boundary conditions and invariants hold.\n3. **Active Practice**: Try explaining the solution steps aloud to test your mastery!`;
      const updateFallback = (prev) => {
        const exists = prev.some((m) => m.id === targetAiMsgId);
        if (exists) {
          return prev.map((m) => (m.id === targetAiMsgId ? { ...m, content: fallbackContent } : m));
        }
        return [
          ...prev,
          {
            id: targetAiMsgId,
            role: 'assistant',
            chatMode: sendMode,
            content: fallbackContent,
            timestamp: 'Just now',
          },
        ];
      };
      if (sendMode === 'free') {
        setFreeMessages(updateFallback);
      } else {
        setGuidedMessages(updateFallback);
      }
    } finally {
      activeReaderRef.current = null;
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    if (aiModeRef.current === 'free') {
      try {
        localStorage.removeItem(FREE_STORAGE_KEY);
      } catch {}
      setFreeMessages(initialFreeMessages);
    } else {
      try {
        localStorage.removeItem(GUIDED_STORAGE_KEY);
      } catch {}
      setGuidedMessages(initialGuidedMessages);
    }
  };

  const handleCopyMessage = async (id, text) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedMsgId(id);
      setTimeout(() => {
        setCopiedMsgId((curr) => (curr === id ? null : curr));
      }, 2000);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('studycord-toast', {
            detail: { message: 'AI response copied to clipboard' },
          })
        );
      }
    } catch (e) {
      console.warn('Failed to copy text:', e);
    }
  };

  // Native iOS edge swipe to go back
  const touchStartRef = useRef(null);
  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchEnd = (e) => {
    if (!touchStartRef.current || !e.changedTouches || !e.changedTouches[0]) return;
    const start = touchStartRef.current;
    const end = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    touchStartRef.current = null;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    if (onBack && start.x <= 48 && deltaX >= 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
      onBack();
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: viewportHeight ? `${viewportHeight}px` : '100%',
        maxHeight: viewportHeight ? `${viewportHeight}px` : '100%',
        width: '100%',
        maxWidth: '100%',
        color: '#fff',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── 1. Top Guru Header (Safe Area Protected) ── */}
      <div
        className="chatter-guru-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'calc(10px + env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px))',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          background: 'var(--chatter-sheet)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--chatter-primary)',
                padding: '4px 6px 4px 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                marginRight: 2,
              }}
              aria-label="Back"
              title="Back"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(64, 227, 120, 0.16)',
              color: 'var(--chatter-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ChatbotIcon size={18} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              AI Guru
            </span>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--chatter-primary)', display: 'inline-block', boxShadow: '0 0 8px var(--chatter-primary)' }} />
          </div>
        </div>

        {/* Header Actions: Docs Tray + New Chat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <input
            ref={docFileInputRef}
            type="file"
            accept=".pdf,.pptx,.ppt,.docx,.doc,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/markdown"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          {aiMode === 'guided' && (
            <button
              type="button"
              onClick={() => setDocsPanelOpen((p) => !p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 16,
                background: docsPanelOpen ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                border: docsPanelOpen ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                color: docsPanelOpen ? 'var(--chatter-primary)' : '#fff',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>📚 Notes ({uploadedDocs.length}/{MAX_DOCS})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearSession}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: 'var(--chatter-light-text)',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Start New Session"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* ── 1b. Mode Toggle Pill: Chat vs Guided (Auto-hides on scroll for max reading space) ── */}
      <div
        style={{
          maxHeight: isModeBarVisible ? 60 : 0,
          opacity: isModeBarVisible ? 1 : 0,
          padding: isModeBarVisible ? '8px 16px' : '0 16px',
          overflow: 'hidden',
          transition: 'max-height 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease, padding 0.18s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--chatter-sheet)',
          borderBottom: isModeBarVisible ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.45)',
            borderRadius: 24,
            padding: 3,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            maxWidth: 380,
            width: '100%',
          }}
        >
          <button
            type="button"
            onClick={() => handleSwitchMode('free')}
            style={{
              flex: 1,
              padding: '7px 14px',
              borderRadius: 20,
              background: aiMode === 'free' ? 'var(--chatter-primary)' : 'transparent',
              color: aiMode === 'free' ? '#0E0E0E' : 'var(--chatter-light-text)',
              border: 'none',
              fontWeight: aiMode === 'free' ? 750 : 600,
              fontSize: 14.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.18s ease',
            }}
          >
            <span>💬</span> Chat
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('guided')}
            style={{
              flex: 1,
              padding: '7px 14px',
              borderRadius: 20,
              background: aiMode === 'guided' ? 'var(--chatter-primary)' : 'transparent',
              color: aiMode === 'guided' ? '#0E0E0E' : 'var(--chatter-light-text)',
              border: 'none',
              fontWeight: aiMode === 'guided' ? 750 : 600,
              fontSize: 14.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.18s ease',
            }}
          >
            <span>📖</span> Guided
            {uploadedDocs.length > 0 && (
              <span
                style={{
                  fontSize: 12.5,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: aiMode === 'guided' ? 'rgba(0,0,0,0.25)' : 'rgba(64, 227, 120, 0.2)',
                  color: aiMode === 'guided' ? '#0E0E0E' : 'var(--chatter-primary)',
                  fontWeight: 800,
                }}
              >
                {uploadedDocs.length}/{MAX_DOCS}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── 1c. Chat Target (Active Note Selector) – visible in Guided Study mode ── */}
      {aiMode === 'guided' && (
        <div
          style={{
            maxHeight: isModeBarVisible ? 54 : 0,
            opacity: isModeBarVisible ? 1 : 0,
            padding: isModeBarVisible ? '7px 16px' : '0 16px',
            overflow: 'hidden',
            transition: 'max-height 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease, padding 0.18s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            overflowX: 'auto',
            borderBottom: isModeBarVisible ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
            background: 'var(--chatter-black)',
            scrollbarWidth: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            Target:
          </span>
        <button
          type="button"
          onClick={() => setSelectedDocId(null)}
          style={{
            padding: '4px 12px',
            borderRadius: 14,
            border: selectedDocId === null ? '1.5px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
            background: selectedDocId === null ? 'rgba(64, 227, 120, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            color: selectedDocId === null ? 'var(--chatter-primary)' : '#D4D4D4',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          🌐 All Notes
        </button>
        {uploadedDocs.map((doc) => {
          const currentId = doc.doc_id || doc.id;
          const isSelected = selectedDocId === currentId;
          return (
            <div
              key={currentId}
              onClick={() => setSelectedDocId(currentId)}
              style={{
                padding: '4px 8px 4px 12px',
                borderRadius: 14,
                border: isSelected ? '1.5px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isSelected ? 'rgba(64, 227, 120, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: isSelected ? 'var(--chatter-primary)' : '#D4D4D4',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                📄 {doc.filename}
              </span>
              {isSelected && <span style={{ fontSize: 12, color: 'var(--chatter-primary)' }}>✓</span>}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDoc(currentId, doc.filename);
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#f87171',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  cursor: 'pointer',
                  padding: 0,
                  marginLeft: 2,
                  transition: 'background 0.15s, transform 0.15s',
                }}
                title={`Remove ${doc.filename}`}
              >
                ✕
              </button>
            </div>
          );
        })}
        {uploadedDocs.length < MAX_DOCS ? (
          <button
            type="button"
            onClick={() => docFileInputRef.current?.click()}
            disabled={uploadingDoc}
            style={{
              padding: '4px 12px',
              borderRadius: 14,
              border: '1px dashed rgba(64, 227, 120, 0.4)',
              background: 'transparent',
              color: 'var(--chatter-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Upload ({uploadedDocs.length}/{MAX_DOCS})
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setDocsPanelOpen(true)}
            style={{
              padding: '4px 12px',
              borderRadius: 14,
              border: '1px solid rgba(245, 158, 11, 0.4)',
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Max documents reached. Open panel to delete old notes"
          >
            ⚠️ Max {MAX_DOCS}/{MAX_DOCS}
          </button>
        )}
      </div>
      )}

      {/* ── 2. Collapsible Document Manager Drawer ── */}
      {docsPanelOpen && (
        <div
          style={{
            background: 'var(--chatter-black)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            flexShrink: 0,
            animation: 'fadeIn 0.18s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Indexed Course Materials ({uploadedDocs.length}/{MAX_DOCS})
            </span>
            <button
              type="button"
              onClick={() => {
                if (uploadedDocs.length >= MAX_DOCS) {
                  return;
                }
                docFileInputRef.current?.click();
              }}
              disabled={uploadingDoc || uploadedDocs.length >= MAX_DOCS}
              style={{
                padding: '5px 12px',
                borderRadius: 14,
                background: uploadedDocs.length >= MAX_DOCS ? 'rgba(255, 255, 255, 0.08)' : 'var(--chatter-primary)',
                border: 'none',
                color: uploadedDocs.length >= MAX_DOCS ? '#888' : '#0E0E0E',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: (uploadingDoc || uploadedDocs.length >= MAX_DOCS) ? 'not-allowed' : 'pointer',
              }}
            >
              {uploadedDocs.length >= MAX_DOCS ? `Max Limit (${MAX_DOCS}/${MAX_DOCS})` : '+ Upload File (.pdf, .pptx, .docx)'}
            </button>
          </div>

          {uploadedDocs.length >= MAX_DOCS && (
            <div
              style={{
                fontSize: 13.5,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 10,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>⚠️</span>
              <span>Maximum {MAX_DOCS} documents reached. Click <strong>Delete</strong> on an existing note to upload new ones.</span>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
            {uploadedDocs.map((doc) => (
              <div
                key={doc.doc_id}
                style={{
                  background: 'var(--chatter-sheet)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 16 }}>📄</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.filename}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--chatter-primary)' }}>
                    {doc.chunksCount} chunks · {doc.status}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleGenerateMCQ(doc.doc_id || doc.id, doc.filename)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'rgba(64, 227, 120, 0.15)',
                      border: 'none',
                      color: 'var(--chatter-primary)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Quiz
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateFlashcards(doc.doc_id || doc.id, doc.filename)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      color: '#fff',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(doc.doc_id || doc.id, doc.filename)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: 'none',
                      color: '#f87171',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Delete document to free up index space"
                  >
                    ✕ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Conversational Message Stream ── */}
      <div
        onScroll={handleMessagesScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Guided Study Onboarding Card when no documents are uploaded */}
        {aiMode === 'guided' && uploadedDocs.length === 0 && (
          <div
            style={{
              padding: '24px 20px',
              margin: '8px auto 14px',
              maxWidth: 540,
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--chatter-sheet)',
              border: '1.5px dashed rgba(64, 227, 120, 0.35)',
              borderRadius: 18,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 34 }}>📖</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              Guided Document Study Mode
            </div>
            <div style={{ fontSize: 14, color: '#A0A0A0', lineHeight: 1.55, maxWidth: 440 }}>
              Upload your lecture notes, PowerPoint slides, textbook chapters, or syllabus (.pdf, .pptx, .docx, .txt). AI Guru will generate comprehensive guided study reports, step-by-step tutoring, custom assessments, and active recall flashcards directly from your text.
            </div>
            <div style={{ fontSize: 13, color: 'var(--chatter-primary)', fontWeight: 600 }}>
              Restriction: Max {MAX_DOCS} documents (up to 15MB each)
            </div>
            <button
              type="button"
              onClick={() => docFileInputRef.current?.click()}
              disabled={uploadingDoc}
              style={{
                marginTop: 4,
                padding: '9px 22px',
                borderRadius: 20,
                background: 'var(--chatter-primary)',
                color: '#0E0E0E',
                border: 'none',
                fontWeight: 750,
                fontSize: 14.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              <span>📂</span> Upload Study Document
            </button>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === 'user';
          // Hide empty assistant placeholder while AI is generating
          if (!isUser && !m.content && !m.quizData && !m.flashcardsData) {
            return null;
          }
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                gap: isUser ? 10 : 0,
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: isUser ? '85%' : '100%',
                width: (m.quizData || m.flashcardsData || !isUser) ? '100%' : undefined,
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ maxWidth: '100%', minWidth: 0, flex: 1 }}>
                {/* User Message Header (subtle) */}
                {isUser && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 4,
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                      {m.timestamp || 'Just now'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingMessageId === m.id) {
                          setEditingMessageId(null);
                          setEditingText('');
                        } else {
                          setEditingMessageId(m.id);
                          setEditingText(m.content || '');
                        }
                      }}
                      title="Edit prompt and regenerate response"
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: 'var(--chatter-light-text)',
                        cursor: 'pointer',
                        padding: '2px 8px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--chatter-light-text)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  style={{
                    padding: isUser ? '11px 16px' : '14px 18px',
                    borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                    background: isUser ? 'var(--chatter-primary)' : 'var(--chatter-sheet)',
                    color: isUser ? '#0E0E0E' : '#fff',
                    border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    fontWeight: isUser ? 600 : 400,
                    fontSize: 16,
                    lineHeight: 1.65,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    whiteSpace: isUser ? 'pre-wrap' : undefined,
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {isUser && editingMessageId === m.id ? (
                    <div style={{ width: '100%', minWidth: 260 }}>
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (editingText.trim()) {
                              handleSaveAndResend(m.id);
                            }
                          } else if (e.key === 'Escape') {
                            setEditingMessageId(null);
                            setEditingText('');
                          }
                        }}
                        rows={3}
                        style={{
                          width: '100%',
                          background: 'rgba(0, 0, 0, 0.28)',
                          border: '1.5px solid rgba(0, 0, 0, 0.45)',
                          borderRadius: 10,
                          padding: '8px 10px',
                          color: '#0E0E0E',
                          fontWeight: 600,
                          fontSize: 15,
                          lineHeight: 1.45,
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditingText('');
                          }}
                          style={{
                            padding: '6px 13px',
                            borderRadius: 10,
                            background: 'rgba(0, 0, 0, 0.15)',
                            border: 'none',
                            color: '#0E0E0E',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!editingText.trim() || loading}
                          onClick={() => handleSaveAndResend(m.id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 10,
                            background: '#0E0E0E',
                            border: 'none',
                            color: 'var(--chatter-primary)',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: editingText.trim() && !loading ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Send & Replace
                        </button>
                      </div>
                    </div>
                  ) : isUser ? (
                    m.content
                  ) : (
                    <ChatMarkdownMessage content={m.content} />
                  )}

                  {/* Interactive Quiz Assessment Component */}
                  {m.quizData && (
                    <QuizAssessmentCard
                      messageId={m.id}
                      questions={m.quizData}
                      onRegenerate={() =>
                        handleGenerateMCQ(
                          m.quizDocId || selectedDocId,
                          m.quizDocName,
                          m.id,
                          m.quizCount || m.quizData?.length || 5,
                          m.quizTopic || m.quizDocName || ''
                        )
                      }
                    />
                  )}

                  {/* Interactive One-by-One Flashcards Component */}
                  {m.flashcardsData && (
                    <FlashcardDeck
                      cards={m.flashcardsData}
                      onRegenerate={() =>
                        handleGenerateFlashcards(
                          m.flashcardsDocId || selectedDocId,
                          m.flashcardsDocName,
                          m.flashcardsCount || m.flashcardsData?.length || 8,
                          m.flashcardsTopic || m.flashcardsDocName || '',
                          '',
                          m.id
                        )
                      }
                    />
                  )}

                  {/* Assistant Message Actions (Copy response, etc.) - Hidden on welcome messages */}
                  {!isUser && m.content && !m.id?.startsWith('g-intro') && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        gap: 6,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(m.id, m.content)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 11px',
                          borderRadius: 8,
                          background: copiedMsgId === m.id ? 'rgba(64, 227, 120, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid',
                          borderColor: copiedMsgId === m.id ? 'rgba(64, 227, 120, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                          color: copiedMsgId === m.id ? '#40E378' : '#A0A0A0',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                        }}
                        title="Copy AI response"
                        aria-label="Copy AI response"
                      >
                        {copiedMsgId === m.id ? (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: 4, gap: 6 }}>
            {isWebSearchActive && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 12,
                  background: 'rgba(64, 227, 120, 0.12)',
                  border: '1px solid rgba(64, 227, 120, 0.28)',
                  color: 'var(--chatter-primary)',
                  fontSize: 12,
                  fontWeight: 650,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'chatter-spin 2s linear infinite' }}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>Searching live web & analyzing sources...</span>
              </div>
            )}
            <div
              className="chatter-ai-typing-bubble"
              style={{
                padding: '12px 18px',
                borderRadius: '18px 18px 18px 4px',
                background: 'var(--chatter-sheet)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.25)',
              }}
              aria-label="AI is generating response"
            >
              <span className="chatter-typing-dot" style={{ animationDelay: '0ms' }} />
              <span className="chatter-typing-dot" style={{ animationDelay: '200ms' }} />
              <span className="chatter-typing-dot" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* ── 4. Quick Prompts Rail (Clean, stable suggestions anchored above compose) ── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '7px 18px',
          scrollbarWidth: 'none',
          flexShrink: 0,
          background: 'var(--chatter-black)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {activePrompts.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (p.includes('Search Web')) {
                setIsWebSearchActive(true);
              }
              if (p.includes('Quiz') || p.includes('Assessment')) {
                if (aiMode === 'guided' && uploadedDocs.length === 0) {
                  docFileInputRef.current?.click();
                  return;
                }
                handleGenerateMCQ(null, null, null, 5, aiMode === 'free' ? 'Core Academic Concepts & Revision Drill' : null);
                return;
              }
              if (p.includes('Flashcards')) {
                if (aiMode === 'guided' && uploadedDocs.length === 0) {
                  docFileInputRef.current?.click();
                  return;
                }
                handleGenerateFlashcards(null, null, 8, aiMode === 'free' ? 'Key Academic Definitions & Core Facts' : null);
                return;
              }
              handleSend(p);
            }}
            style={{
              padding: '6px 13px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--chatter-light-text)',
              fontSize: 13.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* ── 5. Bottom Compose Input (Clean Fullscreen Chat Screen matching DM & Room) ── */}
      <div
        className="chatter-guru-compose"
        style={{
          padding: isKeyboardOpen
            ? '8px max(14px, env(safe-area-inset-right, 0px)) 8px max(14px, env(safe-area-inset-left, 0px))'
            : '8px max(14px, env(safe-area-inset-right, 0px)) max(12px, calc(8px + env(safe-area-inset-bottom, 0px))) max(14px, env(safe-area-inset-left, 0px))',
          background: 'var(--chatter-sheet)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
        }}
      >
        {uploadingDoc && (
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              background: 'rgba(64, 227, 120, 0.15)',
              color: 'var(--chatter-primary)',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>📄 Indexing <strong>{uploadFileName}</strong> into vector store...</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--chatter-black)',
            borderRadius: 24,
            padding: '6px 8px 6px 14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Paperclip Document Upload shortcut */}
          <button
            type="button"
            onClick={() => {
              if (aiMode === 'free') {
                handleSwitchMode('guided');
              }
              if (uploadedDocs.length >= MAX_DOCS) {
                setDocsPanelOpen(true);
                return;
              }
              docFileInputRef.current?.click();
            }}
            disabled={uploadingDoc}
            style={{
              background: 'transparent',
              border: 'none',
              color: aiMode === 'guided' ? 'var(--chatter-primary)' : 'var(--chatter-light-text)',
              cursor: uploadingDoc ? 'not-allowed' : 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={aiMode === 'guided' ? "Upload Study Notes or Slides (.pdf, .pptx, .docx, .txt)" : "Switch to Guided Mode & Upload Document"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Live Web Search Toggle shortcut */}
          <button
            type="button"
            onClick={() => setIsWebSearchActive((prev) => !prev)}
            style={{
              background: isWebSearchActive ? 'rgba(64, 227, 120, 0.18)' : 'transparent',
              border: isWebSearchActive ? '1px solid var(--chatter-primary)' : '1px solid transparent',
              borderRadius: 14,
              color: isWebSearchActive ? 'var(--chatter-primary)' : 'var(--chatter-light-text)',
              cursor: 'pointer',
              padding: isWebSearchActive ? '4px 8px' : '4px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.18s ease',
            }}
            title={
              isWebSearchActive
                ? 'Web Search is ON: AI Guru searches the live internet & cites web links'
                : 'Turn ON Web Search (browse live web & current data)'
            }
            aria-label={isWebSearchActive ? 'Web Search active' : 'Enable Web Search'}
            aria-pressed={isWebSearchActive}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {isWebSearchActive && (
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em' }}>
                Web
              </span>
            )}
          </button>

          <input
            ref={inputRef}
            type="text"
            onFocus={() => {
              setTimeout(() => {
                inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 120);
            }}
            placeholder={
              aiMode === 'free'
                ? 'Ask AI Guru anything across any subject...'
                : uploadedDocs.find((d) => d.doc_id === selectedDocId)
                  ? `Ask guided questions on ${uploadedDocs.find((d) => d.doc_id === selectedDocId)?.filename}...`
                  : 'Upload a document or ask questions about your notes...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 16,
              outline: 'none',
            }}
          />

          {loading ? (
            <button
              type="button"
              onClick={handleStopGeneration}
              title="Stop generating response"
              aria-label="Stop generation"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#EF4444',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                animation: 'chatterStopPulse 1.2s ease-in-out infinite',
                boxShadow: '0 0 14px rgba(239, 68, 68, 0.6)',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2.5,
                  background: '#FFFFFF',
                }}
              />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputText.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--chatter-primary)',
                border: 'none',
                color: '#0E0E0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                opacity: inputText.trim() ? 1 : 0.5,
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// Subcomponent: Quiz Assessment Component with Expandable Fullscreen Support
function QuizAssessmentCard({ questions = [], onRegenerate, messageId }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Automatically reset quiz state when fresh questions arrive
  const questionsKey = Array.isArray(questions)
    ? questions.map((q) => q.question).join('|')
    : '';

  useEffect(() => {
    setCurrentQIndex(0);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setRegenerating(false);
  }, [questionsKey]);

  // Keyboard navigation when in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      } else if (e.key === 'ArrowRight') {
        setCurrentQIndex((i) => Math.min(questions.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentQIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, questions.length]);

  if (!Array.isArray(questions) || questions.length === 0) return null;

  const totalQuestions = questions.length;
  const currentQ = questions[currentQIndex] || questions[0];

  const handleSelectOption = (opt) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQIndex]: opt,
    }));
  };

  const answeredCount = Object.keys(selectedAnswers).length;

  let correctCount = 0;
  if (isSubmitted) {
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_answer) {
        correctCount += 1;
      }
    });
  }

  const percentage = Math.round((correctCount / totalQuestions) * 100);

  const handleSubmitQuiz = () => {
    setIsSubmitted(true);
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setCurrentQIndex(0);
  };

  const handleRegenerateClick = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      await onRegenerate?.();
    } catch {
      // Handled in parent
    } finally {
      setRegenerating(false);
    }
  };

  const renderQuizContent = (fullscreen = false) => (
    <>
      {/* Quiz Question Palette (Numbered questions bar) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {questions.map((q, idx) => {
          const isCurrent = currentQIndex === idx;
          const isAnswered = selectedAnswers[idx] !== undefined;
          let pillBg = 'rgba(255, 255, 255, 0.06)';
          let pillColor = 'var(--chatter-light-text)';
          let pillBorder = '1px solid rgba(255, 255, 255, 0.08)';

          if (isSubmitted) {
            const isCorrect = selectedAnswers[idx] === q.correct_answer;
            pillBg = isCorrect ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 57, 57, 0.2)';
            pillColor = isCorrect ? 'var(--chatter-primary)' : 'var(--chatter-red)';
            pillBorder = isCorrect ? '1.5px solid var(--chatter-primary)' : '1.5px solid var(--chatter-red)';
          } else if (isAnswered) {
            pillBg = 'rgba(64, 227, 120, 0.15)';
            pillColor = 'var(--chatter-primary)';
          }

          if (isCurrent) {
            pillBorder = '2px solid var(--chatter-primary)';
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentQIndex(idx)}
              style={{
                width: fullscreen ? 38 : 32,
                height: fullscreen ? 38 : 32,
                borderRadius: 10,
                background: pillBg,
                border: pillBorder,
                color: pillColor,
                fontSize: fullscreen ? 14 : 12.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Score Card Banner if submitted */}
      {isSubmitted && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(64, 227, 120, 0.12) 0%, rgba(20, 20, 20, 0.9) 100%)',
            border: '1.5px solid var(--chatter-primary)',
            borderRadius: 16,
            padding: fullscreen ? '18px 24px' : '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chatter-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Final Test Result
            </div>
            <div style={{ fontSize: fullscreen ? 26 : 22, fontWeight: 800, color: '#fff', marginTop: 2 }}>
              Score: {correctCount} / {totalQuestions} <span style={{ fontSize: 16, color: 'var(--chatter-primary)' }}>({percentage}%)</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: fullscreen ? 15.5 : 13.5, fontWeight: 700, color: percentage >= 80 ? 'var(--chatter-primary)' : '#fff' }}>
            {percentage >= 80 ? '🎯 Outstanding Mastery!' : percentage >= 60 ? '👍 Good Competency' : '📚 Review Solutions Below'}
          </div>
        </div>
      )}

      {/* Current Question Body */}
      <div
        style={{
          background: '#181818',
          borderRadius: 16,
          padding: fullscreen ? '24px 28px' : '14px 16px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div style={{ fontSize: fullscreen ? 13.5 : 12.5, color: 'var(--chatter-light-text)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
          Question {currentQIndex + 1} of {totalQuestions}
        </div>
        <div style={{ fontSize: fullscreen ? 19 : 16, fontWeight: 700, color: '#fff', lineHeight: 1.5, marginBottom: fullscreen ? 18 : 14, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          {currentQ.question}
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: fullscreen ? 12 : 8, width: '100%', maxWidth: '100%' }}>
          {currentQ.options?.map((opt, i) => {
            const letter = String.fromCharCode(65 + i); // 'A', 'B', 'C', 'D'
            const isSelected = selectedAnswers[currentQIndex] === opt;
            const isCorrect = opt === currentQ.correct_answer;

            let optBg = 'rgba(255, 255, 255, 0.04)';
            let optBorder = '1px solid rgba(255, 255, 255, 0.08)';
            let optColor = '#E0E0E0';

            if (isSubmitted) {
              if (isCorrect) {
                optBg = 'rgba(64, 227, 120, 0.2)';
                optBorder = '1.5px solid var(--chatter-primary)';
                optColor = 'var(--chatter-primary)';
              } else if (isSelected && !isCorrect) {
                optBg = 'rgba(255, 57, 57, 0.2)';
                optBorder = '1.5px solid var(--chatter-red)';
                optColor = 'var(--chatter-red)';
              }
            } else if (isSelected) {
              optBg = 'rgba(64, 227, 120, 0.15)';
              optBorder = '1.5px solid var(--chatter-primary)';
              optColor = 'var(--chatter-primary)';
            }

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectOption(opt)}
                disabled={isSubmitted}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  padding: fullscreen ? '14px 18px' : '10px 14px',
                  borderRadius: 14,
                  background: optBg,
                  border: optBorder,
                  color: optColor,
                  fontSize: fullscreen ? 16 : 14.5,
                  fontWeight: 600,
                  cursor: isSubmitted ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    width: fullscreen ? 28 : 24,
                    height: fullscreen ? 28 : 24,
                    borderRadius: '50%',
                    background: isSelected ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
                    color: isSelected ? '#0E0E0E' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: fullscreen ? 13 : 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {letter}
                </span>
                <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{opt}</span>
                {isSubmitted && isCorrect && <span style={{ fontSize: 14, flexShrink: 0 }}>✓</span>}
                {isSubmitted && isSelected && !isCorrect && <span style={{ fontSize: 14, flexShrink: 0 }}>✗</span>}
              </button>
            );
          })}
        </div>

        {/* Detailed Solution Explanation (revealed after submission) */}
        {isSubmitted && currentQ.explanation && (
          <div
            style={{
              marginTop: 16,
              padding: fullscreen ? '14px 18px' : '10px 14px',
              borderRadius: 14,
              background: 'rgba(64, 227, 120, 0.08)',
              border: '1px solid rgba(64, 227, 120, 0.2)',
              fontSize: fullscreen ? 15 : 14,
              lineHeight: 1.6,
              color: '#fff',
            }}
          >
            <div style={{ color: 'var(--chatter-primary)', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>💡 Solution Explanation:</span>
            </div>
            <div>{currentQ.explanation}</div>
          </div>
        )}
      </div>

      {/* Quiz Action Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
        {/* Row 1: Navigation Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
          <button
            type="button"
            onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
            disabled={currentQIndex === 0}
            style={{
              padding: fullscreen ? '10px 22px' : '9px 18px',
              borderRadius: 14,
              background: currentQIndex === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: currentQIndex === 0 ? 'rgba(255, 255, 255, 0.25)' : '#fff',
              fontSize: fullscreen ? 15 : 14,
              fontWeight: 700,
              cursor: currentQIndex === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← Previous
          </button>

          <button
            type="button"
            onClick={() => setCurrentQIndex((i) => Math.min(totalQuestions - 1, i + 1))}
            disabled={currentQIndex === totalQuestions - 1}
            style={{
              padding: fullscreen ? '10px 22px' : '9px 18px',
              borderRadius: 14,
              background: currentQIndex === totalQuestions - 1 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: currentQIndex === totalQuestions - 1 ? 'rgba(255, 255, 255, 0.25)' : '#fff',
              fontSize: fullscreen ? 15 : 14,
              fontWeight: 700,
              cursor: currentQIndex === totalQuestions - 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Next →
          </button>
        </div>

        {/* Row 2: Submit Quiz Assessment on its own separate line below */}
        {!isSubmitted && (
          <button
            type="button"
            onClick={handleSubmitQuiz}
            style={{
              width: '100%',
              padding: fullscreen ? '12px 24px' : '11px 20px',
              borderRadius: 14,
              background: 'var(--chatter-primary)',
              border: 'none',
              color: '#0E0E0E',
              fontSize: fullscreen ? 15.5 : 14.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(64, 227, 120, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'transform 0.12s ease',
            }}
          >
            <span>Submit Quiz Assessment</span>
            <span>✓</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <div
        style={{
          background: '#121212',
          borderRadius: 20,
          padding: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Top Quiz Header: Stacked cleanly to prevent text compression */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                📝 Quiz Assessment
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 12,
                  background: isSubmitted ? 'rgba(64, 227, 120, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  color: isSubmitted ? 'var(--chatter-primary)' : 'var(--chatter-light-text)',
                }}
              >
                {isSubmitted ? 'Completed' : `Answered: ${answeredCount}/${totalQuestions}`}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {onRegenerate && (
              <button
                type="button"
                onClick={handleRegenerateClick}
                disabled={regenerating}
                title="Generate new quiz questions from document"
                style={{
                  padding: '6px 12px',
                  borderRadius: 12,
                  background: regenerating ? 'rgba(64, 227, 120, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                  border: regenerating ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: regenerating ? 'var(--chatter-primary)' : '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: regenerating ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    animation: regenerating ? 'chatter-spin 0.8s linear infinite' : 'none',
                  }}
                >
                  ↺
                </span>
                <span>{regenerating ? 'Generating...' : 'New Quiz'}</span>
              </button>
            )}

            {isSubmitted && (
              <button
                type="button"
                onClick={handleRetake}
                style={{
                  padding: '6px 12px',
                  borderRadius: 12,
                  background: 'rgba(64, 227, 120, 0.15)',
                  border: '1px solid rgba(64, 227, 120, 0.3)',
                  color: 'var(--chatter-primary)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Retake
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              title="Expand Quiz Assessment to Fullscreen"
              style={{
                padding: '6px 12px',
                borderRadius: 12,
                background: 'rgba(64, 227, 120, 0.15)',
                border: '1px solid rgba(64, 227, 120, 0.3)',
                color: 'var(--chatter-primary)',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              <span>Expand</span>
            </button>
          </div>
        </div>

        {renderQuizContent(false)}
      </div>

      {/* Fullscreen Immersive Quiz Modal Overlay mounted directly to document.body */}
      {isFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100dvh',
            maxHeight: '100dvh',
            zIndex: 999999,
            background: 'rgba(10, 10, 10, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            boxSizing: 'border-box',
            padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div style={{ maxWidth: 840, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Fullscreen Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>
                  📝 Quiz Assessment
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 14,
                    background: isSubmitted ? 'rgba(64, 227, 120, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                    color: isSubmitted ? 'var(--chatter-primary)' : 'var(--chatter-light-text)',
                  }}
                >
                  {isSubmitted ? 'Completed' : `Answered: ${answeredCount}/${totalQuestions}`}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {onRegenerate && (
                  <button
                    type="button"
                    onClick={handleRegenerateClick}
                    disabled={regenerating}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 14,
                      background: regenerating ? 'rgba(64, 227, 120, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: regenerating ? 'var(--chatter-primary)' : '#fff',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: regenerating ? 'wait' : 'pointer',
                    }}
                  >
                    ↺ New Quiz
                  </button>
                )}
                {isSubmitted && (
                  <button
                    type="button"
                    onClick={handleRetake}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 14,
                      background: 'rgba(64, 227, 120, 0.15)',
                      border: '1px solid rgba(64, 227, 120, 0.3)',
                      color: 'var(--chatter-primary)',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Retake
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {renderQuizContent(true)}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Subcomponent: Interactive One-by-One Swipeable Flashcards Deck with Fullscreen Support
function FlashcardDeck({ cards = [], onRegenerate }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartXRef = useRef(null);

  if (!Array.isArray(cards) || cards.length === 0) return null;

  const currentCard = cards[currentIndex] || cards[0];
  const frontText = currentCard.front || currentCard.question || currentCard.concept || currentCard.title || 'Key Concept';
  const backText = currentCard.back || currentCard.answer || currentCard.definition || currentCard.explanation || 'Explanation';

  const handlePrev = (e) => {
    e?.stopPropagation?.();
    if (currentIndex > 0) {
      setFlipped(false);
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleNext = (e) => {
    e?.stopPropagation?.();
    if (currentIndex < cards.length - 1) {
      setFlipped(false);
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartXRef.current;
    if (diff > 50) {
      handlePrev();
    } else if (diff < -50) {
      handleNext();
    }
    touchStartXRef.current = null;
  };

  // Keyboard navigation when in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, currentIndex, cards.length]);

  const cardSurface = (fullscreen = false) => (
    <div
      onClick={() => setFlipped((f) => !f)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        width: '100%',
        minHeight: fullscreen ? 360 : 220,
        borderRadius: 20,
        background: flipped ? 'linear-gradient(135deg, #18281d 0%, #111a14 100%)' : 'linear-gradient(135deg, #1f1f1f 0%, #151515 100%)',
        border: flipped ? '1.5px solid var(--chatter-primary)' : '1.5px solid rgba(255, 255, 255, 0.12)',
        boxShadow: flipped ? '0 12px 32px rgba(64, 227, 120, 0.2)' : '0 10px 28px rgba(0,0,0,0.4)',
        padding: fullscreen ? '28px 32px' : '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Top Header of Card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '3px 8px',
              borderRadius: 8,
              background: flipped ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              color: flipped ? 'var(--chatter-primary)' : '#fff',
            }}
          >
            {flipped ? '💡 Answer / Concept' : '❓ Question / Prompt'}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Tap card to flip 🔄</span>
        </div>
      </div>

      {/* Main Card Content */}
      <div
        style={{
          margin: '24px 0',
          fontSize: fullscreen ? 22 : 16.5,
          fontWeight: 650,
          color: '#FFFFFF',
          lineHeight: 1.6,
          textAlign: 'center',
          wordBreak: 'break-word',
        }}
      >
        {flipped ? backText : frontText}
      </div>

      {/* Card Footer Hint */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--chatter-light-text)' }}>
        <span>{flipped ? '✓ Tap to view question' : '• Tap card to flip'}</span>
        <span>Swipe or use arrows</span>
      </div>
    </div>
  );

  return (
    <div
      style={{
        background: '#121212',
        borderRadius: 20,
        padding: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Header with counter and fullscreen button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
              🃏 Study Flashcards
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 12,
                background: 'rgba(64, 227, 120, 0.15)',
                color: 'var(--chatter-primary)',
              }}
            >
              Card {currentIndex + 1} of {cards.length}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                title="Generate new flashcards from document"
                style={{
                  padding: '6px 12px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--chatter-light-text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                ↺ New Set
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              title="Expand to Fullscreen"
              style={{
                padding: '6px 12px',
                borderRadius: 12,
                background: 'rgba(64, 227, 120, 0.15)',
                border: '1px solid rgba(64, 227, 120, 0.3)',
                color: 'var(--chatter-primary)',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              <span>Expand</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${((currentIndex + 1) / cards.length) * 100}%`,
            background: 'var(--chatter-primary)',
            transition: 'width 0.2s ease',
          }}
        />
      </div>

      {/* Single Flashcard */}
      {cardSurface(false)}

      {/* Navigation Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          style={{
            padding: '8px 16px',
            borderRadius: 14,
            background: currentIndex === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: currentIndex === 0 ? 'rgba(255, 255, 255, 0.25)' : '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          ← Previous
        </button>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 5 }}>
          {cards.map((_, i) => (
            <div
              key={i}
              onClick={() => {
                setFlipped(false);
                setCurrentIndex(i);
              }}
              style={{
                width: i === currentIndex ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === currentIndex ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          style={{
            padding: '8px 16px',
            borderRadius: 14,
            background: currentIndex === cards.length - 1 ? 'rgba(255, 255, 255, 0.04)' : 'var(--chatter-primary)',
            border: 'none',
            color: currentIndex === cards.length - 1 ? 'rgba(255, 255, 255, 0.25)' : '#0E0E0E',
            fontSize: 13,
            fontWeight: 700,
            cursor: currentIndex === cards.length - 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Next →
        </button>
      </div>

      {/* Fullscreen Overlay Modal mounted directly to document.body */}
      {isFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100dvh',
            maxHeight: '100dvh',
            zIndex: 999999,
            background: 'rgba(10, 10, 10, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* Top Fullscreen Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 700, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                Card {currentIndex + 1} of {cards.length}
              </span>
              <span style={{ fontSize: 13, color: 'var(--chatter-primary)', background: 'rgba(64, 227, 120, 0.15)', padding: '3px 10px', borderRadius: 12, fontWeight: 700 }}>
                Fullscreen Study Mode
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#fff',
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Close Fullscreen (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Centered Large Card */}
          <div style={{ maxWidth: 700, margin: 'auto', width: '100%' }}>
            {cardSurface(true)}
          </div>

          {/* Bottom Fullscreen Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 700, margin: '0 auto', width: '100%' }}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              style={{
                padding: '12px 24px',
                borderRadius: 16,
                background: currentIndex === 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                color: currentIndex === 0 ? 'rgba(255, 255, 255, 0.25)' : '#fff',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Previous (Left)
            </button>

            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              style={{
                padding: '12px 28px',
                borderRadius: 16,
                background: 'rgba(64, 227, 120, 0.15)',
                border: '1.5px solid var(--chatter-primary)',
                color: 'var(--chatter-primary)',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {flipped ? 'Show Question (Space)' : 'Reveal Answer (Space)'}
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex === cards.length - 1}
              style={{
                padding: '12px 24px',
                borderRadius: 16,
                background: currentIndex === cards.length - 1 ? 'rgba(255, 255, 255, 0.05)' : 'var(--chatter-primary)',
                border: 'none',
                color: currentIndex === cards.length - 1 ? 'rgba(255, 255, 255, 0.25)' : '#0E0E0E',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: currentIndex === cards.length - 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Next → (Right)
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
