import { getDatabase, safeObjectId } from './mongodb';
import { getPusherServer } from './pusherServer';

/**
 * In-memory fallback and cache for voice participants and signaling.
 * Works seamlessly with or without MongoDB and Pusher.
 */

// channelId -> Map(userId -> participant)
const participantsByChannel = new Map();

// userId -> array of pending signals [{ sender_id, receiver_id, channel_id, signal_type, signal_data, timestamp }]
const pendingSignalsByUser = new Map();

const STALE_PARTICIPANT_TIMEOUT_MS = 12000;
const SIGNAL_TTL_MS = 25000;

export function getBaseUserId(raw) {
  if (!raw) return '';
  let id = '';
  if (typeof raw === 'object' && raw !== null) {
    id = raw.user_id || raw.userId || raw.identity || raw.profiles?.id || raw.id || '';
  } else {
    id = raw;
  }
  let str = String(id).trim();
  if (str.startsWith('vp-')) {
    const withoutVp = str.slice(3);
    const lastDash = withoutVp.lastIndexOf('-');
    str = lastDash !== -1 ? withoutVp.slice(lastDash + 1) : withoutVp;
  }
  if (str.includes('__')) {
    str = str.split('__')[0];
  }
  return str.trim();
}

export function getChannelUniqueCount(channelId) {
  const userMap = participantsByChannel.get(channelId);
  if (!userMap) return 0;
  const uniqueUsers = new Set();
  for (const [uid, p] of userMap.entries()) {
    const bId = getBaseUserId(p?.user_id || uid);
    if (bId) uniqueUsers.add(bId);
  }
  return uniqueUsers.size;
}

async function cleanupStaleDb() {
  try {
    const db = await getDatabase();
    const cutoff = new Date(Date.now() - STALE_PARTICIPANT_TIMEOUT_MS).toISOString();
    await db.collection('voice_participants').deleteMany({
      last_seen: { $lt: cutoff }
    });
  } catch {}
}

function cleanupStale() {
  const now = Date.now();
  let anyRemoved = false;
  for (const [channelId, userMap] of participantsByChannel.entries()) {
    for (const [userId, participant] of userMap.entries()) {
      const lastSeen = new Date(participant.last_seen || 0).getTime();
      if (now - lastSeen > STALE_PARTICIPANT_TIMEOUT_MS) {
        userMap.delete(userId);
        anyRemoved = true;
      }
    }
    if (userMap.size === 0) {
      participantsByChannel.delete(channelId);
    }
  }

  // Cleanup signals
  for (const [userId, signals] of pendingSignalsByUser.entries()) {
    const valid = signals.filter((s) => now - s.timestamp < SIGNAL_TTL_MS);
    if (valid.length === 0) {
      pendingSignalsByUser.delete(userId);
    } else {
      pendingSignalsByUser.set(userId, valid);
    }
  }

  if (anyRemoved) {
    cleanupStaleDb().catch(() => {});
  }
}

// Periodic cleanup every 10 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupStale();
    cleanupStaleDb().catch(() => {});
  }, 10000);
}

