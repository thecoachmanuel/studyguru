'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPusherClient } from '../lib/pusherClient';
import { apiRequest } from '../lib/api';
import {
  isRag2CandidateFilename,
  startAutomaticRag2Ingestion,
} from '../lib/rag2AutomaticIngestion';
import {
  fetchChannelResourceMetadata,
  indexChannelResourceMetadata,
} from '../lib/channelResourceApi';
import {
  deleteOwnMessage,
  removeDeletedMessage,
} from '../lib/lifecycleApi';
import {
  fetchChannelPins,
  indexPinsByMessage,
  pinMessage,
  unpinMessage,
} from '../lib/pinningApi';
import { hasServerPermission } from '../lib/permissions';
import MessageAttachment from './MessageAttachment';
import PinnedMessagesPanel, { PinIcon } from './PinnedMessagesPanel';
import NeutralHomeState from './NeutralHomeState';
import SelectedServerHomeState from './SelectedServerHomeState';
import DismissableMenu from './DismissableMenu';
import ChatbotIcon from './ChatbotIcon';
import ChatMarkdownMessage from './ChatMarkdownMessage';

// ---------- icons & helpers ----------
function CopyIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ReplyIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

// Curated avatar palette for multi-user channels & groups
const AVATAR_PALETTE = [
  '#2563EB', '#7C3AED', '#DB2777', '#059669',
  '#D97706', '#0891B2', '#4F46E5', '#E11D48',
];
function getAvatarColor(name) {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// Dropdown menu that auto-clamps to stay completely within the visible screen
function MessageActionsMenu({
  isOwnMessage,
  msg,
  copiedMessageId,
  pendingPinMessageId,
  isPinned,
  canManagePins,
  canDeleteMessage,
  onCopy,
  onPin,
  onDelete,
  onReply,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const el = menuRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const container = el.closest('.main-panel__messages');
    const containerRect = container ? container.getBoundingClientRect() : null;

    const minLeft = containerRect ? Math.max(12, containerRect.left + 8) : 12;
    const maxRight = containerRect ? Math.min(window.innerWidth - 12, containerRect.right - 8) : window.innerWidth - 12;

    // Prevent clipping horizontally on both left and right edges
    if (rect.left < minLeft) {
      const shift = minLeft - rect.left;
      el.style.transform = `translateX(${shift}px)`;
    } else if (rect.right > maxRight) {
      const shift = maxRight - rect.right;
      el.style.transform = `translateX(${shift}px)`;
    }

    // Prevent clipping vertically below viewport bottom
    const maxBottom = containerRect ? Math.min(window.innerHeight - 20, containerRect.bottom - 10) : window.innerHeight - 20;
    if (rect.bottom > maxBottom) {
      el.style.top = 'auto';
      el.style.bottom = 'calc(100% + 4px)';
    }
  }, []);

  return (
    <div
      ref={menuRef}
      className={`message-actions__menu ${isOwnMessage ? 'message-actions__menu--own' : 'message-actions__menu--other'}`}
      role="menu"
    >
      {onReply && (
        <button
          type="button"
          className="message-actions__item"
          role="menuitem"
          onClick={() => onReply(msg)}
        >
          <ReplyIcon size={13} />
          Reply
        </button>
      )}

      {msg.content ? (
        <button
          type="button"
          className="message-actions__item"
          role="menuitem"
          onClick={() => onCopy(msg.id, msg.content)}
        >
          <CopyIcon size={13} />
          {copiedMessageId === msg.id ? 'Copied!' : 'Copy text'}
        </button>
      ) : msg.attachment?.file_url ? (
        <button
          type="button"
          className="message-actions__item"
          role="menuitem"
          onClick={() => onCopy(msg.id, msg.attachment.file_url)}
        >
          <CopyIcon size={13} />
          {copiedMessageId === msg.id ? 'Copied!' : 'Copy link'}
        </button>
      ) : null}

      {canManagePins && (
        <button
          type="button"
          className="message-actions__item"
          role="menuitem"
          disabled={pendingPinMessageId === msg.id}
          onClick={() => onPin(msg.id, !isPinned)}
        >
          <PinIcon size={13} />
          {pendingPinMessageId === msg.id
            ? (isPinned ? 'Unpinning…' : 'Pinning…')
            : (isPinned ? 'Unpin message' : 'Pin message')}
        </button>
      )}

      {canDeleteMessage && (
        <button
          type="button"
          className="message-actions__item message-actions__delete"
          role="menuitem"
          onClick={() => onDelete(msg)}
        >
          <TrashIcon size={13} />
          Delete
        </button>
      )}
    </div>
  );
}

// ---------- constants ----------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.docx', '.pptx', '.txt'];

