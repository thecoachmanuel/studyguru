'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Navigation tab: 'dashboard' | 'categories' | 'questions' | 'ai-generator' | 'users'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Data states
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    categories: 5,
    subcategories: 9,
    questions: 10,
    users: 24,
    contests: 3,
    badges: 5,
  });

  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & form states
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📚');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [subcatInputs, setSubcatInputs] = useState(['']);

  const [newQuesModalOpen, setNewQuesModalOpen] = useState(false);
  const [qText, setQText] = useState('');
  const [qCat, setQCat] = useState('cat-cs-ai');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qAns, setQAns] = useState(0);
  const [qExpl, setQExpl] = useState('');

  // AI Generator state
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiGeneratedResults, setAiGeneratedResults] = useState([]);
  const [savingAiQuestions, setSavingAiQuestions] = useState(false);

  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Load Admin Data
  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data?.stats) setStats(data.stats);
    } catch {}
  };

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      if (Array.isArray(data?.categories)) setCategories(data.categories);
    } catch {}
  };

  const loadQuestions = async (cat = 'all', q = '') => {
    try {
      const params = new URLSearchParams();
      if (cat !== 'all') params.set('category_id', cat);
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/questions?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data?.questions)) setQuestions(data.questions);
    } catch {}
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (Array.isArray(data?.users)) setUsers(data.users);
    } catch {}
  };

  useEffect(() => {
    Promise.all([loadStats(), loadCategories(), loadQuestions(), loadUsers()]).finally(() => {
      setLoading(false);
    });
  }, []);

  // Create Category
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const validSubcats = subcatInputs
        .filter((s) => s.trim())
        .map((s, i) => ({
          id: `sub-${Date.now()}-${i}`,
          name: s.trim(),
          slug: s.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        }));

      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName.trim(),
          image: newCatEmoji || '📚',
          description: newCatDesc.trim(),
          subcategories: validSubcats,
        }),
      });

      if (res.ok) {
        showToast('Category created successfully!');
        setNewCatModalOpen(false);
        setNewCatName('');
        setNewCatDesc('');
        setSubcatInputs(['']);
        loadCategories();
        loadStats();
      }
    } catch {
      showToast('Error creating category');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (catId) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await fetch(`/api/admin/categories?id=${catId}`, { method: 'DELETE' });
      showToast('Category deleted');
      loadCategories();
      loadStats();
    } catch {
      showToast('Error deleting category');
    }
  };

  // Create Question
  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!qText.trim() || !qOptA.trim() || !qOptB.trim()) {
      alert('Please fill in question text and at least 2 options.');
      return;
    }

    const options = [qOptA.trim(), qOptB.trim()];
    if (qOptC.trim()) options.push(qOptC.trim());
    if (qOptD.trim()) options.push(qOptD.trim());

    const chosenAnswer = options[qAns] || options[0];

    try {
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: qText.trim(),
          options,
          answer: chosenAnswer,
          explanation: qExpl.trim(),
          category_id: qCat,
          level: 1,
        }),
      });

      if (res.ok) {
        showToast('Question created successfully!');
        setNewQuesModalOpen(false);
        setQText('');
        setQOptA('');
        setQOptB('');
        setQOptC('');
        setQOptD('');
        setQExpl('');
        loadQuestions(selectedCategoryFilter, searchQuery);
        loadStats();
      }
    } catch {
      showToast('Error saving question');
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (qId) => {
    if (!confirm('Delete this question?')) return;
    try {
      await fetch(`/api/admin/questions?id=${qId}`, { method: 'DELETE' });
      showToast('Question removed');
      loadQuestions(selectedCategoryFilter, searchQuery);
      loadStats();
    } catch {
      showToast('Error removing question');
    }
  };

  // AI Question Generation
  const handleGenerateAiQuestions = async (e) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;

    setGeneratingAi(true);
    try {
      const res = await fetch('/api/quiz/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim(), count: aiCount }),
      });
      const data = await res.json();
      if (Array.isArray(data?.questions)) {
        setAiGeneratedResults(data.questions);
        showToast(`Generated ${data.questions.length} questions with Gemini!`);
      }
    } catch {
      showToast('Error generating AI questions');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSaveAllAiQuestions = async () => {
    if (aiGeneratedResults.length === 0) return;
    setSavingAiQuestions(true);

    try {
      for (const q of aiGeneratedResults) {
        await fetch('/api/admin/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q.question,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            category_id: 'cat-cs-ai',
            level: 1,
          }),
        });
      }
      showToast(`Saved all ${aiGeneratedResults.length} questions to Question Bank!`);
      setAiGeneratedResults([]);
      setAiTopic('');
      loadQuestions();
      loadStats();
      setActiveTab('questions');
    } catch {
      showToast('Error saving AI questions');
    } finally {
      setSavingAiQuestions(false);
    }
  };

  // Adjust User Coins
  const handleAdjustCoins = async (userId, newCoins) => {
    const val = prompt('Enter new coin balance for this scholar:', newCoins);
    if (val === null) return;
    const coinsNum = parseInt(val, 10);
    if (isNaN(coinsNum)) return;

    try {
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, coinsAdjustment: coinsNum }),
      });
      showToast('Coin balance updated');
      loadUsers();
    } catch {
      showToast('Error updating coins');
    }
  };

  return (
    <div className="admin-wrapper" style={{ display: 'flex', minHeight: '100vh', background: '#f4f6f9', fontFamily: 'Nunito, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Toast */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#333', color: '#fff', padding: '10px 18px', borderRadius: 8, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: 13, fontWeight: 600 }}>
          {toastMessage}
        </div>
      )}

      {/* ── Sidebar (Stisla Style) ── */}
      <aside
        style={{
          width: sidebarCollapsed ? 70 : 250,
          background: '#fff',
          boxShadow: '0 4px 8px rgba(0,0,0,0.03)',
          transition: 'width 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 800,
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f9f9f9', padding: '0 15px' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#333', letterSpacing: '-0.5px' }}>
              Study<span style={{ color: '#f05387' }}>Cord</span>
            </span>
            <span style={{ background: '#f05387', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6, textTransform: 'uppercase' }}>Admin</span>
          </Link>
        </div>

        {/* Menu Items */}
        <nav style={{ padding: '15px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#98a6ad', textTransform: 'uppercase', padding: '10px 12px 4px', letterSpacing: '0.5px' }}>
            Core Dashboard
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'dashboard' ? 'rgba(240, 83, 135, 0.1)' : 'transparent',
              color: activeTab === 'dashboard' ? '#f05387' : '#6c757d',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📊</span>
            {!sidebarCollapsed && <span>Dashboard Overview</span>}
          </button>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#98a6ad', textTransform: 'uppercase', padding: '14px 12px 4px', letterSpacing: '0.5px' }}>
            Elite Quiz Engine
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'categories' ? 'rgba(240, 83, 135, 0.1)' : 'transparent',
              color: activeTab === 'categories' ? '#f05387' : '#6c757d',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🗂️</span>
            {!sidebarCollapsed && <span>Categories & Subs</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'questions' ? 'rgba(240, 83, 135, 0.1)' : 'transparent',
              color: activeTab === 'questions' ? '#f05387' : '#6c757d',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <span>❓</span>
            {!sidebarCollapsed && <span>Question Bank</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai-generator')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'ai-generator' ? 'rgba(240, 83, 135, 0.1)' : 'transparent',
              color: activeTab === 'ai-generator' ? '#f05387' : '#6c757d',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <span>✨</span>
            {!sidebarCollapsed && <span>AI Question Generator</span>}
          </button>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#98a6ad', textTransform: 'uppercase', padding: '14px 12px 4px', letterSpacing: '0.5px' }}>
            Community
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'users' ? 'rgba(240, 83, 135, 0.1)' : 'transparent',
              color: activeTab === 'users' ? '#f05387' : '#6c757d',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <span>👥</span>
            {!sidebarCollapsed && <span>Scholars & Coins</span>}
          </button>

          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <Link
              href="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#eef2f5',
                color: '#495057',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <span>←</span>
              {!sidebarCollapsed && <span>Back to Student App</span>}
            </Link>
          </div>
        </nav>
      </aside>

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
        {/* Top Navbar */}
        <header
          style={{
            height: 70,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 25px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            position: 'sticky',
            top: 0,
            zIndex: 700,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((p) => !p)}
              style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6c757d' }}
              title="Toggle Sidebar"
            >
              ☰
            </button>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#34395e' }}>
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'categories' && 'Quiz Categories & Subcategories'}
              {activeTab === 'questions' && 'Question Bank Management'}
              {activeTab === 'ai-generator' && 'AI-Powered Question Synthesizer (Gemini)'}
              {activeTab === 'users' && 'Registered Scholars & Coin Balances'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#28a745', background: 'rgba(40, 167, 69, 0.1)', padding: '4px 10px', borderRadius: 20 }}>
              ● Live MongoDB Engine
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f05387', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                A
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Admin Panel</span>
            </div>
          </div>
        </header>

        {/* Tab Body */}
        <main style={{ padding: '25px', flex: 1 }}>
          {/* ════ TAB 1: DASHBOARD OVERVIEW ════ */}
          {activeTab === 'dashboard' && (
            <div>
              {/* 6 Stisla Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 20, marginBottom: 25 }}>
                {/* Categories */}
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 4px 8px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 10, background: '#6777ef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, boxShadow: '0 4px 10px rgba(103,119,239,0.3)' }}>
                    🗂️
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#98a6ad', textTransform: 'uppercase' }}>Categories</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#34395e' }}>{stats.categories}</div>
                  </div>
                </div>

                {/* Subcategories */}
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 4px 8px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 10, background: '#fc544b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, boxShadow: '0 4px 10px rgba(252,84,75,0.3)' }}>
                    📂
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#98a6ad', textTransform: 'uppercase' }}>Subcategories</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#34395e' }}>{stats.subcategories}</div>
                  </div>
                </div>

                {/* Questions */}
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 4px 8px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 10, background: '#ffa426', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, boxShadow: '0 4px 10px rgba(255,164,38,0.3)' }}>
                    ❓
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#98a6ad', textTransform: 'uppercase' }}>Questions</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#34395e' }}>{stats.questions}</div>
                  </div>
                </div>

                {/* Students */}
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 4px 8px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 10, background: '#47c363', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, boxShadow: '0 4px 10px rgba(71,195,99,0.3)' }}>
                    👥
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#98a6ad', textTransform: 'uppercase' }}>Scholars</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#34395e' }}>{stats.users}</div>
                  </div>
                </div>

                {/* Contests */}
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 4px 8px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 10, background: '#3abaf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, boxShadow: '0 4px 10px rgba(58,186,244,0.3)' }}>
                    🏆
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#98a6ad', textTransform: 'uppercase' }}>Contests</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#34395e' }}>{stats.contests}</div>
                  </div>
                </div>

                {/* Badges */}
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 4px 8px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 10, background: '#c564bb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, boxShadow: '0 4px 10px rgba(197,100,187,0.3)' }}>
                    🎖️
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#98a6ad', textTransform: 'uppercase' }}>Badges</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#34395e' }}>{stats.badges}</div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Row */}
              <div style={{ background: '#fff', borderRadius: 10, padding: 25, boxShadow: '0 4px 8px rgba(0,0,0,0.03)', marginBottom: 25 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#34395e' }}>⚡ Quick Management Actions</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setNewCatModalOpen(true)}
                    style={{ background: '#6777ef', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    + Create Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewQuesModalOpen(true)}
                    style={{ background: '#ffa426', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    + Add New Question
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai-generator')}
                    style={{ background: 'linear-gradient(135deg, #f05387 0%, #c564bb 100%)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    ✨ Synthesize Questions with Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    style={{ background: '#47c363', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    👥 Manage Scholars & Coins
                  </button>
                </div>
              </div>

              {/* Recent Questions Preview */}
              <div style={{ background: '#fff', borderRadius: 10, padding: 25, boxShadow: '0 4px 8px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#34395e' }}>Recent Questions in Bank</h3>
                  <button type="button" onClick={() => setActiveTab('questions')} style={{ background: 'none', border: 'none', color: '#6777ef', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    View All ({questions.length}) →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {questions.slice(0, 4).map((q, i) => (
                    <div key={q.id || i} style={{ padding: '12px 16px', background: '#fbfbfb', borderRadius: 8, border: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                        {q.question}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(103,119,239,0.1)', color: '#6777ef', padding: '3px 8px', borderRadius: 4 }}>
                        Answer: {q.answer}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════ TAB 2: CATEGORIES ════ */}
          {activeTab === 'categories' && (
            <div style={{ background: '#fff', borderRadius: 10, padding: 25, boxShadow: '0 4px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#34395e' }}>All Quiz Categories</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Configure subjects, icons, and subcategories for the student Quiz Zone</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewCatModalOpen(true)}
                  style={{ background: '#f05387', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                >
                  + Add Category
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {categories.map((cat) => (
                  <div key={cat.id || cat._id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 18, background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 28 }}>{cat.image || '📚'}</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#333' }}>{cat.name}</h4>
                        <span style={{ fontSize: 11, color: '#999' }}>{cat.slug}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: '#666', minHeight: 36, margin: '0 0 12px' }}>{cat.description || 'No description'}</p>

                    <div style={{ borderTop: '1px solid #f5f5f5', paddingTop: 10, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>Subcategories:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {Array.isArray(cat.subcategories) && cat.subcategories.length > 0 ? (
                          cat.subcategories.map((s, idx) => (
                            <span key={idx} style={{ background: '#f0f2f5', color: '#555', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                              {s.name}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: 11, color: '#bbb' }}>None added</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id || cat._id)}
                        style={{ background: '#fff', color: '#fc544b', border: '1px solid #ffccd2', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════ TAB 3: QUESTIONS BANK ════ */}
          {activeTab === 'questions' && (
            <div style={{ background: '#fff', borderRadius: 10, padding: 25, boxShadow: '0 4px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#34395e' }}>Question Bank Repository</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Total {questions.length} questions available for student drills and quiz battles</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setNewQuesModalOpen(true)}
                    style={{ background: '#f05387', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    + Add Question
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => {
                    setSelectedCategoryFilter(e.target.value);
                    loadQuestions(e.target.value, searchQuery);
                  }}
                  style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, background: '#fff' }}
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Search questions by keyword..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    loadQuestions(selectedCategoryFilter, e.target.value);
                  }}
                  style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, flex: 1, minWidth: 200 }}
                />
              </div>

              {/* Questions Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef', color: '#495057' }}>
                      <th style={{ padding: '12px 14px' }}>#</th>
                      <th style={{ padding: '12px 14px' }}>Question</th>
                      <th style={{ padding: '12px 14px' }}>Correct Answer</th>
                      <th style={{ padding: '12px 14px' }}>Options Count</th>
                      <th style={{ padding: '12px 14px' }}>Level</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q, idx) => (
                      <tr key={q.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 14px', color: '#888' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#333', maxWidth: 350 }}>
                          {q.question}
                          {q.explanation && (
                            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>💡 {q.explanation}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: 'rgba(71,195,99,0.15)', color: '#28a745', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                            {q.answer}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#666' }}>{q.options?.length || 4} options</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#eef2f5', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                            Lvl {q.level || 1}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            style={{ background: 'none', border: '1px solid #ffccd2', color: '#fc544b', padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════ TAB 4: AI QUESTION GENERATOR ════ */}
          {activeTab === 'ai-generator' && (
            <div style={{ background: '#fff', borderRadius: 10, padding: 25, boxShadow: '0 4px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#34395e' }}>✨ Gemini AI Question Synthesizer</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
                  Auto-generate university-grade multiple choice questions with realistic options and educational explanations using Google Gemini.
                </p>
              </div>

              <form onSubmit={handleGenerateAiQuestions} style={{ background: '#fbfcfd', padding: 20, borderRadius: 10, border: '1px solid #e9ecef', marginBottom: 25 }}>
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#495057', marginBottom: 6 }}>
                    Topic or Lecture Chapter:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Distributed Consensus (Raft & Paxos), CRISPR-Cas9 Gene Editing, Quantum Entanglement"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #ced4da', fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 15 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#495057', marginBottom: 6 }}>
                      Number of Questions:
                    </label>
                    <select
                      value={aiCount}
                      onChange={(e) => setAiCount(parseInt(e.target.value, 10))}
                      style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #ced4da', fontSize: 13, background: '#fff' }}
                    >
                      <option value={3}>3 Questions</option>
                      <option value={5}>5 Questions (Recommended)</option>
                      <option value={10}>10 Questions</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={generatingAi}
                    style={{
                      alignSelf: 'flex-end',
                      background: generatingAi ? '#aaa' : 'linear-gradient(135deg, #f05387 0%, #c564bb 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 22px',
                      borderRadius: 6,
                      fontWeight: 700,
                      cursor: generatingAi ? 'wait' : 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {generatingAi ? 'Synthesizing with Gemini...' : '⚡ Generate Questions'}
                  </button>
                </div>
              </form>

              {/* Results Preview */}
              {aiGeneratedResults.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#333' }}>
                      Generated Preview ({aiGeneratedResults.length} questions ready to commit)
                    </h4>
                    <button
                      type="button"
                      disabled={savingAiQuestions}
                      onClick={handleSaveAllAiQuestions}
                      style={{
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {savingAiQuestions ? 'Committing...' : '💾 Commit All to Question Bank'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {aiGeneratedResults.map((q, idx) => (
                      <div key={idx} style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 8 }}>
                          {idx + 1}. {q.question}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 8 }}>
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                background: opt === q.answer ? 'rgba(40, 167, 69, 0.12)' : '#f8f9fa',
                                border: opt === q.answer ? '1px solid #28a745' : '1px solid #eee',
                                fontSize: 12,
                                fontWeight: opt === q.answer ? 700 : 500,
                                color: opt === q.answer ? '#28a745' : '#495057',
                              }}
                            >
                              {String.fromCharCode(65 + optIdx)}. {opt} {opt === q.answer && '✓'}
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: '#6c757d' }}>
                          <strong>Explanation:</strong> {q.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ TAB 5: SCHOLARS & COINS ════ */}
          {activeTab === 'users' && (
            <div style={{ background: '#fff', borderRadius: 10, padding: 25, boxShadow: '0 4px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#34395e' }}>Registered Scholars Directory</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Manage student quiz coins, roles, and review individual performance</p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef', color: '#495057' }}>
                      <th style={{ padding: '12px 14px' }}>Scholar Name</th>
                      <th style={{ padding: '12px 14px' }}>Email</th>
                      <th style={{ padding: '12px 14px' }}>Role</th>
                      <th style={{ padding: '12px 14px' }}>Coins 🪙</th>
                      <th style={{ padding: '12px 14px' }}>Score</th>
                      <th style={{ padding: '12px 14px' }}>Accuracy</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#333' }}>{u.name}</td>
                        <td style={{ padding: '12px 14px', color: '#666' }}>{u.email}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: u.role === 'admin' ? 'rgba(240,83,135,0.1)' : '#eef2f5', color: u.role === 'admin' ? '#f05387' : '#555', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: '#f59e0b' }}>{u.coins}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700 }}>{u.score}</td>
                        <td style={{ padding: '12px 14px' }}>{u.accuracy}%</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleAdjustCoins(u.id, u.coins)}
                            style={{ background: '#fff', border: '1px solid #ddd', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#555' }}
                          >
                            🪙 Adjust Coins
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL: Create Category ── */}
      {newCatModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 450, padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>Add New Category</h3>
            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Emoji Icon:</label>
                <input
                  type="text"
                  value={newCatEmoji}
                  onChange={(e) => setNewCatEmoji(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Category Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cognitive Psychology"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Description:</label>
                <textarea
                  rows={2}
                  placeholder="Brief overview of covered topics..."
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Subcategories (optional):</label>
                {subcatInputs.map((val, idx) => (
                  <input
                    key={idx}
                    type="text"
                    placeholder={`Subcategory ${idx + 1}`}
                    value={val}
                    onChange={(e) => {
                      const updated = [...subcatInputs];
                      updated[idx] = e.target.value;
                      setSubcatInputs(updated);
                    }}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, marginBottom: 6 }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setSubcatInputs((p) => [...p, ''])}
                  style={{ background: 'none', border: 'none', color: '#6777ef', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  + Add another subcategory
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setNewCatModalOpen(false)}
                  style={{ background: '#eee', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#f05387', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Create Question ── */}
      {newQuesModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>Add New Question</h3>
            <form onSubmit={handleCreateQuestion}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Category:</label>
                <select
                  value={qCat}
                  onChange={(e) => setQCat(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, background: '#fff' }}
                >
                  {categories.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Question Text:</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Enter the quiz question..."
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Options:</label>
                <input type="text" required placeholder="Option A" value={qOptA} onChange={(e) => setQOptA(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, marginBottom: 6 }} />
                <input type="text" required placeholder="Option B" value={qOptB} onChange={(e) => setQOptB(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, marginBottom: 6 }} />
                <input type="text" placeholder="Option C (optional)" value={qOptC} onChange={(e) => setQOptC(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, marginBottom: 6 }} />
                <input type="text" placeholder="Option D (optional)" value={qOptD} onChange={(e) => setQOptD(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, marginBottom: 6 }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Correct Answer Option:</label>
                <select
                  value={qAns}
                  onChange={(e) => setQAns(parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, background: '#fff' }}
                >
                  <option value={0}>Option A</option>
                  <option value={1}>Option B</option>
                  <option value={2}>Option C</option>
                  <option value={3}>Option D</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Explanation (shown during review):</label>
                <textarea
                  rows={2}
                  placeholder="Why is this answer correct?"
                  value={qExpl}
                  onChange={(e) => setQExpl(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setNewQuesModalOpen(false)}
                  style={{ background: '#eee', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#f05387', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
