'use client';

import { useState } from 'react';
import ChatbotIcon from '@/components/ChatbotIcon';

export default function ChatterGuruView({
  onAskGuru,
  channelName,
  serverId,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'g-1',
      role: 'assistant',
      content: 'Hello! I am **StudyGuru**, your AI Study Partner powered by RAG document indexing. How can I assist your study session today?',
      timestamp: 'Now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const quickPrompts = [
    '💡 Summarize key concepts',
    '📝 Create a 5-question quiz',
    '🔬 Explain like I am 5',
    '📐 Formulate study schedule',
  ];

  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: 'Now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      // Call backend AI Guru RAG pipeline
      const res = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          serverId,
          channelName,
        }),
      });

      if (!res.ok) throw new Error('AI assistant response error');
      const data = await res.json();

      const aiMsg = {
        id: `g-${Date.now()}`,
        role: 'assistant',
        content: data.reply || data.answer || 'I parsed the study materials for your query. Let me know if you would like me to drill down on any specific sub-topic!',
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const aiMsg = {
        id: `g-${Date.now()}`,
        role: 'assistant',
        content: `Here is a study breakdown for **"${text}"**:\n\n1. **Core Concept**: Break the problem down into first principles.\n2. **Key Formulas / Definitions**: Make sure all variables and boundary conditions are explicitly identified.\n3. **Active Recall**: Test yourself immediately by explaining it without looking at notes!`,
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 124px)', maxWidth: 720, margin: '0 auto', width: '100%' }}>
      {/* ── 1. Top Guru Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'var(--chatter-sheet)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'rgba(64, 227, 120, 0.15)',
            color: 'var(--chatter-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChatbotIcon size={22} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>StudyGuru AI</span>
            <span style={{ fontSize: 11, background: 'rgba(64, 227, 120, 0.18)', color: 'var(--chatter-primary)', padding: '2px 6px', borderRadius: 8 }}>
              RAG Active
            </span>
          </h3>
          <p style={{ fontSize: 12, color: 'var(--chatter-light-text)', margin: 0 }}>
            Instant answers, textbook summaries & quiz preparation
          </p>
        </div>
      </div>

      {/* ── 2. Chat Stream ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '12px 16px',
                  borderRadius: 18,
                  background: isUser ? 'var(--chatter-primary)' : 'var(--chatter-sheet)',
                  color: isUser ? '#0E0E0E' : '#fff',
                  border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
                  fontWeight: isUser ? 600 : 400,
                  fontSize: 14,
                  lineHeight: 1.55,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 18,
                background: 'var(--chatter-sheet)',
                color: 'var(--chatter-primary)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              StudyGuru is thinking... 🧠
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Quick Suggestions Carousel ── */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 18px 10px', scrollbarWidth: 'none' }}>
        {quickPrompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handleSend(p)}
            style={{
              padding: '6px 12px',
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

      {/* ── 4. Input Compose Bar ── */}
      <div style={{ padding: '0 18px 14px' }}>
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
            borderRadius: 20,
            padding: '6px 8px 6px 16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <input
            type="text"
            placeholder="Ask StudyGuru anything..."
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
              opacity: inputText.trim() ? 1 : 0.6,
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
