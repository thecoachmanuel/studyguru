'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import ServerSidebar from '@/components/ServerSidebar';
import ChannelSidebar from '@/components/ChannelSidebar';
import MainPanel from '@/components/MainPanel';
import AdvancedSearchPanel from '@/components/AdvancedSearchPanel';
import ResourceWorkspacePanel from '@/components/ResourceWorkspacePanel';
import VoicePanel from '@/components/VoicePanel';
import RightPanel from '@/components/RightPanel';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import ServerSettingsModal from '@/components/ServerSettingsModal';
import { apiRequest } from '@/lib/api';
import { getCurrentMemberRole } from '@/lib/permissions';
import { leaveServer } from '@/lib/lifecycleApi';
import { dismissAllMenus } from '@/hooks/useDismissableMenu';
import StudyGuruLogo from '@/components/StudyGuruLogo';
import ChatbotIcon from '@/components/ChatbotIcon';

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
  // 5. Channel Actions
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

      {/* ── 1. Server Sidebar (Far Left) ── */}
      <ServerSidebar
        servers={servers}
        serversLoading={serversLoading}
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        onCreateServer={handleCreateServer}
        onJoinServer={handleJoinServer}
        createModalOpen={serverActionModal === 'create'}
        onCreateModalOpenChange={(open) => setServerActionModal(open ? 'create' : null)}
        joinModalOpen={serverActionModal === 'join'}
        onJoinModalOpenChange={(open) => setServerActionModal(open ? 'join' : null)}
      />

      {/* ── 2. Channel Sidebar (Middle Left) ── */}
      <ChannelSidebar
        serverId={activeServerId}
        serverName={activeServerName}
        serverDescription={activeServerDescription}
        channels={channels}
        channelsLoading={channelsLoading}
        channelsError={channelsError}
        activeChannelId={activeChannelId}
        onSelectChannel={handleSelectChannel}
        onCreateChannel={handleCreateChannel}
        onReorderChannel={handleReorderChannel}
        voiceSession={voiceSession}
        currentRole={currentRole}
        onOpenSettings={() => setSettingsOpen(true)}
        onLeaveServer={handleLeaveServer}
        workspace={workspace}
        onOpenAdvancedSearch={handleOpenAdvancedSearch}
        createFormOpen={channelCreateFormOpen}
        onCreateFormOpenChange={setChannelCreateFormOpen}
      />

      {/* ── 3. Central Workspace Panel ── */}
      {advancedSearchVisible ? (
        <AdvancedSearchPanel
          key={activeServerId || 'search'}
          serverId={activeServerId}
          serverName={activeServerName}
          userEmail={user?.email}
          profile={profile}
          onLogout={handleLogout}
          channelSidebarOpen={channelSidebarOpen}
          onToggleChannelSidebar={() => setChannelSidebarOpen((p) => !p)}
          onMobileBack={() => setMobilePanelView('sidebar')}
          workspace={workspace}
          onOpenResource={handleOpenResource}
          onBackToSearch={() => {
            setWorkspace('advanced-search');
            setResourceOrigin(null);
          }}
          onRag1Activated={handleRag1Activated}
          onToggleRightPanel={() => setRightPanelOpen((p) => !p)}
          rightPanelOpen={rightPanelOpen}
        />
      ) : activeChannelType === 'voice' ? (
        <VoicePanel
          channelId={activeChannelId}
          channelName={activeChannelName}
          serverName={activeServerName}
          activeServerId={activeServerId}
          userId={user?.id}
          profile={profile}
          onMobileBack={() => setMobilePanelView('sidebar')}
          voiceSession={voiceSession}
          onToggleRightPanel={() => setRightPanelOpen((p) => !p)}
          rightPanelOpen={rightPanelOpen}
          onRag1Activated={handleRag1Activated}
          onOpenAiTab={handleOpenAiTab}
        />
      ) : (
        <>
          {channelResourceVisible && (
            <ResourceWorkspacePanel
              key="channel-resource-workspace"
              resource={channelResource}
              serverName={activeServerName}
              userEmail={user?.email}
              profile={profile}
              onLogout={handleLogout}
              channelSidebarOpen={channelSidebarOpen}
              onToggleChannelSidebar={() => setChannelSidebarOpen((p) => !p)}
              onMobileBack={() => setMobilePanelView('sidebar')}
              onBack={handleBackToChannel}
              backLabel={`Back to #${activeChannelName || 'channel'}`}
              onRatingSummary={handleChannelRatingSummary}
              onRag1Activated={handleRag1Activated}
            />
          )}
          <div
            key="channel-main-panel"
            className={[
              'dashboard-preserved-channel',
              channelResourceVisible ? 'dashboard-preserved-channel--hidden' : '',
            ].filter(Boolean).join(' ')}
          >
            <MainPanel
              serverName={activeServerName}
              server={activeServer}
              channelName={activeChannelName}
              channelType={activeChannelType}
              channelId={activeChannelId}
              userEmail={user?.email}
              profile={profile}
              onLogout={handleLogout}
              channelSidebarOpen={channelSidebarOpen}
              onToggleChannelSidebar={() => setChannelSidebarOpen((p) => !p)}
              onMobileBack={() => setMobilePanelView('sidebar')}
              activeServerId={activeServerId}
              userId={user?.id}
              currentRole={currentRole}
              onOpenResource={handleOpenChannelResource}
              resourceRatingOverrides={channelRatingOverrides}
              onCreateServerRequest={() => setServerActionModal('create')}
              onJoinServerRequest={() => setServerActionModal('join')}
              onCreateChannelRequest={() => setChannelCreateFormOpen(true)}
              onToggleRightPanel={() => setRightPanelOpen((p) => !p)}
              rightPanelOpen={rightPanelOpen}
              onRag1Activated={handleRag1Activated}
              onOpenAiTab={handleOpenAiTab}
            />
          </div>
        </>
      )}

      {/* ── 4. Right Panel Backdrop (Tablet & Mobile Slide-Over) ── */}
      {rightPanelOpen && (
        <div
          className="right-panel-backdrop"
          onClick={() => setRightPanelOpen(false)}
          aria-label="Close AI Study Panel"
        />
      )}

      {/* ── 5. Right Panel (AI Study Guru & Server Members) ── */}
      <RightPanel
        key={user?.id || 'anonymous'}
        activeServerId={activeServerId}
        activeChannelId={activeChannelId}
        activeChannelName={activeChannelName}
        serverInviteCode={activeServerInviteCode}
        userId={user?.id}
        members={members}
        membersLoading={membersLoading}
        profile={profile}
        currentRole={currentRole}
        onOpenSettings={() => setSettingsOpen(true)}
        rag1ActivationRequest={rag1ActivationRequest}
        onClose={() => setRightPanelOpen(false)}
        onShareToChannel={handleShareAiToChannel}
      />

      {/* ── 6. Cogni-style Mobile Bottom Navigation Bar (≤ 768px) ── */}
      {!isJoinedInVoiceRoom && (
        <nav className="cogni-mobile-nav" aria-label="StudyGuru Mobile Navigation" suppressHydrationWarning>
          <button
            type="button"
            className={`cogni-mobile-nav__item ${mobilePanelView === 'sidebar' && !rightPanelOpen ? 'cogni-mobile-nav__item--active' : ''}`}
            onClick={() => {
              setMobilePanelView('sidebar');
              setRightPanelOpen(false);
            }}
            aria-label="Study Groups"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Groups</span>
          </button>

          <button
            type="button"
            className={`cogni-mobile-nav__item ${mobilePanelView === 'chat' && !rightPanelOpen ? 'cogni-mobile-nav__item--active' : ''}`}
            onClick={() => {
              setMobilePanelView('chat');
              setRightPanelOpen(false);
            }}
            aria-label={activeServerId ? 'Current Channel Chat' : 'Home'}
          >
            {activeServerId ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            )}
            <span>{activeServerId ? 'Chat' : 'Home'}</span>
          </button>

          <button
            type="button"
            className={`cogni-mobile-nav__item cogni-mobile-nav__item--ai ${rightPanelOpen ? 'cogni-mobile-nav__item--active' : ''}`}
            onClick={() => setRightPanelOpen((prev) => !prev)}
            aria-label="AI Study Guru Assistant"
          >
            <ChatbotIcon size={20} />
            <span>AI Guru</span>
          </button>

          <button
            type="button"
            className="cogni-mobile-nav__item"
            onClick={() => router.push('/profile')}
            aria-label="Profile Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Profile</span>
          </button>
        </nav>
      )}

      {/* ── 7. Server Settings Modal ── */}
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
    </div>
  );
}