export default function MainPanel({
  serverName, channelName, channelType, channelId, userEmail, profile,
  onLogout, channelSidebarOpen, onToggleChannelSidebar, onMobileBack,
  server, activeServerId, userId, onOpenResource,
  currentRole,
  resourceRatingOverrides = {},
  onCreateServerRequest,
  onJoinServerRequest,
  onCreateChannelRequest,
  onToggleRightPanel,
  rightPanelOpen,
  onRag1Activated,
  onOpenAiTab,
  onMarkAsRead,
}) {
  const router = useRouter();
  const hasChannel = channelName && serverName;

  // ---------- messages state ----------
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsError, setPinsError] = useState('');
  const [pinActionError, setPinActionError] = useState('');
  const [pendingPinMessageId, setPendingPinMessageId] = useState(null);
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(false);
  const pinRequestRef = useRef(0);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  // ---------- reply & touch swipe state ----------
  const [replyingTo, setReplyingTo] = useState(null);
  const [swipingMsgId, setSwipingMsgId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartRef = useRef(null);

  const getReplySnippet = useCallback((msg) => {
    if (msg?.content) {
      const clean = msg.content.replace(/^>\s*↩\s*\*\*@[^*]+\*\*:[^\n]*\n\n/, '').trim();
      return clean.length > 90 ? clean.slice(0, 87) + '…' : clean;
    }
    if (msg?.attachment?.file_name) {
      return `📎 ${msg.attachment.file_name}`;
    }
    return 'Message';
  }, []);

  const handleStartReply = useCallback((msg) => {
    if (!msg) return;
    const author = msg.profiles?.username || msg.username || (msg.user_id === userId ? (profile?.username || 'You') : 'Member');
    setReplyingTo({
      id: msg.id,
      author,
      content: getReplySnippet(msg),
    });
    setOpenMessageMenuId(null);
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 50);
  }, [userId, profile, getReplySnippet]);

  const handleTouchStart = useCallback((e, msg) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      msg,
      isSwiping: false,
    };
  }, []);

  const handleTouchMove = useCallback((e, msg) => {
    if (!touchStartRef.current || touchStartRef.current.msg.id !== msg.id) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;

    if (!touchStartRef.current.isSwiping) {
      if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 8) {
        return;
      }
      touchStartRef.current.isSwiping = true;
    }

    if (dx > 0) {
      const offset = Math.min(dx * 0.45, 65);
      setSwipingMsgId(msg.id);
      setSwipeOffset(offset);
    }
  }, []);

  const handleTouchEnd = useCallback((e, msg) => {
    if (touchStartRef.current && touchStartRef.current.msg.id === msg.id) {
      if (swipeOffset >= 35) {
        handleStartReply(msg);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(15); } catch {}
        }
      }
    }
    setSwipingMsgId(null);
    setSwipeOffset(0);
    touchStartRef.current = null;
  }, [swipeOffset, handleStartReply]);

  // ---------- file attachment state ----------
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);     // File object to upload
  const [filePreview, setFilePreview] = useState(null);      // preview URL for images
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [resourceMetadataById, setResourceMetadataById] = useState({});
  const [resourceMetadataRefresh, setResourceMetadataRefresh] = useState(0);
  const resourceRefreshTimersRef = useRef([]);

  const resourceIds = [...new Set(
    [...messages, ...pinnedMessages]
      .map((message) => message.attachment?.resource_id)
      .filter(Boolean),
  )];
  const resourceIdsKey = resourceIds.slice().sort().join(',');
  const pinsByMessageId = indexPinsByMessage(pinnedMessages);
  const canManagePins = hasServerPermission(currentRole, 'manage_server');
  const canModerateMessages = canManagePins;

  useEffect(() => {
    resourceRefreshTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    resourceRefreshTimersRef.current = [];
    return () => {
      resourceRefreshTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      resourceRefreshTimersRef.current = [];
    };
  }, [channelId]);

  useEffect(() => {
    if (!activeServerId || !resourceIdsKey) return;
    const controller = new AbortController();
    const ids = resourceIdsKey.split(',');
    const batches = [];
    for (let offset = 0; offset < ids.length; offset += 200) {
      batches.push(ids.slice(offset, offset + 200));
    }

    Promise.all(
      batches.map((batch) => fetchChannelResourceMetadata(
        apiRequest,
        activeServerId,
        batch,
        { signal: controller.signal },
      )),
    )
      .then((rows) => setResourceMetadataById(
        indexChannelResourceMetadata(rows.flat()),
      ))
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          console.warn(
            '[RAG2-CHANNEL] Resource metadata could not be loaded.',
            { status: error?.status || 'unknown' },
          );
        }
      });

    return () => controller.abort();
  }, [activeServerId, resourceIdsKey, resourceMetadataRefresh]);

  const scheduleResourceMetadataRefresh = () => {
    resourceRefreshTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    resourceRefreshTimersRef.current = [2000, 10000, 30000, 60000].map(
      (delay) => window.setTimeout(
        () => setResourceMetadataRefresh((value) => value + 1),
        delay,
      ),
    );
  };

  const refreshPinnedMessages = useCallback(async (showLoading = false) => {
    const requestId = ++pinRequestRef.current;
    if (!channelId) {
      setPinnedMessages([]);
      setPinsError('');
      setPinsLoading(false);
      return;
    }

    if (showLoading) setPinsLoading(true);
    try {
      const rows = await fetchChannelPins(apiRequest, channelId);
      if (pinRequestRef.current !== requestId) return;
      setPinnedMessages(Array.isArray(rows) ? rows : []);
      setPinsError('');
    } catch (error) {
      if (pinRequestRef.current !== requestId) return;
      setPinsError(
        error?.message || 'Pinned messages could not be loaded.',
      );
    } finally {
      if (pinRequestRef.current === requestId) setPinsLoading(false);
    }
  }, [channelId]);

  // ---------- load messages & pinned messages when channel changes ----------
  useEffect(() => {
    if (!channelId) {
      pinRequestRef.current += 1;
      setMessages([]);
      setPinnedMessages([]);
      setPinnedPanelOpen(false);
      setPinsError('');
      return;
    }
    setOpenMessageMenuId(null);
    setDeleteCandidate(null);
    setDeleteError('');
    setPinActionError('');

    let isMounted = true;
    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const data = await apiRequest(`/api/channels/${encodeURIComponent(channelId)}/messages`);
        if (!isMounted) return;
        const msgList = Array.isArray(data) ? data : (data?.messages || []);
        const enriched = msgList.map((m) => ({
          ...m,
          attachment: m.attachments?.[0] || m.attachment || null,
        }));
        setMessages(enriched);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        if (isMounted) setMessagesLoading(false);
      }
    };

    loadMessages();
    refreshPinnedMessages(true);
    onMarkAsRead?.(channelId);

    return () => {
      isMounted = false;
    };
  }, [channelId, refreshPinnedMessages, onMarkAsRead]);

  // ---------- Pusher Realtime subscription ----------
  useEffect(() => {
    if (!channelId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const pusherChannelName = `channel-${channelId}`;
    let chan = null;
    try {
      chan = pusher.subscribe(pusherChannelName);
    } catch (err) {
      console.warn('Pusher subscribe error:', err);
      return;
    }

    const handleNewMessage = (newMsg) => {
      const enrichedMsg = {
        ...newMsg,
        attachment: newMsg.attachments?.[0] || newMsg.attachment || null,
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === enrichedMsg.id)) return prev;
        const updated = [...prev, enrichedMsg].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        return updated;
      });

      if (typeof document !== 'undefined' && !document.hidden) {
        onMarkAsRead?.(channelId);
      }
    };

    const handleDeletedMessage = (payload) => {
      const deletedMessageId = payload?.messageId;
      if (!deletedMessageId) return;
      setMessages((current) => removeDeletedMessage(current, deletedMessageId));
      setPinnedMessages((current) => current.filter(
        (pin) => pin.message_id !== deletedMessageId && pin.id !== deletedMessageId,
      ));
      setOpenMessageMenuId((current) => (
        current === deletedMessageId ? null : current
      ));
      setDeleteCandidate((current) => (
        current?.id === deletedMessageId ? null : current
      ));
    };

    const handlePinnedChange = () => {
      refreshPinnedMessages(false);
    };

    chan.bind('new-message', handleNewMessage);
    chan.bind('message-deleted', handleDeletedMessage);
    chan.bind('message-pinned', handlePinnedChange);
    chan.bind('message-unpinned', handlePinnedChange);

    return () => {
      try {
        chan.unbind('new-message', handleNewMessage);
        chan.unbind('message-deleted', handleDeletedMessage);
        chan.unbind('message-pinned', handlePinnedChange);
        chan.unbind('message-unpinned', handlePinnedChange);
        pusher.unsubscribe(pusherChannelName);
      } catch {}
    };
  }, [channelId, refreshPinnedMessages, onMarkAsRead]);

  // Auto-mark active channel as read when window or tab gains focus
  useEffect(() => {
    if (!channelId || !onMarkAsRead) return;

    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        onMarkAsRead(channelId);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [channelId, onMarkAsRead]);

  // ---------- scroll to bottom when messages change ----------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ---------- clean up file preview URL on unmount / change ----------
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  // ---------- handle file selection ----------
  const handleFileSelect = (e) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate extension
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      e.target.value = '';
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 10 MB.`);
      e.target.value = '';
      return;
    }

    setPendingFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // ---------- clear pending file ----------
  const clearPendingFile = () => {
    setPendingFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    setUploadError('');
  };

  // ---------- send a message (text and/or file) ----------
  const handleSendMessage = async (e) => {
    e.preventDefault();

    const trimmed = messageText.trim();
    const hasText = !!trimmed;
    const hasFile = !!pendingFile;

    // Need at least text or file
    if ((!hasText && !hasFile) || !channelId || !activeServerId || !userId) return;

    setSending(true);
    setUploading(hasFile);
    setUploadError('');

    try {
      let attachmentData = null;

      // ---- Upload file first if present ----
      if (hasFile) {
        const formData = new FormData();
        formData.append('file', pendingFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => null);
          throw new Error(errData?.error || 'Failed to upload file.');
        }

        const uploadJson = await uploadRes.json();
        if (!uploadJson.url) {
          throw new Error(uploadJson.error || 'Failed to upload file.');
        }

        attachmentData = {
          file_name: pendingFile.name,
          file_url: uploadJson.url,
          file_type: pendingFile.type,
          file_size: pendingFile.size,
          storage_path: uploadJson.url,
        };
      }

      // ---- Message payload ----
      let messageContent = hasText
        ? trimmed
        : '';

      if (replyingTo && (hasText || pendingFile)) {
        const quoteHeader = `> ↩ **@${replyingTo.author}**: ${replyingTo.content}\n\n`;
        messageContent = quoteHeader + (hasText ? trimmed : (pendingFile ? `📎 ${pendingFile.name}` : ''));
      }

      const msgData = await apiRequest(`/api/channels/${encodeURIComponent(channelId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: messageContent,
          attachments: attachmentData ? [attachmentData] : [],
        }),
      });

      if (msgData) {
        const enrichedMsg = {
          ...msgData,
          profiles: msgData.profiles || profile || {
            username: userEmail?.split('@')[0] || 'Unknown',
            avatar_url: null,
          },
          attachment: msgData.attachments?.[0] || msgData.attachment || attachmentData || null,
        };

        setMessages((current) => {
          if (current.some((m) => m.id === enrichedMsg.id)) return current;
          return [...current, enrichedMsg].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at),
          );
        });

        const sentAttachment = enrichedMsg.attachment;
        if (
          sentAttachment?.id
          && isRag2CandidateFilename(pendingFile?.name || sentAttachment.file_name)
        ) {
          startAutomaticRag2Ingestion(
            apiRequest,
            sentAttachment.id,
            {
              onSuccess: (result) => {
                if (!result?.resource_id) return;
                setMessages((current) => current.map((message) => (
                  message.id === msgData.id
                    ? {
                        ...message,
                        attachment: {
                          ...message.attachment,
                          resource_id: result.resource_id,
                        },
                      }
                    : message
                )));
                scheduleResourceMetadataRefresh();
              },
              onFailure: (error) => {
                console.warn(
                  '[RAG2-AUTO] Semantic enrichment did not start.',
                  { status: error?.status || 'unknown' },
                );
              },
            },
          );
        }
      }

      // ---- Clear inputs ----
      setMessageText('');
      setReplyingTo(null);
      clearPendingFile();

    } catch (err) {
      console.error('Unexpected error sending message:', err);
      setUploadError('Something went wrong. Please try again.');
    }

    setSending(false);
    setUploading(false);
  };

  const handleDeleteMessage = async () => {
    if (!deleteCandidate?.id || deletingMessageId) return;
    const messageId = deleteCandidate.id;
    setDeletingMessageId(messageId);
    setDeleteError('');
    try {
      await deleteOwnMessage(apiRequest, messageId);
      setMessages((current) => removeDeletedMessage(current, messageId));
      setDeleteCandidate(null);
      setOpenMessageMenuId(null);
    } catch (error) {
      setDeleteError(
        error?.message || 'The message could not be deleted. Please try again.',
      );
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handlePinAction = async (messageId, shouldPin) => {
    if (!canManagePins || pendingPinMessageId) return;
    setPendingPinMessageId(messageId);
    setPinActionError('');
    try {
      if (shouldPin) {
        await pinMessage(apiRequest, messageId);
      } else {
        await unpinMessage(apiRequest, messageId);
      }
      setOpenMessageMenuId(null);
      await refreshPinnedMessages(false);
    } catch (error) {
      const message = error?.message
        || `The message could not be ${shouldPin ? 'pinned' : 'unpinned'}.`;
      setPinActionError(message);
      if (pinnedPanelOpen) setPinsError(message);
    } finally {
      setPendingPinMessageId(null);
    }
  };

  const handleJumpToMessage = (messageId) => {
    const element = document.getElementById(`message-${messageId}`);
    if (!element) {
      setPinsError('That message is not currently loaded in this channel.');
      return;
    }
    setPinnedPanelOpen(false);
    window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('message-row--jump-highlight');
      window.setTimeout(
        () => element.classList.remove('message-row--jump-highlight'),
        1800,
      );
    });
  };

  // ---------- copy message content to clipboard ----------
  const handleCopyMessage = async (msgId, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === msgId ? null : current));
      }, 2000);
    } catch (err) {
      console.warn('Failed to copy text:', err);
    }
    setOpenMessageMenuId(null);
  };

  // ---------- format timestamp ----------
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ---------- get date label for separator ----------
  const getDateLabel = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();

    if (date.toDateString() === now.toDateString()) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  // ---------- build messages with date separators & chat bubbles ----------
  const renderMessages = () => {
    if (messagesLoading) {
      return (
        <div className="main-panel__placeholder">
          <div className="main-panel__placeholder-icon">
            <svg className="spinner-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <p className="main-panel__placeholder-text">Loading messages…</p>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="main-panel__placeholder">
          <div className="main-panel__placeholder-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="main-panel__placeholder-title"># {channelName}</h3>
          <p className="main-panel__placeholder-text">
            This is the start of the #{channelName} channel. Send a message to get the conversation going!
          </p>
        </div>
      );
    }

    const items = [];
    let lastDateLabel = null;

    messages.forEach((msg, index) => {
      const dateLabel = getDateLabel(msg.created_at);

      // Insert a date separator when the day changes
      if (dateLabel && dateLabel !== lastDateLabel) {
        items.push(
          <div className="message-date-sep" key={`sep-${msg.id}`}>
            <div className="message-date-sep__line" />
            <span className="message-date-sep__label">{dateLabel}</span>
            <div className="message-date-sep__line" />
          </div>
        );
        lastDateLabel = dateLabel;
      }

      const prevMsg = index > 0 ? messages[index - 1] : null;
      const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

      // Robust own message identification:
      const currentUserId = String(userId || profile?.id || '');
      const msgUserId = String(msg.user_id || msg.profiles?.id || '');
      const isOwnMessage = Boolean(
        (currentUserId && msgUserId && currentUserId === msgUserId) ||
        (userEmail && msg.profiles?.email && msg.profiles.email === userEmail) ||
        (profile?.username && msg.profiles?.username && msg.profiles.username === profile.username)
      );

      // Grouping / clustering logic:
      const prevDateLabel = prevMsg ? getDateLabel(prevMsg.created_at) : null;
      const nextDateLabel = nextMsg ? getDateLabel(nextMsg.created_at) : null;

      const isSameDayAsPrev = prevDateLabel === dateLabel;
      const isSameDayAsNext = nextDateLabel === dateLabel;

      const prevSenderId = prevMsg ? String(prevMsg.user_id || prevMsg.profiles?.id || '') : '';
      const nextSenderId = nextMsg ? String(nextMsg.user_id || nextMsg.profiles?.id || '') : '';

      const prevTime = prevMsg ? new Date(prevMsg.created_at).getTime() : 0;
      const currTime = new Date(msg.created_at).getTime();
      const nextTime = nextMsg ? new Date(nextMsg.created_at).getTime() : 0;

      const isSameSenderAsPrev = isSameDayAsPrev && prevMsg && (prevSenderId === msgUserId);
      const isTimeCloseToPrev = isSameSenderAsPrev && !isNaN(prevTime) && !isNaN(currTime) && (currTime - prevTime < 5 * 60 * 1000) && (currTime - prevTime >= 0);
      const isGroupedWithPrev = isSameSenderAsPrev && isTimeCloseToPrev;

      const isSameSenderAsNext = isSameDayAsNext && nextMsg && (nextSenderId === msgUserId);
      const isTimeCloseToNext = isSameSenderAsNext && !isNaN(nextTime) && !isNaN(currTime) && (nextTime - currTime < 5 * 60 * 1000) && (nextTime - currTime >= 0);
      const isGroupedWithNext = isSameSenderAsNext && isTimeCloseToNext;

      const isGroupStart = !isGroupedWithPrev;
      const isGroupEnd = !isGroupedWithNext;

      const burstClass = isGroupedWithPrev && isGroupedWithNext
        ? 'message-bubble--burst-mid'
        : isGroupedWithPrev
          ? 'message-bubble--burst-end'
          : isGroupedWithNext
            ? 'message-bubble--burst-start'
            : 'message-bubble--burst-single';

      const username = msg.profiles?.username || msg.profiles?.name || 'Scholar';
      const avatarUrl = msg.profiles?.avatar_url;
      const initial = username[0]?.toUpperCase() || '?';
      const isPinned = Boolean(pinsByMessageId[msg.id]);
      const canDeleteMessage = isOwnMessage || canModerateMessages;

      const authorRole = msg.profiles?.role || (
        server?.owner_id && String(msg.user_id) === String(server.owner_id) ? 'Owner' : null
      );

      items.push(
        <div
          className={[
            'message-row',
            isOwnMessage ? 'message-row--own' : 'message-row--other',
            isGroupedWithPrev ? 'message-row--grouped' : 'message-row--start',
            isGroupEnd ? 'message-row--end' : '',
          ].filter(Boolean).join(' ')}
          key={msg.id}
          id={`message-${msg.id}`}
          data-reply-author={username}
          onTouchStart={(e) => handleTouchStart(e, msg)}
          onTouchMove={(e) => handleTouchMove(e, msg)}
          onTouchEnd={(e) => handleTouchEnd(e, msg)}
          onTouchCancel={(e) => handleTouchEnd(e, msg)}
        >
          {/* Swipe-to-reply cue indicator on mobile */}
          {swipingMsgId === msg.id && (
            <div
              className={`message-swipe-reply-cue ${swipeOffset >= 35 ? 'message-swipe-reply-cue--active' : ''}`}
              style={{
                opacity: Math.min(swipeOffset / 35, 1),
                transform: `translateY(-50%) translateX(${Math.min(swipeOffset * 0.4, 20)}px)`,
              }}
            >
              <ReplyIcon size={14} />
            </div>
          )}

          {/* Avatar on Left (for other users) */}
          {!isOwnMessage && (
            isGroupStart ? (
              avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="message-avatar"
                />
              ) : (
                <div
                  className="message-avatar message-avatar--initial"
                  style={{ backgroundColor: getAvatarColor(username) }}
                >
                  {initial}
                </div>
              )
            ) : (
              <div className="message-avatar message-avatar--spacer" aria-hidden="true" />
            )
          )}

          {/* Action Trigger for Own Message (Placed to the left of own bubble) */}
          {isOwnMessage && (
            <DismissableMenu
              className="message-actions message-actions--own"
              open={openMessageMenuId === msg.id}
              onDismiss={() => setOpenMessageMenuId(null)}
            >
              <button
                type="button"
                className="message-actions__trigger"
                aria-label="Message actions"
                aria-expanded={openMessageMenuId === msg.id}
                onClick={() => setOpenMessageMenuId((current) => (
                  current === msg.id ? null : msg.id
                ))}
              >
                <span aria-hidden="true">•••</span>
              </button>
              {openMessageMenuId === msg.id && (
                <MessageActionsMenu
                  isOwnMessage={true}
                  msg={msg}
                  copiedMessageId={copiedMessageId}
                  pendingPinMessageId={pendingPinMessageId}
                  isPinned={isPinned}
                  canManagePins={canManagePins}
                  canDeleteMessage={canDeleteMessage}
                  onCopy={handleCopyMessage}
                  onPin={handlePinAction}
                  onDelete={(candidate) => {
                    setDeleteCandidate(candidate);
                    setDeleteError('');
                    setOpenMessageMenuId(null);
                  }}
                  onReply={handleStartReply}
                />
              )}
            </DismissableMenu>
          )}

          {/* Main Bubble Content Container */}
          <div 
            className={`message-bubble-wrapper ${isOwnMessage ? 'message-bubble-wrapper--own' : 'message-bubble-wrapper--other'}`}
            style={swipingMsgId === msg.id ? {
              transform: `translateX(${swipeOffset}px)`,
              transition: 'none',
            } : undefined}
          >
            {/* Show author name & role for others at group start */}
            {!isOwnMessage && isGroupStart && (
              <div className="message-bubble-author">
                <span className="message-author">{username}</span>
                {authorRole && (
                  <span className={`message-author-badge message-author-badge--${authorRole.toLowerCase()}`}>
                    {authorRole}
                  </span>
                )}
              </div>
            )}

            <div
              className={[
                'message-bubble',
                isOwnMessage ? 'message-bubble--own' : 'message-bubble--other',
                burstClass,
                isGroupedWithPrev ? 'message-bubble--grouped-prev' : '',
                isGroupedWithNext ? 'message-bubble--grouped-next' : '',
                isPinned ? 'message-bubble--pinned' : '',
              ].filter(Boolean).join(' ')}
            >
              {isPinned && (
                <div className="message-pinned-indicator">
                  <PinIcon size={10} />
                  <span>Pinned</span>
                </div>
              )}

              {msg.attachment && (
                <div className="message-attachment-container">
                  <MessageAttachment
                    attachment={msg.attachment}
                    resourceMetadata={resourceMetadataById[msg.attachment.resource_id]
                      ? {
                          ...resourceMetadataById[msg.attachment.resource_id],
                          ...resourceRatingOverrides[msg.attachment.resource_id],
                        }
                      : null}
                    onOpenResource={onOpenResource}
                    onAiStudy={(att) => {
                      onRag1Activated?.({
                        filename: att.file_name,
                        downloadUrl: att.file_url,
                        resourceId: att.resource_id,
                        session_id: att.resource_id,
                      });
                    }}
                  />
                </div>
              )}

              {(() => {
                if (!msg.content) return null;
                const trimmedContent = msg.content.trim();
                // If the message text was just the auto-generated attachment filename or 📎, hide redundant text
                if (msg.attachment && (
                  trimmedContent === `📎 ${msg.attachment.file_name}` ||
                  trimmedContent === msg.attachment.file_name ||
                  trimmedContent === '📎'
                )) {
                  return null;
                }
                const cleanContent = trimmedContent.startsWith('📎 ')
                  ? trimmedContent.replace(/^📎\s*/, '')
                  : trimmedContent;
                if (!cleanContent) return null;

                // Check for swipe-and-reply quote prefix:
                // > ↩ **@Author**: Snippet...\n\nBody
                const replyMatch = cleanContent.match(/^>\s*↩\s*\*\*@([^*]+)\*\*:\s*([^\n]+)\n\n([\s\S]*)$/);
                let replyQuote = null;
                let displayBody = cleanContent;

                if (replyMatch) {
                  const replyAuthor = replyMatch[1];
                  const replySnippet = replyMatch[2];
                  displayBody = replyMatch[3].trim();
                  replyQuote = (
                    <div 
                      className="message-reply-quote"
                      onClick={() => {
                        const matchingRow = document.querySelector(`[data-reply-author="${replyAuthor}"]`);
                        if (matchingRow) {
                          matchingRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          matchingRow.classList.add('message-row--jump-highlight');
                          setTimeout(() => matchingRow.classList.remove('message-row--jump-highlight'), 1800);
                        }
                      }}
                      title={`Replying to @${replyAuthor}`}
                    >
                      <div className="message-reply-quote__author">@{replyAuthor}</div>
                      <div className="message-reply-quote__snippet">{replySnippet}</div>
                    </div>
                  );
                }

                return (
                  <div className="message-text">
                    {replyQuote}
                    {displayBody ? <ChatMarkdownMessage content={displayBody} /> : null}
                  </div>
                );
              })()}

              <div className="message-bubble-footer">
                <span className="message-time">{formatTime(msg.created_at)}</span>
                {isOwnMessage && (
                  <span className="message-status-check" title="Delivered" aria-label="Delivered">
                    <svg width="15" height="10" viewBox="0 0 16 10" fill="none" className="message-check-svg">
                      <path d="M1.5 5.5L5 9L11 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6 5.5L9.5 9L15.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Trigger for Others (Placed to the right of their bubble) */}
          {!isOwnMessage && (
            <DismissableMenu
              className="message-actions message-actions--other"
              open={openMessageMenuId === msg.id}
              onDismiss={() => setOpenMessageMenuId(null)}
            >
              <button
                type="button"
                className="message-actions__trigger"
                aria-label="Message actions"
                aria-expanded={openMessageMenuId === msg.id}
                onClick={() => setOpenMessageMenuId((current) => (
                  current === msg.id ? null : msg.id
                ))}
              >
                <span aria-hidden="true">•••</span>
              </button>
              {openMessageMenuId === msg.id && (
                <MessageActionsMenu
                  isOwnMessage={false}
                  msg={msg}
                  copiedMessageId={copiedMessageId}
                  pendingPinMessageId={pendingPinMessageId}
                  isPinned={isPinned}
                  canManagePins={canManagePins}
                  canDeleteMessage={canDeleteMessage}
                  onCopy={handleCopyMessage}
                  onPin={handlePinAction}
                  onDelete={(candidate) => {
                    setDeleteCandidate(candidate);
                    setDeleteError('');
                    setOpenMessageMenuId(null);
                  }}
                  onReply={handleStartReply}
                />
              )}
            </DismissableMenu>
          )}
        </div>
      );
    });

    return items;
  };

  // ---------- derive pretty name for pending file ----------
  const pendingFileLabel = pendingFile
    ? (pendingFile.name.length > 28
        ? pendingFile.name.slice(0, 24) + '…' + pendingFile.name.slice(pendingFile.name.lastIndexOf('.'))
        : pendingFile.name)
    : '';

  return (
    <section className="main-panel" id="main-panel">
      {/* Topbar */}
      <header className="main-panel__topbar">
        <div className="main-panel__topbar-left">
          <button id="mobile-back-button" className="main-panel__mobile-back" onClick={onMobileBack} aria-label="Back to channels" title="Back to channels">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button id="sidebar-toggle-button" className="main-panel__sidebar-toggle" onClick={onToggleChannelSidebar} aria-label={channelSidebarOpen ? 'Hide channels' : 'Show channels'} title={channelSidebarOpen ? 'Hide channels' : 'Show channels'}>
            {channelSidebarOpen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <polyline points="6 9 3 12 6 15" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <polyline points="12 9 15 12 12 15" />
              </svg>
            )}
          </button>

          {hasChannel ? (
            <>
              {channelType === 'voice' ? (
                <svg className="main-panel__channel-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <span className="main-panel__hash">#</span>
              )}
              <h2 className="main-panel__channel-name">{channelName}</h2>
              <span className="main-panel__server-badge">{serverName}</span>
            </>
          ) : (
            <h2 className="main-panel__channel-name">StudyGuru</h2>
          )}
        </div>

        <div className="main-panel__topbar-right">
          {hasChannel && channelType !== 'voice' && (
            <button
              type="button"
              className="main-panel__pins-button"
              title="Pinned Messages"
              aria-label="Pinned Messages"
              onClick={() => {
                setPinnedPanelOpen(true);
                refreshPinnedMessages(true);
              }}
            >
              <PinIcon size={15} />
              {pinnedMessages.length > 0 && (
                <span aria-label={`${pinnedMessages.length} pinned messages`}>
                  {pinnedMessages.length}
                </span>
              )}
            </button>
          )}
          {onToggleRightPanel && (
            <button
              type="button"
              className={`main-panel__ai-toggle-btn ${rightPanelOpen ? 'main-panel__ai-toggle-btn--active' : ''}`}
              onClick={onToggleRightPanel}
              title="Toggle AI Study Guru & Group Tools"
              aria-label="Toggle AI Study Guru & Group Tools"
            >
              <ChatbotIcon size={15} />
              <span className="main-panel__ai-toggle-label">AI Guru</span>
            </button>
          )}
          <button 
            className="main-panel__profile-btn" 
            onClick={() => router.push('/profile')}
            title="Profile Settings"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="main-panel__avatar" />
            ) : (
              <div className="main-panel__avatar-placeholder">
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <span className="main-panel__username">{profile?.username || userEmail}</span>
          </button>
          
          <button id="logout-button" className="btn btn-secondary main-panel__logout" onClick={onLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="main-panel__logout-label">Log out</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="main-panel__body">
        {hasChannel ? (
          <>
            {/* Messages area */}
            <div className="main-panel__messages">
              {renderMessages()}
              <div ref={messagesEndRef} />
            </div>

            {/* Upload error */}
            {uploadError && (
              <div className="compose-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>{uploadError}</span>
                <button className="compose-error__dismiss" onClick={() => setUploadError('')} aria-label="Dismiss">×</button>
              </div>
            )}
            {pinActionError && (
              <div className="compose-error" role="alert">
                <span>{pinActionError}</span>
                <button
                  className="compose-error__dismiss"
                  onClick={() => setPinActionError('')}
                  aria-label="Dismiss pin error"
                >
                  ×
                </button>
              </div>
            )}

            {/* Pending file preview */}
            {pendingFile && (
              <div className="compose-file-preview">
                {filePreview ? (
                  <img src={filePreview} alt="preview" className="compose-file-preview__thumb" />
                ) : (
                  <div className="compose-file-preview__doc-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                )}
                <span className="compose-file-preview__name">{pendingFileLabel}</span>
                <span className="compose-file-preview__size">
                  {(pendingFile.size / 1024).toFixed(0)} KB
                </span>
                <button className="compose-file-preview__remove" onClick={clearPendingFile} title="Remove file" aria-label="Remove file">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {/* Compose bar */}
            <div className="main-panel__compose">
              {/* Quick AI Study Bar */}
              {onOpenAiTab && (
                <div className="main-panel__ai-quick-bar" aria-label="AI Study Features">
                  <button
                    type="button"
                    className="main-panel__ai-chip"
                    onClick={() => onOpenAiTab('chat')}
                    title="Ask questions to AI Study Guru"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Ask questions</span>
                  </button>
                  <button
                    type="button"
                    className="main-panel__ai-chip"
                    onClick={() => onOpenAiTab('summary')}
                    title="Summarize study documents"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>Summarize documents</span>
                  </button>
                  <button
                    type="button"
                    className="main-panel__ai-chip"
                    onClick={() => onOpenAiTab('flashcards')}
                    title="Create interactive flashcards"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <span>Create flashcards</span>
                  </button>
                  <button
                    type="button"
                    className="main-panel__ai-chip"
                    onClick={() => onOpenAiTab('mcq')}
                    title="Generate interactive quizzes"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    <span>Generate quizzes</span>
                  </button>
                </div>
              )}

              {/* Replying banner */}
              {replyingTo && (
                <div className="compose-reply-banner">
                  <div className="compose-reply-banner__left">
                    <div className="compose-reply-banner__icon">
                      <ReplyIcon size={14} />
                    </div>
                    <div className="compose-reply-banner__info">
                      <div className="compose-reply-banner__author">
                        Replying to <strong>@{replyingTo.author}</strong>
                      </div>
                      <div className="compose-reply-banner__snippet">
                        {replyingTo.content}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="compose-reply-banner__close"
                    onClick={() => setReplyingTo(null)}
                    aria-label="Cancel reply"
                    title="Cancel reply"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}

              <form className="compose-bar" onSubmit={handleSendMessage}>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_EXTENSIONS.join(',')}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="file-attach-input"
                />

                {/* Attach button */}
                <button
                  type="button"
                  className="compose-bar__add"
                  title="Attach file"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                <input
                  id="message-input"
                  ref={messageInputRef}
                  className="compose-bar__input"
                  type="text"
                  placeholder={
                    replyingTo
                      ? `Replying to @${replyingTo.author}…`
                      : (pendingFile ? `Add a message with ${pendingFileLabel}…` : `Message #${channelName}`)
                  }
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && replyingTo) {
                      setReplyingTo(null);
                    }
                  }}
                  disabled={sending}
                  autoComplete="off"
                />

                {/* Upload spinner or send icon */}
                <button
                  type="submit"
                  className="compose-bar__send"
                  disabled={(!messageText.trim() && !pendingFile) || sending}
                  title={uploading ? 'Uploading…' : 'Send message'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: (messageText.trim() || pendingFile) ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: (messageText.trim() || pendingFile) ? 'pointer' : 'default',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {uploading ? (
                    <svg className="spinner-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </>
        ) : activeServerId ? (
          <SelectedServerHomeState
            server={server}
            currentRole={currentRole}
            onCreateChannel={onCreateChannelRequest}
          />
        ) : (
          <NeutralHomeState
            profile={profile}
            userEmail={userEmail}
            onCreateServer={onCreateServerRequest}
            onJoinServer={onJoinServerRequest}
          />
        )}
      </div>
      {pinnedPanelOpen && (
        <PinnedMessagesPanel
          pins={pinnedMessages}
          loading={pinsLoading}
          error={pinsError}
          canManagePins={canManagePins}
          pendingMessageId={pendingPinMessageId}
          resourceMetadataById={Object.fromEntries(
            Object.entries(resourceMetadataById).map(([resourceId, metadata]) => [
              resourceId,
              {
                ...metadata,
                ...resourceRatingOverrides[resourceId],
              },
            ]),
          )}
          onClose={() => setPinnedPanelOpen(false)}
          onJump={handleJumpToMessage}
          onUnpin={(messageId) => handlePinAction(messageId, false)}
          onOpenResource={onOpenResource}
        />
      )}
      {deleteCandidate && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!deletingMessageId) setDeleteCandidate(null);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-message-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-message-title" className="modal-card__title">
              Delete message?
            </h3>
            <p className="modal-card__desc">
              This cannot be undone. It permanently deletes the message and
              its attachment. Any
              linked server resource, chunks, and ratings used only by this
              message are also removed. Existing personal AI study imports remain.
            </p>
            {deleteError && (
              <div className="settings-error" role="alert">{deleteError}</div>
            )}
            <div className="modal-card__actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={Boolean(deletingMessageId)}
                onClick={() => setDeleteCandidate(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary message-delete-confirm"
                disabled={Boolean(deletingMessageId)}
                onClick={handleDeleteMessage}
              >
                {deletingMessageId
                  ? 'Deleting…'
                  : deleteCandidate.user_id === userId
                    ? 'Delete'
                    : 'Delete Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