export async function addOrUpdateParticipant({ channelId, serverId, user, isMuted = false }) {
  cleanupStale();
  const nowIso = new Date().toISOString();
  const userId = getBaseUserId(user.id || user._id);

  const participant = {
    id: `vp-${channelId}-${userId}`,
    channel_id: channelId,
    server_id: serverId || null,
    user_id: userId,
    is_muted: Boolean(isMuted),
    joined_at: nowIso,
    last_seen: nowIso,
    name: user.full_name || user.name || user.username || 'Study Partner',
    user_name: user.full_name || user.name || user.username || 'Study Partner',
    profiles: {
      id: userId,
      username: user.username || user.name || user.email?.split('@')[0] || 'Study Partner',
      full_name: user.full_name || user.name || 'Study Partner',
      name: user.full_name || user.name || 'Study Partner',
      avatar_url: user.image || user.avatar_url || null,
    },
  };

  if (!participantsByChannel.has(channelId)) {
    participantsByChannel.set(channelId, new Map());
  }
  participantsByChannel.get(channelId).set(userId, participant);

  // Sync to MongoDB if available
  let serverDoc = null;
  try {
    const db = await getDatabase();
    if (serverId) {
      serverDoc = await db.collection('servers').findOne({
        $or: [{ _id: safeObjectId(serverId) }, { id: serverId }]
      });
    }
    await db.collection('voice_participants').updateOne(
      { channel_id: channelId, user_id: userId },
      { $set: participant },
      { upsert: true }
    );
  } catch {}

  const roomTitle = serverDoc?.name || 'Study Room';

  // Trigger Pusher
  try {
    const pusher = getPusherServer();
    await pusher.trigger(`voice-channel-${channelId}`, 'participant-joined', participant);
    const liveCount = getChannelUniqueCount(channelId) || 1;
    const activeSpeakers = getActiveSpeakersList(channelId);
    if (serverId) {
      await pusher.trigger(`voice-counts-${serverId}`, 'voice-counts-updated', {
        channelId,
        count: liveCount,
        speakers: activeSpeakers,
      });
      if (liveCount === 1) {
        await pusher.trigger(`server-${serverId}`, 'space-started', {
          channelId,
          serverId,
          serverName: roomTitle,
          channelName: 'Study Room',
          caller: participant.profiles,
          speakers: activeSpeakers,
        });

        // Persist notification for server members so they see ongoing session when offline/away
        try {
          const db = await getDatabase();
          const memberIds = (serverDoc?.member_ids || serverDoc?.members || [])
            .map((m) => (typeof m === 'object' ? String(m.user_id || m.id) : String(m)))
            .filter((mId) => mId && getBaseUserId(mId) !== userId);

          if (memberIds.length > 0) {
            const notifs = memberIds.map((mId) => ({
              recipient_id: mId,
              type: 'space-started',
              title: `🎙️ ${roomTitle} Space Started`,
              message: `${participant.profiles?.full_name || participant.name || 'A classmate'} started a live space in ${roomTitle}`,
              actor: participant.profiles,
              data: {
                channelId,
                serverId,
                serverName: roomTitle,
                category: serverDoc?.category || 'Study',
              },
              read: false,
              createdAt: new Date().toISOString(),
            }));
            await db.collection('notifications').insertMany(notifs);
          }
        } catch (notifErr) {
          console.debug('Space started notif error:', notifErr?.message);
        }
      }
    }
    await pusher.trigger('voice-counts-global', 'voice-counts-updated', {
      channelId,
      serverId: serverId || null,
      serverName: roomTitle,
      count: liveCount,
      caller: participant.profiles,
      speakers: activeSpeakers,
    });

    // Check if channel is a direct message conversation to notify recipient of incoming call
    try {
      const db = await getDatabase();
      const conv = await db.collection('conversations').findOne({
        $or: [{ _id: channelId }, { id: channelId }]
      });
      if (conv?.participant_ids && Array.isArray(conv.participant_ids)) {
        const otherUserId = conv.participant_ids.find((pid) => String(pid) !== String(userId));
        if (otherUserId) {
          await pusher.trigger(`user-${otherUserId}`, 'incoming-call', {
            channelId,
            conversationId: channelId,
            caller: participant.profiles,
          });
        }
      }
    } catch {}
  } catch {}

  return participant;
}

export async function broadcastHandRaise({ channelId, userId, userName, raised }) {
  try {
    const pusher = getPusherServer();
    await pusher.trigger(`voice-channel-${channelId}`, 'hand-raise-updated', {
      user_id: String(userId),
      user_name: userName || 'Study Partner',
      raised: Boolean(raised),
    });
    return true;
  } catch (err) {
    console.warn('Error broadcasting hand raise:', err.message);
    return false;
  }
}

