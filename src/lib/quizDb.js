import { getDatabase, safeObjectId } from '@/lib/mongodb';

// Initial Categories with modern emojis, descriptions, and colors
export const INITIAL_CATEGORIES = [
  {
    id: 'cat-cs-ai',
    name: 'Computer Science & AI',
    slug: 'computer-science-ai',
    image: '💻',
    icon_bg: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    description: 'Algorithms, Data Structures, Machine Learning & Neural Networks',
    subcategories: [
      { id: 'sub-ai-ml', name: 'Machine Learning & Deep Learning', slug: 'ml-deep-learning' },
      { id: 'sub-dsa', name: 'Data Structures & Algorithms', slug: 'data-structures-algorithms' },
      { id: 'sub-web-dev', name: 'Web Architecture & Systems', slug: 'web-architecture' },
    ],
  },
  {
    id: 'cat-math',
    name: 'Mathematics & Calculus',
    slug: 'mathematics-calculus',
    image: '📐',
    icon_bg: 'linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)',
    description: 'Calculus, Linear Algebra, Probability & Discrete Mathematics',
    subcategories: [
      { id: 'sub-calc', name: 'Multivariable Calculus & Integrals', slug: 'multivariable-calculus' },
      { id: 'sub-linalg', name: 'Linear Algebra & Matrices', slug: 'linear-algebra' },
    ],
  },
  {
    id: 'cat-med-bio',
    name: 'Medicine & Biological Sciences',
    slug: 'medicine-biological-sciences',
    image: '🧬',
    icon_bg: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    description: 'Cell Biology, Genetics, Human Physiology & Pathology',
    subcategories: [
      { id: 'sub-genetics', name: 'Molecular Genetics & DNA', slug: 'genetics-dna' },
      { id: 'sub-physio', name: 'Human Anatomy & Physiology', slug: 'human-anatomy' },
    ],
  },
  {
    id: 'cat-physics-chem',
    name: 'Physics & Chemistry',
    slug: 'physics-chemistry',
    image: '⚡',
    icon_bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    description: 'Quantum Mechanics, Thermodynamics & Organic Reactions',
    subcategories: [
      { id: 'sub-quantum', name: 'Quantum Physics & Relativity', slug: 'quantum-physics' },
      { id: 'sub-organic', name: 'Organic Chemistry & Mechanisms', slug: 'organic-chemistry' },
    ],
  },
  {
    id: 'cat-general',
    name: 'General Knowledge & Logic',
    slug: 'general-knowledge-logic',
    image: '🌍',
    icon_bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    description: 'World History, Geography, Logic Puzzles & Brainteasers',
    subcategories: [
      { id: 'sub-logic', name: 'Critical Reasoning & Brain Drills', slug: 'critical-reasoning' },
      { id: 'sub-history', name: 'World History & Civilizations', slug: 'world-history' },
    ],
  },
];

