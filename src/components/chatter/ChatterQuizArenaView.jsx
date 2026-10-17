'use client';

import { useState, useEffect, useRef } from 'react';
import QuizPlayModal from '@/components/quiz/QuizPlayModal';
import EliteIcon from '@/components/elite/EliteIcon';
import EliteUserHeader from '@/components/elite/EliteUserHeader';
import UserAchievements from '@/components/elite/UserAchievements';
import QuizGridCard from '@/components/elite/QuizGridCard';

// 13 Elite Quiz Game Modes Specifications
const ELITE_QUIZ_MODES = [
  {
    id: 'quiz_zone',
    title: 'Quiz Zone',
    desc: 'Select your favorite zone to play',
    icon: '🎯',
    color: '#c564bb',
    accentBg: 'rgba(197, 100, 187, 0.15)',
    accentBorder: 'rgba(197, 100, 187, 0.35)',
    tag: 'CATEGORIES & LEVELS',
  },
  {
    id: 'daily_quiz',
    title: 'Daily Quiz',
    desc: 'Daily basic new quiz game',
    icon: '🔥',
    color: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.15)',
    accentBorder: 'rgba(245, 158, 11, 0.35)',
    tag: '+50 BONUS COINS',
  },
  {
    id: 'true_false',
    title: 'True / False',
    desc: 'Choice your rapid answers',
    icon: '⚖️',
    color: '#10b981',
    accentBg: 'rgba(16, 185, 129, 0.15)',
    accentBorder: 'rgba(16, 185, 129, 0.35)',
    tag: 'RAPID FIRE',
  },
  {
    id: 'fun_learn',
    title: 'Fun & Learn',
    desc: "It's like a comprehension game",
    icon: '📖',
    color: '#3b82f6',
    accentBg: 'rgba(59, 130, 246, 0.15)',
    accentBorder: 'rgba(59, 130, 246, 0.35)',
    tag: 'STORY & PASSAGE',
  },
  {
    id: 'guess_the_word',
    title: 'Guess The Word',
    desc: 'Fun vocabulary mystery game',
    icon: '🧩',
    color: '#ec4899',
    accentBg: 'rgba(236, 72, 153, 0.15)',
    accentBorder: 'rgba(236, 72, 153, 0.35)',
    tag: 'LETTER TILES',
  },
  {
    id: 'self_challenge',
    title: 'Self-Challenge',
    desc: 'Challenge yourself under timer',
    icon: '⏱️',
    color: '#8b5cf6',
    accentBg: 'rgba(139, 92, 246, 0.15)',
    accentBorder: 'rgba(139, 92, 246, 0.35)',
    tag: 'CUSTOM SPEED DRILL',
  },
  {
    id: '1_vs_1_battle',
    title: '1 v/s 1 Battle',
    desc: 'Battle with one on one',
    icon: '⚔️',
    color: '#ef4444',
    accentBg: 'rgba(239, 68, 68, 0.15)',
    accentBorder: 'rgba(239, 68, 68, 0.35)',
    tag: 'LIVE DUEL',
  },
  {
    id: 'group_battle',
    title: 'Group Battle',
    desc: "It's a multiplayer quiz room",
    icon: '🛡️',
    color: '#6366f1',
    accentBg: 'rgba(99, 102, 241, 0.15)',
    accentBorder: 'rgba(99, 102, 241, 0.35)',
    tag: 'ROOM CODE LOBBY',
  },
  {
    id: 'audio_questions',
    title: 'Audio Questions',
    desc: 'Listen carefully and answer',
    icon: '🎧',
    color: '#14b8a6',
    accentBg: 'rgba(20, 184, 166, 0.15)',
    accentBorder: 'rgba(20, 184, 166, 0.35)',
    tag: 'VOICE SYNTHESIS',
  },
  {
    id: 'math_mania',
    title: 'Math Mania',
    desc: 'Challenge your mental math',
    icon: '🔢',
    color: '#f97316',
    accentBg: 'rgba(249, 115, 22, 0.15)',
    accentBorder: 'rgba(249, 115, 22, 0.35)',
    tag: 'EQUATIONS & ARITHMETIC',
  },
  {
    id: 'exam_module',
    title: 'Exam Module',
    desc: 'Simulated full-length mock exam',
    icon: '📝',
    color: '#06b6d4',
    accentBg: 'rgba(6, 182, 212, 0.15)',
    accentBorder: 'rgba(6, 182, 212, 0.35)',
    tag: 'PALETTE & REVIEW',
  },
  {
    id: 'multi_match',
    title: 'Multi Match',
    desc: 'Connect terms with definitions',
    icon: '🔗',
    color: '#a855f7',
    accentBg: 'rgba(168, 85, 247, 0.15)',
    accentBorder: 'rgba(168, 85, 247, 0.35)',
    tag: 'PAIR CONNECTOR',
  },
  {
    id: 'play_bookmarks',
    title: 'Play Bookmarks',
    desc: 'Revise questions you saved',
    icon: '🔖',
    color: '#eab308',
    accentBg: 'rgba(234, 179, 8, 0.15)',
    accentBorder: 'rgba(234, 179, 8, 0.35)',
    tag: 'PRACTICE SAVED',
  },
];

// Sample vocabulary words for Guess The Word
const GUESS_WORDS = [
  { word: 'MITOCHONDRIA', clue: 'The powerhouse of biological cells producing ATP energy', category: 'Biology' },
  { word: 'ALGORITHM', clue: 'Step-by-step procedure for solving a computational problem', category: 'Computer Science' },
  { word: 'PHOTOSYNTHESIS', clue: 'Process by which plants convert sunlight into chemical glucose', category: 'Botany' },
  { word: 'GRAVITATION', clue: 'Universal natural force of attraction between masses', category: 'Physics' },
  { word: 'DERIVATIVE', clue: 'Rate of instantaneous change of a function with respect to a variable', category: 'Calculus' },
];

