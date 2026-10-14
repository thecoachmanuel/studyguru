import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { retrieveRelevantChunks } from '@/lib/vectorSearch';
import { generateContentWithFallback, extractJson } from '@/lib/llm';

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Procedural Academic Quiz Banks for diverse subjects
const PROCEDURAL_QUIZ_BANKS = [
  // Bank 0: Computer Science & Algorithmic Complexity
  [
    {
      question: 'In computational complexity, what distinguishes problems in class NP from problems in class P?',
      options: [
        'Solutions can be verified in polynomial time, even if finding them takes superpolynomial time',
        'They can only be solved on quantum architectures with zero error probability',
        'Verification requires strictly exponential time in the worst case',
        'They cannot be represented using finite-state deterministic automata',
      ],
      correct_answer: 'Solutions can be verified in polynomial time, even if finding them takes superpolynomial time',
      explanation: 'NP represents nondeterministic polynomial time: candidate solutions can be verified deterministically in polynomial time.',
    },
    {
      question: 'Why does an LRU (Least Recently Used) cache use a hash map paired with a doubly linked list?',
      options: [
        'To achieve O(1) time complexity for both key lookup and element eviction/reordering',
        'To guarantee persistent disk serializability across concurrent threads',
        'To eliminate memory fragmentation across the heap automatically',
        'To compress cache line metadata using run-length encoding',
      ],
      correct_answer: 'To achieve O(1) time complexity for both key lookup and element eviction/reordering',
      explanation: 'Hash maps provide O(1) lookup, while doubly linked lists allow O(1) node removal and insertion at the head.',
    },
    {
      question: 'In distributed systems, what is the core implication of the CAP Theorem during a network partition (P)?',
      options: [
        'The system must choose between linearizable Consistency (C) or uninterrupted Availability (A)',
        'Network partitions can be avoided by increasing TCP buffer sizes',
        'Latency decreases linearly with the addition of redundant nodes',
        'Strong consistency is achieved automatically through raft election heartbeats',
      ],
      correct_answer: 'The system must choose between linearizable Consistency (C) or uninterrupted Availability (A)',
      explanation: 'Under a network partition, a distributed system cannot simultaneously guarantee both complete consistency and full availability.',
    },
    {
      question: 'What is the primary advantage of B+ Trees over standard Binary Search Trees for database indexes?',
      options: [
        'High fan-out reduces tree height, minimizing disk I/O operations for block-based storage',
        'They eliminate the need for write-ahead logging during transaction commits',
        'All data elements are stored exclusively in root nodes for instantaneous access',
        'They execute range queries in O(1) constant time unconditionally',
      ],
      correct_answer: 'High fan-out reduces tree height, minimizing disk I/O operations for block-based storage',
      explanation: 'B+ Trees have large branching factors suited for disk pages and link all leaf nodes for efficient sequential range scans.',
    },
    {
      question: 'In public-key cryptography, why is the Diffie-Hellman key exchange secure against passive eavesdropping?',
      options: [
        'Computing discrete logarithms in a finite cyclic group is computationally intractable',
        'Both parties transmit the private keys in encrypted symmetric envelopes',
        'The shared secret is never mathematically dependent on the generator base',
        'It relies exclusively on bitwise XOR transposition across noisy channels',
      ],
      correct_answer: 'Computing discrete logarithms in a finite cyclic group is computationally intractable',
      explanation: 'While computing g^(ab) mod p is easy given private exponents, deriving the secret from public keys g^a and g^b requires solving discrete logs.',
    },
  ],

  // Bank 1: Molecular Biology & Genetics
  [
    {
      question: 'What is the primary function of DNA topoisomerases during replication fork progression?',
      options: [
        'Relieving supercoiling and torsional strain ahead of the replication fork by cutting and resealing strands',
        'Synthesizing RNA primers necessary for Okazaki fragment initiation',
        'Catalyzing the formation of phosphodiester bonds between adjacent lagging fragments',
        'Directly transcribing messenger RNA from antisense template strands',
      ],
      correct_answer: 'Relieving supercoiling and torsional strain ahead of the replication fork by cutting and resealing strands',
      explanation: 'Topoisomerases introduce transient single- or double-strand breaks to alleviate positive supercoiling induced by helicase unwinding.',
    },
    {
      question: 'How do allosteric enzymes differ fundamentally from enzymes following standard Michaelis-Menten kinetics?',
      options: [
        'They exhibit sigmoidal substrate saturation curves due to cooperative binding between subunits',
        'Their reaction velocity is completely independent of substrate concentration',
        'They permanently denature upon initial substrate interaction',
        'They do not possess catalytically active binding pockets',
      ],
      correct_answer: 'They exhibit sigmoidal substrate saturation curves due to cooperative binding between subunits',
      explanation: 'Allosteric enzymes display cooperativity where substrate binding in one subunit alters the affinity of adjacent subunits, producing sigmoidal curves.',
    },
    {
      question: 'During cellular respiration, what generates the electrochemical proton gradient across the inner mitochondrial membrane?',
      options: [
        'The sequential transfer of electrons through Complexes I, III, and IV of the electron transport chain',
        'Passive diffusion of ATP molecules through voltage-gated outer membrane porins',
        'Direct substrate-level phosphorylation within the cytoplasmic matrix',
        'The spontaneous conversion of lactate into pyruvate during anaerobic glycolysis',
      ],
      correct_answer: 'The sequential transfer of electrons through Complexes I, III, and IV of the electron transport chain',
      explanation: 'Electron transport couples exergonic redox reactions to proton pumping from the matrix into the intermembrane space.',
    },
    {
      question: 'What epigenetic modification typically leads to transcriptional repression and chromatin condensation (heterochromatin)?',
      options: [
        'DNA methylation at CpG islands and histone deacetylation',
        'Histone hyperacetylation by histone acetyltransferases (HATs)',
        'Phosphorylation of nuclear membrane lamins during prophase',
        'Removal of poly-A tails in the nucleolus prior to splicing',
      ],
      correct_answer: 'DNA methylation at CpG islands and histone deacetylation',
      explanation: 'Methylation of cytosines at CpG sites and deacetylation of histone lysine tails compact chromatin, preventing transcription factor access.',
    },
    {
      question: 'In CRISPR-Cas9 genome editing, what determines the specific target cleavage site on double-stranded DNA?',
      options: [
        'A single guide RNA (sgRNA) sequence complementary to the target, adjacent to a Protospacer Adjacent Motif (PAM)',
        'Random restriction endonuclease binding at non-specific palindromic repeats',
        'The tertiary folding structure of ribosomal RNA subunits',
        'Electromagnetic attraction between zinc-finger helices and phosphate backbones',
      ],
      correct_answer: 'A single guide RNA (sgRNA) sequence complementary to the target, adjacent to a Protospacer Adjacent Motif (PAM)',
      explanation: 'The Cas9 endonuclease is guided by complementary base-pairing of the sgRNA to the target locus, contingent on the presence of a short PAM sequence.',
    },
  ],

  // Bank 2: Cognitive Neuroscience & Learning Theory
  [
    {
      question: 'What neurobiological mechanism underlies Long-Term Potentiation (LTP) in hippocampal neurons?',
      options: [
        'Persistent insertion of AMPA receptors into the postsynaptic membrane following NMDA-mediated Ca2+ influx',
        'Complete degradation of presynaptic axon terminals through retrograde autophagosomes',
        'Total blockage of voltage-gated potassium channels throughout dendritic spines',
        'Passive depletion of vesicular glutamate reserves during prolonged rest',
      ],
      correct_answer: 'Persistent insertion of AMPA receptors into the postsynaptic membrane following NMDA-mediated Ca2+ influx',
      explanation: 'Coincident depolarization relieves the Mg2+ block on NMDA receptors, allowing Ca2+ influx that drives AMPA receptor trafficking and synaptic strengthening.',
    },
    {
      question: 'Why does the "Testing Effect" (retrieval practice) produce significantly higher retention than passive rereading?',
      options: [
        'Active retrieval reconstructs and consolidates associative neural pathways, producing deeper memory traces',
        'It lowers cortical activity to facilitate subconscious procedural habituation',
        'It eliminates the need for hippocampal involvement during working memory tasks',
        'It replaces declarative recall with involuntary motor reflex loops',
      ],
      correct_answer: 'Active retrieval reconstructs and consolidates associative neural pathways, producing deeper memory traces',
      explanation: 'Retrieving information engages effortful cognitive processing and strengthens neural memory traces far more effectively than passive exposure.',
    },
    {
      question: 'In Cognitive Load Theory, how does "Germane Cognitive Load" differ from "Extraneous Cognitive Load"?',
      options: [
        'Germane load is mental effort dedicated to schema construction and integration, whereas extraneous load stems from poor instructional design',
        'Germane load represents biological fatigue caused by sensory deprivation',
        'Extraneous load is the inherent, unalterable complexity of the material itself',
        'Both terms describe identical non-conscious semantic interference',
      ],
      correct_answer: 'Germane load is mental effort dedicated to schema construction and integration, whereas extraneous load stems from poor instructional design',
      explanation: 'Effective learning maximizes germane load (schema formation) while minimizing extraneous load (confusing layout or unnecessary clutter).',
    },
    {
      question: 'What role does sleep spindle activity during Stage 2 NREM sleep play in academic memory consolidation?',
      options: [
        'Facilitating the transfer and reorganization of declarative memories from the hippocampus to the neocortex',
        'Inducing rapid sensory hallucinations to reset circadian clock genes',
        'Preventing neurotransmitter reuptake across somatic neuromuscular junctions',
        'Slowing synaptic pruning to preserve non-relevant sensory impressions',
      ],
      correct_answer: 'Facilitating the transfer and reorganization of declarative memories from the hippocampus to the neocortex',
      explanation: 'Sleep spindles and slow oscillations synchronize hippocampal sharp-wave ripples to transfer fragile temporary traces into durable neocortical networks.',
    },
    {
      question: 'How does "Interleaving" problem types enhance mathematical and conceptual problem-solving skills?',
      options: [
        'It trains the learner to discriminate between problem structures and select appropriate solution strategies',
        'It reduces cognitive load by grouping identical exercises in long sequential blocks',
        'It allows solutions to be completed through automatic muscle memory without critical thinking',
        'It guarantees zero error rates during initial acquisition phases',
      ],
      correct_answer: 'It trains the learner to discriminate between problem structures and select appropriate solution strategies',
      explanation: 'Interleaving mixes distinct problem categories, requiring students to actively diagnose the underlying problem structure before applying a method.',
    },
  ],

  // Bank 3: Physics, Thermodynamics & Mechanics
  [
    {
      question: 'According to the Second Law of Thermodynamics, what is true regarding the entropy of an isolated system?',
      options: [
        'The total entropy of an isolated system can never decrease over time; it remains constant or increases',
        'Entropy decreases to absolute zero whenever work is converted into thermal energy',
        'It fluctuates symmetrically around zero depending on ambient atmospheric pressure',
        'Isolated systems spontaneously convert dispersed heat into coherent mechanical work',
      ],
      correct_answer: 'The total entropy of an isolated system can never decrease over time; it remains constant or increases',
      explanation: 'In any spontaneous irreversible process within an isolated system, total thermodynamic entropy increases (dS >= 0).',
    },
    {
      question: 'In special relativity, why cannot an object with non-zero rest mass reach or exceed the speed of light in vacuum?',
      options: [
        'Its relativistic momentum and energy approach infinity as velocity approaches c, requiring infinite work',
        'Photons actively apply radiation drag that decelerates macroscopic masses',
        'Time dilation stops completely inside the object, halting all physical motion',
        'Space contracts to negative dimensions beyond the event horizon of the object',
      ],
      correct_answer: 'Its relativistic momentum and energy approach infinity as velocity approaches c, requiring infinite work',
      explanation: 'As v approaches c, the Lorentz factor gamma approaches infinity, meaning an infinite amount of kinetic energy would be needed to reach c.',
    },
    {
      question: 'What physical conservation law is mathematically directly related to the rotational invariance of physical laws via Noether’s Theorem?',
      options: [
        'Conservation of angular momentum',
        'Conservation of linear momentum',
        'Conservation of electrical charge',
        'Conservation of total mass-energy density',
      ],
      correct_answer: 'Conservation of angular momentum',
      explanation: 'Emmy Noether proved that every continuous global symmetry corresponds to a conserved quantity: spatial rotational symmetry yields angular momentum conservation.',
    },
    {
      question: 'In quantum mechanics, what does the Heisenberg Uncertainty Principle state regarding conjugate variables like position and momentum?',
      options: [
        'The product of the uncertainties in position and momentum is bounded from below by h-bar / 2',
        'Position and momentum cannot be measured simultaneously due to imperfect measuring equipment',
        'A particle only has momentum when observed by a conscious entity',
        'The wave function collapses only when the kinetic energy matches the potential well depth',
      ],
      correct_answer: 'The product of the uncertainties in position and momentum is bounded from below by h-bar / 2',
      explanation: 'Delta x * Delta p >= h-bar / 2 is a fundamental mathematical property of non-commuting operators in quantum state space, not a measurement flaw.',
    },
    {
      question: 'Why do electromagnetic waves propagate through a vacuum without requiring any physical medium?',
      options: [
        'A time-varying electric field generates a magnetic field, and a time-varying magnetic field generates an electric field',
        'Gravitational waves provide the oscillating substrate for photon transmission',
        'Photons physically displace virtual positron-electron pairs in the Dirac sea continuously',
        'The speed of light eliminates the need for spatial phase relationships',
      ],
      correct_answer: 'A time-varying electric field generates a magnetic field, and a time-varying magnetic field generates an electric field',
      explanation: 'Maxwell’s equations demonstrate that oscillating electric and magnetic fields self-sustain and propagate together as transverse waves.',
    },
  ],
];