export async function removeParticipant({ channelId, userId, serverId, userName }) {
  cleanupStale();
  const sUserId = getBaseUserId(userId);
  let removed = false;
  let participantName = userName || null;
  if (participantsByChannel.has(channelId)) {
    const channelMap = participantsByChannel.get(channelId);
    for (const [key, existing] of channelMap.entries()) {
      if (
        getBaseUserId(key) === sUserId ||
        getBaseUserId(existing?.user_id) === sUserId ||
        getBaseUserId(existing?.profiles?.id) === sUserId
      ) {
        if (existing?.profiles?.full_name || existing?.profiles?.username) {
          participantName = existing.profiles.full_name || existing.profiles.username;
        }
        channelMap.delete(key);
        removed = true;
      }
    }
    if (channelMap.size === 0) {
      participantsByChannel.delete(channelId);
    }
  }

  try {
    const db = await getDatabase();
    if (!participantName) {
      const doc = await db.collection('voice_participants').findOne({
        channel_id: channelId,
        $or: [
          { user_id: sUserId },
          { user_id: userId },
          { 'profiles.id': sUserId },
          { user_id: { $regex: `^${sUserId}` } },
        ],
      });
      if (doc?.profiles?.full_name || doc?.profiles?.username) {
        participantName = doc.profiles.full_name || doc.profiles.username;
      }
    }
    await db.collection('voice_participants').deleteMany({
      channel_id: channelId,
      $or: [
        { user_id: sUserId },
        { user_id: userId },
        { 'profiles.id': sUserId },
        { user_id: { $regex: `^${sUserId}` } },
      ],
    });
  } catch {}

  const activeSpeakers = getActiveSpeakersList(channelId);
  const liveCount = getChannelUniqueCount(channelId);

  try {
    const pusher = getPusherServer();
    await pusher.trigger(`voice-channel-${channelId}`, 'participant-left', {
      user_id: sUserId,
      user_name: participantName || 'A scholar',
    });
    if (serverId) {
      await pusher.trigger(`voice-counts-${serverId}`, 'voice-counts-updated', {
        channelId,
        count: liveCount,
        speakers: activeSpeakers,
      });
    }
    await pusher.trigger('voice-counts-global', 'voice-counts-updated', {
      channelId,
      serverId: serverId || null,
      count: liveCount,
      speakers: activeSpeakers,
    });
  } catch {}

  return removed;
}

export async function updateParticipantState({ channelId, userId, isMuted, touchHeartbeat = true }) {
  cleanupStale();
  const nowIso = new Date().toISOString();
  let participant = participantsByChannel.get(channelId)?.get(userId);

  if (participant) {
    if (typeof isMuted === 'boolean') participant.is_muted = isMuted;
    if (touchHeartbeat) participant.last_seen = nowIso;
  }

  try {
    const db = await getDatabase();
    const update = {};
    if (typeof isMuted === 'boolean') update.is_muted = isMuted;
    if (touchHeartbeat) update.last_seen = nowIso;
    await db.collection('voice_participants').updateOne(
      { channel_id: channelId, user_id: userId },
      { $set: update }
    );
  } catch {}

  if (typeof isMuted === 'boolean') {
    try {
      const pusher = getPusherServer();
      await pusher.trigger(`voice-channel-${channelId}`, 'participant-updated', {
        user_id: userId,
        is_muted: isMuted,
      });
      await pusher.trigger('voice-counts-global', 'voice-counts-updated', {
        channelId,
        count: getChannelUniqueCount(channelId),
        speakers: getActiveSpeakersList(channelId),
      });
    } catch {}
  }

  return participant;
}

export async function getChannelParticipants(channelId) {
  cleanupStale();
  const inMemory = Array.from(participantsByChannel.get(channelId)?.values() || []);
  if (inMemory.length > 0) {
    return inMemory;
  }

  try {
    const db = await getDatabase();
    const cutoff = new Date(Date.now() - STALE_PARTICIPANT_TIMEOUT_MS).toISOString();
    const rows = await db.collection('voice_participants')
      .find({ channel_id: channelId, last_seen: { $gte: cutoff } })
      .toArray();
    
    if (rows.length > 0) {
      if (!participantsByChannel.has(channelId)) {
        participantsByChannel.set(channelId, new Map());
      }
      for (const r of rows) {
        participantsByChannel.get(channelId).set(r.user_id, r);
      }
      return rows;
    }
  } catch {}

  return inMemory;
}