// Sample Fun & Learn comprehension passages
const FUN_LEARN_STORIES = [
  {
    title: 'The Architecture of Deep Neural Networks',
    passage: `Artificial neural networks draw mathematical inspiration from biological neurobiology. A feedforward network organizes artificial neurons into an input layer, one or more hidden representations, and a terminal output layer. As numerical signals propagate forward, each artificial synapse applies a scalar weight and a directional bias term, followed by an activation nonlinearity like ReLU or GELU.\n\nDuring model training, the network quantifies its error against ground truth targets using a specialized loss function (such as cross-entropy or mean squared error). Backward propagation—formally derived via the multivariable chain rule—calculates partial derivatives of this loss with respect to every weight parameter in the network, allowing gradient descent optimizers like Adam to progressively minimize prediction error.`,
    questions: [
      {
        question: 'What mathematical principle enables backpropagation to compute gradients through hidden layers?',
        options: ['Multivariable chain rule of calculus', 'Pythagorean trigonometric theorem', 'Gauss-Jordan row elimination', 'Fourier transform synthesis'],
        answer: 'Multivariable chain rule of calculus',
        answer_index: 0,
        explanation: 'Backpropagation computes the gradient of the scalar loss with respect to weight tensors through recursive application of the calculus chain rule.',
      },
      {
        question: 'Which of the following functions serves as an activation function introducing non-linearity?',
        options: ['ReLU', 'Matrix dot product', 'Euclidean norm', 'Loss cross-entropy'],
        answer: 'ReLU',
        answer_index: 0,
        explanation: 'ReLU (Rectified Linear Unit) max(0, x) provides computational non-linearity, enabling deep networks to approximate complex continuous functions.',
      },
      {
        question: 'What component quantifies the difference between predictions and ground-truth targets?',
        options: ['Loss function', 'Bias scalar', 'Synaptic neuron', 'Input buffer'],
        answer: 'Loss function',
        answer_index: 0,
        explanation: 'The loss function mathematically penalizes erroneous outputs, guiding optimization updates.',
      },
    ],
  },
];