export const INITIAL_QUESTIONS = [
  // CS & AI
  {
    category_id: 'cat-cs-ai',
    subcategory_id: 'sub-ai-ml',
    level: 1,
    question: 'What is the primary function of the softmax activation function in neural networks?',
    options: [
      'Normalizes output logits into a probability distribution summing to 1',
      'Introduces non-linearity by zeroing negative values like ReLU',
      'Calculates the Euclidean distance between embedding vectors',
      'Prevents vanishing gradients during backward propagation',
    ],
    answer: 'Normalizes output logits into a probability distribution summing to 1',
    answer_index: 0,
    explanation: 'Softmax exponentiates raw logits and divides by their sum, mapping any vector of real values to a valid probability distribution where each value is between 0 and 1.',
  },
  {
    category_id: 'cat-cs-ai',
    subcategory_id: 'sub-ai-ml',
    level: 1,
    question: 'In Transformer architectures (Vaswani et al., 2017), what is the time complexity of standard self-attention with sequence length N?',
    options: ['O(N log N)', 'O(N²)', 'O(N)', 'O(2^N)'],
    answer: 'O(N²)',
    answer_index: 1,
    explanation: 'Standard self-attention computes query-key matrix multiplication QK^T of size (N × d_k) and (d_k × N), resulting in an N × N attention matrix, yielding O(N²) quadratic complexity.',
  },
  {
    category_id: 'cat-cs-ai',
    subcategory_id: 'sub-dsa',
    level: 1,
    question: 'Which algorithmic paradigm does Dijkstra’s algorithm for single-source shortest paths use?',
    options: ['Divide and Conquer', 'Dynamic Programming with memoization', 'Greedy strategy with a min-priority queue', 'Backtracking branch-and-bound'],
    answer: 'Greedy strategy with a min-priority queue',
    answer_index: 2,
    explanation: 'Dijkstra greedily chooses the unvisited vertex with the minimum tentative distance at each step, making it a canonical greedy algorithm with non-negative edge weights.',
  },
  {
    category_id: 'cat-cs-ai',
    subcategory_id: 'sub-web-dev',
    level: 1,
    question: 'In HTTP/2 and HTTP/3, what major bottleneck of HTTP/1.1 is eliminated through multiplexing?',
    options: [
      'Head-of-line blocking across multiple concurrent requests on a single connection',
      'The requirement for SSL/TLS handshakes',
      'DNS resolution overhead',
      'Cross-origin resource sharing (CORS) preflight requests',
    ],
    answer: 'Head-of-line blocking across multiple concurrent requests on a single connection',
    answer_index: 0,
    explanation: 'Multiplexing allows multiple bidirectional request and response streams to interleave over a single TCP/QUIC connection without blocking subsequent requests.',
  },
  // Mathematics
  {
    category_id: 'cat-math',
    subcategory_id: 'sub-calc',
    level: 1,
    question: 'According to Green’s Theorem, the line integral ∮ (L dx + M dy) around a positively oriented simple closed curve C equals what double integral over region D?',
    options: [
      '∬ (∂M/∂x - ∂L/∂y) dA',
      '∬ (∂L/∂x + ∂M/∂y) dA',
      '∬ (∂M/∂y - ∂L/∂x) dA',
      '∬ (L² + M²) dA',
    ],
    answer: '∬ (∂M/∂x - ∂L/∂y) dA',
    answer_index: 0,
    explanation: 'Green’s Theorem relates the circulation line integral along boundary curve C to the 2D curl double integral ∬ (∂M/∂x - ∂L/∂y) dA over enclosed region D.',
  },
  {
    category_id: 'cat-math',
    subcategory_id: 'sub-linalg',
    level: 1,
    question: 'If an n × n real symmetric matrix A has eigenvalues λ₁, λ₂, ..., λₙ, what is true regarding its eigenvectors corresponding to distinct eigenvalues?',
    options: [
      'They are mutually orthogonal',
      'They must all have an imaginary component',
      'Their sum must equal the determinant of A',
      'They are always linearly dependent',
    ],
    answer: 'They are mutually orthogonal',
    answer_index: 0,
    explanation: 'By the Spectral Theorem, any real symmetric matrix is orthogonally diagonalizable: its eigenvectors corresponding to distinct eigenvalues are mutually perpendicular (orthogonal).',
  },
  // Medicine & Bio
  {
    category_id: 'cat-med-bio',
    subcategory_id: 'sub-genetics',
    level: 1,
    question: 'During eukaryotic transcription, what modification is added to the 5′ end of pre-mRNA to facilitate ribosome binding and protect against degradation?',
    options: ['7-methylguanosine cap', 'Poly-A tail of 200 adenines', 'Intron spliceosome complex', 'TATA box promoter'],
    answer: '7-methylguanosine cap',
    answer_index: 0,
    explanation: 'A 7-methylguanosine (m7G) cap is linked to the 5′ triphosphate of nascent pre-mRNA, protecting it from exonucleases and recruiting the eIF4F translation initiation complex.',
  },
  {
    category_id: 'cat-med-bio',
    subcategory_id: 'sub-physio',
    level: 1,
    question: 'Which anatomical structure serves as the primary intrinsic pacemaker of the healthy human heart?',
    options: ['Sinoatrial (SA) node', 'Atrioventricular (AV) node', 'Bundle of His', 'Purkinje fibers'],
    answer: 'Sinoatrial (SA) node',
    answer_index: 0,
    explanation: 'The sinoatrial (SA) node, situated in the superior posterolateral wall of the right atrium, generates spontaneous action potentials at approximately 60–100 beats per minute.',
  },
  // Physics & Chemistry
  {
    category_id: 'cat-physics-chem',
    subcategory_id: 'sub-quantum',
    level: 1,
    question: 'Heisenberg’s Uncertainty Principle establishes a fundamental lower bound on the product of uncertainties of which pair of complementary observables?',
    options: ['Position and Linear Momentum (Δx · Δp ≥ ℏ/2)', 'Energy and Mass (ΔE · Δm ≥ c²)', 'Electric Field and Temperature', 'Angular velocity and Charge'],
    answer: 'Position and Linear Momentum (Δx · Δp ≥ ℏ/2)',
    answer_index: 0,
    explanation: 'Heisenberg’s inequality states that the simultaneous precision of position and momentum is fundamentally constrained by Planck’s reduced constant: Δx · Δp ≥ ℏ/2.',
  },
  // General & Logic
  {
    category_id: 'cat-general',
    subcategory_id: 'sub-logic',
    level: 1,
    question: 'If all A are B, and some B are C, which of the following statements MUST logically be true?',
    options: [
      'None of the choices necessarily follow without additional premises',
      'All A are C',
      'Some A are definitely C',
      'No A can ever be C',
    ],
    answer: 'None of the choices necessarily follow without additional premises',
    answer_index: 0,
    explanation: 'The intersection between B and C does not necessarily overlap with subset A. Therefore, without further information, no definitive relationship between A and C is guaranteed.',
  },
];