export function getActiveSpeakersList(channelId) {
  const userMap = participantsByChannel.get(channelId);
  if (!userMap) return [];
  const uniqueUsers = new Set();
  const speakerList = [];
  for (const [uId, p] of userMap.entries()) {
    const baseId = getBaseUserId(p.user_id || uId);
    if (baseId && !uniqueUsers.has(baseId)) {
      uniqueUsers.add(baseId);
      speakerList.push({
        userId: baseId,
        name: p.profiles?.full_name || p.profiles?.name || p.name || 'Scholar',
        avatar_url: p.profiles?.avatar_url || null,
        is_muted: Boolean(p.is_muted),
      });
    }
  }
  return speakerList;
}

export async function getServerVoiceCounts(serverId) {
  cleanupStale();
  const counts = {};
  const speakers = {};

  for (const [chanId, userMap] of participantsByChannel.entries()) {
    if (userMap.size > 0) {
      const first = userMap.values().next().value;
      if (!serverId || serverId === 'all' || first?.server_id === serverId) {
        const uniqueUsers = new Set();
        const speakerList = [];
        for (const [uId, p] of userMap.entries()) {
          const baseId = getBaseUserId(p.user_id || uId);
          if (baseId && !uniqueUsers.has(baseId)) {
            uniqueUsers.add(baseId);
            speakerList.push({
              userId: baseId,
              name: p.profiles?.full_name || p.profiles?.name || p.name || 'Scholar',
              avatar_url: p.profiles?.avatar_url || null,
              is_muted: Boolean(p.is_muted),
            });
          }
        }
        counts[chanId] = uniqueUsers.size;
        speakers[chanId] = speakerList;
      }
    }
  }

  try {
    const db = await getDatabase();
    const cutoff = new Date(Date.now() - STALE_PARTICIPANT_TIMEOUT_MS).toISOString();
    // Prune stale DB participants
    await db.collection('voice_participants').deleteMany({ last_seen: { $lt: cutoff } });

    const query = { last_seen: { $gte: cutoff } };
    if (serverId && serverId !== 'all') {
      query.server_id = serverId;
    }
    const rows = await db.collection('voice_participants')
      .find(query)
      .toArray();
    for (const r of rows) {
      const chanId = r.channel_id;
      // If we have active in-memory state for this channel, trust memory to prevent ghost flicker
      if (participantsByChannel.has(chanId)) {
        continue;
      }
      if (!counts[chanId]) {
        counts[chanId] = 0;
        speakers[chanId] = [];
      }
      const bId = getBaseUserId(r.user_id);
      if (bId && !speakers[chanId].some((sp) => getBaseUserId(sp.userId) === bId)) {
        counts[chanId] += 1;
        speakers[chanId].push({
          userId: bId,
          name: r.profiles?.full_name || r.profiles?.name || r.name || 'Scholar',
          avatar_url: r.profiles?.avatar_url || null,
          is_muted: Boolean(r.is_muted),
        });
      }
    }
  } catch {}

  return { counts, speakers };
}

export async function pushSignal({ senderId, receiverId, channelId, signalType, signalData }) {
  cleanupStale();
  const signal = {
    sender_id: senderId,
    receiver_id: receiverId,
    channel_id: channelId,
    signal_type: signalType,
    signal_data: signalData,
    timestamp: Date.now(),
  };

  // Queue in memory for receiver polling fallback
  if (receiverId) {
    if (!pendingSignalsByUser.has(receiverId)) {
      pendingSignalsByUser.set(receiverId, []);
    }
    pendingSignalsByUser.get(receiverId).push(signal);
  }

  // Broadcast in real-time via Pusher
  try {
    const pusher = getPusherServer();
    if (receiverId) {
      await pusher.trigger(`voice-signal-${receiverId}`, 'signal', signal);
    }
    // Also broadcast channel-wide for camera / screen share state changes
    if (['camera-state', 'screen-share-state'].includes(signalType)) {
      await pusher.trigger(`voice-channel-${channelId}`, 'state-change', signal);
    }
  } catch (err) {
    console.warn('[WebRTC Signal] Pusher broadcast warning:', err.message);
  }

  return signal;
}

export function popPendingSignals(userId) {
  cleanupStale();
  const signals = pendingSignalsByUser.get(userId) || [];
  pendingSignalsByUser.delete(userId);
  return signals;
}
