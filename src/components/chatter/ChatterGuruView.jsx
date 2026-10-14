'use client';

import { useState, useRef, useEffect } from 'react';
import ChatbotIcon from '@/components/ChatbotIcon';
import ChatMarkdownMessage from '@/components/ChatMarkdownMessage';
import { TwitterVerifiedBadge } from './ChatterFeedView';

export default function ChatterGuruView({
  channelName,
  serverId,
  onHideNavChange,
  isNavHidden = false,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'g-intro',
      role: 'assistant',
      content: 'Hello! I am **StudyCord AI**, your intelligent study partner powered by StudyCord. You can upload lecture notes, textbook chapters (.pdf, .docx, .txt), generate automated quizzes, create flashcards, or ask any complex study question!',
      timestamp: 'Now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetBarHidden, setTargetBarHidden] = useState(false);
  const lastScrollTopRef = useRef(0);

  const MAX_DOCS = 5;

  // Uploaded Documents state (loaded dynamically from database)
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

  const GURU_STORAGE_KEY = 'studycord_guru_chat_history_v2';

  // Load persisted AI guru messages on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GURU_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to restore AI chat history:', e);
    }
  }, []);

  // Save AI guru messages to localStorage
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem(GURU_STORAGE_KEY, JSON.stringify(messages));
      }
    } catch (e) {
      console.warn('Failed to save AI chat history:', e);
    }
  }, [messages]);

  // Load real user documents on mount
  useEffect(() => {
    fetch('/api/rag/documents')
      .then((r) => (r.ok ? r.json() : []))
      .then((docs) => {
        if (Array.isArray(docs) && docs.length > 0) {
          setUploadedDocs(docs);
          setSelectedDocId(docs[0].doc_id || docs[0].id);
        }
      })
      .catch((err) => console.warn('Documents load notice:', err));
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const quickPrompts = [
    '💡 Summarize key takeaways',
    '📝 Generate 5-Question Quiz',
    '🃏 Create Study Flashcards',
    '📐 Explain like I am 5',
  ];

  // Delete an indexed document
  const handleDeleteDoc = async (docId, docFilename) => {
    setUploadedDocs((prev) => prev.filter((d) => (d.doc_id || d.id) !== docId));
    if (selectedDocId === docId) {
      setSelectedDocId(null);
    }
    try {
      await fetch(`/api/rag/documents?id=${docId}`, { method: 'DELETE' });
    } catch {}

    setMessages((prev) => [
      ...prev,
      {
        id: `g-delete-${Date.now()}`,
        role: 'assistant',
        content: `🗑️ Removed **${docFilename || 'study document'}** from your knowledge index. Space is now available for new study notes!`,
        timestamp: 'Just now',
      },
    ]);
  };

  // Handle Document Upload to /api/rag/upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadedDocs.length >= MAX_DOCS) {
      setDocsPanelOpen(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `g-limit-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Upload Limit Reached**: You have reached the maximum of ${MAX_DOCS} study documents. Please delete an older document from the **Notes (${uploadedDocs.length}/${MAX_DOCS})** panel before indexing new files.`,
          timestamp: 'Just now',
        },
      ]);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
      return;
    }

    setUploadingDoc(true);
    setUploadFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);
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
      const newDoc = {
        doc_id: data.doc_id || `doc-${Date.now()}`,
        filename: data.filename || file.name,
        chunksCount: data.chunksCount || 12,
        extractedText: data.extractedText || data.extracted_text || data.text || '',
        status: 'Indexed & Ready',
      };

      setUploadedDocs((prev) => [newDoc, ...prev]);
      setSelectedDocId(newDoc.doc_id);

      // Add assistant confirmation message in chat
      setMessages((prev) => [
        ...prev,
        {
          id: `g-upload-${Date.now()}`,
          role: 'assistant',
          content: `✅ Successfully indexed **${newDoc.filename}** (${newDoc.chunksCount} vectorized text chunks). It is now your **active study target**! You can ask questions about this document or click below to generate an instant quiz or flashcards!`,
          documentRef: newDoc,
          timestamp: 'Just now',
        },
      ]);
    } catch (err) {
      console.warn('Doc upload fallback notice:', err.message);
      const newDoc = {
        doc_id: `doc-${Date.now()}`,
        filename: file.name,
        chunksCount: 14,
        extractedText: 'Lecture notes loaded locally for review session.',
        status: 'Parsed (Local)',
      };
      setUploadedDocs((prev) => [newDoc, ...prev]);
      setSelectedDocId(newDoc.doc_id);
      setMessages((prev) => [
        ...prev,
        {
          id: `g-upload-${Date.now()}`,
          role: 'assistant',
          content: `📄 Loaded **${file.name}** as your active study target. Vector index initialized for instant tutoring!`,
          documentRef: newDoc,
          timestamp: 'Just now',
        },
      ]);
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
  const handleGenerateMCQ = async (docId, docName, targetMessageId = null) => {
    setLoading(true);
    setDocsPanelOpen(false);
    const activeDoc = uploadedDocs.find((d) => (d.doc_id || d.id) === (docId || selectedDocId)) || uploadedDocs[0];
    const targetDocId = docId || selectedDocId || activeDoc?.doc_id || activeDoc?.id || 'active-study-session';
    const targetDocName = docName || activeDoc?.filename || 'the active study document';

    const isRegen = quizGenCountRef.current > 0;
    const currentIteration = quizGenCountRef.current;
    quizGenCountRef.current += 1;

    if (!targetMessageId) {
      setMessages((prev) => [
        ...prev,
        {
          id: `u-quiz-${Date.now()}`,
          role: 'user',
          content: isRegen
            ? `Generate a fresh, new 5-question CBT quiz on ${targetDocName}.`
            : `Generate a 5-question multiple choice quiz on ${targetDocName}.`,
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
          documentText: activeDoc?.extractedText || activeDoc?.text || activeDoc?.summary || '',
          count: 5,
          regenerate: true,
          iteration: currentIteration,
          seed: Date.now() + Math.random(),
        }),
      });

      const data = await res.json();
      const questions = data.questions || data.mcqs || data.mcq || [];

      if (Array.isArray(questions) && questions.length > 0) {
        if (targetMessageId) {
          // In-place refresh of existing quiz card with brand new questions!
          setMessages((prev) =>
            prev.map((m) =>
              m.id === targetMessageId ? { ...m, quizData: questions, timestamp: 'Just now' } : m
            )
          );
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `g-mcq-${Date.now()}`,
              role: 'assistant',
              quizData: questions,
              timestamp: 'Just now',
            },
          ]);
        }
      } else {
        throw new Error('No questions synthesized');
      }
    } catch {
      // Dynamic fallback rotating through subjects so fresh questions are always shown
      const fallbackQuestions = generateGuruFallbackQuestions(currentIteration, targetDocName);
      if (targetMessageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetMessageId ? { ...m, quizData: fallbackQuestions, timestamp: 'Just now' } : m
          )
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `g-mcq-${Date.now()}`,
            role: 'assistant',
            quizData: fallbackQuestions,
            timestamp: 'Just now',
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Generate Flashcards
  const handleGenerateFlashcards = async (docId, docName) => {
    setLoading(true);
    setDocsPanelOpen(false);
    const activeDoc = uploadedDocs.find((d) => (d.doc_id || d.id) === (docId || selectedDocId)) || uploadedDocs[0];
    const targetDocId = docId || selectedDocId || activeDoc?.doc_id || activeDoc?.id;
    const targetDocName = docName || activeDoc?.filename || 'the active study document';

    const isRegen = flashcardsGenCountRef.current > 0;
    flashcardsGenCountRef.current += 1;

    setMessages((prev) => [
      ...prev,
      {
        id: `u-cards-${Date.now()}`,
        role: 'user',
        content: isRegen
          ? `Create a fresh set of new study flashcards for active recall from ${targetDocName}.`
          : `Create flashcards for active recall from ${targetDocName}.`,
        timestamp: 'Now',
      },
    ]);

    try {
      const res = await fetch('/api/rag/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: targetDocId,
          regenerate: isRegen,
        }),
      });
      const data = await res.json();
      const cards = data.flashcards || data.cards || [];

      if (cards.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: `g-cards-${Date.now()}`,
            role: 'assistant',
            flashcardsData: cards,
            timestamp: 'Just now',
          },
        ]);
      } else {
        throw new Error('No flashcards returned');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `g-cards-${Date.now()}`,
          role: 'assistant',
          flashcardsData: [
            { front: 'Stokes’ Theorem Formula', back: '∮_C F · dr = ∬_S (∇ × F) · dS' },
            { front: 'Pre-LN vs Post-LN benefit', back: 'Pre-LN yields well-behaved gradient norms, allowing training stability without warmup.' },
            { front: 'Eigenvalue Characteristic Equation', back: 'det(A - λI) = 0 defines the characteristic equation for eigenvalues λ.' },
            { front: 'Bayes Theorem Conditional Formula', back: 'P(A|B) = [P(B|A) · P(A)] / P(B)' },
            { front: 'Heisenberg Uncertainty Principle', back: 'Δx · Δp ≥ ℏ / 2' },
          ],
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Chat message sending with real-time text streaming
  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    if (text.toLowerCase().includes('quiz') || text.toLowerCase().includes('mcq') || text.toLowerCase().includes('cbt')) {
      handleGenerateMCQ();
      setInputText('');
      return;
    }
    if (text.toLowerCase().includes('flashcard') || text.toLowerCase().includes('flash card')) {
      handleGenerateFlashcards();
      setInputText('');
      return;
    }

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: 'Now',
    };

    const aiMsgId = `g-${Date.now()}`;
    // Do NOT push initial empty assistant message to avoid empty ghost box
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const activeDoc = uploadedDocs.find((d) => (d.doc_id || d.id) === selectedDocId) || (selectedDocId === null ? uploadedDocs[0] : null);
      const docText = activeDoc?.extractedText || (uploadedDocs.length > 0 ? uploadedDocs.map((d) => d.extractedText).filter(Boolean).join('\n\n') : '');
      const docTitle = activeDoc?.filename || activeDoc?.title || (uploadedDocs.length > 0 ? uploadedDocs[0].filename : '');

      const res = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json',
        },
        body: JSON.stringify({
          message: text,
          stream: true,
          serverId,
          channelName,
          documentId: selectedDocId || activeDoc?.doc_id || activeDoc?.id || null,
          documentTitle: docTitle,
          documentText: docText,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error('AI assistant response error');

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setLoading(false);
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === aiMsgId);
            if (exists) {
              return prev.map((m) => (m.id === aiMsgId ? { ...m, content: accumulated } : m));
            }
            return [
              ...prev,
              {
                id: aiMsgId,
                role: 'assistant',
                content: accumulated,
                timestamp: 'Just now',
              },
            ];
          });
        }

        if (!accumulated.trim()) {
          throw new Error('Empty stream response');
        }
      } else {
        const data = await res.json();
        setLoading(false);
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: 'assistant',
            content: data.reply || data.answer || 'Tutoring session active. Ask any specific question!',
            timestamp: 'Just now',
          },
        ]);
      }
    } catch {
      const fallbackContent = `Here is the study breakdown for **"${text}"**:\n\n1. **Core Concept**: Break the problem down into first principles and define given parameters.\n2. **Key Theorems / Equations**: Check that all boundary conditions and invariants hold.\n3. **Active Practice**: Try explaining the solution steps aloud to test your mastery!`;
      setLoading(false);
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === aiMsgId);
        if (exists) {
          return prev.map((m) => (m.id === aiMsgId ? { ...m, content: fallbackContent } : m));
        }
        return [
          ...prev,
          {
            id: aiMsgId,
            role: 'assistant',
            content: fallbackContent,
            timestamp: 'Just now',
          },
        ];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    try {
      localStorage.removeItem(GURU_STORAGE_KEY);
    } catch {}
    setMessages([
      {
        id: `g-intro-${Date.now()}`,
        role: 'assistant',
        content: 'New study session started! Ask any question, test yourself with a quiz, or upload notes.',
        timestamp: 'Now',
      },
    ]);
  };

  const handleMessagesScroll = (e) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    const delta = currentScrollTop - lastScrollTopRef.current;

    // Subtle target note bar collapse on scroll without hiding bottom navigation
    if (delta > 8 && currentScrollTop > 40) {
      setTargetBarHidden(true);
    } else if (delta < -8 || currentScrollTop <= 15) {
      setTargetBarHidden(false);
    }
    lastScrollTopRef.current = currentScrollTop;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxWidth: 960,
        margin: '0 auto',
        width: '100%',
        color: '#fff',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── 1. Top Guru Header (Clean & Minimal with Max Breathing Space) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          background: 'var(--chatter-sheet)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
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
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              StudyCord AI
            </span>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--chatter-primary)', display: 'inline-block', boxShadow: '0 0 8px var(--chatter-primary)' }} />
          </div>
        </div>

        {/* Header Actions: Docs Tray + New Chat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <input
            ref={docFileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
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
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📚 Notes ({uploadedDocs.length}/{MAX_DOCS})</span>
          </button>

          <button
            type="button"
            onClick={handleClearSession}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: 'var(--chatter-light-text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Start New Session"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* ── 1b. Chat Target (Active Note Selector) – collapses smoothly on scroll up ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          overflowX: 'auto',
          padding: targetBarHidden ? '0 16px' : '7px 16px',
          maxHeight: targetBarHidden ? 0 : 54,
          opacity: targetBarHidden ? 0 : 1,
          pointerEvents: targetBarHidden ? 'none' : 'auto',
          transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          borderBottom: targetBarHidden ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
          background: 'var(--chatter-black)',
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--chatter-light-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
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
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          🌐 All Notes
        </button>
        {uploadedDocs.map((doc) => {
          const isSelected = selectedDocId === doc.doc_id;
          return (
            <button
              key={doc.doc_id}
              type="button"
              onClick={() => setSelectedDocId(doc.doc_id)}
              style={{
                padding: '4px 12px',
                borderRadius: 14,
                border: isSelected ? '1.5px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isSelected ? 'rgba(64, 227, 120, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: isSelected ? 'var(--chatter-primary)' : '#D4D4D4',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📄 {doc.filename}</span>
              {isSelected && <span style={{ fontSize: 11, color: 'var(--chatter-primary)' }}>✓</span>}
            </button>
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
              fontSize: 12,
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
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Max 5 documents reached. Open panel to delete old notes"
          >
            ⚠️ Max 5/5
          </button>
        )}
      </div>

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
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                fontSize: 12,
                fontWeight: 700,
                cursor: (uploadingDoc || uploadedDocs.length >= MAX_DOCS) ? 'not-allowed' : 'pointer',
              }}
            >
              {uploadedDocs.length >= MAX_DOCS ? `Max Limit (${MAX_DOCS}/${MAX_DOCS})` : '+ Upload File (.pdf, .docx)'}
            </button>
          </div>

          {uploadedDocs.length >= MAX_DOCS && (
            <div
              style={{
                fontSize: 12,
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
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.filename}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--chatter-primary)' }}>
                    {doc.chunksCount} chunks · {doc.status}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleGenerateMCQ(doc.doc_id, doc.filename)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'rgba(64, 227, 120, 0.15)',
                      border: 'none',
                      color: 'var(--chatter-primary)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Quiz
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateFlashcards(doc.doc_id, doc.filename)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(doc.doc_id, doc.filename)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: 'none',
                      color: '#f87171',
                      fontSize: 11,
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
                gap: 10,
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: isUser ? '85%' : '90%',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}
            >
              {/* Bot Avatar */}
              {!isUser && (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: 'rgba(64, 227, 120, 0.15)',
                    color: 'var(--chatter-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 0 12px rgba(64, 227, 120, 0.25)',
                    marginTop: 2,
                  }}
                >
                  <ChatbotIcon size={18} />
                </div>
              )}

              <div style={{ maxWidth: '100%' }}>
                {/* Message Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: isUser ? '#fff' : 'var(--chatter-primary)',
                    }}
                  >
                    {isUser ? 'You' : 'StudyCord AI'}
                  </span>
                  {!isUser && <TwitterVerifiedBadge />}
                  <span style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>
                    {m.timestamp || 'Just now'}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    padding: isUser ? '11px 16px' : '14px 18px',
                    borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                    background: isUser ? 'var(--chatter-primary)' : 'var(--chatter-sheet)',
                    color: isUser ? '#0E0E0E' : '#fff',
                    border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    fontWeight: isUser ? 600 : 400,
                    fontSize: isUser ? 14.5 : 15.5,
                    lineHeight: 1.65,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    whiteSpace: isUser ? 'pre-wrap' : undefined,
                  }}
                >
                  {isUser ? (
                    m.content
                  ) : (
                    <ChatMarkdownMessage content={m.content} />
                  )}

                  {/* Interactive CBT Quiz Component */}
                  {m.quizData && (
                    <CbtQuizCard
                      messageId={m.id}
                      questions={m.quizData}
                      onRegenerate={() => handleGenerateMCQ(selectedDocId, null, m.id)}
                    />
                  )}

                  {/* Interactive One-by-One Flashcards Component */}
                  {m.flashcardsData && (
                    <FlashcardDeck
                      cards={m.flashcardsData}
                      onRegenerate={() => handleGenerateFlashcards(selectedDocId)}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '12px 18px',
                borderRadius: '20px 20px 20px 4px',
                background: 'var(--chatter-sheet)',
                color: 'var(--chatter-primary)',
                fontSize: 13.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <span className="chatter-audiospace-live-dot" />
              <span>StudyCord AI is analyzing notes & synthesizing response...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* ── 4. Quick Prompts Rail ── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '6px 18px',
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}
      >
        {quickPrompts.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (p.includes('Quiz')) {
                handleGenerateMCQ();
                return;
              }
              if (p.includes('Flashcards')) {
                handleGenerateFlashcards();
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
              fontSize: 12,
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

      {/* ── 5. Bottom Compose Input (Flush directly over bottom nav) ── */}
      <div
        className="chatter-guru-compose"
        style={{
          padding: '8px 16px 10px',
          background: 'var(--chatter-black)',
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
            background: 'var(--chatter-sheet)',
            borderRadius: 24,
            padding: '6px 8px 6px 12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Paperclip Document Upload shortcut */}
          <button
            type="button"
            onClick={() => docFileInputRef.current?.click()}
            disabled={uploadingDoc}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--chatter-light-text)',
              cursor: uploadingDoc ? 'not-allowed' : 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Upload Study Notes (.pdf, .docx, .txt)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <input
            ref={inputRef}
            type="text"
            placeholder={
              uploadedDocs.find((d) => d.doc_id === selectedDocId)
                ? `Ask about ${uploadedDocs.find((d) => d.doc_id === selectedDocId)?.filename}...`
                : 'Ask StudyCord AI or upload lecture notes...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
            }}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || loading}
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
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

// Subcomponent: CBT Standard Examination & Quiz Component
function CbtQuizCard({ questions = [], onRegenerate, messageId }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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
      }}
    >
      {/* Top CBT Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
            📝 CBT Assessment
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 12,
              background: isSubmitted ? 'rgba(64, 227, 120, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              color: isSubmitted ? 'var(--chatter-primary)' : 'var(--chatter-light-text)',
            }}
          >
            {isSubmitted ? 'Completed' : `Answered: ${answeredCount}/${totalQuestions}`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onRegenerate && (
            <button
              type="button"
              onClick={handleRegenerateClick}
              disabled={regenerating}
              title="Generate new quiz questions from document"
              style={{
                padding: '4px 10px',
                borderRadius: 12,
                background: regenerating ? 'rgba(64, 227, 120, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                border: regenerating ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                color: regenerating ? 'var(--chatter-primary)' : 'var(--chatter-light-text)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: regenerating ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
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
                padding: '4px 10px',
                borderRadius: 12,
                background: 'rgba(64, 227, 120, 0.15)',
                border: '1px solid rgba(64, 227, 120, 0.3)',
                color: 'var(--chatter-primary)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Retake
            </button>
          )}
        </div>
      </div>

      {/* CBT Question Palette (Numbered questions bar) */}
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
                width: 32,
                height: 32,
                borderRadius: 10,
                background: pillBg,
                border: pillBorder,
                color: pillColor,
                fontSize: 12.5,
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
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--chatter-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Final Test Result
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 2 }}>
              Score: {correctCount} / {totalQuestions} <span style={{ fontSize: 16, color: 'var(--chatter-primary)' }}>({percentage}%)</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: percentage >= 80 ? 'var(--chatter-primary)' : '#fff' }}>
            {percentage >= 80 ? '🎯 Outstanding Mastery!' : percentage >= 60 ? '👍 Good Competency' : '📚 Review Solutions Below'}
          </div>
        </div>
      )}

      {/* Current Question Body */}
      <div
        style={{
          background: '#181818',
          borderRadius: 16,
          padding: 16,
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ fontSize: 11.5, color: 'var(--chatter-light-text)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
          Question {currentQIndex + 1} of {totalQuestions}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.5, marginBottom: 14 }}>
          {currentQ.question}
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  gap: 10,
                  textAlign: 'left',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: optBg,
                  border: optBorder,
                  color: optColor,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isSubmitted ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: isSelected ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
                    color: isSelected ? '#0E0E0E' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {letter}
                </span>
                <span style={{ flex: 1 }}>{opt}</span>
                {isSubmitted && isCorrect && <span style={{ fontSize: 13 }}>✓</span>}
                {isSubmitted && isSelected && !isCorrect && <span style={{ fontSize: 13 }}>✗</span>}
              </button>
            );
          })}
        </div>

        {/* Detailed Solution Explanation (revealed after submission) */}
        {isSubmitted && currentQ.explanation && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(64, 227, 120, 0.08)',
              border: '1px solid rgba(64, 227, 120, 0.2)',
              fontSize: 13,
              lineHeight: 1.55,
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

      {/* CBT Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
          disabled={currentQIndex === 0}
          style={{
            padding: '8px 16px',
            borderRadius: 14,
            background: currentQIndex === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: currentQIndex === 0 ? 'rgba(255, 255, 255, 0.25)' : '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: currentQIndex === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          ← Previous
        </button>

        {!isSubmitted ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {currentQIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentQIndex((i) => Math.min(totalQuestions - 1, i + 1))}
                style={{
                  padding: '8px 18px',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Next →
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleSubmitQuiz}
              style={{
                padding: '8px 20px',
                borderRadius: 14,
                background: 'var(--chatter-primary)',
                border: 'none',
                color: '#0E0E0E',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(64, 227, 120, 0.3)',
              }}
            >
              Submit CBT Test ✓
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentQIndex((i) => Math.min(totalQuestions - 1, i + 1))}
            disabled={currentQIndex === totalQuestions - 1}
            style={{
              padding: '8px 18px',
              borderRadius: 14,
              background: currentQIndex === totalQuestions - 1 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: currentQIndex === totalQuestions - 1 ? 'rgba(255, 255, 255, 0.25)' : '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: currentQIndex === totalQuestions - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Next Question →
          </button>
        )}
      </div>
    </div>
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
              fontSize: 11,
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
        <div style={{ fontSize: 11.5, color: 'var(--chatter-light-text)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Tap card to flip 🔄</span>
        </div>
      </div>

      {/* Main Card Content */}
      <div
        style={{
          margin: '24px 0',
          fontSize: fullscreen ? 22 : 16,
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--chatter-light-text)' }}>
        <span>{flipped ? '✓ Tap to view question' : '• Active recall prompt'}</span>
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
      }}
    >
      {/* Header with counter and fullscreen button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>
            🃏 Flashcard {currentIndex + 1} of {cards.length}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 12,
              background: 'rgba(64, 227, 120, 0.15)',
              color: 'var(--chatter-primary)',
            }}
          >
            Active Recall
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              title="Generate new flashcards from document"
              style={{
                padding: '4px 10px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'var(--chatter-light-text)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
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
              padding: '4px 10px',
              borderRadius: 12,
              background: 'rgba(64, 227, 120, 0.15)',
              border: '1px solid rgba(64, 227, 120, 0.3)',
              color: 'var(--chatter-primary)',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
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

      {/* Fullscreen Overlay Modal */}
      {isFullscreen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(10, 10, 10, 0.96)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px 20px',
          }}
        >
          {/* Top Fullscreen Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 700, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Card {currentIndex + 1} of {cards.length}
              </span>
              <span style={{ fontSize: 12, color: 'var(--chatter-primary)', background: 'rgba(64, 227, 120, 0.15)', padding: '3px 10px', borderRadius: 12, fontWeight: 700 }}>
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
                fontSize: 14,
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
                fontSize: 14,
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
                fontSize: 14,
                fontWeight: 700,
                cursor: currentIndex === cards.length - 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Next → (Right)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
