'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import ServerSettingsModal from '@/components/ServerSettingsModal';
import { apiRequest } from '@/lib/api';
import { getCurrentMemberRole } from '@/lib/permissions';
import { leaveServer } from '@/lib/lifecycleApi';
import { dismissAllMenus } from '@/hooks/useDismissableMenu';
import StudyGuruLogo from '@/components/StudyGuruLogo';
import ChatbotIcon from '@/components/ChatbotIcon';
import { getPusherClient } from '@/lib/pusherClient';
import { clearStoredUnread, setStoredUnreadCount } from '@/lib/unreadMessages';
import ChatterTopBar from '@/components/chatter/ChatterTopBar';
import ChatterBottomNav from '@/components/chatter/ChatterBottomNav';
import ChatterSidebarNav from '@/components/chatter/ChatterSidebarNav';
import ChatterFeedView from '@/components/chatter/ChatterFeedView';
import ChatterRoomsView from '@/components/chatter/ChatterRoomsView';
import ChatterChatsView from '@/components/chatter/ChatterChatsView';
import ChatterGuruView from '@/components/chatter/ChatterGuruView';
import ChatterProfileView from '@/components/chatter/ChatterProfileView';
import DirectMessagesModal from '@/components/DirectMessagesModal';
import UserStatusModal from '@/components/UserStatusModal';
import ChatterChatRoom from '@/components/chatter/ChatterChatRoom';
import ChatterAudioSpaceModal from '@/components/chatter/ChatterAudioSpaceModal';
import ChatterUserProfileModal from '@/components/chatter/ChatterUserProfileModal';