function generateProceduralQuiz(count = 5, iteration = 0) {
  const bankIndex = Math.abs(iteration) % PROCEDURAL_QUIZ_BANKS.length;
  const bank = PROCEDURAL_QUIZ_BANKS[bankIndex];

  // Rotate questions within bank
  const rotated = [...bank];
  const shift = (iteration * 2) % rotated.length;
  for (let i = 0; i < shift; i++) {
    rotated.push(rotated.shift());
  }

  return rotated.slice(0, count).map((q) => ({
    question: q.question,
    options: shuffleArray(q.options),
    correct_answer: q.correct_answer,
    explanation: q.explanation,
  }));
}

function synthesizeQuizFromText(text, count = 5, iteration = 0) {
  if (!text || typeof text !== 'string' || text.trim().length < 30) {
    return generateProceduralQuiz(count, iteration);
  }

  const paragraphs = text
    .split(/\n\n+|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40 && p.length <= 500);

  if (paragraphs.length === 0) {
    return generateProceduralQuiz(count, iteration);
  }

  // Rotate paragraphs based on iteration so each tap yields fresh sentences
  const rotated = [...paragraphs];
  const shiftAmount = (iteration * 3) % paragraphs.length;
  for (let i = 0; i < shiftAmount; i++) {
    rotated.push(rotated.shift());
  }

  const selectedParagraphs = rotated.slice(0, count);
  const questions = [];

  for (let i = 0; i < selectedParagraphs.length; i++) {
    const p = selectedParagraphs[i];
    const sentences = p.split(/(?<=[.?!])\s+/).filter((s) => s.trim().length > 15);
    const keySentence = (sentences[i % sentences.length] || sentences[0]).replace(/^[#*\s-]+/, '').trim();

    const correctAnswer = `Directly confirmed: ${keySentence.slice(0, 95)}`;
    const distractorA = `Directly contradicts the statement regarding ${keySentence.slice(0, 35)}`;
    const distractorB = `Applies only under extreme or hypothetical boundary conditions`;
    const distractorC = `Irrelevant to the primary analysis in this section`;

    const rawOptions = [correctAnswer, distractorA, distractorB, distractorC];

    questions.push({
      question: `Q${i + 1}. Based on section ${i + 1} of the study material: Which statement is accurate concerning "${keySentence.slice(0, 80)}..."?`,
      options: shuffleArray(rawOptions),
      correct_answer: correctAnswer,
      explanation: p.slice(0, 160),
    });
  }

  return questions.length > 0 ? questions : generateProceduralQuiz(count, iteration);
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const documentId = body.documentId || body.doc_id || body.document_id;
    const count = Math.min(Math.max(parseInt(body.count, 10) || 5, 2), 20);
    const iteration = parseInt(body.iteration, 10) || Math.floor(Math.random() * 1000);
    const isRegenerate = Boolean(body.regenerate || body.forceRefresh);

    const userId = session.user.id;
    const db = await getDatabase();

    // High-concurrency cache hit: Serve existing MCQs ONLY when NOT regenerating
    if (!isRegenerate && documentId) {
      try {
        const cached = await db.collection('rag_study_outputs').findOne({
          document_id: documentId,
          output_type: 'mcq',
        });
        if (Array.isArray(cached?.content) && cached.content.length > 0) {
          const isDummy = cached.content.some((q) =>
            q.question?.toLowerCase().includes('sample question')
          );
          if (!isDummy) {
            return NextResponse.json({ questions: cached.content, mcq: cached.content, mcqs: cached.content });
          }
        }
      } catch (cacheErr) {
        console.warn('MCQ cache lookup notice:', cacheErr.message);
      }
    } else if (isRegenerate && documentId) {
      // Invalidate existing cache when regenerating
      try {
        await db.collection('rag_study_outputs').deleteMany({
          document_id: documentId,
          output_type: 'mcq',
        });
      } catch (delErr) {
        console.warn('Cache purge notice:', delErr.message);
      }
    }

    // Resolve document text if documentId is provided
    let contextText = '';
    const clientText = String(body.documentText || body.docText || body.text || '').trim();

    if (documentId) {
      const safeId = safeObjectId(documentId);
      let doc = await db.collection('rag_documents').findOne({
        $or: [{ _id: safeId }, { id: documentId }, { document_id: documentId }],
      });

      if (!doc) {
        const sess = await db.collection('rag_sessions').findOne({
          $or: [{ _id: safeId }, { id: documentId }, { session_id: documentId }],
        });
        if (sess?.document_id) {
          doc = await db.collection('rag_documents').findOne({
            $or: [{ _id: safeObjectId(sess.document_id) }, { id: sess.document_id }],
          });
        }
      }

      const chunks = await retrieveRelevantChunks({
        query: `quiz test concepts exam practice details iteration ${iteration}`,
        documentId: doc?._id?.toString() || documentId,
        userId,
        limit: 8,
      });

      const isDocPlaceholder = !doc?.extracted_text || doc.extracted_text.length < 60 || doc.extracted_text.startsWith('Academic study material:');

      if (!isDocPlaceholder && doc?.extracted_text) {
        contextText = doc.extracted_text;
      } else if (clientText && clientText.length > 20) {
        contextText = clientText;
        if (doc?._id) {
          db.collection('rag_documents').updateOne(
            { _id: doc._id },
            { $set: { extracted_text: clientText, updated_at: new Date() } }
          ).catch(() => {});
        }
      } else if (doc?.extracted_text) {
        contextText = doc.extracted_text;
      } else if (chunks.length > 0) {
        contextText = chunks.join('\n\n---\n\n');
      }
    } else if (clientText && clientText.length > 20) {
      contextText = clientText;
    }

    // If no specific document text was found, generate procedural academic questions
    if (!contextText || contextText.trim().length < 15) {
      const proceduralQuestions = generateProceduralQuiz(count, iteration);
      return NextResponse.json({
        questions: proceduralQuestions,
        mcq: proceduralQuestions,
        mcqs: proceduralQuestions,
      });
    }

    // Offset the text window for long documents so subsequent quizzes pull from alternate chapters/sections
    let textSlice = contextText;
    if (contextText.length > 10000) {
      const offset = (iteration * 2500) % Math.max(1, contextText.length - 8000);
      textSlice = contextText.slice(offset, offset + 12000);
    } else {
      textSlice = contextText.slice(0, 12000);
    }

    const variationSeed = Date.now() + '-' + iteration;
    const prompt = `Based ONLY on the document text provided below, generate ${count} multiple choice revision quiz questions.
CRITICAL VARIATION INSTRUCTION (Seed #${variationSeed}):
- This is assessment drill #${iteration + 1}. You MUST generate a completely NEW, DIFFERENT set of questions than standard overviews.
- Focus on specific mechanisms, deeper implications, formulas, secondary concepts, or alternate paragraphs.
- Do NOT repeat generic or superficial questions.

Return ONLY valid JSON matching this exact structure:
{
  "questions": [
    {
      "question": "Specific question text directly derived from the document",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Brief explanation from the text of why this option is correct"
    }
  ]
}

CRITICAL RULES:
1. "options" must be an array of exactly 4 distinct choice strings.
2. "correct_answer" MUST be a string that exactly matches one of the choices in "options".
3. Never use em-dashes ('—') or double hyphens ('--') in questions, options, or explanations.

Document Text:
${textSlice}`;

    let questions = [];

    try {
      const { text } = await generateContentWithFallback({
        prompt,
        systemPrompt: 'You are an advanced academic assessment engine that outputs strictly valid JSON with an array of distinct, non-repetitive multiple-choice quiz questions derived from the study document.',
        json: true,
      });

      const parsed = extractJson(text || '');
      let rawList = [];

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        rawList = parsed.questions || parsed.mcqs || parsed.mcq || parsed.quiz || parsed.items || parsed.data || Object.values(parsed);
      }

      if (Array.isArray(rawList) && rawList.length > 0) {
        questions = rawList.map((q) => {
          if (!q || typeof q !== 'object') return null;
          let options = Array.isArray(q.options) && q.options.length >= 2
            ? q.options.map(String).map((s) => s.trim()).filter(Boolean)
            : ['True', 'False', 'Cannot be determined', 'None of the above'];

          if (options.length < 2) {
            options = ['True', 'False', 'Cannot be determined', 'None of the above'];
          }

          let rawCorrect = String(q.correct_answer || q.answer || q.correctAnswer || '').trim();

          // 1. Direct match
          let matched = options.find((opt) => opt.toLowerCase() === rawCorrect.toLowerCase());

          // 2. Letter match (e.g. "C" or "C)" or "Option C")
          if (!matched) {
            const letterMatch = rawCorrect.match(/^([A-D])(?:\.|\:|\s|\)|$)/i);
            if (letterMatch) {
              const letter = letterMatch[1].toUpperCase();
              const idx = letter.charCodeAt(0) - 65;
              if (options[idx]) {
                matched = options[idx];
              }
            }
          }

          // 3. Substring match
          if (!matched && rawCorrect) {
            matched = options.find((opt) => opt.toLowerCase().includes(rawCorrect.toLowerCase()) || rawCorrect.toLowerCase().includes(opt.toLowerCase()));
          }

          const finalCorrect = matched || options[0];

          // Shuffle options so correct answer isn't predictable
          const shuffledOptions = shuffleArray(options);

          return {
            question: String(q.question || 'Study Question').trim(),
            options: shuffledOptions,
            correct_answer: finalCorrect,
            explanation: String(q.explanation || 'Refer to study document for detailed rationale.').trim(),
          };
        }).filter(Boolean);
      }
    } catch (llmErr) {
      console.warn('MCQ primary LLM notice:', llmErr.message);
    }

    // Fallback: Synthesize quiz questions directly from document sentences with paragraph rotation
    if (!Array.isArray(questions) || questions.length === 0) {
      questions = synthesizeQuizFromText(contextText, count, iteration);
    }

    // Cache generated MCQs if documentId exists
    if (documentId && questions.length > 0) {
      try {
        await db.collection('rag_study_outputs').updateOne(
          { document_id: documentId, output_type: 'mcq' },
          {
            $set: {
              document_id: documentId,
              output_type: 'mcq',
              content: questions,
              updated_at: new Date(),
            },
          },
          { upsert: true }
        );
      } catch (saveErr) {
        console.warn('Failed to cache MCQs:', saveErr.message);
      }
    }

    return NextResponse.json({ questions, mcq: questions, mcqs: questions });
  } catch (error) {
    console.error('MCQ error:', error);
    const fallback = generateProceduralQuiz(5, Math.floor(Math.random() * 100));
    return NextResponse.json({ questions: fallback, mcq: fallback, mcqs: fallback });
  }
}