export const INITIAL_BADGES = [
  {
    id: 'badge-rookie',
    name: 'Quiz Rookie',
    description: 'Complete your first quiz in any subject',
    icon: '🎯',
    color: '#3b82f6',
    requirement: { type: 'quizzes_completed', count: 1 },
  },
  {
    id: 'badge-scholar',
    name: 'Rising Scholar',
    description: 'Score 100% accuracy on 3 different quizzes',
    icon: '🎓',
    color: '#8b5cf6',
    requirement: { type: 'perfect_scores', count: 3 },
  },
  {
    id: 'badge-streak',
    name: 'Streak Master',
    description: 'Maintain a 5-day daily quiz study streak',
    icon: '🔥',
    color: '#f59e0b',
    requirement: { type: 'streak_days', count: 5 },
  },
  {
    id: 'badge-ai-guru',
    name: 'AI Guru Master',
    description: 'Complete 5 AI-generated quizzes from study notes',
    icon: '🤖',
    color: '#10b981',
    requirement: { type: 'ai_quizzes_completed', count: 5 },
  },
  {
    id: 'badge-champion',
    name: 'Arena Champion',
    description: 'Earn 500 total quiz coins across all categories',
    icon: '👑',
    color: '#c564bb',
    requirement: { type: 'coins_earned', count: 500 },
  },
];

/**
 * Ensures initial quiz collections are seeded with rich categories & questions if empty.
 */
export async function ensureQuizSeeded() {
  try {
    const db = await getDatabase();
    const categoriesCount = await db.collection('quiz_categories').countDocuments().catch(() => 0);
    if (categoriesCount === 0) {
      await db.collection('quiz_categories').insertMany(INITIAL_CATEGORIES).catch(() => {});
    }

    const questionsCount = await db.collection('quiz_questions').countDocuments().catch(() => 0);
    if (questionsCount === 0) {
      await db.collection('quiz_questions').insertMany(INITIAL_QUESTIONS).catch(() => {});
    }

    const badgesCount = await db.collection('quiz_badges').countDocuments().catch(() => 0);
    if (badgesCount === 0) {
      await db.collection('quiz_badges').insertMany(INITIAL_BADGES).catch(() => {});
    }
  } catch (err) {
    console.warn('[QuizDb] Seed notice:', err.message);
  }
}