export default function ChatterQuizArenaView({
  user,
  profile,
  initialTab = 'home',
  onBack,
  onOpenGuru,
  onOpenNotifications,
  onOpenCoinStore,
}) {
  const [arenaTab, setArenaTab] = useState(initialTab || 'home'); // 'home' | 'quiz_zone' | 'play_zone' | 'leaderboard'
  const [leaderboardFilter, setLeaderboardFilter] = useState('all_time'); // 'all_time' | 'month' | 'daily'
  const [dailyCoinsClaimed, setDailyCoinsClaimed] = useState(false);

  useEffect(() => {
    if (initialTab) setArenaTab(initialTab);
  }, [initialTab]);

  const [categories, setCategories] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({
    coins: 100,
    total_played: 0,
    score: 0,
    streak: 1,
    accuracy: 85,
    unlocked_badges: ['badge-rookie'],
  });
  const [leaderboard, setLeaderboard] = useState([]);

  // Active playing quiz session for QuizPlayModal
  const [activeQuizSession, setActiveQuizSession] = useState(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  // Modal states for specific modes
  const [activeModeModal, setActiveModeModal] = useState(null); // 'quiz_zone' | 'self_challenge' | 'ai_quiz' | '1_vs_1' | 'group_battle' | 'guess_word' | 'fun_learn' | 'math_mania' | 'audio_questions' | 'exam_module' | 'multi_match'

  // Self Challenge state
  const [scCategory, setScCategory] = useState('all');
  const [scCount, setScCount] = useState(5);
  const [scTime, setScTime] = useState(30);

  // AI Quiz state
  const [aiTopic, setAiTopic] = useState('');
  const [aiSelectedDocId, setAiSelectedDocId] = useState('');
  const [generatingAiQuiz, setGeneratingAiQuiz] = useState(false);

  // 1 v/s 1 Battle state
  const [duelChallenger, setDuelChallenger] = useState(null);
  const [duelRound, setDuelRound] = useState(1);
  const [userDuelScore, setUserDuelScore] = useState(0);
  const [botDuelScore, setBotDuelScore] = useState(0);
  const [duelMatchState, setDuelMatchState] = useState('matching'); // 'matching' | 'ready' | 'battling' | 'finished'

  // Group Battle state
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [roomPlayers, setRoomPlayers] = useState([]);

  // Guess The Word state
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [wordLetterPool, setWordLetterPool] = useState([]);
  const [wordWon, setWordWon] = useState(false);

  // Multi Match state
  const [matchPairs, setMatchPairs] = useState([
    { id: 1, left: 'CPU', right: 'Central Processing Unit', paired: false },
    { id: 2, left: 'RAM', right: 'Random Access Memory', paired: false },
    { id: 3, left: 'GPU', right: 'Graphics Processing Unit', paired: false },
    { id: 4, left: 'SSD', right: 'Solid State Drive', paired: false },
  ]);
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [selectedRight, setSelectedRight] = useState(null);
  const [matchScore, setMatchScore] = useState(0);

  // Audio Questions voice playback
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Load arena data
  const loadArenaData = async () => {
    try {
      const [catsRes, statsRes, lbRes, docsRes] = await Promise.all([
        fetch('/api/quiz/categories').then((r) => r.json()).catch(() => ({ categories: [] })),
        fetch('/api/quiz/stats').then((r) => r.json()).catch(() => ({ stats: null })),
        fetch('/api/quiz/leaderboard').then((r) => r.json()).catch(() => ({ leaderboard: [] })),
        fetch('/api/rag/documents').then((r) => r.json()).catch(() => ({ documents: [] })),
      ]);

      if (Array.isArray(catsRes?.categories)) setCategories(catsRes.categories);
      if (statsRes?.stats) setStats(statsRes.stats);
      if (Array.isArray(lbRes?.leaderboard)) setLeaderboard(lbRes.leaderboard);
      if (Array.isArray(docsRes?.documents)) setDocuments(docsRes.documents);
    } catch (err) {
      console.warn('Quiz Arena data notice:', err);
    }
  };

  useEffect(() => {
    loadArenaData();
  }, []);

  // Initialize Guess The Word letters
  useEffect(() => {
    if (activeModeModal === 'guess_word') {
      const target = GUESS_WORDS[currentWordIdx];
      if (target) {
        setGuessedLetters(new Array(target.word.length).fill(''));
        setWordWon(false);

        // Create scrambled pool with actual letters + 4 random distractors
        const wordArr = target.word.split('');
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const distractors = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
        const combined = [...wordArr, ...distractors].sort(() => 0.5 - Math.random());
        setWordLetterPool(combined.map((char, idx) => ({ id: `${char}-${idx}`, char, used: false })));
      }
    }
  }, [activeModeModal, currentWordIdx]);

  // Handle letter tile tap in Guess The Word
  const handleTapLetterTile = (tile) => {
    if (tile.used || wordWon) return;

    // Find first empty index in guessedLetters
    const emptyIdx = guessedLetters.findIndex((l) => l === '');
    if (emptyIdx === -1) return;

    const newGuessed = [...guessedLetters];
    newGuessed[emptyIdx] = tile.char;
    setGuessedLetters(newGuessed);

    // Mark tile as used
    setWordLetterPool((prev) =>
      prev.map((t) => (t.id === tile.id ? { ...t, used: true } : t))
    );

    // Check if word completed
    const targetWord = GUESS_WORDS[currentWordIdx].word;
    const completedStr = newGuessed.join('');
    if (completedStr === targetWord) {
      setWordWon(true);
      setStats((prev) => ({ ...prev, coins: (prev.coins || 100) + 20 }));
    }
  };

  // Remove letter from guess
  const handleRemoveGuessedLetter = (idx) => {
    if (wordWon || !guessedLetters[idx]) return;
    const char = guessedLetters[idx];

    const newGuessed = [...guessedLetters];
    newGuessed[idx] = '';
    setGuessedLetters(newGuessed);

    // Return letter to pool
    const poolIdx = wordLetterPool.findIndex((t) => t.char === char && t.used);
    if (poolIdx !== -1) {
      setWordLetterPool((prev) =>
        prev.map((t, i) => (i === poolIdx ? { ...t, used: false } : t))
      );
    }
  };

  // Launch Category Quiz
  const handleLaunchCategoryQuiz = async (cat) => {
    try {
      const res = await fetch(`/api/quiz/questions?category_id=${cat.id || cat._id}&limit=8&random=true`);
      const data = await res.json();
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        setActiveModeModal(null);
        setActiveQuizSession({
          title: `${cat.name} Quiz`,
          questions: data.questions,
          isAiQuiz: false,
        });
        setIsQuizModalOpen(true);
      } else {
        alert('No questions found in this category yet.');
      }
    } catch {
      alert('Failed to load quiz questions.');
    }
  };

  // Launch Daily Streak Quiz
  const handleStartDailyQuiz = async () => {
    try {
      const res = await fetch('/api/quiz/questions?limit=5&random=true');
      const data = await res.json();
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        setActiveQuizSession({
          title: 'Daily Streak Quiz Challenge 🔥',
          questions: data.questions,
          isAiQuiz: false,
        });
        setIsQuizModalOpen(true);
      }
    } catch {
      alert('Error loading daily quiz.');
    }
  };

  // Launch True / False Mode
  const handleStartTrueFalseQuiz = async () => {
    try {
      const tfQuestions = [
        {
          question: 'Light travels faster in water than in a vacuum.',
          options: ['True', 'False'],
          answer: 'False',
          answer_index: 1,
          explanation: 'Light travels fastest in a vacuum (approximately 300,000 km/s) and slows down in denser optical media like water.',
        },
        {
          question: 'DNA replication occurs in the 5’ to 3’ direction.',
          options: ['True', 'False'],
          answer: 'True',
          answer_index: 0,
          explanation: 'DNA polymerases add free nucleotides exclusively to the 3’ hydroxyl end of the growing strand.',
        },
        {
          question: 'In computer science, O(1) time complexity denotes constant execution time.',
          options: ['True', 'False'],
          answer: 'True',
          answer_index: 0,
          explanation: 'O(1) signifies an operation whose running time is independent of input size.',
        },
        {
          question: 'Absolute zero is measured as 0 degrees Celsius.',
          options: ['True', 'False'],
          answer: 'False',
          answer_index: 1,
          explanation: 'Absolute zero corresponds to 0 Kelvin or -273.15 degrees Celsius.',
        },
        {
          question: 'The mitochondria contain their own autonomous circular DNA genome.',
          options: ['True', 'False'],
          answer: 'True',
          answer_index: 0,
          explanation: 'In accordance with endosymbiotic theory, mitochondria retain mitochondrial DNA (mtDNA) inherited maternally.',
        },
      ];

      setActiveQuizSession({
        title: 'True / False Lightning Challenge ⚖️',
        questions: tfQuestions,
        isAiQuiz: false,
      });
      setIsQuizModalOpen(true);
    } catch {
      alert('Failed to launch True / False mode.');
    }
  };

  // Launch Audio Questions (uses Web Speech API)
  const handleStartAudioQuiz = () => {
    const audioQuestions = [
      {
        question: 'Listen to the pronounced term: What is the primary function of Hemoglobin?',
        spokenText: 'What is the biological function of hemoglobin in arterial blood circulation?',
        options: [
          'Transport oxygen from the lungs to cellular tissues',
          'Break down complex starches into maltose sugars',
          'Synthesize messenger RNA transcripts from DNA',
          'Act as a protective barrier in cell membrane walls',
        ],
        answer: 'Transport oxygen from the lungs to cellular tissues',
        answer_index: 0,
        explanation: 'Hemoglobin is an iron-containing metalloprotein in red blood cells that reversibly binds molecular oxygen.',
      },
      {
        question: 'Listen to the scientific statement: Which fundamental force governs planetary orbits?',
        spokenText: 'Which of the fundamental physical interactions keeps planets orbiting celestial bodies?',
        options: ['Gravitational force', 'Strong nuclear force', 'Electromagnetic repulsion', 'Weak decay force'],
        answer: 'Gravitational force',
        answer_index: 0,
        explanation: 'Gravity is the long-range attractive force that dictates planetary and orbital mechanics.',
      },
    ];

    setActiveModeModal('audio_questions');
    setActiveQuizSession({
      title: 'Audio Questions Voice Drill 🎧',
      questions: audioQuestions,
      isAiQuiz: false,
    });
  };

  // Speak aloud via Web Speech API
  const playSpeechText = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Speech synthesis is not supported on this device/browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  };

  // Launch Math Mania
  const handleStartMathMania = () => {
    const mathQuestions = [
      {
        question: 'Evaluate the limit: lim (x → 0) [sin(x) / x] = ?',
        options: ['1', '0', 'Undefined', 'Infinity'],
        answer: '1',
        answer_index: 0,
        explanation: 'By standard Taylor series expansion or L’Hôpital’s rule: lim (x → 0) cos(x)/1 = 1.',
      },
      {
        question: 'If matrix A has determinant det(A) = 4, what is det(A⁻¹)?',
        options: ['0.25', '4', '-4', '16'],
        answer: '0.25',
        answer_index: 0,
        explanation: 'Since det(A · A⁻¹) = det(I) = 1, det(A⁻¹) = 1 / det(A) = 1/4 = 0.25.',
      },
      {
        question: 'What is the derivative d/dx [e^(3x)]?',
        options: ['3e^(3x)', 'e^(3x)', '3x e^(3x-1)', '(1/3)e^(3x)'],
        answer: '3e^(3x)',
        answer_index: 0,
        explanation: 'Applying the chain rule gives d/dx [e^(3x)] = 3 · e^(3x).',
      },
      {
        question: 'Calculate: 15 × 14 - 110 = ?',
        options: ['100', '110', '90', '120'],
        answer: '100',
        answer_index: 0,
        explanation: '15 × 14 = 210. 210 - 110 = 100.',
      },
    ];

    setActiveQuizSession({
      title: 'Math Mania Speed Challenge 🔢',
      questions: mathQuestions,
      isAiQuiz: false,
    });
    setIsQuizModalOpen(true);
  };

  // Launch Self-Challenge
  const handleStartSelfChallenge = async () => {
    try {
      const params = new URLSearchParams({ limit: scCount, random: 'true' });
      if (scCategory !== 'all') params.set('category_id', scCategory);

      const res = await fetch(`/api/quiz/questions?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        setActiveModeModal(null);
        setActiveQuizSession({
          title: `Self-Challenge (${scCount} Questions • ${scTime}s)`,
          questions: data.questions,
          isAiQuiz: false,
        });
        setIsQuizModalOpen(true);
      }
    } catch {
      alert('Failed to launch challenge.');
    }
  };

  // Launch AI Note-to-Quiz
  const handleStartAiQuiz = async () => {
    if (!aiTopic.trim() && !aiSelectedDocId) {
      alert('Please select a document or type a topic.');
      return;
    }

    setGeneratingAiQuiz(true);
    try {
      const res = await fetch('/api/quiz/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          documentId: aiSelectedDocId || null,
          count: 5,
        }),
      });

      const data = await res.json();
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        setActiveModeModal(null);
        setActiveQuizSession({
          title: `AI Quiz: ${data.title || aiTopic}`,
          questions: data.questions,
          isAiQuiz: true,
        });
        setIsQuizModalOpen(true);
      }
    } catch {
      alert('Error synthesizing AI quiz with Gemini.');
    } finally {
      setGeneratingAiQuiz(false);
    }
  };

  // Launch 1 v/s 1 Duel Matchmaking
  const handleStart1v1Battle = () => {
    setActiveModeModal('1_vs_1');
    setDuelMatchState('matching');
    setUserDuelScore(0);
    setBotDuelScore(0);
    setDuelRound(1);

    // Simulated peer matchmaking
    setTimeout(() => {
      const opponents = [
        { name: 'Alex M.', school: 'Oxford Scholar', avatar: '🎓', rank: 1420 },
        { name: 'Maya Chen', school: 'MIT Fellow', avatar: '🔬', rank: 1490 },
        { name: 'David Kim', school: 'Cambridge Scholar', avatar: '📚', rank: 1380 },
      ];
      setDuelChallenger(opponents[Math.floor(Math.random() * opponents.length)]);
      setDuelMatchState('ready');
    }, 1800);
  };

  // Advance 1v1 simulated round
  const handlePlayDuelRound = (userCorrect) => {
    const userGain = userCorrect ? 100 : 0;
    const botGain = Math.random() > 0.35 ? 100 : 0;

    setUserDuelScore((prev) => prev + userGain);
    setBotDuelScore((prev) => prev + botGain);

    if (duelRound >= 3) {
      setDuelMatchState('finished');
      setStats((prev) => ({
        ...prev,
        coins: userCorrect ? (prev.coins || 100) + 30 : prev.coins,
      }));
    } else {
      setDuelRound((prev) => prev + 1);
    }
  };

  // Launch Group Battle Lobby
  const handleCreateGroupRoom = () => {
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomCode(generated);
    setRoomPlayers([
      { name: user?.name || 'You (Host)', avatar: '👑', isHost: true },
      { name: 'Elena R.', avatar: '👩‍🎓', isHost: false },
      { name: 'Kiran P.', avatar: '👨‍🎓', isHost: false },
    ]);
    setActiveModeModal('group_battle');
  };

  // Multi-Match pairing
  const handleSelectPairItem = (type, item) => {
    if (type === 'left') {
      setSelectedLeft(item);
      if (selectedRight) checkPair(item, selectedRight);
    } else {
      setSelectedRight(item);
      if (selectedLeft) checkPair(selectedLeft, item);
    }
  };

  const checkPair = (left, right) => {
    if (left.id === right.id) {
      setMatchPairs((prev) =>
        prev.map((p) => (p.id === left.id ? { ...p, paired: true } : p))
      );
      setMatchScore((prev) => prev + 25);
    }
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100dvh',
        overflowY: 'auto',
        background: 'var(--background)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Elite Floating User Profile Header ── */}
      <EliteUserHeader
        profile={profile || user}
        onBack={onBack}
        onOpenGuru={onOpenGuru}
        onOpenNotifications={onOpenNotifications}
        onOpenCoinStore={onOpenCoinStore}
      />

      {/* ── Main Scroll Content ── */}
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          margin: '0 auto',
          padding: '16px 16px 100px',
          boxSizing: 'border-box',
          flex: 1,
        }}
      >
        {/* ── Sub Navigation Tabs (Elite Quiz Style) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'none',
          }}
        >
          {[
            { id: 'home', label: 'Home', icon: 'home' },
            { id: 'quiz_zone', label: 'Quiz Zone', icon: 'categories' },
            { id: 'play_zone', label: 'Play Zone', icon: 'play' },
            { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
          ].map((tab) => {
            const isActive = arenaTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setArenaTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 22,
                  fontSize: 13.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: isActive ? 'none' : '1px solid var(--border)',
                  background: isActive ? 'var(--primary-color)' : 'var(--card)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: isActive ? '0 4px 14px rgba(239, 83, 136, 0.35)' : 'none',
                  transition: 'all 0.18s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <EliteIcon
                  name={tab.icon}
                  size={16}
                  color={isActive ? '#ffffff' : 'var(--text-muted)'}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ══════════ TAB 1: HOME (Elite Quiz Home Replica) ══════════ */}
        {arenaTab === 'home' && (
          <div>
            {/* User Achievements Floating Card: Rank, Coins, Score */}
            <UserAchievements
              userRank={stats.rank || '1'}
              userCoins={stats.coins || 100}
              userScore={stats.score || 500}
            />

            {/* Daily Coins Bonus Banner */}
            <div
              onClick={() => {
                if (!dailyCoinsClaimed) {
                  setDailyCoinsClaimed(true);
                  setStats((prev) => ({ ...prev, coins: (prev.coins || 100) + 50 }));
                }
              }}
              style={{
                marginTop: 18,
                background: 'var(--card)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
                border: '1px solid var(--border)',
                transition: 'transform 0.15s ease',
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <img
                  src="/elite_assets/images/daily_coins.svg"
                  alt="Daily Coins"
                  style={{ width: 32, height: 32 }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {dailyCoinsClaimed ? 'Daily Bonus Collected!' : 'Daily Free Coins'}
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  {dailyCoinsClaimed ? '+50 Coins awarded to your account today' : 'Claim 50 bonus coins every 24 hours'}
                </p>
              </div>
              <button
                type="button"
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: dailyCoinsClaimed ? 'var(--bg-hover)' : 'var(--primary-color)',
                  color: dailyCoinsClaimed ? 'var(--text-muted)' : '#ffffff',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: dailyCoinsClaimed ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {dailyCoinsClaimed ? 'Claimed ✓' : 'Claim +50'}
              </button>
            </div>

            {/* Live Contest Section */}
            <div style={{ marginTop: 26 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Contest
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModeModal('quiz_zone')}
                  style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  View All
                </button>
              </div>

              <div
                style={{
                  background: 'var(--card)',
                  borderRadius: 12,
                  padding: 16,
                  border: '1px solid var(--border)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      background: 'rgba(239, 83, 136, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 26,
                      flexShrink: 0,
                    }}
                  >
                    🏆
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                      Mega Scholar Grand Contest
                    </h4>
                    <p style={{ margin: '4px 0 8px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Compete with active scholars across university curricula. Winner receives 500 coins!
                    </p>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>Entry: <strong style={{ color: 'var(--text-primary)' }}>20 Coins</strong></span>
                      <span>•</span>
                      <span>Ends: <strong style={{ color: 'var(--text-primary)' }}>Today</strong></span>
                      <span>•</span>
                      <span><strong style={{ color: 'var(--text-primary)' }}>180</strong> Scholars</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleLaunchCategoryQuiz({ id: 'contest_grand', name: 'Mega Scholar Grand Contest' })}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    padding: '10px 0',
                    borderRadius: 8,
                    background: 'var(--page-background)',
                    color: 'var(--primary-color)',
                    border: 'none',
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  Play Now
                </button>
              </div>
            </div>

            {/* Battle of the Day (Exact 2-column Grid) */}
            <div style={{ marginTop: 28 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>
                Battle of the Day
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <QuizGridCard
                  title="Group Play"
                  desc="Play with friends in live room"
                  img="/elite_assets/images/group_battle.svg"
                  onTap={handleCreateGroupRoom}
                />
                <QuizGridCard
                  title="1 vs 1 Battle"
                  desc="Battle with random player"
                  img="/elite_assets/images/one_vs_one.svg"
                  onTap={handleStart1v1Battle}
                />
              </div>
            </div>

            {/* Self / Exam Zone (Exact 2-column Grid) */}
            <div style={{ marginTop: 28 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>
                Self / Exam Zone
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <QuizGridCard
                  title="Exam"
                  desc="Exam with negative marking"
                  img="/elite_assets/images/exam.svg"
                  onTap={() => setActiveModeModal('exam_module')}
                />
                <QuizGridCard
                  title="Self Challenge"
                  desc="Test yourself with timer"
                  img="/elite_assets/images/self_challenge.svg"
                  onTap={() => setActiveModeModal('self_challenge')}
                />
              </div>
            </div>

            {/* StudyCord Feature: AI Note-to-Quiz Synthesizer */}
            <div style={{ marginTop: 28 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>
                AI Guru Quiz Maker
              </h3>
              <div
                onClick={() => setActiveModeModal('ai_quiz')}
                style={{
                  background: 'linear-gradient(135deg, rgba(239, 83, 136, 0.12) 0%, rgba(197, 100, 187, 0.18) 100%)',
                  border: '1.5px solid rgba(239, 83, 136, 0.35)',
                  borderRadius: 14,
                  padding: '18px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'var(--primary-color)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    ✨
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                      Synthesize From Study Notes
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                      Convert any lecture topic, PDF or document into interactive drills with AI Guru
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 20, color: 'var(--primary-color)', fontWeight: 900 }}>→</span>
              </div>
            </div>

            {/* Play Zone Quick Pick */}
            <div style={{ marginTop: 28, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Play Zone Highlights
                </h3>
                <button
                  type="button"
                  onClick={() => setArenaTab('play_zone')}
                  style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  View All ({ELITE_QUIZ_MODES.length})
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <QuizGridCard
                  title="Daily Quiz"
                  desc="Fresh questions every day"
                  img="/elite_assets/images/daily_quiz.svg"
                  onTap={handleStartDailyQuiz}
                />
                <QuizGridCard
                  title="Guess The Word"
                  desc="Vocabulary mystery drill"
                  img="/elite_assets/images/guess_the_word.svg"
                  onTap={() => setActiveModeModal('guess_word')}
                />
                <QuizGridCard
                  title="Fun & Learn"
                  desc="Comprehension study game"
                  img="/elite_assets/images/fun_n_learn.svg"
                  onTap={() => setActiveModeModal('fun_learn')}
                />
                <QuizGridCard
                  title="True / False"
                  desc="Rapid speed answer choices"
                  img="/elite_assets/images/true_false_quiz.svg"
                  onTap={handleStartTrueFalseQuiz}
                />
              </div>
            </div>
          </div>
        )}

        {/* ══════════ TAB 2: QUIZ ZONE CATEGORIES (Elite Quiz Zone Replica) ══════════ */}
        {arenaTab === 'quiz_zone' && (
          <div style={{ marginTop: 8 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              Quiz Zone
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-muted)' }}>
              Select an academic category to level up your mastery
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {categories.map((cat) => (
                <div
                  key={cat.id || cat._id}
                  onClick={() => handleLaunchCategoryQuiz(cat)}
                  style={{
                    background: 'var(--card)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    border: '1px solid var(--border)',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                        flexShrink: 0,
                      }}
                    >
                      {cat.image || '📚'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cat.name}
                      </h4>
                      <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                        Questions: {cat.question_count || 12}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      color: 'var(--text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    ›
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════ TAB 3: PLAY ZONE MODES (Elite Play Zone Replica) ══════════ */}
        {arenaTab === 'play_zone' && (
          <div style={{ marginTop: 8 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              Play Zone
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-muted)' }}>
              Explore all interactive quiz game modes and earn coins
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <QuizGridCard
                title="Daily Quiz"
                desc="Daily new quiz challenge"
                img="/elite_assets/images/daily_quiz.svg"
                onTap={handleStartDailyQuiz}
              />
              <QuizGridCard
                title="Fun & Learn"
                desc="Comprehension reading game"
                img="/elite_assets/images/fun_n_learn.svg"
                onTap={() => setActiveModeModal('fun_learn')}
              />
              <QuizGridCard
                title="Guess The Word"
                desc="Vocabulary puzzle drill"
                img="/elite_assets/images/guess_the_word.svg"
                onTap={() => setActiveModeModal('guess_word')}
              />
              <QuizGridCard
                title="Audio Questions"
                desc="Listen and answer fast"
                img="/elite_assets/images/audio_quiz.svg"
                onTap={handleStartAudioQuiz}
              />
              <QuizGridCard
                title="Math Mania"
                desc="Quick calculus and arithmetic"
                img="/elite_assets/images/maths_quiz.svg"
                onTap={handleStartMathMania}
              />
              <QuizGridCard
                title="True / False"
                desc="Speed true/false choices"
                img="/elite_assets/images/true_false_quiz.svg"
                onTap={handleStartTrueFalseQuiz}
              />
              <QuizGridCard
                title="Multi Match"
                desc="Match terms with definitions"
                img="/elite_assets/images/multi_match.svg"
                onTap={() => setActiveModeModal('multi_match')}
              />
              <QuizGridCard
                title="Self Challenge"
                desc="Custom count & countdown"
                img="/elite_assets/images/self_challenge.svg"
                onTap={() => setActiveModeModal('self_challenge')}
              />
            </div>
          </div>
        )}

        {/* ══════════ TAB 4: LEADERBOARD PODIUM & LIST (Elite Quiz Replica) ══════════ */}
        {arenaTab === 'leaderboard' && (
          <div style={{ marginTop: 8 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              Leaderboard
            </h3>

            {/* Filter Pills */}
            <div
              style={{
                display: 'flex',
                background: 'var(--card)',
                borderRadius: 12,
                padding: 4,
                border: '1px solid var(--border)',
                marginBottom: 20,
              }}
            >
              {[
                { id: 'all_time', label: 'All Time' },
                { id: 'month', label: 'Month' },
                { id: 'daily', label: 'Daily' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLeaderboardFilter(f.id)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 8,
                    border: 'none',
                    background: leaderboardFilter === f.id ? 'var(--primary-color)' : 'transparent',
                    color: leaderboardFilter === f.id ? '#ffffff' : 'var(--text-muted)',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Top 3 Podium */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, padding: '16px 0 12px' }}>
              {/* Rank 2 (Silver) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 90 }}>
                <div style={{ position: 'relative', width: 62, height: 62 }}>
                  <img
                    src={leaderboard[1]?.avatar || '/elite_assets/images/profile/2.png'}
                    alt="Rank 2"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2.5px solid #94a3b8', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#94a3b8',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--card)',
                    }}
                  >
                    2
                  </div>
                </div>
                <span style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', maxWidth: 84, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {leaderboard[1]?.name || 'Scholar 2'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                  {leaderboard[1]?.score || 420}
                </span>
              </div>

              {/* Rank 1 (Gold - Taller) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 104, marginBottom: 12 }}>
                <span style={{ fontSize: 24, marginBottom: -4 }}>👑</span>
                <div style={{ position: 'relative', width: 76, height: 76 }}>
                  <img
                    src={leaderboard[0]?.avatar || '/elite_assets/images/profile/1.png'}
                    alt="Rank 1"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', border: '3px solid #f59e0b', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -9,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#f59e0b',
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--card)',
                    }}
                  >
                    1
                  </div>
                </div>
                <span style={{ marginTop: 12, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', maxWidth: 96, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {leaderboard[0]?.name || 'Top Scholar'}
                </span>
                <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary-color)', marginTop: 2 }}>
                  {leaderboard[0]?.score || 650}
                </span>
              </div>

              {/* Rank 3 (Bronze) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 90 }}>
                <div style={{ position: 'relative', width: 62, height: 62 }}>
                  <img
                    src={leaderboard[2]?.avatar || '/elite_assets/images/profile/3.png'}
                    alt="Rank 3"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2.5px solid #b45309', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#b45309',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--card)',
                    }}
                  >
                    3
                  </div>
                </div>
                <span style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', maxWidth: 84, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {leaderboard[2]?.name || 'Scholar 3'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                  {leaderboard[2]?.score || 380}
                </span>
              </div>
            </div>

            {/* List of ranks 4 to 10 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 10 }}>
              {leaderboard.slice(3, 10).map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: idx < leaderboard.slice(3, 10).length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ width: 22, fontSize: 14, fontWeight: 800, color: 'var(--text-muted)' }}>
                      #{idx + 4}
                    </span>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {s.name?.charAt(0) || 'S'}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {s.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {s.score} pts
                  </span>
                </div>
              ))}
            </div>

            {/* Sticky "My Rank" Bar */}
            <div
              style={{
                position: 'sticky',
                bottom: 10,
                marginTop: 18,
                background: 'var(--card)',
                borderRadius: 12,
                padding: '12px 18px',
                border: '1.5px solid var(--primary-color)',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--primary-color)' }}>
                  #{stats.rank || 1}
                </span>
                <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--primary-color)' }}>
                  <img
                    src={profile?.avatar_url || '/elite_assets/images/profile/1.png'}
                    alt="My Profile"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.src = '/elite_assets/images/profile/1.png';
                    }}
                  />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {profile?.full_name || profile?.username || user?.user_metadata?.full_name || 'My Rank'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 900, color: 'var(--primary-color)' }}>
                <span>{stats.score || 500} pts</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ MODALS FOR GAME MODES ══════════ */}

      {/* 1. MODAL: Self-Challenge */}
      {activeModeModal === 'self_challenge' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 460, background: 'var(--card)', borderRadius: 24, border: '1px solid var(--border)', padding: 26, color: 'var(--text-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18.5, fontWeight: 900 }}>🎯 Configure Self-Challenge</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                Subject / Category:
              </label>
              <select
                value={scCategory}
                onChange={(e) => setScCategory(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', fontSize: 13.5 }}
              >
                <option value="all">All Academic Subjects</option>
                {categories.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                Number of Questions:
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[5, 10, 15].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setScCount(cnt)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 12,
                      border: scCount === cnt ? '1.5px solid var(--primary-color)' : '1px solid var(--border)',
                      background: scCount === cnt ? 'rgba(197, 100, 187, 0.15)' : 'var(--bg-hover)',
                      color: scCount === cnt ? 'var(--primary-color)' : 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {cnt} Questions
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setActiveModeModal(null)}
                style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-primary)', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartSelfChallenge}
                style={{ background: 'var(--primary-color)', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(197, 100, 187, 0.4)' }}
              >
                Start Challenge ⚡
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL: AI Note-to-Quiz */}
      {activeModeModal === 'ai_quiz' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 490, background: 'var(--card)', borderRadius: 24, border: '1px solid var(--border)', padding: 26, color: 'var(--text-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18.5, fontWeight: 900 }}>✨ AI Note-to-Quiz Generator</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Synthesize 5 custom quiz questions grounded in your uploaded study notes or any lecture topic.
            </p>

            {documents.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Select from your AI Guru Study Documents:
                </label>
                <select
                  value={aiSelectedDocId}
                  onChange={(e) => setAiSelectedDocId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', fontSize: 13.5 }}
                >
                  <option value="">-- Enter custom topic instead --</option>
                  {documents.map((d) => (
                    <option key={d.doc_id || d._id} value={d.doc_id || d._id}>
                      📄 {d.filename || d.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                Or enter any custom topic/concept:
              </label>
              <input
                type="text"
                placeholder="e.g. Backpropagation, Photosynthesis, French Revolution..."
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 12, background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setActiveModeModal(null)}
                style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-primary)', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generatingAiQuiz}
                onClick={handleStartAiQuiz}
                style={{
                  background: generatingAiQuiz ? '#666' : 'linear-gradient(135deg, #c564bb 0%, #8b5cf6 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 22px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: generatingAiQuiz ? 'wait' : 'pointer',
                  boxShadow: '0 4px 15px rgba(197, 100, 187, 0.4)',
                }}
              >
                {generatingAiQuiz ? 'Synthesizing...' : '⚡ Generate & Play'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL: Guess The Word */}
      {activeModeModal === 'guess_word' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 520, background: 'var(--card)', borderRadius: 24, border: '1px solid var(--border)', padding: 26, color: 'var(--text-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 900 }}>🧩 Guess The Word</h3>
              <span style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 800 }}>
                {GUESS_WORDS[currentWordIdx]?.category}
              </span>
            </div>

            <div style={{ background: 'var(--bg-hover)', borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-color)', display: 'block', marginBottom: 4 }}>
                CLUE:
              </span>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                {GUESS_WORDS[currentWordIdx]?.clue}
              </p>
            </div>

            {/* Answer letter slots */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
              {guessedLetters.map((char, idx) => (
                <div
                  key={idx}
                  onClick={() => handleRemoveGuessedLetter(idx)}
                  style={{
                    width: 40,
                    height: 48,
                    borderRadius: 10,
                    border: char ? '2px solid var(--primary-color)' : '1px dashed var(--border)',
                    background: char ? 'rgba(197, 100, 187, 0.15)' : 'var(--input-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 900,
                    color: 'var(--primary-color)',
                    cursor: char ? 'pointer' : 'default',
                  }}
                >
                  {char}
                </div>
              ))}
            </div>

            {wordWon ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
                <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 900, color: '#10b981' }}>
                  Splendid! Word Solved (+20 Coins)
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                  The mystery term was <strong>{GUESS_WORDS[currentWordIdx].word}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentWordIdx((prev) => (prev + 1) % GUESS_WORDS.length);
                  }}
                  style={{ background: 'var(--primary-color)', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 14, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
                >
                  Next Mystery Word →
                </button>
              </div>
            ) : (
              <>
                {/* Scrambled letter tiles */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
                  {wordLetterPool.map((tile) => (
                    <button
                      key={tile.id}
                      type="button"
                      disabled={tile.used}
                      onClick={() => handleTapLetterTile(tile)}
                      style={{
                        width: 38,
                        height: 42,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: tile.used ? 'transparent' : 'var(--bg-hover)',
                        color: tile.used ? 'transparent' : 'var(--text-primary)',
                        fontSize: 16,
                        fontWeight: 800,
                        cursor: tile.used ? 'default' : 'pointer',
                        opacity: tile.used ? 0.2 : 1,
                      }}
                    >
                      {tile.char}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setActiveModeModal(null)}
                    style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-primary)', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 4. MODAL: 1 v/s 1 Duel Matchmaking */}
      {activeModeModal === '1_vs_1' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: 24, border: '1px solid var(--border)', padding: 26, color: 'var(--text-primary)', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 19, fontWeight: 900 }}>⚔️ 1 v/s 1 Battle Arena</h3>

            {duelMatchState === 'matching' && (
              <div style={{ padding: '24px 0' }}>
                <div style={{ fontSize: 36, animation: 'chatterPulse 1s infinite' }}>🔍</div>
                <p style={{ margin: '12px 0 4px', fontSize: 15, fontWeight: 800 }}>
                  Searching for a Scholar Opponent...
                </p>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Matching with student of similar rank</span>
              </div>
            )}

            {(duelMatchState === 'ready' || duelMatchState === 'battling') && duelChallenger && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', margin: '20px 0' }}>
                  <div>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-color)', margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 900 }}>
                      {user?.name?.[0] || 'Y'}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{user?.name || 'You'}</div>
                    <div style={{ fontSize: 12, color: 'var(--primary-color)', fontWeight: 800 }}>{userDuelScore} pts</div>
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 900, color: '#ef4444' }}>VS</div>

                  <div>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#3b82f6', margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                      {duelChallenger.avatar}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{duelChallenger.name}</div>
                    <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 800 }}>{botDuelScore} pts</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-hover)', borderRadius: 14, padding: 14, marginBottom: 20 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Round {duelRound} of 3</span>
                  <p style={{ margin: '6px 0 14px', fontSize: 14, fontWeight: 700 }}>
                    Which data structure provides constant O(1) amortized insertion and lookup?
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handlePlayDuelRound(true)}
                      style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Hash Map
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlayDuelRound(false)}
                      style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Linked List
                    </button>
                  </div>
                </div>
              </div>
            )}

            {duelMatchState === 'finished' && (
              <div style={{ padding: '16px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>
                  {userDuelScore >= botDuelScore ? '🏆' : '🤝'}
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: userDuelScore >= botDuelScore ? '#10b981' : '#f59e0b' }}>
                  {userDuelScore >= botDuelScore ? 'Victory Achieved! (+30 Coins)' : 'Valiant Duel! Well Played'}
                </h4>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                  Final Score: <strong>{userDuelScore} pts</strong> vs <strong>{botDuelScore} pts</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setActiveModeModal(null)}
                  style={{ background: 'var(--primary-color)', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 14, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
                >
                  Return to Arena
                </button>
              </div>
            )}

            {duelMatchState !== 'finished' && (
              <button
                type="button"
                onClick={() => setActiveModeModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer', marginTop: 10 }}
              >
                Exit Duel
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL: Group Battle Room Code */}
      {activeModeModal === 'group_battle' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 460, background: 'var(--card)', borderRadius: 24, border: '1px solid var(--border)', padding: 26, color: 'var(--text-primary)', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 900 }}>🛡️ Group Battle Room</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Invite study peers with your 6-digit room pin to compete live!
            </p>

            <div style={{ background: 'var(--bg-hover)', borderRadius: 16, padding: '16px', marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary-color)', letterSpacing: '0.04em' }}>
                ROOM CODE PIN
              </span>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 6, margin: '6px 0', color: 'var(--text-primary)' }}>
                {roomCode || '582914'}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Waiting for players to join lobby...</span>
            </div>

            <div style={{ textAlign: 'left', marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                LOBBY SCHOLARS ({roomPlayers.length}/4):
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {roomPlayers.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'var(--bg-hover)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{p.avatar}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</span>
                    </div>
                    {p.isHost && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: 6 }}>
                        HOST
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActiveModeModal(null)}
                style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-primary)', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModeModal(null);
                  handleLaunchCategoryQuiz({ id: 'all', name: `Group Battle Room #${roomCode}` });
                }}
                style={{ background: 'var(--primary-color)', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(197, 100, 187, 0.4)' }}
              >
                Start Battle ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: Fun & Learn Comprehension */}
      {activeModeModal === 'fun_learn' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 580, maxHeight: '85vh', overflowY: 'auto', background: 'var(--card)', borderRadius: 24, border: '1px solid var(--border)', padding: 26, color: 'var(--text-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 900 }}>📖 Fun & Learn: Comprehension Drill</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Read the academic passage below thoroughly, then proceed to the comprehension challenge.
            </p>

            <div style={{ background: 'var(--bg-hover)', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 15.5, fontWeight: 800, color: 'var(--primary-color)' }}>
                {FUN_LEARN_STORIES[0].title}
              </h4>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                {FUN_LEARN_STORIES[0].passage}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setActiveModeModal(null)}
                style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-primary)', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModeModal(null);
                  setActiveQuizSession({
                    title: `Comprehension: ${FUN_LEARN_STORIES[0].title}`,
                    questions: FUN_LEARN_STORIES[0].questions,
                    isAiQuiz: false,
                  });
                  setIsQuizModalOpen(true);
                }}
                style={{ background: 'var(--primary-color)', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(197, 100, 187, 0.4)' }}
              >
                Proceed to Questions →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Multi Match Connector */}
      {activeModeModal === 'multi_match' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: 24, border: '1px solid var(--border)', padding: 26, color: 'var(--text-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>🔗 Multi Match: Hardware & Architecture</h3>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-color)' }}>
                Score: {matchScore} pts
              </span>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Tap an abbreviation in Column A, then tap its matching definition in Column B!
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>COLUMN A</span>
                {matchPairs.map((p) => (
                  <button
                    key={`left-${p.id}`}
                    type="button"
                    disabled={p.paired}
                    onClick={() => handleSelectPairItem('left', p)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: p.paired
                        ? '1px solid #10b981'
                        : selectedLeft?.id === p.id
                        ? '2px solid var(--primary-color)'
                        : '1px solid var(--border)',
                      background: p.paired ? 'rgba(16, 185, 129, 0.15)' : selectedLeft?.id === p.id ? 'rgba(197, 100, 187, 0.15)' : 'var(--bg-hover)',
                      color: p.paired ? '#10b981' : 'var(--text-primary)',
                      fontSize: 13.5,
                      fontWeight: 800,
                      cursor: p.paired ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {p.left} {p.paired ? '✓' : ''}
                  </button>
                ))}
              </div>

              {/* Right Column (shuffled) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>COLUMN B</span>
                {[...matchPairs].reverse().map((p) => (
                  <button
                    key={`right-${p.id}`}
                    type="button"
                    disabled={p.paired}
                    onClick={() => handleSelectPairItem('right', p)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: p.paired
                        ? '1px solid #10b981'
                        : selectedRight?.id === p.id
                        ? '2px solid var(--primary-color)'
                        : '1px solid var(--border)',
                      background: p.paired ? 'rgba(16, 185, 129, 0.15)' : selectedRight?.id === p.id ? 'rgba(197, 100, 187, 0.15)' : 'var(--bg-hover)',
                      color: p.paired ? '#10b981' : 'var(--text-primary)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: p.paired ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {p.right} {p.paired ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setActiveModeModal(null)}
                style={{ background: 'var(--primary-color)', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: Audio Questions Prompt */}
      {activeModeModal === 'audio_questions' && activeQuizSession && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 520, background: 'var(--card)', borderRadius: 24, border: '1px solid var(--border)', padding: 26, color: 'var(--text-primary)', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 900 }}>🎧 Voice Audio Drill</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
              Press the listen button below to hear the question spoken aloud via speech synthesis, then select your answer!
            </p>

            <div style={{ background: 'var(--bg-hover)', borderRadius: 18, padding: '24px', marginBottom: 24 }}>
              <button
                type="button"
                onClick={() => playSpeechText(activeQuizSession.questions[0]?.spokenText || activeQuizSession.questions[0]?.question)}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: isPlayingAudio ? '#10b981' : 'var(--primary-color)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 28,
                  cursor: 'pointer',
                  margin: '0 auto 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 20px rgba(197, 100, 187, 0.4)',
                  transition: 'transform 0.15s ease',
                }}
              >
                {isPlayingAudio ? '🔊' : '▶'}
              </button>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-color)' }}>
                {isPlayingAudio ? 'Speaking Question Aloud...' : 'Click to Play Audio Voice'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setActiveModeModal(null)}
                style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-primary)', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModeModal(null);
                  setIsQuizModalOpen(true);
                }}
                style={{ background: 'var(--primary-color)', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                Answer Now →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: Exam Module Simulator */}
      {activeModeModal === 'exam_module' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 540, background: 'var(--card)', borderRadius: 24, border: '1px solid var(--border)', padding: 26, color: 'var(--text-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>📝 Academic Exam Module</h3>
              <span style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', padding: '3px 10px', borderRadius: 10, fontSize: 11.5, fontWeight: 800 }}>
                FULL SIMULATION
              </span>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              This full examination simulation features section-based questions, question navigation palettes, and marked-for-review capabilities.
            </p>

            <div style={{ background: 'var(--bg-hover)', borderRadius: 16, padding: 16, marginBottom: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, fontWeight: 700 }}>EXAM DURATION</span>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>15 Minutes</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, fontWeight: 700 }}>TOTAL QUESTIONS</span>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>10 Questions</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, fontWeight: 700 }}>PASSING SCORE</span>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>70% Accuracy</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, fontWeight: 700 }}>REWARD</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#f59e0b' }}>+150 Coins & Badge</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setActiveModeModal(null)}
                style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-primary)', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModeModal(null);
                  handleLaunchCategoryQuiz({ id: 'all', name: 'Comprehensive Scholar Exam Simulator' });
                }}
                style={{ background: 'var(--primary-color)', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(197, 100, 187, 0.4)' }}
              >
                Begin Exam ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Quiz Gameplay Modal ── */}
      {isQuizModalOpen && activeQuizSession && (
        <QuizPlayModal
          isOpen={isQuizModalOpen}
          title={activeQuizSession.title}
          questions={activeQuizSession.questions}
          isAiQuiz={activeQuizSession.isAiQuiz}
          onClose={() => setIsQuizModalOpen(false)}
          onQuizCompleted={loadArenaData}
        />
      )}
    </div>
  );
}
