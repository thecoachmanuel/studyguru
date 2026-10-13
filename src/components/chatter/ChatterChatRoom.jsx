'use client';

import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { getPusherClient } from '@/lib/pusherClient';
import { TwitterVerifiedBadge } from './ChatterFeedView';

const STUDY_EMOJIS = ['👍', '💡', '❓', '🔥', '✅'];

function normalizeMessage(m, currentUserId) {
  if (!m) return null;
  const rawSenderId = m.sender_id || m.user_id || m.profiles?.id || m.author_id || (m.profiles?._id ? String(m.profiles._id) : '');
  const senderId = rawSenderId ? String(rawSenderId) : '';
  const senderName = m.sender_name || m.profiles?.name || m.profiles?.username || m.author || (senderId === String(currentUserId) ? 'You' : 'Scholar');
  const senderAvatar = m.sender_avatar || m.profiles?.avatar_url || m.profiles?.image || null;
  const attachmentUrl = m.attachment_url || m.attachments?.[0]?.file_url || m.attachments?.[0]?.url || m.attachment?.file_url || null;
  const createdAt = m.createdAt || m.created_at || new Date().toISOString();

  return {
    id: String(m.id || m._id || `msg-${Date.now()}`),
    sender_id: senderId,
    sender_name: senderName,
    sender_avatar: senderAvatar,
    content: m.content || '',
    attachment_url: attachmentUrl,
    createdAt: createdAt,
    reactions: m.reactions || [],
    is_read: Boolean(m.is_read || m.read_at || m.read),
  };
}