function moveChannelLocally(channels, channelId, beforeChannelId, afterChannelId) {
  const movedChannel = channels.find((channel) => channel.id === channelId);
  if (!movedChannel) return channels;

  const sameTypeChannels = channels.filter(
    (channel) => channel.type === movedChannel.type && channel.id !== channelId
  );

  let insertionIndex = 0;
  if (beforeChannelId) {
    const beforeIndex = sameTypeChannels.findIndex(
      (channel) => channel.id === beforeChannelId
    );
    if (beforeIndex < 0) return channels;
    insertionIndex = beforeIndex + 1;
  } else if (afterChannelId) {
    const afterIndex = sameTypeChannels.findIndex(
      (channel) => channel.id === afterChannelId
    );
    if (afterIndex < 0) return channels;
    insertionIndex = afterIndex;
  }

  const reorderedGroup = [...sameTypeChannels];
  reorderedGroup.splice(insertionIndex, 0, movedChannel);

  let groupIndex = 0;
  return channels.map((channel) => (
    channel.type === movedChannel.type
      ? reorderedGroup[groupIndex++]
      : channel
  ));
}

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;

  // ---------- profile ----------
  const profile = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name || user.email?.split('@')[0] || 'Scholar',
      username: user.name || user.email?.split('@')[0] || 'Scholar',
      full_name: user.name || user.email?.split('@')[0] || 'Scholar',
      email: user.email,
      avatar_url: user.image || null,
    };
  }, [user]);

  const voiceSession = useVoiceSession(user?.id, profile);
  const { handleLeave: leaveVoiceSession } = voiceSession;

  // ---------- servers ----------
  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [serversError, setServersError] = useState(null);

  // ---------- channels ----------
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState(null);

  // ---------- members ----------
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);

  // ---------- selection ----------
  const [activeServerId, setActiveServerId] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeChannelName, setActiveChannelName] = useState(null);
  const [activeChannelType, setActiveChannelType] = useState('text');
  const [workspace, setWorkspace] = useState('channel');
  const [resourceOrigin, setResourceOrigin] = useState(null);
  const [channelResource, setChannelResource] = useState(null);
  const [channelRatingOverrides, setChannelRatingOverrides] = useState({});
  const [rag1ActivationRequest, setRag1ActivationRequest] = useState(null);

  // ---------- layout & responsiveness ----------
  const [channelSidebarOpen, setChannelSidebarOpen] = useState(true);
  const [mobilePanelView, setMobilePanelView] = useState('sidebar'); // 'sidebar' | 'chat'
  const [rightPanelOpen, setRightPanelOpen] = useState(false); // slide-over for tablet & mobile
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverActionModal, setServerActionModal] = useState(null); // 'create' | 'join' | null
  const [channelCreateFormOpen, setChannelCreateFormOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});

  // ---------- Chatter UI States ----------
  const [chatterTab, setChatterTab] = useState('feed'); // 'feed' | 'rooms' | 'guru' | 'chats' | 'profile'
  const [directMessagesModalOpen, setDirectMessagesModalOpen] = useState(false);
  const [userStatusModalOpen, setUserStatusModalOpen] = useState(false);
  const [userCurrentStatus, setUserCurrentStatus] = useState(null);
  const [audioSpaceModalOpen, setAudioSpaceModalOpen] = useState(false);
  const [userProfileModalTarget, setUserProfileModalTarget] = useState(null);

  // Shared following state synchronized across Feed, Profile Modal, and Profile View
  const [followingMap, setFollowingMap] = useState({ 'u-sarah': true });
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chatter_following_map');
      if (saved) setFollowingMap(JSON.parse(saved));
    } catch {}
  }, []);

  const handleToggleFollow = useCallback((authorId) => {
    setFollowingMap((prev) => {
      const nextState = !prev[authorId];
      const updated = { ...prev, [authorId]: nextState };
      try {
        localStorage.setItem('chatter_following_map', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const handleStartDM = useCallback((targetUser) => {
    const targetId = typeof targetUser === 'object' ? targetUser.id : targetUser;
    const targetName = typeof targetUser === 'object' ? targetUser.name : 'Study Partner';

    setUserProfileModalTarget(null);
    setActiveServerId(null);
    setActiveChannelId(targetId);
    setActiveChannelName(targetName);
    setActiveChannelType('dm');
    setChatterTab('chats');
  }, []);

  // Ensure mobile screens land on welcome panel
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setMobilePanelView('chat');
    }
  }, []);

  // Dismiss popup menus on route/channel changes
  useEffect(() => {
    dismissAllMenus();
  }, [activeServerId, activeChannelId, workspace, settingsOpen, pathname]);

  // Authentication Guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Show Toast Helper
  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  }, []);

  // ──────────────────────────────────────────────
  // 1. Fetch Servers
  // ──────────────────────────────────────────────
  // Track whether we've already done the initial auto-select so Home clicks
  // don't get overridden the next time fetchServers runs.
  const hasAutoSelectedRef = useRef(false);

  const fetchServers = useCallback(async () => {
    if (!user) return;
    setServersLoading(true);
    setServersError(null);

    try {
      const data = await apiRequest('/api/servers');
      const serverList = Array.isArray(data) ? data : (data?.servers || []);
      setServers(serverList);

      // Auto-select initial server and channel only on the very first load for desktop.
      // On mobile screens, user lands on the Welcome screen first ("Welcome back, {username}").
      if (serverList.length > 0 && !hasAutoSelectedRef.current) {
        hasAutoSelectedRef.current = true;
        const isMobileScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
        if (isMobileScreen) {
          setActiveServerId(null);
          setActiveChannelId(null);
          setActiveChannelName(null);
          setActiveChannelType(null);
          setMobilePanelView('chat');
        } else {
          const initialServer = serverList[0];
          setActiveServerId(initialServer.id);
          const serverChannels = initialServer.channels || [];
          setChannels(serverChannels);
          if (serverChannels.length > 0) {
            const textChannel = serverChannels.find((c) => c.type === 'text') || serverChannels[0];
            setActiveChannelId(textChannel.id);
            setActiveChannelName(textChannel.name);
            setActiveChannelType(textChannel.type || 'text');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load servers:', err);
      setServersError(err.message);
    } finally {
      setServersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchServers();
    }
  }, [status, fetchServers]);

  // ──────────────────────────────────────────────
  // 2. Fetch Channels for Active Server
  // ──────────────────────────────────────────────
  const fetchChannels = useCallback(async (serverId) => {
    if (!serverId) {
      setChannels([]);
      return;
    }
    setChannelsLoading(true);
    setChannelsError(null);

    try {
      const currentServer = servers.find((s) => s.id === serverId);
      if (currentServer?.channels && currentServer.channels.length > 0) {
        setChannels(currentServer.channels);
      } else {
        const srvData = await apiRequest(`/api/servers/${serverId}`);
        if (srvData?.channels) {
          setChannels(srvData.channels);
        }
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
      setChannelsError(err.message);
    } finally {
      setChannelsLoading(false);
    }
  }, [servers]);

  useEffect(() => {
    if (activeServerId) {
      fetchChannels(activeServerId);
    }
  }, [activeServerId, fetchChannels]);

  // ──────────────────────────────────────────────
  // 3. Fetch Members for Active Server
  // ──────────────────────────────────────────────
  const fetchMembers = useCallback(async (serverId) => {
    if (!serverId) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    setMembersError(null);

    try {
      const memberList = await apiRequest(`/api/servers/${serverId}/members`);
      setMembers(Array.isArray(memberList) ? memberList : []);
    } catch (err) {
      console.error('Failed to load members:', err);
      setMembersError(err.message);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeServerId) {
      fetchMembers(activeServerId);
    }
  }, [activeServerId, fetchMembers]);

  // ──────────────────────────────────────────────
  // 4. Server Actions
  // ──────────────────────────────────────────────
  const handleSelectServer = (serverId) => {
    setActiveServerId(serverId);
    setWorkspace('channel');
    setResourceOrigin(null);
    setChannelResource(null);
    setChannelRatingOverrides({});
    setChannelCreateFormOpen(false);
    setRightPanelOpen(false);

    // Home button passes null — clear everything and mark that the user
    // explicitly went home so fetchServers won't auto-select again.
    if (!serverId) {
      hasAutoSelectedRef.current = true; // keep the guard so re-fetches don't override
      setChannels([]);
      setActiveChannelId(null);
      setActiveChannelName(null);
      setActiveChannelType(null);
      setMobilePanelView('chat'); // on mobile, going Home shows the NeutralHomeState (Welcome back screen)
      return;
    }

    setMobilePanelView('sidebar');
    const srv = servers.find((s) => s.id === serverId);
    if (srv && srv.channels && srv.channels.length > 0) {
      setChannels(srv.channels);
      const textChannel = srv.channels.find((c) => c.type === 'text') || srv.channels[0];
      setActiveChannelId(textChannel.id);
      setActiveChannelName(textChannel.name);
      setActiveChannelType(textChannel.type || 'text');
      if (textChannel.type !== 'voice') {
        handleMarkChannelRead(textChannel.id);
      }
    } else {
      setActiveChannelId(null);
      setActiveChannelName(null);
      setActiveChannelType(null);
    }
  };

  const handleCreateServer = async (serverName) => {
    if (!user || !serverName.trim()) return;
    try {
      const newServer = await apiRequest('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name: serverName }),
      });
      await fetchServers();
      const srvId = newServer.id || newServer.server?.id;
      if (srvId) {
        setActiveServerId(srvId);
        setActiveChannelId(null);
        setActiveChannelName(null);
        setActiveChannelType(null);
        setWorkspace('channel');
      }
      showToast(`Created group "${serverName}"!`);
      return { success: true };
    } catch (err) {
      console.error('Server creation failed:', err);
      return { success: false, error: err.message };
    }
  };

  const handleJoinServer = async (inviteCode) => {
    if (!user || !inviteCode.trim()) return;
    try {
      const data = await apiRequest('/api/servers/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode.trim().toUpperCase() }),
      });
      await fetchServers();
      const srvId = data.server?.id || data.id;
      if (srvId) {
        setActiveServerId(srvId);
        setActiveChannelId(null);
        setActiveChannelName(null);
        setActiveChannelType(null);
        setWorkspace('channel');
      }
      showToast(`Joined "${data.server?.name || 'Group'}"!`);
      return { success: true, message: data.message };
    } catch (err) {
      console.error('Failed to join server:', err);
      return { success: false, error: err.message };
    }
  };

  // ──────────────────────────────────────────────
  // 5. Unread Message Management (Per-User & Auto-Mark As Read)
  // ──────────────────────────────────────────────
  const handleMarkChannelRead = useCallback(async (channelId) => {
    if (!channelId || !user?.id) return;

    // Immediately zero out locally for instant zero-latency UI response
    setUnreadCounts((prev) => {
      if (!prev[channelId]) return prev;
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
    clearStoredUnread(user.id, channelId);

    // Persist to backend per-user channel_reads
    try {
      await apiRequest(`/api/channels/${encodeURIComponent(channelId)}/read`, {
        method: 'POST',
      });
    } catch (e) {
      console.debug('Failed to sync channel read status:', e);
    }
  }, [user?.id]);

  // Load unread counts when server or active channel changes
  useEffect(() => {
    if (!activeServerId || !user?.id) {
      setUnreadCounts({});
      return;
    }
    let isMounted = true;

    const loadUnreadCounts = async () => {
      try {
        const data = await apiRequest(`/api/channels/unread-counts?serverId=${encodeURIComponent(activeServerId)}`);
        if (!isMounted) return;
        const counts = data?.unreadCounts || {};
        if (activeChannelId) {
          counts[activeChannelId] = 0;
          clearStoredUnread(user.id, activeChannelId);
        }
        setUnreadCounts(counts);
      } catch (err) {
        console.debug('Failed to load unread counts:', err);
      }
    };

    loadUnreadCounts();
    return () => {
      isMounted = false;
    };
  }, [activeServerId, activeChannelId, user?.id]);

  // Pusher Realtime subscription to server-wide messages for instant unread badge updates
  useEffect(() => {
    if (!activeServerId || !user?.id) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const serverChannelName = `server-${activeServerId}`;
    let chan = null;
    try {
      chan = pusher.subscribe(serverChannelName);
    } catch {
      return;
    }

    const handleServerNewMessage = (payload) => {
      const { channelId, userId: senderId } = payload || {};
      if (!channelId) return;

      // Never count current user's own sent messages as unread
      if (senderId === user.id) return;

      // If user is currently looking at this channel, auto-mark as read immediately
      if (
        channelId === activeChannelId &&
        workspace === 'channel' &&
        typeof document !== 'undefined' &&
        !document.hidden
      ) {
        handleMarkChannelRead(channelId);
        return;
      }

      // Otherwise increment unread count for this channel
      setUnreadCounts((prev) => {
        const nextCount = (prev[channelId] || 0) + 1;
        setStoredUnreadCount(user.id, channelId, nextCount);
        return {
          ...prev,
          [channelId]: nextCount,
        };
      });
    };

    chan.bind('server-new-message', handleServerNewMessage);

    return () => {
      try {
        chan.unbind('server-new-message', handleServerNewMessage);
        pusher.unsubscribe(serverChannelName);
      } catch {}
    };
  }, [activeServerId, activeChannelId, workspace, user?.id, handleMarkChannelRead]);

  // ──────────────────────────────────────────────
  // 6. Channel Actions
  // ──────────────────────────────────────────────
  const handleSelectChannel = (channelId, channelName, channelType) => {
    setChannelCreateFormOpen(false);
    setActiveChannelId(channelId);
    setActiveChannelName(channelName);
    setActiveChannelType(channelType || 'text');
    setWorkspace('channel');
    setResourceOrigin(null);
    setChannelResource(null);
    setMobilePanelView('chat');
    if (channelType !== 'voice') {
      handleMarkChannelRead(channelId);
    }
    // On mobile screens, keep right panel closed when entering chat
    if (window.innerWidth < 768) {
      setRightPanelOpen(false);
    }
  };

  const handleCreateChannel = async (channelName, channelType = 'text') => {
    if (!activeServerId || !channelName.trim()) return;
    try {
      const newChan = await apiRequest(`/api/servers/${activeServerId}/channels`, {
        method: 'POST',
        body: JSON.stringify({ name: channelName, type: channelType }),
      });
      setChannels((prev) => [...prev, newChan]);
      setServers((prev) => prev.map((s) => {
        if (s.id === activeServerId) {
          return { ...s, channels: [...(s.channels || []), newChan] };
        }
        return s;
      }));
      setActiveChannelId(newChan.id);
      setActiveChannelName(newChan.name);
      setActiveChannelType(newChan.type || 'text');
      setWorkspace('channel');
      setMobilePanelView('chat');
      showToast(`Created channel #${newChan.name}!`);
      return { success: true };
    } catch (err) {
      console.error('Failed to create channel:', err);
      return { success: false, error: err.message };
    }
  };

  const handleReorderChannel = useCallback(async (channelId, beforeChannelId, afterChannelId) => {
    if (!activeServerId) return { success: false, error: 'No active server selected.' };
    setChannels((currentChannels) => moveChannelLocally(
      currentChannels,
      channelId,
      beforeChannelId,
      afterChannelId
    ));
    return { success: true };
  }, [activeServerId]);

  // ──────────────────────────────────────────────
  // 6. Navigation & Workspace Handlers
  // ──────────────────────────────────────────────
  const handleOpenAdvancedSearch = () => {
    setWorkspace('advanced-search');
    setResourceOrigin(null);
    setChannelResource(null);
    setMobilePanelView('chat');
  };

  const handleOpenResource = () => {
    setWorkspace('resource');
    setResourceOrigin('advanced-search');
    setMobilePanelView('chat');
  };

  const handleOpenChannelResource = (resource) => {
    setChannelResource(resource);
    setResourceOrigin('channel');
    setWorkspace('resource');
    setMobilePanelView('chat');
  };

  const handleChannelRatingSummary = (summary) => {
    const rating = {
      average_rating: summary.average_rating,
      rating_count: summary.rating_count,
      current_user_rating: summary.current_user_rating,
    };
    setChannelResource((current) => (
      current?.resource_id === summary.resource_id
        ? { ...current, ...rating }
        : current
    ));
    setChannelRatingOverrides((current) => ({
      ...current,
      [summary.resource_id]: rating,
    }));
  };

  const handleBackToChannel = () => {
    setWorkspace('channel');
    setResourceOrigin(null);
    setChannelResource(null);
  };

  const handleRag1Activated = (activation) => {
    setRag1ActivationRequest({
      ...activation,
      requestId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    });
    setRightPanelOpen(true); // Open AI panel to show activation result
  };

  const handleOpenAiTab = (targetTab) => {
    setRag1ActivationRequest({
      targetTab,
      expandWorkspace: targetTab === 'chat' || true,
      requestId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    });
    setRightPanelOpen(true);
  };

  const handleShareAiToChannel = async (content) => {
    if (!activeChannelId || !content?.trim()) {
      showToast('Select a channel to share study material.');
      return;
    }
    try {
      await apiRequest(`/api/channels/${encodeURIComponent(activeChannelId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim(),
          attachments: [],
        }),
      });
      showToast(`Shared to #${activeChannelName || 'channel'}!`);
    } catch (err) {
      console.error('Failed to share to channel:', err);
      showToast(`Failed to share: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const refreshActiveServerData = useCallback(async () => {
    await Promise.all([
      fetchServers(),
      fetchMembers(activeServerId),
      fetchChannels(activeServerId),
    ]);
  }, [activeServerId, fetchChannels, fetchMembers, fetchServers]);

  const handleServerRemoved = useCallback((serverId) => {
    setServers((prev) => prev.filter((server) => server.id !== serverId));
    if (activeServerId === serverId) {
      setActiveServerId(null);
      setActiveChannelId(null);
      setActiveChannelName(null);
      setActiveChannelType(null);
      setWorkspace('channel');
      setResourceOrigin(null);
      setChannelResource(null);
      setChannelRatingOverrides({});
      leaveVoiceSession?.();
    }
  }, [activeServerId, leaveVoiceSession]);

  const handleLeaveServer = useCallback(async () => {
    if (!activeServerId) return { success: false, error: 'No server is selected.' };
    try {
      await leaveVoiceSession?.();
      await leaveServer(apiRequest, activeServerId);
      handleServerRemoved(activeServerId);
      showToast('You left the study space.');
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Could not leave server.' };
    }
  }, [activeServerId, handleServerRemoved, leaveVoiceSession, showToast]);

  // Derived Values
  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) || null,
    [servers, activeServerId]
  );
  const activeServerName = activeServer?.name || null;
  const activeServerDescription = activeServer?.description || null;
  const activeServerInviteCode = activeServer?.invite_code || null;
  const currentRole = useMemo(
    () => getCurrentMemberRole(members, user?.id) || activeServer?.role || 'member',
    [members, user?.id, activeServer]
  );

  const advancedSearchVisible = workspace === 'advanced-search'
    || (workspace === 'resource' && resourceOrigin === 'advanced-search');
  const channelResourceVisible = workspace === 'resource'
    && resourceOrigin === 'channel'
    && channelResource;

  const isJoinedInVoiceRoom = Boolean(
    activeChannelType === 'voice' &&
    voiceSession.joinedChannelId &&
    voiceSession.joinedChannelId === activeChannelId &&
    mobilePanelView === 'chat'
  );
  const activeVoiceChannelName = voiceSession?.joinedChannelName || activeChannelName;

  // Responsive Layout Classes
  const shellClasses = [
    'dashboard-shell',
    !channelSidebarOpen ? 'dashboard-shell--sidebar-collapsed' : '',
    mobilePanelView === 'chat' ? 'dashboard-shell--chat-active' : '',
    rightPanelOpen ? 'dashboard-shell--right-open' : '',
    isJoinedInVoiceRoom ? 'dashboard-shell--in-voice' : '',
  ]
    .filter(Boolean)
    .join(' ');



  return (
    <div className={shellClasses} id="dashboard-shell" suppressHydrationWarning>
      {/* ── Fixed Toast ── */}
      {toast && (
        <div className="toast" style={{ zIndex: 10000 }}>
          {toast}
        </div>
      )}

      {/* ── Desktop Left Navigation Rail (Chatter 5-Tab Bar) ── */}
      <ChatterSidebarNav
        activeTab={chatterTab}
        onSelectTab={(tab) => {
          if (tab !== 'chats') {
            setActiveChannelId(null);
          }
          setChatterTab(tab);
        }}
        profile={profile}
        unreadChatsCount={Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
        isJoinedInVoiceRoom={isJoinedInVoiceRoom}
        activeVoiceChannelName={activeVoiceChannelName}
        onLeaveVoice={leaveVoiceSession}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* ── Content View ── */}
      {/* If chatterTab === 'feed', render ChatterFeedView */}
      {chatterTab === 'feed' && (
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--chatter-black)', minHeight: '100vh' }}>
          <ChatterTopBar
            onOpenNotifications={() => showToast('No new notifications')}
            onOpenSearch={handleOpenAdvancedSearch}
            onOpenLiveSpaces={() => setChatterTab('rooms')}
            onRandomTopic={() => setChatterTab('rooms')}
          />
          <ChatterFeedView
            serverId={activeServerId}
            profile={profile}
            userId={user?.id}
            onOpenLiveSpaces={() => setChatterTab('rooms')}
            onStartDM={handleStartDM}
            followingMap={followingMap}
            onToggleFollow={handleToggleFollow}
          />
        </div>
      )}

      {/* If chatterTab === 'rooms', render ChatterRoomsView */}
      {chatterTab === 'rooms' && (
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--chatter-black)', minHeight: '100vh' }}>
          <ChatterTopBar
            onOpenNotifications={() => showToast('No new notifications')}
            onOpenSearch={handleOpenAdvancedSearch}
            onOpenLiveSpaces={() => setChatterTab('rooms')}
            onRandomTopic={() => setChatterTab('rooms')}
          />
          <ChatterRoomsView
            servers={servers}
            activeServerId={activeServerId}
            onSelectServer={(sId) => {
              handleSelectServer(sId);
              setChatterTab('chats');
            }}
            onCreateServer={() => setServerActionModal('create')}
            onJoinServer={() => setServerActionModal('join')}
            onJoinVoiceChannel={(sId, cId, cName) => {
              setActiveServerId(sId);
              setActiveChannelId(cId);
              setActiveChannelName(cName);
              setActiveChannelType('voice');
              setAudioSpaceModalOpen(true);
              voiceSession?.handleJoin?.(sId, cId, cName);
            }}
            isJoinedInVoiceRoom={isJoinedInVoiceRoom}
            activeVoiceChannelName={activeVoiceChannelName}
          />
        </div>
      )}

      {/* If chatterTab === 'guru', render ChatterGuruView */}
      {chatterTab === 'guru' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--chatter-black)' }}>
          <ChatterTopBar
            onOpenNotifications={() => showToast('No new notifications')}
            onOpenSearch={handleOpenAdvancedSearch}
            onOpenLiveSpaces={() => setChatterTab('rooms')}
            onRandomTopic={() => setChatterTab('rooms')}
          />
          <ChatterGuruView
            channelName={activeChannelName}
            serverId={activeServerId}
          />
        </div>
      )}

      {/* If chatterTab === 'profile', render ChatterProfileView */}
      {chatterTab === 'profile' && (
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--chatter-black)', minHeight: '100vh' }}>
          <ChatterTopBar
            onOpenNotifications={() => showToast('No new notifications')}
            onOpenSearch={handleOpenAdvancedSearch}
            onOpenLiveSpaces={() => setChatterTab('rooms')}
            onRandomTopic={() => setChatterTab('rooms')}
          />
          <ChatterProfileView
            profile={profile}
            onLogout={handleLogout}
            onOpenStatusModal={() => setUserStatusModalOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            followingMap={followingMap}
          />
        </div>
      )}

      {/* If chatterTab === 'chats' */}
      {chatterTab === 'chats' && (
        <div style={{ flex: 1, display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--chatter-black)' }}>
          {/* Left conversations list pane */}
          <div className={`chatter-chats-list-pane ${activeChannelId ? 'chatter-chats-list-pane--with-active' : ''}`}>
            <ChatterTopBar
              onOpenNotifications={() => showToast('No new notifications')}
              onOpenSearch={handleOpenAdvancedSearch}
              onOpenLiveSpaces={() => setChatterTab('rooms')}
              onRandomTopic={() => setChatterTab('rooms')}
            />
            <ChatterChatsView
              servers={servers}
              activeServerId={activeServerId}
              activeChannelId={activeChannelId}
              onSelectChannel={(sId, cId, cName, cType) => {
                setActiveServerId(sId);
                setActiveChannelId(cId);
                setActiveChannelName(cName);
                setActiveChannelType(cType || 'text');
              }}
              onOpenDMsModal={() => setDirectMessagesModalOpen(true)}
              unreadCounts={unreadCounts}
              user={user}
            />
          </div>

          {/* Right active chat room pane (Desktop) or Full View (Mobile) */}
          {activeChannelId ? (
            <div className="chatter-chat-room-pane">
              <ChatterChatRoom
                channelId={activeChannelId}
                channelName={activeChannelName}
                serverId={activeServerId}
                serverName={activeServerName}
                userId={user?.id}
                profile={profile}
                onBack={() => setActiveChannelId(null)}
                onStartAudioCall={() => {
                  setAudioSpaceModalOpen(true);
                  if (activeChannelType === 'voice') {
                    voiceSession?.handleJoin?.(activeServerId, activeChannelId, activeChannelName);
                  }
                }}
                onStartVideoCall={() => {
                  setAudioSpaceModalOpen(true);
                  if (activeChannelType === 'voice') {
                    voiceSession?.handleJoin?.(activeServerId, activeChannelId, activeChannelName);
                  }
                  voiceSession?.toggleCamera?.();
                }}
              />
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'none',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 12,
                color: 'var(--chatter-light-text)',
                background: '#0E0E0E',
              }}
              className="chatter-desktop-empty-chat"
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 22,
                  background: 'rgba(64, 227, 120, 0.12)',
                  color: 'var(--chatter-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                }}
              >
                💬
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
                Select a Study Conversation
              </h3>
              <p style={{ fontSize: 13, color: 'var(--chatter-light-text)', margin: 0 }}>
                Choose a direct message or study channel to begin collaborating.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Chatter Audio & Video Space Modal ── */}
      {(audioSpaceModalOpen || isJoinedInVoiceRoom) && (
        <ChatterAudioSpaceModal
          voiceSession={voiceSession}
          channelName={activeVoiceChannelName || activeChannelName}
          serverName={activeServerName}
          onClose={() => setAudioSpaceModalOpen(false)}
          userId={user?.id}
          profile={profile}
        />
      )}

      {/* ── Chatter User Profile View Modal ── */}
      {userProfileModalTarget && (
        <ChatterUserProfileModal
          targetUser={userProfileModalTarget}
          currentUserId={user?.id}
          onClose={() => setUserProfileModalTarget(null)}
          onStartDM={handleStartDM}
          followingMap={followingMap}
          onToggleFollow={handleToggleFollow}
        />
      )}

      {/* ── Mobile 5-Tab Navigation Bar (Exact Chatter App TabBarScreen) ── */}
      {/* Hide bottom navigation when inside active chat room so compose input is never obscured */}
      {!(chatterTab === 'chats' && activeChannelId) && (
        <ChatterBottomNav
          activeTab={chatterTab}
          onSelectTab={(tab) => {
            setActiveChannelId(null);
            setChatterTab(tab);
          }}
          unreadChatsCount={Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
        />
      )}

      {/* ── Modals: Settings, DMs, User Status ── */}
      {settingsOpen && activeServer && (
        <ServerSettingsModal
          server={activeServer}
          members={members}
          currentUserId={user?.id}
          currentRole={currentRole}
          onClose={() => setSettingsOpen(false)}
          onRefresh={refreshActiveServerData}
          onServerRemoved={handleServerRemoved}
          notify={showToast}
        />
      )}

      {directMessagesModalOpen && (
        <DirectMessagesModal
          currentUserId={user?.id}
          onClose={() => setDirectMessagesModalOpen(false)}
        />
      )}

      {userStatusModalOpen && (
        <UserStatusModal
          currentStatus={userCurrentStatus}
          onClose={() => setUserStatusModalOpen(false)}
          onStatusUpdated={(newStatus) => {
            setUserCurrentStatus(newStatus);
            showToast('Study status updated!');
          }}
        />
      )}
    </div>
  );
}
