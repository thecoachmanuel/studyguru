import { getDatabase } from './mongodb';
import { getPusherServer } from './pusherServer';

/**
 * In-memory fallback and cache for voice participants and signaling.
 * Works seamlessly with or without MongoDB and Pusher.
 */

// channelId -> Map(userId -> participant)
const participantsByChannel = new Map();

// userId -> array of pending signals [{ sender_id, receiver_id, channel_id, signal_type, signal_data, timestamp }]
const pendingSignalsByUser = new Map();

const STALE_PARTICIPANT_TIMEOUT_MS = 45000;
const SIGNAL_TTL_MS = 25000;

function cleanupStale() {
  const now = Date.now();
  for (const [channelId, userMap] of participantsByChannel.entries()) {
    for (const [userId, participant] of userMap.entries()) {
      const lastSeen = new Date(participant.last_seen || 0).getTime();
      if (now - lastSeen > STALE_PARTICIPANT_TIMEOUT_MS) {
        userMap.delete(userId);
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
}

// Periodic cleanup every 15 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupStale, 15000);
}

export async function addOrUpdateParticipant({ channelId, serverId, user, isMuted = false }) {
  cleanupStale();
  const nowIso = new Date().toISOString();
  const userId = String(user.id || user._id);

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
  try {
    const db = await getDatabase();
    await db.collection('voice_participants').updateOne(
      { channel_id: channelId, user_id: userId },
      { $set: participant },
      { upsert: true }
    );
  } catch {}

  // Trigger Pusher
  try {
    const pusher = getPusherServer();
    await pusher.trigger(`voice-channel-${channelId}`, 'participant-joined', participant);
    const liveCount = participantsByChannel.get(channelId)?.size || 1;
    if (serverId) {
      await pusher.trigger(`voice-counts-${serverId}`, 'voice-counts-updated', {
        channelId,
        count: liveCount,
      });
      if (liveCount === 1) {
        await pusher.trigger(`server-${serverId}`, 'space-started', {
          channelId,
          serverId,
          caller: participant.profiles,
        });
      }
    }
    await pusher.trigger('voice-counts-global', 'voice-counts-updated', {
      channelId,
      serverId: serverId || null,
      count: liveCount,
      caller: participant.profiles,
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
  const sUserId = String(userId);
  let removed = false;
  let participantName = userName || null;
  if (participantsByChannel.has(channelId)) {
    const existing = participantsByChannel.get(channelId).get(sUserId);
    if (existing?.profiles?.full_name || existing?.profiles?.username) {
      participantName = existing.profiles.full_name || existing.profiles.username;
    }
    removed = participantsByChannel.get(channelId).delete(sUserId);
  }

  try {
    const db = await getDatabase();
    if (!participantName) {
      const doc = await db.collection('voice_participants').findOne({ channel_id: channelId, user_id: sUserId });
      if (doc?.profiles?.full_name || doc?.profiles?.username) {
        participantName = doc.profiles.full_name || doc.profiles.username;
      }
    }
    await db.collection('voice_participants').deleteOne({ channel_id: channelId, user_id: sUserId });
  } catch {}

  try {
    const pusher = getPusherServer();
    await pusher.trigger(`voice-channel-${channelId}`, 'participant-left', {
      user_id: sUserId,
      user_name: participantName || 'A scholar',
    });
    const liveCount = participantsByChannel.get(channelId)?.size || 0;
    if (serverId) {
      await pusher.trigger(`voice-counts-${serverId}`, 'voice-counts-updated', {
        channelId,
        count: liveCount,
      });
    }
    await pusher.trigger('voice-counts-global', 'voice-counts-updated', {
      channelId,
      serverId: serverId || null,
      count: liveCount,
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

export async function getServerVoiceCounts(serverId) {
  cleanupStale();
  const counts = {};

  for (const [chanId, userMap] of participantsByChannel.entries()) {
    if (userMap.size > 0) {
      const first = userMap.values().next().value;
      if (!serverId || serverId === 'all' || first?.server_id === serverId) {
        counts[chanId] = userMap.size;
      }
    }
  }

  try {
    const db = await getDatabase();
    const cutoff = new Date(Date.now() - STALE_PARTICIPANT_TIMEOUT_MS).toISOString();
    const query = { last_seen: { $gte: cutoff } };
    if (serverId && serverId !== 'all') {
      query.server_id = serverId;
    }
    const rows = await db.collection('voice_participants')
      .find(query)
      .toArray();
    for (const r of rows) {
      counts[r.channel_id] = (counts[r.channel_id] || 0) + 1;
    }
  } catch {}

  return counts;
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