export default function ChatterChatRoom({
  channelId,
  channelName,
  channelType = 'text',
  serverId,
  serverName,
  userId,
  profile,
  isPartnerOnline = true,
  onBack,
  onStartAudioCall,
  onStartVideoCall,
  onStartDM,
  onLeaveRoom,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  const [reactionMenuMessageId, setReactionMenuMessageId] = useState(null);
  const [dmRequestStatus, setDmRequestStatus] = useState('accepted'); // 'pending' | 'accepted' | 'declined'
  const [requestedBy, setRequestedBy] = useState(null);
  const [requestActionLoading, setRequestActionLoading] = useState(false);
  const [membersDrawerOpen, setMembersDrawerOpen] = useState(false);
  const [roomMembers, setRoomMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  // Track IDs of messages we sent ourselves so we can ignore their Pusher echo
  const sentMessageIdsRef = useRef(new Set());
  const sendingRef = useRef(false);

  // Fetch room members when inside a server/room
  useEffect(() => {
    if (!serverId || channelType === 'dm') return;
    let mounted = true;
    setLoadingMembers(true);
    fetch(`/api/servers/${encodeURIComponent(serverId)}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (mounted && Array.isArray(data)) {
          setRoomMembers(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingMembers(false);
      });
    return () => {
      mounted = false;
    };
  }, [serverId, channelType]);

  const handleExitRoom = async () => {
    if (!serverId || leavingRoom) return;
    setLeavingRoom(true);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(serverId)}/leave`, {
        method: 'POST',
      });
      if (res.ok) {
        setConfirmLeaveOpen(false);
        onLeaveRoom?.(serverId);
      }
    } catch (err) {
      console.warn('Failed to leave room:', err);
    } finally {
      setLeavingRoom(false);
    }
  };

  // Fetch messages from channel or conversation
  useEffect(() => {
    if (!channelId) return;

    let mounted = true;
    setLoading(true);

    const isDM = channelType === 'dm';
    const primaryEndpoint = isDM ? `/api/conversations/${channelId}/messages` : `/api/channels/${channelId}/messages`;
    const fallbackEndpoint = isDM ? `/api/channels/${channelId}/messages` : null;

    const loadMessages = async () => {
      try {
        let data = null;
        try {
          data = await apiRequest(primaryEndpoint);
        } catch (e1) {
          if (fallbackEndpoint) {
            data = await apiRequest(fallbackEndpoint);
          } else {
            throw e1;
          }
        }
        if (mounted && Array.isArray(data)) {
          setMessages(data.map((m) => normalizeMessage(m, userId)).filter(Boolean));
        }
      } catch (err) {
        console.warn('Failed to load channel messages:', err);
        // Fallback default message thread
        if (mounted) {
          setMessages([
            {
              id: 'm1',
              sender_id: 'u-peer',
              sender_name: isDM ? (channelName || 'Study Partner') : 'David Kim',
              sender_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
              content: isDM
                ? `Hey! Let's collaborate and review the recent lecture notes.`
                : 'Hey everyone! Has anyone reviewed the problems from Chapter 3 yet?',
              createdAt: new Date(Date.now() - 3600000).toISOString(),
              reactions: [{ emoji: '👍', count: 2, users: [] }],
            },
          ]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadMessages();

    // If DM, fetch conversation request status
    if (isDM) {
      fetch(`/api/conversations/${channelId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((conv) => {
          if (conv && mounted) {
            setDmRequestStatus(conv.status || 'accepted');
            setRequestedBy(conv.requested_by || null);
          }
        })
        .catch(() => {});
    }

    // Pusher real-time listener for incoming messages
    let channel = null;
    try {
      const pusher = getPusherClient();
      if (pusher) {
        const pusherChannelName = isDM ? `conversation-${channelId}` : `channel-${channelId}`;
        channel = pusher.subscribe(pusherChannelName);

        const handleIncoming = (rawMsg) => {
          if (!mounted || !rawMsg) return;
          const newMsg = normalizeMessage(rawMsg, userId);
          if (!newMsg) return;

          setMessages((prev) => {
            // 1. Exact ID already exists
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            // 2. Already tracked as sent by this client
            if (sentMessageIdsRef.current.has(newMsg.id)) return prev;

            // 3. If from current user, swap the pending optimistic temp message in place
            const isFromCurrent = String(newMsg.sender_id) === String(userId);
            if (isFromCurrent) {
              const tempIndex = prev.findIndex(
                (m) =>
                  m.id.startsWith('temp-') &&
                  m.content === newMsg.content &&
                  (String(m.sender_id) === String(newMsg.sender_id) || String(m.sender_id) === String(userId))
              );
              if (tempIndex !== -1) {
                sentMessageIdsRef.current.add(newMsg.id);
                const next = [...prev];
                next[tempIndex] = newMsg;
                return next;
              }
            }

            // 4. Otherwise append peer message
            return [...prev, newMsg];
          });
        };

        channel.bind('new-message', handleIncoming);

        channel.bind('messages-read', () => {
          if (mounted) {
            setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
          }
        });

        channel.bind('request-status', (data) => {
          if (mounted && data?.status) {
            setDmRequestStatus(data.status);
          }
        });

        channel.bind('message-reacted', (data) => {
          if (mounted && data?.messageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.messageId ? { ...m, reactions: data.reactions } : m
              )
            );
          }
        });
      }
    } catch {}

    return () => {
      mounted = false;
      if (channel) {
        try {
          channel.unbind_all();
        } catch {}
      }
    };
  }, [channelId, channelType, channelName, userId, profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRespondRequest = async (action) => {
    setRequestActionLoading(true);
    try {
      const res = await fetch(`/api/conversations/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setDmRequestStatus(action === 'accept' ? 'accepted' : 'declined');
        if (action === 'decline') {
          onBack?.();
        }
      }
    } catch (e) {
      console.warn('Request respond notice:', e);
    } finally {
      setRequestActionLoading(false);
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !attachedImage) || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    const content = inputText.trim();
    const capturedImage = attachedImage;
    const tempId = `temp-${Date.now()}`;

    const optimisticMsg = {
      id: tempId,
      sender_id: String(userId || ''),
      sender_name: profile?.name || profile?.username || 'You',
      sender_avatar: profile?.avatar_url || null,
      content,
      attachment_url: capturedImage,
      createdAt: new Date().toISOString(),
      reactions: [],
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setAttachedImage(null);

    const isDM = channelType === 'dm';
    const endpoint = isDM
      ? `/api/conversations/${channelId}/messages`
      : `/api/channels/${channelId}/messages`;

    try {
      const sentMsg = await apiRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          attachment_url: capturedImage,
        }),
      });

      if (sentMsg) {
        const normalized = normalizeMessage(sentMsg, userId);
        sentMessageIdsRef.current.add(normalized.id);
        setTimeout(() => sentMessageIdsRef.current.delete(normalized.id), 10000);

        setMessages((prev) => {
          if (prev.some((m) => m.id === normalized.id)) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) => (m.id === tempId ? normalized : m));
        });
      }
    } catch (err) {
      console.warn('Message send error:', err?.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // Toggle reaction
  const handleToggleReaction = async (messageId, emoji) => {
    setReactionMenuMessageId(null);
    try {
      // Local optimistic update
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          const currentReactions = msg.reactions || [];
          const existing = currentReactions.find((r) => r.emoji === emoji);
          let updatedReactions;
          if (existing) {
            updatedReactions = currentReactions.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1 } : r
            );
          } else {
            updatedReactions = [...currentReactions, { emoji, count: 1 }];
          }
          return { ...msg, reactions: updatedReactions };
        })
      );

      await apiRequest(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
    } catch (err) {
      console.warn('Reaction toggle notice:', err?.message);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--chatter-black)',
        color: '#fff',
      }}
    >
      {/* ── 1. Chatter Chat Header ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'var(--chatter-sheet)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--chatter-primary)',
                padding: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: '#242424',
                color: channelType === 'voice' ? 'var(--chatter-primary)' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {channelType === 'voice' ? '🎙️' : channelType === 'dm' ? (channelName?.[0]?.toUpperCase() || 'U') : '#'}
            </div>
            {channelType === 'dm' && (
              isPartnerOnline ? (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--chatter-primary)',
                    border: '2px solid var(--chatter-sheet)',
                  }}
                  title="Online"
                />
              ) : (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.3)',
                    border: '2px solid var(--chatter-sheet)',
                  }}
                  title="Offline"
                />
              )
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fff' }}>
                {channelName?.startsWith('#') ? channelName : channelName || 'Study Conversation'}
              </h3>
              {channelType === 'dm' && <TwitterVerifiedBadge />}
            </div>
            {channelType === 'dm' ? (
              <div style={{ fontSize: 11.5, color: isPartnerOnline ? 'var(--chatter-primary)' : 'var(--chatter-light-text)', fontWeight: 500 }}>
                <span>{isPartnerOnline ? 'Active now' : 'Offline · Last seen recently'}</span>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--chatter-light-text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.4)' }} />
                <span>{serverName ? `${serverName} · Discussion` : 'Study Channel'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Header Actions: Room Members, Leave Room, Audio Call & Video Call */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {channelType !== 'dm' && serverId && (
            <>
              <button
                type="button"
                onClick={() => setMembersDrawerOpen((prev) => !prev)}
                title="Room Members"
                style={{
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 18,
                  background: membersDrawerOpen ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  border: membersDrawerOpen ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: membersDrawerOpen ? 'var(--chatter-primary)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>{roomMembers.length || 'Members'}</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmLeaveOpen(true)}
                title="Exit Study Room"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onStartAudioCall}
            title="Start Audio Room"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--chatter-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onStartVideoCall}
            title="Start Video Session"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--chatter-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── 2. Chatter Messages List ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((m) => {
          const isMe =
            Boolean(userId && String(m.sender_id) === String(userId)) ||
            m.sender_name === 'You' ||
            (profile?.name && m.sender_name === profile.name) ||
            (profile?.username && m.sender_name === profile.username) ||
            (userId && m.sender_id && String(m.sender_id).includes(String(userId)));
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                position: 'relative',
              }}
            >
              {/* Author name above peer message */}
              {!isMe && (
                <span style={{ fontSize: 11.5, color: 'var(--chatter-light-text)', fontWeight: 600, marginBottom: 4, marginLeft: 4 }}>
                  {m.sender_name || 'Scholar'}
                </span>
              )}

              {/* Message Bubble matching Chatter ChatTag */}
              <div
                style={{
                  maxWidth: '75%',
                  padding: '12px 16px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? 'var(--chatter-primary)' : 'var(--chatter-sheet)',
                  color: isMe ? '#0E0E0E' : '#FFFFFF',
                  fontWeight: isMe ? 600 : 400,
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onClick={() => setReactionMenuMessageId(reactionMenuMessageId === m.id ? null : m.id)}
              >
                {/* Image attachment */}
                {m.attachment_url && (
                  <div style={{ marginBottom: 8, borderRadius: 12, overflow: 'hidden', maxHeight: 240 }}>
                    <img src={m.attachment_url} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                <div>{m.content}</div>

                {/* Timestamp & read status */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 4,
                    fontSize: 10.5,
                    color: isMe ? 'rgba(14, 14, 14, 0.7)' : 'var(--chatter-light-text)',
                    marginTop: 4,
                  }}
                >
                  <span>
                    {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                  </span>
                  {isMe && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: m.is_read ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.45)',
                        marginLeft: 3,
                      }}
                      title={m.is_read ? 'Read' : 'Delivered'}
                    >
                      {m.is_read ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>

              {/* Reaction Emojis Picker Popup */}
              {reactionMenuMessageId === m.id && (
                <div
                  style={{
                    position: 'absolute',
                    top: -36,
                    [isMe ? 'right' : 'left']: 0,
                    background: 'var(--chatter-sheet)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 24,
                    padding: '4px 8px',
                    display: 'flex',
                    gap: 6,
                    zIndex: 40,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {STUDY_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleToggleReaction(m.id, emoji)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: '2px 4px',
                        transition: 'transform 0.12s ease',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Active Reaction Pills below message */}
              {m.reactions && m.reactions.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {m.reactions.map((r, rIdx) => (
                    <button
                      key={rIdx}
                      type="button"
                      onClick={() => handleToggleReaction(m.id, r.emoji)}
                      style={{
                        background: 'var(--chatter-sheet)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 12,
                        padding: '2px 6px',
                        fontSize: 11,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        cursor: 'pointer',
                      }}
                    >
                      <span>{r.emoji}</span>
                      <span style={{ fontWeight: 700, color: 'var(--chatter-primary)' }}>{r.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── 3. Chatter Compose Bar ── */}
      <div
        style={{
          padding: '10px 16px calc(14px + env(safe-area-inset-bottom))',
          background: 'var(--chatter-sheet)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Attached image preview */}
        {attachedImage && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8, borderRadius: 10, overflow: 'hidden' }}>
            <img src={attachedImage} alt="Attachment" style={{ width: 80, height: 80, objectFit: 'cover' }} />
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 20,
                height: 20,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Message Request Banners */}
        {channelType === 'dm' && dmRequestStatus === 'pending' && requestedBy && String(requestedBy) !== String(userId) && (
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(64, 227, 120, 0.3)',
              borderRadius: 14,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                Message Request
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--chatter-light-text)' }}>
                {channelName || 'This user'} sent you a message request. Accept to reply.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleRespondRequest('accept')}
                disabled={requestActionLoading}
                style={{
                  padding: '6px 14px',
                  borderRadius: 16,
                  background: 'var(--chatter-primary)',
                  border: 'none',
                  color: '#0E0E0E',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => handleRespondRequest('decline')}
                disabled={requestActionLoading}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  background: 'rgba(255, 57, 57, 0.15)',
                  border: 'none',
                  color: 'var(--chatter-red)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {channelType === 'dm' && dmRequestStatus === 'pending' && requestedBy && String(requestedBy) === String(userId) && (
          <div
            style={{
              padding: '9px 14px',
              background: 'rgba(64, 227, 120, 0.1)',
              border: '1px solid rgba(64, 227, 120, 0.25)',
              borderRadius: 12,
              marginBottom: 10,
              fontSize: 12,
              color: 'var(--chatter-primary)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📨</span>
            <span>Initial message request sent. You can chat further once {channelName || 'peer'} accepts your request.</span>
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
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
          {/* Attachment Clip */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => setAttachedImage(reader.result);
                reader.readAsDataURL(file);
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--chatter-light-text)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Attach Image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Text Input */}
          <input
            type="text"
            disabled={channelType === 'dm' && dmRequestStatus === 'pending' && requestedBy && String(requestedBy) === String(userId) && messages.length >= 1}
            placeholder={
              channelType === 'dm' && dmRequestStatus === 'pending' && requestedBy && String(requestedBy) === String(userId) && messages.length >= 1
                ? `Waiting for ${channelName || 'peer'} to accept request...`
                : channelType === 'dm'
                ? `Message @${channelName || 'partner'}...`
                : `Message #${channelName || 'room'}...`
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

          {/* Send Button */}
          <button
            type="submit"
            disabled={
              (!inputText.trim() && !attachedImage) ||
              sending ||
              (channelType === 'dm' && dmRequestStatus === 'pending' && requestedBy && String(requestedBy) === String(userId) && messages.length >= 1)
            }
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
              cursor: (inputText.trim() || attachedImage) ? 'pointer' : 'not-allowed',
              opacity: (inputText.trim() || attachedImage) ? 1 : 0.6,
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

      {/* ── 4. Room Members Slide-over Drawer / Sheet ── */}
      {membersDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setMembersDrawerOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              height: '100%',
              background: 'var(--chatter-sheet)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
              animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 2px 0', color: '#fff' }}>
                  Room Members
                </h3>
                <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                  {roomMembers.length} {roomMembers.length === 1 ? 'scholar' : 'scholars'} in {serverName || 'room'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMembersDrawerOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>

            {/* Members List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingMembers ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--chatter-light-text)', fontSize: 13 }}>
                  Loading room members...
                </div>
              ) : roomMembers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--chatter-light-text)', fontSize: 13 }}>
                  No other members found in this room.
                </div>
              ) : (
                roomMembers.map((member) => {
                  const mUser = member.profiles || {};
                  const mId = String(member.user_id || mUser.id || '');
                  const isCurrent = mId === String(userId);
                  const mName = mUser.name || mUser.username || 'Scholar';
                  const mUsername = mUser.username || mName.toLowerCase().replace(/\s+/g, '_');
                  const roleName = member.role || 'member';

                  return (
                    <div
                      key={mId || Math.random()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          {mUser.avatar_url ? (
                            <img
                              src={mUser.avatar_url}
                              alt={mName}
                              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                background: '#242424',
                                color: 'var(--chatter-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 15,
                              }}
                            >
                              {mName[0]?.toUpperCase() || 'S'}
                            </div>
                          )}
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: 'var(--chatter-primary)',
                              border: '2px solid var(--chatter-sheet)',
                            }}
                            title="Online"
                          />
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: '#fff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {mName}
                            </span>
                            {isCurrent && (
                              <span style={{ fontSize: 10.5, color: 'var(--chatter-primary)', fontWeight: 600 }}>
                                (You)
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--chatter-light-text)' }}>
                              @{mUsername}
                            </span>
                            <span
                              style={{
                                fontSize: 9.5,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                padding: '1px 6px',
                                borderRadius: 8,
                                fontWeight: 700,
                                background:
                                  roleName === 'owner'
                                    ? 'rgba(64, 227, 120, 0.2)'
                                    : roleName === 'admin'
                                    ? 'rgba(168, 85, 247, 0.2)'
                                    : 'rgba(255, 255, 255, 0.08)',
                                color:
                                  roleName === 'owner'
                                    ? 'var(--chatter-primary)'
                                    : roleName === 'admin'
                                    ? '#c084fc'
                                    : 'var(--chatter-light-text)',
                              }}
                            >
                              {roleName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Chat / Message Button */}
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => {
                            setMembersDrawerOpen(false);
                            onStartDM?.({
                              user_id: mId,
                              id: mId,
                              name: mName,
                              username: mUsername,
                              avatar_url: mUser.avatar_url,
                            });
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 14,
                            background: 'rgba(64, 227, 120, 0.14)',
                            border: '1px solid rgba(64, 227, 120, 0.35)',
                            color: 'var(--chatter-primary)',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          <span>Chat</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom drawer action: Leave room */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                type="button"
                onClick={() => {
                  setMembersDrawerOpen(false);
                  setConfirmLeaveOpen(true);
                }}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: 14,
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Leave Study Room</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Confirm Exit Room Modal ── */}
      {confirmLeaveOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 220,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setConfirmLeaveOpen(false)}
        >
          <div
            style={{
              background: 'var(--chatter-sheet)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 22,
              padding: '24px 22px',
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 20px 48px rgba(0,0,0,0.7)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.14)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 8px 0' }}>
              Exit &quot;{serverName || 'Study Room'}&quot;?
            </h3>
            <p style={{ fontSize: 13.5, color: '#D4D4D4', lineHeight: 1.5, margin: '0 0 22px 0' }}>
              You will leave this study room and its channels. You can rejoin anytime using the room invite code or shared link.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmLeaveOpen(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExitRoom}
                disabled={leavingRoom}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 14,
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: leavingRoom ? 'not-allowed' : 'pointer',
                  opacity: leavingRoom ? 0.6 : 1,
                }}
              >
                {leavingRoom ? 'Exiting...' : 'Exit Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
