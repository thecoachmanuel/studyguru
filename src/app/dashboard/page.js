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
import ChatterQuizArenaView from '@/components/chatter/ChatterQuizArenaView';
import DirectMessagesModal from '@/components/DirectMessagesModal';
import UserStatusModal from '@/components/UserStatusModal';
import ChatterChatRoom from '@/components/chatter/ChatterChatRoom';
import ChatterAudioSpaceModal from '@/components/chatter/ChatterAudioSpaceModal';
import ChatterFloatingCallBar from '@/components/chatter/ChatterFloatingCallBar';
import ChatterNotificationsModal from '@/components/chatter/ChatterNotificationsModal';
import ChatterUserProfileModal from '@/components/chatter/ChatterUserProfileModal';
import ChatterSearchModal from '@/components/chatter/ChatterSearchModal';
import ChatterNewDMSheet from '@/components/chatter/ChatterNewDMSheet';
import ChatterRoomActionModal from '@/components/chatter/ChatterRoomActionModal';
import ChatterRightSidebar from '@/components/chatter/ChatterRightSidebar';
import GuestAuthModal from '@/components/chatter/GuestAuthModal';
import { playMessageChime, startCallRingtone, stopCallRingtone, playSpaceTone } from '@/lib/audioNotification';

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

  // ---------- live db profile to prevent flickering ----------
  const [dbProfile, setDbProfile] = useState(null);

  // ---------- Guest Mode State (Elite Quiz Flow) ----------
  const [isGuest, setIsGuest] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authPromptFeature, setAuthPromptFeature] = useState('access this feature');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isGuestParam = urlParams.get('guest') === '1';
      const isGuestStored = sessionStorage.getItem('studycord_guest') === '1' || localStorage.getItem('studycord_guest') === '1';
      if ((isGuestParam || isGuestStored) && status === 'unauthenticated') {
        setIsGuest(true);
      }
    }
  }, [status]);

  const requireAuth = useCallback((featureName = 'access this feature') => {
    if (isGuest || !user) {
      setAuthPromptFeature(featureName);
      setAuthPromptOpen(true);
      return true;
    }
    return false;
  }, [isGuest, user]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    fetch('/api/user/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && !data.error) {
          setDbProfile(data);
        }
      })
      .catch(() => {});

    const handleProfileUpdated = (e) => {
      if (e?.detail) {
        setDbProfile((prev) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('studycord_profile_updated', handleProfileUpdated);

    return () => {
      active = false;
      window.removeEventListener('studycord_profile_updated', handleProfileUpdated);
    };
  }, [user?.id]);

  // Dynamic Viewport Height Normalizer (--app-height) to prevent mobile browser jumps
  useEffect(() => {
    const updateAppHeight = () => {
      if (typeof window !== 'undefined') {
        const vh = window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${vh}px`);
      }
    };
    updateAppHeight();

    // Prevent iOS Safari page-level scroll displacement that causes bottom nav to float upwards
    const handleScrollOrBlur = () => {
      if (typeof window !== 'undefined' && window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('resize', updateAppHeight, { passive: true });
    window.addEventListener('orientationchange', updateAppHeight, { passive: true });
    window.addEventListener('scroll', handleScrollOrBlur, { passive: true });
    window.addEventListener('focusout', handleScrollOrBlur);

    return () => {
      window.removeEventListener('resize', updateAppHeight);
      window.removeEventListener('orientationchange', updateAppHeight);
      window.removeEventListener('scroll', handleScrollOrBlur);
      window.removeEventListener('focusout', handleScrollOrBlur);
    };
  }, []);

  // ---------- profile ----------
  const profile = useMemo(() => {
    if (isGuest && !user) {
      return {
        id: 'guest_user',
        name: 'Guest Scholar',
        username: 'guest',
        full_name: 'Guest Scholar',
        email: 'guest@studycord.me',
        avatar_url: null,
        banner_url: null,
        bio: 'Exploring StudyCord & Quiz Arena as a Guest Scholar.',
        followers_count: 0,
        following_count: 0,
        study_hours: 0,
        day_streak: 1,
        coins: 100,
        badges: ['Curious Explorer'],
        isGuest: true,
        loaded: true,
      };
    }
    if (!user) return null;
    return {
      id: user.id,
      name: dbProfile?.name || user.name || user.email?.split('@')[0] || 'Study Partner',
      username: dbProfile?.username || user.name || user.email?.split('@')[0] || 'Study Partner',
      full_name: dbProfile?.name || user.name || user.email?.split('@')[0] || 'Study Partner',
      email: dbProfile?.email || user.email,
      avatar_url: dbProfile?.avatar_url || user.image || null,
      banner_url: dbProfile?.banner_url || null,
      bio: dbProfile ? (dbProfile.bio || '') : undefined,
      followers_count: typeof dbProfile?.followers_count === 'number' ? dbProfile.followers_count : undefined,
      following_count: typeof dbProfile?.following_count === 'number' ? dbProfile.following_count : undefined,
      study_hours: typeof dbProfile?.study_hours === 'number' ? dbProfile.study_hours : undefined,
      day_streak: typeof dbProfile?.day_streak === 'number' ? dbProfile.day_streak : undefined,
      loaded: Boolean(dbProfile),
    };
  }, [user, dbProfile, isGuest]);

  const voiceSession = useVoiceSession(user?.id, profile);
  const { handleLeave: leaveVoiceSession } = voiceSession;

  // ---------- servers ----------
  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(false);
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

  // ---------- Chatter UI States with Refresh Persistence ----------
  const [chatterTab, setChatterTabState] = useState('feed'); // 'feed' | 'rooms' | 'guru' | 'chats' | 'profile'
  const [guruNavHidden, setGuruNavHidden] = useState(false);

  const setChatterTab = useCallback((tab) => {
    setChatterTabState(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('studycord_active_tab', tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.replaceState(null, '', url.pathname + url.search);
      } catch {}
    }
  }, []);

  // Restore active tab on initial mount / page refresh so user lands on same screen
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab && ['feed', 'rooms', 'guru', 'chats', 'profile'].includes(urlTab)) {
        setChatterTabState(urlTab);
      } else {
        const savedTab = localStorage.getItem('studycord_active_tab');
        if (savedTab && ['feed', 'rooms', 'guru', 'chats', 'profile'].includes(savedTab)) {
          setChatterTabState(savedTab);
        }
      }
    } catch {}
  }, []);
  const [directMessagesModalOpen, setDirectMessagesModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [newDMSheetOpen, setNewDMSheetOpen] = useState(false);
  const [userStatusModalOpen, setUserStatusModalOpen] = useState(false);
  const [userCurrentStatus, setUserCurrentStatus] = useState(null);
  const [audioSpaceModalOpen, setAudioSpaceModalOpen] = useState(false);
  const [incomingCallAlert, setIncomingCallAlert] = useState(null);
  const [userProfileModalTarget, setUserProfileModalTarget] = useState(null);
  const [targetPostId, setTargetPostId] = useState(null);
  const [filterTag, setFilterTag] = useState(null);
  const [activePartnerUser, setActivePartnerUser] = useState(null);
  const [feedTab, setFeedTab] = useState('forYou');
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [activeLiveSpaces, setActiveLiveSpaces] = useState([]);
  const [notificationsList, setNotificationsList] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchNotificationsData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setActiveLiveSpaces(data.activeSpaces || []);
        setNotificationsList(data.notifications || []);
        setUnreadNotificationsCount(data.unreadCount || 0);
      }
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    fetchNotificationsData();
    const interval = setInterval(fetchNotificationsData, 8000);
    return () => clearInterval(interval);
  }, [fetchNotificationsData]);

  // Shared following state synchronized across Feed, Profile Modal, and Profile View
  const [followingMap, setFollowingMap] = useState({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chatter_following_map');
      if (saved) setFollowingMap(JSON.parse(saved));
    } catch {}
    if (user?.id) {
      fetch('/api/user/follow')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.following && Array.isArray(data.following)) {
            const map = {};
            data.following.forEach((fId) => {
              map[fId] = true;
            });
            setFollowingMap((prev) => ({ ...prev, ...map }));
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const handleToggleFollow = useCallback(
    async (authorId) => {
      if (!authorId || !user?.id) return;
      setFollowingMap((prev) => {
        const nextState = !prev[authorId];
        const updated = { ...prev, [authorId]: nextState };
        try {
          localStorage.setItem('chatter_following_map', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      try {
        const res = await fetch('/api/user/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_user_id: authorId }),
        });
        const data = await res.json();
        if (data && typeof data.is_following === 'boolean') {
          setFollowingMap((prev) => ({
            ...prev,
            [authorId]: data.is_following,
          }));
        }
      } catch (err) {
        console.warn('Failed to sync follow state:', err);
      }
    },
    [user?.id]
  );

  const handleStartDM = useCallback(
    async (targetUser) => {
      const targetId = typeof targetUser === 'object' ? (targetUser.user_id || targetUser.id) : targetUser;
      const targetName = typeof targetUser === 'object' ? (targetUser.name || targetUser.username || 'Study Partner') : 'Study Partner';

      setUserProfileModalTarget(null);
      setActiveServerId(null);
      setActiveChannelType('dm');
      setActiveChannelName(targetName);
      setChatterTab('chats');

      // Clear unread count for this user/channel immediately
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });

      // If targetUser already provided a conversation id
      if (typeof targetUser === 'object' && targetUser.conversation_id) {
        setActiveChannelId(targetUser.conversation_id);
        fetch(`/api/conversations/${encodeURIComponent(targetUser.conversation_id)}/read`, { method: 'POST' }).catch(() => {});
        return;
      }

      // Initialize or fetch conversation with recipient
      try {
        const res = await apiRequest('/api/conversations', {
          method: 'POST',
          body: JSON.stringify({ recipient_id: targetId }),
        });
        if (res?.id) {
          setActiveChannelId(res.id);
          if (res.other_user?.name) {
            setActiveChannelName(res.other_user.name);
          }
          fetch(`/api/conversations/${encodeURIComponent(res.id)}/read`, { method: 'POST' }).catch(() => {});
          return;
        }
      } catch (err) {
        console.warn('Conversation init fallback:', err);
      }

      setActiveChannelId(targetId);
    },
    []
  );

  // Ensure mobile screens land on welcome panel
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setMobilePanelView('chat');
    }
  }, []);

  // Handle ?tab=... and ?joinRoom=... URL parameters seamlessly
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && ['feed', 'rooms', 'guru', 'chats', 'profile'].includes(tabParam)) {
        setChatterTab(tabParam);
      }
      const joinCode = urlParams.get('joinRoom');
      if (joinCode) {
        apiRequest('/api/servers/join', {
          method: 'POST',
          body: JSON.stringify({ invite_code: joinCode, code: joinCode }),
        })
          .then((res) => {
            const srv = res?.server || res;
            if (srv?.id) {
              fetchServers().then(() => {
                handleSelectServer(srv.id);
                setChatterTab('chats');
              });
              setToast(`Joined room "${srv.name || 'Study Room'}"!`);
            }
          })
          .catch((err) => {
            console.warn('Auto-join room warning:', err);
          });
      }
    } catch {}
  }, []);

  // Dismiss popup menus on route/channel changes
  useEffect(() => {
    dismissAllMenus();
  }, [activeServerId, activeChannelId, workspace, settingsOpen, pathname]);

  // Authentication Guard: Allow Guest Mode or redirect unauthenticated users
  useEffect(() => {
    if (status === 'unauthenticated') {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const isGuestUser = urlParams.get('guest') === '1' || sessionStorage.getItem('studycord_guest') === '1' || localStorage.getItem('studycord_guest') === '1';
        if (isGuestUser) {
          setIsGuest(true);
          return;
        }
      }
      const joinParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('joinRoom') : null;
      if (joinParam) {
        router.push(`/login?joinRoom=${encodeURIComponent(joinParam)}`);
      } else {
        router.push('/login');
      }
    } else if (status === 'authenticated') {
      setIsGuest(false);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('studycord_guest');
        localStorage.removeItem('studycord_guest');
      }
    }
  }, [status, router]);

  // Show Toast Helper (Faster 2.2s auto-dismiss + deduplication)
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message) => {
    if (!message) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2200);
  }, []);

  // Listen to studycord_toast window events
  useEffect(() => {
    const handleCustomToast = (e) => {
      const msg = typeof e.detail === 'string' ? e.detail : e.detail?.message;
      if (msg) showToast(msg);
    };
    window.addEventListener('studycord_toast', handleCustomToast);
    return () => window.removeEventListener('studycord_toast', handleCustomToast);
  }, [showToast]);

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

  // Real-time synchronization for study rooms across devices
  useEffect(() => {
    if (status !== 'authenticated') return;
    const pusher = getPusherClient();
    if (!pusher) return;

    let channel = null;
    try {
      channel = pusher.subscribe('rooms-global');
      channel.bind('room-created', () => {
        fetchServers();
      });
      channel.bind('room-joined', (data) => {
        if (data?.userId === user?.id) {
          fetchServers();
        }
      });
      channel.bind('room-left', (data) => {
        if (data?.userId === user?.id) {
          fetchServers();
        }
      });
      channel.bind('room-deleted', ({ serverId }) => {
        setServers((prev) => prev.filter((s) => s.id !== serverId));
        if (activeServerId === serverId) {
          setActiveServerId(null);
          setActiveChannelId(null);
        }
      });
    } catch (err) {
      console.warn('Pusher rooms-global error:', err);
    }

    return () => {
      if (pusher && channel) {
        try {
          channel.unbind_all();
          pusher.unsubscribe('rooms-global');
        } catch {}
      }
    };
  }, [status, user?.id, fetchServers, activeServerId]);

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
      hasAutoSelectedRef.current = true;
      setChannels([]);
      setActiveChannelId(null);
      setActiveChannelName(null);
      setActiveChannelType(null);
      setMobilePanelView('chat');
      return;
    }

    setMobilePanelView('sidebar');
    const srv = servers.find((s) => s.id === serverId || s._id === serverId);
    let serverChannels = (srv && Array.isArray(srv.channels) && srv.channels.length > 0)
      ? srv.channels
      : [
          { id: `ch-${serverId}-general`, server_id: serverId, name: 'general', type: 'text', position: 0 },
          { id: `ch-${serverId}-resources`, server_id: serverId, name: 'study-lounge', type: 'text', position: 1 },
        ];

    setChannels(serverChannels);
    const textChannel = serverChannels.find((c) => c.type === 'text') || serverChannels[0];
    if (textChannel) {
      setActiveChannelId(textChannel.id);
      setActiveChannelName(textChannel.name);
      setActiveChannelType(textChannel.type || 'text');
    }

    // Always fetch fresh channels asynchronously and bind to real channel
    apiRequest(`/api/servers/${serverId}/channels`)
      .then((freshChannels) => {
        if (Array.isArray(freshChannels) && freshChannels.length > 0) {
          setChannels(freshChannels);
          const stillValid = textChannel?.id && !textChannel.id.startsWith('ch-') && freshChannels.find((c) => c.id === textChannel.id);
          if (!stillValid) {
            const first = freshChannels.find((c) => c.type === 'text') || freshChannels[0];
            if (first) {
              setActiveChannelId(first.id);
              setActiveChannelName(first.name);
              setActiveChannelType(first.type || 'text');
            }
          }
        }
      })
      .catch(() => {});
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

    // Persist to backend
    try {
      if (activeChannelType === 'dm') {
        await fetch(`/api/conversations/${encodeURIComponent(channelId)}/read`, {
          method: 'POST',
        });
      } else {
        await apiRequest(`/api/channels/${encodeURIComponent(channelId)}/read`, {
          method: 'POST',
        });
      }
    } catch (e) {
      console.debug('Failed to sync read status:', e);
    }
  }, [user?.id, activeChannelType]);

  // Auto-mark room / channel messages as read whenever entering active conversation or room
  useEffect(() => {
    if (activeChannelId) {
      handleMarkChannelRead(activeChannelId);
    }
  }, [activeChannelId, handleMarkChannelRead]);

  // Load unread counts across channels and direct messages
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    const loadAllUnreadCounts = async () => {
      try {
        const nextCounts = {};

        // 1. Fetch conversations unread counts
        try {
          const convRes = await fetch('/api/conversations');
          if (convRes.ok) {
            const convs = await convRes.json();
            if (Array.isArray(convs)) {
              convs.forEach((c) => {
                if (c.unread_count > 0 && c.id !== activeChannelId) {
                  nextCounts[c.id] = c.unread_count;
                }
              });
            }
          }
        } catch {}

        // 2. Fetch server channel unread counts if a server is active
        if (activeServerId) {
          try {
            const data = await apiRequest(`/api/channels/unread-counts?serverId=${encodeURIComponent(activeServerId)}`);
            const serverCounts = data?.unreadCounts || {};
            Object.entries(serverCounts).forEach(([cId, count]) => {
              if (cId !== activeChannelId && count > 0) {
                nextCounts[cId] = count;
              }
            });
          } catch {}
        }

        if (isMounted) {
          setUnreadCounts((prev) => {
            const merged = { ...prev, ...nextCounts };
            if (activeChannelId) {
              merged[activeChannelId] = 0;
              clearStoredUnread(user.id, activeChannelId);
            }
            return merged;
          });
        }
      } catch (err) {
        console.debug('Failed to load unread counts:', err);
      }
    };

    loadAllUnreadCounts();
    return () => {
      isMounted = false;
    };
  }, [activeServerId, activeChannelId, user?.id]);

  // User-specific Pusher subscription for incoming direct messages, notifications, and real-time follow updates
  useEffect(() => {
    if (!user?.id) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const userChannelName = `user-${user.id}`;
    let uChan = null;
    try {
      uChan = pusher.subscribe(userChannelName);
    } catch {
      return;
    }

    const handleNewDirectMessage = (payload) => {
      const convId = payload?.conversation_id || payload?.id;
      if (!convId) return;

      // Play pleasant Web Audio synthesized message chime
      playMessageChime();

      // If user is currently in this conversation, auto-mark as read
      if (convId === activeChannelId && typeof document !== 'undefined' && !document.hidden) {
        handleMarkChannelRead(convId);
        return;
      }

      // Otherwise increment unread count
      setUnreadCounts((prev) => {
        const nextVal = (prev[convId] || 0) + 1;
        return { ...prev, [convId]: nextVal };
      });

      const senderName = payload.profiles?.name || payload.sender_name || 'Study Partner';
      showToast(`💬 New message from ${senderName}`);
    };

    const handleIncomingCall = (payload) => {
      if (!payload) return;
      const callerName = payload.caller?.full_name || payload.caller?.username || 'Study Partner';
      startCallRingtone(15000);
      setIncomingCallAlert({
        channelId: payload.channelId || payload.conversationId,
        caller: payload.caller,
        callType: payload.callType || 'audio',
      });
      showToast(`📞 Incoming call from ${callerName}`);
    };

    const handleSpaceStarted = (payload) => {
      if (!payload) return;
      if (String(payload.caller?.id) === String(user.id)) return;
      playSpaceTone();
      const callerName = payload.caller?.full_name || payload.caller?.username || payload.caller?.name || 'A classmate';
      const roomName = payload.serverName || payload.channelName || servers.find((s) => String(s.id) === String(payload.serverId))?.name || 'Study Room';
      showToast(`🎙️ ${callerName} started a live space in ${roomName}!`);
    };

    const handleFollowChanged = (payload) => {
      if (!payload) return;
      if (String(payload.following_id) === String(user.id)) {
        showToast(payload.is_following ? `🌟 ${payload.follower_name || 'A scholar'} followed you!` : `👤 ${payload.follower_name || 'A scholar'} unfollowed you.`);
        // Refresh db profile to sync real-time followers_count
        fetch('/api/user/profile')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && !d.error) setDbProfile(d);
          })
          .catch(() => {});
      } else if (String(payload.follower_id) === String(user.id)) {
        setFollowingMap((prev) => ({
          ...prev,
          [payload.following_id]: payload.is_following,
        }));
      }
    };

    uChan.bind('new-direct-message', handleNewDirectMessage);
    uChan.bind('incoming-call', handleIncomingCall);
    uChan.bind('space-started', handleSpaceStarted);
    uChan.bind('follow-changed', handleFollowChanged);

    return () => {
      try {
        uChan.unbind('new-direct-message', handleNewDirectMessage);
        uChan.unbind('incoming-call', handleIncomingCall);
        uChan.unbind('space-started', handleSpaceStarted);
        uChan.unbind('follow-changed', handleFollowChanged);
        pusher.unsubscribe(userChannelName);
      } catch {}
    };
  }, [user?.id, activeChannelId, handleMarkChannelRead, showToast]);

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

    const handleServerSpaceStarted = (payload) => {
      if (!payload) return;
      if (String(payload.caller?.id) === String(user.id)) return;
      playSpaceTone();
      const callerName = payload.caller?.full_name || payload.caller?.username || payload.caller?.name || 'Study Partner';
      const currentServer = servers.find((s) => s.id === activeServerId);
      const sName = currentServer?.name || 'this room';
      showToast(`🎙️ ${callerName} started a live space in ${sName}!`);
    };

    chan.bind('server-new-message', handleServerNewMessage);
    chan.bind('space-started', handleServerSpaceStarted);

    return () => {
      try {
        chan.unbind('server-new-message', handleServerNewMessage);
        chan.unbind('space-started', handleServerSpaceStarted);
        pusher.unsubscribe(serverChannelName);
      } catch {}
    };
  }, [activeServerId, activeChannelId, servers, workspace, user?.id, handleMarkChannelRead, showToast]);

  // Pusher Realtime global space notifications for all devices & PWA
  useEffect(() => {
    if (!user?.id) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    let globalChan = null;
    let voiceChan = null;
    try {
      globalChan = pusher.subscribe('rooms-global');
      const handleGlobalSpaceJoined = (payload) => {
        if (!payload || String(payload.userId) === String(user.id)) return;
        const participantName = payload.username || 'A scholar';
        const spaceName = payload.channelName || 'Live Space';
        showToast(`🎙️ ${participantName} joined ${spaceName}`);
        fetchNotificationsData();
      };
      globalChan.bind('space-joined', handleGlobalSpaceJoined);

      voiceChan = pusher.subscribe('voice-counts-global');
      const handleGlobalVoiceCounts = () => {
        fetchNotificationsData();
      };
      voiceChan.bind('voice-counts-updated', handleGlobalVoiceCounts);

      return () => {
        try {
          globalChan?.unbind('space-joined', handleGlobalSpaceJoined);
          pusher.unsubscribe('rooms-global');
          voiceChan?.unbind('voice-counts-updated', handleGlobalVoiceCounts);
          pusher.unsubscribe('voice-counts-global');
        } catch {}
      };
    } catch {}
  }, [user?.id, showToast, fetchNotificationsData]);

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
  const resolvedVoiceServerName =
    activeServerName ||
    servers.find((s) => String(s.id) === String(voiceSession?.joinedServerId))?.name ||
    'Study Room';

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



  const CHATTER_TABS = ['feed', 'rooms', 'guru', 'chats', 'profile'];

  return (
    <div
      className={shellClasses}
      id="dashboard-shell"
      suppressHydrationWarning
    >
      {/* ── Guest Mode Header Banner (Elite Quiz Web Guest Experience) ── */}
      {isGuest && (
        <div className="guest-banner-bar" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 16 }}>👋</span>
            <span style={{ fontSize: 13, color: '#f3e8f8' }}>
              <strong>Guest Scholar Mode:</strong> Exploring StudyCord & Quiz Arena.
            </span>
          </div>
          <button
            type="button"
            onClick={() => requireAuth('sign in to your scholar account')}
            style={{
              background: 'linear-gradient(135deg, #c564bb 0%, #903487 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '4px 13px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(197, 100, 187, 0.4)',
              whiteSpace: 'nowrap',
            }}
          >
            Sign In / Register
          </button>
        </div>
      )}

      {/* ── Unified Toast Notification (Faster auto-dismiss, tap/swipe to dismiss) ── */}
      {toast && (
        <div
          className="toast studycord-unified-toast"
          style={{ zIndex: 10000 }}
          onClick={() => setToast('')}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            e.currentTarget.__startY = touch.clientY;
          }}
          onTouchEnd={(e) => {
            const touch = e.changedTouches[0];
            const startY = e.currentTarget.__startY || 0;
            if (Math.abs(touch.clientY - startY) > 25) {
              setToast('');
            }
          }}
          role="status"
          aria-live="polite"
        >
          <span className="studycord-unified-toast__text">{toast}</span>
          <button
            type="button"
            className="studycord-unified-toast__close"
            onClick={(e) => {
              e.stopPropagation();
              setToast('');
            }}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
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
        isJoinedInVoiceRoom={Boolean(voiceSession?.joinedChannelId)}
        activeVoiceChannelName={activeVoiceChannelName}
        onLeaveVoice={leaveVoiceSession}
        onOpenVoice={() => setAudioSpaceModalOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={handleLogout}
      />

      {/* ── Content View ── */}
      {/* If chatterTab === 'feed', render ChatterFeedView with desktop right sidebar */}
      {chatterTab === 'feed' && (
        <div style={{ flex: 1, display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--chatter-black)' }}>
          <div className="chatter-main-column">
            <div className="chatter-center-container">
              <ChatterTopBar
                onOpenNotifications={() => setNotificationsModalOpen(true)}
                unreadNotificationsCount={unreadNotificationsCount}
                onOpenSearch={() => setSearchModalOpen(true)}
                onOpenLiveSpaces={() => setChatterTab('rooms')}
                onRandomTopic={() => setChatterTab('rooms')}
                feedTab={feedTab}
                onSelectFeedTab={setFeedTab}
                isGuest={isGuest}
                onOpenAuthModal={() => requireAuth('access your scholar account')}
              />
              <ChatterFeedView
                serverId={activeServerId}
                profile={profile}
                userId={user?.id}
                onOpenLiveSpaces={() => setChatterTab('rooms')}
                onStartDM={handleStartDM}
                followingMap={followingMap}
                onToggleFollow={handleToggleFollow}
                targetPostId={targetPostId}
                filterTag={filterTag}
                onSelectTag={setFilterTag}
                feedTab={feedTab}
                onSelectFeedTab={setFeedTab}
                onRequireAuth={requireAuth}
              />
            </div>
          </div>
          <ChatterRightSidebar
            onOpenSearch={() => setSearchModalOpen(true)}
            onOpenRooms={() => setChatterTab('rooms')}
            onOpenGuru={() => setChatterTab('guru')}
            onSelectTag={(tag) => {
              setFilterTag(tag);
              setChatterTab('feed');
            }}
            followingMap={followingMap}
            onToggleFollow={handleToggleFollow}
            onOpenUserProfile={(scholar) => setUserProfileModalTarget(scholar)}
            currentUserId={user?.id}
          />
        </div>
      )}

      {/* If chatterTab === 'rooms', render ChatterRoomsView with desktop right sidebar or active room chat */}
      {chatterTab === 'rooms' && (
        <div style={{ flex: 1, display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--chatter-black)' }}>
          <div className={`chatter-main-column ${activeChannelId && !activePartnerUser && activeChannelType !== 'voice' ? 'chatter-chats-list-pane--with-active' : ''}`}>
            <div className="chatter-center-container">
              <ChatterTopBar
                onOpenNotifications={() => setNotificationsModalOpen(true)}
                unreadNotificationsCount={unreadNotificationsCount}
                onOpenSearch={() => setSearchModalOpen(true)}
                onOpenLiveSpaces={() => setChatterTab('rooms')}
                onRandomTopic={() => setChatterTab('rooms')}
                title="Study Rooms"
                isGuest={isGuest}
                onOpenAuthModal={() => requireAuth('access your scholar account')}
              />
              <ChatterRoomsView
                servers={servers}
                activeServerId={activeServerId}
                onRefreshServers={fetchServers}
                onOpenSettings={(srv) => {
                  if (srv?.id) {
                    handleSelectServer(srv.id);
                  }
                  setSettingsOpen(true);
                }}
                onSelectServer={async (sId, cId, cName) => {
                  handleSelectServer(sId);
                  let selectedServer = servers.find((s) => s.id === sId);
                  if (!selectedServer) {
                    await fetchServers();
                  }
                  const roomName = selectedServer?.name || cName || 'Study Room';
                  if (cId) {
                    setActiveChannelId(cId);
                    setActiveChannelName(roomName);
                    setActiveChannelType('text');
                  }
                  setActivePartnerUser(null);
                  setChatterTab('rooms');
                }}
                onCreateServer={() => setServerActionModal('create')}
                onJoinServer={() => setServerActionModal('join')}
                onJoinVoiceChannel={(sId, cId, cName) => {
                  if (sId) setActiveServerId(sId);
                  setActiveChannelId(null);
                  setActivePartnerUser(null);
                  setActiveChannelName(cName || 'Study Room');
                  setActiveChannelType('voice');
                  setAudioSpaceModalOpen(true);
                  voiceSession?.handleJoin?.(cId, cName || 'Study Room', sId);
                }}
                isJoinedInVoiceRoom={isJoinedInVoiceRoom}
                activeVoiceChannelName={activeVoiceChannelName}
              />
            </div>
          </div>

          {activeChannelId && !activePartnerUser && activeChannelType !== 'voice' ? (
            <div className="chatter-chat-room-pane">
              <ChatterChatRoom
                channelId={activeChannelId}
                channelName={activeChannelName}
                channelType={activeChannelType || 'text'}
                serverId={activeServerId}
                serverName={activeServerName}
                userId={user?.id}
                profile={profile}
                partnerUser={null}
                onOpenSettings={() => setSettingsOpen(true)}
                onBack={() => {
                  setActiveChannelId(null);
                  setActivePartnerUser(null);
                }}
                onStartDM={handleStartDM}
                onLeaveRoom={(leftServerId) => {
                  setServers((prev) => prev.filter((s) => s.id !== leftServerId));
                  setActiveServerId(null);
                  setActiveChannelId(null);
                  setChatterTab('rooms');
                  showToast('Left study room');
                }}
                onStartAudioCall={() => {
                  setAudioSpaceModalOpen(true);
                  const targetChannelId = activeChannelId || activeServerId || 'general-study';
                  const targetChannelName = activeChannelName || 'Study Room';
                  const targetServerId = activeServerId || 'direct-space';
                  voiceSession?.handleJoin?.(targetChannelId, targetChannelName, targetServerId);
                }}
              />
            </div>
          ) : (
            <ChatterRightSidebar
              onOpenSearch={() => setSearchModalOpen(true)}
              onOpenRooms={() => setChatterTab('rooms')}
              onOpenGuru={() => setChatterTab('guru')}
              onSelectTag={(tag) => {
                setFilterTag(tag);
                setChatterTab('feed');
              }}
              followingMap={followingMap}
              onToggleFollow={handleToggleFollow}
              onOpenUserProfile={(scholar) => setUserProfileModalTarget(scholar)}
              currentUserId={user?.id}
            />
          )}
        </div>
      )}

      {/* StudyCord AI: Permanently mounted in background so chat thinking & streaming persist across navigation */}
      <div
        className="chatter-guru-wrapper"
        style={{
          display: chatterTab === 'guru' ? 'flex' : 'none',
          flex: 1,
          height: '100%',
          maxHeight: '100dvh',
          width: '100%',
        }}
      >
        <ChatterGuruView
          channelName={activeChannelName}
          serverId={activeServerId}
          onBack={() => setChatterTab('feed')}
        />
      </div>

      {/* Quiz Arena Tab (Elite Quiz Web Engine) */}
      {chatterTab === 'quiz' && (
        <div style={{ flex: 1, display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--background)' }}>
          <ChatterQuizArenaView
            user={user || profile}
            onBack={() => setChatterTab('feed')}
            onOpenGuru={() => setChatterTab('guru')}
          />
        </div>
      )}

      {/* If chatterTab === 'profile', render ChatterProfileView with desktop right sidebar */}
      {chatterTab === 'profile' && (
        <div style={{ flex: 1, display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--chatter-black)' }}>
          <div className="chatter-main-column">
            <div className="chatter-center-container">
              <ChatterTopBar
                onOpenNotifications={() => setNotificationsModalOpen(true)}
                unreadNotificationsCount={unreadNotificationsCount}
                onOpenSearch={() => setSearchModalOpen(true)}
                onOpenLiveSpaces={() => setChatterTab('rooms')}
                onRandomTopic={() => setChatterTab('rooms')}
                title="Profile"
                isGuest={isGuest}
                onOpenAuthModal={() => requireAuth('access your scholar account')}
              />
              <ChatterProfileView
                profile={profile}
                servers={servers}
                onLogout={handleLogout}
                onOpenStatusModal={() => setUserStatusModalOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onSelectServer={(sId) => {
                  handleSelectServer(sId);
                  setChatterTab('chats');
                }}
                onOpenGuru={() => setChatterTab('guru')}
                followingMap={followingMap}
                onSelectPost={(pId) => {
                  setTargetPostId(pId);
                  setChatterTab('feed');
                }}
              />
            </div>
          </div>
          <ChatterRightSidebar
            onOpenSearch={() => setSearchModalOpen(true)}
            onOpenRooms={() => setChatterTab('rooms')}
            onOpenGuru={() => setChatterTab('guru')}
            followingMap={followingMap}
            onToggleFollow={handleToggleFollow}
            onOpenUserProfile={(scholar) => setUserProfileModalTarget(scholar)}
            currentUserId={user?.id}
          />
        </div>
      )}

      {/* If chatterTab === 'chats' */}
      {chatterTab === 'chats' && (
        <div style={{ flex: 1, display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--chatter-black)' }}>
          {/* Left conversations list pane */}
          <div className={`chatter-chats-list-pane ${activeChannelId ? 'chatter-chats-list-pane--with-active' : ''}`}>
            <ChatterTopBar
              onOpenNotifications={() => setNotificationsModalOpen(true)}
              unreadNotificationsCount={unreadNotificationsCount}
              onOpenSearch={() => setSearchModalOpen(true)}
              onOpenLiveSpaces={() => setChatterTab('rooms')}
              onRandomTopic={() => setChatterTab('rooms')}
              title="Chats"
              isGuest={isGuest}
              onOpenAuthModal={() => requireAuth('access your scholar account')}
            />
            <ChatterChatsView
              servers={servers}
              activeServerId={activeServerId}
              activeChannelId={activeChannelId}
              onSelectChannel={(sId, cId, cName, cType, partnerData) => {
                setActiveServerId(sId);
                setActiveChannelId(cId);
                setActiveChannelName(cName);
                setActiveChannelType(cType || 'text');
                if (partnerData) {
                  setActivePartnerUser(partnerData);
                } else {
                  setActivePartnerUser(null);
                  setChatterTab('rooms');
                }
              }}
              onOpenDMsModal={() => setNewDMSheetOpen(true)}
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
                channelType={activeChannelType || 'text'}
                serverId={activeServerId}
                serverName={activeServerName}
                userId={user?.id}
                profile={profile}
                partnerUser={activePartnerUser}
                partnerAvatar={activePartnerUser?.avatar_url}
                isPartnerOnline={activePartnerUser?.online}
                partnerLastSeen={activePartnerUser?.last_seen}
                onBack={() => {
                  setActiveChannelId(null);
                  setActivePartnerUser(null);
                }}
                onStartDM={handleStartDM}
                onLeaveRoom={(leftServerId) => {
                  setServers((prev) => prev.filter((s) => s.id !== leftServerId));
                  setActiveServerId(null);
                  setActiveChannelId(null);
                  setChatterTab('rooms');
                  showToast('Left study room');
                }}
                onStartAudioCall={() => {
                  setAudioSpaceModalOpen(true);
                  const targetChannelId = activeChannelId || activeServerId || 'general-study';
                  const targetChannelName = activeChannelName || 'Study Room';
                  const targetServerId = activeServerId || 'direct-space';
                  voiceSession?.handleJoin?.(targetChannelId, targetChannelName, targetServerId);
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
              <p style={{ fontSize: 14, color: 'var(--chatter-light-text)', margin: 0 }}>
                Choose a direct message or study channel to begin collaborating.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Chatter Audio & Video Space Modal (Full Screen Stage) ── */}
      {audioSpaceModalOpen && (
        <ChatterAudioSpaceModal
          voiceSession={voiceSession}
          channelName={activeVoiceChannelName || activeChannelName}
          serverName={resolvedVoiceServerName}
          roomOwnerId={
            activeServer?.owner_id ||
            servers.find((s) => s.id === (voiceSession?.joinedServerId || activeServerId))?.owner_id ||
            null
          }
          onClose={() => setAudioSpaceModalOpen(false)}
          userId={user?.id}
          profile={profile}
        />
      )}

      {/* ── Persistent Floating Call Bar (Docked when active & modal is minimized) ── */}
      {Boolean(voiceSession?.joinedChannelId) && !audioSpaceModalOpen && (
        <ChatterFloatingCallBar
          voiceSession={voiceSession}
          channelName={activeVoiceChannelName || activeChannelName}
          serverName={resolvedVoiceServerName}
          onExpand={() => setAudioSpaceModalOpen(true)}
          onLeave={() => leaveVoiceSession?.()}
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
      {/* Hide bottom navigation when inside active channel chat room or when on AI Guru screen */}
      {!(chatterTab === 'chats' && activeChannelId) && !(chatterTab === 'rooms' && activeChannelId) && chatterTab !== 'guru' && (
        <ChatterBottomNav
          activeTab={chatterTab}
          onSelectTab={(tab) => {
            setActiveChannelId(null);
            setChatterTab(tab);
          }}
          unreadChatsCount={Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
          isHidden={false}
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

      {/* ── Chatter Search Modal ── */}
      <ChatterSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        servers={servers}
        onSelectServer={(sId) => {
          handleSelectServer(sId);
          setChatterTab('chats');
        }}
        onStartDM={handleStartDM}
        onSelectTopic={(_topicName) => {
          setChatterTab('rooms');
        }}
        followingMap={followingMap}
        onToggleFollow={handleToggleFollow}
      />

      {/* ── Chatter New DM Mobile Sheet ── */}
      <ChatterNewDMSheet
        isOpen={newDMSheetOpen}
        onClose={() => setNewDMSheetOpen(false)}
        members={members}
        currentUserId={user?.id}
        onSelectUser={handleStartDM}
      />

      {/* ── Chatter Room Action Modal (Create & Join Study Rooms) ── */}
      <ChatterRoomActionModal
        isOpen={Boolean(serverActionModal)}
        mode={serverActionModal || 'create'}
        onClose={() => setServerActionModal(null)}
        onRoomCreated={(newServer) => {
          setServers((prev) => [newServer, ...prev.filter((s) => s.id !== newServer.id)]);
          handleSelectServer(newServer.id);
          setChatterTab('chats');
          showToast(`Study room "${newServer.name}" created!`);
        }}
        onRoomJoined={(joinedServer) => {
          setServers((prev) => [joinedServer, ...prev.filter((s) => s.id !== joinedServer.id)]);
          handleSelectServer(joinedServer.id);
          setChatterTab('chats');
          showToast(`Joined study room "${joinedServer.name}"!`);
        }}
      />

      {/* ── Incoming Call Popup Alert Banner ── */}
      {incomingCallAlert && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--chatter-sheet)',
            border: '2px solid var(--chatter-primary)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8), 0 0 24px rgba(64, 227, 120, 0.4)',
            borderRadius: 24,
            padding: '12px 18px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            animation: 'chatterSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(64, 227, 120, 0.2)',
              color: 'var(--chatter-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            📞
          </div>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: '#fff' }}>
              {incomingCallAlert.caller?.full_name || incomingCallAlert.caller?.username || 'Study Partner'}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--chatter-primary)', fontWeight: 600 }}>
              Incoming Study Space Call...
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 6 }}>
            <button
              type="button"
              onClick={() => {
                stopCallRingtone();
                const targetChannelId = incomingCallAlert.channelId || 'direct-space';
                setIncomingCallAlert(null);
                setAudioSpaceModalOpen(true);
                voiceSession?.handleJoin?.(targetChannelId, 'Direct Space Call', activeServerId || 'direct-space');
              }}
              style={{
                background: 'var(--chatter-primary)',
                color: '#0E0E0E',
                border: 'none',
                borderRadius: 18,
                padding: '8px 16px',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Join
            </button>
            <button
              type="button"
              onClick={() => {
                stopCallRingtone();
                setIncomingCallAlert(null);
              }}
              style={{
                background: 'rgba(255, 57, 57, 0.2)',
                color: '#FF6B6B',
                border: '1px solid rgba(255, 57, 57, 0.4)',
                borderRadius: 18,
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* ── Chatter Notifications & Live Spaces Modal ── */}
      <ChatterNotificationsModal
        isOpen={notificationsModalOpen}
        onClose={() => setNotificationsModalOpen(false)}
        activeSpaces={activeLiveSpaces}
        notifications={notificationsList}
        unreadCount={unreadNotificationsCount}
        onJoinSpace={(sId, cId, cName) => {
          setNotificationsModalOpen(false);
          if (sId) {
            setActiveServerId(sId);
          }
          setActiveChannelId(null);
          setActivePartnerUser(null);
          setActiveChannelName(cName || 'Study Room');
          setActiveChannelType('voice');
          setChatterTab('rooms');
          setAudioSpaceModalOpen(true);
          voiceSession?.handleJoin?.(cId, cName || 'Study Room', sId);
        }}
        onMarkAllRead={async () => {
          try {
            await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'mark-all-read' }),
            });
            setNotificationsList((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadNotificationsCount(activeLiveSpaces.length);
          } catch {}
        }}
        onClearAll={async () => {
          try {
            await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'clear-all' }),
            });
            setNotificationsList([]);
            setUnreadNotificationsCount(activeLiveSpaces.length);
          } catch {}
        }}
        onRefresh={fetchNotificationsData}
      />

      {/* ── Guest Auth Modal (Elite Quiz Sign-in Prompt) ── */}
      <GuestAuthModal
        isOpen={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        feature={authPromptFeature}
      />
    </div>
  );
}
