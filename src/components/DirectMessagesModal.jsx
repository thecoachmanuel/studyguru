'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { getPusherClient } from '@/lib/pusherClient';

export default function DirectMessagesModal({ currentUserId, onClose, initialRecipientId = null }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [newRecipientId, setNewRecipientId] = useState(initialRecipientId || '');
  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [vvHeight, setVvHeight] = useState(null);
  const messagesEndRef = useRef(null);

  // Mobile virtual keyboard handling: dynamic visualViewport resizing prevents keypad from overlapping compose bar
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleVV = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        setVvHeight(window.visualViewport.height);
      }
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVV);
      window.visualViewport.addEventListener('scroll', handleVV);
      handleVV();
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.visualViewport?.removeEventListener('resize', handleVV);
      window.visualViewport?.removeEventListener('scroll', handleVV);
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/conversations');
      if (Array.isArray(data)) {
        setConversations(data);
        if (data.length > 0 && !activeConv && !initialRecipientId && typeof window !== 'undefined' && window.innerWidth > 768) {
          setActiveConv(data[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [activeConv, initialRecipientId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // If initialRecipientId provided, open/start conversation
  useEffect(() => {
    if (initialRecipientId) {
      (async () => {
        try {
          const res = await apiRequest('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: initialRecipientId }),
          });
          if (res?.id) {
            setActiveConv(res);
            setConversations((prev) => {
              if (prev.some((c) => c.id === res.id)) return prev;
              return [res, ...prev];
            });
          }
        } catch (e) {
          console.warn('Could not auto-start DM:', e);
        }
      })();
    }
  }, [initialRecipientId]);

  // Fetch messages when activeConv changes
  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return;
    setMessagesLoading(true);
    try {
      const data = await apiRequest(`/api/conversations/${convId}/messages`);
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.warn('Failed to fetch DM messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeConv?.id) {
      fetchMessages(activeConv.id);
    } else {
      setMessages([]);
    }
  }, [activeConv?.id, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime Pusher subscription for active conversation
  useEffect(() => {
    if (!activeConv?.id) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `conversation-${activeConv.id}`;
    let chan = null;
    try {
      chan = pusher.subscribe(channelName);
      chan.bind('new-message', (newMsg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      });
    } catch {}

    return () => {
      try {
        chan?.unbind('new-message');
      } catch {}
    };
  }, [activeConv?.id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConv?.id || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await apiRequest(`/api/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (res?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.id)) return prev;
          return [...prev, res];
        });
      }
    } catch (err) {
      console.warn('Failed to send DM:', err);
    } finally {
      setSending(false);
    }
  };

  const handleStartNewChat = async (e) => {
    e.preventDefault();
    if (!newRecipientId.trim()) return;

    setStartingChat(true);
    setChatError('');
    try {
      const res = await apiRequest('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: newRecipientId.trim() }),
      });
      if (res?.id) {
        setActiveConv(res);
        setConversations((prev) => {
          if (prev.some((c) => c.id === res.id)) return prev;
          return [res, ...prev];
        });
        setNewRecipientId('');
      }
    } catch (err) {
      setChatError(err.message || 'Could not find study partner');
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 250 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : '90%',
          maxWidth: isMobile ? '100%' : '800px',
          height: isMobile ? (vvHeight ? `${vvHeight}px` : '100dvh') : '75vh',
          maxHeight: isMobile ? (vvHeight ? `${vvHeight}px` : '100dvh') : '650px',
          borderRadius: isMobile ? 0 : '18px',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
        }}
      >
        {/* Left Side: Conversation List */}
        <div
          style={{
            width: isMobile ? '100%' : '260px',
            borderRight: isMobile ? 'none' : '1px solid var(--border)',
            background: 'var(--bg-panel1)',
            display: isMobile ? (activeConv ? 'none' : 'flex') : 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          <div className="dm-sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Direct Messages</h3>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
              </span>
            </div>
            {isMobile && (
              <button
                type="button"
                className="settings-mini-btn"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {loading && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', margin: '20px 0' }}>
                Loading chats…
              </p>
            )}
            {!loading && conversations.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', padding: '16px', margin: 0 }}>
                No direct messages yet. Coordinate private study sessions with group members!
              </p>
            )}
            {!loading &&
              conversations.map((c) => {
                const partner = c.other_user || {};
                const isActive = activeConv?.id === c.id;
                const initials = (partner.username || partner.name || '?')[0].toUpperCase();
                const statusState = partner.status?.state || 'offline';

                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`dm-convo-item ${isActive ? 'dm-convo-item--active' : ''}`}
                    onClick={() => setActiveConv(c)}
                  >
                    <div className="dm-avatar-wrap">
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '14px',
                        }}
                      >
                        {initials}
                      </div>
                      <span
                        className={`dm-status-indicator user-status-dot--${statusState}`}
                      />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {partner.username || partner.name || 'Study Partner'}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.last_message?.content || 'No messages yet'}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Right Side: Message Chat Area */}
        <div
          style={{
            flex: 1,
            display: isMobile ? (activeConv ? 'flex' : 'none') : 'flex',
            flexDirection: 'column',
            background: 'var(--bg-surface)',
            height: '100%',
          }}
        >
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div
                style={{
                  height: '52px',
                  borderBottom: '1px solid var(--border)',
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => setActiveConv(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        fontSize: '14.5px',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        marginRight: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      ← Back
                    </button>
                  )}
                  <span style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    @{activeConv.other_user?.username || activeConv.other_user?.name || 'Study Partner'}
                  </span>
                  <span className="user-status-tag" style={{ fontSize: '12.5px' }}>
                    {activeConv.other_user?.status?.emoji || '🟢'} {activeConv.other_user?.status?.state || 'Online'}
                  </span>
                </div>
                <button
                  type="button"
                  className="settings-mini-btn"
                  onClick={onClose}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Chat Message Stream */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messagesLoading && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                    Loading messages…
                  </p>
                )}
                {!messagesLoading && messages.length === 0 && (
                  <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>💬</div>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Start your conversation</p>
                    <p style={{ margin: 0, fontSize: '13.5px' }}>Send a message to coordinate your study plans.</p>
                  </div>
                )}
                {!messagesLoading &&
                  messages.map((m) => {
                    const isOwn = String(m.user_id) === String(currentUserId);
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isOwn ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                        }}
                      >
                        <div
                          style={{
                            padding: '8px 14px',
                            borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: isOwn ? 'var(--primary)' : 'var(--bg-elevated)',
                            color: isOwn ? '#fff' : 'var(--text-primary)',
                            fontSize: '16px',
                            lineHeight: 1.45,
                            border: isOwn ? 'none' : '1px solid var(--border)',
                            boxShadow: isOwn ? '0 2px 6px rgba(29, 78, 216, 0.2)' : 'none',
                          }}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Compose Box */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: isMobile ? '10px 14px calc(10px + env(safe-area-inset-bottom, 0px)) 14px' : '12px 16px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  gap: '8px',
                  flexShrink: 0,
                  background: 'var(--bg-panel1)',
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  placeholder="Message study partner…"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={(e) => {
                    if (isMobile) {
                      setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
                    }
                  }}
                  disabled={sending}
                  style={{ flex: 1, fontSize: '16px' }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending || !inputText.trim()}
                  style={{ width: 'auto', padding: '0 16px', flexShrink: 0 }}
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div style={{ textAlign: 'center', maxWidth: '300px' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>✉️</div>
                <h4 style={{ margin: '0 0 6px', fontSize: '18px' }}>Direct Messages</h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                  Select an existing conversation on the left or reach out directly to any classmate.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
